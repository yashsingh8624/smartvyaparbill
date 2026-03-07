import { useState, useEffect, useCallback } from 'react';
import { liveQuery } from 'dexie';
import { supabase } from '@/lib/supabase';
import { db, type Contact, type LedgerEntry, type Invoice, type AppSettings } from '@/lib/db';

// ── Auth state (set by AuthContext) ──
let _userId: string | null = null;
export function setAuthUserId(id: string | null) { _userId = id; }
export function getAuthUserId() { return _userId; }

function isOnline() { return !!_userId; }

// ── Mappers: Supabase snake_case ↔ App camelCase ──
function mapContact(r: any): Contact {
  return { id: r.id, name: r.name, phone: r.phone || '', address: r.address || '', type: r.type, createdAt: r.created_at };
}
function mapLedgerEntry(r: any): LedgerEntry {
  return { id: r.id, contactId: r.contact_id, date: r.date, refNo: r.ref_no || '', description: r.description || '', debit: Number(r.debit) || 0, credit: Number(r.credit) || 0, mode: r.mode, note: r.note, createdAt: r.created_at };
}
function mapInvoice(r: any): Invoice {
  return { id: r.id, invoiceNo: r.invoice_no, customerId: r.customer_id, date: r.date, dueDate: r.due_date, items: r.items || [], subtotal: Number(r.subtotal) || 0, previousDue: Number(r.previous_due) || 0, gstEnabled: r.gst_enabled, gstPercent: Number(r.gst_percent) || 0, gstAmount: Number(r.gst_amount) || 0, roundOff: Number(r.round_off) || 0, total: Number(r.total) || 0, paidAmount: Number(r.paid_amount) || 0, createdAt: r.created_at };
}
function mapSettings(r: any): AppSettings {
  return { id: r.id, businessName: r.business_name || 'My Shop', ownerName: r.owner_name || '', phone: r.phone || '', address: r.address || '', gstNumber: r.gst_number || '', invoicePrefix: r.invoice_prefix || 'INV', defaultGstPercent: Number(r.default_gst_percent) || 18, darkMode: !!r.dark_mode, language: r.language || 'en', logo: r.logo };
}

// ── Hooks ──

export function useContacts(type?: 'customer' | 'vendor'): Contact[] {
  const [data, setData] = useState<Contact[]>([]);

  useEffect(() => {
    if (isOnline()) {
      const fetch = async () => {
        let q = supabase.from('contacts').select('*').eq('user_id', _userId!);
        if (type) q = q.eq('type', type);
        const { data: rows } = await q.order('created_at', { ascending: true });
        setData((rows || []).map(mapContact));
      };
      fetch();
      const channel = supabase.channel(`contacts-${type || 'all'}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetch())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      const obs = type
        ? liveQuery(() => db.contacts.where('type').equals(type).toArray())
        : liveQuery(() => db.contacts.toArray());
      const sub = obs.subscribe({ next: items => setData(items), error: () => {} });
      return () => sub.unsubscribe();
    }
  }, [type, _userId]);

  return data;
}

export function useContact(id: number | undefined): Contact | undefined {
  const [data, setData] = useState<Contact | undefined>();

  useEffect(() => {
    if (!id) return;
    if (isOnline()) {
      const fetch = async () => {
        const { data: row } = await supabase.from('contacts').select('*').eq('id', id).eq('user_id', _userId!).single();
        setData(row ? mapContact(row) : undefined);
      };
      fetch();
      const channel = supabase.channel(`contact-${id}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `id=eq.${id}` }, () => fetch())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      const obs = liveQuery(() => db.contacts.get(id));
      const sub = obs.subscribe({ next: item => setData(item), error: () => {} });
      return () => sub.unsubscribe();
    }
  }, [id, _userId]);

  return data;
}

