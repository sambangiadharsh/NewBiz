import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Square,
  Loader2,
  Users,
  Layers,
  Store,
  Package,
  Building2,
  Lock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast } from '../../lib/swal.js';

interface PermissionItem {
  PermissionID: number;
  PermissionCode: string;
  PermissionName: string;
  Description: string;
}

interface PermissionSection {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  prefixes: string[];
}

const SECTION_CONFIGS: PermissionSection[] = [
  {
    id: 'users',
    title: 'Users',
    subtitle: 'User accounts, operator profiles, and access status',
    icon: Users,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    prefixes: ['users.'],
  },
  {
    id: 'roles',
    title: 'Roles',
    subtitle: 'System security roles and permission policy management',
    icon: Lock,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    prefixes: ['roles.'],
  },
  {
    id: 'catalog',
    title: 'Catalog',
    subtitle: 'Master products, categories, and brand approvals',
    icon: Layers,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    prefixes: ['catalog.'],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    subtitle: 'Stock levels, bin allocations, and warehouse adjustments',
    icon: Package,
    color: 'text-teal-600 bg-teal-50 border-teal-200',
    prefixes: ['inventory.'],
  },
  {
    id: 'fulfillment',
    title: 'Orders & Fulfillment',
    subtitle: 'Customer orders, pick/pack batches, and shipments',
    icon: CheckSquare,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    prefixes: ['orders.', 'fulfillments.'],
  },
  {
    id: 'sellers',
    title: 'Sellers',
    subtitle: 'Merchant onboarding applications and seller accounts',
    icon: Store,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    prefixes: ['sellers.', 'applications.'],
  },
  {
    id: 'warehouses',
    title: 'Warehouses',
    subtitle: 'Distribution hubs, fulfillment centers, and facilities',
    icon: Building2,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    prefixes: ['warehouses.'],
  },
];

