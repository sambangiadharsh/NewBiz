import React from 'react';
import { cn } from '../../lib/utils';

export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function TableContainer({ children, className, footer, ...props }: TableContainerProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-[#ECE5DC] shadow-card overflow-hidden flex flex-col',
        className
      )}
      {...props}
    >
      <div className="overflow-x-auto relative w-full scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
        {children}
      </div>
      {footer && <div className="border-t border-[#ECE5DC] bg-[#FAF7F3]/70 px-4 py-3">{footer}</div>}
    </div>
  );
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  className?: string;
}

export function Table({ className, ...props }: TableProps) {
  return (
    <table
      className={cn('w-full text-left text-xs border-collapse font-sans', className)}
      {...props}
    />
  );
}

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn(
        'bg-[#FAF7F3] border-b border-[#ECE5DC] text-stone-600 uppercase tracking-wider text-[11px] font-bold select-none',
        className
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableHead({ className, align = 'left', ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'py-3.5 px-4 whitespace-nowrap',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    />
  );
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn('divide-y divide-stone-100 font-normal text-stone-700', className)}
      {...props}
    />
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string;
  isSelected?: boolean;
  isClickable?: boolean;
}

export function TableRow({ className, isSelected, isClickable, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'group transition-colors duration-150',
        isSelected ? 'bg-burgundy-50/40' : 'hover:bg-[#FDFBF7]',
        isClickable && 'cursor-pointer',
        className
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableCell({ className, align = 'left', ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'py-3.5 px-4 align-middle leading-relaxed',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    />
  );
}

export interface TableEmptyProps {
  colSpan: number;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function TableEmpty({
  colSpan,
  message = 'No data found',
  description,
  icon,
  action,
}: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-14 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
          {icon && <div className="mb-3 text-stone-400">{icon}</div>}
          <p className="text-sm font-bold text-stone-700">{message}</p>
          {description && <p className="text-xs text-stone-400 mt-1 leading-relaxed">{description}</p>}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </td>
    </tr>
  );
}

export interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-stone-100 last:border-0 animate-pulse">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-4">
              <div
                className="h-4 bg-stone-200/60 rounded-md"
                style={{ width: `${Math.max(45, (cIdx * 23 + 55) % 100)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
