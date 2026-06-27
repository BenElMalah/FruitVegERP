import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Platform,
} from 'react-native';

interface Props {
  route: {
    params: {
      amount: number;
      method: string;
      invoiceNumber: string;
      clientId: string;
    };
  };
  navigation: any;
}

export default function ReceiptScreen({ route, navigation }: Props) {
  const { amount, method, invoiceNumber } = route.params;
  const receiptRef = useRef<View>(null);

  const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const shareViaWhatsApp = async () => {
    const message = `🧾 *Payment Receipt*
━━━━━━━━━━━━━━━━
Receipt: ${receiptNumber}
Invoice: #${invoiceNumber}
Amount: $${amount.toFixed(2)}
Method: ${method.replace('_', ' ')}
Date: ${date}
━━━━━━━━━━━━━━━━
Thank you for your payment!`;

    try {
      await Share.share({
        message,
        title: `Payment Receipt ${receiptNumber}`,
      });
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.receipt} ref={receiptRef}>
        <Text style={styles.title}>🧾 PAYMENT RECEIPT</Text>
        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Receipt #</Text>
          <Text style={styles.value}>{receiptNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Invoice</Text>
          <Text style={styles.value}>#{invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{date}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.amount}>${amount.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Method</Text>
          <Text style={styles.value}>{method.replace('_', ' ')}</Text>
        </View>

        <View style={styles.divider} />
        <Text style={styles.thankYou}>Thank you!</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.whatsappButton} onPress={shareViaWhatsApp}>
          <Text style={styles.buttonIcon}>📤</Text>
          <Text style={styles.buttonText}>Share via WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  receipt: {
    backgroundColor: '#fff', margin: 16, marginTop: 60,
    borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#198754', textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 12, alignItems: 'center',
  },
  label: { fontSize: 14, color: '#999' },
  value: { fontSize: 15, fontWeight: '500', color: '#333' },
  amount: { fontSize: 24, fontWeight: '700', color: '#198754' },
  thankYou: { textAlign: 'center', fontSize: 16, color: '#666', fontStyle: 'italic' },
  actions: { padding: 16, gap: 12 },
  whatsappButton: {
    backgroundColor: '#25D366', borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  buttonIcon: { fontSize: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  doneButton: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  doneText: { color: '#333', fontSize: 16, fontWeight: '500' },
});
