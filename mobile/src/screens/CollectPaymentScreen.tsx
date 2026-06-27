import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { api } from '../services/api';
import { offlineStorage } from '../services/offline';

interface Props {
  route: {
    params: {
      invoiceId: string;
      clientId: string;
      total: number;
      remaining: number;
      invoiceNumber: string;
    };
  };
  navigation: any;
}

export default function CollectPaymentScreen({ route, navigation }: Props) {
  const { invoiceId, clientId, total, remaining, invoiceNumber } = route.params;

  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'check'>('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const submitPayment = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (numAmount > remaining) {
      Alert.alert('Error', 'Amount exceeds remaining balance');
      return;
    }

    setLoading(true);
    try {
      await api.payments.create({
        invoice_id: invoiceId,
        client_id: clientId,
        amount: numAmount,
        payment_method: method,
        notes,
      });
      Alert.alert('Success', `$${numAmount.toFixed(2)} collected`, [
        { text: 'View Receipt', onPress: () => navigation.replace('Receipt', {
          amount: numAmount, method, invoiceNumber, clientId,
        })},
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      // Save offline
      await offlineStorage.savePayment({
        invoice_id: invoiceId,
        client_id: clientId,
        amount: numAmount,
        payment_method: method,
        notes,
      });
      setOfflineMode(true);
      Alert.alert('Saved Offline', 'Payment saved locally. Will sync when online.');
    } finally {
      setLoading(false);
    }
  };

  const methods = [
    { key: 'cash', label: 'Cash', icon: '💵' },
    { key: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
    { key: 'check', label: 'Check', icon: '📝' },
  ] as const;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collect Payment</Text>
        <Text style={styles.headerSub}>Invoice #{invoiceNumber}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>${total.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text style={[styles.summaryValue, { color: '#dc3545' }]}>
            ${remaining.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Amount to Collect</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.methodRow}>
          {methods.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.methodCard,
                method === m.key && styles.methodCardActive,
              ]}
              onPress={() => setMethod(m.key)}
            >
              <Text style={styles.methodIcon}>{m.icon}</Text>
              <Text style={[
                styles.methodLabel,
                method === m.key && { color: '#198754', fontWeight: '600' },
              ]}>{m.label.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          multiline
          numberOfLines={3}
          placeholder="Optional notes..."
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      {offlineMode && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📶 Payment saved offline</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, loading && { opacity: 0.7 }]}
        onPress={submitPayment}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {offlineMode ? 'Save Offline' : `Collect $${parseFloat(amount || '0').toFixed(2)}`}
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#198754' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 14, color: '#d4edda', marginTop: 4 },
  summaryCard: {
    backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-around',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  summaryRow: { alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#333' },
  section: { margin: 12, marginBottom: 0 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  dollarSign: { fontSize: 24, fontWeight: '700', color: '#333', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', paddingVertical: 14 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14,
    alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0',
  },
  methodCardActive: { borderColor: '#198754', backgroundColor: '#f0fff4' },
  methodIcon: { fontSize: 24, marginBottom: 6 },
  methodLabel: { fontSize: 11, color: '#666' },
  notesInput: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e0e0e0', fontSize: 14,
    minHeight: 80, textAlignVertical: 'top',
  },
  offlineBanner: {
    backgroundColor: '#fff3cd', margin: 12, borderRadius: 8, padding: 12,
    alignItems: 'center',
  },
  offlineText: { color: '#856404', fontWeight: '500' },
  submitButton: {
    backgroundColor: '#198754', margin: 12, borderRadius: 12, padding: 18,
    alignItems: 'center', marginTop: 20,
  },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
