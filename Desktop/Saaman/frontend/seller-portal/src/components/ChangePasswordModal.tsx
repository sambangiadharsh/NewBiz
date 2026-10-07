import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, Circle, AlertTriangle, X, Loader2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../lib/axios.js';
import { useAuthStore } from '../store/authStore.js';
import { useNavigate } from 'react-router-dom';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { logout } = useAuthStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isMatching = newPassword === confirmPassword && confirmPassword.length > 0;
  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecial &&
    isMatching;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.data.success) {
        onClose();
        await logout();
        navigate('/login', { replace: true });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to change password. Please verify your current password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[#ECE5DC] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-[#7E2532] flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-stone-900 tracking-tight">Change Password</h3>
            <p className="text-xs text-stone-400 font-medium">Update seller account security credentials</p>
          </div>
        </div>

        {/* Invalidation Alert Banner */}
        <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">
            <strong>Security notice:</strong> Changing your password will immediately sign you out of all other active sessions and devices.
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#F3EFEA] border border-[#E0D8CD] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium text-stone-900"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#F3EFEA] border border-[#E0D8CD] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium text-stone-900"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#F3EFEA] border border-[#E0D8CD] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium text-stone-900"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Complexity Indicator */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-1 text-[11px]">
            <p className="font-bold text-stone-500 mb-1">Password requirements:</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>8+ Characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                {hasUpperCase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Uppercase (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                {hasLowerCase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Lowercase (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Number (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>1 Special Char</span>
              </div>
              <div className={`flex items-center gap-1.5 ${isMatching ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                {isMatching ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                <span>Passwords Match</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#641D26] via-[#7E2532] to-[#9E2C3F] hover:from-[#52161E] hover:to-[#7E2532] disabled:opacity-50 rounded-xl shadow-md shadow-rose-950/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
