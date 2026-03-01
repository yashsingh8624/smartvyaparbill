import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Contact } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ContactList() {
  const location = useLocation();
  const contactType = (location.pathname.includes('vendor') ? 'vendor' : 'customer') as Contact['type'];
  const navigate = useNavigate();
  const { settings } = useApp();
  const lang = settings.language;

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const contacts = useLiveQuery(
    () => db.contacts.where('type').equals(contactType).toArray(),
    [contactType]
  ) || [];

  const allEntries = useLiveQuery(() => db.ledgerEntries.toArray()) || [];

  const filtered = contacts.filter(
    c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  function getBalance(contactId: number) {
    const entries = allEntries.filter(e => e.contactId === contactId);
    const d = entries.reduce((s, e) => s + e.debit, 0);
    const c = entries.reduce((s, e) => s + e.credit, 0);
    return d - c;
  }

  async function handleAdd() {
    if (!name.trim()) return;
    const id = await db.contacts.add({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      type: contactType,
      createdAt: new Date().toISOString(),
    });
    setShowAdd(false);
    setName(''); setPhone(''); setAddress('');
    navigate(`/${contactType}s/${id}`);
  }

  const isCustomer = contactType === 'customer';
  const title = isCustomer ? t('customers', lang) : t('vendors', lang);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {isCustomer ? t('addCustomer', lang) : t('addVendor', lang)}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('search', lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">{t('noContacts', lang)}</p>
      )}

      <div className="space-y-2">
        {filtered.map(c => {
          const bal = getBalance(c.id!);
          return (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/${contactType}s/${c.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-sm text-card-foreground">₹{bal.toFixed(2)}</p>
                    <Badge variant={bal > 0 ? 'destructive' : 'default'} className={`text-[10px] ${bal === 0 ? 'bg-credit text-credit-foreground' : ''}`}>
                      {bal > 0
                        ? (isCustomer ? t('due', lang) : t('payable', lang))
                        : (isCustomer ? t('paid', lang) : t('cleared', lang))}
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCustomer ? t('addCustomer', lang) : t('addVendor', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('name', lang)} *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>{t('phone', lang)}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><Label>{t('address', lang)}</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
            <Button className="w-full" onClick={handleAdd}>{t('save', lang)}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