export function useLedgerEntries(contactId?: number): LedgerEntry[] {
  const [data, setData] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    if (isOnline()) {
      const fetch = async () => {
        let q = supabase.from('ledger_entries').select('*').eq('user_id', _userId!);
        if (contactId !== undefined) q = q.eq('contact_id', contactId);
        const { data: rows } = await q.order('created_at', { ascending: true });
        setData((rows || []).map(mapLedgerEntry));
      };
      fetch();
      const channel = supabase.channel(`ledger-${contactId ?? 'all'}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => fetch())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      const obs = contactId !== undefined
        ? liveQuery(() => db.ledgerEntries.where('contactId').equals(contactId).sortBy('createdAt'))
        : liveQuery(() => db.ledgerEntries.toArray());
      const sub = obs.subscribe({ next: items => setData(items), error: () => {} });
      return () => sub.unsubscribe();
    }
  }, [contactId, _userId]);

  return data;
}

export function useInvoices(customerId?: number): Invoice[] {
  const [data, setData] = useState<Invoice[]>([]);

  useEffect(() => {
    if (isOnline()) {
      const fetch = async () => {
        let q = supabase.from('invoices').select('*').eq('user_id', _userId!);
        if (customerId !== undefined) q = q.eq('customer_id', customerId);
        const { data: rows } = await q.order('created_at', { ascending: true });
        setData((rows || []).map(mapInvoice));
      };
      fetch();
      const channel = supabase.channel(`invoices-${customerId ?? 'all'}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetch())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      const obs = customerId !== undefined
        ? liveQuery(() => db.invoices.where('customerId').equals(customerId).toArray())
        : liveQuery(() => db.invoices.toArray());
      const sub = obs.subscribe({ next: items => setData(items), error: () => {} });
      return () => sub.unsubscribe();
    }
  }, [customerId, _userId]);

  return data;
}

// ── Mutations ──

