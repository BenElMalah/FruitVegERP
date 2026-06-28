export interface Profile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: 'boss' | 'manager' | 'collector' | 'warehouse';
  status: 'active' | 'inactive';
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  credit_limit: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  unit: 'kg' | 'box' | 'piece' | 'crate' | 'bag' | 'ton';
  price: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  clients?: Client;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  due_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  invoice_items?: InvoiceItem[];
  payments?: Payment[];
  grouped_from?: { invoice_id: string; invoice_number: string; remaining_amount: number }[] | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  products?: Product;
  quantity: number;
  price: number;
  subtotal: number;
  total_weight?: number;
  net_weight?: number;
  caisses?: { caisse_type_id: string; caisse_count: number }[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  invoices?: { invoice_number: string };
  client_id: string;
  clients?: { name: string };
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check' | 'lcn';
  lcn_date?: string;
  notes?: string;
  proof_image_url?: string;
  signature_url?: string;
  received_by?: string;
  created_at: string;
}

export interface CaisseType {
  id: string;
  name: string;
  category: 'branded' | 'foreign' | 'rented' | 'client';
  value: number;
  tare: number;
  qr_code?: string;
}

export interface CaisseMovement {
  id: string;
  client_id: string;
  clients?: { name: string };
  caisse_type_id: string;
  caisse_types?: { name: string; category: string };
  quantity: number;
  movement_type: 'out' | 'return' | 'lost' | 'damaged';
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface StockItem {
  id: string;
  product_id: string;
  products?: { name: string; unit: string };
  quantity: number;
  product_name?: string;
  unit?: string;
  warehouse_id?: string;
  warehouses?: { name: string };
  truck_id?: string;
  trucks?: { supplier_name: string; default_price: number; created_at: string; products?: { name: string } };
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  created_at: string;
}

export interface DashboardSummary {
  today_sales: number;
  total_unpaid: number;
  today_collected: number;
  overdue_count: number;
  overdue_clients: { name: string; amount: number; total: number }[];
  recent_activities: { user: string; action: string; description: string; created_at: string }[];
  stock: { id: string; product_name: string; unit: string; quantity: number; truck_supplier: string | null }[];
}
