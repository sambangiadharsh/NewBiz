import React, { useState } from 'react';
import { X, Warehouse, AlertCircle, Building2, MapPin, User } from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface CreateWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateWarehouseModal: React.FC<CreateWarehouseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    warehouseName: '',
    warehouseCode: '',
    warehouseType: 'OWN',
    contactPersonName: '',
    contactEmail: '',
    contactPhoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    latitude: '',
    longitude: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };
      if (formData.warehouseCode.trim()) {
        payload.warehouseCode = formData.warehouseCode.toUpperCase().trim();
      } else {
        delete payload.warehouseCode;
      }

      const res = await apiClient.post('/warehouses', payload);
      if (res.data.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create warehouse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#F8F9FE]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#635BFF]">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Register Warehouse</h2>
              <p className="text-xs text-slate-500 font-medium">Add a new marketplace fulfillment center or 3PL partner hub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Info */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#635BFF]" /> Warehouse Identity
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Warehouse Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hyderabad Central Fulfillment Center"
                  value={formData.warehouseName}
                  onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Warehouse Code</label>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Auto-generated if blank
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. WH-HYD-01 (or auto-assign)"
                  value={formData.warehouseCode}
                  onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Warehouse Operating Model *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      formData.warehouseType === 'OWN'
                        ? 'border-[#635BFF] bg-indigo-50/70 text-[#635BFF]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="warehouseType"
                      value="OWN"
                      checked={formData.warehouseType === 'OWN'}
                      onChange={(e) => setFormData({ ...formData, warehouseType: e.target.value })}
                      className="hidden"
                    />
                    <div className="w-2.5 h-2.5 rounded-full bg-current" />
                    <span>OWN (Platform Managed)</span>
                  </label>

                  <label
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      formData.warehouseType === 'THIRD_PARTY'
                        ? 'border-[#635BFF] bg-indigo-50/70 text-[#635BFF]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="warehouseType"
                      value="THIRD_PARTY"
                      checked={formData.warehouseType === 'THIRD_PARTY'}
                      onChange={(e) => setFormData({ ...formData, warehouseType: e.target.value })}
                      className="hidden"
                    />
                    <div className="w-2.5 h-2.5 rounded-full bg-current" />
                    <span>THIRD_PARTY (3PL Partner)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Location & Address */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#635BFF]" /> Physical Location & Address
            </span>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Address Line 1 *</label>
                <input
                  type="text"
                  required
                  placeholder="Plot / Unit No, Industrial Estate, Landmark"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  placeholder="Building, Sector, Area"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="Hyderabad"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="Telangana"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Postal Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="500037"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Country *</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Latitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 17.3850"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Longitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 78.4867"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#635BFF]" /> Station Manager & Contact
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Person</label>
                <input
                  type="text"
                  placeholder="Manager Name"
                  value={formData.contactPersonName}
                  onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.contactPhoneNumber}
                  onChange={(e) => setFormData({ ...formData, contactPhoneNumber: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Email</label>
                <input
                  type="email"
                  placeholder="manager@hub.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#635BFF] text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60"
            >
              {loading ? 'Creating Warehouse...' : 'Register Warehouse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
