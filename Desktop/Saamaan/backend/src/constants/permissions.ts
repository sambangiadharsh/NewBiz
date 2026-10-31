/**
 * Central Permission Registry
 * Defines all canonical permission codes used across route protection and UI guards.
 */
export const PERMISSIONS = {
  // Users & Roles
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  // Sellers & Applications
  SELLERS_READ: 'sellers.read',
  SELLERS_MANAGE: 'sellers.manage',
  APPLICATIONS_REVIEW: 'applications.review',

  // Warehouses
  WAREHOUSES_READ: 'warehouses.read',
  WAREHOUSES_MANAGE: 'warehouses.manage',

  // Catalog (Products, Brands, Categories)
  CATALOG_READ: 'catalog.read',
  CATALOG_MANAGE: 'catalog.manage',

  // Inventory & Stock
  INVENTORY_READ: 'inventory.read',
  INVENTORY_MANAGE: 'inventory.manage',

  // Orders & Fulfillments
  ORDERS_READ: 'orders.read',
  FULFILLMENTS_MANAGE: 'fulfillments.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
