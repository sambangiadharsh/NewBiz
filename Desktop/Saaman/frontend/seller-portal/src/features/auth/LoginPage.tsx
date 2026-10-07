import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { ApiResponse, AuthUser } from '../../types/auth.js';

export const LoginPage: React.FC = () => {
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
        const roles = res.data.data.user.roles;
        if (!roles.includes('SELLER_ADMIN')) {
          setError('Access denied: Your account does not have seller permissions. Administrators must use the Admin Portal.');
          setIsLoading(false);
          return;
        }

        setUser(res.data.data.user);
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

  const handleFillDemo = () => {
    setEmail('seller@test.com');
    setPassword('seller123');
    setError(null);
  };

  // Step 1: Request OTP
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail });
      if (res.data.success) {
        setForgotSuccess(`A 6-digit password reset code has been sent to ${forgotEmail}.`);
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

  // Complexity rules
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

  // Step 2: Reset password
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
          'Failed to reset password. Please check your OTP code.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3EFEA] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background warm burgundy & rose radial glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#641D26] via-[#7E2532] to-[#9E2C3F] shadow-xl shadow-rose-950/20 text-white mb-4">
            <Store className="w-8 h-8 text-rose-100" />
          </div>
          <h1 className="text-2xl font-black text-[#221C1E] tracking-tight">
            Seller<span className="text-[#7E2532]">Studio</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#9E968D] mt-1 font-medium">
            Seller Operations & Catalog Console
          </p>
        </div>

        {/* Clean White Card */}
        <div className="bg-white border border-[#ECE5DC] rounded-3xl p-8 shadow-[0_15px_35px_rgba(70,20,27,0.04)]">
          {/* ===================== MODE 1: LOGIN ===================== */}
          {mode === 'LOGIN' && (
            <>
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-[#FDF2F4] border border-rose-200/80 text-[#7E2532] text-xs flex items-start gap-2.5 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7E2532] mt-1.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Seller Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seller@test.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#F3EFEA] border border-[#E0D8CD] rounded-2xl text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotError(null);
                        setMode('FORGOT_REQUEST');
                      }}
                      className="text-xs font-bold text-[#7E2532] hover:text-[#52161E] transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3 bg-[#F3EFEA] border border-[#E0D8CD] rounded-2xl text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-[#641D26] via-[#7E2532] to-[#9E2C3F] hover:from-[#52161E] hover:to-[#7E2532] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-rose-950/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Accessing Seller Account...
                    </>
                  ) : (
                    <>
                      Sign In to Seller Studio
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Register Prompt */}
              <div className="mt-5 pt-5 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500 font-medium">New seller on our platform?</span>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="font-bold text-[#7E2532] hover:text-[#52161E] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Register as Seller
                </button>
              </div>

              {/* Quick Demo Helper */}
              <div className="mt-4 pt-4 border-t border-stone-100 text-center">
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="inline-flex items-center gap-1.5 text-xs text-[#7E2532] hover:text-[#9E2C3F] transition-colors font-bold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Fill test credentials (seller@test.com / seller123)
                </button>
              </div>
            </>
          )}

          {/* ===================== MODE 2: FORGOT REQUEST ===================== */}
          {mode === 'FORGOT_REQUEST' && (
            <div>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors mb-4 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
                <h2 className="text-lg font-black text-stone-900 tracking-tight">Reset Password</h2>
                <p className="text-xs text-stone-400 mt-1 font-medium">
                  Enter your seller account email to receive a 6-digit verification code.
                </p>
              </div>

              {forgotError && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-[#7E2532] text-xs font-medium">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Registered Seller Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seller@test.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#F3EFEA] border border-[#E0D8CD] rounded-2xl text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#641D26] via-[#7E2532] to-[#9E2C3F] hover:from-[#52161E] hover:to-[#7E2532] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-rose-950/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Verification Code...
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
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => setMode('FORGOT_REQUEST')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors mb-3 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Email
                </button>
                <h2 className="text-lg font-black text-stone-900 tracking-tight">Set New Password</h2>
                <p className="text-xs text-stone-400 mt-1 font-medium">
                  Verification code sent to <span className="font-bold text-stone-700">{forgotEmail}</span>
                </p>
              </div>

              {forgotSuccess && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-100 text-[#7E2532] text-xs font-medium">
                  {forgotSuccess}
                </div>
              )}

              {forgotError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest font-mono text-lg font-bold py-2.5 bg-[#F3EFEA] border border-[#E0D8CD] rounded-2xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#F3EFEA] border border-[#E0D8CD] rounded-2xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#F3EFEA] border border-[#E0D8CD] rounded-2xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirement Checklist */}
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-1 text-[11px]">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                      {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>8+ Chars</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                      {hasUpperCase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Uppercase</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                      {hasLowerCase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Lowercase</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                      {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                      {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Special</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${isMatching ? 'text-emerald-700 font-semibold' : 'text-stone-400'}`}>
                      {isMatching ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Match</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !isResetValid}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-[#641D26] via-[#7E2532] to-[#9E2C3F] hover:from-[#52161E] hover:to-[#7E2532] disabled:opacity-50 text-white font-bold rounded-2xl text-sm shadow-lg shadow-rose-950/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    'Reset Password & Sign In'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-stone-400 mt-6 font-medium">
          Protected by Enterprise HTTP-only cookie authentication.
        </p>
      </div>
    </div>
  );
};
