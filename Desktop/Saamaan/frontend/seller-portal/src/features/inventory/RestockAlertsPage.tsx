import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Warehouse,
  ArrowLeft,
  XCircle,
  Plus,
  RefreshCw,
  Boxes,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '../../components/common/Table';
import { StatsCard } from '../../components/common/StatsCard.js';

interface RestockAlertItem {
  WarehouseProductID: string;
  SellerProductID: string;
  WarehouseID: string;
  WarehouseName: string;
  WarehouseCode: string;
  WarehouseCity: string;
  SellerSKU: string;
  SellingPrice: number;
  ProductID: string;
  ProductName: string;
  ProductTitle: string;
  PhysicalQuantity: number;
  ReservedQuantity: number;
  DamagedQuantity: number;
  SafetyStockQuantity: number;
  AvailableQuantity: number;
  AlertSeverity: 'CRITICAL' | 'WARNING';
  AlertMessage: string;
}

export const RestockAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<RestockAlertItem[]>([]);

  // Quick Add Stock Modal
  const [addStockModalOpen, setAddStockModalOpen] = useState(false);
  const [targetAlert, setTargetAlert] = useState<RestockAlertItem | null>(null);
  const [inboundQty, setInboundQty] = useState<number>(20);
  const [submittingStock, setSubmittingStock] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/seller/inventory/alerts');
      if (res.data?.data) {
        setAlerts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch restock alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleOpenAddStock = (alertItem: RestockAlertItem) => {
    setTargetAlert(alertItem);
    setInboundQty(Math.max(20, (alertItem.SafetyStockQuantity || 15) * 2));
    setAddStockModalOpen(true);
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAlert) return;

    setSubmittingStock(true);
    try {
      await apiClient.post('/seller/inventory/inbound', {
        warehouseProductId: targetAlert.WarehouseProductID,
        quantity: inboundQty,
        reason: 'Restock Alert Replenishment',
      });

      setAddStockModalOpen(false);
      fetchAlerts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add stock');
    } finally {
      setSubmittingStock(false);
    }
  };

  const criticalCount = alerts.filter((a) => a.AlertSeverity === 'CRITICAL').length;
  const warningCount = alerts.filter((a) => a.AlertSeverity === 'WARNING').length;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Quick Action Links to other pages */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-bold text-stone-600 hover:text-stone-900 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Stock Overview
        </button>

        <button
          onClick={fetchAlerts}
          className="p-2 bg-white border border-[#E8E1D7] hover:bg-[#F3EFEA] text-stone-700 rounded-xl transition-all shadow-2xs cursor-pointer"
          title="Refresh Alerts"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Overview Cards with Shimmer Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatsCard
          label="Critical Out of Stock"
          value={`${criticalCount} Item${criticalCount === 1 ? '' : 's'}`}
          icon={XCircle}
          iconColor="text-rose-700 bg-rose-50 border-rose-200/60"
          loading={loading}
        />
        <StatsCard
          label="Low Stock Warnings"
          value={`${warningCount} Item${warningCount === 1 ? '' : 's'}`}
          icon={AlertTriangle}
          iconColor="text-amber-700 bg-amber-50 border-amber-200/60"
          loading={loading}
        />
      </div>

      {/* Alerts Table Container */}
      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Severity</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Seller SKU</TableHead>
              <TableHead>Warehouse Hub</TableHead>
              <TableHead>Location</TableHead>
              <TableHead align="center">Available Units</TableHead>
              <TableHead align="center">Warning Limit</TableHead>
              <TableHead>Alert Message</TableHead>
              <TableHead align="right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={9} rows={5} />
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <Boxes className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-stone-800">All Stock Levels Healthy!</h3>
                  <p className="text-[11px] text-stone-400 mt-1">
                    None of your products are currently below their low stock thresholds.
                  </p>
                </td>
              </tr>
            ) : (
              alerts.map((item) => {
                const isCritical = item.AlertSeverity === 'CRITICAL';

                return (
                  <TableRow
                    key={item.WarehouseProductID}
                    className={isCritical ? 'bg-rose-50/15' : 'bg-amber-50/10'}
                  >
                    {/* Severity Pill */}
                    <TableCell>
                      {isCritical ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          CRITICAL
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          WARNING
                        </span>
                      )}
                    </TableCell>

                    {/* Product Name */}
                    <TableCell>
                      <div className="font-bold text-stone-900 max-w-[220px] truncate leading-tight">
                        {item.ProductTitle || item.ProductName}
                      </div>
                    </TableCell>

                    {/* Dedicated Seller SKU Column */}
                    <TableCell>
                      <span className="font-mono text-[11px] text-stone-700 bg-[#FAF7F3] border border-[#ECE5DC] px-2 py-0.5 rounded-md font-bold tracking-tight inline-block">
                        {item.SellerSKU}
                      </span>
                    </TableCell>

                    {/* Warehouse */}
                    <TableCell>
                      <div className="font-semibold text-stone-800 flex items-center gap-1.5 text-xs">
                        <Warehouse className="w-3.5 h-3.5 text-[#7E2532] shrink-0" />
                        <span className="truncate max-w-[130px]">{item.WarehouseName}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {item.WarehouseCode}
                      </span>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <span className="text-stone-600 text-xs">{item.WarehouseCity}</span>
                    </TableCell>

                    {/* Available Units */}
                    <TableCell align="center">
                      <span
                        className={`font-mono font-black text-xs px-2.5 py-1 rounded-xl shadow-xs border ${
                          isCritical
                            ? 'bg-rose-100 text-rose-700 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {item.AvailableQuantity}
                      </span>
                    </TableCell>

                    {/* Warning Limit */}
                    <TableCell align="center">
                      <span className="font-mono text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                        ≤ {item.SafetyStockQuantity}
                      </span>
                    </TableCell>

                    {/* Alert Message */}
                    <TableCell>
                      <span className="text-stone-600 text-xs max-w-xs block leading-relaxed">
                        {item.AlertMessage}
                      </span>
                    </TableCell>

                    {/* Action */}
                    <TableCell align="right">
                      <button
                        onClick={() => handleOpenAddStock(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Stock
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* QUICK ADD STOCK MODAL */}
      {addStockModalOpen && targetAlert && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#E8E1D7]">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900">Add Stock to Warehouse</h3>
              </div>
              <button
                onClick={() => setAddStockModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="mt-4 space-y-4">
              <div className="p-3 bg-[#FBF9F6] rounded-2xl border border-[#E8E1D7]">
                <div className="text-xs font-bold text-stone-900 truncate">
                  {targetAlert.ProductTitle || targetAlert.ProductName}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Destination: <strong>{targetAlert.WarehouseName} ({targetAlert.WarehouseCode})</strong>
                </div>
                <div className="text-[11px] text-amber-700 font-bold mt-1">
                  Current Available: {targetAlert.AvailableQuantity} / Warning Limit: {targetAlert.SafetyStockQuantity} units
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Stock Units to Add *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={inboundQty}
                  onChange={(e) => setInboundQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddStockModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-2xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStock}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-2xl shadow-md disabled:opacity-50"
                >
                  {submittingStock ? 'Adding Stock...' : 'Confirm Stock Addition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
