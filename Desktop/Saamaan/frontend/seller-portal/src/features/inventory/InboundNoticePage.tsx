import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send,
  Package,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Search,
  Check,
  ChevronDown,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface ProductWarehouseAssignment {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  availableQuantity: number;
  isPrimary?: boolean;
}

interface EligibleProduct {
  sellerProductId: string;
  productId: string;
  sellerSku: string;
  productTitle: string;
  brandName: string;
  categoryName: string;
  sellingPrice: number;
  mrp: number;
  primaryImage: string | null;
  totalAvailableStock: number;
  warehouses: ProductWarehouseAssignment[];
}

interface EligibleWarehouse {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  city: string;
  state?: string;
  warehouseType?: string;
  isPrimary?: boolean;
}

export const InboundNoticePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [products, setProducts] = useState<EligibleProduct[]>([]);
  const [warehouses, setWarehouses] = useState<EligibleWarehouse[]>([]);

  // Product search & picker state
  const [productSearch, setProductSearch] = useState('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [inboundQuantity, setInboundQuantity] = useState<number>(25);
  const [inboundReason, setInboundReason] = useState<string>('Stock replenishment');

  // Optional Tracking Metadata
  const [poNumber, setPoNumber] = useState<string>('');
  const [poAmount, setPoAmount] = useState<string>('');
  const [grnNumber, setGrnNumber] = useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        // Fetch products and warehouses concurrently using allSettled to ensure neither blocks the other
        const [prodResult, whResult, sellerWhResult] = await Promise.allSettled([
          apiClient.get('/seller/catalog/products'),
          apiClient.get('/seller/catalog/eligible-warehouses'),
          apiClient.get('/seller/warehouses'),
        ]);

        if (!isMounted) return;

        // 1. Parse Products safely
        let rawProducts: any[] = [];
        if (prodResult.status === 'fulfilled') {
          const resData = prodResult.value.data;
          if (Array.isArray(resData?.data)) {
            rawProducts = resData.data;
          } else if (Array.isArray(resData?.data?.items)) {
            rawProducts = resData.data.items;
          } else if (Array.isArray(resData)) {
            rawProducts = resData;
          } else if (Array.isArray(resData?.items)) {
            rawProducts = resData.items;
          }
        } else {
          console.error('Failed to load seller catalog products:', prodResult.reason);
        }

        const mappedProducts: EligibleProduct[] = rawProducts.map((p: any) => {
          const pWarehouses: ProductWarehouseAssignment[] = Array.isArray(p.warehouses)
            ? p.warehouses.map((w: any) => ({
                warehouseId: String(w.warehouseId || w.WarehouseID || ''),
                warehouseName: String(w.warehouseName || w.WarehouseName || 'Warehouse'),
                warehouseCode: String(w.warehouseCode || w.WarehouseCode || ''),
                availableQuantity: Number(w.availableQuantity ?? w.AvailableQuantity ?? 0),
                isPrimary: Boolean(w.isPrimary ?? w.IsPrimary),
              }))
            : [];

          const totalAvail =
            p.stockSummary?.totalAvailableStock ??
            pWarehouses.reduce((acc, curr) => acc + curr.availableQuantity, 0);

          return {
            sellerProductId: String(p.sellerProductId || p.SellerProductID || p.id || ''),
            productId: String(p.product?.productId || p.ProductID || ''),
            sellerSku: String(p.sellerSku || p.SellerSKU || ''),
            productTitle: String(
              p.product?.productName ||
                p.productName ||
                p.ProductTitle ||
                p.ProductName ||
                p.product?.parentSku ||
                p.sellerSku ||
                'Product'
            ),
            brandName: String(p.product?.brandName || p.BrandName || ''),
            categoryName: String(p.product?.categoryName || p.CategoryName || ''),
            sellingPrice: Number(p.sellingPrice ?? p.SellingPrice ?? 0),
            mrp: Number(p.mrp ?? p.MRP ?? 0),
            primaryImage: p.product?.primaryImage || p.primaryImage || p.PrimaryImage || null,
            totalAvailableStock: Number(totalAvail),
            warehouses: pWarehouses,
          };
        });

        setProducts(mappedProducts);

        // 2. Parse Warehouses safely (with fallback to /seller/warehouses and product-embedded warehouses)
        const warehouseMap = new Map<string, EligibleWarehouse>();

        // Check eligible-warehouses response
        if (whResult.status === 'fulfilled') {
          const rawWh = Array.isArray(whResult.value.data?.data)
            ? whResult.value.data.data
            : Array.isArray(whResult.value.data?.data?.items)
            ? whResult.value.data.data.items
            : [];

          rawWh.forEach((w: any) => {
            const id = String(w.warehouseId || w.WarehouseID || w.id || '');
            if (id && !warehouseMap.has(id)) {
              warehouseMap.set(id, {
                warehouseId: id,
                warehouseName: String(w.warehouseName || w.WarehouseName || w.name || 'Warehouse'),
                warehouseCode: String(w.warehouseCode || w.WarehouseCode || w.code || ''),
                city: String(w.city || w.City || ''),
                state: String(w.state || w.State || ''),
                warehouseType: String(w.warehouseType || w.WarehouseType || ''),
                isPrimary: Boolean(w.isPrimary ?? w.IsPrimary),
              });
            }
          });
        }

        // Check /seller/warehouses fallback
        if (sellerWhResult.status === 'fulfilled') {
          const rawSellerWh = Array.isArray(sellerWhResult.value.data?.data)
            ? sellerWhResult.value.data.data
            : [];

          rawSellerWh.forEach((sw: any) => {
            const id = String(sw.warehouseId || sw.WarehouseID || sw.warehouse?.warehouseId || '');
            if (id && !warehouseMap.has(id)) {
              warehouseMap.set(id, {
                warehouseId: id,
                warehouseName: String(sw.warehouseName || sw.WarehouseName || sw.warehouse?.warehouseName || 'Warehouse'),
                warehouseCode: String(sw.warehouseCode || sw.WarehouseCode || sw.warehouse?.warehouseCode || ''),
                city: String(sw.city || sw.City || sw.warehouse?.city || ''),
                state: String(sw.state || sw.State || sw.warehouse?.state || ''),
                warehouseType: String(sw.warehouseType || sw.WarehouseType || ''),
                isPrimary: Boolean(sw.isPrimary ?? sw.IsPrimary),
              });
            }
          });
        }

        // Fallback: Also gather any warehouses attached directly to the products
        mappedProducts.forEach((p) => {
          p.warehouses.forEach((pw) => {
            if (pw.warehouseId && !warehouseMap.has(pw.warehouseId)) {
              warehouseMap.set(pw.warehouseId, {
                warehouseId: pw.warehouseId,
                warehouseName: pw.warehouseName,
                warehouseCode: pw.warehouseCode,
                city: '',
                isPrimary: pw.isPrimary,
              });
            }
          });
        });

        const mappedWarehouses = Array.from(warehouseMap.values());
        setWarehouses(mappedWarehouses);

        // 3. Resolve initial selection smartly
        const queryProductId = searchParams.get('productId') || searchParams.get('sellerProductId');
        const queryWarehouseId = searchParams.get('warehouseId');

        let matchedProduct = mappedProducts.find(
          (p) =>
            p.sellerProductId === queryProductId ||
            p.productId === queryProductId ||
            p.sellerSku === queryProductId
        );

        if (!matchedProduct && mappedProducts.length > 0) {
          matchedProduct = mappedProducts[0];
        }

        if (matchedProduct) {
          setSelectedProductId(matchedProduct.sellerProductId);

          // Find suitable warehouse for this product
          let defaultWhId = queryWarehouseId || '';
          if (!defaultWhId || !mappedWarehouses.some((w) => w.warehouseId === defaultWhId)) {
            // Prioritize warehouse already assigned to this product
            if (matchedProduct.warehouses.length > 0) {
              const primaryAssigned = matchedProduct.warehouses.find((w) => w.isPrimary);
              defaultWhId = primaryAssigned ? primaryAssigned.warehouseId : matchedProduct.warehouses[0].warehouseId;
            } else if (mappedWarehouses.length > 0) {
              const primaryWh = mappedWarehouses.find((w) => w.isPrimary);
              defaultWhId = primaryWh ? primaryWh.warehouseId : mappedWarehouses[0].warehouseId;
            }
          }
          if (defaultWhId) {
            setSelectedWarehouseId(defaultWhId);
          }
        }
      } catch (err: any) {
        console.error('Failed to load inbound form data', err);
        setErrorMessage('Unable to load catalog data. Please check your connection and refresh.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // Handle product selection change
  const handleSelectProduct = (sellerProductId: string) => {
    setSelectedProductId(sellerProductId);
    setIsProductPickerOpen(false);

    const product = products.find((p) => p.sellerProductId === sellerProductId);
    if (product && product.warehouses.length > 0) {
      // If currently selected warehouse is not assigned to this product, default to an assigned warehouse
      const isCurrentAssigned = product.warehouses.some((w) => w.warehouseId === selectedWarehouseId);
      if (!isCurrentAssigned) {
        const primary = product.warehouses.find((w) => w.isPrimary);
        setSelectedWarehouseId(primary ? primary.warehouseId : product.warehouses[0].warehouseId);
      }
    }
  };

  const selectedProductObj = useMemo(
    () => products.find((p) => p.sellerProductId === selectedProductId),
    [products, selectedProductId]
  );

  const selectedWarehouseObj = useMemo(
    () => warehouses.find((w) => w.warehouseId === selectedWarehouseId),
    [warehouses, selectedWarehouseId]
  );

  // Filtered products for search dropdown
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.productTitle.toLowerCase().includes(q) ||
        p.sellerSku.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProductId) {
      alert('Please select a product from your catalog');
      return;
    }
    if (!selectedWarehouseId) {
      alert('Please select a destination warehouse');
      return;
    }
    if (inboundQuantity <= 0) {
      alert('Quantity must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/seller/inventory/inbound', {
        sellerProductId: selectedProductId,
        warehouseId: selectedWarehouseId,
        quantity: inboundQuantity,
        reason: inboundReason || undefined,
        poNumber: poNumber.trim() || undefined,
        poAmount: poAmount ? parseFloat(poAmount) : undefined,
        grnNumber: grnNumber.trim() || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : undefined,
      });

      setSuccess(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to submit stock shipment';
      setErrorMessage(msg);
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 max-w-xl mx-auto my-12 text-center bg-white rounded-xl border border-[#E8E1D7] p-8 shadow-sm animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-stone-900">Stock Sent Successfully!</h2>
        <p className="text-xs text-stone-600 mt-2 max-w-md mx-auto leading-relaxed">
          <strong className="text-emerald-700">+{inboundQuantity} units</strong> have been recorded for{' '}
          <strong>{selectedProductObj?.productTitle}</strong> at{' '}
          <strong>{selectedWarehouseObj?.warehouseName || 'Warehouse'}</strong>.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              setSuccess(false);
              setInboundQuantity(25);
            }}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold rounded-2xl border border-[#E8E1D7] hover:bg-stone-50 text-stone-700 transition-colors"
          >
            Send Another Shipment
          </button>
          <button
            onClick={() => navigate('/inventory')}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-2xl shadow-md transition-all active:scale-95"
          >
            View Stock by Warehouse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Quick Action Link to other pages */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/inventory')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-bold text-stone-600 hover:text-stone-900 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Stock Overview
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-6 border border-[#ECE5DC] shadow-xs space-y-5">
          <div className="h-4 w-40 shimmer rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-3 w-28 shimmer rounded" />
              <div className="h-10 shimmer rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-32 shimmer rounded" />
              <div className="h-10 shimmer rounded-xl" />
            </div>
          </div>
          <div className="h-28 shimmer rounded-xl" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl p-10 border border-[#E8E1D7] text-center space-y-3 shadow-sm">
          <Package className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="text-sm font-bold text-stone-800">No Listed Products Available</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            You must have at least one approved listed product in your catalog before you can send stock.
          </p>
          <button
            onClick={() => navigate('/products/add-existing')}
            className="px-5 py-2 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-2xl shadow-sm transition-all"
          >
            List a Product First
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Item & Facility */}
          <div className="bg-white rounded-xl p-6 border border-[#E8E1D7] shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#7E2532]" />
                1. Select Product & Destination Warehouse
              </h3>
              <span className="text-[11px] font-semibold text-stone-500">
                {products.length} {products.length === 1 ? 'Product' : 'Products'} Listed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Product Picker */}
              <div className="relative">
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Select Product *
                </label>

                {/* Interactive Combobox / Dropdown Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProductPickerOpen(!isProductPickerOpen)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6] text-stone-800 font-medium flex items-center justify-between text-left hover:border-stone-400 transition-colors"
                  >
                    <div className="truncate pr-2">
                      {selectedProductObj ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 truncate">
                            {selectedProductObj.productTitle}
                          </span>
                          <span className="text-[10px] text-stone-500 font-mono bg-stone-200/60 px-1.5 py-0.5 rounded">
                            {selectedProductObj.sellerSku}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-400">-- Choose a product ({products.length} available) --</span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                  </button>

                  {/* Dropdown Menu with Search */}
                  {isProductPickerOpen && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-[#E8E1D7] shadow-xl p-2 space-y-2 animate-in fade-in-50 duration-150">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search product title or SKU..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E8E1D7] focus:outline-none focus:ring-1 focus:ring-[#641D26] bg-[#FBF9F6]"
                        />
                      </div>

                      {/* Product Options List */}
                      <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-stone-100">
                        {filteredProducts.length === 0 ? (
                          <div className="p-4 text-center text-xs text-stone-400">
                            No products match "{productSearch}"
                          </div>
                        ) : (
                          filteredProducts.map((p) => {
                            const isSelected = p.sellerProductId === selectedProductId;
                            return (
                              <button
                                key={p.sellerProductId}
                                type="button"
                                onClick={() => handleSelectProduct(p.sellerProductId)}
                                className={`w-full p-2.5 rounded-xl text-left transition-colors flex items-center justify-between gap-3 ${
                                  isSelected ? 'bg-rose-50/70 border border-rose-200' : 'hover:bg-stone-50'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-stone-900 truncate">
                                      {p.productTitle}
                                    </span>
                                    {p.brandName && (
                                      <span className="text-[10px] text-stone-500 font-medium">
                                        • {p.brandName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                                    <span className="font-mono text-stone-600">{p.sellerSku}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-emerald-700">₹{p.sellingPrice}</span>
                                    <span>•</span>
                                    <span className="text-stone-400">{p.totalAvailableStock} in stock</span>
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#7E2532] shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Native Select fallback for browser accessibility */}
                <select
                  aria-label="Select Product"
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                >
                  <option value="">-- Choose from your listed products --</option>
                  {products.map((p) => (
                    <option key={p.sellerProductId} value={p.sellerProductId}>
                      {p.productTitle} ({p.sellerSku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse Picker */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Destination Warehouse * ({warehouses.length} available)
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6] text-stone-800 font-medium appearance-none cursor-pointer pr-10"
                  >
                    <option value="">-- Choose destination warehouse --</option>
                    {warehouses.map((w) => {
                      const isLinked = selectedProductObj?.warehouses.some((pw) => pw.warehouseId === w.warehouseId);
                      return (
                        <option key={w.warehouseId} value={w.warehouseId}>
                          {w.warehouseName} ({w.warehouseCode}){w.city ? ` - ${w.city}` : ''}
                          {isLinked ? ' [Currently Assigned]' : ''}
                          {w.isPrimary ? ' (Primary)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <Building2 className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Selected Product Snapshot Card */}
            {selectedProductObj && (
              <div className="p-4 bg-[#FBF9F6] rounded-2xl border border-[#E8E1D7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E1D7] flex items-center justify-center overflow-hidden shrink-0">
                    {selectedProductObj.primaryImage ? (
                      <img
                        src={selectedProductObj.primaryImage}
                        alt={selectedProductObj.productTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-stone-300" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#7E2532] uppercase tracking-wider block">
                      Active Catalog Item
                    </span>
                    <div className="font-bold text-stone-900 text-sm">{selectedProductObj.productTitle}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-stone-500 font-mono text-[11px]">
                      <span>SKU: {selectedProductObj.sellerSku}</span>
                      {selectedProductObj.brandName && (
                        <>
                          <span>•</span>
                          <span className="font-sans font-medium text-stone-600">{selectedProductObj.brandName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-200">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Current Units
                    </span>
                    <div className="font-black text-stone-800 text-sm">
                      {selectedProductObj.totalAvailableStock}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Selling Price
                    </span>
                    <div className="font-black text-stone-900 text-base">
                      ₹{selectedProductObj.sellingPrice}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Inbound Quantity */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Stock Units to Add *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={inboundQuantity}
                  onChange={(e) => setInboundQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
                {/* Quick Add Presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-semibold text-stone-400">Quick set:</span>
                  {[10, 25, 50, 100, 250].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInboundQuantity(preset)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                        inboundQuantity === preset
                          ? 'bg-[#641D26] text-white border-[#641D26]'
                          : 'bg-white text-stone-600 border-[#E8E1D7] hover:bg-stone-100'
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Notes */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Shipment Note / Reason
                </label>
                <input
                  type="text"
                  value={inboundReason}
                  onChange={(e) => setInboundReason(e.target.value)}
                  placeholder="e.g. Regular weekly restock"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Logged in your inventory stock ledger for internal tracking.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Optional Tracking Numbers */}
          <div className="bg-white rounded-xl p-6 border border-[#E8E1D7] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#7E2532]" />
                2. Optional Tracking & Invoice Details
              </h3>
              <span className="text-[10px] font-semibold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md">
                Optional
              </span>
            </div>

            <p className="text-xs text-stone-500">
              You can optionally record purchase orders or supplier invoice numbers here. If not applicable, you can leave these empty.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  PO Number
                </label>
                <input
                  type="text"
                  placeholder="PO-8812"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  PO Amount (₹)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={poAmount}
                  onChange={(e) => setPoAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  GRN Number
                </label>
                <input
                  type="text"
                  placeholder="GRN-2026-0812"
                  value={grnNumber}
                  onChange={(e) => setGrnNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  Supplier Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="INV-9021"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  Invoice Amount (₹)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] bg-[#FBF9F6]"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="px-5 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProductId || !selectedWarehouseId}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#641D26] hover:bg-[#52161E] rounded-2xl shadow-md shadow-rose-950/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending Stock...' : 'Confirm & Send Stock'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
