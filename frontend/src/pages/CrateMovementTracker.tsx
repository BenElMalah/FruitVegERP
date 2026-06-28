import { useState, useMemo } from 'react';

interface Client {
  id: string;
  name: string;
}

interface CrateMovement {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  type: 'dispatched' | 'returned';
  quantity: number;
  notes: string;
  timestamp: number;
}

const MOCK_CLIENTS: Client[] = [
  { id: '1', name: 'محمد أمين' },
  { id: '2', name: 'فاطمة الزهراء' },
  { id: '3', name: 'يوسف العلوي' },
  { id: '4', name: 'نادية بنسالم' },
  { id: '5', name: 'حسن الإدريسي' },
  { id: '6', name: 'سارة المغربي' },
  { id: '7', name: 'عبد الله الفاسي' },
  { id: '8', name: 'ليلى بنكيران' },
];

export default function CrateMovementTracker() {
  const [movements, setMovements] = useState<CrateMovement[]>([
    { id: '1', clientId: '1', clientName: 'محمد أمين', date: '2026-06-28', type: 'dispatched', quantity: 50, notes: 'طلبيت عادية', timestamp: Date.now() - 86400000 },
    { id: '2', clientId: '1', clientName: 'محمد أمين', date: '2026-06-28', type: 'returned', quantity: 12, notes: 'صناديق فارغة', timestamp: Date.now() - 85000000 },
    { id: '3', clientId: '2', clientName: 'فاطمة الزهراء', date: '2026-06-27', type: 'dispatched', quantity: 30, notes: '配送', timestamp: Date.now() - 172800000 },
    { id: '4', clientId: '3', clientName: 'يوسف العلوي', date: '2026-06-27', type: 'dispatched', quantity: 80, notes: 'طلب كبير', timestamp: Date.now() - 170000000 },
    { id: '5', clientId: '3', clientName: 'يوسف العلوي', date: '2026-06-26', type: 'returned', quantity: 25, notes: 'مرتجع جزئي', timestamp: Date.now() - 259200000 },
    { id: '6', clientId: '2', clientName: 'فاطمة الزهراء', date: '2026-06-26', type: 'returned', quantity: 8, notes: 'storm damage', timestamp: Date.now() - 250000000 },
    { id: '7', clientId: '5', clientName: 'حسن الإدريسي', date: '2026-06-25', type: 'dispatched', quantity: 45, notes: '', timestamp: Date.now() - 345600000 },
    { id: '8', clientId: '4', clientName: 'نادية بنسالم', date: '2026-06-25', type: 'dispatched', quantity: 60, notes: '配送 طلب خاص', timestamp: Date.now() - 340000000 },
    { id: '9', clientId: '4', clientName: 'نادية بنسالم', date: '2026-06-24', type: 'returned', quantity: 15, notes: 'مرتجع كامل', timestamp: Date.now() - 432000000 },
    { id: '10', clientId: '5', clientName: 'حسن الإدريسي', date: '2026-06-24', type: 'returned', quantity: 10, notes: '', timestamp: Date.now() - 430000000 },
  ]);

  const [formClientId, setFormClientId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formType, setFormType] = useState<'dispatched' | 'returned'>('dispatched');
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [filterClientId, setFilterClientId] = useState('all');

  const selectedClient = MOCK_CLIENTS.find(c => c.id === formClientId);

  const handleSubmit = () => {
    if (!formClientId || formQuantity <= 0) return;
    const client = MOCK_CLIENTS.find(c => c.id === formClientId);
    if (!client) return;

    const newMovement: CrateMovement = {
      id: Date.now().toString(),
      clientId: formClientId,
      clientName: client.name,
      date: formDate,
      type: formType,
      quantity: formQuantity,
      notes: formNotes,
      timestamp: Date.now(),
    };

    setMovements(prev => [newMovement, ...prev]);
    setFormQuantity(0);
    setFormNotes('');
  };

  const clientStats = useMemo(() => {
    const stats: Record<string, { dispatched: number; returned: number; net: number }> = {};
    movements.forEach(m => {
      if (!stats[m.clientId]) stats[m.clientId] = { dispatched: 0, returned: 0, net: 0 };
      if (m.type === 'dispatched') {
        stats[m.clientId].dispatched += m.quantity;
        stats[m.clientId].net += m.quantity;
      } else {
        stats[m.clientId].returned += m.quantity;
        stats[m.clientId].net -= m.quantity;
      }
    });
    return stats;
  }, [movements]);

  const globalStats = useMemo(() => {
    const totalDispatched = movements.filter(m => m.type === 'dispatched').reduce((s, m) => s + m.quantity, 0);
    const totalReturned = movements.filter(m => m.type === 'returned').reduce((s, m) => s + m.quantity, 0);
    return { totalDispatched, totalReturned, netBalance: totalDispatched - totalReturned };
  }, [movements]);

  const filteredMovements = useMemo(() => {
    if (filterClientId === 'all') return movements;
    return movements.filter(m => m.clientId === filterClientId);
  }, [movements, filterClientId]);

  const shareReport = () => {
    const targetId = filterClientId !== 'all' ? filterClientId : formClientId;
    if (!targetId && filterClientId === 'all') {
      const lines = [
        `╔══════════════════════════════╗`,
        `║  *تقرير حركة الصناديق*  ║`,
        `╚══════════════════════════════╝`,
        ``,
        `📦 *إجمالي الصناديق المرسلة:* ${globalStats.totalDispatched}`,
        `🔄 *إجمالي الصناديق المسترجعة:* ${globalStats.totalReturned}`,
        `📊 *صافي الرصيد الكلي:* ${globalStats.netBalance} صندوق`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 *آخر الحركات:*`,
        ...movements.slice(0, 5).map(m =>
          `  ${m.type === 'dispatched' ? '⬆️' : '⬇️'} ${m.clientName} | ${m.date} | ${m.type === 'dispatched' ? 'تسليم' : 'استرجاع'} | ${m.quantity} صندوق`
        ),
        ``,
        `📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-MA')}`,
      ];
      const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(url, '_blank');
      return;
    }

    const cid = targetId;
    const stats = clientStats[cid] || { dispatched: 0, returned: 0, net: 0 };
    const clientName = MOCK_CLIENTS.find(c => c.id === cid)?.name || '---';
    const clientMovements = movements.filter(m => m.clientId === cid).slice(0, 5);

    const lines = [
      `╔══════════════════════════════╗`,
      `║  *تقرير حركة الصناديق*  ║`,
      `╚══════════════════════════════╝`,
      ``,
      `👤 *الزبون:* ${clientName}`,
      ``,
      `📦 *الصناديق المرسلة:* ${stats.dispatched}`,
      `🔄 *الصناديق المسترجعة:* ${stats.returned}`,
      `📊 *صافي الرصيد:* ${stats.net} صندوق`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *آخر الحركات:*`,
      ...clientMovements.map(m =>
        `  ${m.type === 'dispatched' ? '⬆️' : '⬇️'} ${m.date} | ${m.type === 'dispatched' ? 'تسليم' : 'استرجاع'} | ${m.quantity} صندوق${m.notes ? ' | ' + m.notes : ''}`
      ),
      ``,
      `📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-MA')}`,
    ];

    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)',
            padding: '16px 32px', borderRadius: 16, marginBottom: 16,
            boxShadow: '0 0 40px rgba(245, 158, 11, 0.3)',
          }}>
            <span style={{ fontSize: 36 }}>📦</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
                تقرير حركة الصناديق (Caisses)
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: '#fcd34d', marginTop: 4 }}>
                لوحة التحكم اللوجستية
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'إجمالي الصناديق المرسلة', value: globalStats.totalDispatched, icon: '⬆️', color: '#f59e0b', bg: '#78350f', glow: 'rgba(245, 158, 11, 0.3)' },
            { label: 'إجمالي الصناديق المسترجعة', value: globalStats.totalReturned, icon: '⬇️', color: '#22c55e', bg: '#14532d', glow: 'rgba(34, 197, 94, 0.3)' },
            { label: 'صافي الرصيد الحالي للزبون', value: globalStats.netBalance, icon: '📊', color: '#f59e0b', bg: '#78350f', glow: 'rgba(245, 158, 11, 0.2)' },
          ].map((metric, i) => (
            <div key={i} style={{
              background: '#1e293b', borderRadius: 16, padding: '20px 24px',
              border: `1px solid ${metric.color}33`,
              boxShadow: `0 0 20px ${metric.glow}`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -20, left: -20, width: 80, height: 80,
                borderRadius: '50%', background: metric.bg, opacity: 0.3,
              }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: metric.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>
                  {metric.icon}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{metric.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: metric.color, fontFamily: 'monospace' }}>
                    {metric.value}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>

          {/* Left — Movement Log Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: 24,
              border: '1px solid #334155',
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: 18, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📋</span> تسجيل حركة جديدة
              </h3>

              {/* Client Selection */}
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <label style={labelStyle}>إختيار الزبون</label>
                <div
                  onClick={() => setShowClientDropdown(!showClientDropdown)}
                  style={{
                    ...inputStyle, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: selectedClient ? '#e2e8f0' : '#64748b' }}>
                    {selectedClient ? selectedClient.name : 'اختر زبون...'}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>▼</span>
                </div>
                {showClientDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#1e293b', border: '1px solid #475569',
                    borderRadius: 10, maxHeight: 200, overflowY: 'auto',
                    zIndex: 50, marginTop: 4,
                  }}>
                    {MOCK_CLIENTS.map(c => (
                      <div
                        key={c.id}
                        onClick={() => { setFormClientId(c.id); setShowClientDropdown(false); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid #334155',
                          color: c.id === formClientId ? '#f59e0b' : '#e2e8f0',
                          background: c.id === formClientId ? '#78350f' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                        onMouseEnter={e => { if (c.id !== formClientId) e.currentTarget.style.background = '#334155'; }}
                        onMouseLeave={e => { if (c.id !== formClientId) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{c.name}</span>
                        {clientStats[c.id] && (
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 6,
                            background: clientStats[c.id].net > 0 ? '#78350f' : '#14532d',
                            color: clientStats[c.id].net > 0 ? '#fcd34d' : '#86efac',
                          }}>
                            {clientStats[c.id].net} صندوق
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Date */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>التاريخ</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>

              {/* Type Toggle */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>نوع الحركة</label>
                <div style={{
                  display: 'flex', background: '#0f172a', borderRadius: 12,
                  overflow: 'hidden', border: '1px solid #334155',
                }}>
                  <button
                    onClick={() => setFormType('dispatched')}
                    style={{
                      flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, transition: 'all 0.3s',
                      background: formType === 'dispatched'
                        ? 'linear-gradient(135deg, #b45309, #f59e0b)' : 'transparent',
                      color: formType === 'dispatched' ? '#fff' : '#94a3b8',
                    }}
                  >
                    ⬆️ تسليم (Dispatched)
                  </button>
                  <button
                    onClick={() => setFormType('returned')}
                    style={{
                      flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, transition: 'all 0.3s',
                      background: formType === 'returned'
                        ? 'linear-gradient(135deg, #15803d, #22c55e)' : 'transparent',
                      color: formType === 'returned' ? '#fff' : '#94a3b8',
                    }}
                  >
                    ⬇️ استرجاع (Returned)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>الكمية (عدد الصناديق)</label>
                <input
                  type="number"
                  min={1}
                  style={{ ...inputStyle, fontSize: 20, fontWeight: 700, textAlign: 'center' }}
                  value={formQuantity || ''}
                  placeholder="0"
                  onChange={e => setFormQuantity(Number(e.target.value))}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>ملاحظات</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="أضف ملاحظات..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!formClientId || formQuantity <= 0}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  fontSize: 16, fontWeight: 700, cursor: (!formClientId || formQuantity <= 0) ? 'not-allowed' : 'pointer',
                  background: (!formClientId || formQuantity <= 0)
                    ? '#334155'
                    : formType === 'dispatched'
                      ? 'linear-gradient(135deg, #b45309, #f59e0b)'
                      : 'linear-gradient(135deg, #15803d, #22c55e)',
                  color: (!formClientId || formQuantity <= 0) ? '#64748b' : '#fff',
                  boxShadow: (!formClientId || formQuantity <= 0) ? 'none'
                    : formType === 'dispatched' ? '0 0 20px rgba(245, 158, 11, 0.3)' : '0 0 20px rgba(34, 197, 94, 0.3)',
                  transition: 'all 0.3s',
                }}
              >
                {formType === 'dispatched' ? '⬆️ تسجيل التسليم' : '⬇️ تسجيل الاسترجاع'}
              </button>
            </div>

            {/* Per-Client Summary */}
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: 24,
              border: '1px solid #334155',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>👤</span> أرصدة الزبائن
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MOCK_CLIENTS.filter(c => clientStats[c.id]).map(c => {
                  const s = clientStats[c.id];
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#0f172a', borderRadius: 10,
                      border: '1px solid #1e293b',
                    }}>
                      <span style={{ fontSize: 13, color: '#e2e8f0' }}>{c.name}</span>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                        <span style={{ color: '#f59e0b' }}>⬆️ {s.dispatched}</span>
                        <span style={{ color: '#22c55e' }}>⬇️ {s.returned}</span>
                        <span style={{
                          fontWeight: 700,
                          color: s.net > 0 ? '#f59e0b' : s.net < 0 ? '#22c55e' : '#94a3b8',
                        }}>
                          صافي: {s.net}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Share Button */}
            <button
              onClick={shareReport}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.3s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 0 50px rgba(16, 185, 129, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              مشاركة تقرير حركة الصناديق
            </button>
          </div>

          {/* Right — Activity Table */}
          <div>
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: 24,
              border: '1px solid #334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📋</span> سجل الحركات
                </h3>
                <select
                  value={filterClientId}
                  onChange={e => setFilterClientId(e.target.value)}
                  style={{
                    padding: '8px 12px', background: '#0f172a', border: '1px solid #475569',
                    borderRadius: 8, color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  <option value="all">جميع الزبائن</option>
                  {MOCK_CLIENTS.filter(c => clientStats[c.id]).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #334155' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>الزبون</th>
                      <th style={thStyle}>التاريخ</th>
                      <th style={thStyle}>الحركة</th>
                      <th style={thStyle}>الكمية</th>
                      <th style={thStyle}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map((m, i) => (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: '1px solid #1e293b',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={tdStyle}>
                          <span style={{ color: '#64748b', fontSize: 12 }}>{filteredMovements.length - i}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600 }}>{m.clientName}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#94a3b8', fontSize: 13 }}>{formatDate(m.date)}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 12px', borderRadius: 8,
                            background: m.type === 'dispatched' ? '#78350f' : '#14532d',
                            color: m.type === 'dispatched' ? '#fcd34d' : '#86efac',
                            fontSize: 13, fontWeight: 600,
                          }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 20, height: 20, borderRadius: 6,
                              background: m.type === 'dispatched' ? '#f59e0b' : '#22c55e',
                              color: '#fff', fontSize: 12,
                            }}>
                              {m.type === 'dispatched' ? '↑' : '↓'}
                            </span>
                            {m.type === 'dispatched' ? 'تسليم' : 'استرجاع'}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            fontWeight: 700, fontSize: 16, fontFamily: 'monospace',
                            color: m.type === 'dispatched' ? '#f59e0b' : '#22c55e',
                          }}>
                            {m.type === 'dispatched' ? '+' : '-'}{m.quantity}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#94a3b8', fontSize: 13 }}>
                            {m.notes || '---'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredMovements.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#64748b', padding: 40 }}>
                          لا توجد حركات مسجلة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#0f172a',
  border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  padding: '12px 14px', textAlign: 'right', color: '#94a3b8',
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px', textAlign: 'right',
};
