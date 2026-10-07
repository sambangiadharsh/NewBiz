import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  MapPin,
  Mail,
  Phone,
  User,
  Users,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { NoResults } from '../../components/common/NoResults.js';

interface StaffMember {
  warehouseUserId: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  status: string;
  assignedAt: string;
}

interface WarehouseProfile {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | 'THIRD_PARTY';
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  status: string;
  createdAt: string;
  staffMembers: StaffMember[];
  connectedSellersCount: number;
  totalProductsCount: number;
}

export const WarehouseProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<WarehouseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/warehouses/my-warehouse');
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load assigned warehouse profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0C6E7E]">
          Warehouse Profile & Staff
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
          Detailed operational parameters, physical coordinates, and authorized team members for your assigned hub.
        </p>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-[#0C6E7E]" />
          <span className="text-xs font-bold">Loading warehouse specifications...</span>
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl p-8 border border-rose-100 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Access Notice</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
        </div>
      ) : profile ? (
        <div className="space-y-6">
          {/* Main Hero Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_25px_rgba(12,110,126,0.04)] relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#0C6E7E]/10 text-[#0C6E7E] flex items-center justify-center shrink-0">
                  <Warehouse className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-slate-900">{profile.warehouseName}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        profile.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {profile.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-[#0C6E7E]">{profile.warehouseCode}</p>
                  <p className="text-xs text-slate-500 font-medium pt-1">
                    Operating Model:{' '}
                    <span className="font-bold text-slate-800">
                      {profile.warehouseType === 'OWN' ? 'Platform Owned Hub (OWN)' : 'Third-Party Logistics Partner (3PL)'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="flex gap-4">
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 text-center min-w-[100px]">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Connected Sellers</span>
                  <span className="text-lg font-black text-[#0C6E7E]">{profile.connectedSellersCount}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100 text-center min-w-[100px]">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Total SKUs</span>
                  <span className="text-lg font-black text-[#0C6E7E]">{profile.totalProductsCount}</span>
                </div>
              </div>
            </div>

            {/* Address & Contact Details Grid */}
            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0C6E7E]" /> Physical Warehouse Location
                </span>
                <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                  {profile.addressLine1}
                  {profile.addressLine2 && <br />}
                  {profile.addressLine2}
                  <br />
                  {profile.city}, {profile.state} - {profile.postalCode}
                  <br />
                  {profile.country}
                </p>
                {(profile.latitude || profile.longitude) && (
                  <span className="text-[11px] font-mono text-slate-400 block pt-1">
                    GPS Coordinates: {profile.latitude?.toFixed(4)}, {profile.longitude?.toFixed(4)}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#0C6E7E]" /> Station Superintendent Desk
                </span>
                <p className="text-xs font-bold text-slate-900">{profile.contactPersonName || 'No station head designated'}</p>
                {profile.contactEmail && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`mailto:${profile.contactEmail}`} className="hover:underline text-[#0C6E7E]">
                      {profile.contactEmail}
                    </a>
                  </p>
                )}
                {profile.contactPhoneNumber && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${profile.contactPhoneNumber}`} className="hover:underline">
                      {profile.contactPhoneNumber}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Authorized Personnel Roster */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_25px_rgba(12,110,126,0.04)] space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#0C6E7E]" />
                <h3 className="text-base font-black text-slate-900">Station Staff & Shift Leads</h3>
              </div>
              <span className="text-xs font-bold text-slate-400">{profile.staffMembers.length} Colleagues</span>
            </div>

            {profile.staffMembers.length === 0 ? (
              <NoResults
                title="No Staff Assigned"
                description="There are currently no station staff or shift leads assigned to this facility."
                className="py-6"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.staffMembers.map((staff) => (
                  <div
                    key={staff.userId}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100/70 text-[#0C6E7E] flex items-center justify-center font-bold text-sm">
                        {staff.firstName[0]}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {staff.firstName} {staff.lastName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{staff.email}</span>
                        {staff.phoneNumber && (
                          <span className="text-[10px] text-slate-500 block font-medium">{staff.phoneNumber}</span>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#0C6E7E] border border-teal-200/50">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center">
          <NoResults
            title="Facility Record Not Found"
            description="No assigned warehouse facility information could be loaded."
          />
        </div>
      )}
    </div>
  );
};
