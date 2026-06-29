const API_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    const err = await res.json().catch(() => ({ error: 'Session expired. Please login again.' }));
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error(err.error || 'Session expired. Please login again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; refreshToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<any>('/auth/me'),
    users: () => request<any[]>('/auth/users'),
    createUser: (data: { username: string; password: string; name: string; phone?: string; role: string }) =>
      request<any>('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, data: any) =>
      request<any>(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id: string) =>
      request<void>(`/auth/users/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: () => request<any[]>('/clients'),
    get: (id: string) => request<any>(`/clients/${id}`),
    create: (data: any) =>
      request<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/clients/${id}`, { method: 'DELETE' }),
    invoices: (id: string) => request<any[]>(`/clients/${id}/invoices`),
    payments: (id: string) => request<any[]>(`/clients/${id}/payments`),
    caisseBalance: (id: string) => request<any[]>(`/clients/${id}/caisse-balance`),
    duplicates: () => request<any[]>('/clients/duplicates'),
    merge: () => request<{ merged_count: number }>('/clients/merge', { method: 'POST' }),
  },
  products: {
    list: (date?: string) => request<any[]>(`/products${date ? `?date=${date}` : ''}`),
    get: (id: string) => request<any>(`/products/${id}`),
    create: (data: any) =>
      request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/products/${id}`, { method: 'DELETE' }),
    clients: (id: string) =>
      request<any[]>(`/products/${id}/clients`),
    backfillFromTrucks: () =>
      request<{ created: number; total_missing: number }>('/products/backfill-from-trucks', { method: 'POST' }),
  },
  invoices: {
    list: () => request<any[]>('/invoices'),
    get: (id: string) => request<any>(`/invoices/${id}`),
    create: (data: any) =>
      request<any>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
    group: (data: { invoice_ids: string[]; payment_amount?: number; payment_method?: string; notes?: string; lcn_date?: string }) =>
      request<any>('/invoices/group', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request<any>(`/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    pdf: (id: string) => `${API_URL}/invoices/${id}/pdf`,
  },
  payments: {
    list: () => request<any[]>('/payments'),
    create: (data: any) =>
      request<any>('/payments', { method: 'POST', body: JSON.stringify(data) }),
    today: () => request<any[]>('/payments/today'),
    byClient: (clientId: string) => request<any[]>(`/payments/client/${clientId}`),
  },
  caisse: {
    types: () => request<any[]>('/caisse/types'),
    createType: (data: any) =>
      request<any>('/caisse/types', { method: 'POST', body: JSON.stringify(data) }),
    updateType: (id: string, data: any) =>
      request<any>(`/caisse/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteType: (id: string) =>
      request<void>(`/caisse/types/${id}`, { method: 'DELETE' }),
    movements: () => request<any[]>('/caisse/movements'),
    createMovement: (data: any) =>
      request<any>('/caisse/movements', { method: 'POST', body: JSON.stringify(data) }),
    updateMovement: (id: string, data: any) =>
      request<any>(`/caisse/movements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    balance: (clientId: string) => request<any[]>(`/caisse/balance/${clientId}`),
    missing: () => request<any[]>('/caisse/missing'),
  },
  dashboard: {
    summary: () => request<any>('/dashboard/summary'),
    sales: (days?: number) => request<any>(`/dashboard/sales?days=${days || 30}`),
    stats: (days?: number) => request<any>(`/dashboard/stats?days=${days || 30}`),
  },
  trucks: {
    list: () => request<any[]>('/trucks'),
    create: (data: any) =>
      request<any>('/trucks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/trucks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/trucks/${id}`, { method: 'DELETE' }),
  },
  arrivals: {
    list: (date?: string, truckId?: string) => {
      let path = `/arrivals${date ? `?date=${date}` : ''}`;
      if (truckId) path += `${date ? '&' : '?'}truck_id=${truckId}`;
      return request<any[]>(path);
    },
    create: (data: any) =>
      request<any>('/arrivals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/arrivals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/arrivals/${id}`, { method: 'DELETE' }),
  },
  stock: {
    list: (warehouse_id?: string) => request<any[]>(`/stock${warehouse_id ? `?warehouse_id=${warehouse_id}` : ''}`),
    adjust: (data: { product_id: string; quantity: number; warehouse_id?: string; truck_id?: string; adjustment_date?: string }) =>
      request<any>('/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, quantity: number, truck_id?: string) =>
      request<any>(`/stock/${id}`, { method: 'PUT', body: JSON.stringify({ quantity, truck_id }) }),
    movements: (date?: string, product_id?: string) => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (product_id) params.set('product_id', product_id);
      const qs = params.toString();
      return request<any[]>(`/stock/movements${qs ? `?${qs}` : ''}`);
    },
  },
  warehouses: {
    list: () => request<any[]>('/warehouses'),
    create: (data: { name: string; location?: string }) =>
      request<any>('/warehouses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; location?: string }) =>
      request<any>(`/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/warehouses/${id}`, { method: 'DELETE' }),
  },
  alerts: {
    list: () => request<any[]>('/alerts'),
    unreadCount: () => request<{ count: number }>('/alerts/unread-count'),
    markRead: (id: string) =>
      request<any>(`/alerts/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ success: boolean }>('/alerts/mark-all-read', { method: 'POST' }),
  },
  notifications: {
    list: (unreadOnly?: boolean) => request<any[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) =>
      request<any>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () =>
      request<{ success: boolean }>('/notifications/read-all', { method: 'PUT' }),
    delete: (id: string) =>
      request<void>(`/notifications/${id}`, { method: 'DELETE' }),
  },
  truckExpenses: {
    list: (truckId?: string, date?: string) => {
      let path = '/truck-expenses';
      const params: string[] = [];
      if (truckId) params.push(`truck_id=${truckId}`);
      if (date) params.push(`date=${date}`);
      if (params.length) path += '?' + params.join('&');
      return request<any[]>(path);
    },
    create: (data: { truck_id: string; arrival_date: string; label: string; amount: number }) =>
      request<any>('/truck-expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { label: string; amount: number }) =>
      request<any>(`/truck-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/truck-expenses/${id}`, { method: 'DELETE' }),
  },
};
