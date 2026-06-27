import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { api } from '../services/api';
import { Invoice, CaisseBalance } from '../types';

interface Props {
  route: { params: { clientId: string } };
  navigation: any;
}

export default function ClientProfileScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [caisseBalance, setCaisseBalance] = useState<CaisseBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      const [c, invs, cb] = await Promise.all([
        api.clients.get(clientId),
        api.clients.invoices(clientId),
        api.clients.caisseBalance(clientId),
      ]);
      setClient(c);
      setInvoices(invs);
      setCaisseBalance(cb);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = invoices.reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);
  const totalCaisse = caisseBalance.reduce((sum, c) => sum + c.current_balance, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#198754" />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.centered}>
        <Text>Client not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{client.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{client.name}</Text>
        <Text style={styles.phone}>{client.phone || 'No phone'}</Text>
      </View>

      <View style={styles.balanceRow}>
        <View style={[styles.balanceCard, { backgroundColor: '#fff3cd' }]}>
          <Text style={styles.balanceLabel}>Outstanding</Text>
          <Text style={[styles.balanceValue, { color: '#856404' }]}>
            ${totalBalance.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: '#d4edda' }]}>
          <Text style={styles.balanceLabel}>Caisses Out</Text>
          <Text style={[styles.balanceValue, { color: '#155724' }]}>
            {totalCaisse}
          </Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: '#cce5ff' }]}>
          <Text style={styles.balanceLabel}>Limit</Text>
          <Text style={[styles.balanceValue, { color: '#004085' }]}>
            ${Number(client.credit_limit).toFixed(0)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Unpaid Invoices</Text>
        {invoices
          .filter(inv => inv.status !== 'paid')
          .map(inv => (
            <TouchableOpacity
              key={inv.id}
              style={styles.invoiceCard}
              onPress={() => navigation.navigate('CollectPayment', {
                invoiceId: inv.id,
                clientId: client.id,
                total: inv.total,
                remaining: inv.remaining_amount,
                invoiceNumber: inv.invoice_number,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceNumber}>#{inv.invoice_number}</Text>
                <Text style={styles.invoiceDate}>
                  {new Date(inv.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.invoiceTotal}>${inv.total.toFixed(2)}</Text>
                <Text style={styles.invoiceRemaining}>
                  ${inv.remaining_amount.toFixed(2)} remaining
                </Text>
              </View>
              <View style={[styles.statusDot, {
                backgroundColor: inv.status === 'unpaid' ? '#dc3545' : '#ffc107'
              }]} />
            </TouchableOpacity>
          ))}
        {invoices.filter(inv => inv.status !== 'paid').length === 0 && (
          <Text style={styles.empty}>All invoices paid</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Caisse Balance</Text>
        {caisseBalance.map((cb, i) => (
          <View key={i} style={styles.caisseRow}>
            <View>
              <Text style={styles.caisseName}>{cb.name}</Text>
              <Text style={styles.caisseCategory}>{cb.category}</Text>
            </View>
            <Text style={[
              styles.caisseQty,
              { color: cb.current_balance > 0 ? '#dc3545' : '#198754' }
            ]}>
              {cb.current_balance > 0 ? `-${cb.current_balance}` : '0'}
            </Text>
          </View>
        ))}
        {caisseBalance.length === 0 && (
          <Text style={styles.empty}>No caisse movements</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.collectButton}
        onPress={() => {
          const unpaid = invoices.find(inv => inv.status !== 'paid');
          if (unpaid) {
            navigation.navigate('CollectPayment', {
              invoiceId: unpaid.id,
              clientId: client.id,
              total: unpaid.total,
              remaining: unpaid.remaining_amount,
              invoiceNumber: unpaid.invoice_number,
            });
          }
        }}
      >
        <Text style={styles.collectButtonText}>
          Collect Payment
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profile: {
    alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#198754',
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#198754' },
  name: { fontSize: 22, fontWeight: '700', color: '#fff' },
  phone: { fontSize: 14, color: '#d4edda', marginTop: 4 },
  balanceRow: {
    flexDirection: 'row', marginHorizontal: 12, marginTop: -20,
  },
  balanceCard: {
    flex: 1, borderRadius: 10, padding: 12, marginHorizontal: 4,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  balanceValue: { fontSize: 18, fontWeight: '700' },
  section: { margin: 12, marginBottom: 0 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8,
  },
  invoiceCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  invoiceNumber: { fontSize: 15, fontWeight: '600', color: '#333' },
  invoiceDate: { fontSize: 12, color: '#999', marginTop: 2 },
  invoiceTotal: { fontSize: 16, fontWeight: '700', color: '#333' },
  invoiceRemaining: { fontSize: 12, color: '#dc3545', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
  empty: { color: '#999', textAlign: 'center', padding: 20 },
  caisseRow: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  caisseName: { fontSize: 14, fontWeight: '500', color: '#333' },
  caisseCategory: { fontSize: 11, color: '#999', marginTop: 2 },
  caisseQty: { fontSize: 18, fontWeight: '700' },
  collectButton: {
    backgroundColor: '#198754', margin: 12, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  collectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
