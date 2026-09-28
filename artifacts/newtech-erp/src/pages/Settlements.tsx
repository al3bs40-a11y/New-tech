import { useState } from 'react';
import { useGetSettlements, useCreateSettlement, getGetSettlementsQueryKey, getGetDashboardQueryKey, getGetActivitiesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletCards, LoaderCircle, Plus } from 'lucide-react';
import { formatMoney, formatDate } from '../lib/utils';
import * as Dialog from '@radix-ui/react-dialog';

export function SettlementsPage() {
  const queryClient = useQueryClient();
  const { data: settlements, isPending } = useGetSettlements();
  
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({ channel: 'عمر', paymentMethod: 'بنكك', amount: '', reference: '', notes: '' });

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

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">الماليات</span>
          <h1>توريد الحصيلة</h1>
          <p>سجل المبالغ الموردة عبر القنوات المعتمدة.</p>
        </div>
        
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

      <div className="card">
        {isPending ? (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <LoaderCircle className="spin" />
          </div>
        ) : settlements && settlements.length > 0 ? (
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
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td className="number" style={{ color: '#897f8c', fontSize: '11px' }}>{formatDate(s.createdAt)}</td>
                    <td><strong>{s.channel}</strong></td>
                    <td>
                      <span className={`badge ${s.paymentMethod === 'كاش' ? 'green' : 'blue'}`}>
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td className="number" style={{ fontSize: '11px' }}>{s.reference}</td>
                    <td>{s.notes || '—'}</td>
                    <td className="number" style={{ color: '#317c53' }}>{formatMoney(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <WalletCards />
            <span>لا توجد توريدات مسجلة</span>
          </div>
        )}
      </div>
    </>
  );
}
