import { sql } from '../../database/db.js';
import { BadRequestError } from '../../utils/errors.js';

export interface RouteItemInput {
  sellerProductId: bigint;
  quantity: number;
  productName?: string;
}

export interface AllocatedItem {
  sellerProductId: bigint;
  warehouseProductId: bigint;
  quantity: number;
}

export interface WarehouseAllocation {
  warehouseId: bigint;
  warehouseName: string;
  warehouseState: string;
  items: AllocatedItem[];
}

interface WarehouseStockRow {
  WarehouseProductID: bigint;
  WarehouseID: bigint;
  WarehouseName: string;
  WarehouseState: string;
  WarehouseCity: string;
  IsPrimary: number;
  AvailableStock: number;
}

function normalizeState(state?: string | null): string {
  if (!state) return '';
  return state.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class WarehouseRouterService {
  /**
   * Routes order items to warehouses using Option B:
   * 1. Same-state warehouse with full stock
   * 2. Any warehouse with full stock (avoids splitting boxes)
   * 3. Split across warehouses if needed
   */
  async routeOrderItems(
    sellerId: bigint,
    customerState: string | null | undefined,
    items: RouteItemInput[],
    runner: { request: () => any }
  ): Promise<WarehouseAllocation[]> {
    const allocationsMap = new Map<string, WarehouseAllocation>();
    const normCustomerState = normalizeState(customerState);

    // Keep track of reserved stock per warehouseProductId during this routing run
    // in case multiple order items share the same seller product / warehouse product
    const runtimeUsedStock = new Map<string, number>();

    for (const item of items) {
      let remainingQty = item.quantity;
      if (remainingQty <= 0) continue;

      // Query candidate warehouses for this seller product
      const res = await runner
        .request()
        .input('spId', sql.BigInt, item.sellerProductId)
        .input('sellerId', sql.BigInt, sellerId)
        .query(`
          SELECT 
            wp.WarehouseProductID,
            wp.WarehouseID,
            w.WarehouseName,
            w.State AS WarehouseState,
            w.City AS WarehouseCity,
            ISNULL(sw.IsPrimary, 0) AS IsPrimary,
            (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) AS AvailableStock
          FROM dbo.WarehouseProducts wp WITH (UPDLOCK)
          JOIN dbo.Warehouses w ON wp.WarehouseID = w.WarehouseID
          JOIN dbo.Inventory inv WITH (UPDLOCK) ON wp.WarehouseProductID = inv.WarehouseProductID
          LEFT JOIN dbo.SellerWarehouses sw ON (wp.WarehouseID = sw.WarehouseID AND sw.SellerID = @sellerId)
          WHERE wp.SellerProductID = @spId
            AND wp.Status = 'ACTIVE'
            AND w.Status = 'ACTIVE'
            AND (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) > 0
          ORDER BY 
            (ISNULL(inv.PhysicalQuantity, 0) - ISNULL(inv.ReservedQuantity, 0) - ISNULL(inv.DamagedQuantity, 0)) DESC
        `);

      const candidates: WarehouseStockRow[] = res.recordset.map((r: any) => {
        const wpKey = String(r.WarehouseProductID);
        const alreadyUsed = runtimeUsedStock.get(wpKey) || 0;
        return {
          ...r,
          AvailableStock: Math.max(0, Number(r.AvailableStock) - alreadyUsed),
        };
      }).filter((c: any) => c.AvailableStock > 0);

      if (candidates.length === 0) {
        throw new BadRequestError(
          `Stock unavailable for item "${item.productName || 'Product'}". Please review your cart.`
        );
      }

      // Check Tier 1: Same State with Full Stock
      const sameStateFullStock = candidates
        .filter((c) => normCustomerState && normalizeState(c.WarehouseState) === normCustomerState && c.AvailableStock >= remainingQty)
        .sort((a, b) => b.AvailableStock - a.AvailableStock || b.IsPrimary - a.IsPrimary);

      if (sameStateFullStock.length > 0) {
        const chosen = sameStateFullStock[0];
        this.recordAllocation(allocationsMap, runtimeUsedStock, chosen, item.sellerProductId, remainingQty);
        remainingQty = 0;
        continue;
      }

      // Check Tier 2: Different State with Full Stock (keeps single package)
      const anyStateFullStock = candidates
        .filter((c) => c.AvailableStock >= remainingQty)
        .sort((a, b) => b.AvailableStock - a.AvailableStock || b.IsPrimary - a.IsPrimary);

      if (anyStateFullStock.length > 0) {
        const chosen = anyStateFullStock[0];
        this.recordAllocation(allocationsMap, runtimeUsedStock, chosen, item.sellerProductId, remainingQty);
        remainingQty = 0;
        continue;
      }

      // Tier 3: Split stock across warehouses
      // Sort: Same state first (by stock desc), then other states (by stock desc)
      const sortedCandidates = [...candidates].sort((a, b) => {
        const aSameState = normCustomerState && normalizeState(a.WarehouseState) === normCustomerState ? 1 : 0;
        const bSameState = normCustomerState && normalizeState(b.WarehouseState) === normCustomerState ? 1 : 0;
        if (aSameState !== bSameState) return bSameState - aSameState;
        return b.AvailableStock - a.AvailableStock;
      });

      for (const wh of sortedCandidates) {
        if (remainingQty <= 0) break;
        const take = Math.min(remainingQty, wh.AvailableStock);
        if (take > 0) {
          this.recordAllocation(allocationsMap, runtimeUsedStock, wh, item.sellerProductId, take);
          wh.AvailableStock -= take;
          remainingQty -= take;
        }
      }

      if (remainingQty > 0) {
        throw new BadRequestError(
          `Insufficient stock across warehouses for item "${item.productName || 'Product'}".`
        );
      }
    }

    return Array.from(allocationsMap.values());
  }

  private recordAllocation(
    allocationsMap: Map<string, WarehouseAllocation>,
    runtimeUsedStock: Map<string, number>,
    wh: WarehouseStockRow,
    sellerProductId: bigint,
    quantity: number
  ) {
    const whKey = String(wh.WarehouseID);
    const wpKey = String(wh.WarehouseProductID);

    runtimeUsedStock.set(wpKey, (runtimeUsedStock.get(wpKey) || 0) + quantity);

    if (!allocationsMap.has(whKey)) {
      allocationsMap.set(whKey, {
        warehouseId: wh.WarehouseID,
        warehouseName: wh.WarehouseName,
        warehouseState: wh.WarehouseState,
        items: [],
      });
    }

    const alloc = allocationsMap.get(whKey)!;
    const existingItem = alloc.items.find((i) => String(i.sellerProductId) === String(sellerProductId));
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      alloc.items.push({
        sellerProductId,
        warehouseProductId: wh.WarehouseProductID,
        quantity,
      });
    }
  }
}

export const warehouseRouterService = new WarehouseRouterService();
