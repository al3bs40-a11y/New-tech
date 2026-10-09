import { useState } from 'react';
import {
  getGetActivitiesQueryKey,
  getGetDashboardQueryKey,
  getGetProductsQueryKey,
  useDeleteProduct,
  useGetProducts,
  useUpdateProduct,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, PackageSearch, Pencil, Search, Trash2 } from 'lucide-react';
import { formatMoney } from '../lib/utils';
import { getApiErrorMessage } from '../lib/apiErrorMessage.ts';
import type { Product } from '@workspace/api-client-react';
import * as Dialog from '@radix-ui/react-dialog';

type ProductEditFields = {
  name: string;
  barcode: string;
  category: string;
  brand: string;
  model: string;
  specification: string;
  unit: string;
  price: string;
  payable: string;
  imei: string;
  serialNumber: string;
};

const productCategoryOptions = ['مكيفات', 'شاشات', 'ثلاجات', 'غسالات', 'أخرى'];
const productUnitOptions = ['قطعة', 'كرتونة', 'طقم'];

export function InventoryPage({ role }: { role: string }) {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFields, setEditFields] = useState<ProductEditFields>({
    name: '',
    barcode: '',
    category: '',
    brand: '',
    model: '',
    specification: '',
    unit: 'قطعة',
    price: '',
    payable: '',
    imei: '',
    serialNumber: '',
  });
  const [editError, setEditError] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
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
      onError: (error) => setEditError(getApiErrorMessage(error, 'تعذر حفظ التعديل. حاول مرة أخرى.')),
    },
  });

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() });
        setDeleteFeedback({ type: 'success', text: 'تم حذف الصنف من المخزون.' });
        setDeletingProductId(null);
      },
      onError: (error) => {
        setDeleteFeedback({
          type: 'error',
          text: getApiErrorMessage(error, 'تعذر حذف الصنف. حاول مرة أخرى.'),
        });
        setDeletingProductId(null);
      },
    },
  });

  const toggleStatus = (product: Product) => {
    if (role !== 'admin' || !product.costKnown || deleteProduct.isPending) return;
    const newStatus = product.status === 'متوفر' ? 'متوقف' : 'متوفر';
    updateProduct.mutate({ id: product.id, data: { status: newStatus } });
  };

  const confirmDeleteProduct = (product: Product) => {
    if (role !== 'admin' || deleteProduct.isPending) return;
    const confirmed = window.confirm(
      `سيُحذف الصنف «${product.name}» مع رصيده الحالي (${product.quantity} ${product.unit}). سيرفض النظام الحذف إذا كان الصنف مرتبطاً بفواتير أو تعديلات مسجلة. هل تريد المتابعة؟`,
    );
    if (!confirmed) return;
    setDeleteFeedback(null);
    setDeletingProductId(product.id);
    deleteProduct.mutate({ id: product.id });
  };

  const beginEdit = (product: Product) => {
    setEditingProduct(product);
    setEditFields({
      name: product.name,
      barcode: product.barcode,
      category: product.category,
      brand: product.brand,
      model: product.model,
      specification: product.specification,
      unit: product.unit,
      price: String(product.price),
      payable: product.costKnown ? String(product.payable) : '',
      imei: product.imei ?? '',
      serialNumber: product.serialNumber ?? '',
    });
    setEditError('');
  };

  const updateEditField = (field: keyof ProductEditFields, value: string) => {
    setEditFields((previous) => ({ ...previous, [field]: value }));
  };

  const saveProduct = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProduct) return;
    if (
      role === 'admin' &&
      ![
        editFields.name,
        editFields.barcode,
        editFields.category,
        editFields.brand,
        editFields.model,
        editFields.specification,
        editFields.unit,
      ].every((value) => value.trim())
    ) {
      setEditError('أكمل بيانات المنتج المطلوبة.');
      return;
    }
    const price = Number(editFields.price);
    if (editFields.price.trim() === '' || !Number.isFinite(price) || price < 0) {
      setEditError('أدخل سعر بيع صحيحاً.');
      return;
    }
    if (role === 'admin') {
      const payable = Number(editFields.payable);
      if (editFields.payable.trim() === '' || !Number.isFinite(payable) || payable < 0) {
        setEditError('أدخل تكلفة المورد بشكل صحيح.');
        return;
      }
      updateProduct.mutate({
        id: editingProduct.id,
        data: {
          name: editFields.name.trim(),
          barcode: editFields.barcode.trim(),
          category: editFields.category.trim(),
          brand: editFields.brand.trim(),
          model: editFields.model.trim(),
          specification: editFields.specification.trim(),
          unit: editFields.unit.trim(),
          price,
          payable,
          imei: editFields.imei.trim() || null,
          serialNumber: editFields.serialNumber.trim() || null,
        },
      });
      return;
    }
    updateProduct.mutate({ id: editingProduct.id, data: { price } });
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">إدارة المخزون</span>
          <h1>قائمة البضاعة</h1>
          <p>
            {role === 'admin'
              ? 'عدّل بيانات الصنف كاملة دون تغيير كمية المخزون.'
              : 'تابع المخزون؛ ويمكن للبائع تعديل سعر البيع فقط.'}
          </p>
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
          <div className="dialog-viewport">
            <Dialog.Content className="dialog-content compact-form-dialog inventory-edit-dialog" dir="rtl">
              <Dialog.Title className="dialog-title">تعديل بيانات الصنف</Dialog.Title>
              {editingProduct && (
                <form onSubmit={saveProduct}>
                  <p style={{ marginTop: 0, color: '#756b7d' }}>
                    {role === 'admin'
                      ? 'يمكن تعديل بيانات الصنف هنا، وتبقى كمية المخزون كما هي.'
                      : editingProduct.name}
                  </p>
                  {role === 'admin' && (
                    <>
                      <div className="form-grid">
                        <div className="input-group">
                          <label>اسم المنتج *</label>
                          <input
                            autoFocus
                            required
                            value={editFields.name}
                            onChange={(event) => updateEditField('name', event.target.value)}
                          />
                        </div>
                        <div className="input-group">
                          <label>الباركود *</label>
                          <input
                            required
                            value={editFields.barcode}
                            onChange={(event) => updateEditField('barcode', event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-grid">
                        <div className="input-group">
                          <label>التصنيف *</label>
                          <select
                            required
                            value={editFields.category}
                            onChange={(event) => updateEditField('category', event.target.value)}
                          >
                            {!productCategoryOptions.includes(editFields.category) && (
                              <option value={editFields.category}>{editFields.category}</option>
                            )}
                            {productCategoryOptions.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        </div>
                        <div className="input-group">
                          <label>الماركة *</label>
                          <input
                            required
                            value={editFields.brand}
                            onChange={(event) => updateEditField('brand', event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-grid">
                        <div className="input-group">
                          <label>الموديل *</label>
                          <input
                            required
                            value={editFields.model}
                            onChange={(event) => updateEditField('model', event.target.value)}
                          />
                        </div>
                        <div className="input-group">
                          <label>الوحدة *</label>
                          <select
                            required
                            value={editFields.unit}
                            onChange={(event) => updateEditField('unit', event.target.value)}
                          >
                            {!productUnitOptions.includes(editFields.unit) && (
                              <option value={editFields.unit}>{editFields.unit}</option>
                            )}
                            {productUnitOptions.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>المواصفات *</label>
                        <input
                          required
                          value={editFields.specification}
                          onChange={(event) => updateEditField('specification', event.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className="form-grid">
                    <div className="input-group">
                      <label>سعر البيع (SDG) *</label>
                      <input
                        autoFocus={role !== 'admin'}
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={editFields.price}
                        onChange={(event) => updateEditField('price', event.target.value)}
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
                          value={editFields.payable}
                          onChange={(event) => updateEditField('payable', event.target.value)}
                        />
                        {!editingProduct.costKnown && (
                          <small>تسجيل التكلفة سيفتح الصنف للبيع بعد تفعيله من قائمة المخزون.</small>
                        )}
                      </div>
                    )}
                  </div>
                  {role === 'admin' && (
                    <div className="form-grid">
                      <div className="input-group">
                        <label>رقم IMEI (اختياري)</label>
                        <input
                          value={editFields.imei}
                          onChange={(event) => updateEditField('imei', event.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>السيريال نمبر (اختياري)</label>
                        <input
                          value={editFields.serialNumber}
                          onChange={(event) => updateEditField('serialNumber', event.target.value)}
                        />
                      </div>
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
          </div>
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

        {deleteFeedback && (
          <div
            className={`deletion-feedback ${deleteFeedback.type}`}
            role={deleteFeedback.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            data-testid={`status-delete-product-${deleteFeedback.type}`}
          >
            {deleteFeedback.text}
          </div>
        )}

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
                          disabled={!product.costKnown || updateProduct.isPending || deleteProduct.isPending}
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
                      <div className="table-actions">
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() => beginEdit(product)}
                          disabled={deleteProduct.isPending}
                          aria-label={`${role === 'admin' ? 'تعديل بيانات' : 'تعديل سعر'} ${product.name}`}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Pencil style={{ width: 14, height: 14 }} />
                          <span>{role === 'admin' ? 'تعديل البيانات' : 'تعديل السعر'}</span>
                        </button>
                        {role === 'admin' && (
                          <button
                            className="secondary-action destructive-action"
                            type="button"
                            onClick={() => confirmDeleteProduct(product)}
                            disabled={deleteProduct.isPending || updateProduct.isPending}
                            aria-label={`حذف الصنف ${product.name}`}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            {deletingProductId === product.id
                              ? <LoaderCircle className="spin" />
                              : <Trash2 />}
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
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