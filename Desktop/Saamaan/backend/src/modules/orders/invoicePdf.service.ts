import pdfmake from 'pdfmake';
import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces.js';
import { ordersRepository } from './orders.repository.js';

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

function formatCurrency(val?: number | string | null): string {
  const num = Number(val) || 0;
  return 'INR ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class InvoicePdfService {
  /**
   * Generates a fully compliant GST Tax Invoice PDF binary buffer
   * using pdfmake in strict Monochrome (Black & White).
   */
  async generateInvoicePdf(sellerId: bigint | number, sellerOrderId: bigint | number): Promise<{
    buffer: Buffer;
    invoiceNumber: string;
    orderNumber: string;
  }> {
    const data = await ordersRepository.getOrCreateInvoice(sellerId, sellerOrderId);
    const { order, items, invoice } = data;

    const isIntraState = Boolean(invoice.isIntraState);
    const trackingUrl = `https://www.saamaan.store/orders/track/${order.OrderNumber || order.OrderID}`;
    const amountInWords = numberToWordsINR(invoice.totalAmount);

    // Build Table Body in strict Black & White
    const tableBody: TableCell[][] = [];

    // Header Row: Black background, white bold text
    if (isIntraState) {
      tableBody.push([
        { text: '#', style: 'th', alignment: 'center' },
        { text: 'Description & SKU', style: 'th' },
        { text: 'HSN', style: 'th', alignment: 'center' },
        { text: 'Qty', style: 'th', alignment: 'center' },
        { text: 'Unit Rate', style: 'th', alignment: 'right' },
        { text: 'Taxable', style: 'th', alignment: 'right' },
        { text: 'CGST', style: 'th', alignment: 'right' },
        { text: 'SGST', style: 'th', alignment: 'right' },
        { text: 'Total', style: 'th', alignment: 'right' },
      ]);
    } else {
      tableBody.push([
        { text: '#', style: 'th', alignment: 'center' },
        { text: 'Description & SKU', style: 'th' },
        { text: 'HSN', style: 'th', alignment: 'center' },
        { text: 'Qty', style: 'th', alignment: 'center' },
        { text: 'Unit Rate', style: 'th', alignment: 'right' },
        { text: 'Taxable', style: 'th', alignment: 'right' },
        { text: 'IGST', style: 'th', alignment: 'right' },
        { text: 'Total', style: 'th', alignment: 'right' },
      ]);
    }

    // Line Item Rows
    items.forEach((item: any, idx: number) => {
      const lineTaxable = Number(item.lineTaxable ?? (Number(item.UnitPrice) * Number(item.Quantity)));
      const title = item.ProductTitle || item.ProductName || 'Merchandise Item';
      const sku = item.VariantSKU ? `SKU: ${item.VariantSKU}` : '';
      const hsn = item.HSNCode || '—';
      const qty = String(item.Quantity);
      const unitRate = formatCurrency(item.UnitPrice);
      const taxableStr = formatCurrency(lineTaxable);
      const lineTotal = formatCurrency(item.lineTotal ?? item.TotalAmount);

      if (isIntraState) {
        const cgstInfo = `${item.cgstRate || 0}%\n(${formatCurrency(item.cgstAmount || 0)})`;
        const sgstInfo = `${item.sgstRate || 0}%\n(${formatCurrency(item.sgstAmount || 0)})`;
        tableBody.push([
          { text: String(idx + 1), alignment: 'center', style: 'td' },
          {
            text: [
              { text: title + '\n', bold: true },
              { text: sku, fontSize: 7, color: '#000000' },
            ],
            style: 'td',
          },
          { text: hsn, alignment: 'center', style: 'td' },
          { text: qty, alignment: 'center', style: 'td', bold: true },
          { text: unitRate, alignment: 'right', style: 'td' },
          { text: taxableStr, alignment: 'right', style: 'td' },
          { text: cgstInfo, alignment: 'right', style: 'td', fontSize: 7 },
          { text: sgstInfo, alignment: 'right', style: 'td', fontSize: 7 },
          { text: lineTotal, alignment: 'right', style: 'td', bold: true },
        ]);
      } else {
        const igstInfo = `${item.igstRate || 0}%\n(${formatCurrency(item.igstAmount || 0)})`;
        tableBody.push([
          { text: String(idx + 1), alignment: 'center', style: 'td' },
          {
            text: [
              { text: title + '\n', bold: true },
              { text: sku, fontSize: 7, color: '#000000' },
            ],
            style: 'td',
          },
          { text: hsn, alignment: 'center', style: 'td' },
          { text: qty, alignment: 'center', style: 'td', bold: true },
          { text: unitRate, alignment: 'right', style: 'td' },
          { text: taxableStr, alignment: 'right', style: 'td' },
          { text: igstInfo, alignment: 'right', style: 'td', fontSize: 7 },
          { text: lineTotal, alignment: 'right', style: 'td', bold: true },
        ]);
      }
    });

    // Delivery & COD Row (if applicable)
    if (invoice.shippingAmount > 0) {
      let deliveryRowText = 'Delivery Charges';
      if (invoice.shippingAmount === 78) {
        deliveryRowText = 'Delivery Charges (INR 49.00) + Cash on Delivery (COD) Fee (INR 29.00)';
      } else if (invoice.shippingAmount === 29) {
        deliveryRowText = 'Delivery Charges (FREE) + Cash on Delivery (COD) Fee (INR 29.00)';
      }

      const colSpan = isIntraState ? 8 : 7;
      tableBody.push([
        {
          colSpan,
          text: deliveryRowText,
          style: 'td',
          bold: true,
          color: '#000000',
        },
        ...Array(colSpan - 1).fill({ text: '' }),
        { text: formatCurrency(invoice.shippingAmount), alignment: 'right', style: 'td', bold: true },
      ]);
    }

    const colWidths = isIntraState
      ? [20, '*', 38, 26, 62, 62, 54, 54, 68]
      : [20, '*', 45, 28, 68, 68, 62, 74];

    // Pre-build typed totals table in strict Black & White
    const totalsTableBody: TableCell[][] = [
      [
        { text: 'Items Taxable Value:', color: '#000000', fontSize: 8 },
        { text: formatCurrency(invoice.subtotalAmount), alignment: 'right', fontSize: 8 },
      ],
    ];

    if (invoice.discountAmount > 0) {
      totalsTableBody.push([
        { text: 'Total Discount:', color: '#000000', fontSize: 8 },
        { text: `-${formatCurrency(invoice.discountAmount)}`, alignment: 'right', color: '#000000', fontSize: 8 },
      ]);
    }

    if (isIntraState) {
      totalsTableBody.push([
        { text: 'Total CGST:', color: '#000000', fontSize: 8 },
        { text: formatCurrency(invoice.cgstAmount), alignment: 'right', fontSize: 8 },
      ]);
      totalsTableBody.push([
        { text: 'Total SGST:', color: '#000000', fontSize: 8 },
        { text: formatCurrency(invoice.sgstAmount), alignment: 'right', fontSize: 8 },
      ]);
    } else {
      totalsTableBody.push([
        { text: 'Total IGST:', color: '#000000', fontSize: 8 },
        { text: formatCurrency(invoice.igstAmount), alignment: 'right', fontSize: 8 },
      ]);
    }

    if (invoice.shippingAmount > 0) {
      if (invoice.shippingAmount === 78) {
        totalsTableBody.push([
          { text: 'Delivery Charges:', color: '#000000', fontSize: 8 },
          { text: formatCurrency(49), alignment: 'right', fontSize: 8 },
        ]);
        totalsTableBody.push([
          { text: 'Cash on Delivery (COD) Fee:', color: '#000000', fontSize: 8 },
          { text: formatCurrency(29), alignment: 'right', fontSize: 8 },
        ]);
      } else if (invoice.shippingAmount === 29) {
        totalsTableBody.push([
          { text: 'Delivery Charges:', color: '#000000', fontSize: 8 },
          { text: 'FREE (INR 0.00)', alignment: 'right', fontSize: 8 },
        ]);
        totalsTableBody.push([
          { text: 'Cash on Delivery (COD) Fee:', color: '#000000', fontSize: 8 },
          { text: formatCurrency(29), alignment: 'right', fontSize: 8 },
        ]);
      } else {
        totalsTableBody.push([
          { text: 'Delivery Charges:', color: '#000000', fontSize: 8 },
          { text: formatCurrency(invoice.shippingAmount), alignment: 'right', fontSize: 8 },
        ]);
      }
    }

    totalsTableBody.push([
      { text: 'INVOICE GRAND TOTAL:', bold: true, fontSize: 9.5, color: '#000000' },
      { text: formatCurrency(invoice.totalAmount), bold: true, fontSize: 9.5, alignment: 'right', color: '#000000' },
    ]);

    // Document Definition - Strict Monochrome (Black & White)
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [28, 28, 28, 28],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 8,
        color: '#000000',
        lineHeight: 1.25,
      },
      styles: {
        th: {
          bold: true,
          fontSize: 7.5,
          color: '#ffffff',
          fillColor: '#000000',
          margin: [3, 4, 3, 4],
        },
        td: {
          fontSize: 7.5,
          color: '#000000',
          margin: [3, 4, 3, 4],
        },
        cardTitle: {
          bold: true,
          fontSize: 8,
          color: '#000000',
          margin: [0, 0, 0, 3],
        },
      },
      content: [
        // 1. BRAND HEADER & TAX INVOICE BADGE
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'SAAMAAN', fontSize: 22, bold: true, color: '#000000' },
                { text: 'www.saamaan.store', fontSize: 8, color: '#000000', margin: [0, 2, 0, 0] },
              ],
            },
            {
              width: 220,
              alignment: 'right',
              stack: [
                { text: order.InvoiceGSTIN ? 'TAX INVOICE (B2B)' : 'TAX INVOICE', fontSize: 14, bold: true, color: '#000000' },
                { text: '(Original for Recipient / Buyer)', fontSize: 7, color: '#000000', italics: true },
                {
                  margin: [0, 4, 0, 0],
                  table: {
                    widths: ['auto', '*'],
                    body: [
                      [
                        { text: 'Invoice No:', bold: true, fontSize: 8, color: '#000000' },
                        { text: invoice.invoiceNumber, bold: true, fontSize: 9, alignment: 'right', color: '#000000' },
                      ],
                      [
                        { text: 'Invoice Date:', bold: true, fontSize: 8, color: '#000000' },
                        { text: formatDate(invoice.invoiceDate), fontSize: 8, alignment: 'right', color: '#000000' },
                      ],
                      [
                        { text: 'Order ID:', bold: true, fontSize: 8, color: '#000000' },
                        { text: order.OrderNumber || `#${order.OrderID}`, bold: true, fontSize: 8, alignment: 'right', color: '#000000' },
                      ],
                      [
                        { text: 'Order Date:', bold: true, fontSize: 8, color: '#000000' },
                        { text: formatDate(order.OrderPlacedAt), fontSize: 8, alignment: 'right', color: '#000000' },
                      ],
                    ],
                  },
                  layout: 'noBorders',
                },
              ],
            },
          ],
        },

        { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 539, y2: 8, lineWidth: 1, lineColor: '#000000' }], margin: [0, 0, 0, 8] },

        // 2. 2-COLUMN ADDRESS GRID: SOLD BY vs SHIP FROM ADDRESS
        {
          table: {
            widths: ['50%', '50%'],
            body: [
              [
                // SOLD BY: Only Legal/Business Name, PAN, and GSTIN (No trade name, no phone, no email)
                {
                  fillColor: '#ffffff',
                  margin: [6, 6, 6, 6],
                  stack: [
                    { text: 'SOLD BY (MERCHANT OF RECORD):', style: 'cardTitle' },
                    { text: order.BusinessName || order.SellerName || 'Verified Merchant', bold: true, fontSize: 8.5 },
                    { text: `PAN: ${order.SellerPAN || 'N/A'}`, bold: true, margin: [0, 2, 0, 0] },
                    { text: `GSTIN: ${order.SellerGSTIN || 'N/A'}`, bold: true },
                  ],
                },
                // SHIP FROM ADDRESS: Warehouse Name, Code, Address, City, State, PIN (No phone, no origin GST code)
                {
                  fillColor: '#ffffff',
                  margin: [6, 6, 6, 6],
                  stack: [
                    { text: 'SHIP FROM ADDRESS (DISPATCH FACILITY):', style: 'cardTitle' },
                    { text: `${order.WarehouseName || 'Saamaan Fulfillment Center'} (${order.WarehouseCode || 'WH-01'})`, bold: true, fontSize: 8.5 },
                    { text: [order.WarehouseAddressLine1, order.WarehouseAddressLine2].filter(Boolean).join(', ') || 'Central Logistics Park' },
                    { text: `${order.WarehouseCity || '—'}, ${order.WarehouseState || '—'} - ${order.WarehousePostalCode || '—'}` },
                  ],
                },
              ],
              [
                // BILL TO ADDRESS
                {
                  fillColor: '#ffffff',
                  margin: [6, 6, 6, 6],
                  stack: [
                    { text: 'BILL TO ADDRESS:', style: 'cardTitle' },
                    { text: order.BillingRecipientName || `${order.CustomerFirstName || ''} ${order.CustomerLastName || ''}`.trim() || 'Valued Customer', bold: true },
                    ...(order.InvoiceGSTIN ? [
                      { text: `Buyer GSTIN: ${order.InvoiceGSTIN}`, bold: true, margin: [0, 2, 0, 2] as [number, number, number, number], fontSize: 8 },
                      { text: `Place of Supply: State Code ${order.PlaceOfSupplyStateCode || '37'}`, bold: true, fontSize: 7.5, margin: [0, 0, 0, 2] as [number, number, number, number] }
                    ] : []),
                    { text: [order.BillingAddressLine1 || order.ShippingAddressLine1, order.BillingAddressLine2 || order.ShippingAddressLine2].filter(Boolean).join(', ') || '—' },
                    { text: `${order.BillingCity || order.ShippingCity || '—'}, ${order.BillingState || order.ShippingState || '—'} - ${order.BillingPostalCode || order.ShippingPostalCode || '—'}` },
                    { text: `Country: ${order.BillingCountry || order.ShippingCountry || 'India'}` },
                    { text: `Phone: ${order.BillingPhone || order.ShippingPhone || order.CustomerPhone || '—'}` },
                  ],
                },
                // SHIP TO ADDRESS
                {
                  fillColor: '#ffffff',
                  margin: [6, 6, 6, 6],
                  stack: [
                    { text: 'SHIP TO ADDRESS:', style: 'cardTitle' },
                    { text: order.ShippingRecipientName || `${order.CustomerFirstName || ''} ${order.CustomerLastName || ''}`.trim() || 'Recipient', bold: true },
                    { text: [order.ShippingAddressLine1, order.ShippingAddressLine2].filter(Boolean).join(', ') || '—' },
                    { text: `${order.ShippingCity || '—'}, ${order.ShippingState || '—'} - ${order.ShippingPostalCode || '—'}` },
                    { text: `Country: ${order.ShippingCountry || 'India'}` },
                    { text: `Recipient Phone: ${order.ShippingPhone || order.CustomerPhone || '—'}` },
                  ],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
          },
          margin: [0, 0, 0, 8],
        },

        // 3. LOGISTICS DISPATCH STRIP
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  margin: [6, 4, 6, 4],
                  columns: [
                    {
                      width: 'auto',
                      text: [
                        { text: 'Carrier: ', bold: true },
                        { text: order.Carrier || 'Standard Delivery' },
                      ],
                    },
                    {
                      width: 'auto',
                      margin: [16, 0, 0, 0],
                      text: [
                        { text: 'AWB / Tracking: ', bold: true },
                        { text: order.TrackingNumber || 'Pending Dispatch', bold: true },
                      ],
                    },
                    {
                      width: '*',
                      alignment: 'right',
                      text: [
                        { text: 'Supply Nature: ', bold: true },
                        { text: isIntraState ? 'INTRA-STATE (CGST + SGST)' : 'INTER-STATE (IGST)', bold: true },
                      ],
                    },
                  ],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
          },
          margin: [0, 0, 0, 8],
        },

        // 4. LINE ITEMS TABLE
        {
          table: {
            headerRows: 1,
            widths: colWidths,
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
          },
          margin: [0, 0, 0, 8],
        },

        // 5. FINANCIAL BREAKDOWN & TOTALS
        {
          columns: [
            // Left: Amount in words & Tax flags
            {
              width: '*',
              stack: [
                { text: 'AMOUNT IN WORDS:', bold: true, fontSize: 7.5, color: '#000000' },
                { text: amountInWords, bold: true, fontSize: 8, margin: [0, 2, 0, 6], color: '#000000' },
                {
                  text: [
                    { text: '• Whether tax is payable on reverse charge: ', bold: true, fontSize: 7 },
                    { text: 'NO\n', bold: true, fontSize: 7 },
                    { text: '• Supply Type: ', bold: true, fontSize: 7 },
                    { text: isIntraState ? 'Intra-State Supply of Goods\n' : 'Inter-State Supply of Goods\n', fontSize: 7 },
                    { text: '• Payment Status: ', bold: true, fontSize: 7 },
                    { text: 'CONFIRMED / COMPLETED\n', fontSize: 7, bold: true },
                  ],
                },
              ],
            },
            // Right: Totals Box
            {
              width: 220,
              table: {
                widths: ['*', 70],
                body: totalsTableBody,
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#000000',
              },
            },
          ],
          margin: [0, 0, 0, 10],
        },

        // 6. STATUTORY DISCLAIMER & SIGNATORY FOOTER
        {
          table: {
            widths: [80, '*', 160],
            body: [
              [
                // QR Code
                {
                  alignment: 'center',
                  stack: [
                    { qr: trackingUrl, fit: 65, alignment: 'center' },
                    { text: 'Scan to Track Order', fontSize: 6.5, color: '#000000', margin: [0, 2, 0, 0], alignment: 'center' },
                  ],
                },
                // Terms, Declarations & Contact Information
                {
                  stack: [
                    { text: 'DECLARATION & TERMS:', bold: true, fontSize: 7.5, color: '#000000' },
                    {
                      text: '1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\n2. Goods once sold are subject to Saamaan platform returns and warranty policy.',
                      fontSize: 6.5,
                      color: '#000000',
                      margin: [0, 2, 0, 4],
                    },
                    {
                      text: 'Contact Saamaan: 1800-889-1976 | www.saamaan.store/contact',
                      bold: true,
                      fontSize: 7.5,
                      color: '#000000',
                      margin: [0, 0, 0, 3],
                    },
                    {
                      text: [
                        { text: 'Thank you ', bold: true, fontSize: 8.5, color: '#000000' },
                        { text: 'for shopping with us!', fontSize: 7.5, color: '#000000' },
                      ],
                    },
                  ],
                },
                // Authorized Signatory with Computer-Generated Disclaimer
                {
                  alignment: 'right',
                  stack: [
                    { text: `For: ${order.BusinessName || order.SellerName || 'Authorized Merchant'}`, bold: true, fontSize: 7.5 },
                    {
                      margin: [0, 6, 0, 6],
                      table: {
                        widths: ['*'],
                        body: [
                          [
                            {
                              text: 'DIGITALLY AUTHENTICATED\nTAX INVOICE',
                              alignment: 'center',
                              fontSize: 6.5,
                              bold: true,
                              color: '#000000',
                            },
                          ],
                        ],
                      },
                      layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => '#000000',
                        vLineColor: () => '#000000',
                      },
                    },
                    { text: 'Authorized Signatory', bold: true, fontSize: 7.5 },
                    {
                      text: 'This is a computer-generated invoice and does not require a physical signature.',
                      fontSize: 6.5,
                      italics: true,
                      color: '#000000',
                      margin: [0, 2, 0, 0],
                    },
                  ],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
          },
          margin: [0, 4, 0, 0],
        },
      ],
    };

    const pdfBuffer = await pdfmake.createPdf(docDefinition).getBuffer();

    return {
      buffer: pdfBuffer,
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: order.OrderNumber || String(order.OrderID),
    };
  }
}

export const invoicePdfService = new InvoicePdfService();
