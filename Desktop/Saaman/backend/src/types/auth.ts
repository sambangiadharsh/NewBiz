export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface SellerAssociation {
  sellerId: string;
  sellerCode: string;
  sellerName: string;
  status: string;
}

export interface WarehouseAssociation {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  status: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  permissions: string[];
  sellers: SellerAssociation[];
  warehouses: WarehouseAssociation[];
  passwordLastChangedAt?: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
