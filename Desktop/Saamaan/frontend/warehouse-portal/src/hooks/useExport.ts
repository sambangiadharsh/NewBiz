import { useState } from 'react';
import { apiClient } from '../lib/axios.js';
import { showSweetToast } from '../lib/swal.js';

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);

  const downloadXlsx = async (
    endpoint: string,
    params: Record<string, any> = {},
    fallbackFilename = 'export.xlsx'
  ) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await apiClient.get(endpoint, {
        params,
        responseType: 'blob',
      });

      let filename = fallbackFilename;
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
      }

      if (!filename.endsWith('.xlsx')) {
        filename += '.xlsx';
      }

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSweetToast('Excel spreadsheet downloaded successfully', 'success');
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      showSweetToast('Failed to export Excel file. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return { downloadXlsx, downloadCsv: downloadXlsx, isExporting };
}
