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
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const rightEdge = pageW - margin;
  let y = 18;

  const grey = [120, 120, 120] as const;
  const dark = [30, 30, 30] as const;
  const accent = [22, 110, 80] as const;
  const lightLine = [220, 220, 220] as const;

  // ── TOP SECTION ──
  // Left: Logo + Business Info
  let logoBottom = y;
  if (settings.logo) {
    try {
      doc.addImage(settings.logo, 'PNG', margin, y, 22, 22);
      logoBottom = y + 24;
    } catch { /* skip */ }
  }

  const bizX = settings.logo ? margin + 26 : margin;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text(settings.businessName || 'My Shop', bizX, y + 5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  let by = y + 11;
  if (settings.address) { doc.text(settings.address, bizX, by); by += 4; }
  if (settings.phone) { doc.text(`Phone: ${settings.phone}`, bizX, by); by += 4; }
  if (settings.gstNumber) { doc.text(`GST: ${settings.gstNumber}`, bizX, by); by += 4; }

  // Right: Invoice meta
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  let ry = y;
  doc.text('INVOICE NO', rightEdge, ry, { align: 'right' }); ry += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text(invoice.invoiceNo, rightEdge, ry, { align: 'right' }); ry += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text('DATE', rightEdge, ry, { align: 'right' }); ry += 4;
  doc.setTextColor(...dark);
  doc.text(formatDate(invoice.date), rightEdge, ry, { align: 'right' }); ry += 7;

  doc.setTextColor(...grey);
  doc.text('DUE DATE', rightEdge, ry, { align: 'right' }); ry += 4;
  doc.setTextColor(...dark);
  doc.text(formatDate(invoice.dueDate), rightEdge, ry, { align: 'right' });

  y = Math.max(logoBottom, by, ry + 4) + 6;

  // ── Divider ──
  drawLine(doc, margin, y, rightEdge, lightLine);
  y += 10;

  // ── INVOICE Heading ──
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accent);
  doc.text('INVOICE', margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text('Thank you for your business', margin, y + 4);
  y += 12;

  // ── Divider ──
  drawLine(doc, margin, y, rightEdge, lightLine);
  y += 8;

  // ── Three Column Section ──
  const col1X = margin;
  const col2X = margin + 62;
  const col3X = margin + 124;

  // Column headers
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grey);
  doc.text('BILL TO', col1X, y);
  doc.text('DETAILS', col2X, y);
  doc.text('PAYMENT', col3X, y);
  y += 6;

  // Column content
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text(customer.name, col1X, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let c1y = y + 5;
  if (customer.phone) { doc.text(customer.phone, col1X, c1y); c1y += 4; }
  if (customer.address) {
    const addrLines = doc.splitTextToSize(customer.address, 55);
    doc.text(addrLines, col1X, c1y);
    c1y += addrLines.length * 4;
  }

  // Details column
  doc.setFontSize(8);
  doc.setTextColor(...dark);
  doc.text(`Invoice ${invoice.invoiceNo}`, col2X, y);
  doc.setTextColor(...grey);
  doc.text(formatDate(invoice.date), col2X, y + 5);

  // Payment column
  doc.setFontSize(7);
  doc.setTextColor(...grey);
  let c3y = y - 1;
  doc.text('Due Date', col3X, c3y); c3y += 4;
  doc.setFontSize(8);
  doc.setTextColor(...dark);
  doc.text(formatDate(invoice.dueDate), col3X, c3y); c3y += 7;

  doc.setFontSize(7);
  doc.setTextColor(...grey);
  doc.text('Invoice Amount', col3X, c3y); c3y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, col3X, c3y); c3y += 7;

  if (invoice.previousDue > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grey);
    doc.text('Previous Balance', col3X, c3y); c3y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 50, 50);
    doc.text(`₹${invoice.previousDue.toFixed(2)}`, col3X, c3y); c3y += 7;
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text('Total Due', col3X, c3y); c3y += 4;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accent);
  doc.text(`₹${invoice.total.toFixed(2)}`, col3X, c3y);

  y = Math.max(c1y, c3y) + 10;

  // ── Divider ──
  drawLine(doc, margin, y, rightEdge, lightLine);
  y += 4;

  // ── Item Table ──
  const tableBody = invoice.items.map((item, i) => [
    item.name,
    String(item.qty),
    `₹${item.rate.toFixed(2)}`,
    `₹${item.amount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Price', 'Amount']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [248, 248, 248],
      textColor: [100, 100, 100],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 30, 30],
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 38, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [253, 253, 253] },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Bottom line under header
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Divider ──
  drawLine(doc, pageW / 2, y, rightEdge, lightLine);
  y += 8;

  // ── Calculation Summary ──
  const labelX = pageW / 2 + 5;
  const valX = rightEdge;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...dark);

  // Previous Balance
  if (invoice.previousDue > 0) {
    doc.setTextColor(200, 50, 50);
    doc.text('Previous Balance', labelX, y);
    doc.text(`₹${invoice.previousDue.toFixed(2)}`, valX, y, { align: 'right' });
    doc.setTextColor(...dark);
    y += 7;
  }

  // Subtotal
  doc.text('Subtotal', labelX, y);
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, valX, y, { align: 'right' });
  y += 7;

  // GST
  if (invoice.gstEnabled && invoice.gstAmount > 0) {
    doc.text(`GST (${invoice.gstPercent}%)`, labelX, y);
    doc.text(`₹${invoice.gstAmount.toFixed(2)}`, valX, y, { align: 'right' });
    y += 7;
  }

  // Round Off
  if (Math.abs(invoice.roundOff) > 0.001) {
    doc.setTextColor(...grey);
    doc.text('Round Off', labelX, y);
    const roSign = invoice.roundOff >= 0 ? '+' : '';
    doc.text(`${roSign}₹${invoice.roundOff.toFixed(2)}`, valX, y, { align: 'right' });
    doc.setTextColor(...dark);
    y += 7;
  }

  // Divider before total
  drawLine(doc, labelX, y, rightEdge, lightLine);
  y += 8;

  // Grand Total
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accent);
  doc.text('Grand Total', labelX, y);
  doc.text(`₹${invoice.total.toFixed(2)}`, valX, y, { align: 'right' });
  y += 10;

  // Paid & Remaining
  if (invoice.paidAmount > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 110, 80);
    doc.text('Paid Amount', labelX, y);
    doc.text(`₹${invoice.paidAmount.toFixed(2)}`, valX, y, { align: 'right' });
    y += 7;

    const remaining = invoice.total - invoice.paidAmount;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 50, 50);
    doc.text('Remaining Balance', labelX, y);
    doc.text(`₹${remaining.toFixed(2)}`, valX, y, { align: 'right' });
    y += 10;
  }

  // ── Footer ──
  const footerY = Math.max(y + 20, pageH - 40);

  drawLine(doc, margin, footerY, rightEdge, lightLine);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text('Thank you for your business!', pageW / 2, footerY + 8, { align: 'center' });

  doc.setFontSize(8);
  doc.text('Authorized Signature: ___________________', rightEdge, footerY + 16, { align: 'right' });

  // Page number
  doc.setFontSize(7);
  doc.text(`Page 1 of 1`, rightEdge, pageH - 10, { align: 'right' });

  doc.save(`${invoice.invoiceNo}_${customer.name}.pdf`);
}

function drawLine(doc: jsPDF, x1: number, y: number, x2: number, color: readonly [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
