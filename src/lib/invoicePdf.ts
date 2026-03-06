import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings, Contact, Invoice } from './db';
import { formatINRNumber } from './utils';

export function generateInvoicePDF(
  settings: AppSettings,
  customer: Contact,
  invoice: Invoice,
  printMode = false
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14; // margin
  const rEdge = pageW - m;
  let y = m;

  // Colors
  const black: [number, number, number] = [33, 33, 33];
  const grey: [number, number, number] = [120, 120, 120];
  const darkGrey: [number, number, number] = [66, 66, 66];
  const accent: [number, number, number] = [22, 120, 90];

  // ── HEADER: Business Info ──
  if (settings.logo) {
    try { doc.addImage(settings.logo, 'PNG', m, y, 16, 16); } catch { /* skip */ }
  }
  const bx = settings.logo ? m + 20 : m;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...black);
  doc.text(settings.businessName || 'Business Name', bx, y + 6);

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkGrey);
  let by = y + 12;
  if (settings.address) { doc.text(settings.address, bx, by); by += 4; }
  if (settings.phone) { doc.text(`Phone: ${settings.phone}`, bx, by); by += 4; }
  if (settings.gstNumber) { doc.text(`GSTIN: ${settings.gstNumber}`, bx, by); by += 4; }

  // Invoice title on right
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accent);
  doc.text('INVOICE', rEdge, y + 6, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkGrey);
  doc.text(`# ${invoice.invoiceNo}`, rEdge, y + 13, { align: 'right' });
  doc.text(`Date: ${fmtDate(invoice.date)}`, rEdge, y + 18, { align: 'right' });
  doc.text(`Due: ${fmtDate(invoice.dueDate)}`, rEdge, y + 23, { align: 'right' });

  y = Math.max(by, y + 26) + 6;

  // Divider
  doc.setDrawColor(...accent); doc.setLineWidth(1.5);
  doc.line(m, y, rEdge, y);
  y += 10;

  // ── BILL TO ──
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accent);
  doc.text('BILL TO', m, y);
  y += 5;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...black);
  doc.text(customer.name, m, y); y += 5;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkGrey);
  if (customer.phone) { doc.text(`Phone: ${customer.phone}`, m, y); y += 4; }
  if (customer.address) {
    const lines = doc.splitTextToSize(customer.address, 90);
    doc.text(lines, m, y); y += lines.length * 4;
  }
  y += 8;

  // ── ITEM TABLE ──
  const tableHead = [['#', 'Item Name', 'Qty', 'Price (₹)', 'Amount (₹)']];
  const tableBody = invoice.items.map((item, i) => [
    String(i + 1),
    item.name,
    String(item.qty),
    formatINRNumber(item.rate),
    formatINRNumber(item.amount),
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: black,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: m, right: m },
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── TOTALS SECTION ──
  const labelX = rEdge - 80;
  const valX = rEdge;

  function addTotalRow(label: string, value: string, bold = false, color?: [number, number, number]) {
    doc.setFontSize(bold ? 11 : 9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...(color || darkGrey));
    doc.text(label, labelX, y, { align: 'left' });
    doc.text(value, valX, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  }

  addTotalRow('Subtotal', `₹${formatINRNumber(invoice.subtotal)}`);

  if (invoice.gstEnabled && invoice.gstAmount > 0) {
    addTotalRow(`GST (${invoice.gstPercent}%)`, `₹${formatINRNumber(invoice.gstAmount)}`);
  }

  if (Math.abs(invoice.roundOff) > 0.001) {
    const sign = invoice.roundOff >= 0 ? '+' : '';
    addTotalRow('Round Off', `${sign}₹${formatINRNumber(invoice.roundOff)}`);
  }

  // Grand Total line
  y += 2;
  doc.setDrawColor(...accent); doc.setLineWidth(0.8);
  doc.line(labelX, y, rEdge, y);
  y += 6;
  addTotalRow('Grand Total', `₹${formatINRNumber(invoice.total)}`, true, black);

  // Previous Due & Final Payable
  if (invoice.previousDue > 0) {
    addTotalRow('Previous Due', `₹${formatINRNumber(invoice.previousDue)}`, false, [200, 80, 50]);
    const finalPayable = Math.round((invoice.total + invoice.previousDue) * 100) / 100;
    y += 1;
    doc.setDrawColor(...black); doc.setLineWidth(0.4);
    doc.line(labelX, y, rEdge, y); y += 5;
    addTotalRow('Final Payable', `₹${formatINRNumber(finalPayable)}`, true, black);
  }

  // Paid & Remaining
  if (invoice.paidAmount > 0) {
    addTotalRow('Paid Amount', `₹${formatINRNumber(invoice.paidAmount)}`, false, [22, 130, 80]);
    const finalPayable = Math.round((invoice.total + invoice.previousDue) * 100) / 100;
    const remaining = Math.max(0, Math.round((finalPayable - invoice.paidAmount) * 100) / 100);
    addTotalRow('Remaining Balance', `₹${formatINRNumber(remaining)}`, true, [200, 50, 50]);
  }

  // ── FOOTER ──
  y = Math.max(y + 15, pageH - 35);
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
  doc.line(m, y, rEdge, y); y += 6;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grey);
  doc.text('Thank you for your business!', m, y);
  doc.text('Generated by Smart Vyapar Ledger', pageW / 2, y, { align: 'center' });
  doc.text('Page 1', rEdge, y, { align: 'right' });

  if (printMode) {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`${invoice.invoiceNo}_${customer.name}.pdf`);
  }
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
