import { Category } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api/v1';

export interface RawCategory {
  categoryId: number;
  parentCategoryId: number | null;
  categoryName: string;
  categoryCode?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  imageUrl?: string | null;
  status: string;
  isLeaf: boolean;
}

// Curated high-resolution graphics and theme icons for root departments
const ROOT_CATEGORY_META: Record<string, { image: string; icon: string }> = {
  HOME: {
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80',
    icon: 'Home',
  },
  KITCHEN: {
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
    icon: 'Coffee',
  },
  TRAVEL: {
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    icon: 'Compass',
  },
};

const DEFAULT_CATEGORY_META = {
  image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
  icon: 'Layers',
};

/**
 * Builds a 3-tier Category hierarchy tree from the flat database categories
 * - Level 1: Root Categories (parentCategoryId === null)
 * - Level 2: Subcategories (parentCategoryId === root.categoryId)
 * - Level 3: Leaf Categories (parentCategoryId === sub.categoryId)
 */
export function buildCategoryHierarchy(rawList: RawCategory[]): Category[] {
  if (!rawList || rawList.length === 0) return [];

  // Group items by parentCategoryId
  const childrenByParent = new Map<number, RawCategory[]>();
  const roots: RawCategory[] = [];

  for (const item of rawList) {
    if (item.parentCategoryId === null || item.parentCategoryId === undefined) {
      roots.push(item);
    } else {
      const existing = childrenByParent.get(item.parentCategoryId) || [];
      existing.push(item);
      childrenByParent.set(item.parentCategoryId, existing);
    }
  }

  // Sort roots alphabetically or preserve order
  roots.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  return roots.map((root) => {
    const meta = ROOT_CATEGORY_META[root.categoryName.toUpperCase()] || DEFAULT_CATEGORY_META;
    const subCats = childrenByParent.get(root.categoryId) || [];

    // Sort subcategories alphabetically
    subCats.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    let totalLeafCount = 0;

    const formattedSubCategories = subCats.map((sub) => {
      const leaves = childrenByParent.get(sub.categoryId) || [];
      leaves.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
      totalLeafCount += Math.max(leaves.length, 1);

      return {
        id: String(sub.categoryId),
        title: sub.categoryName,
        code: sub.categoryCode || undefined,
        items: leaves.length > 0 ? leaves.map((l) => l.categoryName) : [sub.categoryName],
      };
    });

    return {
      id: String(root.categoryId),
      name: root.categoryName,
      slug: root.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon: meta.icon,
      image: root.imageUrl || meta.image,
      itemCount: totalLeafCount * 5 + 15, // Approximate item count or display count
      subCategories: formattedSubCategories,
    };
  });
}

export const categoriesApi = {
  /**
   * Fetches active categories from backend and transforms into a 3-tier hierarchy
   */
  async getCategoryTree(): Promise<Category[]> {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (!res.ok) return [];
      const json = await res.json();
      const rawList = (json.data || []) as RawCategory[];
      return buildCategoryHierarchy(rawList);
    } catch (err) {
      console.warn('Failed to fetch categories from backend, using fallback:', err);
      return [];
    }
  },

  /**
   * Fetches raw categories list
   */
  async getRawCategories(): Promise<RawCategory[]> {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as RawCategory[];
    } catch (err) {
      console.warn('Failed to fetch raw categories:', err);
      return [];
    }
  },
};
