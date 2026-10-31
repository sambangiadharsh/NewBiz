import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  KeyRound,
  RotateCcw,
  Clock,
  Mail,
  Phone,
  Loader2,
  UserPlus,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { confirmProceed, showSweetToast } from '../../lib/swal.js';
import { useAuthStore } from '../../store/authStore.js';
import { usePagination } from '../../hooks/usePagination.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';

interface AdminUserItem {
  UserID: string | number;
  FirstName: string;
  LastName: string;
  Email: string;
  PhoneNumber: string | null;
  Status: string;
  LastLoginAt: string | null;
  PasswordLastChangedAt: string | null;
  CreatedAt: string;
  Roles: string | null;
}

const AVAILABLE_ROLES = [
  { code: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Full system and governance authority across the platform' },
  { code: 'ADMIN', label: 'Operations Admin', desc: 'Platform operations, catalog approvals, and merchant oversight' },
  { code: 'SELLER_ADMIN', label: 'Seller Admin', desc: 'Full merchant store management, catalog, orders, and payouts' },
  { code: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager', desc: 'Full facility WMS control, inventory receipts, and dispatch' },
];

export const UserDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Edit Roles Modal State
  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const { user: currentUser } = useAuthStore();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: AdminUserItem[] }>('/auth/admin/users');
      if (res.data.success && res.data.data) {
        setUsers(res.data.data);
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to load user directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleForceReset = async (targetUser: AdminUserItem) => {
    const isConfirmed = await confirmProceed({
      title: 'Force Password Reset?',
      text: `This will instantly terminate all active sessions for ${targetUser.FirstName} ${targetUser.LastName} (${targetUser.Email}) and dispatch an email with a 6-digit password reset code.`,
      confirmButtonText: 'Yes, Terminate Sessions & Reset',
      cancelButtonText: 'Cancel',
      icon: 'warning',
    });

    if (!isConfirmed) return;

    setActionLoadingId(targetUser.UserID);
    try {
      const res = await apiClient.post('/auth/admin/force-reset', {
        targetUserId: String(targetUser.UserID),
      });

      if (res.data.success) {
        showSweetToast(
          `Sessions revoked! Reset code emailed to ${targetUser.Email}.`,
          'success'
        );
        await fetchUsers();
      }
    } catch (err: any) {
      showSweetToast(
        err.response?.data?.error?.message || 'Failed to execute force reset',
        'error'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleStatus = async (targetUser: AdminUserItem) => {
    const isCurrent = String(currentUser?.userId) === String(targetUser.UserID);
    if (isCurrent) {
      showSweetToast('You cannot suspend your own active account.', 'error');
      return;
    }

    const nextStatus = targetUser.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const isDeactivating = nextStatus === 'INACTIVE';

    const isConfirmed = await confirmProceed({
      title: isDeactivating ? 'Suspend User Access?' : 'Activate User Access?',
      text: isDeactivating
        ? `Are you sure you want to deactivate ${targetUser.FirstName} ${targetUser.LastName}? They will immediately be blocked from logging into any portal.`
        : `Re-activate ${targetUser.FirstName} ${targetUser.LastName}'s account access?`,
      confirmButtonText: isDeactivating ? 'Yes, Suspend Account' : 'Yes, Activate Account',
      cancelButtonText: 'Cancel',
      icon: isDeactivating ? 'warning' : 'question',
    });

    if (!isConfirmed) return;

    setActionLoadingId(targetUser.UserID);
    try {
      const res = await apiClient.patch(`/auth/admin/users/${targetUser.UserID}/status`, {
        status: nextStatus,
      });

      if (res.data.success) {
        showSweetToast(`User status set to ${nextStatus}`, 'success');
        await fetchUsers();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to update user status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRoleModal = (user: AdminUserItem) => {
    setRoleModalUser(user);
    const existing = user.Roles ? user.Roles.split(', ') : ['ADMIN'];
    setSelectedRoles(existing);
  };

  const handleSaveRoles = async () => {
    if (!roleModalUser) return;
    if (selectedRoles.length === 0) {
      showSweetToast('At least one role must be assigned.', 'error');
      return;
    }

    setSavingRoles(true);
    try {
      const res = await apiClient.patch(`/auth/admin/users/${roleModalUser.UserID}/roles`, {
        roles: selectedRoles,
      });
      if (res.data.success) {
        showSweetToast('User roles updated successfully!', 'success');
        setRoleModalUser(null);
        await fetchUsers();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to update roles', 'error');
    } finally {
      setSavingRoles(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.trim().toLowerCase();
    const fullName = `${u.FirstName} ${u.LastName}`.toLowerCase();
    const email = (u.Email || '').toLowerCase();
    const rolesStr = (u.Roles || '').toLowerCase();
    const matchesSearch = !query || fullName.includes(query) || email.includes(query) || rolesStr.includes(query);

    // Role Filter (exact match on assigned role in comma-separated list)
    let matchesRole = true;
    if (roleFilter !== 'all') {
      const userRoles = (u.Roles || '')
        .split(',')
        .map((r) => r.trim().toUpperCase());
      matchesRole = userRoles.includes(roleFilter.toUpperCase());
    }

    // Status Filter
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = u.Status === statusFilter;
    }

    return matchesSearch && matchesRole && matchesStatus;
  });

  const { paginatedData, paginationProps } = usePagination<AdminUserItem>({
    data: filteredUsers,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const columns: ColumnDef<AdminUserItem>[] = [
    {
      header: 'User / Identity',
      cell: ({ row: u }) => {
        const isCurrent = String(currentUser?.userId) === String(u.UserID);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#635BFF] to-[#9B7BF7] text-white font-black flex items-center justify-center text-xs shrink-0 shadow-sm">
              {u.FirstName?.[0] || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900">
                  {u.FirstName} {u.LastName}
                </span>
                {isCurrent && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-[#635BFF]">
                    YOU
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {u.Email}
                </span>
                {u.PhoneNumber && (
                  <span className="flex items-center gap-1">
                    • <Phone className="w-3 h-3" />
                    {u.PhoneNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Assigned Roles',
      cell: ({ row: u }) => {
        const roleList = u.Roles ? u.Roles.split(', ') : ['USER'];
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {roleList.map((r) => {
              let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
              if (r === 'SUPER_ADMIN') badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200 font-black';
              else if (r === 'ADMIN') badgeStyle = 'bg-indigo-50 text-[#635BFF] border-indigo-200 font-bold';
              else if (r.includes('SELLER')) badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
              else if (r.includes('WAREHOUSE')) badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';

              return (
                <span
                  key={r}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] tracking-wide ${badgeStyle}`}
                >
                  {r}
                </span>
              );
            })}

            <button
              type="button"
              onClick={() => openRoleModal(u)}
              className="p-1 text-slate-400 hover:text-[#635BFF] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Edit roles"
            >
              <SlidersHorizontal className="w-3 h-3" />
            </button>
          </div>
        );
      },
    },
    {
      header: 'Status',
      cell: ({ row: u }) => {
        const isCurrent = String(currentUser?.userId) === String(u.UserID);
        const isActionLoading = actionLoadingId === u.UserID;
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(u)}
            disabled={isCurrent || isActionLoading}
            title={isCurrent ? 'Cannot modify your own status' : 'Click to toggle status'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
              u.Status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                u.Status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            {u.Status}
          </button>
        );
      },
    },
    {
      header: 'Password Changed',
      cell: ({ row: u }) =>
        u.PasswordLastChangedAt ? (
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{new Date(u.PasswordLastChangedAt).toLocaleDateString()}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic">Never modified</span>
        ),
    },
    {
      header: 'Last Login',
      cell: ({ row: u }) =>
        u.LastLoginAt ? (
          <span className="text-slate-500">{new Date(u.LastLoginAt).toLocaleDateString()}</span>
        ) : (
          <span className="text-slate-400 italic">No record</span>
        ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: ({ row: u }) => {
        const isCurrent = String(currentUser?.userId) === String(u.UserID);
        const isActionLoading = actionLoadingId === u.UserID;
        return (
          <button
            type="button"
            onClick={() => handleForceReset(u)}
            disabled={isActionLoading || isCurrent}
            title={
              isCurrent
                ? 'Use Change Password for your own account'
                : 'Terminate all active sessions and send a password reset code'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold transition-all shadow-sm cursor-pointer"
          >
            {isActionLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Working...
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                Force Reset
              </>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Directory</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Manage operator accounts, access statuses, credential resets, and assigned role profiles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate('/rbac/users/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add User
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
              placeholder="Search users by name, email, or role..."
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
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Operations Admin</option>
              <option value="SELLER_ADMIN">Seller Admin</option>
              <option value="SELLER_USER">Seller Staff</option>
              <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
              <option value="WAREHOUSE_USER">Warehouse Staff</option>
            </select>

            {/* Clean Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="h-10 px-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Suspended</option>
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

        {/* Filter Summary indicator when filtered */}
        {(roleFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100">
            <span>
              Showing <strong className="text-slate-800">{filteredUsers.length}</strong> of{' '}
              <strong className="text-slate-800">{users.length}</strong> operators
            </span>
          </div>
        )}
      </div>

      {/* Reusable Data Table with row & column separation, zebra striping, sticky header, and pinned pagination */}
      <DataTable<AdminUserItem>
        columns={columns}
        data={paginatedData}
        keyExtractor={(u) => u.UserID}
        loading={loading}
        bordered={true}
        striped={true}
        maxHeight="600px"
        containerClassName="rounded-3xl border border-slate-200 shadow-sm"
        emptyTitle="No Users Found"
        emptyDescription="Try adjusting your filter or search criteria."
        pagination={{ ...paginationProps, itemLabel: 'operators' }}
      />


      {/* Edit Roles Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#635BFF] flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Manage Roles</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {roleModalUser.FirstName} {roleModalUser.LastName} ({roleModalUser.Email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {AVAILABLE_ROLES.map((r) => {
                const isSelected = selectedRoles.includes(r.code);
                return (
                  <label
                    key={r.code}
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#635BFF] bg-indigo-50/40 text-slate-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, r.code]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((item) => item !== r.code));
                        }
                      }}
                      className="mt-0.5 rounded text-[#635BFF] focus:ring-[#635BFF]"
                    />
                    <div>
                      <span className="text-xs font-bold block">{r.label}</span>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{r.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoles}
                disabled={savingRoles}
                className="px-5 py-2 bg-[#635BFF] hover:bg-[#5248EE] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {savingRoles && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