export async function addContact(contact: Omit<Contact, 'id'>): Promise<number> {
  if (isOnline()) {
    const { data, error } = await supabase.from('contacts').insert({
      user_id: _userId, name: contact.name, phone: contact.phone, address: contact.address || '', type: contact.type, created_at: contact.createdAt,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }
  return await db.contacts.add(contact as Contact);
}

export async function updateContact(id: number, updates: Partial<Contact>) {
  if (isOnline()) {
    const mapped: any = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.phone !== undefined) mapped.phone = updates.phone;
    if (updates.address !== undefined) mapped.address = updates.address;
    const { error } = await supabase.from('contacts').update(mapped).eq('id', id).eq('user_id', _userId!);
    if (error) throw error;
  } else {
    await db.contacts.update(id, updates);
  }
}

export async function deleteContact(id: number) {
  if (isOnline()) {
    // Cascade deletes will handle related records
    const { error } = await supabase.from('contacts').delete().eq('id', id).eq('user_id', _userId!);
    if (error) throw error;
  } else {
    await db.ledgerEntries.where('contactId').equals(id).delete();
    const invs = await db.invoices.where('customerId').equals(id).toArray();
    if (invs.length > 0) await db.invoices.bulkDelete(invs.map(i => i.id!));
    await db.contacts.delete(id);
  }
}

export async function addLedgerEntry(entry: Omit<LedgerEntry, 'id'>): Promise<number> {
  if (isOnline()) {
    const { data, error } = await supabase.from('ledger_entries').insert({
      user_id: _userId, contact_id: entry.contactId, date: entry.date, ref_no: entry.refNo, description: entry.description, debit: entry.debit, credit: entry.credit, mode: entry.mode, note: entry.note, created_at: entry.createdAt,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }
  return await db.ledgerEntries.add(entry as LedgerEntry);
}

export async function deleteLedgerEntry(id: number) {
  if (isOnline()) {
    await supabase.from('ledger_entries').delete().eq('id', id).eq('user_id', _userId!);
  } else {
    await db.ledgerEntries.delete(id);
  }
}

export async function deleteLedgerEntriesByContact(contactId: number) {
  if (isOnline()) {
    await supabase.from('ledger_entries').delete().eq('contact_id', contactId).eq('user_id', _userId!);
  } else {
    await db.ledgerEntries.where('contactId').equals(contactId).delete();
  }
}

export async function addInvoice(invoice: Omit<Invoice, 'id'>): Promise<number> {
  if (isOnline()) {
    const { data, error } = await supabase.from('invoices').insert({
      user_id: _userId, invoice_no: invoice.invoiceNo, customer_id: invoice.customerId, date: invoice.date, due_date: invoice.dueDate, items: invoice.items, subtotal: invoice.subtotal, previous_due: invoice.previousDue, gst_enabled: invoice.gstEnabled, gst_percent: invoice.gstPercent, gst_amount: invoice.gstAmount, round_off: invoice.roundOff, total: invoice.total, paid_amount: invoice.paidAmount, created_at: invoice.createdAt,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }
  return await db.invoices.add(invoice as Invoice);
}

export async function getInvoice(id: number): Promise<Invoice | undefined> {
  if (isOnline()) {
    const { data } = await supabase.from('invoices').select('*').eq('id', id).eq('user_id', _userId!).single();
    return data ? mapInvoice(data) : undefined;
  }
  return await db.invoices.get(id);
}

export async function deleteInvoice(id: number) {
  if (isOnline()) {
    await supabase.from('invoices').delete().eq('id', id).eq('user_id', _userId!);
  } else {
    await db.invoices.delete(id);
  }
}

export async function getNextRefNo(contactId: number, prefix: string): Promise<string> {
  if (isOnline()) {
    const { count } = await supabase.from('ledger_entries').select('*', { count: 'exact', head: true }).eq('contact_id', contactId).eq('user_id', _userId!);
    return `${prefix}${String((count || 0) + 1).padStart(3, '0')}`;
  }
  const count = await db.ledgerEntries.where('contactId').equals(contactId).count();
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

export async function getNextInvoiceNo(invoicePrefix: string): Promise<string> {
  if (isOnline()) {
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', _userId!);
    return `${invoicePrefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  }
  const count = await db.invoices.count();
  return `${invoicePrefix}-${String(count + 1).padStart(4, '0')}`;
}

// ── Settings ──

export async function getSupabaseSettings(): Promise<AppSettings | null> {
  if (!isOnline()) return null;
  const { data } = await supabase.from('app_settings').select('*').eq('user_id', _userId!).single();
  return data ? mapSettings(data) : null;
}

export async function saveSupabaseSettings(s: AppSettings) {
  if (!isOnline()) return;
  const row: any = {
    user_id: _userId, business_name: s.businessName, owner_name: s.ownerName, phone: s.phone, address: s.address, gst_number: s.gstNumber, invoice_prefix: s.invoicePrefix, default_gst_percent: s.defaultGstPercent, dark_mode: s.darkMode, language: s.language, logo: s.logo,
  };
  if (s.id) {
    await supabase.from('app_settings').update(row).eq('id', s.id).eq('user_id', _userId!);
  } else {
    await supabase.from('app_settings').upsert({ ...row }, { onConflict: 'user_id' });
  }
}

// ── Backup / Restore ──

export async function exportAllData() {
  if (isOnline()) {
    const [contacts, entries, invoices, settings] = await Promise.all([
      supabase.from('contacts').select('*').eq('user_id', _userId!),
      supabase.from('ledger_entries').select('*').eq('user_id', _userId!),
      supabase.from('invoices').select('*').eq('user_id', _userId!),
      supabase.from('app_settings').select('*').eq('user_id', _userId!),
    ]);
    return {
      contacts: (contacts.data || []).map(mapContact),
      ledgerEntries: (entries.data || []).map(mapLedgerEntry),
      invoices: (invoices.data || []).map(mapInvoice),
      settings: (settings.data || []).map(mapSettings),
    };
  }
  return {
    contacts: await db.contacts.toArray(),
    ledgerEntries: await db.ledgerEntries.toArray(),
    invoices: await db.invoices.toArray(),
    settings: await db.settings.toArray(),
  };
}

export async function importAllData(data: { contacts?: any[]; ledgerEntries?: any[]; invoices?: any[]; settings?: any[] }) {
  if (isOnline()) {
    // Delete existing data
    await supabase.from('ledger_entries').delete().eq('user_id', _userId!);
    await supabase.from('invoices').delete().eq('user_id', _userId!);
    await supabase.from('contacts').delete().eq('user_id', _userId!);
    await supabase.from('app_settings').delete().eq('user_id', _userId!);

    // Insert contacts and build ID map
    const idMap = new Map<number, number>();
    if (data.contacts) {
      for (const c of data.contacts) {
        const oldId = c.id;
        const { data: row } = await supabase.from('contacts').insert({
          user_id: _userId, name: c.name, phone: c.phone || '', address: c.address || '', type: c.type, created_at: c.createdAt || new Date().toISOString(),
        }).select('id').single();
        if (row) idMap.set(oldId, row.id);
      }
    }

    if (data.ledgerEntries) {
      for (const e of data.ledgerEntries) {
        const newContactId = idMap.get(e.contactId) || e.contactId;
        await supabase.from('ledger_entries').insert({
          user_id: _userId, contact_id: newContactId, date: e.date, ref_no: e.refNo || '', description: e.description || '', debit: e.debit, credit: e.credit, mode: e.mode, note: e.note, created_at: e.createdAt || new Date().toISOString(),
        });
      }
    }

    if (data.invoices) {
      for (const inv of data.invoices) {
        const newCustomerId = idMap.get(inv.customerId) || inv.customerId;
        await supabase.from('invoices').insert({
          user_id: _userId, invoice_no: inv.invoiceNo, customer_id: newCustomerId, date: inv.date, due_date: inv.dueDate, items: inv.items, subtotal: inv.subtotal, previous_due: inv.previousDue, gst_enabled: inv.gstEnabled, gst_percent: inv.gstPercent, gst_amount: inv.gstAmount, round_off: inv.roundOff, total: inv.total, paid_amount: inv.paidAmount, created_at: inv.createdAt || new Date().toISOString(),
        });
      }
    }

    if (data.settings) {
      for (const s of data.settings) {
        await supabase.from('app_settings').upsert({
          user_id: _userId, business_name: s.businessName, owner_name: s.ownerName, phone: s.phone, address: s.address, gst_number: s.gstNumber, invoice_prefix: s.invoicePrefix, default_gst_percent: s.defaultGstPercent, dark_mode: s.darkMode, language: s.language, logo: s.logo,
        }, { onConflict: 'user_id' });
      }
    }
  } else {
    await db.contacts.clear();
    await db.ledgerEntries.clear();
    await db.invoices.clear();
    await db.settings.clear();
    if (data.contacts) await db.contacts.bulkAdd(data.contacts);
    if (data.ledgerEntries) await db.ledgerEntries.bulkAdd(data.ledgerEntries);
    if (data.invoices) await db.invoices.bulkAdd(data.invoices);
    if (data.settings) await db.settings.bulkAdd(data.settings);
  }
}

// ── Sync local data to Supabase (one-time migration) ──

export async function syncLocalToSupabase(): Promise<number> {
  if (!isOnline()) return 0;
  const localContacts = await db.contacts.toArray();
  if (localContacts.length === 0) return 0;

  const localEntries = await db.ledgerEntries.toArray();
  const localInvoices = await db.invoices.toArray();

  const idMap = new Map<number, number>();

  for (const c of localContacts) {
    const oldId = c.id!;
    const { data: row } = await supabase.from('contacts').insert({
      user_id: _userId, name: c.name, phone: c.phone, address: c.address || '', type: c.type, created_at: c.createdAt,
    }).select('id').single();
    if (row) idMap.set(oldId, row.id);
  }

  for (const e of localEntries) {
    const newContactId = idMap.get(e.contactId) || e.contactId;
    await supabase.from('ledger_entries').insert({
      user_id: _userId, contact_id: newContactId, date: e.date, ref_no: e.refNo, description: e.description, debit: e.debit, credit: e.credit, mode: e.mode, note: e.note, created_at: e.createdAt,
    });
  }

  for (const inv of localInvoices) {
    const newCustomerId = idMap.get(inv.customerId) || inv.customerId;
    await supabase.from('invoices').insert({
      user_id: _userId, invoice_no: inv.invoiceNo, customer_id: newCustomerId, date: inv.date, due_date: inv.dueDate, items: inv.items, subtotal: inv.subtotal, previous_due: inv.previousDue, gst_enabled: inv.gstEnabled, gst_percent: inv.gstPercent, gst_amount: inv.gstAmount, round_off: inv.roundOff, total: inv.total, paid_amount: inv.paidAmount, created_at: inv.createdAt,
    });
  }

  // Clear local after successful sync
  await db.ledgerEntries.clear();
  await db.invoices.clear();
  await db.contacts.clear();

  return localContacts.length;
}
