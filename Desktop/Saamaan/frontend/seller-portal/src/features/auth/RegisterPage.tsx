import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Store,
  Lock,
  Mail,
  User,
  Phone,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { ApiResponse, AuthUser } from '../../types/auth.js';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setUser } = useAuthStore();

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!firstName.trim() || firstName.trim().length < 2) {
      errs.firstName = 'First name must be at least 2 characters';
    }
    if (!lastName.trim()) {
      errs.lastName = 'Last name is required';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid email address';
    }
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phoneNumber = 'Enter a valid 10-digit mobile number (e.g. 9876543210)';
    }
    if (!password || password.length < 6) {
      errs.password = 'Password must be at least 6 characters long';
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim().replace(/\D/g, ''),
        password,
      };

      const res = await apiClient.post<ApiResponse<{ accessToken: string; user: AuthUser }>>(
        '/auth/seller/register',
        payload
      );

      if (res.data.success && res.data.data) {
        setUser(res.data.data.user);
        // Direct the newly registered seller immediately into the Onboarding Wizard
        navigate('/onboarding', { replace: true });
      } else {
        setError(res.data.error?.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to register seller account. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#641D26] to-[#7E2532] text-white shadow-xl shadow-rose-950/20 mb-3">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Create Seller Account
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
          Start selling on our marketplace with automated onboarding
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-stone-200/80 shadow-[0_12px_40px_rgba(40,20,10,0.04)]">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  First Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: '' });
                    }}
                    placeholder="First name"
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-[#F3EFEA] border rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium ${
                      fieldErrors.firstName ? 'border-rose-400' : 'border-[#E0D8CD]'
                    }`}
                  />
                </div>
                {fieldErrors.firstName && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: '' });
                  }}
                  placeholder="Last name"
                  className={`w-full px-3.5 py-2.5 bg-[#F3EFEA] border rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium ${
                    fieldErrors.lastName ? 'border-rose-400' : 'border-[#E0D8CD]'
                  }`}
                />
                {fieldErrors.lastName && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                  }}
                  placeholder="seller@example.com"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-[#F3EFEA] border rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium ${
                    fieldErrors.email ? 'border-rose-400' : 'border-[#E0D8CD]'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Mobile Phone Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                Mobile Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (fieldErrors.phoneNumber) setFieldErrors({ ...fieldErrors, phoneNumber: '' });
                  }}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-[#F3EFEA] border rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium ${
                    fieldErrors.phoneNumber ? 'border-rose-400' : 'border-[#E0D8CD]'
                  }`}
                />
              </div>
              {fieldErrors.phoneNumber && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phoneNumber}</p>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                    }}
                    placeholder="Min 6 characters"
                    className={`w-full pl-10 pr-11 py-2.5 bg-[#F3EFEA] border rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium ${
                      fieldErrors.password ? 'border-rose-400' : 'border-[#E0D8CD]'
                    }`}
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
                {fieldErrors.password && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Confirm Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword)
                        setFieldErrors({ ...fieldErrors, confirmPassword: '' });
                    }}
                    placeholder="Repeat password"
                    className={`w-full pl-10 pr-11 py-2.5 bg-[#F3EFEA] border rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all font-medium ${
                      fieldErrors.confirmPassword ? 'border-rose-400' : 'border-[#E0D8CD]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full !mt-6 py-3.5 px-4 bg-gradient-to-r from-[#641D26] via-[#7E2532] to-[#9E2C3F] hover:from-[#52161E] hover:to-[#7E2532] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-rose-950/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Seller Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Already have an account */}
          <div className="mt-6 pt-6 border-t border-stone-100 text-center text-xs">
            <span className="text-stone-500 font-medium">Already have an active seller account? </span>
            <Link
              to="/login"
              className="font-bold text-[#7E2532] hover:text-[#52161E] transition-colors ml-1"
            >
              Sign In to SellerStudio
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6 font-medium">
          Protected by Enterprise HTTP-only cookie authentication.
        </p>
      </div>
    </div>
  );
};
