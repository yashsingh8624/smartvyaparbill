import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { exportAllData, importAllData } from '@/hooks/useData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Download, Upload, Moon, Globe, ImagePlus, X, Cloud, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings } = useApp();
  const { user } = useAuth();
  const lang = settings.language;

  async function handleBackup() {
    const data = await exportAllData();
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

  function validateBackupData(data: unknown): data is {
    contacts?: unknown[];
    ledgerEntries?: unknown[];
    invoices?: unknown[];
    settings?: unknown[];
  } {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    const d = data as Record<string, unknown>;
    for (const key of ['contacts', 'ledgerEntries', 'invoices', 'settings']) {
      if (key in d && !Array.isArray(d[key])) return false;
    }
    if (Array.isArray(d.contacts)) {
      for (const c of d.contacts as Record<string, unknown>[]) {
        if (typeof c.name !== 'string' || !c.name.trim()) return false;
        if (typeof c.type !== 'string' || !['customer', 'vendor'].includes(c.type)) return false;
      }
    }
    if (Array.isArray(d.ledgerEntries)) {
      for (const e of d.ledgerEntries as Record<string, unknown>[]) {
        if (typeof e.contactId !== 'number') return false;
        if (typeof e.debit !== 'number' || e.debit < 0) return false;
        if (typeof e.credit !== 'number' || e.credit < 0) return false;
      }
    }
    if (Array.isArray(d.invoices)) {
      for (const inv of d.invoices as Record<string, unknown>[]) {
        if (typeof inv.invoiceNo !== 'string') return false;
        if (typeof inv.customerId !== 'number') return false;
        if (typeof inv.total !== 'number' || inv.total < 0) return false;
      }
    }
    if (Array.isArray(d.settings)) {
      for (const s of d.settings as Record<string, unknown>[]) {
        if (typeof s.businessName !== 'string') return false;
        if (typeof s.defaultGstPercent === 'number' && (s.defaultGstPercent < 0 || s.defaultGstPercent > 100)) return false;
        if (s.language !== undefined && !['en', 'hi'].includes(s.language as string)) return false;
      }
    }
    return true;
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(t('restoreConfirm', lang))) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!validateBackupData(data)) {
        toast.error('Invalid or corrupted backup file. Restore aborted.');
        return;
      }
      await importAllData(data);
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

      {/* Connection Status */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Cloud className="h-5 w-5 text-credit" />
                <div>
                  <p className="text-sm font-medium text-card-foreground">Connected to Cloud</p>
                  <p className="text-xs text-muted-foreground">{user.email} — data syncs across devices</p>
                </div>
              </>
            ) : (
              <>
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-card-foreground">Offline Mode</p>
                  <p className="text-xs text-muted-foreground">Data stored locally on this device only</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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
                <Upload className="h-3 w-3 mr-1" />{t('uploadLogo', lang)}
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
