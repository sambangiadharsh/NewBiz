import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Lock, Mail, Loader2, ArrowRight, KeyRound, Eye, EyeOff, UserPlus } from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { ApiResponse, AuthUser } from '../../types/auth.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!roles.includes('SELLER_USER')) {
          setError('Access denied: Your account does not have seller permissions. Administrators must use the Admin Portal.');
          setIsLoading(false);
          return;
        }

        setUser(res.data.data.user);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || 'Login failed. Please check your credentials.'
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

        {/* Clean White Card with Warm Borders matching reference */}
        <div className="bg-white border border-[#ECE5DC] rounded-3xl p-8 shadow-[0_15px_35px_rgba(70,20,27,0.04)]">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                Password
              </label>
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
        </div>

        <p className="text-center text-xs text-stone-400 mt-6 font-medium">
          Protected by Enterprise HTTP-only cookie authentication.
        </p>
      </div>
    </div>
  );
};
