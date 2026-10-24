import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Heart,
} from 'lucide-react';
import { customerAuthApi } from '../../lib/authApi';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string } | null;
  onLogin: (name: string, email: string) => void;
  onLogout: () => void;
  promptMessage?: string | null;
}

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  onLogout,
  promptMessage,
}) => {
  const [view, setView] = useState<AuthView>('LOGIN');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(false);
  };

  const switchView = (targetView: AuthView) => {
    resetFormState();
    setView(targetView);
  };

  // 1. Handle Customer Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await customerAuthApi.login({
        email: email.trim(),
        password,
      });

      const customerObj = res.customer || res.user;
      const displayName = customerObj ? `${customerObj.firstName} ${customerObj.lastName}`.trim() : email;
      onLogin(displayName, customerObj?.email || email);
      setSuccessMessage('Welcome back! Successfully signed in.');
      setTimeout(() => {
        onClose();
        resetFormState();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Customer Registration (First Name, Last Name, Email, Password)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await customerAuthApi.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim() || undefined,
      });

      const customerObj = res.customer || res.user;
      const displayName = customerObj ? `${customerObj.firstName} ${customerObj.lastName}`.trim() : `${firstName} ${lastName}`.trim();
      onLogin(displayName, customerObj?.email || email);
      setSuccessMessage('Account created successfully! Welcome to Saamaan.');
      setTimeout(() => {
        onClose();
        resetFormState();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password Request (Sends 6-digit OTP to user's email via SMTP)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await customerAuthApi.forgotPassword(email.trim());
      setSuccessMessage(res.message);
      setTimeout(() => {
        switchView('RESET_PASSWORD');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Password Reset with OTP & New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await customerAuthApi.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccessMessage(res.message);
      setTimeout(() => {
        switchView('LOGIN');
        setPassword('');
        setOtp('');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121B14]/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#FAF9F6] rounded-3xl shadow-modal border border-stone-200/80 p-6 sm:p-8 overflow-hidden animate-slide-up max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {user ? (
          /* Logged In View */
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto text-2xl font-black border-4 border-primary-50">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Welcome, {user.name}!</h3>
              <p className="text-xs text-slate-500 mt-1">{user.email}</p>
              <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Customer Member</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 font-medium">Orders Placed</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">Active</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 font-medium">Account Status</span>
                <p className="text-lg font-bold text-primary-600 mt-0.5">Verified</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={onLogout}
                className="w-full py-3 px-4 rounded-xl border border-rose-200 text-rose-600 font-semibold text-xs hover:bg-rose-50 transition-colors"
              >
                Sign Out of Account
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Contextual Action Prompt Banner */}
            {promptMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs flex items-center space-x-2.5 shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                  <Heart className="w-4 h-4 fill-amber-500 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-950 text-[12px]">{promptMessage}</p>
                </div>
              </div>
            )}

            {/* Header Icon & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 mb-3 shadow-inner border border-primary-100/50">
                {view === 'LOGIN' && <User className="w-6 h-6" />}
                {view === 'REGISTER' && <ShieldCheck className="w-6 h-6" />}
                {(view === 'FORGOT_PASSWORD' || view === 'RESET_PASSWORD') && <KeyRound className="w-6 h-6" />}
              </div>

              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {view === 'LOGIN' && 'Welcome Back'}
                {view === 'REGISTER' && 'Create Your Account'}
                {view === 'FORGOT_PASSWORD' && 'Reset Password'}
                {view === 'RESET_PASSWORD' && 'Enter Verification Code'}
              </h3>

              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {view === 'LOGIN' && 'Access your saved orders, wishlist, and member benefits'}
                {view === 'REGISTER' && 'Join Saamaan for seamless checkout and dedicated service'}
                {view === 'FORGOT_PASSWORD' && 'Enter your registered email and we will send a 6-digit verification code'}
                {view === 'RESET_PASSWORD' && `Enter the 6-digit code sent to ${email} and choose a new password`}
              </p>
            </div>

            {/* Error Message Toast */}
            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Message Toast */}
            {successMessage && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* ─── 1. SIGN IN VIEW ─────────────────────────────────────── */}
            {view === 'LOGIN' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => switchView('FORGOT_PASSWORD')}
                      className="text-[11px] text-primary-600 hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchView('REGISTER')}
                      className="text-primary-600 font-bold hover:underline"
                    >
                      Create Account
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ─── 2. SIGN UP VIEW (First Name, Last Name, Email, Password) ─── */}
            {view === 'REGISTER' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane.doe@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchView('LOGIN')}
                      className="text-primary-600 font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ─── 3. FORGOT PASSWORD VIEW (Email Input) ───────────────── */}
            {view === 'FORGOT_PASSWORD' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => switchView('LOGIN')}
                    className="text-slate-600 hover:text-slate-900 font-semibold"
                  >
                    ← Back to Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('RESET_PASSWORD')}
                    className="text-primary-600 hover:underline font-semibold"
                  >
                    Already have code?
                  </button>
                </div>
              </form>
            )}

            {/* ─── 4. RESET PASSWORD VIEW (OTP & New Password) ─────────── */}
            {view === 'RESET_PASSWORD' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none cursor-not-allowed"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit Verification Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-black tracking-widest text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Set New Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => switchView('FORGOT_PASSWORD')}
                    className="text-slate-600 hover:text-slate-900 font-semibold"
                  >
                    ← Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('LOGIN')}
                    className="text-primary-600 hover:underline font-semibold"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
