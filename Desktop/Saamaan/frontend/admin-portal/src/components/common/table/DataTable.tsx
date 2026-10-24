import React from 'react';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  TableEmpty,
} from './Table.js';
import { Pagination, PaginationComponentProps } from '../Pagination.js';

export interface ColumnDef<T> {
  id?: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (info: { row: T; index: number }) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  loading?: boolean;
  isLoading?: boolean; // Convenient alias for loading
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  pagination?: PaginationComponentProps;
  onRowClick?: (item: T) => void;
  bordered?: boolean; // Default true: crisp lines separating rows & columns
  striped?: boolean;  // Default true: alternating subtle cool tint on even rows
  maxHeight?: string; // Default '600px': generous table height with smooth vertical scrolling
  height?: string;    // Explicit fixed height, e.g. '600px'
  className?: string;
  containerClassName?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  isLoading,
  skeletonRows = 5,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination,
  onRowClick,
  bordered = true,
  striped = true,
  maxHeight = '600px',
  height,
  className = '',
  containerClassName = '',
}: DataTableProps<T>) {
  const isDataLoading = isLoading !== undefined ? isLoading : loading;
  const colCount = columns.length;

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden ${containerClassName}`}
    >
      {/* Scrollable table body with fixed/capped height & sticky header */}
      <div
        className="overflow-x-auto overflow-y-auto flex-1 min-h-0 relative table-scrollbar"
        style={{
          maxHeight: height ? undefined : maxHeight,
          height: height || undefined,
        }}
      >
        <Table bordered={bordered} striped={striped} className={className}>
          <TableHeader>
            <TableRow isHeader>
              {columns.map((col, idx) => (
                <TableHead
                  key={col.id || (col.accessorKey ? String(col.accessorKey) : `col-${idx}`)}
                  align={col.align}
                  className={`${col.headerClassName || ''} ${col.className || ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isDataLoading ? (
              <TableSkeleton columns={colCount} rows={skeletonRows} />
            ) : data.length === 0 ? (
              <TableEmpty
                columns={colCount}
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
              />
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={keyExtractor(item, index)}
                  isClickable={!!onRowClick}
                  isEven={index % 2 === 1}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((col, cIdx) => {
                    let cellContent: React.ReactNode = null;
                    if (col.cell) {
                      cellContent = col.cell({ row: item, index });
                    } else if (col.accessorKey) {
                      const val = item[col.accessorKey];
                      cellContent = val !== undefined && val !== null ? String(val) : '—';
                    }

                    return (
                      <TableCell
                        key={col.id || (col.accessorKey ? String(col.accessorKey) : `cell-${cIdx}`)}
                        align={col.align}
                        className={col.className}
                      >
                        {cellContent}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pinned Pagination Bar at the bottom of the fixed table */}
      {pagination && (
        <div className="shrink-0">
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}
