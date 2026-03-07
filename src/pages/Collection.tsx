import { useState } from 'react';
import { useContacts, useLedgerEntries, addLedgerEntry, getNextRefNo } from '@/hooks/useData';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { formatINR } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function Collection() {
  const { settings } = useApp();
  const lang = settings.language;

  const customers = useContacts('customer');
  const allEntries = useLedgerEntries();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('Cash');
  const [payNote, setPayNote] = useState('');
  const [search, setSearch] = useState('');

  const customerDues = customers.map(c => {
    const entries = allEntries.filter(e => e.contactId === c.id);
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const due = Math.round((totalDebit - totalCredit) * 100) / 100;
    return { ...c, due };
  }).filter(c => c.due > 0);

  const filtered = customerDues.filter(
    c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const selectedCustomer = customerDues.find(c => c.id === selectedId);

  const selectedAllEntries = allEntries
    .filter(e => e.contactId === selectedId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let runningBal = 0;
  const paymentHistory = selectedAllEntries
    .reduce<{ date: string; amount: number; remaining: number; note: string }[]>((acc, e) => {
      runningBal = Math.round((runningBal + e.debit - e.credit) * 100) / 100;
      if (e.credit > 0) {
        acc.push({ date: e.date, amount: e.credit, remaining: Math.max(0, runningBal), note: e.note || '' });
      }
      return acc;
    }, []).reverse();

  async function savePayment() {
    if (!selectedId || payAmount <= 0) return;
    if (selectedCustomer && payAmount > selectedCustomer.due) {
      toast.error('Amount exceeds due balance');
      return;
    }
    const refNo = await getNextRefNo(selectedId, 'COL');
    await addLedgerEntry({
      contactId: selectedId,
      date: payDate, refNo,
      description: `Collection - ${payMode}${payNote ? ` (${payNote})` : ''}`,
      debit: 0, credit: Math.round(payAmount * 100) / 100,
      mode: payMode, note: payNote,
      createdAt: new Date().toISOString(),
    });
    toast.success(t('paymentSaved', lang));
    setShowPayment(false);
    setPayAmount(0);
    setPayNote('');
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground">{t('collection', lang)}</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('search', lang)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noDues', lang)}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card
              key={c.id}
              className={`shadow-sm cursor-pointer transition-colors ${selectedId === c.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id!)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-card-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-debit">{formatINR(c.due)}</p>
                  <Button
                    variant="credit" size="sm" className="mt-1"
                    onClick={e => { e.stopPropagation(); setSelectedId(c.id!); setShowPayment(true); }}
                  >
                    <Wallet className="h-3 w-3 mr-1" />{t('addDailyPayment', lang)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedId && paymentHistory.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-card-foreground">
              {selectedCustomer?.name} - {t('paymentHistory', lang)}
            </h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t('date', lang)}</TableHead>
                    <TableHead className="text-xs text-right">{t('amount', lang)}</TableHead>
                    <TableHead className="text-xs text-right">{t('remainingBalance', lang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{p.date}</TableCell>
                      <TableCell className="text-xs text-right text-credit font-medium">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatINR(p.remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addDailyPayment', lang)} - {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedCustomer && (
              <div className="flex justify-between items-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <span className="text-sm font-medium text-debit">{t('totalDue', lang)}</span>
                <span className="text-lg font-bold text-debit">{formatINR(selectedCustomer.due)}</span>
              </div>
            )}
            <div><Label>{t('date', lang)}</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
            <div><Label>{t('amount', lang)}</Label><Input type="number" min={0} max={selectedCustomer?.due || 0} value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} /></div>
            <div><Label>{t('mode', lang)}</Label>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Cash', 'UPI', 'Bank', 'Other'].map(m => (
                    <SelectItem key={m} value={m}>{t(m.toLowerCase(), lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('note', lang)}</Label><Input value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
            <Button className="w-full" variant="credit" onClick={savePayment}>{t('save', lang)}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
