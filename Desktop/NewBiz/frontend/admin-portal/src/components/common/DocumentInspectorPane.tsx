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
}

export interface DocumentInspectorPaneProps {
  document: InspectableDocument;
  documentsList?: InspectableDocument[];
  onSelectDocument?: (doc: InspectableDocument) => void;
  onClose: () => void;
  actionSlot?: React.ReactNode;
}

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
  const resolvedUrl = rawUrl
    ? rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `http://localhost:5000${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
    : '';

  const isPdf = resolvedUrl.toLowerCase().endsWith('.pdf') || resolvedUrl.includes('.pdf?');

  // Reset zoom & rotation when document changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setLoading(true);
    setLoadError(false);
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
      className={`h-full flex flex-col bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative select-none transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* ── Top Inspector HUD Bar ── */}
      <div className="px-5 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 z-20">
        
        {/* Left: Document Info & Index Nav */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-[#635BFF] flex items-center justify-center shrink-0 border border-indigo-500/30">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-white truncate">{document.title}</h3>
              {document.code && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {document.code}
                </span>
              )}
            </div>
            {document.documentNumber && (
              <p className="text-[10px] font-mono text-slate-400 truncate">
                Ref No: {document.documentNumber}
              </p>
            )}
          </div>

          {/* Quick Doc Stepper (if multiple) */}
          {documentsList.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 ml-2 pl-3 border-l border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={!hasPrevious}
                title="Previous Document"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-400 px-1">
                {currentIndex + 1} / {documentsList.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                title="Next Document"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center/Right: Interactive HUD Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Custom action slot (e.g. Verify / Reject buttons inside HUD) */}
          {actionSlot && <div className="mr-2">{actionSlot}</div>}

          {/* Zoom controls (Active for Images) */}
          {!isPdf && (
            <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom (100%)"
                className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-300 hover:text-white transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3.5}
                title="Zoom In"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Rotate 90deg button (Handles mobile upside-down uploads) */}
          {!isPdf && (
            <button
              type="button"
              onClick={handleRotate}
              title="Rotate 90° Clockwise"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <RotateCw className="w-3.5 h-3.5" />
              {rotation > 0 && <span className="text-[10px] font-mono">{rotation}°</span>}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors hidden md:flex"
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
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Close Inspection Canvas */}
          <button
            type="button"
            onClick={onClose}
            title="Close Inspection Canvas (Esc)"
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Document Canvas Viewport ── */}
      <div className="flex-1 overflow-auto relative bg-[#0b0f19] flex items-center justify-center p-4 min-h-[300px]">
        {/* Loading overlay */}
        {loading && !loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0b0f19]/80 backdrop-blur-xs text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-[#635BFF]" />
            <p className="text-xs font-semibold">Loading high-resolution document scan...</p>
          </div>
        )}

        {/* Error State */}
        {loadError || !resolvedUrl ? (
          <div className="p-8 text-center max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Document Unavailable</h4>
            <p className="text-xs text-slate-400 mb-4">
              The file could not be rendered inline or no file was uploaded by the applicant.
            </p>
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                download
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#635BFF] hover:bg-[#5147FF] text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
              >
                <Download className="w-3.5 h-3.5" /> Download File Directly
              </a>
            )}
          </div>
        ) : isPdf ? (
          /* PDF Viewer via Sandboxed Object / Iframe */
          <div className="w-full h-full min-h-[550px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
            <object
              data={`${resolvedUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              type="application/pdf"
              className="w-full h-full min-h-[550px]"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadError(true);
              }}
            >
              <div className="p-6 text-center text-slate-400">
                <p className="text-xs mb-3">Inline PDF preview is not supported by your browser.</p>
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#635BFF] text-white rounded-xl text-xs font-bold"
                >
                  Open PDF in New Window
                </a>
              </div>
            </object>
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
              className="rounded-xl shadow-2xl object-contain pointer-events-auto"
            />
          </div>
        )}
      </div>

      {/* ── Bottom Quick Switcher Strip (if multiple documents) ── */}
      {documentsList.length > 1 && (
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 z-20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 mr-1">
            Documents:
          </span>
          {documentsList.map((doc) => {
            const isCurrent = doc.id === document.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDocument && onSelectDocument(doc)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-[#635BFF] text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{doc.title}</span>
                {doc.verificationStatus === 'VERIFIED' || doc.verificationStatus === 'APPROVED' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ) : doc.verificationStatus === 'REJECTED' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
