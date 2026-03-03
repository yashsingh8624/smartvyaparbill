import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings, Contact, LedgerEntry, Invoice } from './db';

function addShopHeader(doc: jsPDF, settings: AppSettings, startY: number): number {
  let y = startY;
  doc.setFontSize(16);
  doc.text(settings.businessName || 'My Shop', 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  if (settings.ownerName) { doc.text(settings.ownerName, 105, y, { align: 'center' }); y += 5; }
  if (settings.phone) { doc.text(`Ph: ${settings.phone}`, 105, y, { align: 'center' }); y += 5; }
  if (settings.address) { doc.text(settings.address, 105, y, { align: 'center' }); y += 5; }
  if (settings.gstNumber) { doc.text(`GST: ${settings.gstNumber}`, 105, y, { align: 'center' }); y += 5; }
  return y + 4;
}

export function generateFullLedgerPDF(settings: AppSettings, contact: Contact, entries: LedgerEntry[], contactType: 'customer' | 'vendor') {
  const doc = new jsPDF();
  let y = addShopHeader(doc, settings, 15);

  doc.setFontSize(12);
  doc.text(`LEDGER - ${contact.name}`, 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  if (contact.phone) { doc.text(`Phone: ${contact.phone}`, 14, y); y += 5; }
  if (contact.address) { doc.text(`Address: ${contact.address}`, 14, y); y += 5; }
  y += 3;

  let runBal = 0;
  const rows = entries.map(e => {
    runBal += e.debit - e.credit;
    return [
      e.date, e.refNo, e.description,
      e.debit > 0 ? e.debit.toFixed(2) : '-',
      e.credit > 0 ? e.credit.toFixed(2) : '-',
      runBal.toFixed(2),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Ref', 'Description', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 120, 95] },
    styles: { fontSize: 8 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balance = totalDebit - totalCredit;
  const fy = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text(`Total Debit: ₹${totalDebit.toFixed(2)}`, 14, fy);
  doc.text(`Total Credit: ₹${totalCredit.toFixed(2)}`, 14, fy + 6);
  doc.setFontSize(12);
  const label = contactType === 'customer' ? 'Remaining Balance' : 'Payable';
  doc.text(`${label}: ₹${balance.toFixed(2)}`, 14, fy + 14);

  doc.save(`ledger_${contact.name}.pdf`);
}

export function generateTodaySalesReportPDF(
  settings: AppSettings,
  todayInvoices: Invoice[],
  customers: Contact[],
  todaySales: number,
  todayPayments: number
) {
  const doc = new jsPDF();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  let y = addShopHeader(doc, settings, 15);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TODAY\'S SALES REPORT', 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${dateStr}`, 105, y, { align: 'center' });
  y += 10;

  if (todayInvoices.length > 0) {
    const rows = todayInvoices.map((inv, i) => {
      const cust = customers.find(c => c.id === inv.customerId);
      return [
        String(i + 1),
        inv.invoiceNo,
        cust?.name || '-',
        `₹${inv.subtotal.toFixed(2)}`,
        inv.gstEnabled ? `₹${inv.gstAmount.toFixed(2)}` : '-',
        `₹${inv.total.toFixed(2)}`,
        `₹${inv.paidAmount.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['#', 'Invoice', 'Customer', 'Subtotal', 'GST', 'Total', 'Paid']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 120, 95] },
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.text('No invoices created today.', 14, y);
    y += 10;
  }

  // Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, y); y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Invoices: ${todayInvoices.length}`, 14, y); y += 6;
  doc.text(`Total Sales (Debit): ₹${todaySales.toFixed(2)}`, 14, y); y += 6;
  doc.text(`Total Payments Received (Credit): ₹${todayPayments.toFixed(2)}`, 14, y); y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Net Balance: ₹${(todaySales - todayPayments).toFixed(2)}`, 14, y);

  const fileName = `sales_report_${today.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export function sendWhatsAppReminder(contact: Contact, balance: number) {
  const msg = `Dear ${contact.name}, your pending balance is ₹${balance.toFixed(2)}. Kindly clear at your earliest. Thank you.`;
  const url = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
