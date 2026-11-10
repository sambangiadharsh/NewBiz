import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,

  XCircle,
  Package,
  X,
  FileText,
  Printer,
  Download,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import noResultsImg from '../../assets/no results found.png';
import { showAlert, confirmProceed, showSweetToast } from '../../lib/swal.js';

import { Pagination } from '../../components/common/Pagination.js';
import { usePagination } from '../../hooks/usePagination.js';

interface WarehouseInfo {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  city: string;
}

interface ShipmentItem {
  inboundShipmentItemId: string;
  sellerProductId: string;
  productId: string;
  productName: string;
  sellerSku: string;
  primaryImage: string | null;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  shortageQuantity: number;
  remarks: string | null;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface InboundShipment {
  inboundShipmentId: string;
  shipmentNumber: string;
  status: 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY' | 'CANCELLED';
  carrierName: string | null;
  trackingNumber: string | null;
  boxCount: number;
  estimatedArrivalDate: string | null;
  dispatchedAt: string;
  receivedAt: string | null;
  grnNumber: string | null;
  grnDate: string | null;
  notes: string | null;
  poNumber: string | null;
  supplierInvoiceNumber: string | null;
  createdAt: string;
  warehouse: WarehouseInfo;
  metrics: {
    totalLineItems: number;
    totalExpectedQuantity: number;
    totalReceivedQuantity: number;
    totalDamagedQuantity: number;
    totalShortageQuantity: number;
  };
}

export const InboundNoticePage: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Details Modal state
  const [detailsShipmentId, setDetailsShipmentId] = useState<string | null>(null);
  const [shipmentDetails, setShipmentDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingGrnPreviewId, setLoadingGrnPreviewId] = useState<string | null>(null);
  const [grnPreview, setGrnPreview] = useState<{
    shipmentId: string;
    grnNumber: string;
    pdfUrl?: string;
    pdfBlob?: Blob;
  } | null>(null);

