import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Warehouse,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
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

  // Forgot password state
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
        if (!roles.includes('WAREHOUSE_MANAGER') && !roles.includes('SUPER_ADMIN')) {
          setError('Access denied: Your account is not authorized as warehouse operations staff.');
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
    setEmail('warehouse@test.com');
    setPassword('warehouse123');
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
          'Failed to reset password. Please verify your OTP code.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F8F9] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background soft teal glowing radial accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#0C6E7E] via-[#0E7A8A] to-[#14B8A6] shadow-xl shadow-teal-900/20 text-white mb-4">
            <Warehouse className="w-8 h-8 text-teal-100" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Warehouse<span className="text-[#0C6E7E]">Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Warehouse Operations & Fulfillment Terminal
          </p>
        </div>

        {/* Clean White Card */}
        <div className="bg-white border border-[#E1EFF0] rounded-3xl p-8 shadow-[0_15px_35px_rgba(12,110,126,0.05)]">
          {/* ===================== MODE 1: LOGIN ===================== */}
          {mode === 'LOGIN' && (
            <>
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2.5 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Operations Email
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
                      placeholder="warehouse@test.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#F4F8F9] border border-[#E1EFF0] rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/25 focus:border-[#0C6E7E] transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotError(null);
                        setMode('FORGOT_REQUEST');
                      }}
                      className="text-xs font-bold text-[#0C6E7E] hover:text-[#085562] transition-colors cursor-pointer"
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
                      className="w-full pl-10 pr-11 py-3 bg-[#F4F8F9] border border-[#E1EFF0] rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/25 focus:border-[#0C6E7E] transition-all font-medium"
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
                  className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-[#0C6E7E] via-[#0E7A8A] to-[#14B8A6] hover:from-[#085562] hover:to-[#0C6E7E] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Accessing Terminal...
                    </>
                  ) : (
                    <>
                      Sign In to Terminal
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Demo Helper */}
              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="inline-flex items-center gap-1.5 text-xs text-[#0C6E7E] hover:text-[#085562] transition-colors font-bold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Fill test credentials (warehouse@test.com / warehouse123)
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
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-4 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Reset Password</h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Enter your warehouse account email to receive a 6-digit verification code.
                </p>
              </div>

              {forgotError && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
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
                      placeholder="warehouse@test.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#F4F8F9] border border-[#E1EFF0] rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/25 focus:border-[#0C6E7E] transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0C6E7E] via-[#0E7A8A] to-[#14B8A6] hover:from-[#085562] hover:to-[#0C6E7E] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-3 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Email
                </button>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Set New Password</h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Verification code sent to <span className="font-bold text-slate-700">{forgotEmail}</span>
                </p>
              </div>

              {forgotSuccess && (
                <div className="mb-4 p-3 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-medium">
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest font-mono text-lg font-bold py-2.5 bg-[#F4F8F9] border border-[#E1EFF0] rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/25 focus:border-[#0C6E7E] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#F4F8F9] border border-[#E1EFF0] rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/25 focus:border-[#0C6E7E] transition-all font-medium"
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#F4F8F9] border border-[#E1EFF0] rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/25 focus:border-[#0C6E7E] transition-all font-medium"
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
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-[11px]">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                      {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>8+ Chars</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                      {hasUpperCase ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Uppercase</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                      {hasLowerCase ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Lowercase</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                      {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                      {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>1 Special</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${isMatching ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
                      {isMatching ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                      <span>Match</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !isResetValid}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-[#0C6E7E] via-[#0E7A8A] to-[#14B8A6] hover:from-[#085562] hover:to-[#0C6E7E] disabled:opacity-50 text-white font-bold rounded-2xl text-sm shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
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

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          Protected by Enterprise HTTP-only cookie authentication.
        </p>
      </div>
    </div>
  );
};
