import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_PAYMENTS_KEY = 'offline_payments';

export interface OfflinePayment {
  id: string;
  client_id: string;
  invoice_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check';
  notes?: string;
  signature_data?: string;
  created_at: string;
  synced: boolean;
}

export const offlineStorage = {
  async savePayment(payment: Omit<OfflinePayment, 'id' | 'synced' | 'created_at'>) {
    const existing = await this.getPendingPayments();
    const newPayment: OfflinePayment = {
      ...payment,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      synced: false,
    };
    existing.push(newPayment);
    await AsyncStorage.setItem(OFFLINE_PAYMENTS_KEY, JSON.stringify(existing));
    return newPayment;
  },

  async getPendingPayments(): Promise<OfflinePayment[]> {
    const raw = await AsyncStorage.getItem(OFFLINE_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async markSynced(id: string) {
    const payments = await this.getPendingPayments();
    const updated = payments.map(p => p.id === id ? { ...p, synced: true } : p);
    await AsyncStorage.setItem(OFFLINE_PAYMENTS_KEY, JSON.stringify(updated));
  },

  async clearSynced() {
    const payments = await this.getPendingPayments();
    const unsynced = payments.filter(p => !p.synced);
    await AsyncStorage.setItem(OFFLINE_PAYMENTS_KEY, JSON.stringify(unsynced));
  },

  async syncPendingPayments(syncFn: (payment: OfflinePayment) => Promise<void>) {
    const payments = await this.getPendingPayments();
    for (const p of payments.filter(p => !p.synced)) {
      try {
        await syncFn(p);
        await this.markSynced(p.id);
      } catch (e) {
        console.warn('Sync failed for payment', p.id, e);
      }
    }
    await this.clearSynced();
  },
};
