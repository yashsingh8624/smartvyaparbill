import { useContacts, useLedgerEntries, useInvoices } from '@/hooks/useData';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { formatINR } from '@/lib/utils';
import { generateTodaySalesReportPDF } from '@/lib/pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IndianRupee, TrendingUp, TrendingDown, ShoppingCart, Wallet, CalendarDays, FileText } from 'lucide-react';

export default function Dashboard() {
  const { settings } = useApp();
  const lang = settings.language;
  const today = new Date().toISOString().split('T')[0];

  const customers = useContacts('customer');
  const vendors = useContacts('vendor');
  const allEntries = useLedgerEntries();
  const invoices = useInvoices();

  const customerIds = new Set(customers.map(c => c.id!));
  const vendorIds = new Set(vendors.map(v => v.id!));

  const custEntries = allEntries.filter(e => customerIds.has(e.contactId));
  const vendEntries = allEntries.filter(e => vendorIds.has(e.contactId));

  const totalCustDebit = custEntries.reduce((s, e) => s + e.debit, 0);
  const totalCustCredit = custEntries.reduce((s, e) => s + e.credit, 0);
  const totalVendDebit = vendEntries.reduce((s, e) => s + e.debit, 0);
  const totalVendCredit = vendEntries.reduce((s, e) => s + e.credit, 0);

  const todayCustEntries = custEntries.filter(e => e.date === today);
  const todaySales = todayCustEntries.reduce((s, e) => s + e.debit, 0);
  const todayPayments = todayCustEntries.reduce((s, e) => s + e.credit, 0);

  const todayInvoices = invoices.filter(inv => inv.date === today);

  const cards = [
    { label: t('totalCustomerOutstanding', lang), value: totalCustDebit - totalCustCredit, icon: Users2Icon, color: 'text-debit' },
    { label: t('totalVendorPayable', lang), value: totalVendDebit - totalVendCredit, icon: TrendingDown, color: 'text-secondary' },
    { label: t('totalSales', lang), value: totalCustDebit, icon: ShoppingCart, color: 'text-primary' },
    { label: t('paymentsReceived', lang), value: totalCustCredit, icon: Wallet, color: 'text-credit' },
    { label: t('paymentsGiven', lang), value: totalVendCredit, icon: TrendingUp, color: 'text-debit' },
    { label: t('todaySales', lang), value: todaySales, icon: CalendarDays, color: 'text-primary' },
    { label: t('todayPayments', lang), value: todayPayments, icon: IndianRupee, color: 'text-credit' },
  ];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t('dashboard', lang)}</h2>
        <Button variant="outline" size="sm" onClick={() => generateTodaySalesReportPDF(settings, todayInvoices, customers, todaySales, todayPayments)}>
          <FileText className="h-4 w-4 mr-1" />{t('todaySalesReport', lang)}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <Card key={i} className={`${i === 0 ? 'col-span-2' : ''} shadow-sm`}>
            <CardContent className="flex items-center gap-3 p-4">
              <c.icon className={`h-8 w-8 ${c.color} flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                <p className="text-lg font-bold text-card-foreground">{formatINR(c.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Users2Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
