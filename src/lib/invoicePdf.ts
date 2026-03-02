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
  let y = 16;

  const black = [0, 0, 0] as const;
  const grey = [130, 130, 130] as const;
  const darkGrey = [60, 60, 60] as const;
  const lineGrey = [200, 200, 200] as const;
  const accent = [0, 100, 200] as const;

  // ── TOP BAR: Logo + Business Info (left) | Invoice meta (right) ──
  let logoBottom = y;
  if (settings.logo) {
    try {
      doc.addImage(settings.logo, 'PNG', margin, y, 18, 18);
      logoBottom = y + 20;
    } catch { /* skip */ }
  }

  const bizX = settings.logo ? margin + 22 : margin;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(settings.businessName || 'Business Name', bizX, y + 5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGrey);
  let by = y + 10;
  if (settings.address) { doc.text(settings.address, bizX, by); by += 4; }
  if (settings.phone) { doc.text(settings.phone, bizX, by); by += 4; }
  if (settings.gstNumber) { doc.text(`GST: ${settings.gstNumber}`, bizX, by); by += 4; }

  // Right: Invoice #, Issue date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGrey);
  let ry = y + 3;
  doc.text(`Invoice# ${invoice.invoiceNo}`, rightEdge, ry, { align: 'right' }); ry += 5;
  doc.text(`Issue date`, rightEdge, ry, { align: 'right' }); ry += 4;
  doc.text(fmtDate(invoice.date), rightEdge, ry, { align: 'right' });

  y = Math.max(logoBottom, by, ry + 2) + 4;

  // ── ACCENT LINE (thick blue/teal divider) ──
  doc.setDrawColor(...accent);
  doc.setLineWidth(2);
  doc.line(margin, y, rightEdge, y);
  y += 14;

  // ── BIG BUSINESS NAME ──
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(settings.businessName || 'Business name', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text('Thank you for your business.', margin, y);
  y += 16;

  // ── THREE COLUMN SECTION ──
  const col1X = margin;
  const col2X = margin + 62;
  const col3X = margin + 124;

  // Thin colored lines above each column
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(col1X, y, col1X + 50, y);
  doc.line(col2X, y, col2X + 50, y);
  doc.line(col3X, y, col3X + 50, y);
  y += 7;

  // Column headers
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('BILL TO', col1X, y);
  doc.text('DETAILS', col2X, y);
  doc.text('PAYMENT', col3X, y);
  y += 6;

  // Column content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkGrey);

  // Bill To
  let c1y = y;
  doc.text(customer.name, col1X, c1y); c1y += 4.5;
  if (customer.phone) { doc.text(customer.phone, col1X, c1y); c1y += 4.5; }
  if (customer.address) {
    const lines = doc.splitTextToSize(customer.address, 50);
    doc.text(lines, col1X, c1y);
    c1y += lines.length * 4.5;
  }

  // Details
  let c2y = y;
  doc.text(`Invoice ${invoice.invoiceNo}`, col2X, c2y); c2y += 4.5;
  doc.text(fmtDate(invoice.date), col2X, c2y);

  // Payment
  let c3y = y;
  doc.text(`Due date ${fmtDate(invoice.dueDate)}`, col3X, c3y); c3y += 4.5;
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, col3X, c3y); c3y += 4.5;
  if (invoice.previousDue > 0) {
    doc.text(`Previous Due ₹${invoice.previousDue.toFixed(2)}`, col3X, c3y); c3y += 4.5;
  }
  doc.text(`Amount: ₹${invoice.total.toFixed(2)}`, col3X, c3y); c3y += 4.5;

  y = Math.max(c1y, c2y, c3y) + 12;

  // ── ITEM TABLE ──
  // Thin grey line before table
  drawLine(doc, margin, y, rightEdge, lineGrey);
  y += 2;

  const tableBody = invoice.items.map(item => [
    item.name,
    String(item.qty),
    `₹${item.rate.toFixed(2)}`,
    `₹${item.amount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['ITEM', 'QTY', 'PRICE', 'AMOUNT']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [60, 60, 60],
      cellPadding: { top: 5, bottom: 5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 34, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      // Draw thin line under each body row
      if (data.section === 'body' && data.column.index === 0) {
        const rowY = data.cell.y + data.cell.height;
        doc.setDrawColor(...lineGrey);
        doc.setLineWidth(0.2);
        doc.line(margin, rowY, rightEdge, rowY);
      }
      // Draw line under header
      if (data.section === 'head' && data.column.index === 0) {
        const rowY = data.cell.y + data.cell.height;
        doc.setDrawColor(...black);
        doc.setLineWidth(0.4);
        doc.line(margin, rowY, rightEdge, rowY);
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ── BOTTOM TOTALS ──
  // Thicker line before totals
  doc.setDrawColor(...black);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 7;

  const labelX = margin;
  const priceX = rightEdge - 34;
  const amountX = rightEdge;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);

  // Previous Balance row
  if (invoice.previousDue > 0) {
    doc.text('Previous Balance', labelX, y);
    doc.text(`₹${invoice.previousDue.toFixed(2)}`, priceX, y, { align: 'right' });
    doc.text(`₹${invoice.previousDue.toFixed(2)}`, amountX, y, { align: 'right' });
    y += 6;
    drawLine(doc, margin, y, rightEdge, lineGrey);
    y += 5;
  }

  // Subtotal row
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', labelX, y);
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, priceX, y, { align: 'right' });
  doc.text(`₹${invoice.subtotal.toFixed(2)}`, amountX, y, { align: 'right' });
  y += 5;

  // GST / Tax row
  if (invoice.gstEnabled && invoice.gstAmount > 0) {
    doc.text(`Tax (${invoice.gstPercent}%)`, labelX, y);
    doc.text(`₹${invoice.gstAmount.toFixed(2)}`, priceX, y, { align: 'right' });
    doc.text(`₹${invoice.gstAmount.toFixed(2)}`, amountX, y, { align: 'right' });
    y += 5;
  }

  // Round Off
  if (Math.abs(invoice.roundOff) > 0.001) {
    doc.setTextColor(...grey);
    const roSign = invoice.roundOff >= 0 ? '+' : '';
    doc.text('Round Off', labelX, y);
    doc.text(`${roSign}₹${invoice.roundOff.toFixed(2)}`, amountX, y, { align: 'right' });
    y += 5;
  }

  // ── TOTAL DUE LINE ──
  y += 2;
  doc.setDrawColor(...black);
  doc.setLineWidth(0.6);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('Total Due', labelX, y);
  doc.text(`₹${invoice.total.toFixed(2)}`, amountX, y, { align: 'right' });

  // Thin accent line under Total Due
  y += 3;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(margin, y, rightEdge, y);

  // Paid & Remaining
  if (invoice.paidAmount > 0) {
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 130, 80);
    doc.text('Paid Amount', labelX, y);
    doc.text(`₹${invoice.paidAmount.toFixed(2)}`, amountX, y, { align: 'right' });
    y += 6;

    const remaining = invoice.total - invoice.paidAmount;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 50, 50);
    doc.text('Remaining Balance', labelX, y);
    doc.text(`₹${remaining.toFixed(2)}`, amountX, y, { align: 'right' });
  }

  // ── FOOTER ──
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grey);
  doc.text(`Page 1`, rightEdge, pageH - 10, { align: 'right' });

  doc.save(`${invoice.invoiceNo}_${customer.name}.pdf`);
}

function drawLine(doc: jsPDF, x1: number, y: number, x2: number, color: readonly [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