export const CreateRolePage: React.FC = () => {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Accordion state: only one section open at a time (defaults to first section)
  const [openSectionId, setOpenSectionId] = useState<string | null>('users');

  useEffect(() => {
    const fetchPermissions = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: PermissionItem[] }>('/auth/admin/permissions');
        if (res.data.success && res.data.data) {
          setPermissions(res.data.data);
        }
      } catch (err: any) {
        showSweetToast(err.response?.data?.error?.message || 'Failed to load system permissions', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  // Map permissions into sections
  const groupedSections = useMemo(() => {
    return SECTION_CONFIGS.map((section) => {
      const sectionPerms = permissions.filter((p) =>
        section.prefixes.some((prefix) => p.PermissionCode.toLowerCase().startsWith(prefix))
      );
      return {
        ...section,
        permissions: sectionPerms,
      };
    }).filter((s) => s.permissions.length > 0);
  }, [permissions]);

  // Handle single permission toggle
  const togglePermission = (code: string) => {
    const updated = new Set(selectedPermissions);
    if (updated.has(code)) {
      updated.delete(code);
    } else {
      updated.add(code);
    }
    setSelectedPermissions(updated);
  };

  // Handle section select/deselect all
  const toggleSection = (sectionPerms: PermissionItem[]) => {
    const sectionCodes = sectionPerms.map((p) => p.PermissionCode);
    const allSelected = sectionCodes.every((c) => selectedPermissions.has(c));

    const updated = new Set(selectedPermissions);
    if (allSelected) {
      sectionCodes.forEach((c) => updated.delete(c));
    } else {
      sectionCodes.forEach((c) => updated.add(c));
    }
    setSelectedPermissions(updated);
  };

  // Master Select All toggle
  const isAllSelected = permissions.length > 0 && selectedPermissions.size === permissions.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPermissions(new Set());
    } else {
      setSelectedPermissions(new Set(permissions.map((p) => p.PermissionCode)));
    }
  };

  // Accordion toggle: opens clicked section, automatically closes any other
  const handleAccordionClick = (sectionId: string) => {
    setOpenSectionId((prev) => (prev === sectionId ? null : sectionId));
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formattedRoleName = roleName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!formattedRoleName) {
      showSweetToast('Please enter a role name.', 'error');
      return;
    }

    if (selectedPermissions.size === 0) {
      showSweetToast('Please select at least one permission for this role.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/admin/roles', {
        roleName: formattedRoleName,
        description: description.trim(),
        permissionCodes: Array.from(selectedPermissions),
      });

      if (res.data.success) {
        showSweetToast(`Role ${formattedRoleName} created successfully!`, 'success');
        navigate('/rbac/roles');
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to create role', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/rbac/roles"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#635BFF] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Roles Directory
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            
            Create New Role
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Define a new security role and assign operational capabilities across modular sections.
          </p>
        </div>

        {/* Master Select All Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={loading || permissions.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isAllSelected
                ? 'bg-indigo-50 border-indigo-200 text-[#635BFF]'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isAllSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
            <span>{isAllSelected ? 'Deselect All' : 'Select All Permissions'}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
              {selectedPermissions.size} / {permissions.length}
            </span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Information Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm pb-2 border-b border-slate-100">
            <Sparkles className="w-4 h-4 text-[#635BFF]" />
            Role Details
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="role-name-input" className="block text-xs font-bold text-slate-700 mb-1">
                Role Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="role-name-input"
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. LOGISTICS_COORDINATOR or CATALOG_MANAGER"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all uppercase"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Use uppercase letters with underscores (e.g., <code className="bg-slate-100 px-1 py-0.5 rounded">REGIONAL_SUPERVISOR</code>).
              </p>
            </div>

            <div>
              <label htmlFor="role-desc-input" className="block text-xs font-bold text-slate-700 mb-1">
                Role Description
              </label>
              <input
                id="role-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of duties and operational domain"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Displays in the User Directory and access assignment modals.
              </p>
            </div>
          </div>
        </div>

        {/* Accordion Section-Wise Permissions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Permissions
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              <strong className="text-[#635BFF]">{selectedPermissions.size}</strong> of {permissions.length} capabilities assigned
            </span>
          </div>

          {loading ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#635BFF] animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading system capability definitions...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedSections.map((section) => {
                const IconComponent = section.icon;
                const sectionCodes = section.permissions.map((p) => p.PermissionCode);
                const isSectionAll = sectionCodes.every((c) => selectedPermissions.has(c));
                const selectedCount = sectionCodes.filter((c) => selectedPermissions.has(c)).length;
                const isOpen = openSectionId === section.id;

                return (
                  <div
                    key={section.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                      isOpen
                        ? 'border-indigo-300 ring-2 ring-[#635BFF]/10 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Accordion Header (Click to expand/collapse) */}
                    <div
                      onClick={() => handleAccordionClick(section.id)}
                      className={`p-4 sm:p-4.5 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                        isOpen ? 'bg-indigo-50/20' : 'bg-slate-50/60 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${section.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
                              {section.title}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                                isSectionAll
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : selectedCount > 0
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-200/70 text-slate-600'
                              }`}
                            >
                              {selectedCount} of {section.permissions.length} selected
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                            {section.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Select Section Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSection(section.permissions);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isSectionAll
                              ? 'bg-[#635BFF] border-[#635BFF] text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isSectionAll ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="hidden sm:inline">{isSectionAll ? 'All Selected' : 'Select Section'}</span>
                        </button>

                        {/* Chevron Indicator */}
                        <div
                          className={`p-1.5 rounded-xl text-slate-400 transition-transform duration-200 transform ${
                            isOpen ? 'rotate-180 text-[#635BFF] bg-indigo-50' : 'bg-white border border-slate-200'
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Accordion Body (Collapsible content) */}
                    {isOpen && (
                      <div className="p-4 sm:p-5 border-t border-slate-100 bg-white grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
                        {section.permissions.map((perm) => {
                          const isChecked = selectedPermissions.has(perm.PermissionCode);
                          return (
                            <div
                              key={perm.PermissionID}
                              onClick={() => togglePermission(perm.PermissionCode)}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                                isChecked
                                  ? 'bg-indigo-50/40 border-indigo-200 shadow-xs ring-1 ring-indigo-200/50'
                                  : 'bg-slate-50/40 border-slate-200/70 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent onClick
                                className="mt-0.5 w-4 h-4 rounded text-[#635BFF] focus:ring-[#635BFF] border-slate-300 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-extrabold text-slate-900 text-xs truncate">
                                    {perm.PermissionName}
                                  </span>
                                  <code className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold shrink-0">
                                    {perm.PermissionCode}
                                  </code>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                  {perm.Description || 'Standard functional access authority.'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/rbac/roles')}
            disabled={submitting}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || !roleName.trim() || selectedPermissions.size === 0}
            className="inline-flex items-center gap-2 px-7 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating Role...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Create Role
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
