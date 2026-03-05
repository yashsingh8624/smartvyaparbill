import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getNextInvoiceNo } from '@/lib/db';
import type { Invoice } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { generateInvoicePDF } from '@/lib/invoicePdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, Search, FileDown, Printer } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

interface InvoiceItem {
  name: string;
  qty: number;
  rate: number;
  amount: number;
}

export default function Billing() {
  const { settings } = useApp();
  const lang = settings.language;

  const customers = useLiveQuery(() => db.contacts.where('type').equals('customer').toArray()) || [];

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', qty: 1, rate: 0, amount: 0 }]);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstPercent, setGstPercent] = useState(settings.defaultGstPercent);
  const [previousDue, setPreviousDue] = useState(0);
  const [paidToday, setPaidToday] = useState(0);
  const [includePreviousDue, setIncludePreviousDue] = useState(true);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const filteredCustomers = customers.filter(
    c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)
  );

  const customerEntries = useLiveQuery(
    () => customerId ? db.ledgerEntries.where('contactId').equals(customerId).toArray() : Promise.resolve([]),
    [customerId]
  ) || [];

  useEffect(() => {
    if (customerId && customerEntries.length > 0) {
      const totalDebit = customerEntries.reduce((s, e) => s + e.debit, 0);
      const totalCredit = customerEntries.reduce((s, e) => s + e.credit, 0);
      setPreviousDue(Math.round(Math.max(0, totalDebit - totalCredit) * 100) / 100);
    } else {
      setPreviousDue(0);
    }
  }, [customerId, customerEntries]);

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => {
      const copy = [...prev];
      const item = { ...copy[i], [field]: value };
      item.amount = Math.round(item.qty * item.rate * 100) / 100;
      copy[i] = item;
      return copy;
    });
  }

  function addItem() {
    setItems(prev => [...prev, { name: '', qty: 1, rate: 0, amount: 0 }]);
  }

  function removeItem(i: number) {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = useMemo(() => Math.round(items.reduce((s, it) => s + it.amount, 0) * 100) / 100, [items]);
  const gstAmount = gstEnabled ? Math.round(subtotal * gstPercent / 100 * 100) / 100 : 0;
  const rawGrandTotal = Math.round((subtotal + gstAmount) * 100) / 100;
  const roundOff = Math.round((Math.round(rawGrandTotal) - rawGrandTotal) * 100) / 100;
  const grandTotal = Math.round(rawGrandTotal);
  const finalPayable = Math.round((grandTotal + (includePreviousDue ? previousDue : 0)) * 100) / 100;
  const remainingDue = Math.round((finalPayable - paidToday) * 100) / 100;

  async function saveInvoice() {
     if (!customerId) { toast.error('Please select a customer'); return; }
     if (items.every(it => it.amount === 0)) { toast.error('Add at least one item'); return; }

     const invoiceNo = await getNextInvoiceNo(settings.invoicePrefix);
     const prevDue = includePreviousDue ? previousDue : 0;

     const invoice: Omit<Invoice, 'id'> = {
       invoiceNo, customerId, date, dueDate,
       items: items.filter(it => it.amount > 0),
       subtotal, previousDue: prevDue, gstEnabled, gstPercent, gstAmount,
       roundOff, total: finalPayable,
       paidAmount: Math.round(paidToday * 100) / 100,
       createdAt: new Date().toISOString(),
     };

    const id = await db.invoices.add(invoice as Invoice);

     // Add debit entry for only the current invoice amount
     const debitAmount = Math.round(grandTotal * 100) / 100;
     await db.ledgerEntries.add({
       contactId: customerId, date, refNo: invoiceNo,
       description: `Invoice ${invoiceNo}`,
       debit: debitAmount, credit: 0,
       createdAt: new Date().toISOString(),
     });

    // Add credit entry if paid today > 0
    if (paidToday > 0) {
      await db.ledgerEntries.add({
        contactId: customerId, date, refNo: `${invoiceNo}-PAY`,
        description: `Payment against ${invoiceNo}`,
        debit: 0, credit: Math.round(paidToday * 100) / 100,
        mode: 'Cash', createdAt: new Date().toISOString(),
      });
    }

    const savedInvoice = await db.invoices.get(id);
    setLastSavedInvoice(savedInvoice || null);
    toast.success(`Invoice ${invoiceNo} saved!`);
  }

  function downloadPDF() {
    if (!lastSavedInvoice || !selectedCustomer) return;
    generateInvoicePDF(settings, selectedCustomer, lastSavedInvoice);
  }

  function printPDF() {
    if (!lastSavedInvoice || !selectedCustomer) return;
    generateInvoicePDF(settings, selectedCustomer, lastSavedInvoice, true);
  }

  function resetForm() {
    setItems([{ name: '', qty: 1, rate: 0, amount: 0 }]);
    setCustomerId(null);
    setPaidToday(0);
    setLastSavedInvoice(null);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground">{t('billing', lang)}</h2>

      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('date', lang)}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>{t('dueDate', lang)}</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t('selectCustomer', lang)}</Label>
            <Popover open={custOpen} onOpenChange={setCustOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  {selectedCustomer ? selectedCustomer.name : t('selectCustomer', lang)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 w-64">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder={t('search', lang)} value={custSearch} onChange={e => setCustSearch(e.target.value)} className="pl-7 h-8 text-sm" />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredCustomers.map(c => (
                    <button key={c.id} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                      onClick={() => { setCustomerId(c.id!); setCustOpen(false); setCustSearch(''); }}>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && <p className="text-xs text-muted-foreground p-2">{t('noContacts', lang)}</p>}
                </div>
              </PopoverContent>
            </Popover>
          </div>

           {customerId && (
             <div className="flex items-center justify-between gap-3 bg-muted p-3 rounded-lg">
               <div className="flex items-center gap-2 flex-1">
                 <Switch checked={includePreviousDue} onCheckedChange={setIncludePreviousDue} />
                 <Label className="text-sm font-medium">{t('includePreviousBalance', lang)}</Label>
               </div>
               {previousDue > 0 && (
                 <span className="text-sm font-semibold text-debit">₹{previousDue.toFixed(2)}</span>
               )}
             </div>
           )}

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Items</Label>
              <Button variant="ghost" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t('addItem', lang)}</Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <Label className="text-[10px]">{t('itemName', lang)}</Label>}
                  <Input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-[10px]">{t('quantity', lang)}</Label>}
                  <Input type="number" min={1} value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-[10px]">{t('rate', lang)}</Label>}
                  <Input type="number" min={0} value={item.rate} onChange={e => updateItem(i, 'rate', Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="col-span-3">
                  {i === 0 && <Label className="text-[10px]">{t('amount', lang)}</Label>}
                  <Input readOnly value={`₹${item.amount.toFixed(2)}`} className="h-9 text-sm bg-muted" />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(i)} disabled={items.length <= 1}>
                    <Trash2 className="h-3 w-3 text-debit" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Calculations */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('subtotal', lang)}</span>
              <span className="font-medium">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
                <Label className="text-sm">{t('enableGst', lang)}</Label>
              </div>
              {gstEnabled && (
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} max={100} value={gstPercent} onChange={e => setGstPercent(Number(e.target.value))} className="w-16 h-8 text-sm" />
                  <span className="text-sm">%</span>
                </div>
              )}
            </div>
            {gstEnabled && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('gstAmount', lang)}</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('roundOff', lang)}</span>
              <span>{roundOff >= 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>{t('grandTotal', lang)}</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
             {includePreviousDue && previousDue > 0 && (
               <div className="flex justify-between text-sm">
                 <span className="text-debit">{t('previousBalance', lang)}</span>
                 <span className="font-medium text-debit">₹{previousDue.toFixed(2)}</span>
               </div>
             )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t('finalPayable', lang)}</span>
              <span>₹{finalPayable.toFixed(2)}</span>
            </div>

            {/* Paid Today */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Label className="text-sm font-medium text-credit whitespace-nowrap">{t('paidToday', lang)}</Label>
              <Input
                type="number" min={0} max={finalPayable}
                value={paidToday}
                onChange={e => setPaidToday(Math.min(Number(e.target.value), finalPayable))}
                className="w-32 h-9 text-sm text-right"
              />
            </div>
            <div className="flex justify-between text-sm font-bold text-debit">
              <span>{t('remainingDue', lang)}</span>
              <span>₹{remainingDue.toFixed(2)}</span>
            </div>
          </div>

          {!lastSavedInvoice ? (
            <Button className="w-full" onClick={saveInvoice}>
              <Save className="h-4 w-4 mr-2" />{t('saveInvoice', lang)}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={downloadPDF}>
                  <FileDown className="h-4 w-4 mr-1" />{t('downloadInvoicePdf', lang)}
                </Button>
                <Button variant="outline" onClick={printPDF}>
                  <Printer className="h-4 w-4 mr-1" />{t('printInvoice', lang)}
                </Button>
              </div>
              <Button className="w-full" variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />New Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
