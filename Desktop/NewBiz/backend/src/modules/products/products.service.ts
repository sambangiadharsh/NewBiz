import { prisma } from '../../database/prisma.js';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { skuSequenceService } from './skuSequence.service.js';
import { categoryInheritanceService } from '../../services/categoryInheritance.service.js';
import {
  SearchCatalogQuery,
  ProposeProductInput,
  AddSellerProductInput,
  AdminQCReviewInput,
} from './products.validation.js';

export class ProductsService {
  /**
   * Retrieves strictly leaf-level category attributes for a category.
   * Enforces zero-inheritance mapping.
   */
  async getLeafCategoryAttributes(categoryIdStr: string) {
    const categoryId = BigInt(categoryIdStr);

    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
      include: {
        other_Categories: {
          select: { CategoryID: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (category.other_Categories.length > 0) {
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
    const skip = (page - 1) * limit;

    // Build search filters for approved and active marketplace products
    const where: any = {
      Status: { in: ['APPROVED', 'ACTIVE'] },
    };

    if (query.brandId) {
      where.BrandID = BigInt(query.brandId);
    }

    if (query.categoryId) {
      where.ProductCategories = {
        some: { CategoryID: BigInt(query.categoryId) },
      };
    }

    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { ProductName: { contains: q } },
        { ParentSKU: { contains: q } },
        { Description: { contains: q } },
        { Brands: { BrandName: { contains: q } } },
        {
          ProductVariants: {
            some: {
              OR: [
                { GTIN: { contains: q } },
                { ProductModelCode: { contains: q } },
                { VariantSKU: { contains: q } },
              ],
            },
          },
        },
      ];
    }

    const [total, products] = await Promise.all([
      prisma.productMaster.count({ where }),
      prisma.productMaster.findMany({
        where,
        skip,
        take: limit,
        include: {
          Brands: true,
          ProductCategories: {
            include: {
              Categories: true,
            },
          },
          ProductVariants: {
            where: { Status: 'ACTIVE' },
            include: {
              ProductVariantAttributes: {
                include: {
                  Attributes: true,
                  AttributeValues: true,
                },
              },
              ProductAssets: {
                where: { Status: 'ACTIVE' },
                orderBy: [{ IsPrimary: 'desc' }, { DisplayOrder: 'asc' }],
              },
              SellerProducts: {
                where: { SellerID: sellerId },
                select: {
                  SellerProductID: true,
                  Status: true,
                },
              },
            },
          },
        },
        orderBy: { CreatedAt: 'desc' },
      }),
    ]);

    // Check seller's approved and pending categories to attach authorization flags
    const sellerApplications = await prisma.sellerApplications.findMany({
      where: {
        SellerID: sellerId,
      },
      select: { CategoryID: true, Status: true },
    });
    const approvedCategoryIds = new Set(
      sellerApplications.filter((sa) => sa.Status === 'APPROVED').map((sa) => String(sa.CategoryID))
    );
    const pendingCategoryIds = new Set(
      sellerApplications.filter((sa) => sa.Status === 'SUBMITTED' || sa.Status === 'PENDING').map((sa) => String(sa.CategoryID))
    );

    const formatted = await Promise.all(
      products.map(async (pm) => {
        const primaryCategory = pm.ProductCategories[0]?.Categories;
        const categoryIdStr = primaryCategory ? String(primaryCategory.CategoryID) : '';
        let isSellerAuthorized = approvedCategoryIds.has(categoryIdStr);
        let isCategoryPendingApproval = pendingCategoryIds.has(categoryIdStr);

        if (!isSellerAuthorized && primaryCategory) {
          try {
            const ancestry = await categoryInheritanceService.getCategoryAncestry(primaryCategory.CategoryID);
            if (approvedCategoryIds.size > 0) {
              isSellerAuthorized = ancestry.some((a) => approvedCategoryIds.has(String(a.CategoryID)));
            }
            if (!isSellerAuthorized && pendingCategoryIds.size > 0) {
              isCategoryPendingApproval = ancestry.some((a) => pendingCategoryIds.has(String(a.CategoryID)));
            }
          } catch {
            isSellerAuthorized = false;
          }
        }

      return {
        productId: String(pm.ProductID),
        parentSku: pm.ParentSKU,
        productName: pm.ProductName,
        description: pm.Description,
        brand: pm.Brands
          ? {
              brandId: String(pm.Brands.BrandID),
              brandName: pm.Brands.BrandName,
              brandCode: pm.Brands.BrandCode,
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
        variants: pm.ProductVariants.map((pv) => ({
          productVariantId: String(pv.ProductVariantID),
          variantSku: pv.VariantSKU,
          gtin: pv.GTIN,
          productModelCode: pv.ProductModelCode,
          hsnCode: pv.HSNCode,
          gstRate: pv.GSTRate ? Number(pv.GSTRate) : null,
          alreadyListed: pv.SellerProducts.length > 0,
          primaryImage: pv.ProductAssets.find((a) => a.IsPrimary)?.AssetURL || pv.ProductAssets[0]?.AssetURL || null,
          attributes: pv.ProductVariantAttributes.map((pva) => ({
            attributeId: String(pva.AttributeID),
            attributeName: pva.Attributes.AttributeName,
            attributeValueId: pva.AttributeValueID ? String(pva.AttributeValueID) : null,
            attributeValue: pva.AttributeValues?.ValueName || pva.AttributeValue,
          })),
        })),
      };
    }));

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

    const variant = await prisma.productVariants.findUnique({
      where: { ProductVariantID: variantId },
      include: {
        ProductMaster: {
          include: {
            ProductCategories: {
              include: { Categories: true },
            },
          },
        },
      },
    });

    if (!variant || variant.Status !== 'ACTIVE') {
      throw new NotFoundError('Active product variant not found');
    }

    if (!['APPROVED', 'ACTIVE'].includes(variant.ProductMaster.Status)) {
      throw new BadRequestError('Cannot list variant of a product that is not approved or active.');
    }

    // Category authorization check
    const primaryCategoryId = variant.ProductMaster.ProductCategories[0]?.CategoryID;
    if (primaryCategoryId) {
      let isApproved = await prisma.sellerApplications.findFirst({
        where: {
          SellerID: sellerId,
          CategoryID: primaryCategoryId,
          Status: 'APPROVED',
        },
      });

      if (!isApproved) {
        try {
          const ancestry = await categoryInheritanceService.getCategoryAncestry(primaryCategoryId);
          const ancestorIds = ancestry.map((a) => a.CategoryID);
          isApproved = await prisma.sellerApplications.findFirst({
            where: {
              SellerID: sellerId,
              CategoryID: { in: ancestorIds },
              Status: 'APPROVED',
            },
          });
        } catch {
          isApproved = null;
        }
      }

      if (!isApproved) {
        const catName = variant.ProductMaster.ProductCategories[0]?.Categories?.CategoryName || 'this category';
        throw new ForbiddenError(`You must have an approved seller application for category "${catName}" before listing this item.`);
      }
    }

    // Uniqueness check: One listing per variant per seller
    const existingListing = await prisma.sellerProducts.findUnique({
      where: {
        SellerID_ProductVariantID: {
          SellerID: sellerId,
          ProductVariantID: variantId,
        },
      },
    });

    if (existingListing) {
      throw new ConflictError('You already have a commercial listing for this product variant.');
    }

    // Uniqueness check: SellerSKU per seller
    const duplicateSku = await prisma.sellerProducts.findUnique({
      where: {
        SellerID_SellerSKU: {
          SellerID: sellerId,
          SellerSKU: input.sellerSku,
        },
      },
    });

    if (duplicateSku) {
      throw new ConflictError(`Seller SKU "${input.sellerSku}" is already used in your catalog.`);
    }

    const sellerProduct = await prisma.sellerProducts.create({
      data: {
        SellerID: sellerId,
        ProductVariantID: variantId,
        SellerSKU: input.sellerSku,
        MRP: input.mrp,
        SellingPrice: input.sellingPrice,
        PurchasePrice: input.purchasePrice,
        Status: 'ACTIVE',
        CreatedBy: userId,
        CreatedAt: new Date(),
      },
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
   * Flow 2: Propose a new ProductMaster + ProductVariants in an atomic transaction.
   */
  async proposeProduct(_sellerIdStr: string, input: ProposeProductInput, userIdStr: string) {
    const userId = BigInt(userIdStr);
    const brandId = BigInt(input.brandId);
    const categoryId = BigInt(input.leafCategoryId);

    // 1. Validate Brand
    const brand = await prisma.brands.findUnique({
      where: { BrandID: brandId },
    });
    if (!brand || brand.Status !== 'ACTIVE') {
      throw new NotFoundError('Selected brand is invalid or inactive');
    }

    // 2. Validate Leaf Category
    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
      include: {
        other_Categories: { select: { CategoryID: true } },
      },
    });
    if (!category || category.Status !== 'ACTIVE') {
      throw new NotFoundError('Selected category is invalid or inactive');
    }
    if (category.other_Categories.length > 0) {
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
    const parentSku = await skuSequenceService.generateParentSKU(brand.BrandCode || brand.BrandName, category.CategoryCode || category.CategoryName);

    // 5. Atomic Transaction for Product Persistence
    const createdResult = await prisma.$transaction(async (tx) => {
      // Create ProductMaster
      const master = await tx.productMaster.create({
        data: {
          ParentSKU: parentSku,
          BrandID: brandId,
          ProductName: input.productName,
          Description: input.description,
          IsVerified: false,
          Status: 'PENDING_QC',
          CreatedBy: userId,
          CreatedAt: new Date(),
        },
      });

      // Link ProductCategories
      await tx.productCategories.create({
        data: {
          ProductID: master.ProductID,
          CategoryID: categoryId,
          CreatedBy: userId,
          CreatedAt: new Date(),
        },
      });

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
          const valRecord = await tx.attributeValues.findUnique({
            where: { AttributeValueID: BigInt(av.attributeValueId) },
          });
          if (valRecord) {
            valueCodes.push(valRecord.ValueCode);
          }
        }

        const variantSku = skuSequenceService.generateVariantSKU(parentSku, valueCodes);

        const variant = await tx.productVariants.create({
          data: {
            ProductMasterID: master.ProductID,
            VariantSKU: variantSku,
            GTIN: variantInput.gtin || null,
            ProductModelCode: variantInput.productModelCode || null,
            HSNCode: variantInput.hsnCode || null,
            GSTRate: variantInput.gstRate ?? null,
            Length: variantInput.length ?? null,
            Width: variantInput.width ?? null,
            Height: variantInput.height ?? null,
            Weight: variantInput.weight ?? null,
            Capacity: variantInput.capacity ?? null,
            Status: 'PENDING_QC',
            CreatedBy: userId,
            CreatedAt: new Date(),
          },
        });

        // Insert Variant Attributes (both variant-defining and specifications)
        for (const av of variantInput.attributeValues) {
          const valRecord = await tx.attributeValues.findUnique({
            where: { AttributeValueID: BigInt(av.attributeValueId) },
          });

          await tx.productVariantAttributes.create({
            data: {
              ProductVariantID: variant.ProductVariantID,
              AttributeID: BigInt(av.attributeId),
              AttributeValueID: BigInt(av.attributeValueId),
              AttributeValue: valRecord?.ValueName || '',
              CreatedBy: userId,
              CreatedAt: new Date(),
            },
          });
        }

        // Insert Specifications on variant
        for (const spec of input.specifications) {
          await tx.productVariantAttributes.create({
            data: {
              ProductVariantID: variant.ProductVariantID,
              AttributeID: BigInt(spec.attributeId),
              AttributeValueID: spec.attributeValueId ? BigInt(spec.attributeValueId) : null,
              AttributeValue: spec.attributeValue,
              CreatedBy: userId,
              CreatedAt: new Date(),
            },
          });
        }

        // Insert UOMs
        for (const uom of variantInput.uoms) {
          await tx.productVariantUOMs.create({
            data: {
              ProductVariantID: variant.ProductVariantID,
              UOMID: BigInt(uom.uomId),
              Quantity: uom.quantity,
              Status: 'ACTIVE',
              CreatedBy: userId,
              CreatedAt: new Date(),
            },
          });
        }

        // Insert Assets
        for (const asset of variantInput.assets) {
          await tx.productAssets.create({
            data: {
              ProductVariantID: variant.ProductVariantID,
              AssetType: asset.assetType,
              AssetURL: asset.assetUrl,
              IsPrimary: asset.isPrimary,
              AltText: asset.altText || null,
              DisplayOrder: asset.displayOrder,
              Status: 'ACTIVE',
              CreatedBy: userId,
              CreatedAt: new Date(),
            },
          });
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
   * Retrieves seller's product proposals with QC status.
   */
  async getSellerProposals(userIdStr: string) {
    const userId = BigInt(userIdStr);

    const proposals = await prisma.productMaster.findMany({
      where: {
        CreatedBy: userId,
      },
      include: {
        Brands: true,
        ProductCategories: {
          include: {
            Categories: true,
          },
        },
        ProductVariants: {
          include: {
            ProductAssets: {
              where: { Status: 'ACTIVE' },
              orderBy: { IsPrimary: 'desc' },
            },
            ProductVariantAttributes: {
              include: {
                Attributes: true,
                AttributeValues: true,
              },
            },
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });

    return proposals.map((pm) => ({
      productId: String(pm.ProductID),
      parentSku: pm.ParentSKU,
      productName: pm.ProductName,
      brandName: pm.Brands?.BrandName || 'N/A',
      categoryName: pm.ProductCategories[0]?.Categories?.CategoryName || 'N/A',
      status: pm.Status,
      isVerified: pm.IsVerified,
      createdAt: pm.CreatedAt,
      variantsCount: pm.ProductVariants.length,
      primaryImage: pm.ProductVariants[0]?.ProductAssets[0]?.AssetURL || null,
      variants: pm.ProductVariants.map((v) => ({
        variantId: String(v.ProductVariantID),
        variantSku: v.VariantSKU,
        attributes: v.ProductVariantAttributes.map((pva) => ({
          attributeName: pva.Attributes.AttributeName,
          attributeValue: pva.AttributeValues?.ValueName || pva.AttributeValue,
        })),
      })),
    }));
  }

  /**
   * Flow 3: Admin Catalog QC Review Queue.
   */
  async getAdminQCQueue(params: { status?: string; q?: string; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status && params.status !== 'ALL') {
      where.Status = params.status;
    } else if (!params.status) {
      where.Status = 'PENDING_QC';
    }

    if (params.q) {
      const q = params.q;
      where.OR = [
        { ProductName: { contains: q } },
        { ParentSKU: { contains: q } },
        { Brands: { BrandName: { contains: q } } },
        {
          ProductVariants: {
            some: {
              OR: [
                { VariantSKU: { contains: q } },
                { GTIN: q },
                { ProductModelCode: { contains: q } },
              ],
            },
          },
        },
        {
          ProductCategories: {
            some: {
              Categories: { CategoryName: { contains: q } },
            },
          },
        },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.productMaster.count({ where }),
      prisma.productMaster.findMany({
        where,
        skip,
        take: limit,
        include: {
          Brands: true,
          ProductCategories: {
            include: { Categories: true },
          },
          Users_ProductMaster_CreatedByToUsers: {
            select: {
              UserID: true,
              FirstName: true,
              LastName: true,
              Email: true,
            },
          },
          ProductVariants: {
            include: {
              ProductAssets: true,
              ProductVariantAttributes: {
                include: {
                  Attributes: true,
                  AttributeValues: true,
                },
              },
              ProductVariantUOMs: {
                include: { UOM: true },
              },
            },
          },
        },
        orderBy: { CreatedAt: 'desc' },
      }),
    ]);

    const formatted = items.map((pm) => ({
      productId: String(pm.ProductID),
      parentSku: pm.ParentSKU,
      productName: pm.ProductName,
      description: pm.Description,
      brand: pm.Brands
        ? {
            brandId: String(pm.Brands.BrandID),
            brandName: pm.Brands.BrandName,
            brandCode: pm.Brands.BrandCode,
          }
        : null,
      category: pm.ProductCategories[0]?.Categories
        ? {
            categoryId: String(pm.ProductCategories[0].Categories.CategoryID),
            categoryName: pm.ProductCategories[0].Categories.CategoryName,
            categoryCode: pm.ProductCategories[0].Categories.CategoryCode,
          }
        : null,
      status: pm.Status,
      isVerified: pm.IsVerified,
      createdAt: pm.CreatedAt,
      submittedBy: pm.Users_ProductMaster_CreatedByToUsers
        ? {
            userId: String(pm.Users_ProductMaster_CreatedByToUsers.UserID),
            name: `${pm.Users_ProductMaster_CreatedByToUsers.FirstName} ${pm.Users_ProductMaster_CreatedByToUsers.LastName}`,
            email: pm.Users_ProductMaster_CreatedByToUsers.Email,
          }
        : null,
      assets: pm.ProductVariants.flatMap((pv) =>
        pv.ProductAssets.map((a) => ({
          assetId: String(a.ProductAssetID),
          url: a.AssetURL,
          isPrimary: a.IsPrimary,
          altText: a.AltText,
        }))
      ),
      variants: pm.ProductVariants.map((pv) => ({
        productVariantId: String(pv.ProductVariantID),
        variantSku: pv.VariantSKU,
        gtin: pv.GTIN,
        modelCode: pv.ProductModelCode,
        hsnCode: pv.HSNCode,
        gstRate: pv.GSTRate ? Number(pv.GSTRate) : null,
        dimensions: {
          length: pv.Length ? Number(pv.Length) : null,
          width: pv.Width ? Number(pv.Width) : null,
          height: pv.Height ? Number(pv.Height) : null,
          weight: pv.Weight ? Number(pv.Weight) : null,
          capacity: pv.Capacity ? Number(pv.Capacity) : null,
        },
        assets: pv.ProductAssets.map((a) => ({
          assetId: String(a.ProductAssetID),
          url: a.AssetURL,
          isPrimary: a.IsPrimary,
          altText: a.AltText,
        })),
        attributes: pv.ProductVariantAttributes.map((pva) => ({
          attributeId: String(pva.AttributeID),
          attributeName: pva.Attributes.AttributeName,
          attributeValue: pva.AttributeValues?.ValueName || pva.AttributeValue,
        })),
        uoms: pv.ProductVariantUOMs.map((u) => ({
          uomCode: u.UOM.UOMCode,
          uomName: u.UOM.UOMName,
          quantity: Number(u.Quantity),
        })),
      })),
    }));

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

    const product = await prisma.productMaster.findUnique({
      where: { ProductID: productId },
    });

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

    await prisma.$transaction(async (tx) => {
      await tx.productMaster.update({
        where: { ProductID: productId },
        data: {
          Status: targetMasterStatus,
          IsVerified: isVerified,
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });

      await tx.productVariants.updateMany({
        where: { ProductMasterID: productId },
        data: {
          Status: targetVariantStatus,
          UpdatedAt: new Date(),
          UpdatedBy: adminUserId,
        },
      });
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

    const listings = await prisma.sellerProducts.findMany({
      where: { SellerID: sellerId },
      include: {
        ProductVariants: {
          include: {
            ProductMaster: {
              include: {
                Brands: true,
                ProductCategories: {
                  include: { Categories: true },
                },
              },
            },
            ProductAssets: {
              where: { Status: 'ACTIVE' },
              orderBy: { IsPrimary: 'desc' },
            },
            ProductVariantAttributes: {
              include: {
                Attributes: true,
                AttributeValues: true,
              },
            },
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });

    return listings.map((sp) => ({
      sellerProductId: String(sp.SellerProductID),
      sellerSku: sp.SellerSKU,
      mrp: Number(sp.MRP),
      sellingPrice: Number(sp.SellingPrice),
      purchasePrice: Number(sp.PurchasePrice),
      status: sp.Status,
      createdAt: sp.CreatedAt,
      product: {
        productId: String(sp.ProductVariants.ProductMaster.ProductID),
        parentSku: sp.ProductVariants.ProductMaster.ParentSKU,
        productName: sp.ProductVariants.ProductMaster.ProductName,
        brandName: sp.ProductVariants.ProductMaster.Brands?.BrandName || 'N/A',
        categoryName: sp.ProductVariants.ProductMaster.ProductCategories[0]?.Categories?.CategoryName || 'N/A',
        variantSku: sp.ProductVariants.VariantSKU,
        gtin: sp.ProductVariants.GTIN,
        primaryImage: sp.ProductVariants.ProductAssets[0]?.AssetURL || null,
        attributes: sp.ProductVariants.ProductVariantAttributes.map((a) => ({
          attributeName: a.Attributes.AttributeName,
          attributeValue: a.AttributeValues?.ValueName || a.AttributeValue,
        })),
      },
    }));
  }

  /**
   * Applies for authorization to sell in a specific category.
   */
  async applyForCategory(sellerIdStr: string, categoryIdStr: string, userIdStr?: string, remarks?: string) {
    const sellerId = BigInt(sellerIdStr);
    const categoryId = BigInt(categoryIdStr);

    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
    });
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if an application already exists for this seller and category
    const existing = await prisma.sellerApplications.findUnique({
      where: {
        SellerID_CategoryID: {
          SellerID: sellerId,
          CategoryID: categoryId,
        },
      },
    });

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
      const updated = await prisma.sellerApplications.update({
        where: { SellerApplicationID: existing.SellerApplicationID },
        data: {
          Status: 'SUBMITTED',
          SubmittedAt: new Date(),
          RejectionReason: null,
          UpdatedAt: new Date(),
        },
      });

      // Synchronize category document requirements into SellerApplicationDocuments
      const effectiveDocsUpdated = await categoryInheritanceService.resolveEffectiveCategoryDocuments(categoryId);
      for (const d of effectiveDocsUpdated) {
        await prisma.sellerApplicationDocuments.upsert({
          where: {
            SellerApplicationID_DocumentTypeID: {
              SellerApplicationID: updated.SellerApplicationID,
              DocumentTypeID: d.documentTypeId,
            },
          },
          create: {
            SellerApplicationID: updated.SellerApplicationID,
            DocumentTypeID: d.documentTypeId,
            IsMandatory: d.isMandatory,
            DocumentURL: '',
            VerificationStatus: 'PENDING',
            CreatedAt: new Date(),
          },
          update: {
            IsMandatory: d.isMandatory,
            VerificationStatus: 'PENDING',
            RejectionReason: null,
            UpdatedAt: new Date(),
          },
        }).catch(() => {});
      }

      if (userIdStr) {
        await prisma.sellerStatusHistory.create({
          data: {
            SellerID: sellerId,
            SellerApplicationID: updated.SellerApplicationID,
            Status: 'SUBMITTED',
            Comments: remarks || `Category authorization requested for ${category.CategoryName}`,
            ChangedBy: BigInt(userIdStr),
            ChangedAt: new Date(),
            CreatedAt: new Date(),
          },
        }).catch(() => {});
      }

      return {
        applicationId: String(updated.SellerApplicationID),
        status: 'SUBMITTED',
        message: `Application for "${category.CategoryName}" submitted successfully. Marketplace QC team will review your request.`,
      };
    }

    // Create fresh application for this category
    const created = await prisma.sellerApplications.create({
      data: {
        SellerID: sellerId,
        CategoryID: categoryId,
        Status: 'SUBMITTED',
        SubmittedAt: new Date(),
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
      },
    });

    // Synchronize category document requirements into SellerApplicationDocuments
    const effectiveDocsCreated = await categoryInheritanceService.resolveEffectiveCategoryDocuments(categoryId);
    for (const d of effectiveDocsCreated) {
      await prisma.sellerApplicationDocuments.upsert({
        where: {
          SellerApplicationID_DocumentTypeID: {
            SellerApplicationID: created.SellerApplicationID,
            DocumentTypeID: d.documentTypeId,
          },
        },
        create: {
          SellerApplicationID: created.SellerApplicationID,
          DocumentTypeID: d.documentTypeId,
          IsMandatory: d.isMandatory,
          DocumentURL: '',
          VerificationStatus: 'PENDING',
          CreatedAt: new Date(),
        },
        update: {
          IsMandatory: d.isMandatory,
          VerificationStatus: 'PENDING',
          UpdatedAt: new Date(),
        },
      }).catch(() => {});
    }

    if (userIdStr) {
      await prisma.sellerStatusHistory.create({
        data: {
          SellerID: sellerId,
          SellerApplicationID: created.SellerApplicationID,
          Status: 'SUBMITTED',
          Comments: remarks || `Category authorization requested for ${category.CategoryName}`,
          ChangedBy: BigInt(userIdStr),
          ChangedAt: new Date(),
          CreatedAt: new Date(),
        },
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
