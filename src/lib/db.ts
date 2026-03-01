import Dexie, { type Table } from 'dexie';

export interface Contact {
  id?: number;
  name: string;
  phone: string;
  address?: string;
  type: 'customer' | 'vendor';
  createdAt: string;
}

export interface LedgerEntry {
  id?: number;
  contactId: number;
  date: string;
  refNo: string;
  description: string;
  debit: number;
  credit: number;
  mode?: string;
  note?: string;
  createdAt: string;
}

export interface Invoice {
  id?: number;
  invoiceNo: string;
  customerId: number;
  date: string;
  items: { name: string; qty: number; rate: number; amount: number }[];
  subtotal: number;
  gstEnabled: boolean;
  gstPercent: number;
  gstAmount: number;
  roundOff: number;
  total: number;
  createdAt: string;
}

export interface AppSettings {
  id?: number;
  businessName: string;
  ownerName: string;
  phone: string;
  address: string;
  gstNumber: string;
  invoicePrefix: string;
  defaultGstPercent: number;
  darkMode: boolean;
  language: 'en' | 'hi';
}

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'My Shop',
  ownerName: '',
  phone: '',
  address: '',
  gstNumber: '',
  invoicePrefix: 'INV',
  defaultGstPercent: 18,
  darkMode: false,
  language: 'en',
};

class VyaparDB extends Dexie {
  contacts!: Table<Contact>;
  ledgerEntries!: Table<LedgerEntry>;
  invoices!: Table<Invoice>;
  settings!: Table<AppSettings>;

  constructor() {
    super('smartVyaparLedger');
    this.version(1).stores({
      contacts: '++id, type, name, phone',
      ledgerEntries: '++id, contactId, date',
      invoices: '++id, invoiceNo, customerId, date',
      settings: '++id',
    });
  }
}

export const db = new VyaparDB();

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.toCollection().first();
  if (s) return s;
  const defaults = { ...DEFAULT_SETTINGS };
  await db.settings.add(defaults);
  return (await db.settings.toCollection().first())!;
}

export async function saveSettings(s: AppSettings) {
  if (s.id) {
    await db.settings.put(s);
  }
}

export async function getNextRefNo(contactId: number, prefix: string): Promise<string> {
  const count = await db.ledgerEntries.where('contactId').equals(contactId).count();
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

export async function getNextInvoiceNo(invoicePrefix: string): Promise<string> {
  const count = await db.invoices.count();
  return `${invoicePrefix}-${String(count + 1).padStart(4, '0')}`;
}
