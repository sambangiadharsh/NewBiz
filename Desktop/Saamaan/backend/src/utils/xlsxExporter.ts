import { Response } from 'express';
import ExcelJS from 'exceljs';

export interface XlsxColumn<T = any> {
  header: string;
  key: string;
  width?: number;
  transform?: (value: any, row: T) => any;
}

/**
 * Universal streaming XLSX (Excel) export utility.
 * Streams data directly into the Express Response using ExcelJS.stream.xlsx.WorkbookWriter
 * to maintain O(1) constant memory footprint regardless of dataset size.
 */
export async function streamXlsxExport<T>(
  res: Response,
  options: {
    filename: string;
    sheetName?: string;
    columns: XlsxColumn<T>[];
    fetchChunk: (offset: number, limit: number) => Promise<T[]>;
    chunkSize?: number;
  }
): Promise<void> {
  const { filename, sheetName = 'Export Data', columns, fetchChunk, chunkSize = 500 } = options;

  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(safeFilename)}"`
  );
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: true,
  });

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row
  });

  // Configure Columns & Widths
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 5, 14),
  }));

  // Style Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark slate
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.commit();

  let offset = 0;
  while (true) {
    const records = await fetchChunk(offset, chunkSize);
    if (!records || records.length === 0) {
      break;
    }

    for (const record of records) {
      const rowData: Record<string, any> = {};
      for (const col of columns) {
        const raw = (record as any)[col.key];
        const val = col.transform ? col.transform(raw, record) : raw;
        rowData[col.key] = val !== undefined ? val : null;
      }

      const row = worksheet.addRow(rowData);
      row.height = 20;
      row.font = { name: 'Segoe UI', size: 9 };
      row.alignment = { vertical: 'middle' };
      row.commit();
    }

    offset += records.length;
    if (records.length < chunkSize) {
      break;
    }
  }

  await worksheet.commit();
  await workbook.commit();
}

