import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getNextInvoiceNo } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, Search } from 'lucide-react';
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
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', qty: 1, rate: 0, amount: 0 }]);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstPercent, setGstPercent] = useState(settings.defaultGstPercent);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const filteredCustomers = customers.filter(
    c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)
  );

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => {
      const copy = [...prev];
      const item = { ...copy[i], [field]: value };
      item.amount = item.qty * item.rate;
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

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const gstAmount = gstEnabled ? Math.round(subtotal * gstPercent / 100 * 100) / 100 : 0;
  const rawTotal = subtotal + gstAmount;
  const roundOff = Math.round(rawTotal) - rawTotal;
  const total = Math.round(rawTotal);

  async function saveInvoice() {
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (items.every(it => it.amount === 0)) { toast.error('Add at least one item'); return; }

    const invoiceNo = await getNextInvoiceNo(settings.invoicePrefix);

    await db.invoices.add({
      invoiceNo,
      customerId,
      date,
      items: items.filter(it => it.amount > 0),
      subtotal,
      gstEnabled,
      gstPercent,
      gstAmount,
      roundOff: Math.round(roundOff * 100) / 100,
      total,
      createdAt: new Date().toISOString(),
    });

    // Add debit entry to customer ledger
    const entryCount = await db.ledgerEntries.where('contactId').equals(customerId).count();
    await db.ledgerEntries.add({
      contactId: customerId,
      date,
      refNo: invoiceNo,
      description: `Invoice ${invoiceNo}`,
      debit: total,
      credit: 0,
      createdAt: new Date().toISOString(),
    });

    toast.success(`Invoice ${invoiceNo} saved!`);
    setItems([{ name: '', qty: 1, rate: 0, amount: 0 }]);
    setCustomerId(null);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground">{t('billing', lang)}</h2>

      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Date & Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('date', lang)}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
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
                    <Input
                      placeholder={t('search', lang)}
                      value={custSearch}
                      onChange={e => setCustSearch(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                        onClick={() => { setCustomerId(c.id!); setCustOpen(false); setCustSearch(''); }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">{t('noContacts', lang)}</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Items</Label>
              <Button variant="ghost" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" />{t('addItem', lang)}
              </Button>
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
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t('total', lang)}</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full" onClick={saveInvoice}>
            <Save className="h-4 w-4 mr-2" />{t('saveInvoice', lang)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
