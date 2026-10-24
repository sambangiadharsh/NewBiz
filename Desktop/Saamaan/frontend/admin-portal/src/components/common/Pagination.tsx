import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationProps } from '../../hooks/usePagination.js';

export interface PaginationComponentProps extends PaginationProps {
  className?: string;
  itemLabel?: string;
  themeColor?: 'indigo' | 'burgundy' | 'teal';
}

export const Pagination: React.FC<PaginationComponentProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  pageSizeOptions,
  pageNumbers,
  canPreviousPage,
  canNextPage,
  onPageChange,
  onPageSizeChange,
  className = '',
  itemLabel = 'results',
  themeColor = 'indigo',
}) => {
  if (totalItems === 0) return null;

  const activeBtnBg =
    themeColor === 'burgundy'
      ? 'bg-[#641D26] text-white font-black shadow-md shadow-[#641D26]/20'
      : themeColor === 'teal'
      ? 'bg-teal-600 text-white font-black shadow-md shadow-teal-600/20'
      : 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/20';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white border-t border-slate-100 text-xs text-slate-500 rounded-b-3xl ${className}`}
    >
      {/* Left side: Results counter & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-slate-600 font-medium">
          Showing <span className="font-bold text-slate-900">{startIndex}</span> to{' '}
          <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
          <span className="font-bold text-slate-900">{totalItems}</span> {itemLabel}
          <span className="text-slate-400 ml-1.5 hidden md:inline font-normal">
            (Page {currentPage} of {totalPages})
          </span>
        </p>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <label htmlFor="pageSizeSelect" className="text-slate-400 font-medium hidden sm:inline">
            Per page:
          </label>
          <select
            id="pageSizeSelect"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right side: Page Navigation */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPreviousPage}
          title="Previous Page"
          className="inline-flex items-center justify-center p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((num, idx) => {
            if (num === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-slate-400 font-bold select-none"
                >
                  ...
                </span>
              );
            }

            const isActive = num === currentPage;

            return (
              <button
                key={num}
                onClick={() => onPageChange(num as number)}
                className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs transition-all ${
                  isActive
                    ? activeBtnBg
                    : 'border border-transparent text-slate-600 hover:bg-slate-100 font-bold'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNextPage}
          title="Next Page"
          className="inline-flex items-center justify-center p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
