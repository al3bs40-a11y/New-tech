import { useReducer } from 'react';
import { useCreateProduct, getGetProductsQueryKey, getGetDashboardQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Save, LoaderCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  addProductFormReducer,
  initialAddProductFormState,
} from './addProductFormState';

export function AddProductPage({ role }: { role: string }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [formState, dispatch] = useReducer(
    addProductFormReducer,
    initialAddProductFormState,
  );
  const { formData, error, notice } = formState;

  const createProduct = useCreateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        if (role === 'admin') {
          setLocation('/inventory');
        } else {
          dispatch({
            type: 'creationSucceeded',
            notice: 'تمت إضافة الصنف. سيبقى متوقفاً حتى يسجل المدير تكلفة المورد.',
          });
        }
      },
      onError: (error) => {
        dispatch({ type: 'creationFailed', serverError: error });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'submissionStarted' });
    const { payable: supplierCost, ...productDetails } = formData;
    createProduct.mutate({
      data: {
        ...productDetails,
        quantity: Number(formData.quantity),
        price: Number(formData.price),
        ...(role === 'admin' ? { payable: Number(supplierCost) } : {}),
        imei: formData.imei || null,
        serialNumber: formData.serialNumber || null,
        imageUrl: null,
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    dispatch({ type: 'fieldChanged', name, value });
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">إدارة المخزون</span>
          <h1>إضافة بضاعة جديدة</h1>
          <p>
            {role === 'admin'
              ? 'أدخل تفاصيل المنتج الجديد لإضافته للمخزون. سيتم إنشاء الباركود تلقائيًا.'
              : 'أدخل بيانات الصنف وسعر البيع؛ يسجل المدير تكلفة المورد قبل إتاحته للبيع. سيتم إنشاء الباركود تلقائيًا.'}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '30px', maxWidth: '900px' }}>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>اسم المنتج *</label>
            <input required name="name" value={formData.name} onChange={handleChange} placeholder="مثال: مكيف اسبليت" />
          </div>

          <div className="form-grid">
            <div className="input-group">
              <label>التصنيف</label>
              <select required name="category" value={formData.category} onChange={handleChange}>
                <option value="">اختر التصنيف</option>
                <option value="مكيفات">مكيفات</option>
                <option value="شاشات">شاشات</option>
                <option value="ثلاجات">ثلاجات</option>
                <option value="غسالات">غسالات</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div className="input-group">
              <label>الماركة</label>
              <input required name="brand" value={formData.brand} onChange={handleChange} placeholder="مثال: Samsung" />
            </div>
            <div className="input-group">
              <label>الموديل</label>
              <input required name="model" value={formData.model} onChange={handleChange} placeholder="مثال: AR18T" />
            </div>
          </div>

          <div className="input-group">
            <label>المواصفات</label>
            <input required name="specification" value={formData.specification} onChange={handleChange} placeholder="مثال: 18000 وحدة، انفرتر" />
          </div>

          <div className="form-grid">
            <div className="input-group">
              <label>الكمية (الرصيد الافتتاحي)</label>
              <input required type="number" min="0" name="quantity" value={formData.quantity} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>الوحدة</label>
              <select required name="unit" value={formData.unit} onChange={handleChange}>
                <option value="قطعة">قطعة</option>
                <option value="كرتونة">كرتونة</option>
                <option value="طقم">طقم</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            {role === 'admin' && (
              <div className="input-group">
                <label>تكلفة المورد - SDG</label>
                <input required type="number" min="0" name="payable" value={formData.payable} onChange={handleChange} />
              </div>
            )}
            <div className="input-group">
              <label>سعر البيع الافتراضي - SDG</label>
              <input required type="number" min="0" name="price" value={formData.price} onChange={handleChange} />
            </div>
          </div>

          <div className="form-grid">
            <div className="input-group">
              <label>رقم IMEI (اختياري)</label>
              <input name="imei" value={formData.imei} onChange={handleChange} placeholder="للهواتف والأجهزة المماثلة" />
            </div>
            <div className="input-group">
              <label>السيريال نمبر (اختياري)</label>
              <input name="serialNumber" value={formData.serialNumber} onChange={handleChange} placeholder="S/N" />
            </div>
          </div>

          {error && (
             <div className="login-error" style={{ marginTop: '10px' }}>{error}</div>
          )}
          {notice && (
            <div className="success-message" role="status" style={{ marginTop: '10px' }}>{notice}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee9f0' }}>
            <button type="submit" className="primary-action" disabled={createProduct.isPending}>
              {createProduct.isPending ? <LoaderCircle className="spin" /> : <Save />}
              حفظ وإضافة للمخزون
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
