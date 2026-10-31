import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowLeft, Home } from 'lucide-react';
import notFoundImg from '../../assets/seller404pagenotfound.png';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F3EFEA] flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden py-6 sm:py-8">
      {/* Background warm burgundy & rose radial glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 text-center flex flex-col items-center">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 mb-3.5 px-3.5 py-1 rounded-full bg-[#FDF2F4] border border-rose-200/80 shadow-xs">
          <div className="w-4 h-4 rounded-md bg-[#7E2532] flex items-center justify-center text-white">
            <Store className="w-3 h-3 text-rose-100" />
          </div>
          <span className="text-[11px] font-bold text-[#221C1E] tracking-wide">
            Seller<span className="text-[#7E2532]">Studio</span>
          </span>
        </div>

        {/* 404 Illustration Card */}
        <div className="w-full bg-white border border-[#ECE5DC] rounded-2xl p-6 sm:p-7 shadow-[0_12px_32px_rgba(70,20,27,0.05)] flex flex-col items-center">
          <div className="w-full max-w-[270px] sm:max-w-[310px] max-h-[210px] mb-4 overflow-hidden rounded-xl flex items-center justify-center">
            <img
              src={notFoundImg}
              alt="404 - Page Not Found"
              className="w-full h-auto max-h-[210px] object-contain select-none transition-transform duration-300 hover:scale-[1.02]"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#221C1E] tracking-tight mb-1.5">
            Storefront Missing?
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto mb-6 font-medium leading-relaxed">
            The seller page or resource you're searching for does not exist or may have been relocated.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#641D26] via-[#7E2532] to-[#9E2C3F] hover:from-[#52161E] hover:to-[#7E2532] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-950/20 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return to Seller Studio
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-[11px] text-stone-400 mt-3 font-medium">
          Error 404 • Resource Not Found
        </p>
      </div>
    </div>
  );
};
