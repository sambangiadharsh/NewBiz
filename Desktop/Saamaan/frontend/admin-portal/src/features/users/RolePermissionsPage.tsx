import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RotateCcw,
  Edit3,
  X,
  Search,
  Lock,
  Users,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast } from '../../lib/swal.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';

interface RoleItem {
  RoleID: number;
  RoleName: string;
  Description: string;
  Status: string;
  UserCount: number;
  PermissionCount?: number;
}

export const RolePermissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: RoleItem[] }>('/auth/admin/roles');
      if (res.data.success && res.data.data) {
        setRoles(res.data.data);
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const availableRoleNames = React.useMemo(() => {
    const names = Array.from(new Set(roles.map((r) => r.RoleName))).filter(Boolean);
    return names.sort();
  }, [roles]);

  const filteredRoles = React.useMemo(() => {
    return roles.filter((r) => {
      if (roleFilter !== 'all' && r.RoleName !== roleFilter) {
        return false;
      }
      if (statusFilter !== 'all' && (r.Status || 'ACTIVE') !== statusFilter) {
        return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        r.RoleName.toLowerCase().includes(q) ||
        (r.Description || '').toLowerCase().includes(q)
      );
    });
  }, [roles, roleFilter, statusFilter, searchQuery]);

  const { paginatedData, paginationProps } = usePagination<RoleItem>({
    data: filteredRoles,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  const columns: ColumnDef<RoleItem>[] = [
    {
      header: 'Role Name',
      cell: ({ row: r }) => {
        let badgeStyle = 'bg-slate-100 text-slate-800 border-slate-200';
        if (r.RoleName === 'SUPER_ADMIN') {
          badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200 font-black';
        } else if (r.RoleName === 'ADMIN') {
          badgeStyle = 'bg-indigo-50 text-[#635BFF] border-indigo-200 font-bold';
        } else if (r.RoleName.includes('SELLER')) {
          badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
        } else if (r.RoleName.includes('WAREHOUSE')) {
          badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
        } else {
          badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200 font-bold';
        }

        return (
          <div className="flex items-center gap-3">
            
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-lg border text-xs tracking-wider ${badgeStyle}`}>
                {r.RoleName}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Description',
      cell: ({ row: r }) => (
        <span className="text-xs text-slate-600 max-w-md block leading-relaxed">
          {r.Description || <span className="text-slate-400 italic">No description provided</span>}
        </span>
      ),
    },
    {
      header: 'Assigned Users',
      align: 'center',
      cell: ({ row: r }) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {r.UserCount} {r.UserCount === 1 ? 'user' : 'users'}
        </span>
      ),
    },
    {
      header: 'Granted Permissions',
      align: 'center',
      cell: ({ row: r }) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-[#635BFF] border border-indigo-100">
          <Lock className="w-3 h-3 text-[#635BFF]" />
          {r.PermissionCount ?? 0} permissions
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: ({ row: r }) => {
        const isActive = r.Status === 'ACTIVE';
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {r.Status || 'ACTIVE'}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      cell: ({ row: r }) => (
        <button
          type="button"
          onClick={() => navigate(`/rbac/roles/${r.RoleID}/edit`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:text-[#635BFF] hover:border-indigo-200 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          title="Edit role description and capabilities"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
           
            Role & Permissions
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Manage system access roles, examine permission assignments, and provision new governance roles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchRoles}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => navigate('/rbac/roles/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Role
          </button>
        </div>
      </div>

      {/* Filter / Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles by name or description..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200/50 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
            {/* Clean Role Filter Dropdown */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all cursor-pointer"
            >
              <option value="all">All Roles</option>
              {availableRoleNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Clean Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="h-10 px-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {/* Reset Filters button if any filter is active */}
            {(roleFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="h-10 px-3 inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Reset all active filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary */}
        {(roleFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100">
            <span>
              Showing <strong className="text-slate-800">{filteredRoles.length}</strong> of{' '}
              <strong className="text-slate-800">{roles.length}</strong> roles
            </span>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-[#635BFF] font-bold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Roles Data Table with pinned pagination */}
      <DataTable<RoleItem>
        columns={columns}
        data={paginatedData}
        keyExtractor={(r) => r.RoleID}
        loading={loading}
        bordered={true}
        striped={true}
        maxHeight="600px"
        containerClassName="rounded-3xl border border-slate-200 shadow-sm"
        emptyTitle="No Roles Found"
        emptyDescription="No system roles match your search criteria."
        pagination={{ ...paginationProps, itemLabel: 'roles' }}
      />
    </div>
  );
};
