import React, { useState, useEffect } from 'react';
import {
  X,
  Warehouse,
  MapPin,
  User,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Link2,
  Search,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { NoResults } from '../../components/common/NoResults.js';

interface Available3PLWarehouse {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: string;
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  status: string;
  connectedSellersCount: number;
  totalProductsCount: number;
  connectionStatus: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'TERMINATED' | 'NOT_CONNECTED';
  sellerWarehouseId: number | null;
  isPrimary: boolean;
}

interface Connect3PLModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const Connect3PLModal: React.FC<Connect3PLModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [warehouses, setWarehouses] = useState<Available3PLWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Connecting state
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [isPrimaryMap, setIsPrimaryMap] = useState<Record<number, boolean>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchAvailable3PL = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/seller/warehouses/available-3pl');
      if (res.data.success) {
        setWarehouses(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch available 3PL warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAvailable3PL();
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async (warehouseId: number) => {
    setConnectingId(warehouseId);
    setError(null);
    setActionMessage(null);

    try {
      const isPrimary = isPrimaryMap[warehouseId] || false;
      const res = await apiClient.post('/seller/warehouses/connect-3pl', {
        warehouseId,
        isPrimary,
      });

      if (res.data.success) {
        setActionMessage('Connection requested successfully! Awaiting administrator approval.');
        await fetchAvailable3PL();
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to connect to 3PL warehouse');
    } finally {
      setConnectingId(null);
    }
  };

  const filteredWarehouses = warehouses.filter((wh) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      wh.warehouseName.toLowerCase().includes(q) ||
      wh.warehouseCode.toLowerCase().includes(q) ||
      wh.city.toLowerCase().includes(q) ||
      wh.state.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#FCFAF7] rounded-xl border border-[#E8E1D7] shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#641D26] px-6 sm:px-8 py-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-rose-200">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-rose-200/80 text-xs font-bold uppercase tracking-wider mb-0.5">
                Multi-Seller 3PL Network
              </div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Connect 3PL Partner Warehouse
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-6 border-b border-[#E8E1D7] bg-white space-y-4 shrink-0">
          <p className="text-xs text-stone-600 font-medium leading-relaxed">
            Browse certified third-party logistics (3PL) fulfillment hubs onboarded by marketplace administrators.
            Connecting enables shared inventory storage, order routing, and partner fulfillment services.
          </p>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search partner warehouses by name, code, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F8F6F2] border border-[#E0D8CD] rounded-2xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 font-medium"
            />
          </div>

          {actionMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{actionMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw className="w-7 h-7 animate-spin text-[#7E2532]" />
              <span className="text-xs font-semibold">Discovering available 3PL hubs...</span>
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <NoResults
              description="No 3PL partner warehouses available matching your search query."
              className="py-8"
              imageClassName="w-36 h-auto"
            />
          ) : (
            filteredWarehouses.map((wh) => (
              <div
                key={wh.warehouseId}
                className="p-5 rounded-xl bg-white border border-[#E8E1D7] shadow-sm hover:border-[#D5C9B8] transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Warehouse className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-stone-900">{wh.warehouseName}</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          3PL Partner
                        </span>
                      </div>
                      <span className="font-mono text-xs text-stone-400 font-bold block mt-0.5">
                        {wh.warehouseCode}
                      </span>
                    </div>
                  </div>

                  {/* Status / Connect Action */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {wh.connectionStatus === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Connected Hub
                      </span>
                    ) : wh.connectionStatus === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Pending Approval
                      </span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-stone-600 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPrimaryMap[wh.warehouseId] || false}
                            onChange={(e) =>
                              setIsPrimaryMap((prev) => ({
                                ...prev,
                                [wh.warehouseId]: e.target.checked,
                              }))
                            }
                            className="rounded border-stone-300 text-[#7E2532] focus:ring-[#7E2532]"
                          />
                          <span>Set Primary</span>
                        </label>
                        <button
                          onClick={() => handleConnect(wh.warehouseId)}
                          disabled={connectingId === wh.warehouseId}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm"
                        >
                          {connectingId === wh.warehouseId ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5" />
                          )}
                          Connect Hub
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location & Contact Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 pt-2 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>
                      {wh.addressLine1}, {wh.city}, {wh.state} {wh.postalCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>
                      {wh.contactPersonName ? `${wh.contactPersonName} • ` : ''}
                      {wh.contactEmail || wh.contactPhoneNumber || 'Marketplace Operated'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F8F6F2] border-t border-[#E8E1D7] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
