export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  permissions: string[];
  sellers: Array<{
    sellerId: string;
    sellerCode: string;
    sellerName: string;
    status: string;
  }>;
  warehouses: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    status: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
