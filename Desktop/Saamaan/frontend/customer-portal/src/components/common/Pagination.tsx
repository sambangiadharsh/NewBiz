import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export interface PaginationProps {
  /** 1-based current page index */
  currentPage: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Number of items displayed per page */
  pageSize: number;
  /** Callback fired when user changes page */
  onPageChange: (page: number) => void;
  /** Optional callback fired when page size is changed */
  onPageSizeChange?: (pageSize: number) => void;
  /** Available page size options (e.g. [12, 24, 48]) */
  pageSizeOptions?: number[];
  /** Number of sibling pages to show on each side of current page (default: 1) */
  siblingCount?: number;
  /** Whether to show "Showing X-Y of Z items" counter */
  showItemCount?: boolean;
  /** Whether to show page size selector dropdown */
  showPageSizeSelector?: boolean;
  /** Whether to show fast jump to first/last buttons */
  showFirstLastButtons?: boolean;
  /** Disabled state (e.g. during loading) */
  disabled?: boolean;
  /** Optional custom class name */
  className?: string;
}

export const DOTS = '...';

function range(start: number, end: number): number[] {
  const length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
}

/**
 * Sliding window range calculation for pagination.
 * Ensures the component always renders a clean, compact sequence with ellipsis:
 * e.g., [1, '...', 4, 5, 6, '...', 20]
 */
export function usePaginationRange({
  totalCount,
  pageSize,
  siblingCount = 1,
  currentPage,
}: {
  totalCount: number;
  pageSize: number;
  siblingCount?: number;
  currentPage: number;
}): (number | string)[] {
  return useMemo(() => {
    const totalPageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const totalPageNumbers = siblingCount * 2 + 5;

    // Case 1: Total pages less than the slots needed -> show all pages without dots
    if (totalPageNumbers >= totalPageCount) {
      return range(1, totalPageCount);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPageCount);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    // Case 2: No left dots to show, but right dots exist
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = range(1, leftItemCount);
      return [...leftRange, DOTS, totalPageCount];
    }

    // Case 3: No right dots to show, but left dots exist
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = range(totalPageCount - rightItemCount + 1, totalPageCount);
      return [firstPageIndex, DOTS, ...rightRange];
    }

    // Case 4: Both left and right dots exist
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }

    return range(1, totalPageCount);
  }, [totalCount, pageSize, siblingCount, currentPage]);
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [12, 24, 48],
  siblingCount = 1,
  showItemCount = true,
  showPageSizeSelector = true,
  showFirstLastButtons = true,
  disabled = false,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginationRange = usePaginationRange({
    totalCount: totalItems,
    pageSize,
    siblingCount,
    currentPage,
  });

  // Calculate item range e.g. "Showing 1–12 of 48 products"
  const fromItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  const handlePageClick = (page: number) => {
    if (disabled || page === currentPage || page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 select-none ${className}`}
    >
      {/* Left info: Items summary count */}
      {showItemCount && (
        <div className="text-xs font-semibold text-slate-500 order-2 sm:order-1 text-center sm:text-left">
          Showing <span className="font-extrabold text-slate-900">{fromItem}</span>–
          <span className="font-extrabold text-slate-900">{toItem}</span> of{' '}
          <span className="font-extrabold text-slate-900">{totalItems}</span> products
          {totalPages > 1 && (
            <span className="text-slate-400 font-normal ml-1">
              (Page {currentPage} of {totalPages})
            </span>
          )}
        </div>
      )}

      {/* Center: Numeric Navigation Controls */}
      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        {/* Jump to first page */}
        {showFirstLastButtons && totalPages > 4 && (
          <button
            type="button"
            onClick={() => handlePageClick(1)}
            disabled={disabled || currentPage === 1}
            aria-label="Go to first page"
            className="p-2 rounded-xl border border-stone-200/90 bg-white text-slate-600 hover:bg-stone-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}

        {/* Previous page button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={disabled || currentPage === 1}
          aria-label="Go to previous page"
          className="flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-200/90 bg-white text-slate-700 hover:bg-stone-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline">Prev</span>
        </button>

        {/* Page number buttons */}
        <div className="flex items-center gap-1">
          {paginationRange.map((pageNumber, idx) => {
            if (pageNumber === DOTS) {
              return (
                <span
                  key={`dots-${idx}`}
                  className="w-8 h-9 flex items-center justify-center text-xs font-extrabold text-slate-400 select-none"
                  aria-hidden="true"
                >
                  &#8230;
                </span>
              );
            }

            const page = Number(pageNumber);
            const isActive = page === currentPage;

            return (
              <button
                key={page}
                type="button"
                onClick={() => handlePageClick(page)}
                disabled={disabled}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Page ${page}`}
                className={`min-w-9 h-9 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0B1E1F] text-white shadow-sm border border-[#0B1E1F] scale-[1.02]'
                    : 'bg-white text-slate-700 border border-stone-200/90 hover:bg-stone-50 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next page button */}
        <button
          type="button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={disabled || currentPage === totalPages}
          aria-label="Go to next page"
          className="flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-200/90 bg-white text-slate-700 hover:bg-stone-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <span className="hidden md:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Jump to last page */}
        {showFirstLastButtons && totalPages > 4 && (
          <button
            type="button"
            onClick={() => handlePageClick(totalPages)}
            disabled={disabled || currentPage === totalPages}
            aria-label="Go to last page"
            className="p-2 rounded-xl border border-stone-200/90 bg-white text-slate-600 hover:bg-stone-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right controls: Page Size Selector */}
      {showPageSizeSelector && onPageSizeChange && (
        <div className="flex items-center gap-2 order-3">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden lg:inline">
            Show per page:
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={disabled}
            aria-label="Products per page"
            className="bg-white border border-stone-200/90 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
};
