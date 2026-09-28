import { useState } from 'react';
import { useGetProducts, useUpdateProduct, getGetProductsQueryKey, getGetDashboardQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Boxes, LoaderCircle, PackageSearch, Pencil, Search } from 'lucide-react';
import { formatMoney } from '../lib/utils';
import type { Product } from '@workspace/api-client-react';
import * as Dialog from '@radix-ui/react-dialog';

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
}

export function InventoryPage({ role }: { role: string }) {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editPayable, setEditPayable] = useState('');
  const [editError, setEditError] = useState('');
  const queryClient = useQueryClient();
  const { data: products, isPending } = useGetProducts({ search });

  const updateProduct = useUpdateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setEditingProduct(null);
        setEditError('');
      },
      onError: (error) => setEditError(getErrorMessage(error, 'تعذر حفظ التعديل. حاول مرة أخرى.')),
    },
  });

  const toggleStatus = (product: Product) => {
    if (role !== 'admin' || !product.costKnown) return;
    const newStatus = product.status === 'متوفر' ? 'متوقف' : 'متوفر';
    updateProduct.mutate({ id: product.id, data: { status: newStatus } });
  };

  const beginEdit = (product: Product) => {
    setEditingProduct(product);
    setEditPrice(String(product.price));
    setEditPayable(product.costKnown ? String(product.payable) : '');
    setEditError('');
  };

  const saveProduct = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProduct) return;
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 0) {
      setEditError('أدخل سعر بيع صحيحاً.');
      return;
    }
    const data = role === 'admin'
      ? {
          price,
          payable: Number(editPayable),
        }
      : { price };
    updateProduct.mutate({ id: editingProduct.id, data });
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">إدارة المخزون</span>
          <h1>قائمة البضاعة</h1>
          <p>تابع حالة المخزون والكميات والأسعار، وعدّل سعر البيع عند الحاجة.</p>
        </div>
      </div>

      <Dialog.Root
        open={Boolean(editingProduct)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
            setEditError('');
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content compact-form-dialog inventory-edit-dialog" dir="rtl">
            <Dialog.Title className="dialog-title">تعديل بيانات الصنف</Dialog.Title>
            {editingProduct && (
              <form onSubmit={saveProduct}>
                <p style={{ marginTop: 0, color: '#756b7d' }}>{editingProduct.name}</p>
                <div className="input-group">
                  <label>سعر البيع (SDG) *</label>
                  <input
                    autoFocus
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPrice}
                    onChange={(event) => setEditPrice(event.target.value)}
                  />
                </div>
                {role === 'admin' && (
                  <div className="input-group">
                    <label>تكلفة المورد (SDG) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPayable}
                      onChange={(event) => setEditPayable(event.target.value)}
                    />
                    {!editingProduct.costKnown && (
                      <small>تسجيل التكلفة سيفتح الصنف للبيع بعد تفعيله من قائمة المخزون.</small>
                    )}
                  </div>
                )}
                {editError && <div className="login-error" role="alert" style={{ marginTop: 12 }}>{editError}</div>}
                <div className="dialog-actions">
                  <button type="submit" className="primary-action" disabled={updateProduct.isPending}>
                    {updateProduct.isPending ? <LoaderCircle className="spin" /> : 'حفظ التعديل'}
                  </button>
                  <Dialog.Close asChild>
                    <button type="button" className="secondary-action">إلغاء</button>
                  </Dialog.Close>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="card">
        <div className="panel-heading" style={{ padding: '20px', borderBottom: '1px solid #eee9f0', marginBottom: 0 }}>
          <div className="global-search" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
            <Search />
            <input
              placeholder="ابحث بالاسم، الماركة، أو الموديل..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {isPending ? (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <LoaderCircle className="spin" />
            <span>جاري تحميل المخزون...</span>
          </div>
        ) : products && products.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الباركود</th>
                  <th>التصنيف</th>
                  <th>الماركة</th>
                  <th>الموديل</th>
                  <th>الكمية</th>
                  <th>سعر البيع</th>
                  {role === 'admin' && <th>التكلفة (المورد)</th>}
                  {role === 'admin' && <th>الربح</th>}
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: 13, color: '#2c2632' }}>{product.name}</strong>
                        <small style={{ color: '#897f8c', fontSize: 10 }}>{product.specification}</small>
                      </div>
                    </td>
                    <td>{product.barcode}</td>
                    <td>{product.category}</td>
                    <td>{product.brand}</td>
                    <td>{product.model}</td>
                    <td className="number">
                      <span className={`badge ${product.quantity > 5 ? 'green' : product.quantity > 0 ? 'orange' : 'gray'}`}>
                        {product.quantity} {product.unit}
                      </span>
                    </td>
                    <td className="number">{formatMoney(product.price)}</td>
                    {role === 'admin' && (
                      <td className="number">
                        {product.costKnown ? formatMoney(product.payable) : <span className="badge orange">غير مسجلة</span>}
                      </td>
                    )}
                    {role === 'admin' && (
                      <td className="number" style={{ color: '#317c53' }}>
                        {product.costKnown ? formatMoney(product.profit) : '—'}
                      </td>
                    )}
                    <td>
                      {role === 'admin' ? (
                        <button
                          className={`badge ${product.costKnown && product.status === 'متوفر' ? 'blue' : 'gray'}`}
                          style={{ border: 0, cursor: product.costKnown ? 'pointer' : 'not-allowed' }}
                          onClick={() => toggleStatus(product)}
                          disabled={!product.costKnown || updateProduct.isPending}
                          title={!product.costKnown ? 'سجل تكلفة المورد أولاً' : undefined}
                        >
                          {!product.costKnown ? 'يحتاج تكلفة' : product.status === 'متوفر' ? 'متوفر' : 'متوقف'}
                        </button>
                      ) : (
                        <span className={`badge ${product.costKnown && product.status === 'متوفر' ? 'blue' : 'gray'}`}>
                          {!product.costKnown ? 'بانتظار تكلفة المدير' : product.status === 'متوفر' ? 'متوفر' : 'متوقف'}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() => beginEdit(product)}
                        aria-label={`تعديل سعر ${product.name}`}
                      >
                        <Pencil style={{ width: 14, height: 14 }} />
                        <span>تعديل السعر</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <PackageSearch />
            <span>لا توجد منتجات تطابق بحثك</span>
          </div>
        )}
      </div>
    </>
  );
}