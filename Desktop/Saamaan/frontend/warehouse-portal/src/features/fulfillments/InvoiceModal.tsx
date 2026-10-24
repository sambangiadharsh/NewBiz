import React, { useState, useEffect } from 'react';
import { FileText, Download, X, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  fulfillmentId: string | null;
  orderNumber: string | null;
  invoiceNumber?: string | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  fulfillmentId,
  orderNumber,
  invoiceNumber,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;

    if (isOpen && fulfillmentId) {
      setLoading(true);
      setError(null);
      setPdfBlob(null);

      apiClient
        .get(`/warehouses/my-warehouse/fulfillments/${fulfillmentId}/invoice/pdf`, {
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
  }, [isOpen, fulfillmentId]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `Invoice-${invoiceNumber || orderNumber || fulfillmentId || 'order'}.pdf`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0C6E7E] border border-teal-200 flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Tax Invoice</h3>
                {invoiceNumber && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-teal-50 text-[#0C6E7E] border border-teal-200 font-semibold">
                    {invoiceNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Order: {orderNumber || `ORD-${fulfillmentId}`} &bull; Verified Warehouse Dispatch Copy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / PDF Viewer */}
        <div className="flex-1 bg-slate-100/60 p-3 sm:p-4 overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2.5 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0C6E7E]" />
              <span className="text-xs font-semibold text-slate-700">Loading invoice document...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2.5 text-center max-w-sm p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
              <AlertCircle className="w-7 h-7 text-rose-600" />
              <div className="text-xs font-bold text-slate-900">Unable to load invoice</div>
              <p className="text-[11px] text-slate-500">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 px-3 py-1.5 text-xs font-bold text-white bg-[#0C6E7E] hover:bg-[#095663] rounded-lg transition"
              >
                Close
              </button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-xl bg-white shadow-xs border border-slate-200"
              title={`Invoice-${invoiceNumber || orderNumber}`}
            />
          ) : null}
        </div>

        {/* Modal Footer with Download Button */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-white">
          <div className="text-[11px] text-slate-400 hidden sm:block font-medium">
            Official GST tax invoice formatted for printing & customer packaging.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              disabled={loading || !pdfBlob}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#0C6E7E] hover:bg-[#095663] rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
