import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const realtimeConfig = { transport: ws as any };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { realtime: realtimeConfig });
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { realtime: realtimeConfig });
