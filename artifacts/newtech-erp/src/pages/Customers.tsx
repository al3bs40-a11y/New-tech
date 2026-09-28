import { useState } from 'react';
import { useGetCustomers, useCreateCustomer, getGetCustomersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Users, LoaderCircle, Plus, Search } from 'lucide-react';
import { formatMoney } from '../lib/utils';
import * as Dialog from '@radix-ui/react-dialog';

export function CustomersPage({ role }: { role: string }) {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { data: customers, isPending } = useGetCustomers();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', notes: '' });

  const createCustomer = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        setOpen(false);
        setFormData({ name: '', phone: '', address: '', notes: '' });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomer.mutate({
      data: {
        ...formData,
        address: formData.address || null,
        notes: formData.notes || null,
      }
    });
  };

  const filtered = (customers || []).filter(c => 
    c.name.includes(search) || c.phone.includes(search)
  );

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">دليل العملاء</span>
          <h1>العملاء</h1>
          <p>قائمة العملاء، أرقام التواصل، وحساباتهم.</p>
        </div>
        
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="primary-action"><Plus /> إضافة عميل</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" dir="rtl">
              <Dialog.Title className="dialog-title">إضافة عميل جديد</Dialog.Title>
              <form onSubmit={handleSubmit}>
                <div className="input-group">
                  <label>اسم العميل *</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="الاسم الكامل" />
                </div>
                <div className="input-group">
                  <label>رقم الهاتف *</label>
                  <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="0900000000" dir="ltr" style={{textAlign: 'right'}} />
                </div>
                <div className="input-group">
                  <label>العنوان</label>
                  <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="مثال: الخرطوم، شارع الستين" />
                </div>
                <div className="input-group">
                  <label>ملاحظات</label>
                  <input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                  <button type="submit" className="primary-action" disabled={createCustomer.isPending}>
                    {createCustomer.isPending ? <LoaderCircle className="spin" /> : 'حفظ'}
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
        <div className="panel-heading" style={{ padding: '20px', borderBottom: '1px solid #eee9f0', marginBottom: 0 }}>
          <div className="global-search" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
            <Search />
            <input 
              placeholder="ابحث بالاسم أو رقم الهاتف..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isPending ? (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <LoaderCircle className="spin" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>رقم الهاتف</th>
                  <th>العنوان</th>
                  <th>إجمالي المشتريات</th>
                  <th>الرصيد المتبقي (عليه)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td className="number" style={{ color: '#685f6e' }}>{c.phone}</td>
                    <td>{c.address || '—'}</td>
                    <td className="number">{formatMoney(c.totalPurchases)}</td>
                    <td className="number">
                      <span className={`badge ${c.balance > 0 ? 'orange' : 'gray'}`}>
                        {formatMoney(c.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <Users />
            <span>لا يوجد عملاء</span>
          </div>
        )}
      </div>
    </>
  );
}
