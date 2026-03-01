import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getNextRefNo } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { generateTodayBillPDF, generateFullLedgerPDF, sendWhatsAppReminder } from '@/lib/pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, MessageCircle, Plus, Wallet } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useApp();
  const lang = settings.language;
  const contactType = location.pathname.includes('vendor') ? 'vendor' : 'customer';
  const isCustomer = contactType === 'customer';

  const contact = useLiveQuery(() => db.contacts.get(Number(id)), [id]);
  const entries = useLiveQuery(
    () => db.ledgerEntries.where('contactId').equals(Number(id)).sortBy('createdAt'),
    [id]
  ) || [];

  const [showDebit, setShowDebit] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  // Debit form
  const [dDate, setDDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dDesc, setDDesc] = useState('');
  const [dQty, setDQty] = useState(1);
  const [dRate, setDRate] = useState(0);

  // Credit form
  const [cDate, setCDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cAmount, setCAmount] = useState(0);
  const [cMode, setCMode] = useState('Cash');
  const [cNote, setCNote] = useState('');

  if (!contact) return null;

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balance = totalDebit - totalCredit;

  let runBal = 0;
  const withBalance = entries.map(e => {
    runBal += e.debit - e.credit;
    return { ...e, runBal };
  });

  async function addDebit() {
    const amount = dQty * dRate;
    if (amount <= 0) return;
    const prefix = isCustomer ? 'S' : 'P';
    const refNo = await getNextRefNo(contact.id!, prefix);
    await db.ledgerEntries.add({
      contactId: contact.id!, date: dDate, refNo, description: dDesc || 'Goods',
      debit: amount, credit: 0, createdAt: new Date().toISOString(),
    });
    setShowDebit(false);
    setDDesc(''); setDQty(1); setDRate(0);
  }

  async function addCredit() {
    if (cAmount <= 0 || cAmount > balance) return;
    const refNo = await getNextRefNo(contact.id!, 'PAY');
    await db.ledgerEntries.add({
      contactId: contact.id!, date: cDate, refNo,
      description: `Payment - ${cMode}`, debit: 0, credit: cAmount,
      mode: cMode, note: cNote, createdAt: new Date().toISOString(),
    });
    setShowCredit(false);
    setCAmount(0); setCNote('');
  }

  const statusBadge = balance > 0
    ? <Badge variant="destructive">{isCustomer ? t('due', lang) : t('payable', lang)}</Badge>
    : <Badge className="bg-credit text-credit-foreground">{isCustomer ? t('paid', lang) : t('cleared', lang)}</Badge>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-primary font-medium">
        <ArrowLeft className="h-4 w-4" /> {contact.name}
      </button>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">{isCustomer ? t('totalGoodsTaken', lang) : t('totalPurchases', lang)}</p>
          <p className="text-lg font-bold text-debit">₹{totalDebit.toFixed(2)}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">{t('totalPaid', lang)}</p>
          <p className="text-lg font-bold text-credit">₹{totalCredit.toFixed(2)}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">{isCustomer ? t('outstanding', lang) : t('payable', lang)}</p>
          <p className="text-lg font-bold text-foreground">₹{balance.toFixed(2)}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 flex items-center justify-center">
          {statusBadge}
        </CardContent></Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="debit" size="sm" onClick={() => setShowDebit(true)}>
          <Plus className="h-4 w-4 mr-1" />{isCustomer ? t('addSale', lang) : t('addPurchase', lang)}
        </Button>
        <Button variant="credit" size="sm" onClick={() => setShowCredit(true)}>
          <Wallet className="h-4 w-4 mr-1" />{t('addPayment', lang)}
        </Button>
        <Button variant="outline" size="sm" onClick={() => generateTodayBillPDF(settings, contact, entries)}>
          <FileText className="h-4 w-4 mr-1" />{t('todayBill', lang)}
        </Button>
        <Button variant="outline" size="sm" onClick={() => generateFullLedgerPDF(settings, contact, entries, contactType)}>
          <FileText className="h-4 w-4 mr-1" />{t('fullLedger', lang)}
        </Button>
        {contact.phone && (
          <Button variant="secondary" size="sm" className="col-span-2" onClick={() => sendWhatsAppReminder(contact, balance)}>
            <MessageCircle className="h-4 w-4 mr-1" />{t('whatsappReminder', lang)}
          </Button>
        )}
      </div>

      {/* Ledger Table */}
      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">{t('noEntries', lang)}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t('date', lang)}</TableHead>
                <TableHead className="text-xs">{t('refNo', lang)}</TableHead>
                <TableHead className="text-xs">{t('description', lang)}</TableHead>
                <TableHead className="text-xs text-right text-debit">{t('debit', lang)}</TableHead>
                <TableHead className="text-xs text-right text-credit">{t('credit', lang)}</TableHead>
                <TableHead className="text-xs text-right font-bold">{t('balance', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withBalance.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">{e.date}</TableCell>
                  <TableCell className="text-xs">{e.refNo}</TableCell>
                  <TableCell className="text-xs">{e.description}</TableCell>
                  <TableCell className="text-xs text-right text-debit font-medium">{e.debit > 0 ? `₹${e.debit.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-xs text-right text-credit font-medium">{e.credit > 0 ? `₹${e.credit.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-xs text-right font-bold">₹{e.runBal.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Debit Dialog */}
      <Dialog open={showDebit} onOpenChange={setShowDebit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCustomer ? t('addSale', lang) : t('addPurchase', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('date', lang)}</Label><Input type="date" value={dDate} onChange={e => setDDate(e.target.value)} /></div>
            <div><Label>{t('itemDescription', lang)}</Label><Input value={dDesc} onChange={e => setDDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('quantity', lang)}</Label><Input type="number" min={1} value={dQty} onChange={e => setDQty(Number(e.target.value))} /></div>
              <div><Label>{t('rate', lang)}</Label><Input type="number" min={0} value={dRate} onChange={e => setDRate(Number(e.target.value))} /></div>
            </div>
            <div className="flex justify-between items-center bg-muted p-3 rounded-lg">
              <span className="text-sm text-muted-foreground">{t('amount', lang)}</span>
              <span className="text-lg font-bold text-foreground">₹{(dQty * dRate).toFixed(2)}</span>
            </div>
            <Button className="w-full" variant="debit" onClick={addDebit}>{t('save', lang)}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Credit Dialog */}
      <Dialog open={showCredit} onOpenChange={setShowCredit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addPayment', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('date', lang)}</Label><Input type="date" value={cDate} onChange={e => setCDate(e.target.value)} /></div>
            <div><Label>{t('amount', lang)} (max ₹{balance.toFixed(2)})</Label>
              <Input type="number" min={0} max={balance} value={cAmount} onChange={e => setCAmount(Number(e.target.value))} />
            </div>
            <div><Label>{t('mode', lang)}</Label>
              <Select value={cMode} onValueChange={setCMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Cash', 'UPI', 'Bank', 'Other'].map(m => (
                    <SelectItem key={m} value={m}>{t(m.toLowerCase(), lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('note', lang)}</Label><Input value={cNote} onChange={e => setCNote(e.target.value)} /></div>
            <Button className="w-full" variant="credit" onClick={addCredit}>{t('save', lang)}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
