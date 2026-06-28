import { useState, useMemo } from 'react';

const PRODUCTS = [
  'طماطم', 'بطاطا', 'بصل', 'فلفل', 'خيار', 'جزر', 'فجل',
  'بروكلي', 'خس', 'سبانخ', 'باذنجان', 'قرنبيط', 'كوسا',
  'تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'مانجو', 'ليمون',
];

interface InvoiceItem {
  product: string;
  quantity: number;
  totalWeight: number;
  unitPrice: number;
}

export default function WholesaleInvoiceTracker() {
  const [invoiceNumber, setInvoiceNumber] = useState('INV-' + Date.now().toString(36).toUpperCase());
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientName, setClientName] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { product: 'طماطم', quantity: 0, totalWeight: 0, unitPrice: 0 },
  ]);
  const [showDropdown, setShowDropdown] = useState<number | null>(null);

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    setItems(prev => [...prev, { product: 'طماطم', quantity: 0, totalWeight: 0, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const calculations = useMemo(() => {
    return items.map(item => {
      const totalRyal = item.totalWeight * item.unitPrice;
      const totalDirham = totalRyal / 20;
      const crateWeight = item.quantity > 0 ? item.totalWeight / item.quantity : 0;
      return { ...item, totalRyal, totalDirham, crateWeight };
    });
  }, [items]);

  const grandTotalRyal = useMemo(() => calculations.reduce((sum, item) => sum + item.totalRyal, 0), [calculations]);
  const grandTotalDirham = grandTotalRyal / 20;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const generateWhatsAppText = () => {
    const lines = [
      `╔══════════════════════╗`,
      `║  *البيع بالجملة للخضر والفواكه*  ║`,
      `╚══════════════════════╝`,
      ``,
      `📄 *رقم الفاتورة:* ${invoiceNumber}`,
      `📅 *التاريخ:* ${formatDate(invoiceDate)}`,
      `👤 *الزبون:* ${clientName || '---'}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📦 *تفاصيل الفاتورة:`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    calculations.forEach((item, i) => {
      if (item.totalWeight > 0) {
        lines.push(``);
        lines.push(`*${i + 1}. ${item.product}*`);
        lines.push(`   📦 العدد: ${item.quantity} صندوق`);
        lines.push(`   ⚖️ الوزن: ${item.totalWeight} كلغ`);
        lines.push(`   💰 الثمن: ${item.unitPrice} ريال/كلغ`);
        lines.push(`   📊 الوزن/صندوق: ${item.crateWeight.toFixed(1)} كلغ`);
        lines.push(`   ✅ المجموع: *${item.totalRyal.toFixed(2)} ريال*`);
      }
    });

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💰 *المجموع بالريال: ${grandTotalRyal.toFixed(2)} ريال*`);
    lines.push(`💰 *المجموع بالدرهم: ${grandTotalDirham.toFixed(2)} درهم*`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`شكرا لثقتكم 🙏`);

    return lines.join('\n');
  };

  const sendWhatsApp = () => {
    const text = generateWhatsAppText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            padding: '16px 32px', borderRadius: 16, marginBottom: 16,
            boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)',
          }}>
            <span style={{ fontSize: 36 }}>🌿</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
                البيع بالجملة للخضر والفواكه
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: '#a7f3d0', marginTop: 4 }}>
                إنشاء فاتورة جديدة
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left Panel — Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Invoice Meta */}
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: 24,
              border: '1px solid #334155',
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: 18, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📋</span> بيانات الفاتورة
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>رقم الفاتورة</label>
                  <input
                    style={inputStyle}
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>تاريخ الفاتورة</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>إسم الزبون</label>
                  <input
                    style={{ ...inputStyle, fontSize: 16 }}
                    placeholder="أدخل إسم الزبون..."
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: 24,
              border: '1px solid #334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📦</span> تفاصيل السلع
                </h3>
                <button
                  onClick={addItem}
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px',
                    cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 18 }}>+</span> إضافة سلعة
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} style={{
                  background: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 12,
                  border: '1px solid #1e293b', position: 'relative',
                }}>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      style={{
                        position: 'absolute', top: 8, left: 8,
                        background: '#991b1b', color: '#fca5a5', border: 'none',
                        borderRadius: 6, width: 28, height: 28, cursor: 'pointer',
                        fontSize: 14, fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={labelStyle}>نوع السلعة</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          style={inputStyle}
                          value={item.product}
                          onChange={e => updateItem(index, 'product', e.target.value)}
                          onFocus={() => setShowDropdown(index)}
                          onBlur={() => setTimeout(() => setShowDropdown(null), 200)}
                        />
                        {showDropdown === index && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            background: '#1e293b', border: '1px solid #475569',
                            borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                            zIndex: 50,
                          }}>
                            {PRODUCTS.filter(p => p.includes(item.product) || item.product === '').map(p => (
                              <div
                                key={p}
                                onMouseDown={() => { updateItem(index, 'product', p); setShowDropdown(null); }}
                                style={{
                                  padding: '10px 14px', cursor: 'pointer',
                                  borderBottom: '1px solid #334155',
                                  color: p === item.product ? '#10b981' : '#e2e8f0',
                                  background: p === item.product ? '#064e3b' : 'transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                                onMouseLeave={e => (e.currentTarget.style.background = p === item.product ? '#064e3b' : 'transparent')}
                              >
                                {p}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>العدد (الصناديق)</label>
                      <input
                        type="number"
                        min={0}
                        style={inputStyle}
                        value={item.quantity || ''}
                        placeholder="0"
                        onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>الوزن الإجمالي (كلغ)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        style={inputStyle}
                        value={item.totalWeight || ''}
                        placeholder="0.0"
                        onChange={e => updateItem(index, 'totalWeight', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>ثمن الوحدة (ريال)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        style={inputStyle}
                        value={item.unitPrice || ''}
                        placeholder="0.0"
                        onChange={e => updateItem(index, 'unitPrice', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  {item.totalWeight > 0 && item.quantity > 0 && (
                    <div style={{
                      marginTop: 10, padding: '6px 12px', background: '#064e3b',
                      borderRadius: 8, fontSize: 13, color: '#a7f3d0',
                      display: 'flex', gap: 16,
                    }}>
                      <span>⚖️ {calculations[index].crateWeight.toFixed(1)} كلغ/صندوق</span>
                      <span>💰 {calculations[index].totalRyal.toFixed(2)} ريال</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
              borderRadius: 16, padding: 24,
              border: '1px solid #10b981',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#d1fae5' }}>
                💰 الإجمالي
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{
                  background: '#047857', borderRadius: 12, padding: '16px 20px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#a7f3d0', marginBottom: 4 }}>المجموع (ريال)</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                    {grandTotalRyal.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 14, color: '#6ee7b7' }}>ريال</div>
                </div>
                <div style={{
                  background: '#047857', borderRadius: 12, padding: '16px 20px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#a7f3d0', marginBottom: 4 }}>المجموع (درهم)</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                    {grandTotalDirham.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 14, color: '#6ee7b7' }}>درهم</div>
                </div>
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={sendWhatsApp}
              disabled={!clientName || grandTotalRyal === 0}
              style={{
                background: (!clientName || grandTotalRyal === 0)
                  ? '#334155'
                  : 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                color: (!clientName || grandTotalRyal === 0) ? '#64748b' : '#fff',
                border: 'none', borderRadius: 14, padding: '18px 32px',
                fontSize: 18, fontWeight: 700, cursor: (!clientName || grandTotalRyal === 0) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: (!clientName || grandTotalRyal === 0) ? 'none' : '0 0 40px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={e => {
                if (clientName && grandTotalRyal > 0) {
                  e.currentTarget.style.boxShadow = '0 0 60px rgba(16, 185, 129, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = (!clientName || grandTotalRyal === 0) ? 'none' : '0 0 40px rgba(16, 185, 129, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              إرسال الفاتورة عبر واتساب
            </button>
          </div>

          {/* Right Panel — WhatsApp Preview */}
          <div>
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: 24,
              border: '1px solid #334155', position: 'sticky', top: 24,
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>💬</span> معاينة واتساب
              </h3>

              {/* Phone Frame */}
              <div style={{
                background: '#0b141a', borderRadius: 20, padding: 4,
                maxWidth: 400, margin: '0 auto',
                boxShadow: '0 0 30px rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  background: '#0b141a', borderRadius: 18, overflow: 'hidden',
                  border: '1px solid #2a3942',
                }}>
                  {/* WhatsApp Header */}
                  <div style={{
                    background: '#1f2c34', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid #2a3942',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#00a884', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, color: '#fff',
                    }}>
                      🌿
                    </div>
                    <div>
                      <div style={{ color: '#e9edef', fontSize: 15, fontWeight: 600 }}>الفواكه والخضار</div>
                      <div style={{ color: '#8696a0', fontSize: 11 }}>متصل الآن</div>
                    </div>
                  </div>

                  {/* Message Bubble */}
                  <div style={{
                    padding: 16, background: '#0b141a',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}>
                    <div style={{
                      background: '#005c4b', borderRadius: 12, padding: '12px 16px',
                      maxWidth: '95%', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}>
                      <pre style={{
                        margin: 0, fontFamily: "'Segoe UI', Tahoma, sans-serif",
                        fontSize: 13, lineHeight: 1.6, color: '#e9edef',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        direction: 'rtl',
                      }}>
                        {generateWhatsAppText()}
                      </pre>
                      <div style={{
                        textAlign: 'left', marginTop: 6, fontSize: 11, color: '#8696a0',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                      }}>
                        {new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}
                        <span style={{ color: '#53bdeb' }}>✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Below Phone */}
              <div style={{
                marginTop: 20, padding: 16, background: '#0f172a',
                borderRadius: 12, border: '1px solid #334155',
              }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>ملخص الفاتورة</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>الزبون</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{clientName || '---'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>عدد السلع</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {items.filter(i => i.totalWeight > 0).length}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>إجمالي الصناديق</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {items.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>إجمالي الوزن</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {items.reduce((s, i) => s + i.totalWeight, 0).toFixed(1)} كلغ
                  </span>
                </div>
                <div style={{
                  borderTop: '1px solid #334155', paddingTop: 8, marginTop: 8,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>المجموع</span>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>
                    {grandTotalRyal.toFixed(2)} ريال
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#94a3b8',
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};
