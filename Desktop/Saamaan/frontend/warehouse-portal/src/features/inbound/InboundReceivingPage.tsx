import React, { useState, useEffect } from 'react';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,

  XCircle,
  Package,
  Search,
  X,
  FileCheck2,
  FileText,
  Printer,
  Download,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import noResultsImg from '../../assets/noresults.png';
import { showAlert, confirmProceed } from '../../lib/swal.js';

import { Pagination } from '../../components/common/Pagination.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Spinner } from '../../components/common/Spinner.js';

interface SellerInfo {
  sellerId: string;
  sellerName: string;
  sellerCode: string;
  businessName: string | null;
  email?: string;
  phone?: string;
}

interface InboundShipmentItem {
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
  purchasePrice?: number;
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
  createdAt: string;
  seller: SellerInfo;
  metrics: {
    totalLineItems: number;
    totalExpectedQuantity: number;
    totalReceivedQuantity: number;
    totalDamagedQuantity: number;
    totalShortageQuantity: number;
  };
}

interface QCItemState {
  inboundShipmentItemId: string;
  receivedQuantity: number;
  damagedQuantity: number;
  remarks: string;
}

export const InboundReceivingPage: React.FC = () => {
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('IN_TRANSIT');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Receiving / Inspection Modal
  const [inspectingShipmentId, setInspectingShipmentId] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [qcItems, setQcItems] = useState<Record<string, QCItemState>>({});
  const [grnNotes, setGrnNotes] = useState<string>('');
  const [submittingGRN, setSubmittingGRN] = useState(false);
  const [loadingGrnPreviewId, setLoadingGrnPreviewId] = useState<string | null>(null);
  const [grnPreview, setGrnPreview] = useState<{
    shipmentId: string;
    grnNumber: string;
    pdfUrl?: string;
    pdfBlob?: Blob;
  } | null>(null);

  // Success summary modal
  const [grnSuccessResult, setGrnSuccessResult] = useState<any | null>(null);

  // Reusable pagination hook integration
  const pagination = usePagination<InboundShipment>({
    data: shipments,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/warehouse/inbound-shipments', {
        params: {
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: searchQuery.trim() || undefined,
        },
      });
      if (res.data?.success && res.data?.data) {
        setShipments(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load warehouse inbound shipments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [selectedStatus]);

  // Open Inspection Dialog
  const handleOpenInspection = async (shipmentId: string) => {
    setInspectingShipmentId(shipmentId);
    setLoadingInspect(true);
    setGrnNotes('');
    try {
      const res = await apiClient.get(`/warehouse/inbound-shipments/${shipmentId}`);
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setInspectData(data);

        // Initialize QC states
        const initialQc: Record<string, QCItemState> = {};
        for (const item of data.items || []) {
          initialQc[item.inboundShipmentItemId] = {
            inboundShipmentItemId: item.inboundShipmentItemId,
            receivedQuantity: item.expectedQuantity, // Default good units to expected for quick flow
            damagedQuantity: 0,
            remarks: '',
          };
        }
        setQcItems(initialQc);
      }
    } catch (err) {
      console.error('Failed to load shipment inspection data', err);
      showAlert('Error', 'Could not load shipment details', 'error');
      setInspectingShipmentId(null);
    } finally {
      setLoadingInspect(false);
    }
  };

  // Update QC values for a line item
  const handleUpdateQc = (
    itemId: string,
    field: 'receivedQuantity' | 'damagedQuantity' | 'remarks',
    value: any
  ) => {
    setQcItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: field === 'remarks' ? value : Math.max(0, parseInt(value, 10) || 0),
      },
    }));
  };

  const handlePreviewGrn = async (shipmentId: string, grnNumber?: string | null) => {
    setLoadingGrnPreviewId(shipmentId);
    try {
      const res = await apiClient.get(`/warehouse/inbound-shipments/${shipmentId}/grn/pdf`, {
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

  // Submit Final GRN
  const handleSubmitGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingShipmentId || !inspectData) return;

    // Strict validation: Good + Damaged <= Expected
    for (const item of inspectData.items || []) {
      const qc = qcItems[item.inboundShipmentItemId] || { receivedQuantity: 0, damagedQuantity: 0 };
      if (qc.receivedQuantity + qc.damagedQuantity > item.expectedQuantity) {
        showAlert(
          'Quantity Discrepancy Error',
          `Line item "${item.productName}" has verified total (${qc.receivedQuantity + qc.damagedQuantity}) greater than declared expected units (${item.expectedQuantity}). Good units + damaged units cannot exceed declared units.`,
          'error'
        );
        return;
      }
    }

    const confirmed = await confirmProceed({
      title: 'Confirm GRN Finalization?',
      text: 'Verified good stock will be credited to live sellable warehouse inventory immediately and official digital GRN will be auto-generated.',
      confirmButtonText: 'Yes, Finalize GRN',
      cancelButtonText: 'Review More',
      icon: 'question',
    });
    if (!confirmed) {
      return;
    }

    setSubmittingGRN(true);
    try {
      const payload = {
        grnNotes: grnNotes.trim().slice(0, 500) || undefined,
        items: Object.values(qcItems).map((i) => ({
          inboundShipmentItemId: i.inboundShipmentItemId,
          receivedQuantity: i.receivedQuantity,
          damagedQuantity: i.damagedQuantity,
          remarks: i.remarks.trim().slice(0, 250) || undefined,
        })),
      };

      const res = await apiClient.post(
        `/warehouse/inbound-shipments/${inspectingShipmentId}/receive`,
        payload
      );

      if (res.data?.success) {
        setGrnSuccessResult(res.data.data);
        setInspectingShipmentId(null);
        fetchShipments();
      }
    } catch (err: any) {
      showAlert('GRN Finalization Failed', err.response?.data?.message || 'Failed to finalize GRN', 'error');
    } finally {
      setSubmittingGRN(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-3.5 h-3.5 animate-pulse" />
            In Transit / Arriving
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
            Discrepancy
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Inbound Receiving & GRN
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Acknowledge incoming trucks, perform item-by-item QC inspection, and generate official Goods Receipt Notes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
            Dock Bay Operations
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'IN_TRANSIT', label: 'Expected & Arriving' },
            { id: 'RECEIVED', label: 'Completed (Received)' },
            { id: 'DISCREPANCY', label: 'Discrepancies' },
            { id: 'ALL', label: 'All History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === tab.id
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search shipment #, seller, carrier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchShipments()}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>
          <button
            onClick={fetchShipments}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Shipment #</th>
                <th className="py-3 px-4">Merchant / Seller</th>
                <th className="py-3 px-4">Carrier & Tracking</th>
                <th className="py-3 px-4 text-center">Declared Items</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Dispatched At</th>
                <th className="py-3 px-4 text-right">Dock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Spinner text="Loading..." />
                  </td>
                </tr>
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
                  <tr key={s.inboundShipmentId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900">{s.shipmentNumber}</div>
                      {s.grnNumber && (
                        <div className="text-[10px] text-teal-700 font-semibold mt-0.5">
                          GRN: {s.grnNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{s.seller?.sellerName}</div>
                      <div className="text-[10px] text-slate-400">Code: {s.seller?.sellerCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-700">{s.carrierName || 'Self Transport'}</div>
                      {s.trackingNumber && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {s.trackingNumber} ({s.boxCount} boxes)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-slate-900">{s.metrics.totalLineItems} SKUs</div>
                    </td>
                    <td className="py-3.5 px-4">{renderStatusBadge(s.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(s.dispatchedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {s.status === 'IN_TRANSIT' ? (
                        <button
                          onClick={() => handleOpenInspection(s.inboundShipmentId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-sm transition-all active:scale-95"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          Receive & QC
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenInspection(s.inboundShipmentId)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                          >
                            View
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
                        </div>
                      )}
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
            themeColor="teal"
          />
        )}
      </div>

      {/* MODAL 1: RECEIVE & INSPECT / GRN VERIFICATION */}
      {inspectingShipmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900">
                      {inspectData?.status === 'IN_TRANSIT'
                        ? 'Stock Receiving & QC Inspection'
                        : `GRN Summary: ${inspectData?.grnNumber || inspectData?.shipmentNumber}`}
                    </h2>
                    {inspectData && renderStatusBadge(inspectData.status)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Shipment: <strong className="text-slate-800">{inspectData?.shipmentNumber}</strong> | Seller:{' '}
                    <strong className="text-slate-800">{inspectData?.seller?.sellerName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingShipmentId(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form / Body */}
            <form onSubmit={handleSubmitGRN} className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingInspect ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Spinner text="Loading..." />
                </div>
              ) : inspectData ? (
                <>
                  {/* Logistics Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Carrier</span>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5 truncate">
                        {inspectData.carrierName || 'Self Transport'}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Tracking #</span>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5 font-mono truncate">
                        {inspectData.trackingNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cartons / Boxes</span>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                        {inspectData.boxCount} Boxes
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Items</span>
                      <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                        {inspectData.items?.length} Line Items
                      </p>
                    </div>
                  </div>

                  {/* QC Line Items Inspection Form */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Item Inspection & Physical Verification
                      </h3>
                      {inspectData.status === 'IN_TRANSIT' && (
                        <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                          Verify Good vs. Damaged Units below
                        </span>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      {inspectData.items?.map((item: InboundShipmentItem) => {
                        const isReadOnly = inspectData.status !== 'IN_TRANSIT';
                        const qc = qcItems[item.inboundShipmentItemId] || {
                          receivedQuantity: item.receivedQuantity,
                          damagedQuantity: item.damagedQuantity,
                          remarks: item.remarks || '',
                        };

                        const expected = item.expectedQuantity;
                        const good = Number(qc.receivedQuantity || 0);
                        const damaged = Number(qc.damagedQuantity || 0);
                        const isOvercount = !isReadOnly && (good + damaged > expected);
                        const shortage = Math.max(0, expected - good - damaged);
                        const rate = Number(item.purchasePrice || 0);

                        return (
                          <div key={item.inboundShipmentItemId} className={`p-4 bg-white hover:bg-slate-50/50 space-y-3 ${isOvercount ? 'bg-red-50/30 border-l-4 border-red-500' : ''}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                  <Package className="w-6 h-6 text-slate-400" />
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
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900">{item.productName}</h4>
                                  <p className="text-[11px] text-slate-400">
                                    SKU: <span className="font-mono text-slate-600">{item.sellerSku}</span>
                                    {rate > 0 && <span className="ml-2 text-slate-500">· Rate: ₹{rate.toFixed(2)}</span>}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Declared</span>
                                <p className="text-sm font-black text-slate-900">{expected} units</p>
                              </div>
                            </div>

                            {/* Inspection Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-center">
                              <div>
                                <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">
                                  Good Units (Passed QC)
                                </label>
                                {isReadOnly ? (
                                  <span className="text-xs font-extrabold text-emerald-700">
                                    {item.receivedQuantity}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    max={expected}
                                    value={good}
                                    onChange={(e) =>
                                      handleUpdateQc(item.inboundShipmentItemId, 'receivedQuantity', e.target.value)
                                    }
                                    required
                                    className={`w-full px-3 py-1.5 text-xs font-bold rounded-xl border bg-white ${
                                      isOvercount ? 'border-red-400 text-red-900 focus:ring-red-500/20' : 'border-emerald-300 text-emerald-900 focus:ring-emerald-500/20'
                                    } focus:outline-none focus:ring-2`}
                                  />
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">
                                  Damaged Units
                                </label>
                                {isReadOnly ? (
                                  <span className="text-xs font-extrabold text-red-600">
                                    {item.damagedQuantity}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    value={damaged}
                                    onChange={(e) =>
                                      handleUpdateQc(item.inboundShipmentItemId, 'damagedQuantity', e.target.value)
                                    }
                                    className={`w-full px-3 py-1.5 text-xs font-bold rounded-xl border bg-white ${
                                      isOvercount ? 'border-red-400 text-red-900' : 'border-red-300 text-red-700'
                                    } focus:outline-none focus:ring-2 focus:ring-red-500/20`}
                                  />
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Shortage
                                </label>
                                <span
                                  className={`text-xs font-extrabold px-2.5 py-1 rounded-lg inline-block ${
                                    shortage > 0
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {shortage > 0 ? `${shortage} missing` : '0'}
                                </span>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Item Remarks (Max 250)
                                </label>
                                {isReadOnly ? (
                                  <span className="text-xs text-slate-600">{item.remarks || '-'}</span>
                                ) : (
                                  <input
                                    type="text"
                                    maxLength={250}
                                    placeholder="e.g. Seal intact / 1 broken"
                                    value={qc.remarks}
                                    onChange={(e) =>
                                      handleUpdateQc(item.inboundShipmentItemId, 'remarks', e.target.value)
                                    }
                                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Overcount validation error message */}
                            {isOvercount && (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 animate-in fade-in">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                                <span>
                                  Quantity Error: Verified units ({good} Good + {damaged} Damaged = {good + damaged}) cannot exceed declared {expected} units!
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* System Digital GRN Summary & Verification Details */}
                  {inspectData.status === 'IN_TRANSIT' && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-700" />
                          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            System-Generated Digital GRN Summary
                          </h4>
                        </div>
                        <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                          Automatic Audit
                        </span>
                      </div>

                      {/* Live calculation boxes */}
                      {(() => {
                        const totals = (inspectData.items || []).reduce(
                          (acc: any, it: InboundShipmentItem) => {
                            const qc = qcItems[it.inboundShipmentItemId] || {
                              receivedQuantity: it.receivedQuantity,
                              damagedQuantity: it.damagedQuantity,
                            };
                            const good = Number(qc.receivedQuantity || 0);
                            const damaged = Number(qc.damagedQuantity || 0);
                            const exp = Number(it.expectedQuantity || 0);
                            const rate = Number(it.purchasePrice || 0);
                            acc.good += good;
                            acc.damaged += damaged;
                            acc.shortage += Math.max(0, exp - good - damaged);
                            acc.value += good * rate;
                            if (good + damaged > exp) acc.hasError = true;
                            return acc;
                          },
                          { good: 0, damaged: 0, shortage: 0, value: 0, hasError: false }
                        );

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Live Good Units</span>
                              <p className="text-sm font-black text-emerald-700 mt-0.5">+{totals.good} Units</p>
                              <span className="text-[9px] text-slate-400">Credited to inventory</span>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Live Damaged</span>
                              <p className="text-sm font-black text-red-600 mt-0.5">{totals.damaged} Units</p>
                              <span className="text-[9px] text-slate-400">Quarantined</span>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Live Shortage</span>
                              <p className="text-sm font-black text-amber-700 mt-0.5">{totals.shortage} Missing</p>
                              <span className="text-[9px] text-slate-400">Not received</span>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-teal-200 bg-teal-50/30">
                              <span className="text-[10px] font-bold text-teal-800 uppercase">Verified Value (Auto)</span>
                              <p className="text-sm font-black text-teal-900 mt-0.5">
                                ₹{totals.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <span className="text-[9px] text-teal-700">Calculated from good units</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Inspector Receiving Notes (Optional)
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {500 - grnNotes.length} chars left
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={500}
                          placeholder="e.g. Shipment received at Dock 2. Outer packaging sealed; physical barcodes scanned."
                          value={grnNotes}
                          onChange={(e) => setGrnNotes(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white resize-none focus:outline-none focus:border-teal-700"
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Summary Callout & Commit Action */}
                  {inspectData.status === 'IN_TRANSIT' && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-teal-900">Atomic Stock Commitment & Digital GRN</h4>
                        <p className="text-[11px] text-teal-700 mt-0.5">
                          Clicking "Finalize GRN" will credit verified stock to live inventory and auto-generate the official digital GRN PDF.
                        </p>
                      </div>
                      {(() => {
                        const hasAnyError = (inspectData.items || []).some((it: InboundShipmentItem) => {
                          const qc = qcItems[it.inboundShipmentItemId] || { receivedQuantity: 0, damagedQuantity: 0 };
                          return Number(qc.receivedQuantity || 0) + Number(qc.damagedQuantity || 0) > Number(it.expectedQuantity || 0);
                        });

                        return (
                          <button
                            type="submit"
                            disabled={submittingGRN || hasAnyError}
                            className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap ${
                              hasAnyError
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'text-white bg-teal-700 hover:bg-teal-800'
                            }`}
                          >
                            {submittingGRN ? 'Generating Digital GRN...' : hasAnyError ? 'Fix Quantity Errors Above' : 'Finalize GRN & Post Stock'}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </>
              ) : null}
            </form>

            {/* Modal Footer (Read-only close + View GRN) */}
            {inspectData?.status !== 'IN_TRANSIT' && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
                {(inspectData?.status === 'RECEIVED' || inspectData?.status === 'DISCREPANCY') ? (
                  <button
                    type="button"
                    onClick={() => handlePreviewGrn(inspectData.inboundShipmentId, inspectData.grnNumber)}
                    disabled={loadingGrnPreviewId === inspectData.inboundShipmentId}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4 text-teal-700" />
                    <span>{loadingGrnPreviewId === inspectData.inboundShipmentId ? 'Loading PDF...' : 'View Official GRN (PDF)'}</span>
                  </button>
                ) : <div />}
                <button
                  type="button"
                  onClick={() => setInspectingShipmentId(null)}
                  className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: GRN SUCCESS RECEIPT POPUP */}
      {grnSuccessResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-900">GRN Generated Successfully!</h2>
              <p className="text-xs font-mono font-bold text-teal-700 mt-1">
                {grnSuccessResult.grnNumber}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Shipment Number:</span>
                <span className="font-bold text-slate-800">{grnSuccessResult.shipmentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Good Units Credited:</span>
                <span className="font-black text-emerald-700">
                  +{grnSuccessResult.totalGoodUnitsAdded} Units
                </span>
              </div>
              {grnSuccessResult.totalDamagedUnits > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Damaged Stock Logged:</span>
                  <span className="font-bold text-red-600">
                    {grnSuccessResult.totalDamagedUnits} Units
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Final Status:</span>
                {renderStatusBadge(grnSuccessResult.status)}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handlePreviewGrn(grnSuccessResult.shipmentId, grnSuccessResult.grnNumber)}
                disabled={loadingGrnPreviewId === grnSuccessResult.shipmentId}
                className="w-full py-2.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Eye className="w-4 h-4 text-teal-700" />
                <span>{loadingGrnPreviewId === grnSuccessResult.shipmentId ? 'Loading PDF...' : 'View Official GRN Document'}</span>
              </button>

              <button
                type="button"
                onClick={() => setGrnSuccessResult(null)}
                className="w-full py-2.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-md transition-all active:scale-95"
              >
                Done & Return to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DIGITAL GRN DOCUMENT PREVIEW MODAL */}
      {grnPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[80vh] max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Preview Header */}
            <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm transition-all"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
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
                  className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Official GRN PDF Viewer */}
            <div className="flex-1 bg-slate-100/60 p-3 sm:p-4 overflow-hidden flex items-center justify-center">
              {grnPreview.pdfUrl ? (
                <iframe
                  src={grnPreview.pdfUrl}
                  className="w-full h-full rounded-2xl bg-white shadow-xs border border-slate-200"
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
