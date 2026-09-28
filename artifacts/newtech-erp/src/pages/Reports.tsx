import { useState, useMemo } from 'react';
import { useGetSales, useGetExpenses, useGetDashboard, useGetReportSummary } from '@workspace/api-client-react';
import { LoaderCircle, Printer, Calendar, Banknote, CircleDollarSign, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatMoney, formatDate } from '../lib/utils';
import { BrandMark } from '../components/layout/BrandMark';

export function ReportsPage({ role }: { role: string }) {
  const { data: sales, isPending: salesPending } = useGetSales();
  const { data: expenses, isPending: expensesPending } = useGetExpenses();
  const dashboard = useGetDashboard();

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days
    end: new Date().toISOString().split('T')[0],
  });

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter(s => {
      const d = new Date(s.createdAt).toISOString().split('T')[0];
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [sales, dateRange]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => {
      const d = new Date(e.createdAt).toISOString().split('T')[0];
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [expenses, dateRange]);

  const reportSummary = useGetReportSummary({
    start: dateRange.start,
    end: dateRange.end,
  });
  const salesTotal = reportSummary.data?.salesTotal ?? 0;
  const salesCash = reportSummary.data?.salesCash ?? 0;
  const salesBankak = reportSummary.data?.salesBankak ?? 0;
  const salesRemaining = reportSummary.data?.salesRemaining ?? 0;
  const expensesTotal = reportSummary.data?.expensesTotal ?? 0;
  const expensesCash = reportSummary.data?.expensesCash ?? 0;
  const expensesBankak = reportSummary.data?.expensesBankak ?? 0;

  const netCash = salesCash - expensesCash;
  const netBankak = salesBankak - expensesBankak;
  const netProfit = reportSummary.data?.netProfit ?? 0;

  const handlePrint = () => {
    window.print();
  };

  const isLoading = salesPending || expensesPending || dashboard.isPending || reportSummary.isPending;

  return (
    <>
      <div className="page-title-row no-print">
        <div>
          <span className="page-kicker">تحليل ومتابعة</span>
          <h1>التقارير الشاملة</h1>
          <p>تقارير المبيعات، المصروفات، وصافي الدخل للمتجر.</p>
        </div>
        <button className="primary-action" onClick={handlePrint} disabled={isLoading}>
          <Printer /> طباعة التقرير
        </button>
      </div>

      <div className="card no-print" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ margin: 0, minWidth: '200px' }}>
            <label><Calendar style={{ width: 14, display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}/> من تاريخ</label>
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="input-group" style={{ margin: 0, minWidth: '200px' }}>
            <label><Calendar style={{ width: 14, display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}/> إلى تاريخ</label>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="page-state">
          <LoaderCircle className="spin" />
          <span>جاري تجهيز البيانات...</span>
        </div>
      ) : (
        <div className="print-area report-document">
          <div className="print-header hidden-screen">
            <BrandMark />
            <div className="print-meta">
              <h2>تقرير المبيعات والمصروفات</h2>
              <p>الفترة: {dateRange.start} إلى {dateRange.end}</p>
              <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
          </div>

          <div className="report-sections">
            <section className="report-section">
              <h3 className="section-title"><ArrowUpRight style={{color: '#317c53'}} /> ملخص المبيعات (خلال الفترة)</h3>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <article className="stat-card green">
                  <p>إجمالي المبيعات</p>
                  <strong>{formatMoney(salesTotal)}</strong>
                  <small>{reportSummary.data?.invoiceCount ?? 0} فاتورة</small>
                </article>
                <article className="stat-card">
                  <p>المدفوع كاش</p>
                  <strong>{formatMoney(salesCash)}</strong>
                </article>
                <article className="stat-card blue">
                  <p>المدفوع بنكك</p>
                  <strong>{formatMoney(salesBankak)}</strong>
                </article>
                <article className="stat-card orange">
                  <p>المتبقي (آجل)</p>
                  <strong>{formatMoney(salesRemaining)}</strong>
                </article>
              </div>
            </section>

            <section className="report-section">
              <h3 className="section-title"><ArrowDownRight style={{color: '#a42f36'}} /> ملخص المصروفات (خلال الفترة)</h3>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <article className="stat-card" style={{ borderColor: '#fcdcdb' }}>
                  <p>إجمالي المصروفات</p>
                  <strong style={{ color: '#a42f36' }}>{formatMoney(expensesTotal)}</strong>
                  <small>{reportSummary.data?.expenseCount ?? 0} عملية</small>
                </article>
                <article className="stat-card">
                  <p>مدفوع كاش</p>
                  <strong>{formatMoney(expensesCash)}</strong>
                </article>
                <article className="stat-card blue">
                  <p>مدفوع بنكك</p>
                  <strong>{formatMoney(expensesBankak)}</strong>
                </article>
              </div>
            </section>

            {role === 'admin' && (
              <section className="report-section">
                <h3 className="section-title"><CircleDollarSign style={{color: '#6f3290'}} /> الأداء المالي خلال الفترة</h3>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <article className="stat-card purple">
                    <p>صافي الربح بعد المصروفات</p>
                    <strong>{formatMoney(netProfit)}</strong>
                  </article>
                  <article className="stat-card green">
                    <p>صافي حركة الكاش</p>
                    <strong>{formatMoney(netCash)}</strong>
                  </article>
                  <article className="stat-card blue">
                    <p>صافي حركة بنكك</p>
                    <strong>{formatMoney(netBankak)}</strong>
                  </article>
                </div>
              </section>
            )}

            {role === 'admin' && dashboard.data && (
              <section className="report-section no-break">
                <h3 className="section-title"><Banknote style={{color: '#8d4bac'}} /> الأرصدة الحالية للنظام (غير مرتبطة بالفترة)</h3>
                <div className="account-strip" style={{ marginTop: 0 }}>
                  <div><span>رصيد الكاش الحالي</span><strong>{formatMoney(dashboard.data.cashBalance)}</strong></div>
                  <div><span>رصيد بنكك الحالي</span><strong>{formatMoney(dashboard.data.bankakBalance)}</strong></div>
                  <div><span>قيمة المخزون الحالي</span><strong>{formatMoney(dashboard.data.inventoryValue)}</strong></div>
                  <div className="highlight"><span>المبالغ غير الموردة</span><strong>{formatMoney(dashboard.data.unsettled)}</strong></div>
                </div>
              </section>
            )}
          </div>
          
          <div className="report-tables hidden-screen">
            {filteredSales.length > 0 && (
              <div className="print-table-container">
                <h4>تفصيل المبيعات</h4>
                <table>
                  <thead>
                    <tr>
                      <th>الفاتورة</th>
                      <th>التاريخ</th>
                      <th>العميل</th>
                      <th>الدفع</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(s => (
                      <tr key={s.id}>
                        <td>{s.invoiceNumber}</td>
                        <td className="number" style={{fontSize: '11px'}}>{formatDate(s.createdAt)}</td>
                        <td>{s.customerName}</td>
                        <td>{s.paymentMethod}</td>
                        <td className="number">{formatMoney(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredExpenses.length > 0 && (
              <div className="print-table-container" style={{ marginTop: '30px' }}>
                <h4>تفصيل المصروفات</h4>
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>التصنيف</th>
                      <th>المستفيد</th>
                      <th>الدفع</th>
                      <th>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(e => (
                      <tr key={e.id}>
                        <td className="number" style={{fontSize: '11px'}}>{formatDate(e.createdAt)}</td>
                        <td>{e.category}</td>
                        <td>{e.beneficiary}</td>
                        <td>{e.paymentMethod}</td>
                        <td className="number">{formatMoney(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </>
  );
}