  // Reusable pagination hook integration
  const pagination = usePagination<InboundShipment>({
    data: shipments,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  const handlePreviewGrn = async (shipmentId: string, grnNumber?: string | null) => {
    setLoadingGrnPreviewId(shipmentId);
    try {
      const res = await apiClient.get(`/seller/inbound-shipments/${shipmentId}/grn/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      setGrnPreview({
        shipmentId,
        grnNumber: grnNumber || `GRN-${shipmentId}`,
        pdfUrl: url,
        pdfBlob: blob,
      });
    } catch (err: any) {
      showAlert('Preview Failed', err.response?.data?.message || 'Failed to load official GRN PDF', 'error');
    } finally {
      setLoadingGrnPreviewId(null);
    }
  };

  const handleCloseGrnPreview = () => {
    if (grnPreview?.pdfUrl) {
      window.URL.revokeObjectURL(grnPreview.pdfUrl);
    }
    setGrnPreview(null);
  };

  const handleDownloadFromPreview = () => {
    if (!grnPreview?.pdfBlob) return;
    const url = grnPreview.pdfUrl || window.URL.createObjectURL(grnPreview.pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${grnPreview.grnNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintFromPreview = () => {
    window.print();
  };

  // Load Shipments
  const fetchShipments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/seller/inbound-shipments', {
        params: {
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchQuery.trim() || undefined,
        },
      });
      if (res.data?.success && res.data?.data) {
        setShipments(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load inbound shipments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [selectedStatus]);

  // View Shipment Details
  const handleOpenDetails = async (shipmentId: string) => {
    setDetailsShipmentId(shipmentId);
    setLoadingDetails(true);
    try {
      const res = await apiClient.get(`/seller/inbound-shipments/${shipmentId}`);
      if (res.data?.success && res.data?.data) {
        setShipmentDetails(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch shipment details', err);
      showAlert('Error', 'Could not load shipment details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Cancel Shipment
  const handleCancelShipment = async (shipmentId: string) => {
    const confirmed = await confirmProceed({
      title: 'Cancel Inbound Shipment?',
      text: 'Are you sure you want to cancel this inbound shipment notice? This action cannot be undone.',
      confirmButtonText: 'Yes, Cancel Shipment',
      cancelButtonText: 'Keep Shipment',
      icon: 'warning',
    });
    if (!confirmed) return;

    try {
      await apiClient.post(`/seller/inbound-shipments/${shipmentId}/cancel`, {
        reason: 'Cancelled by seller from portal',
      });
      showSweetToast('Shipment cancelled successfully', 'success');
      fetchShipments();
      if (detailsShipmentId === shipmentId) {
        setDetailsShipmentId(null);
      }
    } catch (err: any) {
      showAlert('Cancellation Failed', err.response?.data?.message || 'Failed to cancel shipment', 'error');
    }
  };

  // Status Badge Helper (Lean 4-status model)
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-3.5 h-3.5 animate-pulse" />
            In Transit
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Received
          </span>
        );
      case 'DISCREPANCY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Discrepancy (Damaged/Shortage)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#641D26]/10 text-[#641D26] flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900 tracking-tight">Inbound Shipments</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Send stock to Bhandalaya warehouses, track transit, and review verified GRN inspection reports.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/inventory/inbound/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create Inbound Shipment
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Shipments' },
            { id: 'IN_TRANSIT', label: 'In Transit' },
            { id: 'RECEIVED', label: 'Received' },
            { id: 'DISCREPANCY', label: 'Discrepancy' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === tab.id
                  ? 'bg-[#641D26] text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by shipment #, carrier, GRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchShipments()}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26]"
            />
          </div>
          <button
            onClick={fetchShipments}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Shipment #</th>
                <th className="py-3 px-4">Destination Warehouse</th>
                <th className="py-3 px-4">Carrier & Tracking</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Dispatched At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <>
                  {[...Array(6)].map((_, idx) => (
                    <tr key={`shimmer-${idx}`} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 w-28 bg-stone-200/80 rounded-lg" />
                        <div className="h-3 w-20 bg-stone-100 rounded-md mt-1.5" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-36 bg-stone-200/80 rounded-lg" />
                        <div className="h-3 w-24 bg-stone-100 rounded-md mt-1.5" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-28 bg-stone-200/80 rounded-lg" />
                        <div className="h-3 w-20 bg-stone-100 rounded-md mt-1.5" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 w-16 bg-stone-200/80 rounded-lg mx-auto" />
                        <div className="h-3 w-20 bg-stone-100 rounded-md mx-auto mt-1.5" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-6 w-24 bg-stone-200/80 rounded-full" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-20 bg-stone-200/80 rounded-lg" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-7 w-20 bg-stone-200/80 rounded-xl" />
                          <div className="h-7 w-16 bg-stone-200/60 rounded-xl" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : pagination.paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center select-none">
                      <img
                        src={noResultsImg}
                        alt="No results found"
                        className="w-56 h-auto max-h-56 object-contain pointer-events-none"
                      />
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.paginatedData.map((s) => (
                  <tr key={s.inboundShipmentId} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-stone-900">{s.shipmentNumber}</div>
                      {s.grnNumber && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                          GRN: {s.grnNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-800">{s.warehouse?.warehouseName}</div>
                      <div className="text-[10px] text-stone-400">
                        {s.warehouse?.warehouseCode} • {s.warehouse?.city}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-stone-700">{s.carrierName || 'Self Transport'}</div>
                      {s.trackingNumber && (
                        <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                          {s.trackingNumber} ({s.boxCount} boxes)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-stone-900">
                        {s.metrics.totalLineItems} SKU{s.metrics.totalLineItems > 1 ? 's' : ''}
                      </div>
                     
                    </td>
                    <td className="py-3.5 px-4">{renderStatusBadge(s.status)}</td>
                    <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                      {new Date(s.dispatchedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetails(s.inboundShipmentId)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-all"
                        >
                          View Details
                        </button>
                        {(s.status === 'RECEIVED' || s.status === 'DISCREPANCY') && (
                          <button
                            onClick={() => handlePreviewGrn(s.inboundShipmentId, s.grnNumber)}
                            disabled={loadingGrnPreviewId === s.inboundShipmentId}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all disabled:opacity-50"
                            title="View & Download Official Digital GRN"
                          >
                            <Eye className="w-3.5 h-3.5 text-teal-700" />
                            <span>{loadingGrnPreviewId === s.inboundShipmentId ? 'Loading...' : 'View GRN'}</span>
                          </button>
                        )}
                        {s.status === 'IN_TRANSIT' && (
                          <button
                            onClick={() => handleCancelShipment(s.inboundShipmentId)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all"
                            title="Cancel Shipment"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination */}
        {!loading && shipments.length > 0 && (
          <Pagination
            {...pagination.paginationProps}
            itemLabel="shipments"
            themeColor="burgundy"
          />
        )}
      </div>

      {/* DETAILS & RECONCILIATION MODAL */}
      {detailsShipmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center font-black">
                  #
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-stone-900">
                      {shipmentDetails?.shipmentNumber || 'Shipment Details'}
                    </h2>
                    {shipmentDetails && renderStatusBadge(shipmentDetails.status)}
                  </div>
                  <p className="text-xs text-stone-500">
                    Destination: {shipmentDetails?.warehouse?.warehouseName} ({shipmentDetails?.warehouse?.warehouseCode})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailsShipmentId(null)}
                className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-16 w-full bg-stone-100 rounded-2xl" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="h-16 bg-stone-100 rounded-2xl" />
                    <div className="h-16 bg-stone-100 rounded-2xl" />
                    <div className="h-16 bg-stone-100 rounded-2xl" />
                    <div className="h-16 bg-stone-100 rounded-2xl" />
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-4 w-40 bg-stone-200/80 rounded-md" />
                    <div className="h-44 bg-stone-100 rounded-2xl border border-stone-200/50" />
                  </div>
                </div>
              ) : shipmentDetails ? (
                <>
                  {/* Status & GRN Alert Banner */}
                  {shipmentDetails.status === 'RECEIVED' && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-emerald-900">
                          100% Stock Verified & Credited to Available Inventory
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Goods Receipt Note <strong>{shipmentDetails.grnNumber}</strong> finalized on{' '}
                          {new Date(shipmentDetails.grnDate).toLocaleString('en-IN')}. All items matched your declared quantities.
                        </p>
                      </div>
                    </div>
                  )}

                  {shipmentDetails.status === 'DISCREPANCY' && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-900">
                          Discrepancy Reported During Warehouse Inspection
                        </h4>
                        <p className="text-xs text-amber-800 mt-0.5">
                          GRN <strong>{shipmentDetails.grnNumber}</strong> recorded shortages or physical damage. Only verified good units have been added to your available inventory.
                        </p>
                      </div>
                    </div>
                  )}

                  {shipmentDetails.status === 'IN_TRANSIT' && (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
                      <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-blue-900">Shipment In Transit</h4>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Carrier {shipmentDetails.carrierName} ({shipmentDetails.trackingNumber}). The warehouse will inspect goods upon truck dock arrival.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Logistics Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-400 uppercase">Carrier</span>
                      <p className="text-xs font-extrabold text-stone-800 mt-0.5 truncate">
                        {shipmentDetails.carrierName || 'Self Transport'}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-400 uppercase">Tracking #</span>
                      <p className="text-xs font-extrabold text-stone-800 mt-0.5 truncate font-mono">
                        {shipmentDetails.trackingNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-400 uppercase">Box Count</span>
                      <p className="text-xs font-extrabold text-stone-800 mt-0.5">
                        {shipmentDetails.boxCount} Boxes
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-400 uppercase">GRN Number</span>
                      <p className="text-xs font-extrabold text-emerald-700 mt-0.5 font-mono truncate">
                        {shipmentDetails.grnNumber || 'Pending'}
                      </p>
                    </div>
                  </div>

                  {/* Line Items Reconciliation Table */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                      Item-by-Item Reconciliation
                    </h3>
                    <div className="border border-stone-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase text-[10px] font-bold">
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3 text-center">Expected</th>
                            <th className="py-2.5 px-3 text-center">Good (Credited)</th>
                            <th className="py-2.5 px-3 text-center">Damaged</th>
                            <th className="py-2.5 px-3 text-center">Shortage</th>
                            <th className="py-2.5 px-3">QC Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {shipmentDetails.items?.map((item: ShipmentItem) => (
                            <tr key={item.inboundShipmentItemId}>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                    <Package className="w-4 h-4 text-stone-400" />
                                    {item.primaryImage && (
                                      <img
                                        src={getImagePreviewUrl(item.primaryImage)}
                                        alt={item.productName}
                                        className="w-full h-full object-cover absolute inset-0 bg-white"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-stone-900 truncate">{item.productName}</div>
                                    <div className="text-[10px] text-stone-400 font-mono">SKU: {item.sellerSku}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-stone-700">
                                {item.expectedQuantity}
                              </td>
                              <td className="py-2.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/30">
                                {item.receivedQuantity}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-red-600">
                                {item.damagedQuantity > 0 ? item.damagedQuantity : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                                {item.shortageQuantity > 0 ? item.shortageQuantity : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-stone-500">
                                {item.remarks || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes */}
                  {shipmentDetails.notes && (
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                      <span className="font-bold text-stone-700">Notes / Remarks: </span>
                      <span className="text-stone-600">{shipmentDetails.notes}</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-200 flex items-center justify-between bg-stone-50/50">
              {(shipmentDetails?.status === 'RECEIVED' || shipmentDetails?.status === 'DISCREPANCY') ? (
                <button
                  type="button"
                  onClick={() => handlePreviewGrn(shipmentDetails.inboundShipmentId, shipmentDetails.grnNumber)}
                  disabled={loadingGrnPreviewId === shipmentDetails.inboundShipmentId}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 shadow-sm transition-all disabled:opacity-50"
                >
                  <Eye className="w-4 h-4 text-teal-700" />
                  <span>{loadingGrnPreviewId === shipmentDetails.inboundShipmentId ? 'Loading PDF...' : 'View Official GRN (PDF)'}</span>
                </button>
              ) : (
                <span className="text-xs text-stone-400">
                  Created on {new Date(shipmentDetails?.createdAt).toLocaleDateString('en-IN')}
                </span>
              )}
              <button
                onClick={() => setDetailsShipmentId(null)}
                className="px-5 py-2 text-xs font-bold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL GRN DOCUMENT PREVIEW MODAL */}
      {grnPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[80vh] max-h-[80vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Preview Header */}
            <div className="p-4 px-6 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                    Official Goods Received Note (GRN)
                  </h3>
                  <p className="text-[11px] font-mono font-bold text-teal-700">
                    {grnPreview.grnNumber}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Print, Download, Close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintFromPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 shadow-sm transition-all"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5 text-stone-600" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFromPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-sm transition-all active:scale-95"
                  title="Download PDF to Computer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseGrnPreview}
                  className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 flex items-center justify-center ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Official GRN PDF Viewer */}
            <div className="flex-1 bg-stone-100/60 p-3 sm:p-4 overflow-hidden flex items-center justify-center">
              {grnPreview.pdfUrl ? (
                <iframe
                  src={grnPreview.pdfUrl}
                  className="w-full h-full rounded-2xl bg-white shadow-xs border border-stone-200"
                  title={`GRN-${grnPreview.grnNumber}`}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
