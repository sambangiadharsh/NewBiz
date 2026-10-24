import { NotFoundError } from '../../utils/errors.js';
import { publicProductsRepository } from './publicProducts.repository.js';

// Curated high-res imagery for seed catalog items
const CATEGORY_IMAGE_PRESETS: Record<string, string[]> = {
  ORGANIZER: [
    'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&auto=format&fit=crop&q=80',
  ],
  COOKER: [
    'https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&auto=format&fit=crop&q=80',
  ],
  BACKPACK: [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=800&auto=format&fit=crop&q=80',
  ],
  DEFAULT: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80',
  ],
};

const COLOR_MAP: Record<string, string> = {
  black: '#18181b',
  blk: '#18181b',
  blue: '#2563eb',
  blu: '#2563eb',
  navy: '#1e3a8a',
  grey: '#64748b',
  gray: '#64748b',
  white: '#f8fafc',
  wht: '#f8fafc',
  red: '#dc2626',
  green: '#16a34a',
  brown: '#78350f',
  beige: '#d6c7a1',
  silver: '#94a3b8',
};

function resolveImages(name: string, categoryName: string, rawAssetUrls: string[]): string[] {
  const validUrls = rawAssetUrls.filter(
    (u) => typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/uploads/'))
  );

  if (validUrls.length > 0) {
    return validUrls;
  }

  const combined = `${name} ${categoryName}`.toUpperCase();
  if (combined.includes('DRAWER') || combined.includes('ORGANIZ') || combined.includes('STORAGE')) {
    return CATEGORY_IMAGE_PRESETS.ORGANIZER;
  }
  if (combined.includes('COOKER') || combined.includes('KITCHEN') || combined.includes('POT') || combined.includes('PAN')) {
    return CATEGORY_IMAGE_PRESETS.COOKER;
  }
  if (combined.includes('BACKPACK') || combined.includes('BAG') || combined.includes('TRAVEL')) {
    return CATEGORY_IMAGE_PRESETS.BACKPACK;
  }

  return CATEGORY_IMAGE_PRESETS.DEFAULT;
}

function parseHighlights(raw: string | null | undefined, _productName: string, categoryName: string): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fallback
    }
  }

  // Generate smart highlights based on product taxonomy
  return [
    `Engineered to meet industrial standards for ${categoryName}`,
    'Built with high-durability, premium-grade materials',
    '100% Quality Checked and Verified by Marketplace Standards',
    'Includes official manufacturer warranty and dedicated support',
  ];
}

