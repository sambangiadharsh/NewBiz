import pdfmake from 'pdfmake';
import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces.js';
import { inboundShipmentsRepository } from './inbound-shipments.repository.js';

// Configure built-in standard fonts and security policies
pdfmake.fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => true);

/**
 * Utility: Convert numeric Indian Rupee amounts into Words (e.g. "One Thousand Five Hundred Rupees Only")
 */
function numberToWordsINR(amount: number): string {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  }

  const rounded = Math.round(Math.abs(amount));
  if (rounded === 0) return 'Zero Rupees Only';

  let remaining = rounded;
  let words = '';

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  const hundredPlus = remaining;

  if (crore > 0) words += convertChunk(crore) + ' Crore ';
  if (lakh > 0) words += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) words += convertChunk(thousand) + ' Thousand ';
  if (hundredPlus > 0) words += convertChunk(hundredPlus) + ' ';

  return words.trim() + ' Rupees Only';
}

function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

function formatCurrency(amount: number): string {
  return 'Rs. ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class GrnPdfService {
  async generateGrnPdf(shipmentId: bigint): Promise<{ buffer: Buffer; grnNumber: string; shipmentNumber: string }> {
    const data = await inboundShipmentsRepository.getInboundShipmentGRNDetails(shipmentId);
    if (!data) {
      throw new Error('Inbound shipment not found');
    }

    if (!data.grnNumber && data.status !== 'RECEIVED' && data.status !== 'DISCREPANCY') {
      throw new Error('Cannot generate GRN PDF for a shipment that has not been received yet');
    }

    const grnNo = data.grnNumber || `GRN-${data.shipmentNumber}`;
    const grnDateFormatted = formatDate(data.grnDate || data.receivedAt || new Date());
    const isDiscrepancy = data.status === 'DISCREPANCY';

    // Build Table Body
    const tableBody: TableCell[][] = [
      [
        { text: '#', bold: true, fontSize: 8, alignment: 'center', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'PRODUCT & SKU', bold: true, fontSize: 8, fillColor: '#0f766e', color: '#ffffff' },
        { text: 'DECLARED', bold: true, fontSize: 8, alignment: 'right', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'RECEIVED', bold: true, fontSize: 8, alignment: 'right', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'DAMAGED', bold: true, fontSize: 8, alignment: 'right', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'SHORTAGE', bold: true, fontSize: 8, alignment: 'right', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'RATE (Rs.)', bold: true, fontSize: 8, alignment: 'right', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'TOTAL (Rs.)', bold: true, fontSize: 8, alignment: 'right', fillColor: '#0f766e', color: '#ffffff' },
        { text: 'QC REMARKS', bold: true, fontSize: 8, fillColor: '#0f766e', color: '#ffffff' },
      ],
    ];

    let totalExpected = 0;
    let totalReceived = 0;
    let totalDamaged = 0;
    let totalShortage = 0;
    let totalVerifiedValue = 0;

    data.items.forEach((item, index) => {
      const exp = Number(item.expectedQuantity || 0);
      const rec = Number(item.receivedQuantity || 0);
      const dmg = Number(item.damagedQuantity || 0);
      const shrt = Number(item.shortageQuantity || 0);
      const rate = Number(item.purchasePrice || 0);
      const lineTotal = rec * rate;

      totalExpected += exp;
      totalReceived += rec;
      totalDamaged += dmg;
      totalShortage += shrt;
      totalVerifiedValue += lineTotal;

      tableBody.push([
        { text: String(index + 1), fontSize: 7.5, alignment: 'center' },
        {
          stack: [
            { text: item.productName, fontSize: 7.5, bold: true },
            {
              text: `Seller SKU: ${item.sellerSku || '—'}`,
              fontSize: 6.5,
              color: '#64748b',
              margin: [0, 1, 0, 0],
            },
          ],
        },
        { text: String(exp), fontSize: 7.5, alignment: 'right' },
        { text: String(rec), fontSize: 7.5, alignment: 'right', bold: true, color: '#047857' },
        { text: String(dmg), fontSize: 7.5, alignment: 'right', color: dmg > 0 ? '#b91c1c' : '#64748b' },
        { text: String(shrt), fontSize: 7.5, alignment: 'right', color: shrt > 0 ? '#d97706' : '#64748b' },
        { text: formatCurrency(rate), fontSize: 7.5, alignment: 'right' },
        { text: formatCurrency(lineTotal), fontSize: 7.5, alignment: 'right', bold: true },
        { text: item.remarks || '—', fontSize: 7, color: '#475569' },
      ]);
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 30, 30, 30],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 8,
        color: '#1e293b',
      },
      content: [
        // 1. HEADER BRAND & TITLE
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'SAAMAAN LOGISTICS & FULFILLMENT', bold: true, fontSize: 13, color: '#0f766e' },
                { text: 'Warehouse Goods Receiving & Quality Inspection System', fontSize: 8, color: '#64748b', margin: [0, 1, 0, 0] },
              ],
            },
            {
              width: 220,
              stack: [
                { text: 'GOODS RECEIVED NOTE', bold: true, fontSize: 13, alignment: 'right', color: '#0f766e' },
                { text: `GRN REF: ${grnNo}`, bold: true, fontSize: 8.5, alignment: 'right', margin: [0, 2, 0, 0] },
                {
                  text: `STATUS: ${data.status}`,
                  bold: true,
                  fontSize: 8,
                  alignment: 'right',
                  color: isDiscrepancy ? '#b91c1c' : '#047857',
                  margin: [0, 1, 0, 0],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 12],
        },

        // 2. FACILITY & SELLER INFO BOX
        {
          table: {
            widths: ['50%', '50%'],
            body: [
              [
                { text: 'RECEIVING WAREHOUSE FACILITY', bold: true, fontSize: 8, fillColor: '#f8fafc', color: '#0f766e' },
                { text: 'SELLER / SUPPLIER DETAILS', bold: true, fontSize: 8, fillColor: '#f8fafc', color: '#0f766e' },
              ],
              [
                {
                  stack: [
                    { text: data.warehouse.warehouseName, bold: true, fontSize: 8.5 },
                    { text: `Code: ${data.warehouse.warehouseCode}`, fontSize: 7.5, color: '#64748b' },
                    {
                      text: `${data.warehouse.addressLine1 || ''}${data.warehouse.addressLine2 ? ', ' + data.warehouse.addressLine2 : ''}`,
                      fontSize: 7.5,
                      margin: [0, 1, 0, 0],
                    },
                    { text: `${data.warehouse.city || ''}, ${data.warehouse.state || ''} - ${data.warehouse.postalCode || ''}`, fontSize: 7.5 },
                    { text: `Contact: ${data.warehouse.contactPersonName || 'Operations'} (${data.warehouse.contactPhoneNumber || 'N/A'})`, fontSize: 7, color: '#64748b', margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 4, 0, 4],
                },
                {
                  stack: [
                    { text: data.seller.businessName || data.seller.sellerName, bold: true, fontSize: 8.5 },
                    { text: `Seller Code: ${data.seller.sellerCode}`, fontSize: 7.5, color: '#64748b' },
                    { text: `Email: ${data.seller.email || 'N/A'}`, fontSize: 7.5, margin: [0, 1, 0, 0] },
                    { text: `Phone: ${data.seller.phoneNumber || 'N/A'}`, fontSize: 7.5 },
                  ],
                  margin: [0, 4, 0, 4],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
          },
          margin: [0, 0, 0, 10],
        },

        // 3. LOGISTICS & INBOUND SUMMARY
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                {
                  stack: [
                    { text: 'Shipment Number', bold: true, fontSize: 7, color: '#64748b' },
                    { text: data.shipmentNumber, bold: true, fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
                {
                  stack: [
                    { text: 'Carrier / Transporter', bold: true, fontSize: 7, color: '#64748b' },
                    { text: data.carrierName || 'Self Transport', fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
                {
                  stack: [
                    { text: 'Tracking / AWB #', bold: true, fontSize: 7, color: '#64748b' },
                    { text: data.trackingNumber || 'N/A', fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
                {
                  stack: [
                    { text: 'Cartons / Boxes', bold: true, fontSize: 7, color: '#64748b' },
                    { text: `${data.boxCount} Boxes`, fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
              ],
              [
                {
                  stack: [
                    { text: 'GRN Date', bold: true, fontSize: 7, color: '#64748b' },
                    { text: grnDateFormatted, bold: true, fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
                {
                  stack: [
                    { text: 'Dispatched Date', bold: true, fontSize: 7, color: '#64748b' },
                    { text: formatDate(data.dispatchedAt), fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
                {
                  stack: [
                    { text: 'PO Number', bold: true, fontSize: 7, color: '#64748b' },
                    { text: data.poNumber || '—', fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
                {
                  stack: [
                    { text: 'Supplier Invoice #', bold: true, fontSize: 7, color: '#64748b' },
                    { text: data.supplierInvoiceNumber || '—', fontSize: 8, margin: [0, 2, 0, 0] },
                  ],
                  margin: [0, 3, 0, 3],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
          },
          margin: [0, 0, 0, 12],
        },

        // 4. LINE ITEMS TABLE
        {
          table: {
            headerRows: 1,
            widths: [15, '*', 45, 45, 45, 45, 50, 55, 60],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
          },
          margin: [0, 0, 0, 10],
        },

        // 5. SUMMARY TOTALS BOX
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'VERIFIED GOODS VALUE IN WORDS:', bold: true, fontSize: 7.5, color: '#0f766e' },
                { text: numberToWordsINR(totalVerifiedValue), bold: true, fontSize: 8.5, margin: [0, 2, 0, 6] },
                {
                  text: data.notes ? `Receiving Notes: ${data.notes}` : 'Receiving Notes: None provided.',
                  fontSize: 7.5,
                  color: '#64748b',
                  italics: true,
                },
              ],
            },
            {
              width: 220,
              table: {
                widths: ['*', 65],
                body: [
                  [
                    { text: 'Total Declared Units:', fontSize: 7.5 },
                    { text: String(totalExpected), bold: true, fontSize: 7.5, alignment: 'right' },
                  ],
                  [
                    { text: 'Good Units (Credited to Stock):', fontSize: 7.5, color: '#047857' },
                    { text: String(totalReceived), bold: true, fontSize: 7.5, alignment: 'right', color: '#047857' },
                  ],
                  [
                    { text: 'Damaged Units (Quarantined):', fontSize: 7.5, color: totalDamaged > 0 ? '#b91c1c' : '#64748b' },
                    { text: String(totalDamaged), bold: true, fontSize: 7.5, alignment: 'right', color: totalDamaged > 0 ? '#b91c1c' : '#64748b' },
                  ],
                  [
                    { text: 'Shortage Units (Missing):', fontSize: 7.5, color: totalShortage > 0 ? '#d97706' : '#64748b' },
                    { text: String(totalShortage), bold: true, fontSize: 7.5, alignment: 'right', color: totalShortage > 0 ? '#d97706' : '#64748b' },
                  ],
                  [
                    { text: 'Total Verified Goods Value:', bold: true, fontSize: 8, fillColor: '#f0fdfa' },
                    { text: formatCurrency(totalVerifiedValue), bold: true, fontSize: 8, alignment: 'right', fillColor: '#f0fdfa', color: '#0f766e' },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#cbd5e1',
              },
            },
          ],
          margin: [0, 0, 0, 16],
        },

        // 6. DIGITAL CERTIFICATION & AUDIT FOOTER
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  fillColor: '#f8fafc',
                  stack: [
                    {
                      text: 'DIGITAL AUDIT VERIFICATION & CERTIFICATION',
                      bold: true,
                      fontSize: 8,
                      color: '#0f766e',
                    },
                    {
                      text: 'This is an authentic system-generated Goods Received Note (GRN) digitally verified, certified, and committed to warehouse inventory in Saamaan WMS. All physical stock counts have been audited upon dock receiving. No physical signature is required.',
                      fontSize: 7,
                      color: '#475569',
                      margin: [0, 2, 0, 0],
                    },
                    {
                      text: `Digital Verification Timestamp: ${new Date().toUTCString()} | Status: DIGITALLY CERTIFIED | Ledger Audit: COMMITTED`,
                      fontSize: 6.5,
                      bold: true,
                      color: '#047857',
                      margin: [0, 3, 0, 0],
                    },
                  ],
                  margin: [4, 6, 4, 6],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
          },
        },
      ],
    };

    const pdfBuffer = await pdfmake.createPdf(docDefinition).getBuffer();

    return {
      buffer: pdfBuffer,
      grnNumber: grnNo,
      shipmentNumber: data.shipmentNumber,
    };
  }
}

export const grnPdfService = new GrnPdfService();

