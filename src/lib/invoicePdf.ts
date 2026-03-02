import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings, Contact, Invoice } from './db';

export function generateInvoicePDF(
  settings: AppSettings,
  customer: Contact,
  invoice: Invoice
) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 15;

  // ── Logo + Business Header ──
  if (settings.logo) {
    try {
      doc.addImage(settings.logo, 'PNG', margin, y, 28, 28);
    } catch { /* skip invalid logo */ }
  }

  const headerX = settings.logo ? margin + 34 : margin;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'My Shop', headerX, y + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let hy = y + 13;
  if (settings.address) { doc.text(settings.address, headerX, hy); hy += 4.5; }
  if (settings.phone) { doc.text(`Phone: ${settings.phone}`, headerX, hy); hy += 4.5; }
  if (settings.gstNumber) { doc.text(`GST: ${settings.gstNumber}`, headerX, hy); hy += 4.5; }

  y = Math.max(y + 32, hy + 4);

  // ── Divider ──
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── INVOICE Title ──
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 120, 95);
  doc.text('INVOICE', pageW - margin, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 2;

  // ── Invoice details (right) + Bill To (left) ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const detailsX = pageW - margin;
  let dy = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice #: ${invoice.invoiceNo}`, detailsX, dy, { align: 'right' }); dy += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(invoice.date)}`, detailsX, dy, { align: 'right' }); dy += 5;
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, detailsX, dy, { align: 'right' }); dy += 5;

  // Bill To
  let by = y + 2;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('BILL TO', margin, by); by += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.name, margin, by); by += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (customer.phone) { doc.text(`Phone: ${customer.phone}`, margin, by); by += 4.5; }
  if (customer.address) { doc.text(customer.address, margin, by); by += 4.5; }

  y = Math.max(dy, by) + 8;

  // ── Item Table ──
  const tableBody = invoice.items.map((item, i) => [
    String(i + 1),
    item.name,
    String(item.qty),
    `₹${item.rate.toFixed(2)}`,
    `₹${item.amount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'Qty', 'Price', 'Amount']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Calculation Summary (right-aligned) ──
  const summaryX = pageW - margin - 70;
  const valX = pageW - margin;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Subtotal
  doc.text('Subtotal', summaryX, y);
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, valX, y, { align: 'right' });
  y += 6;

  // Previous Due
  if (invoice.previousDue > 0) {
    doc.text('Previous Balance', summaryX, y);
    doc.text(`₹${invoice.previousDue.toFixed(2)}`, valX, y, { align: 'right' });
    y += 6;
  }

  // GST
  if (invoice.gstEnabled && invoice.gstAmount > 0) {
    doc.text(`GST (${invoice.gstPercent}%)`, summaryX, y);
    doc.text(`₹${invoice.gstAmount.toFixed(2)}`, valX, y, { align: 'right' });
    y += 6;
  }

  // Round Off
  if (Math.abs(invoice.roundOff) > 0.001) {
    doc.text('Round Off', summaryX, y);
    const roSign = invoice.roundOff >= 0 ? '+' : '';
    doc.text(`${roSign}₹${invoice.roundOff.toFixed(2)}`, valX, y, { align: 'right' });
    y += 6;
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX, y, valX, y);
  y += 6;

  // Grand Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total', summaryX, y);
  doc.text(`₹${invoice.total.toFixed(2)}`, valX, y, { align: 'right' });
  y += 8;

  // Paid & Remaining
  if (invoice.paidAmount > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 120, 95);
    doc.text('Paid Amount', summaryX, y);
    doc.text(`₹${invoice.paidAmount.toFixed(2)}`, valX, y, { align: 'right' });
    y += 6;
    doc.setTextColor(200, 50, 50);
    doc.setFont('helvetica', 'bold');
    const remaining = invoice.total - invoice.paidAmount;
    doc.text('Remaining Balance', summaryX, y);
    doc.text(`₹${remaining.toFixed(2)}`, valX, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  // ── Footer ──
  y = Math.max(y + 15, 250);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for your business!', pageW / 2, y, { align: 'center' });
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.text('Authorized Signature: _______________', pageW - margin, y, { align: 'right' });

  doc.save(`${invoice.invoiceNo}_${customer.name}.pdf`);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
