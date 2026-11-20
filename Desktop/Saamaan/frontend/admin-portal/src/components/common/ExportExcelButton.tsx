import React from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

interface ExportExcelButtonProps {
  onClick: () => void | Promise<void>;
  isExporting?: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  onClick,
  isExporting = false,
  label = 'Export Excel',
  disabled = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isExporting}
      className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50/70 border border-emerald-200/80 rounded-xl hover:bg-emerald-100/70 hover:text-emerald-900 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
      title="Download as Excel XLSX spreadsheet"
    >
      {isExporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
      ) : (
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
      )}
      <span>{isExporting ? 'Exporting...' : label}</span>
    </button>
  );
};

export const ExportCsvButton = ExportExcelButton;

