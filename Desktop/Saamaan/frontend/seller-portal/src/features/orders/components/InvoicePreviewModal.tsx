import React, { useState, useEffect } from 'react';
import { FileText, Download, X, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/axios.js';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerOrderId: string | null;
  orderNumber: string | null;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  sellerOrderId,
  orderNumber,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;

    if (isOpen && sellerOrderId) {
      setLoading(true);
      setError(null);
      setPdfBlob(null);

      apiClient
        .get(`/seller/orders/${sellerOrderId}/invoice/pdf`, {
          responseType: 'blob',
        })
        .then((res) => {
          const blob = new Blob([res.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          currentUrl = url;
          setPdfBlob(blob);
          setPdfUrl(url);
          setLoading(false);
        })
        .catch(async (err) => {
          console.error('Failed to load invoice preview:', err);
          let msg = 'Failed to load invoice preview. Please try again.';
          if (err.response?.data instanceof Blob) {
            try {
              const text = await err.response.data.text();
              const parsed = JSON.parse(text);
              if (parsed.message) msg = parsed.message;
            } catch {
              // ignore
            }
          } else if (err.message) {
            msg = err.message;
          }
          setError(msg);
          setLoading(false);
        });
    }

    return () => {
      if (currentUrl) {
        window.URL.revokeObjectURL(currentUrl);
      }
    };
  }, [isOpen, sellerOrderId]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice-${orderNumber || sellerOrderId || 'order'}.pdf`);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-150 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900">Tax Invoice Preview</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-semibold">
                  B&amp;W Official
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-mono">
                Order: {orderNumber || sellerOrderId} &bull; www.saamaan.store
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-stone-200 hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Viewer */}
        <div className="flex-1 bg-stone-100/50 p-3 sm:p-4 overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-stone-500">
              <RefreshCw className="w-7 h-7 animate-spin text-black" />
              <span className="text-xs font-medium">Generating &amp; loading tax invoice...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center max-w-sm p-6 bg-white rounded-2xl border border-stone-200 shadow-sm">
              <AlertCircle className="w-8 h-8 text-rose-600" />
              <div className="text-xs font-semibold text-stone-900">Unable to preview invoice</div>
              <p className="text-[11px] text-stone-500">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-1.5 text-xs font-bold text-white bg-black rounded-xl hover:bg-stone-800"
              >
                Close
              </button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-2xl bg-white shadow-sm border border-stone-200"
              title={`Invoice-${orderNumber}`}
            />
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-stone-200 flex items-center justify-between bg-white">
          <div className="text-[11px] text-stone-500 hidden sm:block">
            Computer-generated invoice compliant with Indian GST Rule 46.
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              disabled={loading || !pdfBlob}
              className="px-5 py-2 text-xs font-bold text-white bg-black hover:bg-stone-800 rounded-xl shadow-sm inline-flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Invoice (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
