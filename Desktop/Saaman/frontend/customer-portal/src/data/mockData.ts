import { Product } from '../types';

/**
 * Today's Flash Deals - Maintained specifically for the limited-time daily promotion section
 */
export const TODAY_FLASH_DEALS: Product[] = [
  {
    id: 'flash-deal-1',
    name: 'Saamaan Wireless Over-Ear Headphones',
    subtitle: 'Active Noise Cancelling & 40h Battery',
    category: 'Electronics',
    subCategory: 'Audio & Sound',
    price: 249.0,
    originalPrice: 329.0,
    rating: 4.9,
    reviewsCount: 384,
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
    ],
    isBestSeller: true,
    isTrending: true,
    stock: 24,
    colors: [
      { name: 'Matte Space Grey', hex: '#374151' },
      { name: 'Pure Chalk White', hex: '#F3F4F6' },
    ],
    tags: ['Flash Deal', 'ANC', 'Wireless'],
    description:
      'Engineered with custom 40mm titanium drivers and hybrid acoustic chambers, delivering studio-grade high-fidelity sound with seamless multi-device pairing.',
    features: [
      'Next-gen Active Noise Cancellation with ambient transparency mode',
      'Ultra-soft memory foam earcups with breathable protein leather',
      'USB-C rapid charge (15 mins gives 6 hours playback)',
    ],
  },
  {
    id: 'flash-deal-2',
    name: 'Horizon Minimalist Mechanical Keyboard',
    subtitle: 'Custom Pre-lubed Switches & PBT Keycaps',
    category: 'Electronics',
    subCategory: 'Personal Computing',
    price: 139.0,
    originalPrice: 179.0,
    rating: 4.8,
    reviewsCount: 196,
    thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
    ],
    isNew: true,
    stock: 15,
    colors: [
      { name: 'Chalk White & Grey', hex: '#E5E7EB' },
      { name: 'Stealth Obsidian', hex: '#111827' },
    ],
    tags: ['Flash Deal', 'Hot-Swappable', 'Tri-Mode'],
    description:
      'A sleek 75% mechanical typing instrument built from anodized aerospace aluminum, sound-damped with PORON foam.',
    features: [
      'Hot-swappable PCB supporting 3-pin and 5-pin MX switches',
      'Dye-sublimated thick PBT keycaps with crisp legends',
      'Tri-mode connectivity: Bluetooth 5.2, 2.4Ghz, and Type-C',
    ],
  },
  {
    id: 'flash-deal-3',
    name: 'Vessel Ceramic Modern Pour-Over Carafe',
    subtitle: 'Hand-glazed Stoneware with Double-Mesh Filter',
    category: 'Home & Living',
    subCategory: 'Kitchen & Tableware',
    price: 68.0,
    originalPrice: 85.0,
    rating: 4.9,
    reviewsCount: 142,
    thumbnail: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    ],
    isTrending: true,
    stock: 38,
    colors: [
      { name: 'Sandstone Beige', hex: '#D6C7B2' },
      { name: 'Charcoal Slate', hex: '#334155' },
    ],
    tags: ['Flash Deal', 'Artisan', 'Coffee'],
    description:
      'Individually hand-thrown ceramic dripper and carafe set designed for balanced extraction and effortless elegance.',
    features: [
      'Heat-retaining matte stoneware preserves optimum brew temperature',
      'Reusable 304 food-grade stainless steel micro-mesh filter',
    ],
  },
  {
    id: 'flash-deal-4',
    name: 'Nordic Relaxed Heavyweight Linen Overshirt',
    subtitle: '100% French Normandy Washed Linen',
    category: 'Fashion & Apparel',
    subCategory: "Men's Essentials",
    price: 115.0,
    originalPrice: 150.0,
    rating: 4.7,
    reviewsCount: 220,
    thumbnail: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
    ],
    isBestSeller: true,
    stock: 45,
    colors: [
      { name: 'Natural Oatmeal', hex: '#E7DFD5' },
      { name: 'Faded Olive', hex: '#556B2F' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    tags: ['Flash Deal', 'Sustainable', 'Linen'],
    description:
      'Crafted from certified organic flax linen and garment-washed for a remarkably soft hand feel.',
    features: [
      '220 GSM heavyweight French flax linen',
      'Corozo nut buttons sourced sustainably',
    ],
  },
];
