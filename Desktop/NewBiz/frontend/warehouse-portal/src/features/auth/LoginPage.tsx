import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, Lock, Mail, Loader2, ArrowRight, KeyRound, Eye, EyeOff } from 'lucide-react';
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
        if (!roles.includes('WAREHOUSE_USER') && !roles.includes('SUPER_ADMIN')) {
          setError('Access denied: Your account is not authorized as warehouse operations staff.');
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
    setEmail('warehouse@test.com');
    setPassword('warehouse123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F8F9] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background soft teal & cyan glowing radial accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Header Logo matching reference teal palette */}
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Password
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
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-[#0C6E7E] via-[#0E7A8A] to-[#14B8A6] hover:from-[#085562] hover:to-[#0C6E7E] disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 transition-all duration-200"
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
              className="inline-flex items-center gap-1.5 text-xs text-[#0C6E7E] hover:text-[#085562] transition-colors font-bold"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Fill test credentials (warehouse@test.com / warehouse123)
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          Protected by Enterprise HTTP-only cookie authentication.
        </p>
      </div>
    </div>
  );
};
