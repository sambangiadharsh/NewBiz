import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string | null;
  title?: string;
  code?: string;
}

export const getDocFileUrl = (relativeUrl?: string | null): string => {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  const backendBase = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api(\/v1)?\/?$/, '')
    : 'http://localhost:7000';
  return `${backendBase}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
};

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  documentUrl,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !documentUrl) return null;

  const fullUrl = getDocFileUrl(documentUrl);
  const lowerUrl = fullUrl.toLowerCase();
  const isPdf = /\.pdf($|\?)/i.test(lowerUrl) || fullUrl.includes('application/pdf');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Into/Cross Mark (Close Button) */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg z-10 hover:scale-105"
        title="Close (Esc)"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Content Container (Image / PDF preview) */}
      <div
        className="relative max-w-4xl max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <iframe
            src={`${fullUrl}#toolbar=0`}
            className="w-[85vw] max-w-4xl h-[85vh] rounded-2xl bg-white shadow-2xl border border-white/20"
            title="Document Preview"
          />
        ) : (
          <img
            src={fullUrl}
            alt="Document Preview"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};
