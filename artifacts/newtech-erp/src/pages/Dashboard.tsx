import { useGetDashboard, useGetActivities } from '@workspace/api-client-react';
import { 
  Activity, 
  Banknote, 
  Boxes, 
  ChevronDown, 
  CircleDollarSign, 
  CreditCard, 
  LoaderCircle, 
  ShoppingCart, 
  X 
} from 'lucide-react';
import { formatMoney } from '../lib/utils';
import type { ReactNode } from 'react';

function StatCard({
  icon,
  label,
  value,
  tone = 'purple',
  note,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: 'purple' | 'orange' | 'green' | 'blue';
  note?: string;
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="trend">+ اليوم</span>
      </div>
      <p>{label}</p>
      <strong>{formatMoney(value)}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export function DashboardPage({ role }: { role: string }) {
  const dashboard = useGetDashboard();
  const activities = useGetActivities();
  const data = dashboard.data;

  if (dashboard.isPending) {
    return (
      <div className="page-state">
        <LoaderCircle className="spin" />
        <span>جاري تحميل الحسابات...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-state error">
        <X />
        <span>تعذر تحميل بيانات لوحة التحكم</span>
      </div>
    );
  }

  const maxTrend = Math.max(...data.salesTrend.map((point) => point.value), 1);

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">نظرة عامة</span>
          <h1>لوحة التحكم</h1>
          <p>أهلاً بك، هذه أحدث أرقام المتجر اليوم.</p>
        </div>
      </div>

      <section className="stats-grid">
        <StatCard 
          icon={<CircleDollarSign />} 
          label="مبيعات اليوم" 
          value={data.salesToday} 
          note="إجمالي فواتير اليوم" 
        />
        <StatCard 
          icon={<Banknote />} 
          label="رصيد الكاش" 
          value={data.cashBalance} 
          tone="green" 
          note="الرصيد الحالي" 
        />
        <StatCard 
          icon={<CreditCard />} 
          label="رصيد بنكك" 
          value={data.bankakBalance} 
          tone="blue" 
          note="الرصيد الحالي" 
        />
        {role !== 'admin' && (
          <StatCard 
            icon={<ShoppingCart />} 
            label="مبيعات الشهر" 
            value={data.salesMonth} 
            tone="green" 
            note="إجمالي فواتير الشهر" 
          />
        )}
        <StatCard 
          icon={<Boxes />} 
          label="قيمة المخزون" 
          value={data.inventoryValue} 
          tone="orange" 
          note="بسعر البيع" 
        />
      </section>

      {role === 'admin' && (
        <section className="account-strip">
          <div><span>مستحق حصيلة المبيعات</span><strong>{formatMoney(data.salesProceeds)}</strong></div>
          <div><span>توريدات عمر</span><strong>{formatMoney(data.omarSettlements)}</strong></div>
          <div><span>توريدات سيف</span><strong>{formatMoney(data.saifSettlements)}</strong></div>
          <div className="highlight"><span>المبلغ المتبقي</span><strong>{formatMoney(data.unsettled)}</strong></div>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>حركة المبيعات</h2>
              <p>آخر 7 أيام</p>
            </div>
            <button>هذا الأسبوع <ChevronDown /></button>
          </div>
          <div className="bar-chart">
            {data.salesTrend.map((point) => (
              <div className="bar-item" key={point.label}>
                <div className="bar-track">
                  <span style={{ height: `${Math.max(8, (point.value / maxTrend) * 100)}%` }} />
                </div>
                <small>{point.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>آخر النشاطات</h2>
              <p>أحدث الحركات المسجلة</p>
            </div>
            <button className="text-button">عرض الكل</button>
          </div>
          <div className="activity-list">
            {(activities.data ?? []).slice(0, 5).map((item) => (
              <div className="activity-row" key={item.id}>
                <span className={`activity-dot ${item.type}`}>
                  <Activity />
                </span>
                <div>
                  <b>{item.title}</b>
                  <small>{item.description}</small>
                  <small className="activity-signature" dir="auto">
                    المنفّذ: {item.actorDisplayName ?? 'غير مسجل في هذه العملية السابقة'}
                    {item.actorUsername ? ` · ${item.actorUsername}` : ''}
                  </small>
                </div>
                <strong>{item.amount ? formatMoney(item.amount) : '—'}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
