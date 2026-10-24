import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, ArrowLeft, Home } from 'lucide-react';
import notFoundImg from '../../assets/warehouse404pagenotfound.png';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F4F8F9] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
      {/* Background soft teal & cyan glowing radial accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full relative z-10 text-center flex flex-col items-center">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-100/80 shadow-sm">
          <div className="w-5 h-5 rounded-lg bg-[#0C6E7E] flex items-center justify-center text-white">
            <Warehouse className="w-3.5 h-3.5 text-teal-100" />
          </div>
          <span className="text-xs font-bold text-slate-800 tracking-wide">
            Warehouse<span className="text-[#0C6E7E]">Hub</span>
          </span>
        </div>

        {/* 404 Illustration Card */}
        <div className="w-full bg-white border border-[#E1EFF0] rounded-3xl p-6 sm:p-10 shadow-[0_15px_35px_rgba(12,110,126,0.06)] flex flex-col items-center">
          <div className="w-full max-w-sm sm:max-w-md mb-6 overflow-hidden rounded-2xl">
            <img
              src={notFoundImg}
              alt="404 - Page Not Found"
              className="w-full h-auto object-contain select-none transition-transform duration-300 hover:scale-[1.02]"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
            Page Not Found
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 font-medium leading-relaxed">
            The warehouse operations page you requested is not available.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0C6E7E] via-[#0E7A8A] to-[#14B8A6] hover:from-[#085562] hover:to-[#0C6E7E] text-white font-bold text-sm shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 transition-all duration-200"
            >
              <Home className="w-4 h-4" />
              Return to Operations
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-xs text-slate-400 mt-6 font-medium">
          Error 404 • Resource Not Found
        </p>
      </div>
    </div>
  );
};
