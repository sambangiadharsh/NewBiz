import { Category, Product } from '../types';

export const CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    icon: 'Laptop',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&auto=format&fit=crop&q=80',
    itemCount: 142,
    subCategories: [
      {
        title: 'Audio & Sound',
        items: ['Wireless Headphones', 'Noise-Cancelling Earbuds', 'Spatial Audio Speakers', 'Studio Microphones'],
      },
      {
        title: 'Personal Computing',
        items: ['Ultra-slim Laptops', 'Mechanical Keyboards', 'Ergonomic Mice', '4K OLED Monitors'],
      },
      {
        title: 'Smart Tech & Wearables',
        items: ['Fitness Smartwatches', 'Smart Rings', 'Wireless Charging Docks', 'Smart Desk Lamps'],
      },
    ],
  },
  {
    id: 'cat-2',
    name: 'Fashion & Apparel',
    slug: 'fashion',
    icon: 'Shirt',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&auto=format&fit=crop&q=80',
    itemCount: 280,
    subCategories: [
      {
        title: "Men's Essentials",
        items: ['Organic Cotton Tees', 'Relaxed Linen Shirts', 'Minimalist Outerwear', 'Tailored Trousers'],
      },
      {
        title: "Women's Collection",
        items: ['Cashmere Knitwear', 'Structured Blazers', 'Day-to-Night Dresses', 'Everyday Denim'],
      },
      {
        title: 'Accessories & Footwear',
        items: ['Full-Grain Leather Wallets', 'Minimalist Sneakers', 'Polarized Sunglasses', 'Canvas Weekenders'],
      },
    ],
  },
  {
    id: 'cat-3',
    name: 'Home & Living',
    slug: 'home-living',
    icon: 'Home',
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
    itemCount: 95,
    subCategories: [
      {
        title: 'Modern Furniture',
        items: ['Scandinavian Lounge Chairs', 'Solid Oak Coffee Tables', 'Modular Bookshelves', 'Ergonomic Desk Chairs'],
      },
      {
        title: 'Lighting & Ambience',
        items: ['Dimmable Ambient Lamps', 'Pendant Light Fixtures', 'Aroma Diffusers', 'Sculptural Candles'],
      },
      {
        title: 'Kitchen & Tableware',
        items: ['Handcrafted Ceramic Sets', 'Cast Iron Cookware', 'Double-Walled Tumblers', 'Pour-over Coffee Sets'],
      },
    ],
  },
  {
    id: 'cat-4',
    name: 'Beauty & Wellness',
    slug: 'beauty',
    icon: 'Sparkles',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80',
    itemCount: 118,
    subCategories: [
      {
        title: 'Clean Skincare',
        items: ['Botanical Cleansers', 'Hydrating Hyaluronic Serums', 'SPF 50 Daily Shield', 'Overnight Recovery Creams'],
      },
      {
        title: 'Hair & Body',
        items: ['Nourishing Hair Oils', 'Exfoliating Sea Salt Scrubs', 'Aromatherapeutic Body Washes', 'Solid Balms'],
      },
      {
        title: 'Self-Care & Rituals',
        items: ['Rose Quartz Facial Rollers', 'Deep Sleep Pillow Sprays', 'Herbal Infusion Blends', 'Sound Bath Bells'],
      },
    ],
  },
  {
    id: 'cat-5',
    name: 'Sports & Outdoors',
    slug: 'sports',
    icon: 'Activity',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
    itemCount: 84,
    subCategories: [
      {
        title: 'Activewear',
        items: ['Seamless Compression Tights', 'Moisture-Wicking Tops', 'Lightweight Running Shells', 'Yoga Bras'],
      },
      {
        title: 'Equipment & Fitness',
        items: ['Adjustable Smart Dumbbells', 'Non-Slip Eco Yoga Mats', 'Resistance Bands Set', 'High-Speed Jump Ropes'],
      },
      {
        title: 'Outdoor & Travel',
        items: ['Insulated Hydro Flasks', 'Ultralight Daypacks', 'Compact Trail Lanterns', 'Quick-Dry Microfiber Towels'],
      },
    ],
  },
];