export class PublicProductsService {
  /**
   * Retrieves active catalog products for the customer storefront.
   */
  async getStorefrontProducts(params: {
    category?: string;
    brandId?: string;
    q?: string;
    limit?: number;
  }) {
    const rawProducts = await publicProductsRepository.findStorefrontProducts(params);

    return rawProducts.map((pm, index) => {
      const categories = pm.CategoriesJson ? JSON.parse(pm.CategoriesJson) : [];
      const primaryCategory = categories[0];
      const categoryName = primaryCategory?.CategoryName || 'General';

      const variants: any[] = pm.VariantsJson ? JSON.parse(pm.VariantsJson) : [];

      // Collect all variant asset URLs
      const rawAssetUrls: string[] = [];
      variants.forEach((v) => {
        const assets = v.AssetsJson || [];
        assets.forEach((a: any) => {
          if (a.AssetURL) rawAssetUrls.push(a.AssetURL);
        });
      });

      const images = resolveImages(pm.ProductName, categoryName, rawAssetUrls);
      const thumbnail = images[0];

      // Find lowest selling price across active seller listings
      const activeSellerListings = variants.flatMap((v) => v.SellerProductsJson || []);
      let lowestPrice = 299;
      let mrp = 399;

      if (activeSellerListings.length > 0) {
        const prices = activeSellerListings.map((sp: any) => Number(sp.SellingPrice)).filter((p: number) => p > 0);
        const mrps = activeSellerListings.map((sp: any) => Number(sp.MRP)).filter((m: number) => m > 0);

        if (prices.length > 0) {
          lowestPrice = Math.min(...prices);
        }
        if (mrps.length > 0) {
          mrp = Math.max(...mrps);
        }
      }

      if (mrp <= lowestPrice) {
        mrp = Math.round(lowestPrice * 1.25);
      }

      const highlights = parseHighlights(pm.Highlights, pm.ProductName, categoryName);

      // Collect colors and sizes
      const colorsMap = new Map<string, string>();
      const sizesSet = new Set<string>();

      variants.forEach((v) => {
        const attrs = v.AttributesJson || [];
        attrs.forEach((pva: any) => {
          const attrName = (pva.AttributeName || '').toLowerCase();
          const valName = pva.ValueName || pva.AttributeValue;
          if (!valName) return;

          if (attrName.includes('color') || attrName.includes('colour')) {
            const key = valName.toLowerCase().trim();
            const hex = COLOR_MAP[key] || '#3b82f6';
            colorsMap.set(valName, hex);
          } else if (attrName.includes('size')) {
            sizesSet.add(valName);
          }
        });
      });

      const colors = Array.from(colorsMap.entries()).map(([name, hex]) => ({ name, hex }));
      const sizes = Array.from(sizesSet);

      const mappedVariants = variants.map((v) => {
        const vListings = v.SellerProductsJson || [];
        const variantStock = vListings.reduce(
          (sum: number, sp: any) => sum + (Number(sp.AvailableStock) || 0),
          0
        );
        const vListing = vListings[0];
        return {
          variantId: String(v.ProductVariantID),
          variantSku: v.VariantSKU,
          gtin: v.GTIN,
          modelCode: v.VariantModelCode,
          price: vListing ? Number(vListing.SellingPrice) : lowestPrice,
          mrp: vListing ? Number(vListing.MRP) : mrp,
          stock: variantStock,
          seller: vListing?.SellerID
            ? {
                sellerId: String(vListing.SellerID),
                sellerName: vListing.SellerName,
                businessName: vListing.BusinessName,
              }
            : null,
          attributes: (v.AttributesJson || []).map((a: any) => ({
            attributeId: String(a.AttributeID),
            name: a.AttributeName,
            value: a.ValueName || a.AttributeValue,
          })),
          assets: (v.AssetsJson || []).map((a: any) => a.AssetURL),
        };
      });

      const totalStock =
        mappedVariants.length > 0
          ? mappedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
          : 0;

      // Fixed pseudo-random rating & review count for consistent aesthetics
      const seed = Number(pm.ProductID) || index + 1;
      const rating = Number((4.6 + ((seed * 7) % 4) * 0.1).toFixed(1));
      const reviewsCount = 18 + ((seed * 19) % 180);

      return {
        id: String(pm.ProductID),
        name: pm.ProductName,
        parentSku: pm.ParentSKU,
        subtitle: pm.BrandName || categoryName,
        category: categoryName,
        categorySlug: primaryCategory?.CategoryCode?.toLowerCase() || categoryName.toLowerCase(),
        price: lowestPrice,
        originalPrice: mrp,
        rating,
        reviewsCount,
        images,
        thumbnail,
        isNew: index < 5,
        isTrending: index % 3 === 0,
        isBestSeller: index % 4 === 0,
        stock: totalStock,
        variants: mappedVariants,
        colors: colors.length > 0 ? colors : undefined,
        sizes: sizes.length > 0 ? sizes : undefined,
        tags: [categoryName, pm.BrandName || 'Featured'],
        description: pm.Description || `${pm.ProductName} - Premium quality ${categoryName} designed for durability and daily performance.`,
        features: highlights,
        highlights,
        brand: pm.BrandID
          ? {
              brandId: String(pm.BrandID),
              brandName: pm.BrandName,
              brandCode: pm.BrandCode,
              imageUrl: pm.BrandImageURL,
            }
          : null,
      };
    });
  }

