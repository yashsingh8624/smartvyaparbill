import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Download, Upload, Moon, Globe, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings } = useApp();
  const lang = settings.language;

  async function handleBackup() {
    const data = {
      contacts: await db.contacts.toArray(),
      ledgerEntries: await db.ledgerEntries.toArray(),
      invoices: await db.invoices.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    a.download = `smartvyapar-backup-${dd}-${mm}-${yyyy}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup downloaded!');
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(t('restoreConfirm', lang))) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await db.contacts.clear();
      await db.ledgerEntries.clear();
      await db.invoices.clear();
      await db.settings.clear();
      if (data.contacts) await db.contacts.bulkAdd(data.contacts);
      if (data.ledgerEntries) await db.ledgerEntries.bulkAdd(data.ledgerEntries);
      if (data.invoices) await db.invoices.bulkAdd(data.invoices);
      if (data.settings) await db.settings.bulkAdd(data.settings);
      toast.success('Data restored! Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error('Invalid backup file');
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('Logo must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ logo: reader.result as string });
      toast.success('Logo uploaded!');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground">{t('settings', lang)}</h2>

      {/* Logo Upload */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Label>{t('logo', lang)}</Label>
          <div className="flex items-center gap-4">
            {settings.logo ? (
              <div className="relative">
                <img src={settings.logo} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-border" />
                <button
                  onClick={() => updateSettings({ logo: undefined })}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-input')?.click()}>
                <Upload className="h-3 w-3 mr-1" />{settings.logo ? t('uploadLogo', lang) : t('uploadLogo', lang)}
              </Button>
              <input id="logo-input" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG, max 500KB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>{t('businessName', lang)}</Label>
            <Input value={settings.businessName} onChange={e => updateSettings({ businessName: e.target.value })} />
          </div>
          <div>
            <Label>{t('ownerName', lang)}</Label>
            <Input value={settings.ownerName} onChange={e => updateSettings({ ownerName: e.target.value })} />
          </div>
          <div>
            <Label>{t('phone', lang)}</Label>
            <Input value={settings.phone} onChange={e => updateSettings({ phone: e.target.value })} />
          </div>
          <div>
            <Label>{t('address', lang)}</Label>
            <Input value={settings.address} onChange={e => updateSettings({ address: e.target.value })} />
          </div>
          <div>
            <Label>{t('gstNumber', lang)}</Label>
            <Input value={settings.gstNumber} onChange={e => updateSettings({ gstNumber: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('invoicePrefix', lang)}</Label>
              <Input value={settings.invoicePrefix} onChange={e => updateSettings({ invoicePrefix: e.target.value })} />
            </div>
            <div>
              <Label>{t('defaultGstPercent', lang)}</Label>
              <Input type="number" min={0} max={100} value={settings.defaultGstPercent} onChange={e => updateSettings({ defaultGstPercent: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <Label>{t('darkMode', lang)}</Label>
            </div>
            <Switch checked={settings.darkMode} onCheckedChange={v => updateSettings({ darkMode: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label>{t('language', lang)}</Label>
            </div>
            <div className="flex gap-2">
              <Button variant={lang === 'en' ? 'default' : 'outline'} size="sm" onClick={() => updateSettings({ language: 'en' })}>English</Button>
              <Button variant={lang === 'hi' ? 'default' : 'outline'} size="sm" onClick={() => updateSettings({ language: 'hi' })}>हिंदी</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Button variant="outline" className="w-full" onClick={handleBackup}>
            <Download className="h-4 w-4 mr-2" />{t('backup', lang)}
          </Button>
          <div>
            <Button variant="outline" className="w-full" onClick={() => document.getElementById('restore-input')?.click()}>
              <Upload className="h-4 w-4 mr-2" />{t('restore', lang)}
            </Button>
            <input id="restore-input" type="file" accept=".json" className="hidden" onChange={handleRestore} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
