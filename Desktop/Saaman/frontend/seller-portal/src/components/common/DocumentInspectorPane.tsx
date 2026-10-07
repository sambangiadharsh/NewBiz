import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  RefreshCw,
  Download,
} from 'lucide-react';

export interface InspectableDocument {
  id: string | number;
  title: string;
  code?: string;
  url?: string | null;
  documentNumber?: string;
  isMandatory?: boolean;
  verificationStatus?: 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'PENDING' | 'PENDING_APPROVAL';
  rejectionReason?: string;
}

export interface DocumentInspectorPaneProps {
  document: InspectableDocument;
  documentsList?: InspectableDocument[];
  onSelectDocument?: (doc: InspectableDocument) => void;
  onClose: () => void;
  actionSlot?: React.ReactNode;
}

export const resolveDocumentUrl = (rawUrl?: string | null): string => {
  if (!rawUrl) return '';
  const normalized = rawUrl.replace(/\\/g, '/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${apiBase}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
};

export const DocumentInspectorPane: React.FC<DocumentInspectorPaneProps> = ({
  document,
  documentsList = [],
  onSelectDocument,
  onClose,
  actionSlot,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute resolved absolute URL
  const rawUrl = document.url || '';
  const resolvedUrl = resolveDocumentUrl(rawUrl);

  const isPdf =
    resolvedUrl.toLowerCase().endsWith('.pdf') ||
    resolvedUrl.toLowerCase().includes('.pdf?') ||
    resolvedUrl.toLowerCase().includes('.pdf#');

  // Reset zoom & rotation when document changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setLoading(true);
    setLoadError(false);

    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [document.id, resolvedUrl]);

  // Handle keyboard shortcuts (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Navigation between documents
  const currentIndex = documentsList.findIndex((d) => d.id === document.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < documentsList.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onSelectDocument) {
      onSelectDocument(documentsList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectDocument) {
      onSelectDocument(documentsList[currentIndex + 1]);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (window.document.exitFullscreen) {
        window.document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col bg-white rounded-3xl overflow-hidden border border-[#E8E1D7] shadow-sm relative select-none transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* ── Top Inspector HUD Bar (Light Luxury Theme) ── */}
      <div className="px-5 py-3.5 bg-white/95 backdrop-blur-md border-b border-[#E8E1D7] flex items-center justify-between gap-3 shrink-0 z-20">
        
        {/* Left: Document Info & Index Nav */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#7E2532] flex items-center justify-center shrink-0 border border-rose-200/70">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-stone-900 truncate">{document.title}</h3>
              {document.code && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FAF8F5] text-stone-700 border border-[#E8E1D7] shrink-0">
                  {document.code}
                </span>
              )}
            </div>
            {document.documentNumber && (
              <p className="text-[10px] font-mono text-stone-500 truncate">
                Ref: {document.documentNumber}
              </p>
            )}
          </div>

          {/* Quick Doc Stepper (if multiple) */}
          {documentsList.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 ml-2 pl-3 border-l border-[#E8E1D7] shrink-0">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={!hasPrevious}
                title="Previous Document"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold text-stone-500 px-1">
                {currentIndex + 1} / {documentsList.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                title="Next Document"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center/Right: Interactive Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {actionSlot && <div className="mr-2">{actionSlot}</div>}

          {/* Zoom controls */}
          {!isPdf && (
            <div className="flex items-center bg-[#FAF8F5] rounded-xl p-0.5 border border-[#E8E1D7]">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom (100%)"
                className="px-2 py-0.5 text-[11px] font-mono font-bold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3.5}
                title="Zoom In"
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Rotate 90deg */}
          {!isPdf && (
            <button
              type="button"
              onClick={handleRotate}
              title="Rotate 90° Clockwise"
              className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-[#E8E1D7] transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#7E2532]" />
              {rotation > 0 && <span className="text-[10px] font-mono">{rotation}°</span>}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-[#E8E1D7] transition-colors hidden md:flex cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Raw File Link */}
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              title="Open raw file in new tab"
              className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-[#E8E1D7] transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Close Inspection Canvas */}
          <button
            type="button"
            onClick={onClose}
            title="Close Inspection Canvas (Esc)"
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#641D26] border border-rose-200 transition-colors ml-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Document Canvas Viewport (Soft Warm Ivory Paper Canvas) ── */}
      <div className="flex-1 overflow-auto relative bg-[#F4F1EA] flex items-center justify-center p-4 min-h-[300px]">
        {/* Loading overlay */}
        {loading && !loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-xs text-stone-600">
            <RefreshCw className="w-8 h-8 animate-spin text-[#7E2532]" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading high-resolution document scan...</p>
          </div>
        )}

        {/* Error / Empty State */}
        {loadError || !resolvedUrl ? (
          <div className="p-8 text-center max-w-sm bg-white rounded-3xl border border-[#E8E1D7] shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-stone-900 mb-1">Document Scan Pending</h4>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              No proof file has been uploaded yet for this compliance requirement. You can upload it using the left panel.
            </p>
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#641D26] hover:bg-[#7E2532] text-white text-xs font-bold transition-all shadow-md shadow-rose-900/10 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Uploaded File
              </a>
            )}
          </div>
        ) : isPdf ? (
          /* PDF Viewer via Iframe */
          <div className="w-full h-full min-h-[550px] rounded-2xl overflow-hidden bg-white border border-[#E8E1D7] shadow-md">
            <iframe
              src={`${resolvedUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              title={document.title}
              className="w-full h-full min-h-[550px] border-0"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadError(true);
              }}
            />
          </div>
        ) : (
          /* Image Canvas with Pan, Zoom, and Rotation */
          <div
            className="w-full h-full flex items-center justify-center overflow-auto p-2"
            style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
          >
            <img
              src={resolvedUrl}
              alt={document.title}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadError(true);
              }}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                maxWidth: zoom === 1 ? '100%' : 'none',
                maxHeight: zoom === 1 ? '100%' : 'none',
              }}
              className="rounded-2xl shadow-xl border border-stone-200/80 object-contain pointer-events-auto bg-white"
            />
          </div>
        )}
      </div>

      {/* ── Bottom Quick Switcher Strip (if multiple documents) ── */}
      {documentsList.length > 1 && (
        <div className="px-4 py-2.5 bg-white border-t border-[#E8E1D7] flex items-center gap-2 overflow-x-auto shrink-0 z-20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 shrink-0 mr-1">
            Documents:
          </span>
          {documentsList.map((doc) => {
            const isCurrent = doc.id === document.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDocument && onSelectDocument(doc)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#7E2532] text-white shadow-sm border border-[#641D26]'
                    : 'bg-[#FAF8F5] text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-[#E8E1D7]'
                }`}
              >
                <span>{doc.title}</span>
                {doc.verificationStatus === 'VERIFIED' || doc.verificationStatus === 'APPROVED' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ) : doc.verificationStatus === 'REJECTED' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
