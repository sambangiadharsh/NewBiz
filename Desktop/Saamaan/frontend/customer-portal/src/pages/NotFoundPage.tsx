import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  ArrowLeft,
  ShoppingBag,
} from 'lucide-react';
import notFoundIllustration from '../assets/404_notfound.png';

interface NotFoundPageProps {
  onOpenTrackOrder?: () => void;
  onOpenHelp?: () => void;
  onSearchSubmit?: (query: string, category: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-canvas">
      <div className="max-w-xl w-full text-center space-y-5 animate-fade-in">
        {/* 404 Illustration with subtle glow */}
        <div className="relative inline-block mx-auto group">
          <div className="absolute -inset-4 bg-primary-100/40 rounded-full blur-2xl -z-10 transition-all duration-500 group-hover:bg-primary-200/50" />
          <img
            src={notFoundIllustration}
            alt="404 Page Not Found - Saamaan Storefront"
            className="w-full max-w-[280px] sm:max-w-[320px] max-h-[230px] h-auto object-contain mx-auto drop-shadow-sm select-none pointer-events-none transition-transform duration-300 hover:scale-[1.02]"
            loading="eager"
          />
        </div>

        {/* Messaging */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-primary-100 text-primary-800 border border-primary-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-pulse" />
            Error 404 • Page Not Found
          </div>

        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-900 hover:bg-dark-800 text-white text-xs sm:text-sm font-bold tracking-wide shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-canvas-subtle text-dark-800 border border-dark-900/15 text-xs sm:text-sm font-bold tracking-wide shadow-subtle transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>

         
        </div>
      </div>
    </div>
  );
};
