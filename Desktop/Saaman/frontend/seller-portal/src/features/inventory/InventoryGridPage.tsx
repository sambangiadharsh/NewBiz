import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Boxes,
  Warehouse,
  Search,
  AlertTriangle,
  RefreshCw,
  Package,
  CheckCircle2,
  XCircle,
  Plus,
  History,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { NoResults } from '../../components/common/NoResults.js';
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
import { Pagination } from '../../components/common/Pagination.js';
import { usePagination } from '../../hooks/usePagination.js';

interface InventoryItem {
  WarehouseProductID: string;
  SellerProductID: string;
  WarehouseID: string;
  WarehouseName: string;
  WarehouseCode: string;
  WarehouseCity: string;
  WarehouseState: string;
  SellerSKU: string;
  SellingPrice: number;
  PurchasePrice: number;
  MRP: number;
  ProductID: string;
  ProductName: string;
  ProductTitle: string;
  BrandName?: string;
  CategoryName?: string;
  InventoryID?: string;
  PhysicalQuantity: number;
  ReservedQuantity: number;
  DamagedQuantity: number;
  SafetyStockQuantity: number;
  AvailableQuantity: number;
  StockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  CalculatedMarginPct: number;
  CalculatedDiscountPct: number;
  InventoryUpdatedAt?: string;
}

interface InventorySummary {
  totalListedProducts: number;
  totalStockedShelves: number;
  activeWarehousesCount: number;
  totalPhysicalUnits: number;
  totalReservedUnits: number;
  totalDamagedUnits: number;
  totalAvailableUnits: number;
  outOfStockCount: number;
  lowStockCount: number;
  healthyStockCount: number;
}

