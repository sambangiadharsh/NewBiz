import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Package,
  Heart,
  Clock,
  LogOut,
  MapPin,
  ShoppingBag,
} from 'lucide-react';
import { customerAuthApi } from '../../lib/authApi';

interface ProfilePageProps {
  user: { name: string; email: string } | null;
  onLogin: (name: string, email: string) => void;
  onLogout: () => void;
  onOpenWishlist: () => void;
  onOpenCart: () => void;
  onOpenTrackOrder: () => void;
  wishlistCount: number;
  cartCount: number;
}

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onLogin,
  onLogout,
  onOpenWishlist,
  onOpenCart,
  onOpenTrackOrder,
  wishlistCount,
  cartCount,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialView = (): AuthView => {
    if (location.pathname === '/register') return 'REGISTER';
    return 'LOGIN';
  };

  const [authView, setAuthView] = useState<AuthView>(getInitialView);

  useEffect(() => {
    if (location.pathname === '/register') {
      setAuthView('REGISTER');
    } else if (location.pathname === '/login') {
      setAuthView('LOGIN');
    }
  }, [location.pathname]);

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

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(false);
  };

  const switchView = (v: AuthView) => {
    resetFormState();
    setAuthView(v);
  };

  // 1. Handle Login
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
      setSuccessMessage('Successfully signed in! Welcome back.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Register (First Name, Last Name, Email, Password)
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
      setSuccessMessage('Account created successfully! Welcome to HESA.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await customerAuthApi.forgotPassword(email.trim());
      setSuccessMessage(res.message);
      setTimeout(() => switchView('RESET_PASSWORD'), 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Reset Password with OTP
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
      setErrorMessage(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-canvas min-h-screen py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {user ? (
          /* =========================================================================
             AUTHENTICATED CUSTOMER PROFILE DASHBOARD (FULL PAGE)
             ========================================================================= */
          <div className="space-y-8 animate-fade-in">
            {/* Top Profile Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-card flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 text-center sm:text-left">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary-700 via-primary-600 to-indigo-500 text-white flex items-center justify-center text-3xl font-black shadow-glow">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{user.name}</h1>
                   
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{user.email}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Customer Account</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={onLogout}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold text-xs flex items-center space-x-2 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                onClick={onOpenCart}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Shopping Bag</span>
                  <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">{cartCount} items</p>
                <span className="text-[11px] text-primary-600 font-semibold mt-1 inline-block">View bag →</span>
              </div>

              <div
                onClick={onOpenWishlist}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Wishlist</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Heart className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">{wishlistCount} saved</p>
                <span className="text-[11px] text-rose-600 font-semibold mt-1 inline-block">View wishlist →</span>
              </div>

              <div
                onClick={onOpenTrackOrder}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Order Tracking</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">Active</p>
                <span className="text-[11px] text-amber-600 font-semibold mt-1 inline-block">Track shipment →</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Account Security</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">Protected</p>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">256-bit SSL secured</span>
              </div>
            </div>

            {/* Account Details & Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-card space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <User className="w-4 h-4 text-primary-600" />
                  <span>Personal Information</span>
                </h3>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Full Name</span>
                    <span className="font-semibold text-slate-900">{user.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Email Address</span>
                    <span className="font-semibold text-slate-900">{user.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Account Type</span>
                    <span className="font-semibold text-slate-900">Direct Customer</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Security</span>
                    <span className="font-semibold text-emerald-600">Password Protected</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-card space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-primary-600" />
                  <span>Quick Navigation</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <button
                    onClick={() => navigate('/')}
                    className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between transition-colors"
                  >
                    <span>Browse Product Catalog</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => navigate('/faqs')}
                    className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between transition-colors"
                  >
                    <span>Help Center & FAQs</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => navigate('/contact')}
                    className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between transition-colors"
                  >
                    <span>Customer Support</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             STANDARD WEB PAGE SIGN IN / SIGN UP (NO OVERLAY MODAL)
             ========================================================================= */
          <div className="max-w-md mx-auto bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-card animate-fade-in">
            {/* Header Icon & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 mb-3 shadow-inner border border-primary-100/60">
                {authView === 'LOGIN' && <User className="w-6 h-6" />}
                {authView === 'REGISTER' && <ShieldCheck className="w-6 h-6" />}
                {(authView === 'FORGOT_PASSWORD' || authView === 'RESET_PASSWORD') && <KeyRound className="w-6 h-6" />}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {authView === 'LOGIN' && 'Sign In to HESA'}
                {authView === 'REGISTER' && 'Create Your Account'}
                {authView === 'FORGOT_PASSWORD' && 'Reset Password'}
                {authView === 'RESET_PASSWORD' && 'Enter Verification Code'}
              </h2>

              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {authView === 'LOGIN' && 'Access your orders, saved items, and personalized recommendations'}
                {authView === 'REGISTER' && 'Join thousands of members enjoying free express shipping and perks'}
                {authView === 'FORGOT_PASSWORD' && 'Enter your registered email and we will send a 6-digit verification code'}
                {authView === 'RESET_PASSWORD' && `Enter the 6-digit code sent to ${email} and choose a new password`}
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
            {authView === 'LOGIN' && (
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
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Don't have an account yet?{' '}
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
            {authView === 'REGISTER' && (
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
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
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

                <div className="text-center pt-3 border-t border-slate-100">
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
            {authView === 'FORGOT_PASSWORD' && (
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
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
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

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
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
            {authView === 'RESET_PASSWORD' && (
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
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-60"
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

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
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