  /**
   * Retrieves single product detailed information by ID.
   */
  async getStorefrontProductById(idStr: string) {
    const id = BigInt(idStr);

    const pm = await publicProductsRepository.findStorefrontProductById(id);

    if (!pm || !['ACTIVE', 'APPROVED'].includes(pm.Status)) {
      throw new NotFoundError('Product not found or currently unavailable');
    }

    const categories = pm.CategoriesJson ? JSON.parse(pm.CategoriesJson) : [];
    const primaryCategory = categories[0];
    const categoryName = primaryCategory?.CategoryName || 'General';

    // Resolve 2-tier policy (ProductMaster override ?? Category default)
    const rawReturnPolicy = pm.ReturnPolicyJson
      ? JSON.parse(pm.ReturnPolicyJson)
      : primaryCategory?.CategoryReturnPolicyJson
      ? JSON.parse(primaryCategory.CategoryReturnPolicyJson)
      : null;

    const returnPolicy = rawReturnPolicy
      ? {
          policyId: rawReturnPolicy.PolicyID,
          policyCode: rawReturnPolicy.PolicyCode,
          policyName: rawReturnPolicy.PolicyName,
          isReturnable: rawReturnPolicy.IsReturnable,
          isReplaceable: rawReturnPolicy.IsReplaceable,
          returnWindowDays: rawReturnPolicy.ReturnWindowDays,
          replacementWindowDays: rawReturnPolicy.ReplacementWindowDays,
          requiresTechnicianCheck: rawReturnPolicy.RequiresTechnicianCheck,
          conditionsSummary: rawReturnPolicy.ConditionsSummary,
          termsAndConditions: rawReturnPolicy.TermsAndConditions,
        }
      : null;

    const warrantyPolicy = null;

    const variants: any[] = pm.VariantsJson ? JSON.parse(pm.VariantsJson) : [];

    // Collect images
    const rawAssetUrls: string[] = [];
    variants.forEach((v) => {
      const assets = v.AssetsJson || [];
      assets.forEach((a: any) => {
        if (a.AssetURL) rawAssetUrls.push(a.AssetURL);
      });
    });

    const images = resolveImages(pm.ProductName, categoryName, rawAssetUrls);
    const thumbnail = images[0];

    // Collect pricing
    const activeSellerListings = variants.flatMap((v) => v.SellerProductsJson || []);
    let lowestPrice = 299;
    let mrp = 399;

    if (activeSellerListings.length > 0) {
      const prices = activeSellerListings.map((sp: any) => Number(sp.SellingPrice)).filter((p: number) => p > 0);
      const mrps = activeSellerListings.map((sp: any) => Number(sp.MRP)).filter((m: number) => m > 0);
      if (prices.length > 0) lowestPrice = Math.min(...prices);
      if (mrps.length > 0) mrp = Math.max(...mrps);
    }
    if (mrp <= lowestPrice) {
      mrp = Math.round(lowestPrice * 1.25);
    }

    const highlights = parseHighlights(pm.Highlights, pm.ProductName, categoryName);

    // Mapped variants with live warehouse stock
    const mappedVariants = variants.map((v) => {
      const vListings = v.SellerProductsJson || [];
      const variantStock = vListings.reduce(
        (sum: number, sp: any) => sum + (Number(sp.AvailableStock) || 0),
        0
      );
      const vListing = vListings[0];
      return {
        variantId: String(v.ProductVariantID),
        variantSku: v.VariantSKU,
        gtin: v.GTIN,
        modelCode: v.VariantModelCode,
        price: vListing ? Number(vListing.SellingPrice) : lowestPrice,
        mrp: vListing ? Number(vListing.MRP) : mrp,
        stock: variantStock,
        seller: vListing?.SellerID
          ? {
              sellerId: String(vListing.SellerID),
              sellerName: vListing.SellerName,
              businessName: vListing.BusinessName,
            }
          : null,
        attributes: (v.AttributesJson || []).map((a: any) => ({
          attributeId: String(a.AttributeID),
          name: a.AttributeName,
          value: a.ValueName || a.AttributeValue,
        })),
        assets: (v.AssetsJson || []).map((a: any) => a.AssetURL),
      };
    });

    const totalStock =
      mappedVariants.length > 0
        ? mappedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : 0;

    // Specifications matrix
    const specifications: Array<{ key: string; value: string }> = [];
    const seenSpecs = new Set<string>();

    if (pm.CountryOfOrigin) {
      specifications.push({ key: 'Country of Origin', value: pm.CountryOfOrigin });
      seenSpecs.add('country of origin');
    }

    variants.forEach((v) => {
      const attrs = v.AttributesJson || [];
      attrs.forEach((pva: any) => {
        const key = pva.AttributeName;
        const value = pva.ValueName || pva.AttributeValue;
        if (key && value && !seenSpecs.has(key.toLowerCase())) {
          seenSpecs.add(key.toLowerCase());
          specifications.push({ key, value });
        }
      });
    });

    // Colors and sizes
    const colorsMap = new Map<string, string>();
    const sizesSet = new Set<string>();

    variants.forEach((v) => {
      const attrs = v.AttributesJson || [];
      attrs.forEach((pva: any) => {
        const attrName = (pva.AttributeName || '').toLowerCase();
        const valName = pva.ValueName || pva.AttributeValue;
        if (!valName) return;

        if (attrName.includes('color') || attrName.includes('colour')) {
          const key = valName.toLowerCase().trim();
          const hex = COLOR_MAP[key] || '#3b82f6';
          colorsMap.set(valName, hex);
        } else if (attrName.includes('size')) {
          sizesSet.add(valName);
        }
      });
    });

    const colors = Array.from(colorsMap.entries()).map(([name, hex]) => ({ name, hex }));
    const sizes = Array.from(sizesSet);

    const seed = Number(pm.ProductID) || 1;
    const rating = Number((4.6 + ((seed * 7) % 4) * 0.1).toFixed(1));
    const reviewsCount = 18 + ((seed * 19) % 180);

    return {
      id: String(pm.ProductID),
      name: pm.ProductName,
      parentSku: pm.ParentSKU,
      subtitle: pm.BrandName || categoryName,
      category: categoryName,
      categorySlug: primaryCategory?.CategoryCode?.toLowerCase() || categoryName.toLowerCase(),
      price: lowestPrice,
      originalPrice: mrp,
      rating,
      reviewsCount,
      images,
      thumbnail,
      isNew: true,
      stock: totalStock,
      colors: colors.length > 0 ? colors : undefined,
      sizes: sizes.length > 0 ? sizes : undefined,
      tags: [categoryName, pm.BrandName || 'Featured'],
      description: pm.Description || `${pm.ProductName} - Premium quality ${categoryName} designed for durability, ergonomic comfort, and long-lasting performance.`,
      features: highlights,
      highlights,
      specifications,
      countryOfOrigin: pm.CountryOfOrigin || 'India',
      variants: mappedVariants,
      brand: pm.BrandID
        ? {
            brandId: String(pm.BrandID),
            brandName: pm.BrandName,
            brandCode: pm.BrandCode,
            imageUrl: pm.BrandImageURL,
          }
        : null,
      returnPolicy,
      warrantyPolicy,
    };
  }
}

export const publicProductsService = new PublicProductsService();