export const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Hesa  Wireless Over-Ear Headphones',
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
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
    ],
    isBestSeller: true,
    isTrending: true,
    stock: 24,
    colors: [
      { name: 'Matte Space Grey', hex: '#374151' },
      { name: 'Pure Chalk White', hex: '#F3F4F6' },
      { name: 'Deep Midnight Navy', hex: '#1E293B' },
    ],
    tags: ['Best Seller', 'ANC', 'Wireless'],
    description:
      'Engineered with custom 40mm titanium drivers and hybrid acoustic chambers, delivering studio-grade high-fidelity sound with seamless multi-device pairing and 40-hour playtime.',
    features: [
      'Next-gen Active Noise Cancellation with ambient transparency mode',
      'Ultra-soft memory foam earcups with breathable protein leather',
      'Custom 40mm dynamic drivers with ultra-low distortion',
      'USB-C rapid charge (15 mins gives 6 hours playback)',
    ],
  },
  {
    id: 'prod-2',
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
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80',
    ],
    isNew: true,
    stock: 15,
    colors: [
      { name: 'Chalk White & Grey', hex: '#E5E7EB' },
      { name: 'Stealth Obsidian', hex: '#111827' },
    ],
    tags: ['Hot New', 'Hot-Swappable', 'Tri-Mode'],
    description:
      'A sleek 75% mechanical typing instrument built from anodized aerospace aluminum, sound-damped with PORON foam for creamy acoustics and tactile satisfaction.',
    features: [
      'Hot-swappable PCB supporting 3-pin and 5-pin MX switches',
      'Dye-sublimated thick PBT keycaps with crisp legends',
      'Tri-mode connectivity: Bluetooth 5.2, 2.4Ghz, and braided Type-C',
      '4000mAh battery offering up to 200 hours without backlight',
    ],
  },
  {
    id: 'prod-3',
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
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
    ],
    isTrending: true,
    stock: 38,
    colors: [
      { name: 'Sandstone Beige', hex: '#D6C7B2' },
      { name: 'Charcoal Slate', hex: '#334155' },
      { name: 'Terracotta Warmth', hex: '#C27357' },
    ],
    tags: ['Artisan', 'Coffee', 'Eco-friendly'],
    description:
      'Individually hand-thrown ceramic dripper and carafe set. Designed for the discerning coffee enthusiast to achieve balanced extraction and effortless elegance.',
    features: [
      'Heat-retaining matte stoneware preserves optimum brew temperature',
      'Reusable 304 food-grade stainless steel micro-mesh filter',
      'Ergonomic balance handle and drip-free precision spout',
      '750ml capacity (serves 1-4 cups)',
    ],
  },
  {
    id: 'prod-4',
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
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&auto=format&fit=crop&q=80',
    ],
    isBestSeller: true,
    stock: 45,
    colors: [
      { name: 'Natural Oatmeal', hex: '#E7DFD5' },
      { name: 'Faded Olive', hex: '#556B2F' },
      { name: 'Washed Indigo', hex: '#3B4D61' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    tags: ['Sustainable', 'Linen', 'Essentials'],
    description:
      'Crafted from certified organic flax linen and garment-washed for a remarkably soft hand feel. Ideal as an effortless layer over a t-shirt or styled buttoned up.',
    features: [
      '220 GSM heavyweight French flax linen',
      'Corozo nut buttons sourced sustainably',
      'Twin chest utility pockets with reinforced bartack stitching',
      'Breathable, thermo-regulating comfort for all seasons',
    ],
  },
  {
    id: 'prod-5',
    name: 'Lumina Smart Ambient Table Sphere',
    subtitle: 'Circadian Light Sync & Touch Control',
    category: 'Home & Living',
    subCategory: 'Lighting & Ambience',
    price: 92.0,
    originalPrice: 120.0,
    rating: 4.8,
    reviewsCount: 89,
    thumbnail: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80',
    ],
    isNew: true,
    stock: 19,
    colors: [
      { name: 'Frosted Opal', hex: '#F8FAFC' },
      { name: 'Smoked Quartz', hex: '#4B5563' },
    ],
    tags: ['Smart Light', 'Wireless', 'Ambient'],
    description:
      'A sculptural glass globe light that naturally aligns your evening relaxation with warm 2200K amber glow and energizing daylight simulation in the morning.',
    features: [
      'Stepless tap dimming from 1% to 100% brightness',
      'Built-in rechargeable battery with 18h cordless battery runtime',
      'Compatible with Apple HomeKit, Google Home, and Matter',
      'Hand-blown frosted borosilicate glass globe',
    ],
  },
  {
    id: 'prod-6',
    name: 'Forma Sculptural Leather Crossbody Bag',
    subtitle: 'Full-Grain Tuscan Calfskin with Gold Hardware',
    category: 'Fashion & Apparel',
    subCategory: 'Accessories & Footwear',
    price: 185.0,
    originalPrice: 240.0,
    rating: 4.9,
    reviewsCount: 312,
    thumbnail: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80',
    ],
    isTrending: true,
    stock: 12,
    colors: [
      { name: 'Caramel Cognac', hex: '#9A5B32' },
      { name: 'Classic Noir', hex: '#18181B' },
      { name: 'Warm Cream', hex: '#F5F5DC' },
    ],
    tags: ['Luxury', 'Handcrafted', 'Italian Leather'],
    description:
      'Timeless architectural silhouette handcrafted by multi-generational artisans in Florence. Features a magnetic clasp, adjustable crossbody strap, and suede interior lining.',
    features: [
      'Vegetable-tanned full grain calf leather develops rich patina',
      'Solid brushed brass hardware with anti-tarnish coating',
      'Internal zippered partition and card slots',
      'Protective metal base feet',
    ],
  },
  {
    id: 'prod-7',
    name: 'Botanica Active Peptide Radiance Serum',
    subtitle: 'Niacinamide 10% + Zinc + Copper Tripeptides',
    category: 'Beauty & Wellness',
    subCategory: 'Clean Skincare',
    price: 54.0,
    originalPrice: 72.0,
    rating: 4.9,
    reviewsCount: 520,
    thumbnail: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608248597359-1e35a1a1f0cb?w=800&auto=format&fit=crop&q=80',
    ],
    isBestSeller: true,
    stock: 58,
    tags: ['Clean Beauty', 'Vegan', 'Award Winner'],
    description:
      'A dermatologist-backed revitalizing elixir that refines skin texture, minimizes visible pore appearance, and boosts cellular collagen production for radiant clarity.',
    features: [
      'Ultra-concentrated copper tripeptide matrix',
      'Triple molecular weight hyaluronic acid for deep hydration',
      'Fragrance-free, paraben-free, silicone-free formula',
      'Sustainably packaged in UV-protective amber dropper bottle',
    ],
  },
  {
    id: 'prod-8',
    name: 'Apex Precision Smart Fitness Tracker Band',
    subtitle: 'Heart Rate, HRV, Sleep Staging & GPS',
    category: 'Electronics',
    subCategory: 'Smart Tech & Wearables',
    price: 129.0,
    originalPrice: 169.0,
    rating: 4.7,
    reviewsCount: 164,
    thumbnail: 'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=800&auto=format&fit=crop&q=80',
    ],
    isNew: true,
    stock: 32,
    colors: [
      { name: 'Graphite Grey', hex: '#374151' },
      { name: 'Sage Green', hex: '#65A30D' },
      { name: 'Midnight Navy', hex: '#1E293B' },
    ],
    tags: ['Waterproof', 'Health', '7-Day Battery'],
    description:
      'Featherweight wristband delivering clinical-grade sleep quality analysis, daily readiness scores, continuous HRV monitoring, and 50m water resistance.',
    features: [
      'Bright always-on AMOLED touchscreen display',
      'Continuous blood oxygen (SpO2) and stress monitoring',
      '7+ days battery life on a single magnetic charge',
      'Water resistant to 50 meters (5 ATM swim-proof)',
    ],
  },
];

