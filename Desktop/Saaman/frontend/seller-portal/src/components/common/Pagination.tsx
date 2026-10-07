import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationProps } from '../../hooks/usePagination.js';

export interface PaginationComponentProps extends PaginationProps {
  className?: string;
  itemLabel?: string;
  themeColor?: 'burgundy' | 'stone' | 'teal';
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
  itemLabel = 'items',
  themeColor = 'burgundy',
}) => {
  if (totalItems === 0) return null;

  const activeBtnBg =
    themeColor === 'burgundy'
      ? 'bg-[#641D26] text-white font-bold shadow-sm'
      : 'bg-stone-900 text-white font-bold shadow-sm';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-[#FAF7F3]/80 border-t border-[#ECE5DC] text-xs text-stone-500 ${className}`}
    >
      {/* Left side: Results counter & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-stone-600 font-medium text-xs">
          Showing <span className="font-bold text-stone-900">{startIndex}</span> to{' '}
          <span className="font-bold text-stone-900">{endIndex}</span> of{' '}
          <span className="font-bold text-stone-900">{totalItems}</span> {itemLabel}
          <span className="text-stone-400 ml-1.5 hidden md:inline font-normal">
            (Page {currentPage} of {totalPages})
          </span>
        </p>

        {pageSizeOptions && pageSizeOptions.length > 0 && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-[#ECE5DC]">
            <label htmlFor="pageSizeSelect" className="text-stone-400 font-medium hidden sm:inline text-xs">
              Per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2.5 py-1 bg-white border border-[#ECE5DC] rounded-xl font-bold text-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 cursor-pointer transition-all shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPreviousPage}
          title="Previous Page"
          className="inline-flex items-center justify-center p-1.5 rounded-xl border border-[#ECE5DC] bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((num, idx) => {
            if (num === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-stone-400 font-bold select-none text-xs"
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
                    : 'border border-transparent text-stone-600 hover:bg-white hover:border-[#ECE5DC] font-semibold'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNextPage}
          title="Next Page"
          className="inline-flex items-center justify-center p-1.5 rounded-xl border border-[#ECE5DC] bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