export const InventoryGridPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [totalItems, setTotalItems] = useState<number>(0);

  const {
    currentPage: page,
    pageSize: limit,
    setPage,
    paginationProps,
  } = usePagination({
    totalItems,
    initialPage: 1,
    initialPageSize: 15,
    pageSizeOptions: [10, 15, 25, 50],
  });

  // Quick Add Stock Modal
  const [addStockModalOpen, setAddStockModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<InventoryItem | null>(null);
  const [inboundQty, setInboundQty] = useState<number>(10);
  const [inboundReason, setInboundReason] = useState<string>('Stock replenishment');
  const [poNumber, setPoNumber] = useState<string>('');
  const [grnNumber, setGrnNumber] = useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [submittingStock, setSubmittingStock] = useState(false);

  // Low Stock Warning Threshold Modal
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [targetThresholdItem, setTargetThresholdItem] = useState<InventoryItem | null>(null);
  const [newThreshold, setNewThreshold] = useState<number>(15);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Fetch summary and eligible warehouses
  const fetchMetadata = async () => {
    try {
      const [sumRes, whRes] = await Promise.all([
        apiClient.get('/seller/inventory/summary'),
        apiClient.get('/seller/catalog/eligible-warehouses'),
      ]);
      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      }
      if (whRes.data?.data) {
        const rawWh = Array.isArray(whRes.data.data) ? whRes.data.data : [];
        setWarehouses(
          rawWh.map((w: any) => ({
            id: String(w.warehouseId || w.WarehouseID || w.id || ''),
            name: String(w.warehouseName || w.WarehouseName || w.name || 'Warehouse'),
            code: String(w.warehouseCode || w.WarehouseCode || w.code || ''),
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load inventory metadata', err);
    }
  };

  // Fetch stock grid
  const fetchGrid = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (selectedWarehouse) params.warehouseId = selectedWarehouse;
      if (selectedStatus) params.stockStatus = selectedStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/seller/inventory/grid', { params });
      if (res.data?.data) {
        const rawItems = res.data.data.items || [];
        setItems(rawItems);
        const total =
          res.data.data.total ??
          (res.data.data.totalPages ? res.data.data.totalPages * limit : rawItems.length);
        setTotalItems(total);
      }
    } catch (err) {
      console.error('Failed to fetch inventory grid', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchGrid();
  }, [selectedWarehouse, selectedStatus, page, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchGrid();
  };

  const handleOpenAddStock = (item: InventoryItem) => {
    setTargetItem(item);
    setInboundQty(10);
    setInboundReason('Stock replenishment');
    setPoNumber('');
    setGrnNumber('');
    setSupplierInvoiceNumber('');
    setAddStockModalOpen(true);
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;
    if (inboundQty <= 0) {
      alert('Please enter a valid stock quantity');
      return;
    }

    setSubmittingStock(true);
    try {
      await apiClient.post('/seller/inventory/inbound', {
        warehouseProductId: targetItem.WarehouseProductID,
        quantity: inboundQty,
        reason: inboundReason || undefined,
        poNumber: poNumber.trim() || undefined,
        grnNumber: grnNumber.trim() || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      });

      setAddStockModalOpen(false);
      fetchGrid();
      fetchMetadata();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add stock');
    } finally {
      setSubmittingStock(false);
    }
  };

  const handleOpenThreshold = (item: InventoryItem) => {
    setTargetThresholdItem(item);
    setNewThreshold(item.SafetyStockQuantity || 15);
    setThresholdModalOpen(true);
  };

  const handleThresholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetThresholdItem || !targetThresholdItem.InventoryID) return;

    setSavingThreshold(true);
    try {
      await apiClient.patch(`/seller/inventory/${targetThresholdItem.InventoryID}/safety-stock`, {
        safetyStockQuantity: newThreshold,
      });
      setThresholdModalOpen(false);
      fetchGrid();
      fetchMetadata();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update warning limit');
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Consistent Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-[#7E2532]" />
            Stock by Warehouse
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-medium">
            Monitor real-time inventory levels, units locked in orders, and stock available for sale across warehouses.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              fetchGrid();
              fetchMetadata();
            }}
            className="p-2.5 bg-white border border-[#E8E1D7] hover:bg-[#F3EFEA] text-stone-700 rounded-2xl transition-all shadow-sm"
            title="Refresh Stock Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            to="/inventory/ledger"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#E8E1D7] hover:bg-[#F3EFEA] text-stone-700 font-bold text-xs shadow-sm transition-all"
          >
            <History className="w-4 h-4 text-stone-500" />
            <span>Stock History</span>
          </Link>

          <Link
            to="/inventory/inbound"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Send Stock to Warehouse</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards matching ProductsPage style */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Available to Sell</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black mt-2 text-emerald-700">
            {summary?.totalAvailableUnits ?? '—'}
          </p>
          <span className="text-[11px] text-stone-400 font-medium">Ready for customer orders</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Locked in Orders</span>
            <Boxes className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black mt-2 text-blue-700">
            {summary?.totalReservedUnits ?? '—'}
          </p>
          <span className="text-[11px] text-stone-400 font-medium">Awaiting packaging / dispatch</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total in Warehouse</span>
            <Package className="w-4 h-4 text-stone-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black mt-2 text-stone-900">
            {summary?.totalPhysicalUnits ?? '—'}
          </p>
          <span className="text-[11px] text-stone-400 font-medium">Physical stock stored</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Low Stock Items</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black mt-2 text-amber-600">
            {summary?.lowStockCount ?? '—'}
          </p>
          <button
            onClick={() => navigate('/inventory/alerts')}
            className="text-[11px] text-amber-600 font-bold hover:underline inline-flex items-center gap-1 mt-0.5"
          >
            Review warnings <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Out of Stock</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black mt-2 text-rose-600">
            {summary?.outOfStockCount ?? '—'}
          </p>
          <span className="text-[11px] text-stone-400 font-medium">Requires replenishment</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8E1D7] shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <form onSubmit={handleSearchSubmit} className="md:col-span-6 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Product Name, SKU, Brand, or Warehouse..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-800"
          />
        </form>

        <div className="md:col-span-3">
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
          >
            <option value="">All Stock Levels</option>
            <option value="IN_STOCK">In Stock (Healthy)</option>
            <option value="LOW_STOCK">Low Stock Warning</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Stock Table Container */}
      <TableContainer
        footer={
          <Pagination
            {...paginationProps}
            itemLabel="inventory items"
            themeColor="burgundy"
          />
        }
      >
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Product</TableHead>
              <TableHead>Seller SKU</TableHead>
              <TableHead>Brand & Category</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead align="right">Selling Price</TableHead>
              <TableHead align="center">Margin</TableHead>
              <TableHead align="center">In Hub</TableHead>
              <TableHead align="center">Locked</TableHead>
              <TableHead align="center">Damaged</TableHead>
              <TableHead align="center">Available</TableHead>
              <TableHead align="center">Alert Limit</TableHead>
              <TableHead align="center">Status</TableHead>
              <TableHead align="right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={13} rows={6} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12">
                  <NoResults
                    description="No inventory records found matching your filters. Try resetting your search or assign stock to a warehouse."
                    className="py-6"
                  />
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isOutOfStock = item.AvailableQuantity <= 0;
                const isLowStock =
                  !isOutOfStock && item.AvailableQuantity <= item.SafetyStockQuantity;

                return (
                  <TableRow key={item.WarehouseProductID}>
                    {/* Product Title */}
                    <TableCell>
                      <div className="font-bold text-stone-900 max-w-[200px] truncate leading-tight">
                        {item.ProductTitle || item.ProductName}
                      </div>
                    </TableCell>

                    {/* Dedicated Seller SKU Column */}
                    <TableCell>
                      <span className="font-mono text-[11px] text-stone-700 bg-[#FAF7F3] border border-[#ECE5DC] px-2 py-0.5 rounded-md font-bold tracking-tight inline-block">
                        {item.SellerSKU}
                      </span>
                    </TableCell>

                    {/* Brand & Category */}
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {item.BrandName && (
                          <div className="font-bold text-stone-800 text-[11px]">
                            {item.BrandName}
                          </div>
                        )}
                        <span className="text-[10px] text-stone-400 block">
                          {item.CategoryName || 'General'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Warehouse */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-semibold text-stone-800 text-xs">
                        <Warehouse className="w-3.5 h-3.5 text-[#7E2532] shrink-0" />
                        <span className="truncate max-w-[130px]">{item.WarehouseName}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {item.WarehouseCode} • {item.WarehouseCity}
                      </span>
                    </TableCell>

                    {/* Selling Price */}
                    <TableCell align="right">
                      <span className="font-black text-stone-900 font-mono text-xs">
                        ₹{item.SellingPrice}
                      </span>
                    </TableCell>

                    {/* Margin */}
                    <TableCell align="center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <TrendingUp className="w-3 h-3" />
                        {item.CalculatedMarginPct}%
                      </span>
                    </TableCell>

                    {/* Total Physical */}
                    <TableCell align="center">
                      <span className="font-semibold text-stone-700 font-mono text-xs">
                        {item.PhysicalQuantity}
                      </span>
                    </TableCell>

                    {/* Locked in Orders */}
                    <TableCell align="center">
                      <span className="font-bold text-blue-600 bg-blue-50/60 px-2 py-0.5 rounded-md font-mono text-xs">
                        {item.ReservedQuantity}
                      </span>
                    </TableCell>

                    {/* Damaged */}
                    <TableCell align="center">
                      <span className="font-medium text-stone-400 font-mono text-xs">
                        {item.DamagedQuantity}
                      </span>
                    </TableCell>

                    {/* Available to Sell */}
                    <TableCell align="center">
                      <span
                        className={`inline-block font-black text-xs px-2.5 py-1 rounded-xl font-mono shadow-xs ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {item.AvailableQuantity}
                      </span>
                    </TableCell>

                    {/* Warning Limit */}
                    <TableCell align="center">
                      <button
                        onClick={() => handleOpenThreshold(item)}
                        className="group inline-flex items-center gap-1 text-[11px] text-stone-600 hover:text-[#7E2532] font-medium font-mono"
                        title="Click to change low stock warning limit"
                      >
                        <span>≤ {item.SafetyStockQuantity}</span>
                        <span className="opacity-0 group-hover:opacity-100 text-[9px] text-[#7E2532] font-sans underline">
                          edit
                        </span>
                      </button>
                    </TableCell>

                    {/* Status Tag */}
                    <TableCell align="center">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          In Stock
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenAddStock(item)}
                          className="px-3 py-1.5 rounded-xl bg-[#641D26] text-white hover:bg-[#52161E] text-[11px] font-bold transition-all inline-flex items-center gap-1 shadow-sm active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Stock
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/inventory/ledger?warehouseId=${item.WarehouseID}`)
                          }
                          className="p-1.5 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-all inline-flex items-center shadow-xs"
                          title="View Stock Movement History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* QUICK ADD STOCK MODAL */}
      {addStockModalOpen && targetItem && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E8E1D7] animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#7E2532] flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Add Stock to Warehouse</h3>
                  <span className="text-[11px] text-stone-500 font-medium">
                    {targetItem.WarehouseName} ({targetItem.WarehouseCode})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAddStockModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="mt-4 space-y-4">
              <div className="p-3 bg-[#FBF9F6] rounded-2xl border border-[#E8E1D7]">
                <div className="text-xs font-bold text-stone-900 truncate">
                  {targetItem.ProductTitle || targetItem.ProductName}
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1">
                  <span>SKU: {targetItem.SellerSKU}</span>
                  <span>Currently Available: <strong className="text-emerald-700">{targetItem.AvailableQuantity} units</strong></span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Quantity to Add *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={inboundQty}
                  onChange={(e) => setInboundQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-[#FBF9F6] rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={inboundReason}
                  onChange={(e) => setInboundReason(e.target.value)}
                  placeholder="e.g. Regular weekly restock"
                  className="w-full px-3.5 py-2 text-xs bg-[#FBF9F6] rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                />
              </div>

              {/* Optional references */}
              <div className="pt-2 border-t border-stone-100">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2">
                  Optional Tracking Numbers (Not Required)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-stone-500 block mb-0.5">PO Number</label>
                    <input
                      type="text"
                      placeholder="PO-8812"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FBF9F6] rounded-xl border border-[#E8E1D7] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-stone-500 block mb-0.5">GRN Number</label>
                    <input
                      type="text"
                      placeholder="GRN-0812"
                      value={grnNumber}
                      onChange={(e) => setGrnNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FBF9F6] rounded-xl border border-[#E8E1D7] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-stone-500 block mb-0.5">Supplier Invoice</label>
                    <input
                      type="text"
                      placeholder="INV-9021"
                      value={supplierInvoiceNumber}
                      onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FBF9F6] rounded-xl border border-[#E8E1D7] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddStockModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStock}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-xl shadow-md disabled:opacity-50"
                >
                  {submittingStock ? 'Adding Stock...' : 'Confirm Stock Addition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOW STOCK WARNING THRESHOLD MODAL */}
      {thresholdModalOpen && targetThresholdItem && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E8E1D7]">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900">Set Low Stock Warning</h3>
              </div>
              <button
                onClick={() => setThresholdModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleThresholdSubmit} className="mt-4 space-y-3">
              <p className="text-[11px] text-stone-500">
                You will receive a low stock warning when available units fall at or below this number for{' '}
                <strong>{targetThresholdItem.WarehouseName}</strong>.
              </p>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Alert when available units reach:
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm font-bold bg-[#FBF9F6] rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setThresholdModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingThreshold}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-xl shadow-md disabled:opacity-50"
                >
                  {savingThreshold ? 'Saving...' : 'Save Warning Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
