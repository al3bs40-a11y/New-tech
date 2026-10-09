import { useMemo, useState } from 'react';
import { useGetSettlements, useCreateSettlement, getGetSettlementsQueryKey, getGetDashboardQueryKey, getGetActivitiesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletCards, LoaderCircle, Plus, Calendar, Printer } from 'lucide-react';
import { formatMoney } from '../lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { BrandMark } from '../components/layout/BrandMark';
import {
  filterSettlementsByDateRange,
  formatSettlementDate,
  getDefaultSettlementReportRange,
  summarizeSettlements,
} from './settlementReport';

export function SettlementsPage() {
  const queryClient = useQueryClient();
  const { data: settlements, isPending, isError, refetch } = useGetSettlements();
  
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({ channel: 'عمر', paymentMethod: 'بنكك', amount: '', reference: '', notes: '' });
  const [dateRange, setDateRange] = useState(getDefaultSettlementReportRange);
  const today = getDefaultSettlementReportRange().end;
  const isRangeValid = Boolean(dateRange.start && dateRange.end && dateRange.start <= dateRange.end);
  const filteredSettlements = useMemo(
    () => filterSettlementsByDateRange(settlements ?? [], dateRange),
    [settlements, dateRange],
  );
  const totals = useMemo(
    () => summarizeSettlements(filteredSettlements),
    [filteredSettlements],
  );

  const createSettlement = useCreateSettlement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettlementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() });
        setOpen(false);
        setFormData({ channel: 'عمر', paymentMethod: 'بنكك', amount: '', reference: '', notes: '' });
        setFormError('');
      },
      onError: (error) => {
        const response = (error as { data?: { error?: unknown } })?.data;
        setFormError(typeof response?.error === 'string' ? response.error : 'تعذر تسجيل التوريدة. تحقق من المبلغ والإيصال ثم حاول مجدداً.');
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    createSettlement.mutate({
      data: {
        channel: formData.channel as 'عمر' | 'سيف',
        paymentMethod: formData.paymentMethod as 'كاش' | 'بنكك',
        amount: Number(formData.amount),
        reference: formData.reference,
        notes: formData.notes || null
      }
    });
  };

  const handlePrint = () => window.print();

  return (
    <>
      <div className="page-title-row no-print">
        <div>
          <span className="page-kicker">الماليات</span>
          <h1>تقرير توريد الحصيلة</h1>
          <p>تابع التوريدات خلال الفترة المحددة، حسب القناة وطريقة الدفع.</p>
        </div>

        <div className="settlement-page-actions no-print">
          <button
            type="button"
            className="secondary-action"
            onClick={handlePrint}
            disabled={isPending || isError || !isRangeValid}
          >
            <Printer /> طباعة التقرير
          </button>
          <Dialog.Root open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) setFormError('');
          }}>
            <Dialog.Trigger asChild>
              <button className="primary-action"><Plus /> تسجيل توريدة</button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="dialog-content compact-form-dialog" dir="rtl">
                <Dialog.Title className="dialog-title">تسجيل توريدة جديدة</Dialog.Title>
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="input-group">
                      <label>المبلغ المورد (SDG) *</label>
                      <input required type="number" min="1" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>قناة التوريد *</label>
                      <select required value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})}>
                        <option value="عمر">عمر</option>
                        <option value="سيف">سيف</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="input-group">
                      <label>طريقة الدفع *</label>
                      <select required value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        <option value="كاش">كاش</option>
                        <option value="بنكك">بنكك</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>رقم الإيصال / الإشعار *</label>
                      <input required value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} dir="ltr" style={{textAlign: 'right'}} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>ملاحظات</label>
                    <input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                  </div>
                  {formError && <div className="login-error" role="alert" style={{ marginTop: 14 }}>{formError}</div>}
                  <div className="dialog-actions">
                    <button type="submit" className="primary-action" disabled={createSettlement.isPending}>
                      {createSettlement.isPending ? <LoaderCircle className="spin" /> : 'حفظ التوريدة'}
                    </button>
                    <Dialog.Close asChild>
                      <button type="button" className="secondary-action">إلغاء</button>
                    </Dialog.Close>
                  </div>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20, padding: 20 }}>
        <div className="settlement-date-filters">
          <div className="input-group">
            <label><Calendar /> من تاريخ</label>
            <input
              type="date"
              value={dateRange.start}
              max={today}
              onChange={(event) => setDateRange((range) => ({ ...range, start: event.target.value }))}
            />
          </div>
          <div className="input-group">
            <label><Calendar /> إلى تاريخ</label>
            <input
              type="date"
              value={dateRange.end}
              min={dateRange.start || undefined}
              max={today}
              onChange={(event) => setDateRange((range) => ({ ...range, end: event.target.value }))}
            />
          </div>
        </div>
        {!isRangeValid && (
          <div className="login-error" role="alert" style={{ marginTop: 12 }}>
            اختر فترة صحيحة بحيث يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.
          </div>
        )}
      </div>

      {isPending ? (
        <div className="page-state" style={{ minHeight: '30vh' }}>
          <LoaderCircle className="spin" />
          <span>جاري تجهيز التقرير...</span>
        </div>
      ) : isError ? (
        <div className="page-state error" style={{ minHeight: '30vh' }}>
          <WalletCards />
          <span>تعذر تحميل التوريدات من الخادم.</span>
          <button type="button" className="secondary-action" onClick={() => refetch()}>
            إعادة المحاولة
          </button>
        </div>
      ) : (
      <div className="print-area report-document settlement-report">
        <div className="print-header hidden-screen">
          <BrandMark />
          <div className="print-meta">
            <h2>تقرير توريد الحصيلة</h2>
            <p>الفترة: {dateRange.start} إلى {dateRange.end}</p>
            <p>تاريخ الطباعة: {formatSettlementDate(new Date().toISOString())}</p>
          </div>
        </div>

        <section className="report-section">
          <h3 className="section-title">ملخص التوريد خلال الفترة</h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <article className="stat-card green">
              <p>إجمالي التوريدات</p>
              <strong>{formatMoney(totals.total)}</strong>
              <small>{totals.count} توريدة</small>
            </article>
            <article className="stat-card">
              <p>توريد عمر</p>
              <strong>{formatMoney(totals.omar)}</strong>
            </article>
            <article className="stat-card">
              <p>توريد سيف</p>
              <strong>{formatMoney(totals.saif)}</strong>
            </article>
            <article className="stat-card">
              <p>مدفوع كاش</p>
              <strong>{formatMoney(totals.cash)}</strong>
            </article>
            <article className="stat-card blue">
              <p>مدفوع بنكك</p>
              <strong>{formatMoney(totals.bankak)}</strong>
            </article>
          </div>
        </section>

        <div className="card print-table-container">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>قناة التوريد</th>
                  <th>طريقة الدفع</th>
                  <th>رقم الإشعار</th>
                  <th>ملاحظات</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.length > 0 ? filteredSettlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td className="number">{formatSettlementDate(settlement.createdAt)}</td>
                    <td><strong>{settlement.channel}</strong></td>
                    <td>
                      <span className={`badge ${settlement.paymentMethod === 'كاش' ? 'green' : 'blue'}`}>
                        {settlement.paymentMethod}
                      </span>
                    </td>
                    <td className="number">{settlement.reference}</td>
                    <td>{settlement.notes || '—'}</td>
                    <td className="number" style={{ color: '#317c53' }}>{formatMoney(settlement.amount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#897f8c' }}>
                      {settlements?.length ? 'لا توجد توريدات خلال الفترة المحددة.' : 'لا توجد توريدات مسجلة.'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>إجمالي الفترة</td>
                  <td className="number">{formatMoney(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
