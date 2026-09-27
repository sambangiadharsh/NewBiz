export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: string;
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
}

export interface WishlistItem {
  product: Product;
  addedAt: string;
}
