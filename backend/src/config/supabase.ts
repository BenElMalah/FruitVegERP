import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing env vars:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_ANON_KEY: !!supabaseAnonKey,
    SUPABASE_SERVICE_KEY: !!supabaseServiceKey,
  });
  process.exit(1);
}

let realtimeOptions: any = {};
try {
  const ws = require('ws');
  realtimeOptions = { transport: ws };
} catch {}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, realtimeOptions);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, realtimeOptions);
