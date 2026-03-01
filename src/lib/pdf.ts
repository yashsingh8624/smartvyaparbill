import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings, Contact, LedgerEntry } from './db';

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

export function generateTodayBillPDF(settings: AppSettings, contact: Contact, entries: LedgerEntry[]) {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.date === today && e.debit > 0);
  if (todayEntries.length === 0) {
    alert('No sales entries for today.');
    return;
  }

  const doc = new jsPDF();
  let y = addShopHeader(doc, settings, 15);

  doc.setFontSize(12);
  doc.text('BILL / INVOICE', 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.text(`Customer: ${contact.name}`, 14, y);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 196, y, { align: 'right' });
  y += 4;
  if (contact.phone) { doc.text(`Phone: ${contact.phone}`, 14, y); y += 4; }
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Amount (₹)']],
    body: todayEntries.map((e, i) => [i + 1, e.description, e.debit.toFixed(2)]),
    theme: 'grid',
    headStyles: { fillColor: [30, 120, 95] },
    styles: { fontSize: 9 },
  });

  const subtotal = todayEntries.reduce((s, e) => s + e.debit, 0);
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text(`Total: ₹${subtotal.toFixed(2)}`, 196, finalY, { align: 'right' });
  doc.setFontSize(8);
  doc.text('Authorized Signature: _______________', 196, finalY + 20, { align: 'right' });

  doc.save(`bill_${contact.name}_${today}.pdf`);
}

export function generateFullLedgerPDF(settings: AppSettings, contact: Contact, entries: LedgerEntry[], contactType: 'customer' | 'vendor') {
  const doc = new jsPDF();
  let y = addShopHeader(doc, settings, 15);

  doc.setFontSize(12);
  doc.text(`LEDGER - ${contact.name}`, 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  if (contact.phone) { doc.text(`Phone: ${contact.phone}`, 14, y); y += 5; }
  y += 3;

  let runBal = 0;
  const rows = entries.map(e => {
    runBal += e.debit - e.credit;
    return [
      e.date,
      e.refNo,
      e.description,
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
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balance = totalDebit - totalCredit;
  const fy = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text(`Total Debit: ₹${totalDebit.toFixed(2)}`, 14, fy);
  doc.text(`Total Credit: ₹${totalCredit.toFixed(2)}`, 14, fy + 6);
  doc.setFontSize(12);
  const label = contactType === 'customer' ? 'Outstanding' : 'Payable';
  doc.text(`${label}: ₹${balance.toFixed(2)}`, 14, fy + 14);

  doc.save(`ledger_${contact.name}.pdf`);
}

export function sendWhatsAppReminder(contact: Contact, balance: number) {
  const msg = `Dear ${contact.name}, your pending balance is ₹${balance.toFixed(2)}. Kindly clear at your earliest. Thank you.`;
  const url = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
