import { useState, useMemo, useRef, useEffect } from 'react';
import { useGetProducts, useCreateSale, getGetSalesQueryKey, getGetProductsQueryKey, getGetDashboardQueryKey, getGetActivitiesQueryKey, getGetCustomersQueryKey, useGetCustomers } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Plus, Minus, X, CheckCircle2, LoaderCircle, Search, PackageSearch } from 'lucide-react';
import { formatMoney } from '../lib/utils';
import type { Product, SaleItemInput } from '@workspace/api-client-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'wouter';
import { findCustomerByPhone, normalizeSudanPhone, updateCustomerSelection } from '../lib/sales/customerSelection';

interface CartItem {
  product: Product;
  quantity: number;
}

const getSaleErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string' && message.trim()) return message;
    }
    if (error instanceof Error && error.message) return error.message;
  }
  return 'تعذر إتمام البيع. راجع المخزون والدفع وبيانات العميل.';
};

export function SalesPage({ role }: { role: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const autoMatchedPhone = useRef<string | null>(null);
  const autoMatchedName = useRef<string | null>(null);
  
  // Data hooks
  const { data: products, isPending: loadingProducts } = useGetProducts({ status: 'متوفر' });
  const { data: customers } = useGetCustomers({
    query: {
      queryKey: getGetCustomersQueryKey(),
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paidCash, setPaidCash] = useState<number>(0);
  const [paidBankak, setPaidBankak] = useState<number>(0);
  const [saleError, setSaleError] = useState('');

  useEffect(() => {
    const match = findCustomerByPhone(customerPhone, customers);
    if (!match) return;
    setCustomerName(match.name);
    autoMatchedPhone.current = customerPhone;
    autoMatchedName.current = match.name;
  }, [customerPhone, customers]);
  
  // Result modal state
  const [successInvoice, setSuccessInvoice] = useState<any>(null);

  const createSale = useCreateSale({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        setSuccessInvoice(data);
        
        // Reset form
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        autoMatchedPhone.current = null;
        autoMatchedName.current = null;
        setDiscount(0);
        setPaidCash(0);
        setPaidBankak(0);
        setSaleError('');
      },
      onError: (error) => {
        setSaleError(getSaleErrorMessage(error));
      }
    }
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.includes(search) || 
      p.barcode.includes(search) || 
      p.model.includes(search)
    );
  }, [products, search]);

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return prev;
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        if (newQ > 0 && newQ <= item.product.quantity) {
          return { ...item, quantity: newQ };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = Math.max(0, subtotal - discount);
  const paymentTotal = paidCash + paidBankak;
  const overpayment = paymentTotal > total;
  const remaining = Math.max(0, total - paymentTotal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError('');
    if (cart.length === 0 || !customerName) return;
    if (paymentTotal > total) {
      setSaleError('مجموع المدفوع يتجاوز إجمالي الفاتورة.');
      return;
    }
    const normalizedPhone = normalizeSudanPhone(customerPhone);
    if (remaining > 0 && !normalizedPhone) {
      setSaleError('أدخل رقم هاتف سوداني صحيحاً للعميل عند وجود مبلغ آجل.');
      return;
    }
    if (customerName.trim() !== 'عميل نقدي' && !normalizedPhone) {
      setSaleError('أدخل رقم هاتف سوداني صحيحاً لحفظ بيانات العميل والبحث عنه لاحقاً.');
      return;
    }
    
    const items: SaleItemInput[] = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price
    }));

    createSale.mutate({
      data: {
        customerName,
        customerPhone: normalizedPhone || null,
        items,
        discount: discount || 0,
        paidCash: paidCash || 0,
        paidBankak: paidBankak || 0
      }
    });
  };

  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name);
    const selection = updateCustomerSelection(
      name,
      customers,
      customerPhone,
      autoMatchedPhone.current,
    );
    autoMatchedPhone.current = selection.autoMatchedPhone;
    autoMatchedName.current = selection.autoMatchedPhone ? name : null;
    setCustomerPhone(selection.phone);
  };

  const handleCustomerPhoneChange = (phone: string) => {
    const match = findCustomerByPhone(phone, customers);
    setCustomerPhone(phone);
    if (match) {
      setCustomerName(match.name);
      autoMatchedPhone.current = phone;
      autoMatchedName.current = match.name;
      return;
    }
    if (autoMatchedName.current && customerName === autoMatchedName.current) {
      setCustomerName('');
    }
    autoMatchedPhone.current = null;
    autoMatchedName.current = null;
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="page-kicker">نقطة البيع (POS)</span>
          <h1>المبيعات</h1>
          <p>أضف المنتجات للسلة، وحدد العميل وأكمل عملية البيع.</p>
        </div>
      </div>

      <div className="pos-layout">
        <div className="pos-products">
          <div className="global-search" style={{ width: '100%', marginBottom: '15px' }}>
            <Search />
            <input 
              placeholder="ابحث بالاسم، الموديل أو الباركود..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="products-grid">
            {loadingProducts ? (
              <div className="page-state" style={{ minHeight: '20vh', gridColumn: '1 / -1' }}>
                <LoaderCircle className="spin" />
              </div>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map(p => (
                <button 
                  key={p.id} 
                  className={`product-card ${p.quantity <= 0 ? 'out-of-stock' : ''}`}
                  onClick={() => addToCart(p)}
                  disabled={p.quantity <= 0}
                >
                  <div className="pc-top">
                    <span className="pc-brand">{p.brand}</span>
                    <span className={`badge ${p.quantity > 5 ? 'green' : p.quantity > 0 ? 'orange' : 'gray'}`}>
                      {p.quantity} {p.unit}
                    </span>
                  </div>
                  <strong>{p.name}</strong>
                  <small>{p.model}</small>
                  <div className="pc-price">{formatMoney(p.price)}</div>
                </button>
              ))
            ) : (
              <div className="page-state" style={{ minHeight: '20vh', gridColumn: '1 / -1' }}>
                <PackageSearch />
                <span>لا يوجد منتج مطابق</span>
              </div>
            )}
          </div>
        </div>

        <div className="pos-cart">
          <form onSubmit={handleSubmit} className="cart-inner">
            <h2 className="cart-title"><ShoppingCart /> سلة المشتريات</h2>
            
            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="empty-cart">
                  <ShoppingCart />
                  <p>السلة فارغة. قم بإضافة منتجات من القائمة.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div className="cart-item" key={item.product.id}>
                    <div className="ci-info">
                      <strong>{item.product.name}</strong>
                      <div className="ci-meta">
                        <span>{formatMoney(item.product.price)}</span>
                        <span>•</span>
                        <span>{item.product.model}</span>
                      </div>
                    </div>
                    <div className="ci-controls">
                      <button type="button" onClick={() => updateQuantity(item.product.id, -1)}><Minus /></button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.product.id, 1)} disabled={item.quantity >= item.product.quantity}><Plus /></button>
                    </div>
                    <div className="ci-total">{formatMoney(item.product.price * item.quantity)}</div>
                    <button type="button" className="ci-remove" onClick={() => removeFromCart(item.product.id)}><X /></button>
                  </div>
                ))
              )}
            </div>

            <div className="cart-customer">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <input 
                  required 
                  placeholder="اسم العميل *" 
                  value={customerName} 
                  onChange={e => handleCustomerNameChange(e.target.value)} 
                  list="customers-list"
                />
                <datalist id="customers-list">
                  {customers?.map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <input 
                  placeholder="رقم الهاتف" 
                  type="tel"
                  autoComplete="tel"
                  value={customerPhone} 
                  onChange={e => handleCustomerPhoneChange(e.target.value)}
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>

            <div className="cart-summary">
              <div className="summary-row">
                <span>المجموع الفرعي</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <div className="summary-row input-row">
                <span>الخصم (SDG)</span>
                <input 
                  type="number" 
                  min="0" 
                  max={subtotal} 
                  value={discount} 
                  onChange={e => setDiscount(Number(e.target.value))} 
                />
              </div>
              <div className="summary-row total">
                <span>الإجمالي</span>
                <strong>{formatMoney(total)}</strong>
              </div>
            </div>

            <div className="cart-payment">
              <div className="summary-row input-row">
                <span>دفع كاش</span>
                <input 
                  type="number" 
                  min="0" 
                  max={Math.max(0, total - paidBankak)}
                  value={paidCash} 
                  onChange={e => setPaidCash(Number(e.target.value))} 
                />
              </div>
              <div className="summary-row input-row">
                <span>دفع بنكك</span>
                <input 
                  type="number" 
                  min="0" 
                  max={Math.max(0, total - paidCash)}
                  value={paidBankak} 
                  onChange={e => setPaidBankak(Number(e.target.value))} 
                />
              </div>
              {overpayment && (
                <div className="login-error" role="alert">
                  مجموع المدفوع أكبر من إجمالي الفاتورة بمقدار {formatMoney(paymentTotal - total)}.
                </div>
              )}
              <div className="summary-row remaining">
                <span>المتبقي للعميل (آجل)</span>
                <strong>{formatMoney(remaining)}</strong>
              </div>
            </div>

            {saleError && <div className="login-error">{saleError}</div>}

            <button 
              type="submit" 
              className="checkout-btn" 
              disabled={cart.length === 0 || !customerName.trim() || overpayment || createSale.isPending}
            >
              {createSale.isPending ? <LoaderCircle className="spin" /> : <ShoppingCart />}
              إتمام البيع ({formatMoney(total)})
            </button>
          </form>
        </div>
      </div>

      <Dialog.Root open={!!successInvoice} onOpenChange={(open) => !open && setSuccessInvoice(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content invoice-modal" dir="rtl">
            <div className="invoice-success">
              <CheckCircle2 />
              <h2>تم البيع بنجاح</h2>
              <p>رقم الفاتورة: <strong dir="ltr">{successInvoice?.invoiceNumber}</strong></p>
            </div>
            
            <div className="invoice-details">
              <div className="id-row"><span>العميل:</span> <strong>{successInvoice?.customerName}</strong></div>
              <div className="id-row"><span>الإجمالي:</span> <strong>{formatMoney(successInvoice?.total)}</strong></div>
              <div className="id-row"><span>المدفوع:</span> <strong>{formatMoney((successInvoice?.paidCash || 0) + (successInvoice?.paidBankak || 0))}</strong></div>
              <div className="id-row"><span>المتبقي:</span> <strong>{formatMoney(successInvoice?.remaining)}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button className="primary-action" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.print()}>
                طباعة الفاتورة
              </button>
              <Dialog.Close asChild>
                <button type="button" className="secondary-action" style={{ flex: 1 }}>متابعة المبيعات</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <style>{`
        .pos-layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .product-card { background: #fff; border: 1px solid #ebe7ec; border-radius: 14px; padding: 14px; text-align: right; display: flex; flex-direction: column; transition: .2s; cursor: pointer; box-shadow: 0 4px 12px rgb(0 0 0 / .02); }
        .product-card:hover:not(:disabled) { border-color: #c9b9d1; transform: translateY(-2px); box-shadow: 0 6px 16px rgb(90 50 110 / .08); }
        .product-card:active:not(:disabled) { transform: translateY(0); }
        .product-card:disabled { opacity: .6; cursor: not-allowed; filter: grayscale(1); }
        .pc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .pc-brand { font-size: 10px; font-weight: 700; color: #8e8392; background: #f3eff4; padding: 3px 6px; border-radius: 6px; }
        .product-card strong { font-size: 14px; color: #2c2532; margin-bottom: 2px; line-height: 1.3; }
        .product-card small { font-size: 11px; color: #9c929f; margin-bottom: 12px; }
        .pc-price { font-weight: 800; font-size: 16px; color: #642881; font-family: Arial, sans-serif; direction: ltr; margin-top: auto; }
        
        .pos-cart { background: #fff; border: 1px solid #ebe7ec; border-radius: 16px; box-shadow: 0 8px 30px rgb(0 0 0 / .04); position: sticky; top: 90px; height: calc(100vh - 120px); display: flex; flex-direction: column; overflow: hidden; }
        .cart-inner { display: flex; flex-direction: column; height: 100%; }
        .cart-title { padding: 18px 20px; margin: 0; font-size: 16px; font-weight: 800; border-bottom: 1px solid #f1edf2; display: flex; align-items: center; gap: 8px; background: #faf9fb; }
        .cart-title svg { width: 20px; color: #7a3a9e; }
        
        .cart-items { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .empty-cart { margin: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #a9a0ac; gap: 12px; text-align: center; }
        .empty-cart svg { width: 42px; height: 42px; opacity: .4; }
        
        .cart-item { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; align-items: center; background: #fff; border: 1px solid #f1edf2; padding: 10px 12px; border-radius: 12px; }
        .ci-info { display: flex; flex-direction: column; min-width: 0; }
        .ci-info strong { font-size: 12px; color: #322b37; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ci-meta { display: flex; gap: 6px; font-size: 10px; color: #8e8392; margin-top: 3px; font-family: Arial, sans-serif; }
        .ci-controls { display: flex; align-items: center; gap: 8px; background: #f7f6f8; border-radius: 8px; padding: 4px; }
        .ci-controls button { width: 22px; height: 22px; display: grid; place-items: center; border: 0; background: #fff; border-radius: 6px; color: #433946; box-shadow: 0 1px 3px rgba(0,0,0,.1); transition: .15s; }
        .ci-controls button:disabled { opacity: .4; cursor: not-allowed; }
        .ci-controls button:active:not(:disabled) { transform: scale(.95); }
        .ci-controls button svg { width: 12px; }
        .ci-controls span { font-size: 12px; font-weight: 700; font-family: Arial, sans-serif; width: 16px; text-align: center; }
        .ci-total { font-size: 13px; font-weight: 800; font-family: Arial, sans-serif; color: #322b37; direction: ltr; min-width: 60px; text-align: center; }
        .ci-remove { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: #fff0ee; color: #c43228; border-radius: 7px; transition: .2s; }
        .ci-remove:hover { background: #ffe1de; }
        .ci-remove svg { width: 14px; }
        
        .cart-customer { padding: 15px; border-top: 1px solid #f1edf2; display: flex; gap: 10px; }
        .cart-customer .input-group { flex: 1; }
        .cart-customer input { height: 42px; font-size: 12px; }
        
        .cart-summary { padding: 15px; background: #fbfafc; border-top: 1px solid #f1edf2; display: flex; flex-direction: column; gap: 10px; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .summary-row strong { font-family: Arial, sans-serif; direction: ltr; }
        .summary-row.total { margin-top: 5px; padding-top: 10px; border-top: 1px dashed #dcd7df; font-size: 16px; color: #642881; }
        
        .input-row input { width: 100px; height: 32px; border: 1px solid #dcd7df; border-radius: 6px; padding: 0 10px; font-family: Arial, sans-serif; font-size: 13px; text-align: left; }
        .input-row input:focus { border-color: #7a3a9e; outline: none; }
        
        .cart-payment { padding: 15px; background: #fff; border-top: 1px solid #f1edf2; display: flex; flex-direction: column; gap: 10px; }
        .remaining { margin-top: 5px; padding-top: 10px; border-top: 1px solid #f1edf2; color: #a42f36; font-weight: 700; }
        
        .checkout-btn { margin: 15px; height: 50px; border: 0; background: linear-gradient(135deg, #7a3a9e, #582175); color: #fff; border-radius: 12px; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; transition: .2s; box-shadow: 0 6px 20px rgb(90 35 115 / .2); }
        .checkout-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgb(90 35 115 / .3); }
        .checkout-btn:disabled { opacity: .6; cursor: not-allowed; }
        
        .invoice-modal { text-align: center; }
        .invoice-success { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 25px; }
        .invoice-success svg { width: 64px; height: 64px; color: #317c53; margin-bottom: 5px; }
        .invoice-success h2 { margin: 0; font-size: 24px; color: #2c2532; }
        .invoice-success p { margin: 0; color: #8e8392; font-size: 14px; }
        .invoice-details { background: #fbfafc; border: 1px solid #f1edf2; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 10px; text-align: right; }
        .id-row { display: flex; justify-content: space-between; font-size: 14px; }
        .id-row span { color: #6a5f6e; }
        .id-row strong { color: #2c2532; font-family: Arial, sans-serif; direction: ltr; }
        
        @media (max-width: 1050px) {
          .pos-layout { grid-template-columns: 1fr; }
          .pos-cart { height: auto; position: static; }
          .cart-items { max-height: 40vh; }
        }
      `}</style>
    </>
  );
}
