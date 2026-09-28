import { useState } from 'react';
import { useGetExpenses, useCreateExpense, getGetExpensesQueryKey, getGetDashboardQueryKey, getGetActivitiesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ReceiptText, LoaderCircle, Plus } from 'lucide-react';
import { formatMoney, formatDate } from '../lib/utils';
import * as Dialog from '@radix-ui/react-dialog';

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const { data: expenses, isPending, isError, refetch } = useGetExpenses();
  
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({ category: '', description: '', amount: '', paymentMethod: 'كاش', beneficiary: '', reference: '' });

  const createExpense = useCreateExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() });
        setOpen(false);
        setFormData({ category: '', description: '', amount: '', paymentMethod: 'كاش', beneficiary: '', reference: '' });
        setFormError('');
        setSuccessMessage('تم تسجيل المصروف بنجاح.');
      },
      onError: (error) => {
        const response = (error as { data?: { error?: unknown } })?.data;
        setFormError(typeof response?.error === 'string' ? response.error : 'تعذر تسجيل المصروف. تحقق من البيانات والرصيد ثم حاول مجدداً.');
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');
    createExpense.mutate({
      data: {
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod as 'كاش' | 'بنكك',
        beneficiary: formData.beneficiary,
        reference: formData.reference || null,
        notes: null
      }
    });
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">الماليات</span>
          <h1>المصروفات المنصرفة</h1>
          <p>سجل المصروفات التشغيلية للمتجر وتفاصيل الدفع.</p>
        </div>
      {successMessage && <div className="success-message" role="status" style={{ marginBottom: 16 }}>{successMessage}</div>}
        
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="primary-action" onClick={() => { setFormError(''); setSuccessMessage(''); }}>
              <Plus /> تسجيل مصروف
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content compact-form-dialog" dir="rtl">
              <Dialog.Title className="dialog-title">تسجيل مصروف جديد</Dialog.Title>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="input-group">
                    <label>المبلغ (SDG) *</label>
                    <input required type="number" min="1" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>طريقة الدفع *</label>
                    <select required value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                      <option value="كاش">كاش</option>
                      <option value="بنكك">بنكك</option>
                    </select>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="input-group">
                    <label>التصنيف *</label>
                    <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="">اختر التصنيف</option>
                      <option value="نثريات">نثريات</option>
                      <option value="ضيافة">ضيافة</option>
                      <option value="إيجار">إيجار</option>
                      <option value="رواتب">رواتب وحوافز</option>
                      <option value="ترحيل">ترحيل ونقل</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>المستفيد *</label>
                    <input required value={formData.beneficiary} onChange={e => setFormData({...formData, beneficiary: e.target.value})} placeholder="اسم المستلم" />
                  </div>
                </div>
                <div className="input-group">
                  <label>البيان / الوصف *</label>
                  <input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="وصف المصروف" />
                </div>
                {formData.paymentMethod === 'بنكك' && (
                  <div className="input-group">
                    <label>رقم العملية / الإشعار</label>
                    <input required value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} dir="ltr" style={{textAlign: 'right'}} />
                  </div>
                )}
                {formError && <div className="login-error" role="alert" style={{ marginTop: 14 }}>{formError}</div>}
                <div className="dialog-actions">
                  <button type="submit" className="primary-action" disabled={createExpense.isPending}>
                    {createExpense.isPending ? <LoaderCircle className="spin" /> : 'حفظ المصروف'}
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
        ) : isError ? (
          <div className="page-state error" style={{ minHeight: '30vh' }}>
            <ReceiptText />
            <span>تعذر تحميل المصروفات من الخادم.</span>
            <button type="button" className="secondary-action" onClick={() => refetch()}>إعادة المحاولة</button>
          </div>
        ) : expenses && expenses.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>التصنيف</th>
                  <th>البيان</th>
                  <th>المستفيد</th>
                  <th>طريقة الدفع</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(ex => (
                  <tr key={ex.id}>
                    <td className="number" style={{ color: '#897f8c', fontSize: '11px' }}>{formatDate(ex.createdAt)}</td>
                    <td><span className="badge gray">{ex.category}</span></td>
                    <td>{ex.description}</td>
                    <td>{ex.beneficiary}</td>
                    <td>
                      <span className={`badge ${ex.paymentMethod === 'كاش' ? 'green' : 'blue'}`}>
                        {ex.paymentMethod}
                      </span>
                      {ex.reference && <small style={{display: 'block', color: '#999', fontSize: '9px'}}>{ex.reference}</small>}
                    </td>
                    <td className="number" style={{ color: '#a42f36' }}>{formatMoney(ex.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <ReceiptText />
            <span>لا توجد مصروفات مسجلة</span>
          </div>
        )}
      </div>
    </>
  );
}
