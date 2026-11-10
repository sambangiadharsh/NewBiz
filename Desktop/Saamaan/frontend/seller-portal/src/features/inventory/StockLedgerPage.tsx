import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Warehouse,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Package,
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

interface LedgerItem {
  InventoryTransactionID: string;
  InventoryID: string;
  InboundShipmentID?: string;
  OrderID?: string;
  OrderNumber?: string;
  ShipmentNumber?: string;
  TransactionType: string;
  Quantity: number;
  BalanceBefore: number;
  BalanceAfter: number;
  Reason?: string;
  PONumber?: string;
  POAmount?: number;
  GRNNumber?: string;
  GRNAmount?: number;
  SupplierInvoiceNumber?: string;
  InvoiceAmount?: number;
  CreatedAt: string;
  WarehouseID: string;
  WarehouseName: string;
  WarehouseCode: string;
  SellerProductID: string;
  SellerSKU: string;
  ProductID: string;
  ProductName: string;
  ProductTitle: string;
  PrimaryImage?: string | null;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const StockLedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);

  const {
    currentPage: page,
    pageSize: limit,
    setPage,
    paginationProps,
  } = usePagination({
    totalItems,
    initialPage: 1,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  });

  // Filters
  const [warehouseId, setWarehouseId] = useState<string>(searchParams.get('warehouseId') || '');
  const [txType, setTxType] = useState<string>('');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await apiClient.get('/seller/catalog/eligible-warehouses');
        if (res.data?.data) {
          const rawWh = Array.isArray(res.data.data) ? res.data.data : [];
          setWarehouses(
            rawWh.map((w: any) => ({
              id: String(w.warehouseId || w.WarehouseID || w.id || ''),
              name: String(w.warehouseName || w.WarehouseName || w.name || 'Warehouse'),
              code: String(w.warehouseCode || w.WarehouseCode || w.code || ''),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load eligible warehouses', err);
      }
    };
    fetchWarehouses();
  }, []);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (warehouseId) params.warehouseId = warehouseId;
      if (txType) params.transactionType = txType;

      const res = await apiClient.get('/seller/inventory/ledger', { params });
      if (res.data?.data) {
        const rawItems = res.data.data.items || [];
        setItems(rawItems);
        const total =
          res.data.data.total ??
          (res.data.data.totalPages ? res.data.data.totalPages * limit : rawItems.length);
        setTotalItems(total);
      }
    } catch (err) {
      console.error('Failed to fetch stock movement ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [warehouseId, txType, page, limit]);

  const formatTxTypeBadge = (type: string, _qty?: number) => {
    let badgeColor = 'bg-stone-100 text-stone-700 border-stone-200';
    let label = type.replace(/_/g, ' ');

    if (type === 'INBOUND') {
      label = 'Inbound Receipt (+)';
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (type === 'OPENING_BALANCE') {
      label = 'Initial Baseline (+)';
      badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
    } else if (type === 'ORDER_RESERVED') {
      label = 'Order Reserved (Hold)';
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (type === 'OUTBOUND_DISPATCH') {
      label = 'Outbound Dispatch (-)';
      badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (type === 'RESERVATION_RELEASED') {
      label = 'Reservation Released (+)';
      badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (type === 'RESERVATION_EXPIRED') {
      label = 'Hold Expired (+)';
      badgeColor = 'bg-orange-50 text-orange-800 border-orange-200';
    } else if (type === 'DAMAGE') {
      label = 'Damaged on Arrival';
      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
        {label}
      </span>
    );
  };

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
          onClick={fetchLedger}
          className="p-2 bg-white border border-[#E8E1D7] hover:bg-[#F3EFEA] text-stone-700 rounded-xl transition-all shadow-2xs cursor-pointer"
          title="Refresh History"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-[#E8E1D7] shadow-2xs flex flex-wrap items-center gap-3">
        {/* Warehouse Dropdown */}
        <div className="flex items-center gap-2 bg-[#FBF9F6] px-3.5 py-2 rounded-xl border border-[#E8E1D7]">
          <Warehouse className="w-4 h-4 text-stone-500" />
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-xs text-stone-800 font-medium focus:outline-none cursor-pointer"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>
        </div>

        {/* Transaction Type */}
        <div className="flex items-center gap-2 bg-[#FBF9F6] px-3.5 py-2 rounded-xl border border-[#E8E1D7]">
          <Filter className="w-4 h-4 text-stone-500" />
          <select
            value={txType}
            onChange={(e) => {
              setTxType(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-xs text-stone-800 font-medium focus:outline-none cursor-pointer"
          >
            <option value="">All Event Types</option>
            <option value="INBOUND">Inbound Receipt (GRN)</option>
            <option value="ORDER_RESERVED">Order Reserved (Checkout Hold)</option>
            <option value="OUTBOUND_DISPATCH">Outbound Dispatch (Shipped)</option>
            <option value="RESERVATION_RELEASED">Reservation Released (Cancelled)</option>
            <option value="RESERVATION_EXPIRED">Reservation Expired (Timeout)</option>
            <option value="DAMAGE">Damaged on Arrival</option>
            <option value="OPENING_BALANCE">Initial Baseline</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <TableContainer
        footer={
          <Pagination
            {...paginationProps}
            itemLabel="stock movements"
            themeColor="burgundy"
          />
        }
      >
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Date & Time</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Seller SKU</TableHead>
              <TableHead>Warehouse Hub</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead align="center">Balance Before</TableHead>
              <TableHead align="center">Quantity Change</TableHead>
              <TableHead align="center">Balance After</TableHead>
              <TableHead>Reason / Notes</TableHead>
              <TableHead>Reference Docs</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={10} rows={6} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12">
                  <NoResults
                    description="No stock movements recorded yet. Stock intakes and order fulfillments will appear here automatically."
                    className="py-6"
                  />
                </td>
              </tr>
            ) : (
              items.map((entry) => {
                const isPositive = entry.Quantity > 0;
                const isZero = entry.Quantity === 0;
                const entryDate = new Date(entry.CreatedAt);

                return (
                  <TableRow key={entry.InventoryTransactionID}>
                    {/* Timestamp */}
                    <TableCell>
                      <div className="font-medium text-stone-800 text-[11px] whitespace-nowrap">
                        {entryDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <span className="text-stone-400 text-[10px] block font-mono">
                        {entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </TableCell>

                    {/* Product Identity with Thumbnail */}
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 relative overflow-hidden">
                          <Package className="w-4 h-4 text-stone-400" />
                          {entry.PrimaryImage && (
                            <img
                              src={getImagePreviewUrl(entry.PrimaryImage)}
                              alt={entry.ProductTitle || entry.ProductName}
                              className="w-full h-full object-cover absolute inset-0 bg-white"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="font-bold text-stone-900 max-w-[190px] truncate leading-tight text-xs"
                            title={entry.ProductTitle || entry.ProductName}
                          >
                            {entry.ProductTitle || entry.ProductName}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Dedicated Seller SKU Column */}
                    <TableCell>
                      <span className="font-mono text-[11px] text-stone-700 bg-[#FAF7F3] border border-[#ECE5DC] px-2 py-0.5 rounded-md font-bold tracking-tight inline-block">
                        {entry.SellerSKU}
                      </span>
                    </TableCell>

                    {/* Warehouse */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-semibold text-stone-800 text-xs">
                        <Warehouse className="w-3.5 h-3.5 text-[#7E2532] shrink-0" />
                        <span className="truncate max-w-[130px]">{entry.WarehouseName}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {entry.WarehouseCode}
                      </span>
                    </TableCell>

                    {/* Event Type */}
                    <TableCell>
                      {formatTxTypeBadge(entry.TransactionType, entry.Quantity)}
                    </TableCell>

                    {/* Balance Before */}
                    <TableCell align="center">
                      <span className="font-mono font-semibold text-xs text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-md">
                        {entry.BalanceBefore ?? 0}
                      </span>
                    </TableCell>

                    {/* Quantity Change */}
                    <TableCell align="center">
                      <span className="font-mono font-black text-xs">
                        {isZero ? (
                          <span className="text-stone-400">0</span>
                        ) : isPositive ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-0.5">
                            +{entry.Quantity}
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-0.5">
                            {entry.Quantity}
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </span>
                    </TableCell>

                    {/* Balance After */}
                    <TableCell align="center">
                      <span className="font-mono font-black text-xs text-stone-900 bg-stone-50 border border-stone-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                        {entry.BalanceAfter ?? 0}
                      </span>
                    </TableCell>

                    {/* Reason */}
                    <TableCell>
                      <span className="text-stone-600 max-w-xs block truncate text-xs" title={entry.Reason || '—'}>
                        {entry.Reason || '—'}
                      </span>
                    </TableCell>

                    {/* References */}
                    <TableCell>
                      <div className="text-[10px] text-stone-600 space-y-1 font-mono">
                        {entry.OrderNumber && (
                          <div className="inline-block bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-bold mr-1">
                            ORD: {entry.OrderNumber}
                          </div>
                        )}
                        {entry.ShipmentNumber && (
                          <div className="inline-block bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-bold mr-1">
                            SHP: {entry.ShipmentNumber}
                          </div>
                        )}
                        {entry.GRNNumber && (
                          <div className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold mr-1">
                            GRN: {entry.GRNNumber}
                          </div>
                        )}
                        {entry.PONumber && (
                          <div className="inline-block bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded mr-1">
                            PO: {entry.PONumber}
                          </div>
                        )}
                        {entry.SupplierInvoiceNumber && (
                          <div className="inline-block bg-stone-100 text-stone-800 border border-stone-200 px-1.5 py-0.5 rounded">
                            INV: {entry.SupplierInvoiceNumber}
                          </div>
                        )}
                        {!entry.OrderNumber && !entry.ShipmentNumber && !entry.GRNNumber && !entry.PONumber && !entry.SupplierInvoiceNumber && (
                          <span className="text-stone-400 italic font-sans">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
