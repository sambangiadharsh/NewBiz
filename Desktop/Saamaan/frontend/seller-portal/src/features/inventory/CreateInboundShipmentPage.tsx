import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Package,
  Trash2,
  Building2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showAlert } from '../../lib/swal.js';

interface WarehouseInfo {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  city: string;
}

interface ProductAttribute {
  attributeName: string;
  attributeValue: string;
}

interface CatalogProduct {
  sellerProductId: string;
  sellerSku: string;
  productTitle: string;
  brandName: string;
  categoryName: string;
  primaryImage: string | null;
  attributes: ProductAttribute[];
  availableStock: number;
  stockStatus: string;
  sellingPrice: number;
}

interface SelectedItem {
  sellerProductId: string;
  quantity: number;
  remarks: string;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const CreateInboundShipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectWhId = searchParams.get('warehouseId');
  const preselectSpId = searchParams.get('sellerProductId');

  // Reference data
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form: Logistics
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');
  const [carrierName, setCarrierName] = useState<string>('Delhivery Surface');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [boxCount, setBoxCount] = useState<number>(1);
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Form: Selected Items
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Form: Optional Invoice & PO Details
  const [showOptionalDocs, setShowOptionalDocs] = useState<boolean>(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');
  const [invoiceDocUrl, setInvoiceDocUrl] = useState<string>('');
  const [uploadingInvoice, setUploadingInvoice] = useState<boolean>(false);

  const [poNumber, setPoNumber] = useState<string>('');
  const [poAmount, setPoAmount] = useState<string>('');
  const [poDocUrl, setPoDocUrl] = useState<string>('');
  const [uploadingPo, setUploadingPo] = useState<boolean>(false);

  // Picker Modal State
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch Warehouses and Catalog
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [whRes, prodRes] = await Promise.allSettled([
          apiClient.get('/seller/warehouses'),
          apiClient.get('/seller/catalog/products'),
        ]);

        if (!isMounted) return;

        // Parse Warehouses
        if (whRes.status === 'fulfilled' && whRes.value.data?.data) {
          const rawWh = Array.isArray(whRes.value.data.data) ? whRes.value.data.data : [];
          const parsedWh: WarehouseInfo[] = rawWh.map((w: any) => ({
            warehouseId: String(w.warehouseId || w.WarehouseID),
            warehouseName: w.warehouseName || w.WarehouseName || 'Warehouse',
            warehouseCode: w.warehouseCode || w.WarehouseCode || '',
            city: w.city || w.City || '',
          }));
          setWarehouses(parsedWh);
          if (preselectWhId && parsedWh.some((w) => w.warehouseId === preselectWhId)) {
            setDestinationWarehouseId(preselectWhId);
          } else if (parsedWh.length > 0 && !destinationWarehouseId) {
            setDestinationWarehouseId(parsedWh[0].warehouseId);
          }
        }

        // Parse Catalog
        if (prodRes.status === 'fulfilled' && prodRes.value.data?.data) {
          const rawProds = Array.isArray(prodRes.value.data.data) ? prodRes.value.data.data : [];
          const parsedCatalog: CatalogProduct[] = rawProds.map((p: any) => {
            const rawImg =
              p.product?.primaryImage ||
              p.primaryImage ||
              p.image ||
              p.product?.image ||
              (Array.isArray(p.product?.assets) && (p.product.assets[0]?.AssetURL || p.product.assets[0]?.assetUrl || p.product.assets[0]?.url)) ||
              (Array.isArray(p.assets) && (p.assets[0]?.AssetURL || p.assets[0]?.assetUrl || p.assets[0]?.url)) ||
              null;

            return {
              sellerProductId: String(p.sellerProductId),
              sellerSku: p.sellerSku || '',
              productTitle: p.product?.productName || p.productTitle || 'Product',
              brandName: p.product?.brandName || 'Brand',
              categoryName: p.product?.categoryName || 'General',
              primaryImage: rawImg,
              attributes: Array.isArray(p.product?.attributes) ? p.product.attributes : [],
              availableStock: Number(p.stockSummary?.totalAvailableStock || 0),
              stockStatus: p.stockSummary?.stockStatus || 'IN_STOCK',
              sellingPrice: Number(p.sellingPrice || 0),
            };
          });
          setCatalog(parsedCatalog);

          // Auto-select product from URL if passed from restock alerts
          if (preselectSpId && parsedCatalog.some((p) => p.sellerProductId === preselectSpId)) {
            setSelectedItems([{ sellerProductId: preselectSpId, quantity: 25, remarks: 'Restock Alert Replenishment' }]);
          }
        }
      } catch (err) {
        console.error('Failed to load creation data', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered Catalog for Picker
  const filteredCatalog = useMemo(() => {
    if (!pickerSearch.trim()) return catalog;
    const q = pickerSearch.toLowerCase().trim();
    return catalog.filter(
      (p) =>
        p.productTitle.toLowerCase().includes(q) ||
        p.sellerSku.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.attributes.some((a) => a.attributeValue.toLowerCase().includes(q))
    );
  }, [catalog, pickerSearch]);

  // Selection actions
  const handleToggleProduct = (sellerProductId: string) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.sellerProductId === sellerProductId);
      if (exists) {
        return prev.filter((i) => i.sellerProductId !== sellerProductId);
      } else {
        return [...prev, { sellerProductId, quantity: 25, remarks: '' }];
      }
    });
  };

  const handleUpdateQty = (sellerProductId: string, deltaOrValue: number, isAbsolute: boolean = false) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.sellerProductId !== sellerProductId) return item;
        const newQty = isAbsolute ? deltaOrValue : item.quantity + deltaOrValue;
        return { ...item, quantity: Math.max(1, newQty) };
      })
    );
  };

  const handleRemoveProduct = (sellerProductId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.sellerProductId !== sellerProductId));
  };

  // Document Uploaders
  const handleUploadInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingInvoice(true);
    try {
      const res = await apiClient.post('/seller/inbound-shipments/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.data?.url) {
        setInvoiceDocUrl(res.data.data.url);
      }
    } catch (err: any) {
      showAlert('Upload Failed', err.response?.data?.message || 'Failed to upload invoice document', 'error');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleUploadPo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingPo(true);
    try {
      const res = await apiClient.post('/seller/inbound-shipments/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.data?.url) {
        setPoDocUrl(res.data.data.url);
      }
    } catch (err: any) {
      showAlert('Upload Failed', err.response?.data?.message || 'Failed to upload PO document', 'error');
    } finally {
      setUploadingPo(false);
    }
  };

  // Calculations
  const totalUnits = useMemo(() => {
    return selectedItems.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [selectedItems]);

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationWarehouseId) {
      showAlert('Selection Required', 'Please select a destination warehouse', 'warning');
      return;
    }
    if (selectedItems.length === 0) {
      showAlert('Selection Required', 'Please add at least one product item to send', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        warehouseId: destinationWarehouseId,
        carrierName: carrierName.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        boxCount: Number(boxCount) || 1,
        estimatedArrivalDate: estimatedArrivalDate || undefined,
        notes: notes.trim() || undefined,
        poNumber: poNumber.trim() || undefined,
        poAmount: poAmount ? parseFloat(poAmount) : undefined,
        poDocumentUrl: poDocUrl || undefined,
        supplierInvoiceNumber: invoiceNumber.trim() || undefined,
        invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : undefined,
        invoiceDocumentUrl: invoiceDocUrl || undefined,
        items: selectedItems.map((i) => ({
          sellerProductId: i.sellerProductId,
          expectedQuantity: i.quantity,
          remarks: i.remarks || undefined,
        })),
      };

      const res = await apiClient.post('/seller/inbound-shipments', payload);
      if (res.data?.success) {
        await showAlert(
          'Shipment Dispatched!',
          `Inbound Shipment #${res.data.data.shipmentNumber} has been dispatched successfully.`,
          'success'
        );
        navigate('/inventory/inbound');
      }
    } catch (err: any) {
      showAlert('Dispatch Failed', err.response?.data?.message || 'Failed to dispatch shipment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-28 space-y-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/inventory/inbound')}
          className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbound Shipments
        </button>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-stone-100 text-stone-600">
          Shipment Builder (ASN)
        </span>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#641D26] text-white flex items-center justify-center shadow-md shadow-[#641D26]/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-stone-900 tracking-tight">Create Inbound Shipment</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Declare destination warehouse, add products with visual variant details, and enter courier details.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: DESTINATION & LOGISTICS */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Building2 className="w-4 h-4 text-[#641D26]" />
            <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
              1. Destination Warehouse & Logistics
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Destination Warehouse *
              </label>
              <select
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26] font-medium"
              >
                <option value="">Select Warehouse...</option>
                {warehouses.map((wh) => (
                  <option key={wh.warehouseId} value={wh.warehouseId}>
                    {wh.warehouseName} ({wh.warehouseCode}) - {wh.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Carrier / Transport *</label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Delhivery, BlueDart, Own Vehicle"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Tracking # / AWB</label>
              <input
                type="text"
                maxLength={100}
                placeholder="e.g. DEL-88992"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Number of Boxes</label>
              <input
                type="number"
                min="1"
                max="5000"
                value={boxCount}
                onChange={(e) => setBoxCount(Math.min(5000, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Estimated Arrival Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={estimatedArrivalDate}
                onChange={(e) => setEstimatedArrivalDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PRODUCTS TO SEND (VISUAL SELECTOR) */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#641D26]" />
              <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                2. Products for Inbound ({selectedItems.length} SKUs Selected)
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] disabled:opacity-50 shadow-sm transition-all active:scale-95"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Browse & Add Products
            </button>
          </div>

          {/* List of Added Product Cards */}
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#641D26] mx-auto" />
              <p className="text-xs font-semibold text-stone-500">Loading catalog products...</p>
            </div>
          ) : selectedItems.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-stone-200 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">No products added yet</p>
                <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
                  Click the button below to browse your catalog and select products to dispatch to the warehouse.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#641D26] bg-[#641D26]/10 hover:bg-[#641D26]/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Select Products from Catalog
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedItems.map((item) => {
                const prod = catalog.find((p) => p.sellerProductId === item.sellerProductId);
                if (!prod) return null;

                return (
                  <div
                    key={item.sellerProductId}
                    className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    {/* Product Visual Identity */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                        <Package className="w-7 h-7 text-stone-400" />
                        {prod.primaryImage && (
                          <img
                            src={getImagePreviewUrl(prod.primaryImage)}
                            alt={prod.productTitle}
                            className="w-full h-full object-cover absolute inset-0 bg-white"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            {prod.brandName}
                          </span>
                          <span className="text-[10px] font-mono font-semibold text-stone-500">
                            SKU: {prod.sellerSku}
                          </span>
                        </div>

                        <h3 className="text-xs font-extrabold text-stone-900 truncate max-w-md">
                          {prod.productTitle}
                        </h3>

                        {/* Variant Attributes Pills */}
                        {prod.attributes.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {prod.attributes.map((attr, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-stone-700"
                              >
                                <strong>{attr.attributeName}:</strong> {attr.attributeValue}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-stone-500">
                          Current Stock:{' '}
                          <span
                            className={
                              prod.availableStock > 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'
                            }
                          >
                            {prod.availableStock} units available
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Numeric Quantity Stepper & Remove */}
                    <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                      <div className="flex items-center gap-1.5 bg-stone-50 p-1.5 rounded-2xl border border-stone-200">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.sellerProductId, -1)}
                          className="w-8 h-8 rounded-xl bg-white border border-stone-200 text-stone-700 font-bold flex items-center justify-center hover:bg-stone-100 active:scale-95"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQty(
                              item.sellerProductId,
                              parseInt(e.target.value, 10) || 1,
                              true
                            )
                          }
                          className="w-16 px-2 py-1 text-center font-black text-xs bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.sellerProductId, 1)}
                          className="w-8 h-8 rounded-xl bg-white border border-stone-200 text-stone-700 font-bold flex items-center justify-center hover:bg-stone-100 active:scale-95"
                        >
                          +
                        </button>
                      </div>

                      {/* Quick Qty Chips */}
                      <div className="hidden sm:flex items-center gap-1">
                        {[10, 25, 50].map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleUpdateQty(item.sellerProductId, step)}
                            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600"
                          >
                            +{step}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(item.sellerProductId)}
                        className="p-2 text-stone-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                        title="Remove from shipment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: OPTIONAL INVOICE & PO DETAILS (COLLAPSIBLE) */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOptionalDocs(!showOptionalDocs)}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#641D26]" />
              <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                3. Invoice & Purchase Order Information (Optional)
              </h2>
            </div>
            {showOptionalDocs ? (
              <ChevronUp className="w-4 h-4 text-stone-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-stone-400" />
            )}
          </button>

          {showOptionalDocs && (
            <div className="p-6 pt-0 border-t border-stone-100 space-y-4">
              {/* Invoice Information */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <span className="text-xs font-bold text-stone-800">Invoice Information (Optional)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-9902"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Invoice Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 35000.00"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Attach Invoice File (PDF, Image)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 transition-all">
                      <span>{uploadingInvoice ? 'Uploading...' : 'Choose File...'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={handleUploadInvoice}
                        disabled={uploadingInvoice}
                        className="hidden"
                      />
                    </label>
                    {invoiceDocUrl ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-400">No file chosen</span>
                    )}
                  </div>
                </div>
              </div>

              {/* PO Information */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <span className="text-xs font-bold text-stone-800">Purchase Order (PO) Details (Optional)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">PO Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2026-11"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">PO Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 50000.00"
                      value={poAmount}
                      onChange={(e) => setPoAmount(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Attach PO File (PDF, Image)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 transition-all">
                      <span>{uploadingPo ? 'Uploading...' : 'Choose File...'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={handleUploadPo}
                        disabled={uploadingPo}
                        className="hidden"
                      />
                    </label>
                    {poDocUrl ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-400">No file chosen</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700">
                    Shipment Remarks / Notes (Optional)
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {500 - notes.length} chars left
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. Fragile glassware inside carton 2; please handle with care."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 resize-none focus:outline-none focus:border-[#641D26]"
                />
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM STICKY ACTION BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-200 p-4 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Summary
                </span>
                <div className="text-xs font-black text-stone-900">
                  {selectedItems.length} Products •{' '}
                  <span className="text-[#641D26]">{totalUnits} Total Units</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/inventory/inbound')}
                className="px-5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || selectedItems.length === 0}
                className="px-6 py-2.5 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Dispatching Shipment...' : 'Confirm & Dispatch Shipment'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* MODAL: BROWSE CATALOG PRODUCT PICKER */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div>
                <h3 className="text-sm font-black text-stone-900">Select Products from Catalog</h3>
                <p className="text-xs text-stone-500">
                  Click "+ Add" to add products to your inbound shipment.
                </p>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-stone-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by product name, SKU, brand, or variant color/size..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26]"
                  autoFocus
                />
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredCatalog.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No products found matching "{pickerSearch}".
                </div>
              ) : (
                filteredCatalog.map((prod) => {
                  const isSelected = selectedItems.some(
                    (i) => i.sellerProductId === prod.sellerProductId
                  );

                  return (
                    <div
                      key={prod.sellerProductId}
                      onClick={() => handleToggleProduct(prod.sellerProductId)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-[#641D26] bg-[#641D26]/5 shadow-sm'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                          <Package className="w-6 h-6 text-stone-400" />
                          {prod.primaryImage && (
                            <img
                              src={getImagePreviewUrl(prod.primaryImage)}
                              alt={prod.productTitle}
                              className="w-full h-full object-cover absolute inset-0 bg-white"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-stone-500">
                              {prod.brandName}
                            </span>
                            <span className="text-[10px] font-mono text-stone-400">
                              SKU: {prod.sellerSku}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 truncate">
                            {prod.productTitle}
                          </h4>

                          {/* Variant Pills */}
                          {prod.attributes.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {prod.attributes.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-700"
                                >
                                  {attr.attributeName}: {attr.attributeValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[11px] text-stone-500 font-medium">
                          Stock: {prod.availableStock}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleProduct(prod.sellerProductId);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-[#641D26] text-white'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          }`}
                        >
                          {isSelected ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Added
                            </span>
                          ) : (
                            '+ Add'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-200 flex items-center justify-between bg-stone-50/50">
              <span className="text-xs font-bold text-stone-700">
                {selectedItems.length} Products Selected
              </span>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-xl shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

