import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts';

interface StatsData {
  profits: { date: string; value: number }[];
  missingCaisses: { date: string; out: number; returned: number; missing: number }[];
  dueAmounts: { date: string; value: number }[];
  summary: { totalProfits: number; totalMissing: number; totalDue: number };
}

const PERIODS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

export default function DashboardCharts() {
  const { t } = useTranslation();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.dashboard.stats(periodDays).then(setData).finally(() => setLoading(false));
  }, [periodDays]);

  if (loading) return <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>;
  if (!data) return null;

  const formatDate = (date: any) => {
    const d = new Date(String(date));
    if (periodDays <= 14) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (periodDays <= 60) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="row g-3 mb-4">
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0"><i className="bi bi-bar-chart-line me-2" />{t('Statistics')}</h6>
            <div className="btn-group btn-group-sm">
              {PERIODS.map(p => (
                <button key={p.days} className={`btn ${periodDays === p.days ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setPeriodDays(p.days)}>
                  {t(p.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <div className="text-center p-3 rounded bg-light">
                  <div className="text-muted small">{t('Total Profits')}</div>
                  <h4 className="text-success mb-0">{data.summary.totalProfits.toFixed(2)}</h4>
                </div>
              </div>
              <div className="col-md-4">
                <div className="text-center p-3 rounded bg-light">
                  <div className="text-muted small">{t('Missing Caisses')}</div>
                  <h4 className="text-danger mb-0">{data.summary.totalMissing}</h4>
                </div>
              </div>
              <div className="col-md-4">
                <div className="text-center p-3 rounded bg-light">
                  <div className="text-muted small">{t('Total Due')}</div>
                  <h4 className="text-warning mb-0">{data.summary.totalDue.toFixed(2)}</h4>
                </div>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <h6 className="text-muted small mb-2">{t('Profits')}</h6>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.profits}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={formatDate} formatter={(v: any) => [Number(v).toFixed(2), t('Profit')]} />
                    <Bar dataKey="value" fill="#198754" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="col-md-4">
                <h6 className="text-muted small mb-2">{t('Missing Caisses (Out - Returned)')}</h6>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.missingCaisses}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={formatDate} />
                    <Legend />
                    <Bar dataKey="out" name={t('Out')} fill="#ffc107" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="returned" name={t('Returned')} fill="#198754" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="missing" name={t('Missing')} fill="#dc3545" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="col-md-4">
                <h6 className="text-muted small mb-2">{t('Due Amounts')}</h6>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.dueAmounts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={formatDate} formatter={(v: any) => [Number(v).toFixed(2), t('Due')]} />
                    <Area type="monotone" dataKey="value" stroke="#fd7e14" fill="#fd7e1433" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
