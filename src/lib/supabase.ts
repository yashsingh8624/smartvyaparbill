import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kwkkgbhdzdtnbucdufpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3a2tnYmhkemR0bmJ1Y2R1ZnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NjQ4MDEsImV4cCI6MjA4ODQ0MDgwMX0.ALwZ9tuKAqRsXE6mURPI_9LHamemIp13Itcxzto5iKo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
