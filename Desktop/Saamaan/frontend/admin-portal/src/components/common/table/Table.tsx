import React from 'react';
import { NoResults, NoResultsProps } from '../NoResults.js';

/* -------------------------------------------------------------------------- */
/*                               TABLE CONTEXT                                */
/* -------------------------------------------------------------------------- */
export interface TableContextType {
  bordered: boolean;
  striped: boolean;
}

export const TableContext = React.createContext<TableContextType>({
  bordered: true,
  striped: true,
});

/* -------------------------------------------------------------------------- */
/*                               TABLE CONTAINER                              */
/* -------------------------------------------------------------------------- */
export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
  height?: string;
  scrollClassName?: string;
  bordered?: boolean;
  striped?: boolean;
}

export const TableContainer: React.FC<TableContainerProps> = ({
  children,
  className = '',
  maxHeight,
  height,
  scrollClassName = '',
  bordered = true,
  striped = true,
  style,
  ...props
}) => {
  return (
    <TableContext.Provider value={{ bordered, striped }}>
      <div
        className={`rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden ${className}`}
        {...props}
      >
        <div
          className={`overflow-x-auto overflow-y-auto min-h-0 table-scrollbar ${scrollClassName}`}
          style={{
            maxHeight: height ? undefined : maxHeight,
            height: height || undefined,
            ...style,
          }}
        >
          {children}
        </div>
      </div>
    </TableContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    TABLE                                   */
/* -------------------------------------------------------------------------- */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean; // When true, vertical and horizontal lines clearly separate cells
  striped?: boolean;  // When true, alternate even rows with subtle cool mist tint
}

export const Table: React.FC<TableProps> = ({
  children,
  className = '',
  bordered = true,
  striped = true,
  ...props
}) => {
  return (
    <TableContext.Provider value={{ bordered, striped }}>
      <table
        className={`w-full text-left border-collapse border-spacing-0 text-xs ${className}`}
        {...props}
      >
        {children}
      </table>
    </TableContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                TABLE HEADER                                */
/* -------------------------------------------------------------------------- */
export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <thead
      className={`sticky top-0 z-20 bg-slate-100 border-b-2 border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] shadow-xs ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 TABLE HEAD (TH)                            */
/* -------------------------------------------------------------------------- */
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  align = 'left',
  className = '',
  ...props
}) => {
  const { bordered } = React.useContext(TableContext);
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const borderClass = bordered ? 'border-r border-slate-200 last:border-r-0' : '';

  return (
    <th
      className={`px-5 py-3.5 bg-slate-100 text-slate-700 font-extrabold tracking-wider select-none ${alignClass} ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 TABLE BODY                                 */
/* -------------------------------------------------------------------------- */
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  className?: string;
  striped?: boolean;
}

export const TableBody: React.FC<TableBodyProps> = ({
  children,
  className = '',
  striped,
  ...props
}) => {
  const tableCtx = React.useContext(TableContext);
  const effectiveCtx = striped !== undefined ? { ...tableCtx, striped } : tableCtx;

  return (
    <TableContext.Provider value={effectiveCtx}>
      <tbody
        className={`divide-y divide-slate-200 bg-white text-slate-700 ${className}`}
        {...props}
      >
        {children}
      </tbody>
    </TableContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                  TABLE ROW                                 */
/* -------------------------------------------------------------------------- */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  className?: string;
  isClickable?: boolean;
  isHeader?: boolean;
  isEven?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = '',
  isClickable = false,
  isHeader = false,
  isEven,
  ...props
}) => {
  const { striped } = React.useContext(TableContext);

  let bgClass = 'bg-white';
  if (!isHeader && striped) {
    if (isEven !== undefined) {
      bgClass = isEven ? 'bg-slate-50/40' : 'bg-white';
    } else {
      bgClass = 'odd:bg-white even:bg-slate-50/40';
    }
  }

  const hoverClass = !isHeader ? 'hover:bg-indigo-50/40 transition-colors duration-150' : '';
  const cursorClass = isClickable ? 'cursor-pointer' : '';

  return (
    <tr
      className={`${bgClass} ${hoverClass} ${cursorClass} group ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 TABLE CELL (TD)                            */
/* -------------------------------------------------------------------------- */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  className = '',
  ...props
}) => {
  const { bordered } = React.useContext(TableContext);
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const borderClass = bordered ? 'border-r border-slate-200 last:border-r-0' : '';

  return (
    <td
      className={`px-5 py-3.5 align-middle ${alignClass} ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
};

/* -------------------------------------------------------------------------- */
/*                               TABLE SKELETON                               */
/* -------------------------------------------------------------------------- */
export interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  columns,
  rows = 5,
}) => {
  const { bordered } = React.useContext(TableContext);
  const borderClass = bordered ? 'border-r border-slate-200 last:border-r-0' : '';

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => {
        const isEven = rowIndex % 2 === 1;
        return (
          <tr
            key={`skeleton-row-${rowIndex}`}
            className={`animate-pulse ${isEven ? 'bg-slate-50/65' : 'bg-white'}`}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td
                key={`skeleton-col-${colIndex}`}
                className={`px-5 py-4 ${borderClass}`}
              >
                <div
                  className="h-4 bg-slate-200/60 rounded-md"
                  style={{
                    width: `${60 + ((rowIndex + colIndex) % 4) * 10}%`,
                  }}
                />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 TABLE EMPTY                                */
/* -------------------------------------------------------------------------- */
export interface TableEmptyProps {
  columns: number;
  title?: string;
  description?: string;
  action?: NoResultsProps['action'];
}

export const TableEmpty: React.FC<TableEmptyProps> = ({
  columns,
  title,
  description,
  action,
}) => {
  return (
    <tr>
      <td colSpan={columns} className="py-12 px-4 text-center bg-white">
        <NoResults title={title} description={description} action={action} />
      </td>
    </tr>
  );
};
