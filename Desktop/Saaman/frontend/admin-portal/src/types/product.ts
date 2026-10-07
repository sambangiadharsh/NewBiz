export interface Brand {
  brandId: string;
  brandName: string;
  brandCode: string;
  imageUrl?: string | null;
}

export interface UOM {
  uomId: string;
  uomCode: string;
  uomName: string;
  uomType?: string;
}

export interface AttributeValue {
  attributeValueId: string;
  valueId?: string;
  valueName: string;
  valueCode: string;
}

export interface CategoryAttribute {
  attributeId: string;
  attributeName: string;
  dataType?: 'ENUM' | 'OPTIONS' | 'STRING' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
  attributeType?: 'ENUM' | 'OPTIONS' | 'STRING' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
  isVariantDefining: boolean;
  isRequired: boolean;
  displayOrder: number;
  values: AttributeValue[];
}

export interface ResolvedAttributes {
  categoryId: string;
  categoryName: string;
  categoryCode?: string;
  variantDefining: CategoryAttribute[];
  requiredSpecs: CategoryAttribute[];
  optionalSpecs: CategoryAttribute[];
}

export interface CategoryTreeNode {
  categoryId: number | string;
  categoryName: string;
  categoryCode?: string;
  parentCategoryId: number | string | null;
  displayOrder?: number;
  status: string;
  children?: CategoryTreeNode[];
  isLeaf?: boolean;
}

export interface VariantAssetEntry {
  assetUrl: string;
  isPrimary: boolean;
  displayOrder: number;
  assetType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  altText?: string;
  _previewUrl?: string;
  _filename?: string;
}

export interface VariantAttributeValue {
  attributeId: string;
  attributeValueId: string;
  valueName: string;
  attributeName?: string;
}

export interface VariantEntry {
  _id: string; // client-side uuid
  attributeValues: VariantAttributeValue[];
  gtin: string;
  variantModelCode: string; // manufacturer part no. (e.g. "AH8050-002")
  length: number | '';
  width: number | '';
  height: number | '';
  weight: number | '';
  capacity: number | '';
  uoms: { uomId: string; quantity: number }[];
  assets: VariantAssetEntry[];
  _label: string;
  _completeness: 'ready' | 'incomplete';
}

export interface SpecEntry {
  attributeId: string;
  attributeName: string;
  dataType?: 'ENUM' | 'OPTIONS' | 'STRING' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
  attributeType?: 'ENUM' | 'OPTIONS' | 'STRING' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
  attributeValueId?: string;
  attributeValue: string;
  isRequired: boolean;
  values?: AttributeValue[];
}

export interface CreateProductFormState {
  // Step 1: Basic Info & India GST / Base Model
  brandId: string;
  leafCategoryId: string;
  productName: string;
  description: string;
  highlights: string[];
  baseModelCode: string; // brand model family (e.g. "AH8050")
  hsnCode: string;       // India GST code (e.g. "6404")
  gstRate: number | '';  // GST rate % (e.g. 18.00)

  // Loaded upon leaf category selection
  resolvedAttributes: ResolvedAttributes | null;

  // Step 2: Shared Specifications
  specifications: SpecEntry[];

  // Step 3: Variants
  variants: VariantEntry[];

  // Step 4: Submission State
  initialStatus: 'ACTIVE' | 'DRAFT';
}

export interface AdminProductListItem {
  productId: string;
  parentSku: string;
  productName: string;
  description: string | null;
  highlights: string[];
  baseModelCode?: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  brand: {
    brandId: string;
    brandName: string | null;
    brandCode: string | null;
  } | null;
  category: {
    categoryId: string;
    categoryName: string | null;
    categoryCode: string | null;
  } | null;
  status: string;
  isVerified: boolean;
  createdAt: string;
  submittedBy?: {
    userId: string;
    name: string;
    email: string | null;
  } | null;
  assets?: Array<{
    assetId: string;
    url: string;
    isPrimary: boolean;
    altText?: string | null;
  }>;
  variants: Array<{
    productVariantId: string;
    variantSku: string;
    gtin: string | null;
    variantModelCode?: string | null;
    dimensions: {
      length: number | null;
      width: number | null;
      height: number | null;
      weight: number | null;
      capacity: number | null;
    };
    assets: Array<{
      assetId: string;
      url: string;
      isPrimary: boolean;
      altText?: string | null;
    }>;
    attributes: Array<{
      attributeId: string;
      attributeName: string;
      attributeValue: string;
    }>;
    uoms: Array<{
      uomCode: string;
      uomName: string;
      quantity: number;
    }>;
  }>;
}
