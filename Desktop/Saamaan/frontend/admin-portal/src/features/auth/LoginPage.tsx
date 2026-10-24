import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { ApiResponse, AuthUser } from '../../types/auth.js';
import { showSweetToast } from '../../lib/swal.js';
import loginIllustration from '../../assets/login_illustration_admin.png';

export const LoginPage: React.FC = () => {
  // Mode: LOGIN | FORGOT_REQUEST | FORGOT_VERIFY
  const [mode, setMode] = useState<'LOGIN' | 'FORGOT_REQUEST' | 'FORGOT_VERIFY'>('LOGIN');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const navigate = useNavigate();
  const { isAuthenticated, setUser } = useAuthStore();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiClient.post<ApiResponse<{ accessToken: string; user: AuthUser }>>(
        '/auth/login',
        { email, password }
      );

      if (res.data.success && res.data.data) {
        // User must have administrative privileges or active role permissions
        const user = res.data.data.user;
        const roles = user.roles || [];
        const isPermitted =
          roles.includes('SUPER_ADMIN') ||
          roles.includes('ADMIN') ||
          (Array.isArray(user.permissions) && user.permissions.length > 0);

        if (!isPermitted) {
          setError('Access denied: Your account does not have administrative privileges.');
          setIsLoading(false);
          return;
        }

        setUser(user);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Login failed. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  

  // Step 1: Send OTP for password reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail });
      if (res.data.success) {
        setForgotSuccess(`A 6-digit password reset code has been dispatched to ${forgotEmail}.`);
        setMode('FORGOT_VERIFY');
      }
    } catch (err: any) {
      setForgotError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to send verification code. Please check your email.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  // Password complexity verification for reset
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isMatching = newPassword === confirmPassword && confirmPassword.length > 0;
  const isResetValid =
    otp.length === 6 &&
    hasMinLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecial &&
    isMatching;

  // Step 2: Verify OTP and set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isResetValid) return;

    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await apiClient.post('/auth/reset-password', {
        email: forgotEmail,
        otp,
        newPassword,
      });

      if (res.data.success) {
        showSweetToast('Password reset successfully! Please sign in with your new credentials.', 'success');
        setEmail(forgotEmail);
        setPassword('');
        setMode('LOGIN');
        setForgotError(null);
        setForgotSuccess(null);
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setForgotError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to reset password. Please verify your OTP code.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Subtle ambient background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Clean Combined Container */}
      <div className="w-full max-w-5xl bg-white border border-slate-100 rounded-3xl shadow-[0_20px_50px_rgba(99,102,241,0.06)] overflow-hidden flex flex-col lg:flex-row relative z-10">
        {/* LEFT COLUMN: Illustration */}
        <div className="w-full lg:w-1/2 bg-gradient-to-br from-indigo-50/50 via-[#F8F7FF] to-violet-50/40 p-8 sm:p-12 flex items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 min-h-[280px] lg:min-h-[580px]">
          <img
            src={loginIllustration}
            alt="Admin Portal"
            className="w-full max-w-sm sm:max-w-md h-auto object-contain select-none"
          />
        </div>

        {/* RIGHT COLUMN: Form */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
          {/* Header Branding */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#635BFF] via-[#7C5CFC] to-[#9B7BF7] flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                  Marketplace<span className="text-[#635BFF]">Admin</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Platform Operations Console
                </p>
              </div>
            </div>
          </div>

          {/* ===================== MODE 1: LOGIN ===================== */}
          {mode === 'LOGIN' && (
            <>
              {error && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2.5 font-medium animate-in fade-in">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@test.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#F8F9FE] border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotError(null);
                        setMode('FORGOT_REQUEST');
                      }}
                      className="text-xs font-bold text-[#635BFF] hover:text-[#544CE6] transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3 bg-[#F8F9FE] border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#544CE6] hover:to-[#6B4BEB] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ===================== MODE 2: FORGOT REQUEST ===================== */}
          {mode === 'FORGOT_REQUEST' && (
            <div>
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-3 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Reset Password</h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Enter your administrator email to receive a 6-digit code.
                </p>
              </div>

              {forgotError && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Registered Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@test.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#F8F9FE] border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#544CE6] hover:to-[#6B4BEB] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      Send 6-Digit Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ===================== MODE 3: FORGOT VERIFY ===================== */}
          {mode === 'FORGOT_VERIFY' && (
            <div>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setMode('FORGOT_REQUEST')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Email
                </button>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Set New Password</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Code sent to <span className="font-bold text-slate-700">{forgotEmail}</span>
                </p>
              </div>

              {forgotSuccess && (
                <div className="mb-3 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-medium">
                  {forgotSuccess}
                </div>
              )}

              {forgotError && (
                <div className="mb-3 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-3">
                {/* 6-Digit OTP */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest font-mono text-base font-bold py-2 bg-[#F8F9FE] border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] transition-all"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New strong password"
                      className="w-full pl-3.5 pr-10 py-2 bg-[#F8F9FE] border border-slate-100 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full pl-3.5 pr-10 py-2 bg-[#F8F9FE] border border-slate-100 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF] transition-all"
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

                {/* Password Requirement Checklist */}
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 text-[11px]">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {hasMinLength ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                      <span>8+ Chars</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {hasUpperCase ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                      <span>1 Uppercase</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {hasLowerCase ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                      <span>1 Lowercase</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {hasNumber ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                      <span>1 Number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {hasSpecial ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                      <span>1 Special</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${isMatching ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {isMatching ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 shrink-0" />}
                      <span>Match</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !isResetValid}
                  className="w-full mt-1.5 py-2.5 px-4 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#544CE6] hover:to-[#6B4BEB] disabled:opacity-50 text-white font-bold rounded-2xl text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    'Reset & Sign In'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
