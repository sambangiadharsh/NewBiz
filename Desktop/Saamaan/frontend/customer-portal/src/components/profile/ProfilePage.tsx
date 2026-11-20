import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
  MapPin,
  ShoppingBag,
  LogOut,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { customerAuthApi } from '../../lib/authApi';

interface ProfilePageProps {
  user: { name: string; email: string } | null;
  onLogin: (name: string, email: string, token?: string, silent?: boolean) => void;
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

  // Edit Profile State
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordChange, setNewPasswordChange] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Guest Auth form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (location.pathname === '/register') {
      setAuthView('REGISTER');
    } else if (location.pathname === '/login') {
      setAuthView('LOGIN');
    }
  }, [location.pathname]);

  // Load customer profile details on mount
  useEffect(() => {
    if (user) {
      setLoadingProfile(true);
      customerAuthApi
        .getMe()
        .then((data) => {
          if (data) {
            setProfileFirstName(data.firstName || '');
            setProfileLastName(data.lastName || '');
            setProfilePhone(data.phoneNumber || '');
            setProfileEmail(data.email || user.email || '');
          }
        })
        .catch(() => {
          const parts = (user.name || '').split(' ');
          setProfileFirstName(parts[0] || '');
          setProfileLastName(parts.slice(1).join(' ') || '');
          setProfileEmail(user.email || '');
        })
        .finally(() => setLoadingProfile(false));
    }
  }, [user]);

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(false);
  };

  const switchView = (v: AuthView) => {
    resetFormState();
    setAuthView(v);
  };

  // Handle Edit Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFirstName.trim() || !profileLastName.trim()) {
      setProfileErrorMsg('First name and last name are required.');
      return;
    }

    setSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    try {
      const updated = await customerAuthApi.updateProfile({
        firstName: profileFirstName.trim(),
        lastName: profileLastName.trim(),
        phoneNumber: profilePhone.trim() || undefined,
      });

      const updatedFullName = `${updated.firstName} ${updated.lastName}`.trim();
      onLogin(updatedFullName, updated.email || user?.email || profileEmail, undefined, true);
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 3500);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Change Password Save
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordErrorMsg('Please enter your current password.');
      return;
    }
    if (newPasswordChange.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPasswordChange !== confirmPassword) {
      setPasswordErrorMsg('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    try {
      await customerAuthApi.changePassword({
        currentPassword,
        newPassword: newPasswordChange,
      });
      setPasswordSuccessMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPasswordChange('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 3500);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Guest Authentication Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

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
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-canvas min-h-screen py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {user ? (
          /* =========================================================================
             AUTHENTICATED CUSTOMER PROFILE DASHBOARD (PROFILE & SETTINGS)
             ========================================================================= */
          <div className="space-y-8 animate-fade-in">
            {/* Top Profile Header Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-card flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 text-center sm:text-left">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary-700 via-primary-600 to-primary-500 text-white flex items-center justify-center text-3xl font-black shadow-glow shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{user.name}</h1>
                  <p className="text-xs text-slate-500 mt-1">{user.email}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Customer Account</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={onLogout}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 hover:border-rose-200 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. Go to Dedicated Orders Page */}
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-xs hover:border-primary-400 hover:shadow-md transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 group-hover:text-primary-700">My Orders</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-2">Track & Invoices</p>
                <span className="text-[11px] text-amber-600 font-semibold mt-1 inline-block">View Orders →</span>
              </button>

              {/* 2. Go to Dedicated Saved Addresses Page */}
              <button
                type="button"
                onClick={() => navigate('/addresses')}
                className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-xs hover:border-blue-400 hover:shadow-md transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 group-hover:text-blue-700">Delivery Addresses</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-2">Saved Locations</p>
                <span className="text-[11px] text-blue-600 font-semibold mt-1 inline-block">Manage Pins →</span>
              </button>

              {/* 3. Wishlist */}
              <div
                onClick={onOpenWishlist}
                className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 group-hover:text-rose-600">Saved Wishlist</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Heart className="w-4 h-4 fill-rose-50" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">{wishlistCount} saved</p>
                <span className="text-[11px] text-rose-600 font-semibold mt-1 inline-block">View Wishlist →</span>
              </div>

              {/* 4. Shopping Bag */}
              <div
                onClick={onOpenCart}
                className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 group-hover:text-primary-700">Shopping Bag</span>
                  <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </p>
                <span className="text-[11px] text-primary-600 font-semibold mt-1 inline-block">View Bag →</span>
              </div>
            </div>

            {/* Profile Information & Security Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ─── Edit Personal Profile Card ─────────────────────────── */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-primary-600" />
                    <span>Update Profile</span>
                  </h3>

                </div>

                {profileSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}

                {profileErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{profileErrorMsg}</span>
                  </div>
                )}

                {loadingProfile ? (
                  <div className="py-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600 mb-2" />
                    <p className="text-xs">Loading profile details...</p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          value={profileFirstName}
                          onChange={(e) => setProfileFirstName(e.target.value)}
                          placeholder="e.g. Rahul"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={profileLastName}
                          onChange={(e) => setProfileLastName(e.target.value)}
                          placeholder="e.g. Sharma"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                      <div className="relative">
                        <input
                          type="email"
                          readOnly
                          value={profileEmail || user.email}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-100/70 text-xs text-slate-500 cursor-not-allowed font-medium"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                          Account Primary
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Email is your primary login credential and cannot be changed here.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 font-semibold"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        {savingProfile ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save Profile Changes</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* ─── Change Password Card ───────────────────────────────── */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary-600" />
                    <span>Reset Password</span>
                  </h3>
                  
                </div>

                {passwordSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}

                {passwordErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{passwordErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current Password *</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">New Password *</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPasswordChange}
                        onChange={(e) => setNewPasswordChange(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
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
                {authView === 'LOGIN' && 'Sign In to Saamaan'}
                {authView === 'REGISTER' && 'Create Your Account'}
                {authView === 'FORGOT_PASSWORD' && 'Reset Password'}
                {authView === 'RESET_PASSWORD' && 'Enter Verification Code'}
              </h2>

              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {authView === 'LOGIN' && 'Access your personalized orders, wishlist, and fast checkout.'}
                {authView === 'REGISTER' && 'Join Saamaan to unlock seamless ordering and member perks.'}
                {authView === 'FORGOT_PASSWORD' && 'Enter your registered email and we will send a 6-digit OTP code.'}
                {authView === 'RESET_PASSWORD' && `Enter the 6-digit code sent to ${email} and set a new password.`}
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
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 1. LOGIN FORM */}
            {authView === 'LOGIN' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none pl-9"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => switchView('FORGOT_PASSWORD')}
                      className="text-[11px] font-semibold text-primary-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none pl-9 pr-9"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign In</span>}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <div className="text-center pt-2 text-xs text-slate-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('REGISTER')}
                    className="text-primary-600 font-bold hover:underline"
                  >
                    Register here
                  </button>
                </div>
              </form>
            )}

            {/* 2. REGISTER FORM */}
            {authView === 'REGISTER' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Rahul"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none pl-9"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none pl-9"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Create Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none pl-9 pr-9"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Create Account</span>}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <div className="text-center pt-2 text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('LOGIN')}
                    className="text-primary-600 font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {/* 3. FORGOT PASSWORD */}
            {authView === 'FORGOT_PASSWORD' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registered Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none pl-9"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Reset OTP</span>}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <div className="text-center pt-2 text-xs text-slate-500">
                  Remember password?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('LOGIN')}
                    className="text-primary-600 font-bold hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* 4. RESET PASSWORD */}
            {authView === 'RESET_PASSWORD' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">6-Digit Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-center tracking-widest font-mono text-base font-bold focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Reset Password & Login</span>}
                </button>

                <div className="text-center pt-2 text-xs text-slate-500">
                  Didn't receive code?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('FORGOT_PASSWORD')}
                    className="text-primary-600 font-bold hover:underline"
                  >
                    Resend Code
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



