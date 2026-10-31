import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Check,
  Copy,
  Loader2,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast } from '../../lib/swal.js';

export const CreateUserPage: React.FC = () => {
  const navigate = useNavigate();

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleName, setRoleName] = useState('ADMIN');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Success State
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword?: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      showSweetToast('First Name, Last Name, and Email are required.', 'error');
      return;
    }

    if (password.trim() && password.trim().length < 6) {
      showSweetToast('Password must be at least 6 characters.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        roleName,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await apiClient.post('/auth/admin/users', payload);

      if (res.data.success) {
        showSweetToast('User created successfully!', 'success');
        setCreatedCredentials({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          temporaryPassword: res.data.data?.temporaryPassword || password.trim() || 'Configured',
          role: roleName,
        });
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneNumber('');
    setRoleName('ADMIN');
    setPassword('');
    setCreatedCredentials(null);
    setCopied(false);
  };

  const copyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Saamaan User Credentials\nName: ${createdCredentials.firstName} ${createdCredentials.lastName}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.temporaryPassword || 'Set manually'}\nRole: ${createdCredentials.role}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Success Confirmation Screen
  if (createdCredentials) {
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              User Created Successfully
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Account for <strong className="text-slate-800">{createdCredentials.firstName} {createdCredentials.lastName}</strong> is ready.
            </p>
          </div>

          {/* Credentials Display */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 text-left space-y-3 font-mono shadow-inner border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Email</span>
              <span className="text-emerald-400 font-bold select-all">{createdCredentials.email}</span>
            </div>

            {createdCredentials.temporaryPassword && (
              <div>
                <span className="text-slate-400 text-[10px] block">Password</span>
                <span className="text-amber-300 font-bold select-all">
                  {createdCredentials.temporaryPassword}
                </span>
              </div>
            )}

            <div>
              <span className="text-slate-400 text-[10px] block">Assigned Role</span>
              <span className="text-indigo-300 font-bold">{createdCredentials.role}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={copyCredentials}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              {copied ? 'Copied Details' : 'Copy Credentials'}
            </button>

            <button
              type="button"
              onClick={handleResetForAnother}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Another User
            </button>

            <button
              type="button"
              onClick={() => navigate('/rbac')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & Back Link */}
      <div>
        <Link
          to="/rbac"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#635BFF] transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Users Directory
        </Link>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Create New User
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Fill in the user details and assign an access role.
        </p>
      </div>

      {/* Main Clean Form Card */}
      <form onSubmit={handleSubmit} className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
          {/* First Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">First Name *</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Ramesh"
              className="w-full h-12 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Last Name *</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Kumar"
              className="w-full h-12 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full h-12 pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full h-12 pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
              />
            </div>
          </div>

          {/* Role Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Role *</label>
            <select
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all cursor-pointer"
            >
              <option value="ADMIN">Operations Admin (ADMIN)</option>
              <option value="SUPER_ADMIN">Super Administrator (SUPER_ADMIN)</option>
              <option value="SELLER_ADMIN">Seller Admin (SELLER_ADMIN)</option>
              <option value="WAREHOUSE_MANAGER">Warehouse Manager (WAREHOUSE_MANAGER)</option>
            </select>
          </div>

          {/* Optional Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Password <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to auto-generate"
              className="w-full h-12 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              If left blank, a secure temporary key is created automatically.
            </p>
          </div>
        </div>

        {/* Centered Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/rbac')}
            disabled={submitting}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || !firstName.trim() || !lastName.trim() || !email.trim()}
            className="inline-flex items-center gap-2 px-7 py-2.5 bg-[#635BFF] hover:bg-[#5248EE] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating User...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Create User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
