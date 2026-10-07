import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode = 200): Response => {
  const payload: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
  };
  return res.status(statusCode).json(payload);
};

export const sendPaginated = <T>(
  res: Response,
  items: T[],
  page: number,
  pageSize: number,
  totalCount: number,
  message?: string,
  statusCode = 200
): Response => {
  const totalPages = Math.ceil(totalCount / pageSize);
  const meta: PaginationMeta = {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  const payload: ApiResponse<PaginatedData<T>> = {
    success: true,
    ...(message ? { message } : {}),
    data: {
      items,
      meta,
    },
  };
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 500,
  details?: unknown
): Response => {
  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return res.status(statusCode).json(payload);
};
