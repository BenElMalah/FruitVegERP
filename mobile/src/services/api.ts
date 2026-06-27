import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.100:3001/api';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },
  clients: {
    list: () => request<any[]>('/clients'),
    get: (id: string) => request<any>(`/clients/${id}`),
    invoices: (id: string) => request<any[]>(`/clients/${id}/invoices`),
    payments: (id: string) => request<any[]>(`/clients/${id}/payments`),
    caisseBalance: (id: string) => request<any[]>(`/clients/${id}/caisse-balance`),
  },
  payments: {
    create: (data: any) =>
      request<any>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  },
  invoices: {
    getPdfUrl: (id: string) => `${API_URL}/invoices/${id}/pdf`,
  },
};