export const PROMO_SLIDES = [
  {
    id: 1,
    badge: 'Limited Edition • Season 2026',
    title: 'The Art of Modern Living',
    subtitle: 'Thoughtfully engineered audio, furniture, and minimalist essentials crafted for clarity and calm.',
    ctaText: 'Explore Collection',
    categorySlug: 'electronics',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80',
    accentColor: 'from-indigo-900/90 to-slate-900/80',
  },
  {
    id: 2,
    badge: 'Sustainable Luxury',
    title: 'Warm Earth & Natural Fibers',
    subtitle: 'French linen, organic cotton, and vegetable-tanned leathers tailored for effortless everyday distinction.',
    ctaText: 'Shop New Arrivals',
    categorySlug: 'fashion',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
    accentColor: 'from-amber-950/85 to-stone-900/80',
  },
  {
    id: 3,
    badge: 'Smart Spaces',
    title: 'Sculptural Lighting & Living',
    subtitle: 'Elevate your private sanctuary with circadian illumination and handcrafted stoneware pottery.',
    ctaText: 'Discover Home Goods',
    categorySlug: 'home-living',
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
    accentColor: 'from-slate-950/90 to-zinc-900/80',
  },
];

export const TRUST_PROMISES = [
  {
    icon: 'Truck',
    title: 'Complimentary Shipping',
    desc: 'On all domestic orders over $50 with carbon-neutral transit',
  },
  {
    icon: 'ShieldCheck',
    title: '30-Day Risk-Free Trial',
    desc: 'Love your piece or return it with prepaid pickup labels',
  },
  {
    icon: 'Clock',
    title: '24/7 Customer Support',
    desc: 'Live expert product specialists available via chat & phone',
  },
  {
    icon: 'Lock',
    title: 'Bank-Grade Security',
    desc: '256-bit encrypted checkout with Apple Pay, cards, & PayPal',
  },
];

export const ANNOUNCEMENT_MESSAGES = [
  '⚡ Flash Sale: Enjoy 20% off all studio audio gear with code FLASH20',
  '📦 Free express courier delivery on orders above $50 — Today only!',
  '🌿 Carbon Neutral Delivery on every order across the globe',
  '✨ New Spring / Summer 2026 collection is now officially live',
];
