import React from 'react';
import { Pagination } from './Pagination.js';
import { PaginationProps } from '../../hooks/usePagination.js';
import { NoResults } from './NoResults.js';

export interface ColumnDef<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  paginationProps?: PaginationProps;
  keyExtractor?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  expandedRowRender?: (row: T) => React.ReactNode;
  expandedRowId?: string | number | null;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  skeletonRowCount = 5,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no records matching your criteria.',
  paginationProps,
  keyExtractor = (_, idx) => idx,
  onRowClick,
  expandedRowRender,
  expandedRowId,
  className = '',
}: DataTableProps<T>) {
  // Cyclic widths for realistic shimmering skeleton rows
  const skeletonWidths = ['w-3/4', 'w-1/2', 'w-4/5', 'w-2/3', 'w-3/5', 'w-5/6'];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Table Container with clear row & column grid division */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header: Defined borders between headers */}
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              {columns.map((col, idx) => {
                const alignClass =
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                const isLastCol = idx === columns.length - 1;
                return (
                  <th
                    key={idx}
                    style={{ width: col.width }}
                    className={`py-3.5 px-4 font-semibold border-r border-slate-200 ${
                      isLastCol ? 'border-r-0' : ''
                    } ${alignClass} ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {isLoading ? (
              // Senior Software Engineer Grade Shimmers & Skeleton Rows
              Array.from({ length: skeletonRowCount }).map((_, rIdx) => (
                <tr
                  key={`skeleton-row-${rIdx}`}
                  className="border-b border-slate-200 last:border-b-0 animate-pulse bg-white hover:bg-slate-50/30"
                >
                  {columns.map((col, cIdx) => {
                    const isLastCol = cIdx === columns.length - 1;
                    const alignClass =
                      col.align === 'right'
                        ? 'justify-end'
                        : col.align === 'center'
                        ? 'justify-center'
                        : 'justify-start';
                    const widthClass = skeletonWidths[(rIdx + cIdx) % skeletonWidths.length];

                    return (
                      <td
                        key={`skeleton-cell-${rIdx}-${cIdx}`}
                        className={`py-4 px-4 border-r border-slate-200 ${
                          isLastCol ? 'border-r-0' : ''
                        }`}
                      >
                        <div className={`flex items-center ${alignClass}`}>
                          <div className="space-y-1.5 w-full">
                            {/* Realistic Shimmer Bars */}
                            <div
                              className={`h-3.5 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-md ${widthClass}`}
                            />
                            {/* Subtle secondary shimmer line on wider / primary cells */}
                            {cIdx <= 1 && (
                              <div
                                className={`h-2.5 bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 rounded-md ${
                                  rIdx % 2 === 0 ? 'w-1/3' : 'w-2/5'
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-14 text-center">
                  <NoResults title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => {
                const rowKey = keyExtractor(row, rowIdx);
                const isExpanded = expandedRowId !== undefined && expandedRowId === rowKey;

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      onClick={() => onRowClick?.(row)}
                      className={`border-b border-slate-200 last:border-b-0 transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-slate-50/90' : 'hover:bg-slate-50/60'
                      } ${isExpanded ? 'bg-teal-50/30' : ''}`}
                    >
                      {columns.map((col, colIdx) => {
                        const isLastCol = colIdx === columns.length - 1;
                        const alignClass =
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                        const cellContent = col.cell
                          ? col.cell(row, rowIdx)
                          : col.accessorKey
                          ? String(row[col.accessorKey] ?? '')
                          : null;

                        return (
                          <td
                            key={colIdx}
                            className={`py-3.5 px-4 text-slate-700 font-medium border-r border-slate-200 ${
                              isLastCol ? 'border-r-0' : ''
                            } ${alignClass} ${col.className || ''}`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Optional Expandable Child Row */}
                    {isExpanded && expandedRowRender && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={columns.length} className="p-4 bg-slate-50/50">
                          {expandedRowRender(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Integrated Reusable Pagination */}
      {paginationProps && paginationProps.totalItems > 0 && (
        <Pagination {...paginationProps} themeColor="teal" />
      )}
    </div>
  );
}
