import { Response } from 'express';

export interface CsvColumn<T = any> {
  header: string;
  key: string;
  transform?: (value: any, row: T) => string | number | null | undefined;
}

/**
 * Escapes a single CSV value following RFC 4180 rules:
 * - Null / undefined become empty string
 * - Wraps in quotes if value contains quotes, commas, or newlines
 * - Replaces any internal double quote with two double quotes
 */
export function escapeCsvField(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }

  let str: string;
  if (val instanceof Date) {
    str = val.toISOString();
  } else if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Streams data directly into the HTTP response as an RFC 4180 compliant CSV download.
 * Emits UTF-8 BOM so Microsoft Excel cleanly opens characters without encoding errors.
 * Constant O(1) memory consumption.
 */
export async function streamCsvExport<T>(
  res: Response,
  options: {
    filename: string;
    columns: CsvColumn<T>[];
    fetchChunk: (offset: number, limit: number) => Promise<T[]>;
    chunkSize?: number;
  }
): Promise<void> {
  const { filename, columns, fetchChunk, chunkSize = 500 } = options;

  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // UTF-8 Byte Order Mark (BOM) for Excel
  res.write('\uFEFF');

  // Header Row
  const headerLine = columns.map((col) => escapeCsvField(col.header)).join(',') + '\r\n';
  res.write(headerLine);

  let offset = 0;
  while (true) {
    const records = await fetchChunk(offset, chunkSize);
    if (!records || records.length === 0) {
      break;
    }

    let chunkOutput = '';
    for (const row of records) {
      const line = columns
        .map((col) => {
          const raw = (row as any)[col.key];
          const val = col.transform ? col.transform(raw, row) : raw;
          return escapeCsvField(val);
        })
        .join(',');
      chunkOutput += line + '\r\n';
    }

    res.write(chunkOutput);
    offset += records.length;

    if (records.length < chunkSize) {
      break;
    }
  }

  res.end();
}

