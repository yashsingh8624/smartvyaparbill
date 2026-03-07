import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  useContact, useLedgerEntries, useInvoices,
  addLedgerEntry, deleteLedgerEntry, updateContact,
  deleteContact as deleteContactFn, deleteInvoice as deleteInvoiceFn,
  getNextRefNo,
} from '@/hooks/useData';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { formatINR } from '@/lib/utils';
import { generateFullLedgerPDF, sendWhatsAppReminder } from '@/lib/pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, MessageCircle, Plus, Wallet, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useApp();
  const lang = settings.language;
  const contactType = location.pathname.includes('vendor') ? 'vendor' : 'customer';
  const isCustomer = contactType === 'customer';

  const contact = useContact(Number(id));
  const entries = useLedgerEntries(Number(id));
  const invoices = useInvoices(isCustomer ? Number(id) : undefined);
  const customerInvoices = isCustomer ? invoices : [];

  const [showDebit, setShowDebit] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteInvoice, setShowDeleteInvoice] = useState<number | null>(null);

  const [dDate, setDDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dDesc, setDDesc] = useState('');
  const [dQty, setDQty] = useState(1);
  const [dRate, setDRate] = useState(0);

  const [cDate, setCDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cAmount, setCAmount] = useState(0);
  const [cMode, setCMode] = useState('Cash');
  const [cNote, setCNote] = useState('');

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  if (!contact) return null;

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balance = Math.round((totalDebit - totalCredit) * 100) / 100;

  let runBal = 0;
  const withBalance = entries.map(e => {
    runBal += e.debit - e.credit;
    return { ...e, runBal: Math.round(runBal * 100) / 100 };
  });

  async function addDebit() {
    const amount = Math.round(dQty * dRate * 100) / 100;
    if (amount <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (dQty <= 0 || dRate <= 0) { toast.error('Quantity and rate must be positive'); return; }
    const prefix = isCustomer ? 'S' : 'P';
    const refNo = await getNextRefNo(contact.id!, prefix);
    await addLedgerEntry({
      contactId: contact.id!, date: dDate, refNo, description: dDesc || 'Goods',
      debit: amount, credit: 0, createdAt: new Date().toISOString(),
    });
    setShowDebit(false);
    setDDesc(''); setDQty(1); setDRate(0);
  }

  async function addCredit() {
    if (cAmount <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (cAmount > balance) { toast.error('Amount exceeds outstanding balance'); return; }
    const refNo = await getNextRefNo(contact.id!, 'PAY');
    await addLedgerEntry({
      contactId: contact.id!, date: cDate, refNo,
      description: `Payment - ${cMode}`, debit: 0, credit: Math.round(cAmount * 100) / 100,
      mode: cMode, note: cNote, createdAt: new Date().toISOString(),
    });
    setShowCredit(false);
    setCAmount(0); setCNote('');
  }

  function openEdit() {
    setEditName(contact.name);
    setEditPhone(contact.phone);
    setEditAddress(contact.address || '');
    setShowEdit(true);
  }

  async function saveEdit() {
    await updateContact(contact.id!, { name: editName, phone: editPhone, address: editAddress });
    toast.success('Contact updated');
    setShowEdit(false);
  }

  async function handleDeleteContact() {
    await deleteContactFn(contact.id!);
    toast.success('Contact deleted');
    navigate(-1);
  }

  async function handleDeleteInvoice(invoiceId: number) {
    const inv = customerInvoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const relatedEntries = entries.filter(
      e => e.refNo === inv.invoiceNo || e.refNo === `${inv.invoiceNo}-PAY`
    );
    for (const entry of relatedEntries) {
      if (entry.id) await deleteLedgerEntry(entry.id);
    }
    await deleteInvoiceFn(invoiceId);
    toast.success(`Invoice ${inv.invoiceNo} deleted`);
    setShowDeleteInvoice(null);
  }

  const statusBadge = balance > 0
    ? <Badge variant="destructive">{isCustomer ? t('due', lang) : t('payable', lang)}</Badge>
    : <Badge className="bg-credit text-credit-foreground">{isCustomer ? t('paid', lang) : t('cleared', lang)}</Badge>;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-primary font-medium">
          <ArrowLeft className="h-4 w-4" /> {contact.name}
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">{isCustomer ? t('totalGoodsTaken', lang) : t('totalPurchases', lang)}</p>
          <p className="text-lg font-bold text-debit">{formatINR(totalDebit)}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">{t('totalPaid', lang)}</p>
          <p className="text-lg font-bold text-credit">{formatINR(totalCredit)}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase">{isCustomer ? t('outstanding', lang) : t('payable', lang)}</p>
          <p className="text-lg font-bold text-foreground">{formatINR(balance)}</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 flex items-center justify-center">
          {statusBadge}
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="debit" size="sm" onClick={() => setShowDebit(true)}>
          <Plus className="h-4 w-4 mr-1" />{isCustomer ? t('addSale', lang) : t('addPurchase', lang)}
        </Button>
        <Button variant="credit" size="sm" onClick={() => setShowCredit(true)}>
          <Wallet className="h-4 w-4 mr-1" />{t('addPayment', lang)}
        </Button>
        <Button variant="outline" size="sm" className="col-span-2" onClick={() => generateFullLedgerPDF(settings, contact, entries, contactType)}>
          <FileText className="h-4 w-4 mr-1" />{t('fullLedger', lang)}
        </Button>
        {contact.phone && (
          <Button variant="secondary" size="sm" className="col-span-2" onClick={() => sendWhatsAppReminder(contact, balance)}>
            <MessageCircle className="h-4 w-4 mr-1" />{t('whatsappReminder', lang)}
          </Button>
        )}
      </div>

      {isCustomer && customerInvoices.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-card-foreground">{t('invoiceHistory', lang)}</h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t('invoiceNo', lang)}</TableHead>
                    <TableHead className="text-xs">{t('date', lang)}</TableHead>
                    <TableHead className="text-xs text-right">{t('total', lang)}</TableHead>
                    <TableHead className="text-xs text-right">{t('paidAmount', lang)}</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...customerInvoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs font-medium">{inv.invoiceNo}</TableCell>
                      <TableCell className="text-xs">{inv.date}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatINR(inv.total)}</TableCell>
                      <TableCell className="text-xs text-right text-credit">{formatINR(inv.paidAmount)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteInvoice(inv.id!)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">{t('noEntries', lang)}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t('date', lang)}</TableHead>
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
                  <TableCell className="text-xs">{e.description}</TableCell>
                  <TableCell className="text-xs text-right text-debit font-medium">{e.debit > 0 ? formatINR(e.debit) : '-'}</TableCell>
                  <TableCell className="text-xs text-right text-credit font-medium">{e.credit > 0 ? formatINR(e.credit) : '-'}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{formatINR(e.runBal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
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
              <span className="text-lg font-bold text-foreground">{formatINR(dQty * dRate)}</span>
            </div>
            <Button className="w-full" variant="debit" onClick={addDebit}>{t('save', lang)}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCredit} onOpenChange={setShowCredit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addPayment', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('date', lang)}</Label><Input type="date" value={cDate} onChange={e => setCDate(e.target.value)} /></div>
            <div><Label>{t('amount', lang)} (max {formatINR(balance)})</Label>
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

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editCustomer', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('name', lang)}</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><Label>{t('phone', lang)}</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
            <div><Label>{t('address', lang)}</Label><Input value={editAddress} onChange={e => setEditAddress(e.target.value)} /></div>
            <Button className="w-full" onClick={saveEdit}>{t('save', lang)}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('confirm', lang)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('deleteContactConfirm', lang)}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>{t('cancel', lang)}</Button>
            <Button variant="destructive" onClick={handleDeleteContact}>{t('delete', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteInvoice !== null} onOpenChange={() => setShowDeleteInvoice(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('confirm', lang)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('deleteInvoiceConfirm', lang)}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteInvoice(null)}>{t('cancel', lang)}</Button>
            <Button variant="destructive" onClick={() => showDeleteInvoice && handleDeleteInvoice(showDeleteInvoice)}>{t('delete', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
