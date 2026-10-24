import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Check,
  Copy,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { confirmProceed, showSweetToast } from '../../lib/swal.js';
import { useAuthStore } from '../../store/authStore.js';
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
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'seller' | 'warehouse'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormLoading, setAddFormLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    roleName: 'ADMIN',
    password: '',
  });
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    temporaryPassword?: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()) {
      showSweetToast('First Name, Last Name, and Email are required.', 'error');
      return;
    }

    setAddFormLoading(true);
    try {
      const res = await apiClient.post('/auth/admin/users', addForm);
      if (res.data.success) {
        showSweetToast('User provisioned successfully!', 'success');
        setCreatedCredentials({
          email: addForm.email,
          temporaryPassword: res.data.data.temporaryPassword || addForm.password,
          role: addForm.roleName,
        });
        setAddForm({
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '',
          roleName: 'ADMIN',
          password: '',
        });
        await fetchUsers();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to create user', 'error');
    } finally {
      setAddFormLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    const fullName = `${u.FirstName} ${u.LastName}`.toLowerCase();
    const email = (u.Email || '').toLowerCase();
    const roles = (u.Roles || '').toLowerCase();
    const matchesSearch = fullName.includes(query) || email.includes(query) || roles.includes(query);

    // Role Filter
    let matchesRole = true;
    if (roleFilter === 'admin') {
      matchesRole = roles.includes('super_admin') || roles.includes('admin');
    } else if (roleFilter === 'seller') {
      matchesRole = roles.includes('seller');
    } else if (roleFilter === 'warehouse') {
      matchesRole = roles.includes('warehouse');
    }

    // Status Filter
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = u.Status === statusFilter;
    }

    return matchesSearch && matchesRole && matchesStatus;
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
          <Link
            to="/rbac/roles"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#635BFF] rounded-xl text-xs font-bold transition-all border border-indigo-100 shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Role Permissions & Matrix
          </Link>
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
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Provision User
          </button>
        </div>
      </div>

      {/* Filter / Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Role Filter Tabs */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl text-xs font-bold">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'admin'
                  ? 'bg-white text-[#635BFF] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Platform Admins
            </button>
            <button
              onClick={() => setRoleFilter('seller')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'seller'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Seller Admins
            </button>
            <button
              onClick={() => setRoleFilter('warehouse')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'warehouse'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Warehouse Managers
            </button>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Suspended Only</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name, email, or role..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
          />
        </div>
      </div>

      {/* Reusable Data Table with row & column separation, zebra striping, sticky header, and vertical scroll */}
      <DataTable<AdminUserItem>
        columns={columns}
        data={filteredUsers}
        keyExtractor={(u) => u.UserID}
        loading={loading}
        bordered={true}
        striped={true}
        maxHeight="600px"
        containerClassName="rounded-3xl border border-slate-200 shadow-sm"
        emptyTitle="No Users Found"
        emptyDescription="Try adjusting your filter or search criteria."
      />


      {/* Provision User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Provision Internal User</h3>
                  <p className="text-xs text-slate-500 font-medium">Create and authorize a platform, merchant, or warehouse operator</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={addForm.firstName}
                    onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
                    placeholder="e.g. Ramesh"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={addForm.lastName}
                    onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
                    placeholder="e.g. Kumar"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (Optional)</label>
                <input
                  type="text"
                  value={addForm.phoneNumber}
                  onChange={(e) => setAddForm({ ...addForm, phoneNumber: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Portal Role *</label>
                <select
                  value={addForm.roleName}
                  onChange={(e) => setAddForm({ ...addForm, roleName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
                >
                  {AVAILABLE_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label} ({r.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {AVAILABLE_ROLES.find((r) => r.code === addForm.roleName)?.desc}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Password <span className="text-slate-400 font-normal">(Leave blank to auto-generate)</span>
                </label>
                <input
                  type="text"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20"
                  placeholder="Auto-generate secure temporary key"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFormLoading}
                  className="px-5 py-2 bg-[#635BFF] hover:bg-[#5248EE] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {addFormLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create & Authorize User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Credentials Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">User Successfully Provisioned!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Provide these initial credentials to the operator to log in.
              </p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-2xl text-left text-xs font-mono space-y-2">
              <div>
                <span className="text-slate-400 block text-[10px]">Email</span>
                <span className="text-emerald-400 font-bold">{createdCredentials.email}</span>
              </div>
              {createdCredentials.temporaryPassword && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Temporary Password</span>
                  <span className="text-amber-300 font-bold">{createdCredentials.temporaryPassword}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[10px]">Assigned Role</span>
                <span className="text-slate-200 font-bold">{createdCredentials.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `Saaman Login Credentials\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporaryPassword || 'Configured manually'}\nRole: ${createdCredentials.role}`;
                  navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied Details' : 'Copy Credentials'}
              </button>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="flex-1 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] text-white text-xs font-bold rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
