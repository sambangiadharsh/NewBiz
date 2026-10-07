import { withTransaction } from '../../database/db.js';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { skuSequenceService } from './skuSequence.service.js';
import { categoryInheritanceService } from '../../services/categoryInheritance.service.js';
import { productsRepository } from './products.repository.js';
import {
  SearchCatalogQuery,
  ProposeProductInput,
  AddSellerProductInput,
  OnboardSellerProductInput,
  AdminQCReviewInput,
  AdminCreateProductInput,
  AdminAddVariantInput,
} from './products.validation.js';

function parseHighlights(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export class ProductsService {
  /**
   * Retrieves strictly leaf-level category attributes for a category.
   * Enforces zero-inheritance mapping.
   */
  async getLeafCategoryAttributes(categoryIdStr: string) {
    const categoryId = BigInt(categoryIdStr);

    const category = await productsRepository.findCategoryWithChildrenCount(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (category.ChildCount > 0) {
      throw new BadRequestError('Attributes can only be resolved for leaf categories (product types).');
    }

    const resolved = await categoryInheritanceService.resolveEffectiveCategoryAttributes(categoryId);

    return {
      categoryId: String(category.CategoryID),
      categoryName: category.CategoryName,
      categoryCode: category.CategoryCode,
      variantDefining: resolved.variantDefining,
      requiredSpecs: resolved.requiredSpecs,
      optionalSpecs: resolved.optionalSpecs,
    };
  }

  /**
   * Flow 1: Global Search for approved products with category authorization check.
   */
  async searchApprovedCatalog(sellerIdStr: string, query: SearchCatalogQuery) {
    const sellerId = BigInt(sellerIdStr);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const brandId = query.brandId ? BigInt(query.brandId) : undefined;
    const categoryId = query.categoryId ? BigInt(query.categoryId) : undefined;

    const [{ total, products }, sellerApplications] = await Promise.all([
      productsRepository.searchApprovedCatalog(sellerId, {
        brandId,
        categoryId,
        q: query.q,
        page,
        limit,
      }),
      productsRepository.findSellerApplications(sellerId),
    ]);

    const approvedCategoryIds = new Set(
      sellerApplications.filter((sa) => sa.Status === 'APPROVED').map((sa) => String(sa.CategoryID))
    );
    const pendingCategoryIds = new Set(
      sellerApplications.filter((sa) => sa.Status === 'SUBMITTED' || sa.Status === 'PENDING').map((sa) => String(sa.CategoryID))
    );

    const formatted = await Promise.all(
      products.map(async (pm) => {
        const categories = pm.CategoriesJson ? JSON.parse(pm.CategoriesJson) : [];
        const primaryCategory = categories[0];
        const categoryIdStr = primaryCategory ? String(primaryCategory.CategoryID) : '';

        let isSellerAuthorized = approvedCategoryIds.has(categoryIdStr);
        let isCategoryPendingApproval = pendingCategoryIds.has(categoryIdStr);

        if (!isSellerAuthorized && primaryCategory) {
          try {
            isSellerAuthorized = await productsRepository.hasApprovedCategoryApplication(sellerId, [BigInt(primaryCategory.CategoryID)]);
            if (!isSellerAuthorized) {
              const ancestry = await categoryInheritanceService.getCategoryAncestry(BigInt(primaryCategory.CategoryID));
              const ancestorIds = ancestry.map((a) => BigInt(a.CategoryID));
              if (ancestorIds.length > 0) {
                isSellerAuthorized = await productsRepository.hasApprovedCategoryApplication(sellerId, ancestorIds);
              }
              if (!isSellerAuthorized && pendingCategoryIds.size > 0) {
                isCategoryPendingApproval = ancestry.some((a) => pendingCategoryIds.has(String(a.CategoryID)));
              }
            }
          } catch {
            isSellerAuthorized = false;
          }
        }

        const variants: any[] = pm.VariantsJson ? JSON.parse(pm.VariantsJson) : [];

        return {
          productId: String(pm.ProductID),
          parentSku: pm.ParentSKU,
          productName: pm.ProductName,
          description: pm.Description,
          highlights: parseHighlights(pm.Highlights),
          brand: pm.BrandID
            ? {
                brandId: String(pm.BrandID),
                brandName: pm.BrandName,
                brandCode: pm.BrandCode,
              }
            : null,
          category: primaryCategory
            ? {
                categoryId: categoryIdStr,
                categoryName: primaryCategory.CategoryName,
                categoryCode: primaryCategory.CategoryCode,
              }
            : null,
          isSellerAuthorized,
          isCategoryPendingApproval,
          variants: variants.map((pv) => {
            const assets: any[] = pv.AssetsJson || [];
            const attrs: any[] = pv.AttributesJson || [];
            const sellerProds: any[] = pv.SellerProductsJson || [];

            const primaryAsset = assets.find((a) => a.IsPrimary) || assets[0];

            return {
              productVariantId: String(pv.ProductVariantID),
              variantSku: pv.VariantSKU,
              gtin: pv.GTIN,
              variantModelCode: pv.VariantModelCode,
              alreadyListed: sellerProds.length > 0,
              primaryImage: primaryAsset?.AssetURL || null,
              attributes: attrs.map((pva) => ({
                attributeId: String(pva.AttributeID),
                attributeName: pva.AttributeName,
                attributeValueId: pva.AttributeValueID ? String(pva.AttributeValueID) : null,
                attributeValue: pva.ValueName || pva.AttributeValue,
              })),
            };
          }),
        };
      })
    );

    return {
      items: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Flow 1: Create a commercial offering for an existing approved ProductVariant.
   */
  async createSellerProduct(sellerIdStr: string, input: AddSellerProductInput, userIdStr: string) {
    const sellerId = BigInt(sellerIdStr);
    const variantId = BigInt(input.productVariantId);
    const userId = BigInt(userIdStr);

    const variant = await productsRepository.findVariantForListing(variantId);

    if (!variant || variant.VariantStatus !== 'ACTIVE') {
      throw new NotFoundError('Active product variant not found');
    }

    if (!['APPROVED', 'ACTIVE'].includes(variant.ProductMasterStatus)) {
      throw new BadRequestError('Cannot list variant of a product that is not approved or active.');
    }

    // Category authorization check
    const primaryCategoryId = variant.CategoryID ? BigInt(variant.CategoryID) : null;
    if (primaryCategoryId) {
      let isApproved = await productsRepository.hasApprovedCategoryApplication(sellerId, [primaryCategoryId]);

      if (!isApproved) {
        try {
          const ancestry = await categoryInheritanceService.getCategoryAncestry(primaryCategoryId);
          const ancestorIds = ancestry.map((a) => BigInt(a.CategoryID));
          if (ancestorIds.length > 0) {
            isApproved = await productsRepository.hasApprovedCategoryApplication(sellerId, ancestorIds);
          }
        } catch {
          isApproved = false;
        }
      }

      if (!isApproved) {
        const catName = variant.CategoryName || 'this category';
        throw new ForbiddenError(`You must have an approved seller application for category "${catName}" before listing this item.`);
      }
    }

    // Uniqueness check: One listing per variant per seller
    const existingListing = await productsRepository.findListingBySellerAndVariant(sellerId, variantId);
    if (existingListing) {
      throw new ConflictError('You already have a commercial listing for this product variant.');
    }

    // Uniqueness check: SellerSKU per seller
    const duplicateSku = await productsRepository.findListingBySellerAndSku(sellerId, input.sellerSku);
    if (duplicateSku) {
      throw new ConflictError(`Seller SKU "${input.sellerSku}" is already used in your catalog.`);
    }

    const sellerProduct = await productsRepository.createSellerProduct({
      sellerId,
      variantId,
      sellerSku: input.sellerSku,
      mrp: input.mrp,
      sellingPrice: input.sellingPrice,
      purchasePrice: input.purchasePrice,
      userId,
    });

    return {
      sellerProductId: String(sellerProduct.SellerProductID),
      sellerSku: sellerProduct.SellerSKU,
      mrp: Number(sellerProduct.MRP),
      sellingPrice: Number(sellerProduct.SellingPrice),
      purchasePrice: Number(sellerProduct.PurchasePrice),
      status: sellerProduct.Status,
    };
  }

  /**
   * Flow 1b: Assign an existing SellerProduct to one or more seller-owned warehouses.
   * Creates a WarehouseProduct + zero-quantity Inventory shell for each warehouse.
   * Warehouse staff then receives physical stock via the WMS inbound flow.
   */
  async assignSellerProductToWarehouses(
    sellerIdStr: string,
    sellerProductIdStr: string,
    warehouseIds: string[],
    userIdStr: string
  ) {
    const sellerId = BigInt(sellerIdStr);
    const sellerProductId = BigInt(sellerProductIdStr);
    const userId = BigInt(userIdStr);

    // 1. Verify the SellerProduct belongs to this seller
    const sellerProduct = await productsRepository.findSellerProductBySeller(sellerProductId, sellerId);
    if (!sellerProduct) {
      throw new NotFoundError('Commercial product listing not found for this seller');
    }

    // 2. Verify seller has access to all requested warehouses
    const { warehousesRepository } = await import('../warehouses/warehouses.repository.js');
    const sellerWarehouses = await warehousesRepository.listSellerWarehouses(sellerId);
    const approvedWarehouseIds = new Set(sellerWarehouses.map((sw) => String(sw.WarehouseID)));

    const results: Array<{
      warehouseId: string;
      warehouseProductId: string;
      inventoryId: string;
      status: 'assigned' | 'already_assigned';
    }> = [];

    for (const whIdStr of warehouseIds) {
      const warehouseId = BigInt(whIdStr);

      if (!approvedWarehouseIds.has(whIdStr)) {
        throw new ForbiddenError(
          `You are not authorized to assign products to warehouse ID ${whIdStr}. Only warehouses linked to your account are permitted.`
        );
      }

      // 3. Check for duplicate assignment
      const existing = await productsRepository.findWarehouseProductBySellerProduct(sellerProductId, warehouseId);
      if (existing) {
        results.push({
          warehouseId: whIdStr,
          warehouseProductId: String(existing.WarehouseProductID),
          inventoryId: '',
          status: 'already_assigned',
        });
        continue;
      }

      // 4. Create WarehouseProduct + Inventory shell
      const warehouseProduct = await productsRepository.createWarehouseProduct({
        warehouseId,
        sellerProductId,
        warehouseSku: null,
        userId,
      });

      const inventory = await productsRepository.createInventoryShell({
        warehouseProductId: BigInt(warehouseProduct.WarehouseProductID),
        userId,
      });

      results.push({
        warehouseId: whIdStr,
        warehouseProductId: String(warehouseProduct.WarehouseProductID),
        inventoryId: String(inventory.InventoryID),
        status: 'assigned',
      });
    }

    const newCount = results.filter((r) => r.status === 'assigned').length;
    const existingCount = results.filter((r) => r.status === 'already_assigned').length;

    return {
      sellerProductId: sellerProductIdStr,
      assignments: results,
      summary: {
        totalRequested: warehouseIds.length,
        newlyAssigned: newCount,
        alreadyAssigned: existingCount,
      },
      message:
        newCount > 0
          ? `Product successfully assigned to ${newCount} warehouse${newCount > 1 ? 's' : ''}. Staff can now receive stock.`
          : 'Product is already assigned to all selected warehouses.',
    };
  }

  /**
   * Production-grade Seller Product Onboarding (Atomic 4-Level Setup):
   * 1. Validates variant exists, is active, and parent product is approved.
   * 2. Validates seller has category authorization.
   * 3. Validates no duplicate listing or SKU for this seller.
   * 4. Validates all requested warehouses belong to this seller.
   * 5. Atomically within a SQL transaction:
   *    - Creates SellerProduct (commercial contract: SKU, MRP, SellingPrice, PurchasePrice)
   *    - For each warehouse:
   *      - Creates WarehouseProduct (routing node)
   *      - Creates Inventory (physical quantity = initialQty, default 0)
   *      - Records InventoryTransaction with signed quantity:
   *        - initialQty > 0: type 'OPENING_BALANCE', quantity +initialQty, PO/Invoice info
   *        - initialQty == 0: type 'OPENING_BALANCE', quantity 0, reason 'Catalog listing initial setup'
   */
  async onboardSellerProduct(
    sellerIdStr: string,
    input: OnboardSellerProductInput,
    userIdStr: string
  ) {
    const sellerId = BigInt(sellerIdStr);
    const variantId = BigInt(input.productVariantId);
    const userId = BigInt(userIdStr);

    // 1. Variant verification
    const variant = await productsRepository.findVariantForListing(variantId);
    if (!variant || variant.VariantStatus !== 'ACTIVE') {
      throw new NotFoundError('Active product variant not found');
    }
    if (!['APPROVED', 'ACTIVE'].includes(variant.ProductMasterStatus)) {
      throw new BadRequestError('Cannot list variant of a product that is not approved or active.');
    }

    // 2. Category authorization check
    const primaryCategoryId = variant.CategoryID ? BigInt(variant.CategoryID) : null;
    if (primaryCategoryId) {
      let isApproved = await productsRepository.hasApprovedCategoryApplication(sellerId, [primaryCategoryId]);
      if (!isApproved) {
        try {
          const ancestry = await categoryInheritanceService.getCategoryAncestry(primaryCategoryId);
          const ancestorIds = ancestry.map((a) => BigInt(a.CategoryID));
          if (ancestorIds.length > 0) {
            isApproved = await productsRepository.hasApprovedCategoryApplication(sellerId, ancestorIds);
          }
        } catch {
          isApproved = false;
        }
      }
      if (!isApproved) {
        const catName = variant.CategoryName || 'this category';
        throw new ForbiddenError(`You must have an approved seller application for category "${catName}" before listing this item.`);
      }
    }

    // 3. Uniqueness checks
    const existingListing = await productsRepository.findListingBySellerAndVariant(sellerId, variantId);
    if (existingListing) {
      throw new ConflictError('You already have a commercial listing for this product variant.');
    }
    const duplicateSku = await productsRepository.findListingBySellerAndSku(sellerId, input.sellerSku);
    if (duplicateSku) {
      throw new ConflictError(`Seller SKU "${input.sellerSku}" is already used in your catalog.`);
    }

    // 4. Warehouse verification
    const { warehousesRepository } = await import('../warehouses/warehouses.repository.js');
    const sellerWarehouses = await warehousesRepository.listSellerWarehouses(sellerId);
    const warehouseMap = new Map(sellerWarehouses.map((w) => [String(w.WarehouseID), w]));

    for (const alloc of input.allocations) {
      if (!warehouseMap.has(String(alloc.warehouseId))) {
        throw new ForbiddenError(
          `Warehouse ID ${alloc.warehouseId} is not linked to your seller account or is inactive.`
        );
      }
    }

    // 5. Execute atomic transaction
    return await withTransaction(async (tx) => {
      // Step A: Create SellerProduct
      const sellerProduct = await productsRepository.createSellerProduct(
        {
          sellerId,
          variantId,
          sellerSku: input.sellerSku,
          mrp: input.mrp,
          sellingPrice: input.sellingPrice,
          purchasePrice: input.purchasePrice,
          userId,
        },
        tx
      );

      const sellerProductId = BigInt(sellerProduct.SellerProductID);
      const allocatedNodes = [];

      // Step B: Create WarehouseProduct + Inventory + InventoryTransaction for each warehouse
      for (const alloc of input.allocations) {
        const whId = BigInt(alloc.warehouseId);
        const whInfo = warehouseMap.get(String(alloc.warehouseId))!;
        const initQty = Math.max(0, alloc.initialQuantity || 0);

        const generatedWhSku = `WH-${whInfo.WarehouseCode || whId}-${input.sellerSku}`;
        const wp = await productsRepository.createWarehouseProduct(
          {
            warehouseId: whId,
            sellerProductId,
            warehouseSku: generatedWhSku,
            userId,
          },
          tx
        );

        const inv = await productsRepository.createInventoryShell(
          {
            warehouseProductId: BigInt(wp.WarehouseProductID),
            initialQty: initQty,
            userId,
          },
          tx
        );

        const txRecord = await productsRepository.createInventoryTransaction(
          {
            inventoryId: BigInt(inv.InventoryID),
            orderId: null,
            transactionType: 'OPENING_BALANCE',
            quantity: initQty, // signed: 0 or +initQty
            reason: initQty > 0
              ? 'Opening inventory declared during catalog listing'
              : 'Initial warehouse allocation shell via catalog listing',
            poNumber: alloc.poNumber || null,
            poAmount: alloc.poAmount ?? null,
            supplierInvoiceNumber: alloc.supplierInvoiceNumber || null,
            invoiceAmount: alloc.invoiceAmount ?? null,
            userId,
          },
          tx
        );

        allocatedNodes.push({
          warehouseId: String(whId),
          warehouseName: whInfo.WarehouseName,
          warehouseCode: whInfo.WarehouseCode,
          city: whInfo.City,
          state: whInfo.State,
          warehouseProductId: String(wp.WarehouseProductID),
          inventoryId: String(inv.InventoryID),
          physicalQuantity: initQty,
          transactionId: String(txRecord.InventoryTransactionID),
        });
      }

      return {
        sellerProductId: String(sellerProduct.SellerProductID),
        sellerSku: sellerProduct.SellerSKU,
        mrp: Number(sellerProduct.MRP),
        sellingPrice: Number(sellerProduct.SellingPrice),
        purchasePrice: Number(sellerProduct.PurchasePrice),
        status: sellerProduct.Status,
        warehouses: allocatedNodes,
        totalAllocatedNodes: allocatedNodes.length,
        totalInitialUnits: allocatedNodes.reduce((acc, curr) => acc + curr.physicalQuantity, 0),
      };
    });
  }

  /**
   * List eligible warehouses for a seller when adding an existing product,
   * optionally flagging which warehouses already have this variant assigned.
   */
  async listEligibleWarehousesForListing(sellerIdStr: string, variantIdStr?: string) {
    const sellerId = BigInt(sellerIdStr);
    const { warehousesRepository } = await import('../warehouses/warehouses.repository.js');
    const sellerWarehouses = await warehousesRepository.listSellerWarehouses(sellerId);

    const assignedWarehouseIds = new Set<string>();
    if (variantIdStr) {
      const variantId = BigInt(variantIdStr);
      const existingListing = await productsRepository.findListingBySellerAndVariant(sellerId, variantId);
      if (existingListing) {
        const spId = BigInt(existingListing.SellerProductID);
        for (const sw of sellerWarehouses) {
          const wp = await productsRepository.findWarehouseProductBySellerProduct(spId, BigInt(sw.WarehouseID));
          if (wp) assignedWarehouseIds.add(String(sw.WarehouseID));
        }
      }
    }

    return sellerWarehouses.map((sw) => ({
      warehouseId: String(sw.WarehouseID),
      warehouseName: sw.WarehouseName,
      warehouseCode: sw.WarehouseCode,
      warehouseType: sw.WarehouseType,
      city: sw.City,
      state: sw.State,
      addressLine1: sw.AddressLine1,
      isPrimary: Boolean(sw.IsPrimary),
      isAssigned: assignedWarehouseIds.has(String(sw.WarehouseID)),
      status: sw.Status,
    }));
  }

  /**
   * Flow 2: Propose a new ProductMaster + ProductVariants in an atomic transaction.
   */
  async proposeProduct(_sellerIdStr: string, input: ProposeProductInput, userIdStr: string) {

    const userId = BigInt(userIdStr);
    const brandId = BigInt(input.brandId);
    const categoryId = BigInt(input.leafCategoryId);

    // 1. Validate Brand
    const brand = await productsRepository.findBrandById(brandId);
    if (!brand || brand.Status !== 'ACTIVE') {
      throw new NotFoundError('Selected brand is invalid or inactive');
    }

    // 2. Validate Leaf Category
    const category = await productsRepository.findCategoryWithChildrenCount(categoryId);
    if (!category || category.Status !== 'ACTIVE') {
      throw new NotFoundError('Selected category is invalid or inactive');
    }
    if (category.ChildCount > 0) {
      throw new BadRequestError('Product can only be proposed against a leaf category (product type)');
    }

    // 3. Fetch Resolved Effective Category Attributes for validation & sorting
    const resolvedAttributes = await categoryInheritanceService.resolveEffectiveCategoryAttributes(categoryId);

    // Validate required specification attributes
    const requiredAttributeIds = resolvedAttributes.requiredSpecs.map((a) => a.attributeId);
    const suppliedSpecIds = new Set(input.specifications.map((s) => s.attributeId));
    for (const reqId of requiredAttributeIds) {
      if (!suppliedSpecIds.has(reqId)) {
        const attrName = resolvedAttributes.requiredSpecs.find((a) => a.attributeId === reqId)?.attributeName;
        throw new BadRequestError(`Required specification "${attrName}" is missing.`);
      }
    }

    // Map variant-defining display orders
    const variantDefiningOrderMap = new Map<string, number>();
    resolvedAttributes.variantDefining.forEach((a) => {
      variantDefiningOrderMap.set(a.attributeId, a.displayOrder);
    });

    // 4. Generate Permanent ParentSKU
    const parentSku = await skuSequenceService.generateParentSKU(
      brand.BrandCode || brand.BrandName,
      category.CategoryCode || category.CategoryName
    );

    // 5. Atomic Transaction for Product Persistence
    const createdResult = await withTransaction(async (tx) => {
      // Create ProductMaster
      const master = await productsRepository.insertProductMaster(
        {
          parentSku,
          brandId,
          productName: input.productName,
          description: input.description,
          highlights: input.highlights && input.highlights.length > 0 ? JSON.stringify(input.highlights) : null,
          baseModelCode: input.baseModelCode || null,
          hsnCode: input.hsnCode || null,
          gstRate: input.gstRate ?? null,
          userId,
        },
        tx
      );

      const productMasterId = BigInt(master.ProductID);

      // Link ProductCategories
      await productsRepository.insertProductCategory(productMasterId, categoryId, userId, tx);

      // Create ProductVariants
      for (const variantInput of input.variants) {
        // Collect AttributeValueCodes sorted by DisplayOrder
        const sortedAttrValues = [...variantInput.attributeValues].sort((a, b) => {
          const orderA = variantDefiningOrderMap.get(a.attributeId) ?? 999;
          const orderB = variantDefiningOrderMap.get(b.attributeId) ?? 999;
          return orderA - orderB;
        });

        const valueCodes: string[] = [];
        for (const av of sortedAttrValues) {
          const hasValId = av.attributeValueId && String(av.attributeValueId).trim();
          if (hasValId) {
            const valRecord = await productsRepository.findAttributeValueById(BigInt(av.attributeValueId!), tx);
            if (valRecord?.ValueCode) {
              valueCodes.push(valRecord.ValueCode);
            }
          } else {
            const rawVal = av.attributeValue || av.valueName || '';
            const code = String(rawVal).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
            if (code) valueCodes.push(code);
          }
        }

        const variantSku = skuSequenceService.generateVariantSKU(parentSku, valueCodes);

        const variant = await productsRepository.insertProductVariant(
          {
            productMasterId,
            variantSku,
            gtin: variantInput.gtin || null,
            variantModelCode: variantInput.variantModelCode || null,
            length: variantInput.length ?? null,
            width: variantInput.width ?? null,
            height: variantInput.height ?? null,
            weight: variantInput.weight ?? null,
            capacity: variantInput.capacity ?? null,
            userId,
          },
          tx
        );

        const variantId = BigInt(variant.ProductVariantID);

        // Insert Variant Attributes (variant-defining)
        for (const av of variantInput.attributeValues) {
          const hasValId = av.attributeValueId && String(av.attributeValueId).trim();
          const valRecord = hasValId
            ? await productsRepository.findAttributeValueById(BigInt(av.attributeValueId!), tx)
            : null;
          await productsRepository.insertProductVariantAttribute(
            {
              variantId,
              attributeId: BigInt(av.attributeId),
              attributeValueId: hasValId ? BigInt(av.attributeValueId!) : null,
              attributeValue: valRecord?.ValueName || av.attributeValue || av.valueName || '',
              userId,
            },
            tx
          );
        }

        // Insert Specifications on variant
        for (const spec of input.specifications) {
          const hasSpecValId = spec.attributeValueId && String(spec.attributeValueId).trim();
          await productsRepository.insertProductVariantAttribute(
            {
              variantId,
              attributeId: BigInt(spec.attributeId),
              attributeValueId: hasSpecValId ? BigInt(spec.attributeValueId!) : null,
              attributeValue: spec.attributeValue,
              userId,
            },
            tx
          );
        }

        // Insert UOMs
        for (const uom of variantInput.uoms) {
          const hasUomId = uom.uomId && String(uom.uomId).trim();
          if (!hasUomId) continue;
          await productsRepository.insertProductVariantUOM(
            {
              variantId,
              uomId: BigInt(uom.uomId),
              quantity: uom.quantity,
              userId,
            },
            tx
          );
        }

        // Insert Assets
        for (const asset of variantInput.assets) {
          await productsRepository.insertProductAsset(
            {
              variantId,
              assetType: asset.assetType,
              assetUrl: asset.assetUrl,
              isPrimary: asset.isPrimary,
              altText: asset.altText || null,
              displayOrder: asset.displayOrder,
              userId,
            },
            tx
          );
        }
      }

      return master;
    });

    return {
      productId: String(createdResult.ProductID),
      parentSku: createdResult.ParentSKU,
      productName: createdResult.ProductName,
      status: createdResult.Status,
      message: 'Product successfully proposed and queued for Catalog QC review.',
    };
  }

  /**
   * Flow: Admin Direct Product Creation.
   * Creates ProductMaster + ProductVariants in an atomic transaction.
   * Sets IsVerified=1 and Status to initialStatus ('ACTIVE' or 'DRAFT').
   */
  async adminCreateProduct(input: AdminCreateProductInput, userIdStr: string) {
    const userId = BigInt(userIdStr);
    const brandId = BigInt(input.brandId);
    const categoryId = BigInt(input.leafCategoryId);

    // 1. Validate Brand (active)
    const brand = await productsRepository.findBrandById(brandId);
    if (!brand || brand.Status !== 'ACTIVE') {
      throw new NotFoundError('Selected brand is invalid or inactive');
    }

    // 2. Validate Leaf Category
    const category = await productsRepository.findCategoryWithChildrenCount(categoryId);
    if (!category || category.Status !== 'ACTIVE') {
      throw new NotFoundError('Selected category is invalid or inactive');
    }
    if (category.ChildCount > 0) {
      throw new BadRequestError('Product can only be created against a leaf category');
    }

    // 3. Fetch Resolved Effective Category Attributes
    const resolvedAttributes = await categoryInheritanceService.resolveEffectiveCategoryAttributes(categoryId);

    // Validate required specification attributes
    const requiredAttributeIds = resolvedAttributes.requiredSpecs.map((a) => a.attributeId);
    const suppliedSpecIds = new Set(input.specifications.map((s) => s.attributeId));
    for (const reqId of requiredAttributeIds) {
      if (!suppliedSpecIds.has(reqId)) {
        const attrName = resolvedAttributes.requiredSpecs.find((a) => a.attributeId === reqId)?.attributeName;
        throw new BadRequestError(`Required specification "${attrName}" is missing.`);
      }
    }

    // Map variant-defining display orders
    const variantDefiningOrderMap = new Map<string, number>();
    resolvedAttributes.variantDefining.forEach((a) => {
      variantDefiningOrderMap.set(a.attributeId, a.displayOrder);
    });

    // 4. Generate ParentSKU
    const parentSku = await skuSequenceService.generateParentSKU(
      brand.BrandCode || brand.BrandName,
      category.CategoryCode || category.CategoryName
    );

    // 5. Atomic Transaction
    const createdResult = await withTransaction(async (tx) => {
      const master = await productsRepository.insertProductMasterAdmin(
        {
          parentSku,
          brandId,
          productName: input.productName,
          description: input.description,
          highlights: input.highlights && input.highlights.length > 0 ? JSON.stringify(input.highlights) : null,
          baseModelCode: input.baseModelCode || null,
          hsnCode: input.hsnCode || null,
          gstRate: input.gstRate ?? null,
          status: input.initialStatus || 'ACTIVE',
          userId,
        },
        tx
      );

      const productMasterId = BigInt(master.ProductID);
      await productsRepository.insertProductCategory(productMasterId, categoryId, userId, tx);

      for (const variantInput of input.variants) {
        const sortedAttrValues = [...variantInput.attributeValues].sort((a, b) => {
          const orderA = variantDefiningOrderMap.get(a.attributeId) ?? 999;
          const orderB = variantDefiningOrderMap.get(b.attributeId) ?? 999;
          return orderA - orderB;
        });

        const valueCodes: string[] = [];
        for (const av of sortedAttrValues) {
          const hasValId = av.attributeValueId && String(av.attributeValueId).trim();
          if (hasValId) {
            const valRecord = await productsRepository.findAttributeValueById(BigInt(av.attributeValueId!), tx);
            if (valRecord?.ValueCode) {
              valueCodes.push(valRecord.ValueCode);
            }
          } else {
            const rawVal = av.attributeValue || av.valueName || '';
            const code = String(rawVal).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
            if (code) valueCodes.push(code);
          }
        }

        const variantSku = skuSequenceService.generateVariantSKU(parentSku, valueCodes);

        const variant = await productsRepository.insertProductVariant(
          {
            productMasterId,
            variantSku,
            gtin: variantInput.gtin || null,
            variantModelCode: variantInput.variantModelCode || null,
            length: variantInput.length ?? null,
            width: variantInput.width ?? null,
            height: variantInput.height ?? null,
            weight: variantInput.weight ?? null,
            capacity: variantInput.capacity ?? null,
            status: input.initialStatus || 'ACTIVE',
            userId,
          },
          tx
        );

        const variantId = BigInt(variant.ProductVariantID);

        for (const av of variantInput.attributeValues) {
          const hasValId = av.attributeValueId && String(av.attributeValueId).trim();
          const valRecord = hasValId
            ? await productsRepository.findAttributeValueById(BigInt(av.attributeValueId!), tx)
            : null;
          await productsRepository.insertProductVariantAttribute(
            {
              variantId,
              attributeId: BigInt(av.attributeId),
              attributeValueId: hasValId ? BigInt(av.attributeValueId!) : null,
              attributeValue: valRecord?.ValueName || av.attributeValue || av.valueName || '',
              userId,
            },
            tx
          );
        }

        for (const spec of input.specifications) {
          const hasSpecValId = spec.attributeValueId && String(spec.attributeValueId).trim();
          await productsRepository.insertProductVariantAttribute(
            {
              variantId,
              attributeId: BigInt(spec.attributeId),
              attributeValueId: hasSpecValId ? BigInt(spec.attributeValueId!) : null,
              attributeValue: spec.attributeValue,
              userId,
            },
            tx
          );
        }

        for (const uom of variantInput.uoms) {
          const hasUomId = uom.uomId && String(uom.uomId).trim();
          if (!hasUomId) continue;
          await productsRepository.insertProductVariantUOM(
            {
              variantId,
              uomId: BigInt(uom.uomId),
              quantity: uom.quantity,
              userId,
            },
            tx
          );
        }

        for (const asset of variantInput.assets) {
          await productsRepository.insertProductAsset(
            {
              variantId,
              assetType: asset.assetType,
              assetUrl: asset.assetUrl,
              isPrimary: asset.isPrimary,
              altText: asset.altText || null,
              displayOrder: asset.displayOrder,
              userId,
            },
            tx
          );
        }
      }

      return master;
    });

    return {
      productId: String(createdResult.ProductID),
      parentSku: createdResult.ParentSKU,
      productName: createdResult.ProductName,
      status: createdResult.Status,
      message: `Product "${createdResult.ProductName}" created successfully with status ${createdResult.Status}.`,
    };
  }

  /**
   * Flow: Admin Add Variant to existing Product.
   * Creates a new ProductVariant for an existing ProductMaster.
   */
  async adminAddVariant(productIdStr: string, input: AdminAddVariantInput, userIdStr: string) {
    const userId = BigInt(userIdStr);
    const productId = BigInt(productIdStr);

    const master = await productsRepository.findProductMasterById(productId);
    if (!master) {
      throw new NotFoundError('Product not found');
    }

    const categoryId = master.CategoryID;
    if (!categoryId) {
      throw new BadRequestError('Product has no category assigned');
    }

    const resolvedAttributes = await categoryInheritanceService.resolveEffectiveCategoryAttributes(BigInt(categoryId));
    const variantDefiningOrderMap = new Map<string, number>();
    resolvedAttributes.variantDefining.forEach((a) => {
      variantDefiningOrderMap.set(a.attributeId, a.displayOrder);
    });

    const parentSku = master.ParentSKU;

    const createdVariant = await withTransaction(async (tx) => {
      const sortedAttrValues = [...input.attributeValues].sort((a, b) => {
        const orderA = variantDefiningOrderMap.get(a.attributeId) ?? 999;
        const orderB = variantDefiningOrderMap.get(b.attributeId) ?? 999;
        return orderA - orderB;
      });

      const valueCodes: string[] = [];
      for (const av of sortedAttrValues) {
        const hasValId = av.attributeValueId && String(av.attributeValueId).trim();
        if (hasValId) {
          const valRecord = await productsRepository.findAttributeValueById(BigInt(av.attributeValueId!), tx);
          if (valRecord?.ValueCode) {
            valueCodes.push(valRecord.ValueCode);
          }
        } else {
          const rawVal = av.attributeValue || av.valueName || '';
          const code = String(rawVal).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
          if (code) valueCodes.push(code);
        }
      }

      const variantSku = skuSequenceService.generateVariantSKU(parentSku, valueCodes);

      const variant = await productsRepository.insertProductVariant(
        {
          productMasterId: productId,
          variantSku,
          gtin: input.gtin || null,
          variantModelCode: input.variantModelCode || null,
          length: input.length ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
          weight: input.weight ?? null,
          capacity: input.capacity ?? null,
          status: input.initialStatus || 'ACTIVE',
          userId,
        },
        tx
      );

      const variantId = BigInt(variant.ProductVariantID);

      for (const av of input.attributeValues) {
        const hasValId = av.attributeValueId && String(av.attributeValueId).trim();
        const valRecord = hasValId
          ? await productsRepository.findAttributeValueById(BigInt(av.attributeValueId!), tx)
          : null;
        await productsRepository.insertProductVariantAttribute(
          {
            variantId,
            attributeId: BigInt(av.attributeId),
            attributeValueId: hasValId ? BigInt(av.attributeValueId!) : null,
            attributeValue: valRecord?.ValueName || av.attributeValue || av.valueName || '',
            userId,
          },
          tx
        );
      }

      for (const uom of input.uoms) {
        const hasUomId = uom.uomId && String(uom.uomId).trim();
        if (!hasUomId) continue;
        await productsRepository.insertProductVariantUOM(
          {
            variantId,
            uomId: BigInt(uom.uomId),
            quantity: uom.quantity,
            userId,
          },
          tx
        );
      }

      for (const asset of input.assets) {
        await productsRepository.insertProductAsset(
          {
            variantId,
            assetType: asset.assetType,
            assetUrl: asset.assetUrl,
            isPrimary: asset.isPrimary,
            altText: asset.altText || null,
            displayOrder: asset.displayOrder,
            userId,
          },
          tx
        );
      }

      return variant;
    });

    return {
      variantId: String(createdVariant.ProductVariantID),
      variantSku: createdVariant.VariantSKU,
      status: createdVariant.Status,
      message: `Variant "${createdVariant.VariantSKU}" added successfully.`,
    };
  }

  /**
   * Retrieves seller's product proposals with QC status.
   */
  async getSellerProposals(userIdStr: string) {
    const userId = BigInt(userIdStr);
    const proposals = await productsRepository.findSellerProposals(userId);

    return proposals.map((pm) => {
      const variants: any[] = pm.VariantsJson ? JSON.parse(pm.VariantsJson) : [];
      const primaryVariantAssets: any[] = variants[0]?.AssetsJson || [];

      return {
        productId: String(pm.ProductID),
        parentSku: pm.ParentSKU,
        productName: pm.ProductName,
        description: pm.Description,
        highlights: parseHighlights(pm.Highlights),
        brandName: pm.BrandName || 'N/A',
        categoryName: pm.CategoryName || 'N/A',
        status: pm.Status,
        isVerified: pm.IsVerified,
        createdAt: pm.CreatedAt,
        variantsCount: variants.length,
        primaryImage: primaryVariantAssets[0]?.AssetURL || null,
        variants: variants.map((v) => ({
          variantId: String(v.ProductVariantID),
          variantSku: v.VariantSKU,
          attributes: (v.AttributesJson || []).map((pva: any) => ({
            attributeName: pva.AttributeName,
            attributeValue: pva.ValueName || pva.AttributeValue,
          })),
        })),
      };
    });
  }

  /**
   * Flow 3: Admin Catalog QC Review Queue.
   */
  async getAdminQCQueue(params: { status?: string; q?: string; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;

    const { total, items } = await productsRepository.findAdminQCQueue({
      status: params.status,
      q: params.q,
      page,
      limit,
    });

    const formatted = items.map((pm) => {
      const variants: any[] = pm.VariantsJson ? JSON.parse(pm.VariantsJson) : [];

      return {
        productId: String(pm.ProductID),
        parentSku: pm.ParentSKU,
        productName: pm.ProductName,
        description: pm.Description,
        highlights: parseHighlights(pm.Highlights),
        baseModelCode: pm.BaseModelCode,
        hsnCode: pm.HSNCode,
        gstRate: pm.GSTRate ? Number(pm.GSTRate) : null,
        brand: pm.BrandID
          ? {
              brandId: String(pm.BrandID),
              brandName: pm.BrandName,
              brandCode: pm.BrandCode,
            }
          : null,
        category: pm.CategoryID
          ? {
              categoryId: String(pm.CategoryID),
              categoryName: pm.CategoryName,
              categoryCode: pm.CategoryCode,
            }
          : null,
        status: pm.Status,
        isVerified: pm.IsVerified,
        createdAt: pm.CreatedAt,
        submittedBy: pm.CreatorUserID
          ? {
              userId: String(pm.CreatorUserID),
              name: `${pm.CreatorFirstName || ''} ${pm.CreatorLastName || ''}`.trim(),
              email: pm.CreatorEmail,
            }
          : null,
        assets: variants.flatMap((pv) =>
          (pv.AssetsJson || []).map((a: any) => ({
            assetId: String(a.ProductAssetID),
            url: a.AssetURL,
            isPrimary: a.IsPrimary,
            altText: a.AltText,
          }))
        ),
        variants: variants.map((pv) => ({
          productVariantId: String(pv.ProductVariantID),
          variantSku: pv.VariantSKU,
          gtin: pv.GTIN,
          variantModelCode: pv.VariantModelCode,
          dimensions: {
            length: pv.Length ? Number(pv.Length) : null,
            width: pv.Width ? Number(pv.Width) : null,
            height: pv.Height ? Number(pv.Height) : null,
            weight: pv.Weight ? Number(pv.Weight) : null,
            capacity: pv.Capacity ? Number(pv.Capacity) : null,
          },
          assets: (pv.AssetsJson || []).map((a: any) => ({
            assetId: String(a.ProductAssetID),
            url: a.AssetURL,
            isPrimary: a.IsPrimary,
            altText: a.AltText,
          })),
          attributes: (pv.AttributesJson || []).map((pva: any) => ({
            attributeId: String(pva.AttributeID),
            attributeName: pva.AttributeName,
            attributeValue: pva.ValueName || pva.AttributeValue,
          })),
          uoms: (pv.UOMsJson || []).map((u: any) => ({
            uomCode: u.UOMCode,
            uomName: u.UOMName,
            quantity: Number(u.Quantity),
          })),
        })),
      };
    });

    return {
      items: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin QC Decision: APPROVE, REWORK_REQUIRED, or REJECT.
   */
  async reviewProduct(productIdStr: string, adminUserIdStr: string, input: AdminQCReviewInput) {
    const productId = BigInt(productIdStr);
    const adminUserId = BigInt(adminUserIdStr);

    const product = await productsRepository.findProductMasterById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (product.Status !== 'PENDING_QC') {
      throw new BadRequestError(`Cannot review product in "${product.Status}" status. Must be PENDING_QC.`);
    }

    let targetMasterStatus: string;
    let targetVariantStatus: string;
    let isVerified = false;

    if (input.action === 'APPROVE') {
      targetMasterStatus = 'APPROVED';
      targetVariantStatus = 'ACTIVE';
      isVerified = true;
    } else if (input.action === 'REWORK_REQUIRED') {
      targetMasterStatus = 'REWORK_REQUIRED';
      targetVariantStatus = 'REWORK_REQUIRED';
    } else {
      targetMasterStatus = 'REJECTED';
      targetVariantStatus = 'REJECTED';
    }

    await withTransaction(async (tx) => {
      await productsRepository.updateProductQCStatus(
        productId,
        adminUserId,
        targetMasterStatus,
        targetVariantStatus,
        isVerified,
        tx
      );
    });

    return {
      productId: String(product.ProductID),
      parentSku: product.ParentSKU,
      status: targetMasterStatus,
      isVerified,
      message: `Product ${product.ParentSKU} marked as ${targetMasterStatus}.`,
    };
  }

  /**
   * Retrieves seller's commercial listings (SellerProducts).
   */
  async getSellerProducts(sellerIdStr: string) {
    const sellerId = BigInt(sellerIdStr);
    const listings = await productsRepository.findSellerListings(sellerId);

    return listings.map((sp) => {
      const assets: any[] = sp.AssetsJson ? JSON.parse(sp.AssetsJson) : [];
      const attrs: any[] = sp.AttributesJson ? JSON.parse(sp.AttributesJson) : [];
      const warehouses: any[] = sp.WarehousesJson ? JSON.parse(sp.WarehousesJson) : [];

      const mappedWarehouses = warehouses.map((w: any) => ({
        warehouseProductId: String(w.WarehouseProductID),
        warehouseSku: w.WarehouseSKU,
        warehouseProductStatus: w.WarehouseProductStatus,
        warehouseId: String(w.WarehouseID),
        warehouseName: w.WarehouseName,
        warehouseCode: w.WarehouseCode,
        warehouseType: w.WarehouseType,
        city: w.City,
        state: w.State,
        isPrimary: Boolean(w.IsPrimary),
        inventoryId: w.InventoryID ? String(w.InventoryID) : null,
        physicalQuantity: Number(w.PhysicalQuantity || 0),
        reservedQuantity: Number(w.ReservedQuantity || 0),
        damagedQuantity: Number(w.DamagedQuantity || 0),
        safetyStockQuantity: Number(w.SafetyStockQuantity || 0),
        availableQuantity: Math.max(0, Number(w.AvailableQuantity || 0)),
      }));

      const totalPhysicalStock = mappedWarehouses.reduce((acc, curr) => acc + curr.physicalQuantity, 0);
      const totalReservedStock = mappedWarehouses.reduce((acc, curr) => acc + curr.reservedQuantity, 0);
      const totalAvailableStock = mappedWarehouses.reduce((acc, curr) => acc + curr.availableQuantity, 0);
      const totalDamagedStock = mappedWarehouses.reduce((acc, curr) => acc + curr.damagedQuantity, 0);

      return {
        sellerProductId: String(sp.SellerProductID),
        sellerSku: sp.SellerSKU,
        mrp: Number(sp.MRP),
        sellingPrice: Number(sp.SellingPrice),
        purchasePrice: Number(sp.PurchasePrice),
        status: sp.Status,
        createdAt: sp.CreatedAt,
        product: {
          productId: String(sp.ProductID),
          parentSku: sp.ParentSKU,
          productName: sp.ProductName,
          brandName: sp.BrandName || 'N/A',
          categoryName: sp.CategoryName || 'N/A',
          variantSku: sp.VariantSKU,
          gtin: sp.GTIN,
          primaryImage: assets[0]?.AssetURL || null,
          attributes: attrs.map((a: any) => ({
            attributeName: a.AttributeName,
            attributeValue: a.ValueName || a.AttributeValue,
          })),
        },
        warehouses: mappedWarehouses,
        stockSummary: {
          totalPhysicalStock,
          totalReservedStock,
          totalAvailableStock,
          totalDamagedStock,
          warehousesCount: mappedWarehouses.length,
          stockStatus: totalAvailableStock > 15 ? 'IN_STOCK' : totalAvailableStock > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK',
        },
      };
    });
  }

  /**
   * Retrieves chronological inventory movements/transactions for a seller's product.
   */
  async getProductTransactions(sellerIdStr: string, sellerProductIdStr: string) {
    const sellerId = BigInt(sellerIdStr);
    const sellerProductId = BigInt(sellerProductIdStr);
    const rows = await productsRepository.findProductInventoryTransactions(sellerProductId, sellerId);
    return rows.map((r) => ({
      transactionId: String(r.InventoryTransactionID),
      inventoryId: String(r.InventoryID),
      transactionType: r.TransactionType,
      quantity: Number(r.Quantity), // signed quantity (+ or - or 0)
      reason: r.Reason,
      poNumber: r.PONumber,
      poAmount: r.POAmount ? Number(r.POAmount) : null,
      grnNumber: r.GRNNumber,
      grnAmount: r.GRNAmount ? Number(r.GRNAmount) : null,
      supplierInvoiceNumber: r.SupplierInvoiceNumber,
      invoiceAmount: r.InvoiceAmount ? Number(r.InvoiceAmount) : null,
      createdAt: r.CreatedAt,
      warehouse: {
        warehouseId: String(r.WarehouseID),
        warehouseName: r.WarehouseName,
        warehouseCode: r.WarehouseCode,
      },
    }));
  }

  /**
   * Update seller product pricing (SellingPrice, MRP) and/or Status.
   */
  async updateSellerProductPricing(
    sellerIdStr: string,
    sellerProductIdStr: string,
    input: { sellingPrice?: number; mrp?: number; status?: string },
    userIdStr: string
  ) {
    const sellerId = BigInt(sellerIdStr);
    const sellerProductId = BigInt(sellerProductIdStr);
    const userId = BigInt(userIdStr);

    const existing = await productsRepository.findSellerProductBySeller(sellerProductId, sellerId);
    if (!existing) {
      throw new NotFoundError('Product listing not found for this seller');
    }

    if (input.sellingPrice !== undefined && input.mrp !== undefined) {
      if (input.sellingPrice > input.mrp) {
        throw new BadRequestError('Selling price cannot exceed Maximum Retail Price (MRP)');
      }
    }

    const updated = await productsRepository.updateSellerProductPricing(sellerProductId, sellerId, {
      sellingPrice: input.sellingPrice,
      mrp: input.mrp,
      status: input.status,
      userId,
    });

    return {
      sellerProductId: String(updated.SellerProductID),
      sellerSku: updated.SellerSKU,
      mrp: Number(updated.MRP),
      sellingPrice: Number(updated.SellingPrice),
      purchasePrice: Number(updated.PurchasePrice),
      status: updated.Status,
    };
  }

  /**
   * Applies for authorization to sell in a specific category.
   */
  async applyForCategory(sellerIdStr: string, categoryIdStr: string, userIdStr?: string, remarks?: string) {
    const sellerId = BigInt(sellerIdStr);
    const categoryId = BigInt(categoryIdStr);

    const category = await productsRepository.findCategoryWithChildrenCount(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if an application already exists for this seller and category
    const existing = await productsRepository.findSellerApplication(sellerId, categoryId);

    if (existing) {
      if (existing.Status === 'APPROVED') {
        return {
          applicationId: String(existing.SellerApplicationID),
          status: 'APPROVED',
          message: `Category "${category.CategoryName}" is already approved for your account.`,
        };
      }
      if (existing.Status === 'SUBMITTED' || existing.Status === 'PENDING') {
        return {
          applicationId: String(existing.SellerApplicationID),
          status: 'SUBMITTED',
          message: `Application for "${category.CategoryName}" is already submitted and under review.`,
        };
      }

      // If DRAFT or REJECTED, update to SUBMITTED
      const updated = await productsRepository.updateSellerApplicationToSubmitted(BigInt(existing.SellerApplicationID));

      // Synchronize category document requirements into SellerApplicationDocuments
      const effectiveDocsUpdated = await categoryInheritanceService.resolveEffectiveCategoryDocuments(categoryId);
      for (const d of effectiveDocsUpdated) {
        await productsRepository.upsertSellerApplicationDocument(
          BigInt(updated.SellerApplicationID),
          d.documentTypeId,
          d.isMandatory
        ).catch(() => {});
      }

      if (userIdStr) {
        await productsRepository.createSellerStatusHistory({
          sellerId,
          applicationId: BigInt(updated.SellerApplicationID),
          status: 'SUBMITTED',
          comments: remarks || `Category authorization requested for ${category.CategoryName}`,
          changedBy: BigInt(userIdStr),
        }).catch(() => {});
      }

      return {
        applicationId: String(updated.SellerApplicationID),
        status: 'SUBMITTED',
        message: `Application for "${category.CategoryName}" submitted successfully. Marketplace QC team will review your request.`,
      };
    }

    // Create fresh application for this category
    const created = await productsRepository.createSellerApplication(sellerId, categoryId);

    // Synchronize category document requirements into SellerApplicationDocuments
    const effectiveDocsCreated = await categoryInheritanceService.resolveEffectiveCategoryDocuments(categoryId);
    for (const d of effectiveDocsCreated) {
      await productsRepository.upsertSellerApplicationDocument(
        BigInt(created.SellerApplicationID),
        d.documentTypeId,
        d.isMandatory
      ).catch(() => {});
    }

    if (userIdStr) {
      await productsRepository.createSellerStatusHistory({
        sellerId,
        applicationId: BigInt(created.SellerApplicationID),
        status: 'SUBMITTED',
        comments: remarks || `Category authorization requested for ${category.CategoryName}`,
        changedBy: BigInt(userIdStr),
      }).catch(() => {});
    }

    return {
      applicationId: String(created.SellerApplicationID),
      status: 'SUBMITTED',
      message: `Category authorization for "${category.CategoryName}" submitted successfully. Marketplace QC team will review your request.`,
    };
  }
}

export const productsService = new ProductsService();
