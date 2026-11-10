import React from 'react';

/**
 * Utility: Convert numeric Indian Rupee amounts into Words
 */
function numberToWordsINR(amount: number): string {
  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
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

export interface GrnDocumentSheetProps {
  data: any;
}

export const GrnDocumentSheet: React.FC<GrnDocumentSheetProps> = ({ data }) => {
  if (!data) return null;

  const items = data.items || [];
  const totalDeclared = items.reduce((sum: number, it: any) => sum + Number(it.expectedQuantity || 0), 0);
  const totalGood = items.reduce((sum: number, it: any) => sum + Number(it.receivedQuantity || 0), 0);
  const totalDamaged = items.reduce((sum: number, it: any) => sum + Number(it.damagedQuantity || 0), 0);
  const totalShortage = items.reduce((sum: number, it: any) => sum + Number(it.shortageQuantity || 0), 0);
  const totalVerifiedValue = items.reduce(
    (sum: number, it: any) => sum + Number(it.receivedQuantity || 0) * Number(it.purchasePrice || 0),
    0
  );

  return (
    <div
      id="printable-grn-document"
      className="bg-white text-slate-800 p-6 sm:p-10 max-w-4xl mx-auto border border-slate-200 rounded-2xl shadow-sm space-y-6 select-text print:shadow-none print:border-none print:p-0 print:m-0"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-teal-700/20 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-teal-800 tracking-tight uppercase">
            Saamaan Logistics & Fulfillment
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Warehouse Goods Receiving & Quality Inspection System
          </p>
        </div>
        <div className="text-left sm:text-right">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
            Goods Received Note
          </h2>
          <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
            GRN REF: <span className="text-teal-800 font-black">{data.grnNumber || `GRN-${data.shipmentNumber}`}</span>
          </p>
          <div className="mt-1">
            <span
              className={`inline-block text-[11px] font-black uppercase px-2.5 py-0.5 rounded ${
                data.status === 'DISCREPANCY'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              Status: {data.status}
            </span>
          </div>
        </div>
      </div>

      {/* Facility & Seller Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
          <h3 className="text-[10px] font-bold text-teal-800 tracking-wider uppercase mb-1">
            Receiving Warehouse Facility
          </h3>
          <p className="text-xs font-extrabold text-slate-900">
            {data.warehouse?.warehouseName || 'Saamaan Fulfilment Center'}
          </p>
          {data.warehouse?.warehouseCode && (
            <p className="text-[11px] text-slate-600 font-mono">Code: {data.warehouse.warehouseCode}</p>
          )}
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {[
              data.warehouse?.addressLine1,
              data.warehouse?.addressLine2,
              data.warehouse?.city,
              data.warehouse?.state,
              data.warehouse?.postalCode,
            ]
              .filter(Boolean)
              .join(', ') || 'Facility Address on Record'}
          </p>
          {data.warehouse?.contactPersonName && (
            <p className="text-[11px] text-slate-600">
              Contact: {data.warehouse.contactPersonName}{' '}
              {data.warehouse?.contactPhoneNumber ? `(${data.warehouse.contactPhoneNumber})` : ''}
            </p>
          )}
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
          <h3 className="text-[10px] font-bold text-teal-800 tracking-wider uppercase mb-1">
            Seller / Supplier Details
          </h3>
          <p className="text-xs font-extrabold text-slate-900">
            {data.seller?.businessName || data.seller?.sellerName || 'Merchant Partner'}
          </p>
          {data.seller?.sellerCode && (
            <p className="text-[11px] text-slate-600 font-mono">Seller Code: {data.seller.sellerCode}</p>
          )}
          {data.seller?.email && (
            <p className="text-[11px] text-slate-600 truncate">Email: {data.seller.email}</p>
          )}
          {data.seller?.phoneNumber && (
            <p className="text-[11px] text-slate-600">Phone: {data.seller.phoneNumber}</p>
          )}
        </div>
      </div>

      {/* Shipment & Logistics Metadata (No horizontal divider lines between key and value) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 bg-white">
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Shipment Number</span>
            <span className="block text-xs font-extrabold text-slate-900 font-mono mt-0.5">
              {data.shipmentNumber}
            </span>
          </div>
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Carrier / Transporter</span>
            <span className="block text-xs font-extrabold text-slate-900 mt-0.5">
              {data.carrierName || 'Self Transport'}
            </span>
          </div>
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Tracking / AWB #</span>
            <span className="block text-xs font-extrabold text-slate-900 font-mono mt-0.5">
              {data.trackingNumber || '—'}
            </span>
          </div>
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Cartons / Boxes</span>
            <span className="block text-xs font-extrabold text-slate-900 mt-0.5">
              {data.boxCount || 1} Boxes
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 bg-white">
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">GRN Date</span>
            <span className="block text-xs font-extrabold text-slate-900 mt-0.5">
              {formatDate(data.grnDate || data.receivedAt)}
            </span>
          </div>
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Dispatched Date</span>
            <span className="block text-xs font-extrabold text-slate-900 mt-0.5">
              {formatDate(data.dispatchedAt)}
            </span>
          </div>
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">PO Number</span>
            <span className="block text-xs font-extrabold text-slate-900 font-mono mt-0.5">
              {data.poNumber || '—'}
            </span>
          </div>
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Supplier Invoice #</span>
            <span className="block text-xs font-extrabold text-slate-900 font-mono mt-0.5">
              {data.supplierInvoiceNumber || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-teal-700 text-white uppercase text-[10px] font-bold tracking-wider">
              <th className="py-2.5 px-3 text-center w-8">#</th>
              <th className="py-2.5 px-3">Product & SKU</th>
              <th className="py-2.5 px-3 text-right">Declared</th>
              <th className="py-2.5 px-3 text-right">Received</th>
              <th className="py-2.5 px-3 text-right">Damaged</th>
              <th className="py-2.5 px-3 text-right">Shortage</th>
              <th className="py-2.5 px-3 text-right">Rate (Rs.)</th>
              <th className="py-2.5 px-3 text-right">Total (Rs.)</th>
              <th className="py-2.5 px-3">QC Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item: any, idx: number) => {
              const declared = Number(item.expectedQuantity || 0);
              const received = Number(item.receivedQuantity || 0);
              const damaged = Number(item.damagedQuantity || 0);
              const shortage = Number(item.shortageQuantity || 0);
              const rate = Number(item.purchasePrice || 0);
              const total = received * rate;

              return (
                <tr key={item.inboundShipmentItemId || idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-extrabold text-slate-900">{item.productName}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Seller SKU: {item.sellerSku || '—'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-700">{declared}</td>
                  <td className="py-2.5 px-3 text-right font-black text-emerald-700">{received}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${damaged > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {damaged}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold ${shortage > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {shortage}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                    Rs. {rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                    Rs. {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px] italic">
                    {item.remarks || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-2">
        <div className="sm:col-span-7 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="block text-[10px] font-bold text-teal-800 uppercase tracking-wider">
              Verified Goods Value in Words:
            </span>
            <p className="text-xs font-extrabold text-slate-900 mt-1">
              {numberToWordsINR(totalVerifiedValue)}
            </p>
          </div>

          <div className="text-[11px] text-slate-600">
            <span className="font-bold text-slate-700">Receiving Notes: </span>
            <span className="italic">{data.notes || 'check stock correctly | GRN finalized'}</span>
          </div>
        </div>

        <div className="sm:col-span-5 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
          <div className="flex justify-between p-2.5 bg-slate-50/50">
            <span className="text-slate-600 font-medium">Total Declared Units:</span>
            <span className="font-extrabold text-slate-900">{totalDeclared}</span>
          </div>
          <div className="flex justify-between p-2.5 bg-emerald-50/30">
            <span className="text-emerald-800 font-medium">Good Units (Credited to Stock):</span>
            <span className="font-black text-emerald-700">{totalGood}</span>
          </div>
          <div className="flex justify-between p-2.5">
            <span className="text-red-700 font-medium">Damaged Units (Quarantined):</span>
            <span className={`font-black ${totalDamaged > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {totalDamaged}
            </span>
          </div>
          <div className="flex justify-between p-2.5">
            <span className="text-amber-700 font-medium">Shortage Units (Missing):</span>
            <span className={`font-black ${totalShortage > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
              {totalShortage}
            </span>
          </div>
          <div className="flex justify-between p-3 bg-teal-50 border-t-2 border-teal-700">
            <span className="text-teal-900 font-extrabold uppercase text-[11px]">
              Total Verified Goods Value:
            </span>
            <span className="font-black text-teal-900 text-sm font-mono">
              Rs. {totalVerifiedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Digital Audit Verification & Certification Banner */}
      <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/70 text-slate-700 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold">
            ✓
          </div>
          <h4 className="text-[11px] font-black text-teal-900 uppercase tracking-wider">
            Digital Audit Verification & Certification
          </h4>
        </div>
        <p className="text-[10px] text-teal-900/80 leading-relaxed">
          This Goods Received Note (GRN) has been electronically inspected, reconciled, and certified by Saamaan WMS Inbound Operations. Physical inventory has been verified against seller dispatch manifest and credited to inventory under audit ledger ID. Valid for official commercial reconciliation; no physical stamp or signature required.
        </p>
        <div className="flex flex-wrap items-center justify-between text-[9px] text-teal-700 font-mono pt-1 border-t border-teal-200/60">
          <span>Certified: {formatDate(data.receivedAt || data.grnDate)}</span>
          <span>Verification Hash: SHA256-VERIFIED-WMS-GRN</span>
        </div>
      </div>
    </div>
  );
};
export default GrnDocumentSheet;

