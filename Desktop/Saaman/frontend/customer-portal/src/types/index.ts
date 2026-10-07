export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  categorySlug?: string;
  subCategory?: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  images: string[];
  thumbnail: string;
  isNew?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
  stock: number;
  colors?: { name: string; hex: string }[];
  sizes?: string[];
  tags: string[];
  description: string;
  features: string[];
  highlights?: string[];
  parentSku?: string;
  brand?: {
    brandId: string;
    brandName: string;
    brandCode?: string;
    imageUrl?: string | null;
  } | null;
  specifications?: Array<{ key: string; value: string }>;
  variants?: Array<{
    variantId: string;
    variantSku: string;
    price: number;
    mrp: number;
    attributes: Array<{ attributeId: string; name: string; value: string }>;
    assets?: string[];
  }>;
  returnPolicy?: {
    policyId: number;
    policyCode: string;
    policyName: string;
    isReturnable: boolean;
    isReplaceable: boolean;
    returnWindowDays: number;
    replacementWindowDays: number;
    requiresTechnicianCheck: boolean;
    conditionsSummary?: string | null;
    termsAndConditions?: string | null;
  } | null;
  warrantyPolicy?: {
    warrantyPolicyId: number;
    policyCode: string;
    policyName: string;
    warrantyType: string;
    durationMonths: number;
    serviceType: string;
    coveredSummary?: string | null;
    notCoveredSummary?: string | null;
    termsAndConditions?: string | null;
  } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image: string;
  itemCount: number;
  subCategories: {
    title: string;
    items: string[];
  }[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  cartItemId?: string;
  sellerProductId?: string;
}

export interface WishlistItem {
  product: Product;
  addedAt: string;
}
