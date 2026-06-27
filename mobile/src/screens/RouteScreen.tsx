import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { api } from '../services/api';
import { Client } from '../types';

interface Props {
  navigation: any;
}

export default function RouteScreen({ navigation }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    loadClients();
    checkSync();
  }, []);

  useEffect(() => {
    if (search) {
      setFiltered(
        clients.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search)
        )
      );
    } else {
      setFiltered(clients);
    }
  }, [search, clients]);

  const loadClients = async () => {
    try {
      const data = await api.clients.list();
      setClients(data);
    } catch (err) {
      console.warn('Failed to load clients', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkSync = async () => {
    const { offlineStorage } = await import('../services/offline');
    const pending = await offlineStorage.getPendingPayments();
    setSyncCount(pending.filter(p => !p.synced).length);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClients();
    checkSync();
  }, []);

  const getBalanceColor = (total: number, paid: number) => {
    if (paid >= total) return '#198754';
    if (paid > 0) return '#ffc107';
    return '#dc3545';
  };

  const renderClient = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ClientProfile', { clientId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.clientName}>{item.name}</Text>
          <Text style={styles.clientPhone}>{item.phone || 'No phone'}</Text>
        </View>
        <Text style={styles.creditLimit}>${item.credit_limit.toFixed(0)}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.notes} numberOfLines={1}>
          {item.notes || 'No notes'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#198754" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Route</Text>
          <Text style={styles.headerSub}>{clients.length} clients</Text>
        </View>
        {syncCount > 0 && (
          <TouchableOpacity
            style={styles.syncBadge}
            onPress={async () => {
              const { offlineStorage } = await import('../services/offline');
              await offlineStorage.syncPendingPayments(async (p) => {
                await api.payments.create({
                  invoice_id: p.invoice_id,
                  client_id: p.client_id,
                  amount: p.amount,
                  payment_method: p.payment_method,
                  notes: p.notes,
                });
              });
              setSyncCount(0);
            }}
          >
            <Text style={styles.syncText}>{syncCount} pending</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search clients..."
        placeholderTextColor="#999"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderClient}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#198754']} />
        }
        contentContainerStyle={filtered.length === 0 ? { flex: 1, justifyContent: 'center' } : undefined}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {search ? 'No clients match your search' : 'No clients assigned'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 60, backgroundColor: '#198754',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 14, color: '#d4edda', marginTop: 2 },
  syncBadge: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  syncText: { color: '#198754', fontWeight: '600', fontSize: 13 },
  search: {
    backgroundColor: '#fff', margin: 12, borderRadius: 10, padding: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12, marginBottom: 8,
    padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#d4edda',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#198754' },
  clientName: { fontSize: 16, fontWeight: '600', color: '#333' },
  clientPhone: { fontSize: 13, color: '#999', marginTop: 2 },
  creditLimit: { fontSize: 14, fontWeight: '600', color: '#198754' },
  cardFooter: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 6 },
  notes: { fontSize: 12, color: '#999' },
  empty: { textAlign: 'center', color: '#999', padding: 40 },
});
