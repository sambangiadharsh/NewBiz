import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Warehouse,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Building,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { ApiResponse, AuthUser } from '../../types/auth.js';

interface InviteValidationData {
  valid: boolean;
  invitationId: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  city: string;
  state: string;
  sellerName: string;
  email: string;
  roleName: string;
  userExists: boolean;
  expiresAt: string;
}

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const { user: currentAuthUser, isAuthenticated, setUser } = useAuthStore();

  const [isValidating, setIsValidating] = useState(true);
  const [inviteData, setInviteData] = useState<InviteValidationData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Existing user password
  const [existingPassword, setExistingPassword] = useState('');
  const [showExistingPassword, setShowExistingPassword] = useState(false);

  // New user registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setValidationError('Invalid or missing invitation link. Please check the URL from your invitation email.');
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await apiClient.get<ApiResponse<InviteValidationData>>(
          `/warehouses/invites/${token}/validate`
        );
        if (res.data.success && res.data.data) {
          setInviteData(res.data.data);
        } else {
          setValidationError(res.data.message || 'Invitation link is not valid.');
        }
      } catch (err: any) {
        setValidationError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            'This invitation link has expired or has already been used.'
        );
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Existing user acceptance handler
  const handleAcceptExisting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionError(null);
    setIsSubmitting(true);

    try {
      const payload: { password?: string } = {};
      const isCurrentLoggedInUser =
        isAuthenticated &&
        currentAuthUser &&
        currentAuthUser.email.toLowerCase() === inviteData?.email.toLowerCase();

      if (!isCurrentLoggedInUser) {
        if (!existingPassword) {
          setActionError('Please enter your password to sign in and accept this invitation.');
          setIsSubmitting(false);
          return;
        }
        payload.password = existingPassword;
      }

      const res = await apiClient.post<ApiResponse<{ accessToken: string; user: AuthUser }>>(
        `/warehouses/invites/${token}/accept`,
        payload
      );

      if (res.data.success && res.data.data) {
        setUser(res.data.data.user);
        setSuccessMessage('Invitation accepted! Taking you to your warehouse dashboard...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1200);
      }
    } catch (err: any) {
      setActionError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Could not accept invitation. Please check your password and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // New user registration and acceptance handler
  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!firstName.trim()) {
      setActionError('Please enter your first name.');
      return;
    }

    if (password.length < 8) {
      setActionError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setActionError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiClient.post<ApiResponse<{ accessToken: string; user: AuthUser }>>(
        `/warehouses/invites/${token}/register-and-accept`,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          password,
        }
      );

      if (res.data.success && res.data.data) {
        setUser(res.data.data.user);
        setSuccessMessage('Account created successfully! Taking you to the warehouse dashboard...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1200);
      }
    } catch (err: any) {
      setActionError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to create account. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 shadow-sm text-center max-w-sm w-full">
          <Loader2 className="w-8 h-8 text-[#0C6E7E] animate-spin mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900 mb-1">Checking invitation...</h2>
          <p className="text-xs text-slate-500">Please wait while we verify your invite link.</p>
        </div>
      </div>
    );
  }

  // 2. Error / Invalid token state
  if (validationError || !inviteData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-sm text-center max-w-md w-full">
          <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Invitation Expired or Invalid</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {validationError || 'This invitation link is no longer valid. It may have expired or already been accepted.'}
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 mb-6 text-left space-y-1.5">
            <p className="font-semibold text-slate-700">Need help?</p>
            <p>• Ask the person who invited you to resend the invitation email.</p>
            <p>• If you already have an account, sign in with your email and password.</p>
          </div>
          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <span>Go to Staff Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const isCurrentLoggedInUser =
    isAuthenticated &&
    currentAuthUser &&
    currentAuthUser.email.toLowerCase() === inviteData.email.toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Simple Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0B1E1F] text-white shadow-md mb-3">
            <Warehouse className="w-6 h-6 text-[#0C6E7E]" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Saamaan Warehouse Portal</h1>
          <p className="text-xs text-slate-500 mt-1">Warehouse Team Invitation</p>
        </div>

        {/* Unified Clean Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          {/* Warehouse & Invitation Info Header */}
          <div className="p-6 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#0C6E7E]/10 border border-[#0C6E7E]/20 flex items-center justify-center text-[#0C6E7E] shrink-0 mt-0.5">
                <Building className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-800 font-semibold">{inviteData.sellerName}</strong> has invited you to join:
                </p>
                <h2 className="text-base font-bold text-slate-900 truncate mt-0.5">
                  {inviteData.warehouseName}
                </h2>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  {(inviteData.city || inviteData.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{[inviteData.city, inviteData.state].filter(Boolean).join(', ')}</span>
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                    {inviteData.warehouseCode}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-700">{inviteData.email}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Role: <strong className="text-slate-700 font-medium">Warehouse Staff</strong>
              </span>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-8">
            {actionError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* ===================== CASE 1: EXISTING USER ===================== */}
            {inviteData.userExists ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Welcome Back</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    You already have a Saamaan account under <strong>{inviteData.email}</strong>. 
                    {isCurrentLoggedInUser
                      ? ' Click below to accept and access this warehouse.'
                      : ' Enter your account password to confirm your identity and accept.'}
                  </p>
                </div>

                {isCurrentLoggedInUser ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                      Signed in as <strong className="text-slate-800">{currentAuthUser?.firstName} {currentAuthUser?.lastName}</strong> ({currentAuthUser?.email})
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAcceptExisting()}
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 bg-[#0C6E7E] hover:bg-[#095663] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Accepting...</span>
                        </>
                      ) : (
                        <>
                          <span>Accept Invitation & Open Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAcceptExisting} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">Account Password</label>
                        <Link to="/login" className="text-xs text-[#0C6E7E] hover:underline">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showExistingPassword ? 'text' : 'password'}
                          required
                          value={existingPassword}
                          onChange={(e) => setExistingPassword(e.target.value)}
                          placeholder="Enter your existing password"
                          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowExistingPassword(!showExistingPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showExistingPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 bg-[#0C6E7E] hover:bg-[#095663] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying & Accepting...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In & Accept Invitation</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ===================== CASE 2: NEW USER ===================== */
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Your Account</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Set up your login details to join the warehouse team and get started.
                  </p>
                </div>

                <form onSubmit={handleRegisterAndAccept} className="space-y-4">
                  {/* Email (fixed) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        disabled
                        value={inviteData.email}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-medium cursor-not-allowed"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Name fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Your first name"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Your last name"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mobile Number (Optional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Create Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 px-4 bg-[#0C6E7E] hover:bg-[#095663] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account & Join Warehouse</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#0C6E7E] font-medium hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
};
