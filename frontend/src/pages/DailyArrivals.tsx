import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const STATUSES = ['en demand', 'delivred', 'cancelled'] as const;
type EntryStatus = (typeof STATUSES)[number];

interface CaisseItem {
  id: string;
  caisseTypeId: string;
  type: string;
  tare: number;
  qty: number;
}

interface RowData {
  id: string;
  clientId: string;
  clientName: string;
  searchText: string;
  product: string;
  price: number;
  caisseItems: CaisseItem[];
  weight: number;
  status: EntryStatus;
  saved: boolean;
}

let caisseTypesCache: any[] = [];

let _rowCounter = 0;
function newRowId() { return `tmp_${++_rowCounter}`; }

function totalCaisses(items: CaisseItem[]) {
  return items.reduce((s, c) => s + (c.qty || 0), 0);
}
function totalTare(items: CaisseItem[]) {
  return items.reduce((s, c) => s + ((c.qty || 0) * (c.tare || 0)), 0);
}
function netWeight(weight: number, items: CaisseItem[]) {
  return Math.max((weight || 0) - totalTare(items), 0);
}
function dueAmount(weight: number, items: CaisseItem[], price: number) {
  return netWeight(weight, items) * (price || 0);
}

function createEmptyRow(product: string): RowData {
  const firstType = caisseTypesCache[0];
  return {
    id: newRowId(), clientId: '', clientName: '', searchText: '',
    product, price: 0,
    caisseItems: firstType ? [{ id: newRowId(), caisseTypeId: firstType.id, type: firstType.name, tare: Number(firstType.tare) || 0, qty: 1 }] : [],
    weight: 0,
    status: 'en demand', saved: false,
  };
}

