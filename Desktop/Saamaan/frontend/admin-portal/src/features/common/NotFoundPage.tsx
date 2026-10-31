import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Home } from 'lucide-react';
import notFoundImg from '../../assets/admin404notfound.png';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FE] flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden py-6 sm:py-8">
      {/* Subtle ambient light glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full relative z-10 text-center flex flex-col items-center">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full bg-indigo-50/80 border border-indigo-100/80 shadow-xs">
          <div className="w-4 h-4 rounded-md bg-[#635BFF] flex items-center justify-center text-white">
            <ShieldCheck className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 tracking-wide">
            Marketplace<span className="text-[#635BFF]">Admin</span>
          </span>
        </div>

        {/* 404 Illustration Card */}
        <div className="w-full bg-white border border-slate-100 rounded-3xl p-8 sm:p-9 shadow-[0_15px_35px_rgba(99,102,241,0.07)] flex flex-col items-center">
          <div className="w-full max-w-[300px] sm:max-w-[340px] max-h-[230px] mb-5 overflow-hidden rounded-2xl flex items-center justify-center">
            <img
              src={notFoundImg}
              alt="404 - Page Not Found"
              className="w-full h-auto max-h-[230px] object-contain select-none transition-transform duration-300 hover:scale-[1.02]"
            />
          </div>

          <h2 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight mb-2">
            Lost in the Marketplace?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-7 font-medium leading-relaxed">
            The page you're trying to reach doesn't exist, has been moved, or the link may be outdated.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#544CE6] hover:to-[#6B4BEB] text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return to Dashboard
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-[11px] text-slate-400 mt-3 font-medium">
          Error 404 • Resource Not Found
        </p>
      </div>
    </div>
  );
};
