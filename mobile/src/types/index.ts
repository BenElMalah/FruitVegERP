export interface Profile {
  id: string;
  name: string;
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
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  due_date?: string;
  notes?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  client_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check';
  notes?: string;
  proof_image_url?: string;
  signature_url?: string;
  created_at: string;
}

export interface CaisseBalance {
  name: string;
  category: string;
  out: number;
  returned: number;
  lost: number;
  damaged: number;
  current_balance: number;
}