const STATUS_STYLES: Record<EntryStatus, { dot: string; bg: string; text: string; label: string }> = {
  'en demand': { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', label: 'En demande' },
  'delivred':  { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Livré' },
  'cancelled': { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', label: 'Annulé' },
};

interface SavedEntry extends RowData {
  savedAt: number;
  truckId: string;
  truckSupplier: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function DailyArrivals() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<any[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [activeTruckId, setActiveTruckId] = useState<string>('');
  const [rows, setRows] = useState<Record<string, RowData[]>>({});
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [savedByDate, setSavedByDate] = useState<Record<string, SavedEntry[]>>({});
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerName, setDrawerName] = useState('');
  const [drawerPhone, setDrawerPhone] = useState('');
  const [drawerRegion, setDrawerRegion] = useState('');
  const [drawerRowId, setDrawerRowId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [overviewTab, setOverviewTab] = useState<'orders' | 'expenses' | 'stock'>('orders');
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<{ id: string; label: string; amount: number }[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [showClientDropdown, setShowClientDropdown] = useState<string | null>(null);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);
  const [pendingDelivery, setPendingDelivery] = useState<{ entry: SavedEntry; NW: number; due: number } | null>(null);

  const rowRefs = useRef<Record<string, (HTMLInputElement | HTMLSelectElement | null)[]>>({});

  useEffect(() => {
    Promise.all([
      api.trucks.list(),
      api.clients.list(),
      api.products.list(),
      api.caisse.types(),
    ]).then(([t, c, p, ct]) => {
      setTrucks(t);
      setClients(c);
      setProducts(p);
      setCaisseTypes(ct);
      caisseTypesCache = ct;
      if (t.length > 0) {
        setActiveTruckId(t[0].id);
        const initial: Record<string, RowData[]> = {};
        t.forEach((tr: any) => {
          initial[tr.id] = [createEmptyRow(tr.products?.name || tr.product_id)];
        });
        setRows(initial);
      }
      setLoadingTrucks(false);
    }).catch(() => setLoadingTrucks(false));
  }, []);

  useEffect(() => {
    if (!selectedDate || !activeTruckId) return;
    api.arrivals.list(selectedDate, activeTruckId).then((entries) => {
      const mapped: SavedEntry[] = entries.map((e: any) => ({
        id: e.id,
        clientId: e.client_id || '',
        clientName: e.clients?.name || '',
        searchText: e.clients?.name || '',
        product: e.products?.name || '',
        price: Number(e.price) || 0,
        caisseItems: e.caisse_details?.length ? e.caisse_details.map((ci: any) => {
          const matchType = caisseTypesCache.find((ct: any) => ct.name === ci.type || ct.id === ci.caisseTypeId);
          return { id: ci.id || newRowId(), caisseTypeId: ci.caisseTypeId || matchType?.id || '', type: ci.type || matchType?.name || '', tare: Number(ci.tare) || Number(matchType?.tare) || 0, qty: ci.qty || 0 };
        }) : (e.caisse_type_id ? [{ id: newRowId(), caisseTypeId: e.caisse_type_id, type: e.caisse_types?.name || '', tare: Number(e.caisse_types?.tare) || 0, qty: e.quantity || 0 }] : []),
        weight: Number(e.weight) || 0,
        status: e.status || 'en demand',
        saved: true,
        savedAt: new Date(e.created_at).getTime(),
        truckId: e.truck_id || '',
        truckSupplier: e.trucks?.supplier_name || '',
      }));
      setSavedByDate(prev => ({ ...prev, [selectedDate]: mapped }));
      setRows(prev => {
        const truckRows = prev[activeTruckId] || [];
        const updated = truckRows.map(r => {
          const match = mapped.find(m => m.id === r.id);
          if (match) return { ...r, ...match, saved: true };
          return r;
        });
        const existingIds = new Set(truckRows.map(r => r.id));
        const newRows = mapped.filter(m => !existingIds.has(m.id)).map(m => {
          const base = createEmptyRow(m.product);
          return { ...base, ...m, id: m.id };
        });
        return { ...prev, [activeTruckId]: [...updated, ...newRows] };
      });
    }).catch(() => {});
  }, [selectedDate, activeTruckId]);

  useEffect(() => {
    if (overviewTab !== 'stock') return;
    api.stock.list().then(setStockItems).catch(() => {});
  }, [overviewTab, activeTruckId]);

  useEffect(() => {
    if (!activeTruckId || !selectedDate) return;
    api.truckExpenses.list(activeTruckId, selectedDate).then((data) => {
      setExpenses(data.map((e: any) => ({ id: e.id, label: e.label, amount: Number(e.amount) })));
    }).catch(() => {});
  }, [activeTruckId, selectedDate]);

  const activeRows = rows[activeTruckId] || [];
  const activeTruck = trucks.find(t => t.id === activeTruckId);
  const activeRowsActive = activeRows.filter(r => r.status !== 'cancelled');
  const allocated = activeRowsActive.reduce((s, r) => s + (r.weight || 0), 0);
  const truckCapacity = activeTruck ? Number(activeTruck.net_weight) : 0;
  const truckProductName = activeTruck?.products?.name || '';
  const truckTotalCaisses = activeRowsActive.reduce((s, r) => s + totalCaisses(r.caisseItems), 0);
  const truckCostPrice = Number(activeTruck?.cost_price) || 0;

  const showToastMsg = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  const truckProduct = products.find(p => p.name === (activeTruck?.products?.name || ''));
  const stockItem = truckProduct ? stockItems.find((s: any) => s.product_id === truckProduct.id) : null;
  const stockCurrentQty = stockItem ? Number(stockItem.quantity) : 0;

  const updateRow = (rowId: string, patch: Partial<RowData>) => {
    setRows(prev => ({
      ...prev,
      [activeTruckId]: (prev[activeTruckId] || []).map(r => r.id === rowId ? { ...r, ...patch, saved: false } : r),
    }));
  };

  const addRow = () => {
    const newRow = createEmptyRow(truckProductName);
    setRows(prev => ({
      ...prev,
      [activeTruckId]: [...(prev[activeTruckId] || []), newRow],
    }));
    setTimeout(() => {
      const inputs = rowRefs.current[newRow.id];
      if (inputs?.[0]) inputs[0].focus();
    }, 50);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => ({
      ...prev,
      [activeTruckId]: (prev[activeTruckId] || []).filter(r => r.id !== rowId),
    }));
  };

  const filteredClients = (searchText: string) =>
    searchText ? clients.filter((c: any) => c.name.toLowerCase().includes(searchText.toLowerCase())) : clients;

  const openQuickAdd = (rowId: string, name: string) => {
    setDrawerRowId(rowId);
    setDrawerName(name);
    setDrawerPhone('');
    setDrawerRegion('');
    setShowDrawer(true);
  };

  const saveQuickAdd = () => {
    if (!drawerName.trim()) return;
    const newClient = { id: `c${Date.now()}`, name: drawerName.trim(), phone: drawerPhone.trim(), address: drawerRegion.trim() };
    setClients(prev => [...prev, newClient]);
    if (drawerRowId) updateRow(drawerRowId, { clientId: newClient.id, clientName: newClient.name, searchText: newClient.name });
    setShowDrawer(false);
    setDrawerRowId(null);
    showToastMsg(`"${newClient.name}" added`, 'success');
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentRow = activeRows.find(r => r.id === rowId);
      if (currentRow && currentRow.clientId) addRow();
    }
  };

  const setInputRef = (rowId: string, fieldIndex: number) => (el: HTMLInputElement | HTMLSelectElement | null) => {
    if (!rowRefs.current[rowId]) rowRefs.current[rowId] = [];
    rowRefs.current[rowId][fieldIndex] = el;
  };

  const saveRow = async (row: RowData) => {
    if (!row.clientId) { showToastMsg('Select a client before saving', 'error'); return; }
    const truckProduct = products.find(p => p.name === row.product);
    try {
      const created = await api.arrivals.create({
        arrival_date: selectedDate,
        truck_id: activeTruckId,
        client_id: row.clientId,
        product_id: truckProduct?.id || '',
        quantity: totalCaisses(row.caisseItems),
        caisse_type_id: null,
        caisse_details: row.caisseItems.map(ci => ({ id: ci.id, caisseTypeId: ci.caisseTypeId, type: ci.type, tare: ci.tare, qty: ci.qty })),
        weight: row.weight || 0,
        price: row.price || 0,
        status: row.status,
      });
      const entry: SavedEntry = {
        ...row,
        id: created.id,
        savedAt: Date.now(),
        truckId: activeTruckId,
        truckSupplier: activeTruck?.supplier_name || '',
      };
      setSavedByDate(prev => ({ ...prev, [selectedDate]: [...(prev[selectedDate] || []), entry] }));
      setRows(prev => ({
        ...prev,
        [activeTruckId]: (prev[activeTruckId] || []).map(r => r.id === row.id ? { ...r, id: created.id, saved: true } : r),
      }));
      showToastMsg(`Entry saved for ${row.clientName}`, 'success');
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to save', 'error');
    }
  };

  const unsaveRow = async (rowId: string) => {
    if (rowId.startsWith('tmp_')) {
      setSavedByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).filter(e => e.id !== rowId) }));
      setRows(prev => ({ ...prev, [activeTruckId]: (prev[activeTruckId] || []).map(r => r.id === rowId ? { ...r, saved: false } : r) }));
      return;
    }
    try {
      await api.arrivals.delete(rowId);
      setSavedByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).filter(e => e.id !== rowId) }));
      setRows(prev => ({ ...prev, [activeTruckId]: (prev[activeTruckId] || []).map(r => r.id === rowId ? { ...r, saved: false } : r) }));
      showToastMsg('Entry removed', 'success');
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to delete', 'error');
    }
  };

  const deleteSavedEntry = async (entryId: string) => {
    try {
      await api.arrivals.delete(entryId);
      setSavedByDate(prev => ({ ...prev, [selectedDate]: (prev[selectedDate] || []).filter(e => e.id !== entryId) }));
      setRows(prev => ({ ...prev, [activeTruckId]: (prev[activeTruckId] || []).map(r => r.id === entryId ? { ...r, saved: false } : r) }));
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to delete', 'error');
    }
  };

  const updateSavedEntry = async (entryId: string, patch: Partial<SavedEntry>) => {
    if (patch.status !== undefined && patch.status === 'delivred') {
      const entry = savedForTruck.find(e => e.id === entryId);
      if (entry) {
        const w = Number(entry.weight) || 0;
        const p = Number(entry.price) || 0;
        if (w <= 0 || p <= 0) {
          showToastMsg('Cannot deliver: weight and price must be greater than 0', 'error');
          return;
        }
        const nw = netWeight(entry.weight, entry.caisseItems || []);
        const due = nw * (entry.price || 0);
        setPendingDelivery({ entry, NW: nw, due });
        setShowDeliverConfirm(true);
        return;
      }
    }
    setSavedByDate(prev => {
      const updated = (prev[selectedDate] || []).map(e => e.id === entryId ? { ...e, ...patch } : e);
      return { ...prev, [selectedDate]: updated };
    });
    setRows(prev => {
      const truckRows = prev[activeTruckId] || [];
      return { ...prev, [activeTruckId]: truckRows.map(r => r.id === entryId ? { ...r, ...patch } : r) };
    });
    try {
      const body: any = {};
      if (patch.caisseItems !== undefined) body.caisse_details = patch.caisseItems.map(ci => ({ id: ci.id, caisseTypeId: ci.caisseTypeId, type: ci.type, tare: ci.tare, qty: ci.qty }));
      if (patch.weight !== undefined) body.weight = patch.weight;
      if (patch.price !== undefined) body.price = patch.price;
      if (patch.status !== undefined) body.status = patch.status;
      if (Object.keys(body).length > 0) {
        await api.arrivals.update(entryId, body);
      }
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to update', 'error');
    }
  };

  const confirmDeliver = async () => {
    if (!pendingDelivery) return;
    const { entry } = pendingDelivery;
    setShowDeliverConfirm(false);
    setPendingDelivery(null);
    setSavedByDate(prev => {
      const updated = (prev[selectedDate] || []).map(e => e.id === entry.id ? { ...e, status: 'delivred' as EntryStatus } : e);
      return { ...prev, [selectedDate]: updated };
    });
    setRows(prev => {
      const truckRows = prev[activeTruckId] || [];
      return { ...prev, [activeTruckId]: truckRows.map(r => r.id === entry.id ? { ...r, status: 'delivred' as EntryStatus } : r) };
    });
    try {
      await api.arrivals.update(entry.id, { status: 'delivred' });
      showToastMsg(`Invoice created for ${entry.clientName} — delivery completed!`, 'success');
    } catch (err: any) {
      showToastMsg(err.message || 'Failed to deliver', 'error');
    }
  };

  const finalizeTruck = async () => {
    setFinalizing(true);
    await new Promise(r => setTimeout(r, 800));
    setFinalizing(false);
    showToastMsg(`Truck "${activeTruck?.supplier_name}" dispatched — ${savedForTruck.length} entries`, 'success');
  };

  const allocatedPct = truckCapacity > 0 ? (allocated / truckCapacity) * 100 : 0;

  const savedEntries = savedByDate[selectedDate] || [];
  const savedForTruck = savedEntries.filter(e => e.truckId === activeTruckId);
  const statusSummary = STATUSES.map(s => ({ status: s, count: savedForTruck.filter(e => e.status === s).length }));
  const totalSaved = savedForTruck.length;
  const nonCancelledCount = savedForTruck.filter(e => e.status !== 'cancelled').length;
  const totalNetWeight = savedForTruck.filter(e => e.status !== 'cancelled').reduce((s, e) => s + netWeight(e.weight, e.caisseItems || []), 0);
  const totalDue = savedForTruck.filter(e => e.status !== 'cancelled').reduce((s, e) => s + dueAmount(e.weight, e.caisseItems || [], e.price), 0);
  const supplierDue = totalNetWeight * truckCostPrice;
  const profit = totalDue - supplierDue;

  if (loadingTrucks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading trucks...</div>
      </div>
    );
  }

  if (trucks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🚛</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">No Trucks Yet</h2>
          <p className="text-slate-400 text-sm mb-4">Add trucks in the Trucks management page first.</p>
          <a href="/trucks" className="text-indigo-600 font-medium text-sm hover:underline">Go to Trucks →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {toast.show && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium backdrop-blur-sm ${
            toast.type === 'success' ? 'bg-emerald-500/90' : 'bg-red-500/90'
          }`}>
            <div className="flex items-center gap-2">
              <span>{toast.type === 'success' ? '✓' : '✕'}</span>
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {showDeliverConfirm && pendingDelivery && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="px-6 py-4 bg-emerald-500 text-white">
                <h3 className="text-lg font-bold">Confirm Delivery</h3>
                <p className="text-sm text-emerald-100">This will create an invoice and send alerts to collectors.</p>
              </div>
              <div className="px-6 py-5">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Client</span>
                    <span className="font-semibold text-slate-800">{pendingDelivery.entry.clientName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Product</span>
                    <span className="font-semibold text-slate-800">{pendingDelivery.entry.product}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Weight</span>
                    <span className="font-semibold text-slate-800">{pendingDelivery.entry.weight} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Net Weight</span>
                    <span className="font-semibold text-slate-800">{pendingDelivery.NW.toFixed(1)} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Price</span>
                    <span className="font-semibold text-slate-800">{pendingDelivery.entry.price} /kg</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="text-sm font-bold text-slate-700">Invoice Total</span>
                    <span className="text-lg font-bold text-indigo-700">{pendingDelivery.due.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => { setShowDeliverConfirm(false); setPendingDelivery(null); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button onClick={confirmDeliver}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg transition-all active:scale-[0.98]">
                  Confirm &amp; Deliver
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="logo-gradient">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Daily Arrivals</h1>
              <p className="text-[11px] text-slate-400">Record & dispatch truck deliveries</p>
            </div>
          </div>
          <div className="flex items-center">
            <button onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }} className="p-2 bg-transparent border-0 outline-none text-slate-300 hover:text-slate-500" title="Previous day">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="relative">
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="text-sm font-bold text-slate-800 bg-transparent border-0 outline-none cursor-pointer w-44 text-center" />
            </div>
            {isToday(selectedDate) && (
              <span className="ml-1 bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">Today</span>
            )}
            <button onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }} className="p-2 bg-transparent border-0 outline-none text-slate-300 hover:text-slate-500" title="Next day">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {!isToday(selectedDate) && (
          <div className="mb-4 px-4 py-2.5 bg-indigo-50/80 backdrop-blur-sm rounded-xl flex items-center gap-2 text-indigo-600 text-xs">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Viewing <strong>{formatDate(selectedDate)}</strong>. Entries are read-only for past dates.</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pb-1 mb-4">
          {trucks.map(truck => {
            const truckActive = (rows[truck.id] || []).filter((r: any) => r.status !== 'cancelled');
            const truckAllocated = truckActive.reduce((s: number, r: any) => s + (r.weight || 0), 0);
            const truckCaisseTotal = truckActive.reduce((s: number, r: any) => s + totalCaisses(r.caisseItems), 0);
            const isActive = activeTruckId === truck.id;
            const truckCap = Number(truck.net_weight) || 0;
            const capPct = truckCap > 0 ? Math.min((truckAllocated / truckCap) * 100, 100) : 0;
            return (
              <button key={truck.id} onClick={() => setActiveTruckId(truck.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-white text-indigo-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <div className="text-left leading-tight">
                  <div className="text-xs font-semibold">{truck.supplier_name}</div>
                  <div className="text-[10px] text-slate-400">{truck.products?.name || truck.product_id}</div>
                </div>
                <div className="flex items-center gap-1.5 ml-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    truckAllocated < truckCap ? 'bg-slate-100 text-slate-500'
                    : truckAllocated === truckCap ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    {truckAllocated}/{truckCap} kg
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-visible">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-700">{activeTruck?.supplier_name}</span>
              <span className="text-[10px] text-slate-300">|</span>
              <span className="text-xs text-slate-500">{truckProductName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">{truckTotalCaisses} caisses</span>
              <div className="flex items-center gap-2.5">
                <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    allocatedPct > 100 ? 'bg-red-400' : allocatedPct === 100 ? 'bg-emerald-400' : 'bg-indigo-400'
                  }`} style={{ width: `${Math.min(allocatedPct, 100)}%` }} />
                </div>
                <span className={`text-[11px] font-bold ${
                  allocatedPct > 100 ? 'text-red-600' : allocatedPct === 100 ? 'text-emerald-600' : 'text-slate-500'
                }`}>
                  {allocated}{truckCapacity > 0 ? `/${truckCapacity}` : ''} kg
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="table-responsive">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[180px]">Client</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[100px]">Product</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[70px]">Caisses</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[55px]">Save</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[28px]"></th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, ri) => {
                  const matches = filteredClients(row.searchText);
                  const showDropdown = showClientDropdown === row.id;
                  const noExact = !row.searchText || !clients.find((c: any) => c.name.toLowerCase() === row.searchText.toLowerCase());
                  const savedEntry = savedForTruck.find(e => e.id === row.id);
                  const rowStatus = savedEntry ? savedEntry.status : row.status;
                  const st = STATUS_STYLES[rowStatus];
                  const isPast = !isToday(selectedDate);
                  const borderColor = row.saved
                    ? rowStatus === 'en demand' ? 'border-l-amber-400'
                      : rowStatus === 'delivred' ? 'border-l-emerald-500'
                      : 'border-l-red-400'
                    : 'border-l-transparent';
                  return (
                    <tr key={row.id} className={`transition-colors border-l-4 ${borderColor} ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-indigo-50/40 ${ri === activeRows.length - 1 ? 'border-b-2 border-indigo-100' : ''}`}>
                      <td className="px-3 py-1.5 relative">
                        <div className="relative">
                          <input
                            ref={setInputRef(row.id, 0)}
                            type="text"
                            value={row.searchText}
                            onChange={e => { updateRow(row.id, { searchText: e.target.value, clientId: '', clientName: '' }); setShowClientDropdown(row.id); }}
                            onFocus={() => setShowClientDropdown(row.id)}
                            onBlur={() => setTimeout(() => setShowClientDropdown(null), 200)}
                            onKeyDown={e => handleKeyDown(e, row.id)}
                            placeholder="Search client..."
                            readOnly={isPast}
                            className={`arrival-search-input w-full min-h-[44px] sm:min-h-0 px-3 sm:px-2.5 py-2.5 sm:py-1.5 pr-8 border rounded-lg text-base sm:text-xs text-slate-700 placeholder-slate-400 focus:outline-none transition-all bg-white ${isPast ? 'border-transparent bg-transparent cursor-default' : 'border-slate-200 focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300'}`}
                          />
                          {!isPast && (
                            <button type="button" onClick={(e) => { e.preventDefault(); setDrawerRowId(row.id); setDrawerName(''); setDrawerPhone(''); setDrawerRegion(''); setShowDrawer(true); }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-indigo-500 hover:text-white hover:bg-indigo-500 rounded-lg text-sm font-bold transition-all" title="Quick add client">
                              +
                            </button>
                          )}
                        </div>
                        {row.clientName && !showDropdown && (
                          <span className="absolute right-9 top-2.5 text-[10px] text-emerald-500 font-bold">✓</span>
                        )}
                        {showDropdown && (
                          <div className="arrival-dropdown absolute left-3 right-3 top-full mt-0.5 z-[100] bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                            {matches.map((c: any) => (
                              <button key={c.id} type="button" onMouseDown={() => { updateRow(row.id, { clientId: c.id, clientName: c.name, searchText: c.name }); setShowClientDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border-0">
                                <div className="font-medium">{c.name}</div>
                                <div className="text-[10px] text-slate-400">{c.address || c.region}</div>
                              </button>
                            ))}
                            {noExact && (
                              <button type="button" onMouseDown={() => openQuickAdd(row.id, row.searchText || '')}
                                className="w-full text-left px-3 py-2 text-xs text-indigo-600 font-medium hover:bg-indigo-50 flex items-center gap-1 border-0">
                                <span className="text-sm leading-none">+</span>
                                <span>Quick Add{row.searchText ? ` "${row.searchText}"` : ' client'}</span>
                              </button>
                            )}
                          </div>
                        )}
                        </td>
                      <td className="px-3 py-1.5">
                        <input type="text" value={row.product} readOnly
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs text-slate-500 bg-transparent border-0 cursor-default"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min="1" value={totalCaisses(row.caisseItems) || ''}
                          onChange={e => {
                            const qty = e.target.value === '' ? 0 : Number(e.target.value);
                            const upd = [...row.caisseItems];
                            const first = caisseTypesCache[0];
                            if (upd.length === 0) {
                              upd.push({ id: newRowId(), caisseTypeId: first?.id || '', type: first?.name || '', tare: Number(first?.tare) || 0, qty });
                            } else {
                              upd[0] = { ...upd[0], qty };
                            }
                            updateRow(row.id, { caisseItems: upd });
                          }}
onKeyDown={e => handleKeyDown(e, row.id)}
                  readOnly={isPast}
                  className={`w-20 px-2.5 py-1.5 border rounded-lg text-xs text-slate-700 focus:outline-none transition-all text-right font-bold ${isPast ? 'border-transparent bg-transparent' : 'border-slate-200 focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300'}`}
                  placeholder="0" />
                </td>
                <td className="px-1 py-1.5 text-center">
                        {isPast ? (
                          row.saved && <span className="text-[10px] text-emerald-500 font-bold">✓</span>
                        ) : row.saved ? (
                          <button onClick={() => unsaveRow(row.id)}
                            className="btn-primary px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95">
                            Saved
                          </button>
                        ) : (
                          <button onClick={() => saveRow(row)} disabled={!row.clientId}
                            className="btn-primary px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95">
                            Save
                          </button>
                        )}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        {!isPast && (
                          <button onClick={() => removeRow(row.id)} disabled={activeRows.length === 1}
                            className="btn-outline-danger px-2 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                            title="Remove row">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50/30">
            <button onClick={addRow} disabled={!isToday(selectedDate)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="text-base leading-none">+</span>
              <span>Add Row</span>
            </button>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">Rows: <strong className="text-slate-600">{activeRows.length}</strong></span>
              <span className="text-slate-200">|</span>
              <span className="text-slate-400">Saved: <strong className="text-emerald-600">{savedForTruck.length}</strong></span>
              <span className="text-slate-200">|</span>
              <span className="text-slate-400">Caisses: <strong className="text-slate-600">{truckTotalCaisses}</strong></span>
              <span className="text-slate-200">|</span>
              <span className="text-slate-400">kg: <strong className="text-slate-600">{allocated.toFixed(1)}</strong></span>
            </div>
          </div>
        </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h2 className="text-sm font-bold text-slate-800">Overview</h2>
              <span className="text-[10px] text-slate-400 font-medium">({totalSaved} entries for {activeTruck?.supplier_name})</span>
            </div>
            <div className="flex">
              {(['orders', 'expenses', 'stock'] as const).map(tab => (
                <button key={tab} onClick={() => setOverviewTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold border-0 transition-all ${
                    overviewTab === tab
                      ? 'text-indigo-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {tab === 'orders' ? 'Orders' : tab === 'expenses' ? 'Expenses' : 'Stock'}
                </button>
              ))}
              </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-visible">
          {overviewTab === 'orders' ? (
            <>
          {savedForTruck.length > 0 ? (
              <div>
                  <div className="table-responsive">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Client</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Product</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[80px]">Price</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[60px]">Weight</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[60px]">Net Wt</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[80px]">Due</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Caisse</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] w-[110px]">Status</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedForTruck.map((entry, i) => {
                        const st = STATUS_STYLES[entry.status];
                        const isEditable = isToday(selectedDate);
                        return (
                          <tr key={`${entry.truckId}-${entry.id}`} className={`transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-indigo-50/40`}>
                            <td className="px-3 py-2.5 text-slate-700 font-medium">{entry.clientName}</td>
                            <td className="px-3 py-2.5 text-slate-600">{entry.product}</td>
                            <td className="px-3 py-2.5">
                              {isEditable ? (
                                <input type="number" step="0.5" min="0" value={entry.price || ''}
                                  onChange={e => updateSavedEntry(entry.id, { price: e.target.value === '' ? 0 : Number(e.target.value) })}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 text-right"
                                  placeholder="0.00" />
                              ) : (
                                <span className="text-slate-600">{entry.price.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {isEditable ? (
                                <input type="number" step="0.5" min="0" value={entry.weight || ''}
                                  onChange={e => updateSavedEntry(entry.id, { weight: e.target.value === '' ? 0 : Number(e.target.value) })}
                                  className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 text-right"
                                  placeholder="kg" />
                              ) : (
                                <span className="text-slate-600">{entry.weight.toFixed(1)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 font-medium">
                              {netWeight(entry.weight, entry.caisseItems || []).toFixed(1)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-800 font-bold">
                              {dueAmount(entry.weight, entry.caisseItems || [], entry.price).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5">
                              {isEditable && entry.caisseItems ? (
                                <div className="flex flex-col gap-0.5">
                                  {entry.caisseItems.map((ci, ciIdx) => (
                                    <div key={ci.id} className="flex items-center gap-1">
                                      <select value={ci.caisseTypeId}
                                        onChange={e => {
                                          const selected = caisseTypes.find(ct => ct.id === e.target.value);
                                          if (!selected) return;
                                          const upd = [...entry.caisseItems];
                                          upd[ciIdx] = { ...upd[ciIdx], caisseTypeId: selected.id, type: selected.name, tare: Number(selected.tare) || 0 };
                                          updateSavedEntry(entry.id, { caisseItems: upd });
                                        }}
                                        className="flex-1 min-w-0 px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 bg-white">
                                        <option value="" disabled>Select type</option>
                                        {caisseTypes.map((ct: any) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                                      </select>
                                      <input type="number" min="1" value={ci.qty || ''}
                                        onChange={e => {
                                          const upd = [...entry.caisseItems];
                                          upd[ciIdx] = { ...upd[ciIdx], qty: e.target.value === '' ? 1 : Number(e.target.value) };
                                          updateSavedEntry(entry.id, { caisseItems: upd });
                                        }}
                                        className="w-8 px-1 py-0.5 border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 text-center"
                                        placeholder="qty" />
                                    </div>
                                  ))}
                                  <button onClick={() => {
                                    const first = caisseTypes[0];
                                    const upd = [...entry.caisseItems, { id: newRowId(), caisseTypeId: first?.id || '', type: first?.name || '', tare: Number(first?.tare) || 0, qty: 1 }];
                                    updateSavedEntry(entry.id, { caisseItems: upd });
                                  }}
                                    className="self-start text-[10px] text-indigo-500 hover:text-indigo-700">+ Add</button>
                                </div>
                              ) : (
                                <span className="text-slate-600 text-[10px]">
                                  {entry.caisseItems?.length ? entry.caisseItems.map((ci: CaisseItem) => `${ci.qty}× ${ci.type}`).join(', ') : `${totalCaisses(entry.caisseItems || [])} caisses`}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {isEditable ? (
                                <select value={entry.status}
                                  onChange={e => updateSavedEntry(entry.id, { status: e.target.value as EntryStatus })}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border-0 cursor-pointer ${st.bg} ${st.text}`}>
                                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
                                </select>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${st.bg} ${st.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  {st.label}
                                </span>
                              )}
                            </td>
                            <td className="px-1 py-2.5 text-center">
                              {isEditable && (
                                <button onClick={() => deleteSavedEntry(entry.id)}
                                  className="btn-outline-danger px-2 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                                  title="Delete entry">✕</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
              </div>
          ) : (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              No commands for this truck yet
            </div>
          )}

              <div className="px-4 py-3 bg-slate-50/30">
                <div className="flex flex-wrap items-center gap-5">
                  {statusSummary.map(({ status, count }) => {
                    const st = STATUS_STYLES[status];
                    return (
                      <div key={status} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span className="text-[11px] text-slate-500">{st.label}</span>
                        <span className="text-[11px] font-bold text-slate-800">{count}</span>
                      </div>
                    );
                  })}
                  <div className="w-px h-4 bg-slate-200" />
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-[11px] text-slate-500">Caisses</span>
                    <span className="text-[11px] font-bold text-slate-800">
                      {savedForTruck.filter(e => e.status !== 'cancelled').reduce((s, e) => s + totalCaisses(e.caisseItems || []), 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <span className="text-[11px] text-slate-500">Gross kg</span>
                    <span className="text-[11px] font-bold text-slate-800">
                      {savedForTruck.filter(e => e.status !== 'cancelled').reduce((s, e) => s + (e.weight || 0), 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-[11px] text-slate-500">Net kg</span>
                    <span className="text-[11px] font-bold text-slate-800">
                      {savedForTruck.filter(e => e.status !== 'cancelled').reduce((s, e) => s + netWeight(e.weight, e.caisseItems || []), 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[11px] text-slate-500">Due</span>
                    <span className="text-sm font-bold text-indigo-700">
                      {savedForTruck.filter(e => e.status !== 'cancelled').reduce((s, e) => s + dueAmount(e.weight, e.caisseItems || [], e.price), 0).toFixed(2)}
                    </span>
        </div>
      </div>

                {nonCancelledCount > 0 && (
                  <div className="mt-2.5 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    {statusSummary.filter(s => s.status !== 'cancelled').map(({ status, count }) => {
                      if (count === 0) return null;
                      const pct = (count / nonCancelledCount) * 100;
                      const barColor = status === 'en demand' ? 'bg-amber-400' : 'bg-emerald-400';
                      return <div key={status} className={`${barColor} h-full transition-all duration-500`} style={{ width: `${pct}%` }} title={`${STATUS_STYLES[status].label}: ${count} (${pct.toFixed(0)}%)`} />;
                    })}
                  </div>
                )}
                {truckCapacity > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-slate-400 font-medium">Truck weight</span>
                      <span className="text-[10px] text-slate-500">{allocated.toFixed(1)} / {truckCapacity} kg</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${allocatedPct > 100 ? 'bg-red-400' : 'bg-indigo-400'}`}
                        style={{ width: `${Math.min(allocatedPct, 100)}%` }} />
                    </div>
                  </div>
                )}
                {truckCostPrice > 0 && (
                  <div className="mt-2.5 pt-2.5 flex flex-wrap items-center gap-5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Supplier due</span>
                      <span className="text-[11px] font-bold text-slate-800">{supplierDue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Profit</span>
                      <span className={`text-[11px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{profit.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              {isToday(selectedDate) && savedForTruck.length > 0 && (
                <div className="px-4 py-3 flex justify-end">
                  <button onClick={finalizeTruck} disabled={finalizing || savedForTruck.length === 0}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all duration-200 ${
                      finalizing
                        ? 'bg-emerald-400 text-white cursor-wait'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none'
                    }`}>
                    {finalizing ? (
                      <><svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span>Dispatching...</span></>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Finalize &amp; Dispatch</span></>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : overviewTab === 'expenses' ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700">Truck Expenses</h3>
                <span className="text-[10px] text-slate-400">{expenses.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)} total</span>
              </div>
              <div className="space-y-1.5">
                {expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center gap-2">
                    <input type="text" value={exp.label}
                      onBlur={e => {
                        if (e.target.value !== exp.label) {
                          api.truckExpenses.update(exp.id, { label: e.target.value, amount: exp.amount }).catch(() => {});
                        }
                      }}
                      onChange={e => {
                        setExpenses(expenses.map(x => x.id === exp.id ? { ...x, label: e.target.value } : x));
                      }}
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300"
                      placeholder="e.g. Driver fee" />
                    <input type="number" step="0.5" min="0" value={exp.amount || ''}
                      onBlur={e => {
                        const newAmt = e.target.value === '' ? 0 : Number(e.target.value);
                        if (newAmt !== exp.amount) {
                          api.truckExpenses.update(exp.id, { label: exp.label, amount: newAmt }).catch(() => {});
                        }
                      }}
                      onChange={e => {
                        setExpenses(expenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value === '' ? 0 : Number(e.target.value) } : x));
                      }}
                      className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 text-right"
                      placeholder="0.00" />
                    <button onClick={() => {
                      api.truckExpenses.delete(exp.id).then(() => {
                        setExpenses(expenses.filter(e => e.id !== exp.id));
                      }).catch(() => {});
                    }}
                      className="btn-outline-danger px-2 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                if (!activeTruckId || !selectedDate) return;
                api.truckExpenses.create({ truck_id: activeTruckId, arrival_date: selectedDate, label: '', amount: 0 }).then(created => {
                  setExpenses([...expenses, { id: created.id, label: '', amount: 0 }]);
                }).catch(() => {});
              }}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all">
                <span className="text-base leading-none">+</span>
                <span>Add Expense</span>
              </button>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700">Truck Stock</h3>
                <span className="text-[10px] text-slate-400">{activeTruck?.products?.name || truckProductName}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <span className="text-xs text-slate-600">Current stock</span>
                  <span className="text-lg font-bold text-indigo-700">{stockCurrentQty.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.5" min="0" id="stock-qty"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300"
                    placeholder="Quantity to add" />
                  <button onClick={() => {
                    const el = document.getElementById('stock-qty') as HTMLInputElement;
                    const qty = el ? Number(el.value) : 0;
                    if (!qty || qty <= 0) return;
                    if (!truckProduct) { showToastMsg('No product found for this truck', 'error'); return; }
                    api.stock.adjust({ product_id: truckProduct.id, quantity: qty }).then(() => {
                      api.stock.list().then(setStockItems);
                      el.value = '';
                      showToastMsg('Added ' + qty + ' to stock', 'success');
                    }).catch((err: any) => showToastMsg(err.message || 'Failed', 'error'));
                  }}
                    className="btn-primary px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                    Add to Stock
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
          </div>
      </div>

      {showDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
          <div className="relative w-full max-w-sm bg-white shadow-2xl h-full overflow-y-auto animate-slide-in">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Quick Add Client</h3>
              <button onClick={() => setShowDrawer(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input type="text" value={drawerName} onChange={e => setDrawerName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300"
                  placeholder="e.g. Hassan El Jaouhari" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
                <input type="tel" value={drawerPhone} onChange={e => setDrawerPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300"
                  placeholder="e.g. 0620-123456" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Region</label>
                <input type="text" value={drawerRegion} onChange={e => setDrawerRegion(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300"
                  placeholder="e.g. Meknes" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 absolute bottom-0 left-0 right-0 bg-white">
              <button onClick={saveQuickAdd} disabled={!drawerName.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm rounded-xl hover:shadow-lg hover:shadow-indigo-200 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all shadow-md">
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
