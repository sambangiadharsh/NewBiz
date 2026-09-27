import { useState, useMemo, useEffect } from 'react';

export interface UsePaginationOptions<T> {
  data?: T[];
  totalItems?: number;
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSizeOptions: number[];
  pageNumbers: (number | '...')[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface UsePaginationReturn<T> {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  paginatedData: T[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  pageNumbers: (number | '...')[];
  setPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  paginationProps: PaginationProps;
}

export function usePagination<T = any>({
  data,
  totalItems: customTotalItems,
  initialPage = 1,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: UsePaginationOptions<T> = {}): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = customTotalItems !== undefined ? customTotalItems : data?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const setPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
    onPageChange?.(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setPage(currentPage - 1);
    }
  };

  const setPageSize = (newSize: number) => {
    setPageSizeState(newSize);
    setCurrentPage(1);
    onPageSizeChange?.(newSize);
    onPageChange?.(1);
  };

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  const pageNumbers = useMemo<(number | '...')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [currentPage, totalPages]);

  const canPreviousPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  const paginationProps: PaginationProps = {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    startIndex: totalItems === 0 ? 0 : startIndex + 1,
    endIndex,
    pageSizeOptions,
    pageNumbers,
    canPreviousPage,
    canNextPage,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  };

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    paginatedData,
    canPreviousPage,
    canNextPage,
    pageNumbers,
    setPage,
    nextPage,
    previousPage,
    setPageSize,
    paginationProps,
  };
}
