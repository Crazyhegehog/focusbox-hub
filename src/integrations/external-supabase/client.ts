import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://lflarjtzaqgaoriioaby.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbGFyanR6YXFnYW9yaWlvYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDQ3NzYsImV4cCI6MjA4NDU4MDc3Nn0.vMFz5wNmX-gny-So1UibbOHgk2W0INmbN8ErIvhx0GY';

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
