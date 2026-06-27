import { useEffect } from 'react';
import { supabase } from '../services/supabase';

type RealtimeCallback = () => void;

const CHANGES: { table: string; event?: string }[] = [
  { table: 'invoices' },
  { table: 'payments' },
  { table: 'stock' },
  { table: 'activities' },
  { table: 'notifications' },
  { table: 'daily_arrivals' },
  { table: 'caisse_movements' },
];

export function useRealtime(callback: RealtimeCallback, enabled = true) {
  useEffect(() => {
    if (!supabase || !enabled) return;

    const client = supabase!;
    const channels = CHANGES.map(({ table }) =>
      client
        .channel(`realtime:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          callback();
        })
        .subscribe()
    );

    return () => {
      channels.forEach(ch => client.removeChannel(ch));
    };
  }, [callback, enabled]);
}
