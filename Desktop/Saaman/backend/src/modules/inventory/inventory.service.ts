import { inventoryRepository, InventoryGridFilters, InboundStockData } from './inventory.repository.js';

export class InventoryService {
  async getSummary(sellerId: bigint | number) {
    const summary = await inventoryRepository.getInventorySummary(sellerId);
    return {
      totalListedProducts: Number(summary?.TotalListedProducts || 0),
      totalStockedShelves: Number(summary?.TotalStockedShelves || 0),
      activeWarehousesCount: Number(summary?.ActiveWarehousesCount || 0),
      totalPhysicalUnits: Number(summary?.TotalPhysicalUnits || 0),
      totalReservedUnits: Number(summary?.TotalReservedUnits || 0),
      totalDamagedUnits: Number(summary?.TotalDamagedUnits || 0),
      totalAvailableUnits: Number(summary?.TotalAvailableUnits || 0),
      outOfStockCount: Number(summary?.OutOfStockCount || 0),
      lowStockCount: Number(summary?.LowStockCount || 0),
      healthyStockCount: Number(summary?.HealthyStockCount || 0),
    };
  }

  async getGrid(sellerId: bigint | number, filters: InventoryGridFilters) {
    const result = await inventoryRepository.getInventoryGrid(sellerId, filters);
    const enrichedItems = result.items.map((item) => {
      const physical = Number(item.PhysicalQuantity || 0);
      const reserved = Number(item.ReservedQuantity || 0);
      const damaged = Number(item.DamagedQuantity || 0);
      const safety = Number(item.SafetyStockQuantity || 15);
      const available = physical - reserved - damaged;

      const sp = Number(item.SellingPrice || 0);
      const pp = Number(item.PurchasePrice || 0);
      const mrp = Number(item.MRP || 0);

      const grossMarginPct = sp > 0 ? Number((((sp - pp) / sp) * 100).toFixed(1)) : 0;
      const discountPct = mrp > 0 ? Number((((mrp - sp) / mrp) * 100).toFixed(1)) : 0;

      return {
        ...item,
        PhysicalQuantity: physical,
        ReservedQuantity: reserved,
        DamagedQuantity: damaged,
        SafetyStockQuantity: safety,
        AvailableQuantity: Math.max(0, available),
        CalculatedMarginPct: grossMarginPct,
        CalculatedDiscountPct: discountPct,
      };
    });

    return {
      ...result,
      items: enrichedItems,
    };
  }

  async createInboundNotice(
    sellerId: bigint | number,
    data: InboundStockData,
    userId?: bigint | number
  ) {
    if (!data.warehouseProductId && (!data.sellerProductId || !data.warehouseId)) {
      throw new Error('Please select both a product and destination warehouse');
    }
    if (!data.quantity || data.quantity <= 0) {
      throw new Error('Inbound quantity must be a positive integer greater than 0');
    }

    return await inventoryRepository.createInboundStockNotice(sellerId, data, userId);
  }

  async getLedger(
    sellerId: bigint | number,
    options: {
      warehouseId?: bigint | number;
      productId?: bigint | number;
      transactionType?: string;
      page?: number;
      limit?: number;
    }
  ) {
    return await inventoryRepository.getStockLedger(sellerId, options);
  }

  async getAlerts(sellerId: bigint | number) {
    return await inventoryRepository.getRestockAlerts(sellerId);
  }

  async updateSafetyStock(
    sellerId: bigint | number,
    inventoryId: bigint | number,
    safetyStockQuantity: number,
    userId?: bigint | number
  ) {
    if (safetyStockQuantity < 0) {
      throw new Error('Safety stock quantity cannot be negative');
    }
    return await inventoryRepository.updateSafetyStock(
      sellerId,
      inventoryId,
      safetyStockQuantity,
      userId
    );
  }
}

export const inventoryService = new InventoryService();
