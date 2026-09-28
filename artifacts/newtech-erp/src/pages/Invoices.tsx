import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getSaleDetails,
  requestUploadUrl,
  useCreateSaleAdjustment,
  useGetProducts,
  useGetSales,
} from '@workspace/api-client-react';
import type { SaleDetail } from '@workspace/api-client-react';
import {
  ArrowLeft,
  Eye,
  FileText,
  ImagePlus,
  LoaderCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { formatMoney, formatDate } from '../lib/utils';
import { BrandMark } from '../components/layout/BrandMark';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

type AdjustmentKind = 'return' | 'exchange';
type SettlementMethod = 'كاش' | 'بنكك' | 'رصيد';
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const withinReturnWindow = (createdAt: string) => {
  const age = Date.now() - new Date(createdAt).getTime();
  return age >= 0 && age <= 3 * 24 * 60 * 60 * 1000;
};

export function InvoicesPage({ role }: { role: string }) {
  const [search, setSearch] = useState('');
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [invoiceToPrint, setInvoiceToPrint] = useState<SaleDetail | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleDetail | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<number | null>(null);
  const [adjustmentKind, setAdjustmentKind] = useState<AdjustmentKind | null>(null);
  const [adjustmentItemId, setAdjustmentItemId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [replacementProductId, setReplacementProductId] = useState('');
  const [replacementQuantity, setReplacementQuantity] = useState('1');
  const [settlementMethod, setSettlementMethod] = useState<SettlementMethod>('كاش');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [adjustmentError, setAdjustmentError] = useState('');
  const [adjustmentNotice, setAdjustmentNotice] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const queryClient = useQueryClient();
  const adjustmentMutation = useCreateSaleAdjustment();
  const { data: products } = useGetProducts({ status: 'متوفر' });
  const { data: sales, isPending } = useGetSales();
  const availableProducts = (products || []).filter(
    (product) => product.status === 'متوفر' && product.quantity > 0,
  );
  
  const filtered = (sales || []).filter(s => 
    s.invoiceNumber.includes(search) || 
    s.customerName.includes(search) ||
    (s.employeeName && s.employeeName.includes(search))
  );

  const handlePrint = async (id: number) => {
    setPrintingId(id);
    try {
      const invoice = await getSaleDetails(id);
      setInvoiceToPrint(invoice);
      setTimeout(() => window.print(), 150);
    } finally {
      setPrintingId(null);
    }
  };

  const handleView = async (id: number) => {
    setLoadingInvoiceId(id);
    setAdjustmentKind(null);
    setAdjustmentError('');
    setAdjustmentNotice('');
    try {
      setSelectedInvoice(await getSaleDetails(id));
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const startAdjustment = (kind: AdjustmentKind, itemId: number) => {
    const item = selectedInvoice?.items.find((line) => line.id === itemId);
    if (!item) return;
    const available = Math.max(0, item.quantity - item.returnedQuantity);
    setAdjustmentItemId(itemId);
    setAdjustmentKind(kind);
    setQuantity(String(Math.min(1, available)));
    setReplacementProductId('');
    setReplacementQuantity(String(Math.min(1, available)));
    setSettlementMethod('كاش');
    setProofFile(null);
    setAdjustmentError('');
    setAdjustmentNotice('');
  };

  const closeInvoiceDialog = (open: boolean) => {
    if (!open) {
      setSelectedInvoice(null);
      setAdjustmentKind(null);
      setAdjustmentError('');
      setProofFile(null);
    }
  };

  const adjustmentItem = selectedInvoice?.items.find(
    (item) => item.id === adjustmentItemId,
  );
  const adjustmentQuantity = Number(quantity) || 0;
  const discountPerUnit =
    selectedInvoice && adjustmentItem && selectedInvoice.subtotal > 0
      ? (selectedInvoice.discount *
          (adjustmentItem.lineTotal / selectedInvoice.subtotal)) /
        adjustmentItem.quantity
      : 0;
  const returnValue =
    adjustmentItem && adjustmentQuantity > 0
      ? roundMoney(
          Math.max(
            0,
            adjustmentQuantity * (adjustmentItem.unitPrice - discountPerUnit),
          ),
        )
      : 0;
  const debtReduction = Math.min(returnValue, selectedInvoice?.remaining ?? 0);
  const replacementProduct = availableProducts.find(
    (product) => String(product.id) === replacementProductId,
  );
  const replacementValue = roundMoney(
    (replacementProduct?.price ?? 0) * (Number(replacementQuantity) || 0),
  );
  const replacementCredit = Math.max(0, returnValue - debtReduction);
  const exchangeDifference = roundMoney(replacementValue - replacementCredit);
  const hasReplacementSelection =
    adjustmentKind !== 'exchange' || Boolean(replacementProduct);
  const settlementDelta =
    !hasReplacementSelection
      ? 0
      : adjustmentKind === 'return'
      ? -roundMoney(returnValue - debtReduction)
      : exchangeDifference;
  const settlementChoices: SettlementMethod[] =
    settlementDelta > 0
      ? ['كاش', 'بنكك']
      : selectedInvoice?.customerPhone
        ? ['كاش', 'بنكك', 'رصيد']
        : ['كاش', 'بنكك'];
  const effectiveSettlementMethod = settlementChoices.includes(settlementMethod)
    ? settlementMethod
    : settlementChoices[0];
  const refundAmount = Math.max(0, -settlementDelta);
  const requiresProof =
    refundAmount > 0 &&
    (effectiveSettlementMethod === 'كاش' ||
      effectiveSettlementMethod === 'بنكك');
  const adjustedInvoiceTotal = selectedInvoice
    ? roundMoney(
        selectedInvoice.total +
          selectedInvoice.adjustments.reduce(
            (sum, adjustment) =>
              sum + adjustment.replacementValue - adjustment.returnValue,
            0,
          ),
      )
    : 0;
  const netInvoicePaid = selectedInvoice
    ? Math.max(0, roundMoney(adjustedInvoiceTotal - selectedInvoice.remaining))
    : 0;

  const handleAdjustmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInvoice || !adjustmentItem || !adjustmentKind) return;
    const quantityValue = Number(quantity);
    const availableToReturn = adjustmentItem.quantity - adjustmentItem.returnedQuantity;
    if (
      !Number.isFinite(quantityValue) ||
      quantityValue <= 0 ||
      quantityValue > availableToReturn
    ) {
      setAdjustmentError('الكمية غير صالحة أو تتجاوز المتاح للاسترجاع');
      return;
    }
    if (
      adjustmentKind === 'exchange' &&
      (!replacementProduct || Number(replacementQuantity) <= 0)
    ) {
      setAdjustmentError('اختر المنتج البديل والكمية');
      return;
    }

    let refundProofPath: string | null = null;
    if (requiresProof) {
      if (!proofFile) {
        setAdjustmentError('أرفق صورة إشعار رد المبلغ قبل الحفظ');
        return;
      }
      if (
        proofFile.size > MAX_RECEIPT_BYTES ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(proofFile.type)
      ) {
        setAdjustmentError('اختر صورة JPG أو PNG أو WebP لا تتجاوز 10 ميغابايت');
        return;
      }
    }

    setSavingAdjustment(true);
    setAdjustmentError('');
    try {
      if (requiresProof && proofFile) {
        const upload = await requestUploadUrl({
          name: proofFile.name || 'receipt-image',
          size: proofFile.size,
          contentType: proofFile.type as 'image/jpeg' | 'image/png' | 'image/webp',
        });
        const uploaded = await fetch(upload.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': proofFile.type },
          body: proofFile,
        });
        if (!uploaded.ok) throw new Error('تعذر رفع صورة إشعار الرد');
        refundProofPath = upload.objectPath;
      }

      await adjustmentMutation.mutateAsync({
        id: selectedInvoice.id,
        data: {
          requestId: crypto.randomUUID(),
          saleItemId: adjustmentItem.id,
          kind: adjustmentKind,
          quantity: quantityValue,
          settlementMethod:
            settlementDelta === 0 ? null : effectiveSettlementMethod,
          refundProofPath,
          replacementProductId:
            adjustmentKind === 'exchange' ? replacementProduct!.id : null,
          replacementQuantity:
            adjustmentKind === 'exchange'
              ? Number(replacementQuantity)
              : null,
        },
      });
      await queryClient.invalidateQueries();
      setSelectedInvoice(await getSaleDetails(selectedInvoice.id));
      setAdjustmentKind(null);
      setProofFile(null);
      setAdjustmentNotice(
        adjustmentKind === 'return'
          ? 'تم تسجيل الاسترجاع وتحديث الرصيد'
          : 'تم تسجيل الاستبدال وتحديث الحساب والمخزون',
      );
    } catch (error) {
      setAdjustmentError(
        error instanceof Error ? error.message : 'تعذر حفظ العملية',
      );
    } finally {
      setSavingAdjustment(false);
    }
  };

  useEffect(() => {
    const clearPrintInvoice = () => setInvoiceToPrint(null);
    window.addEventListener('afterprint', clearPrintInvoice);
    return () => window.removeEventListener('afterprint', clearPrintInvoice);
  }, []);

  return (
    <>
      <div className="page-title-row no-print">
        <div>
          <span className="page-kicker">سجل المبيعات</span>
          <h1>الفواتير</h1>
          <p>استعرض الفواتير السابقة وتفاصيل الدفع والعملاء.</p>
        </div>
      </div>

      <div className="card no-print">
        <div className="panel-heading" style={{ padding: '20px', borderBottom: '1px solid #eee9f0', marginBottom: 0 }}>
          <div className="global-search" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
            <Search />
            <input 
              placeholder="ابحث برقم الفاتورة أو اسم العميل..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isPending ? (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <LoaderCircle className="spin" />
            <span>جاري تحميل الفواتير...</span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>طباعة</th>
                  <th style={{ width: '60px' }}>تفاصيل</th>
                  <th>رقم الفاتورة</th>
                  <th>التاريخ</th>
                  <th>العميل</th>
                  <th>طريقة الدفع</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>المتبقي (آجل)</th>
                  <th>البائع</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <button 
                        className="icon-button invoice-print-button" 
                        title="طباعة الفاتورة" 
                        aria-label={`طباعة الفاتورة ${s.invoiceNumber}`}
                        onClick={() => handlePrint(s.id)}
                        disabled={printingId !== null}
                      >
                        {printingId === s.id ? <LoaderCircle className="spin" style={{ width: 14 }} /> : <Printer style={{ width: 14 }} />}
                      </button>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        title="تفاصيل الاسترجاع والاستبدال"
                        aria-label={`تفاصيل الفاتورة ${s.invoiceNumber}`}
                        onClick={() => handleView(s.id)}
                        disabled={loadingInvoiceId !== null}
                      >
                        {loadingInvoiceId === s.id ? (
                          <LoaderCircle className="spin" style={{ width: 14 }} />
                        ) : (
                          <Eye style={{ width: 14 }} />
                        )}
                      </button>
                    </td>
                    <td><strong style={{ fontSize: '13px', direction: 'ltr', display: 'inline-block' }}>{s.invoiceNumber}</strong></td>
                    <td className="number" style={{ color: '#897f8c', fontSize: '11px' }}>{formatDate(s.createdAt)}</td>
                    <td>{s.customerName}</td>
                    <td>
                      <span className={`badge ${s.paymentMethod === 'كاش' ? 'green' : s.paymentMethod === 'بنكك' ? 'blue' : s.paymentMethod === 'آجل' ? 'gray' : 'orange'}`}>
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td className="number">{formatMoney(s.adjustedTotal)}</td>
                    <td className="number" style={{ color: '#317c53' }}>{formatMoney(s.netPaid)}</td>
                    <td className="number">
                      {s.remaining > 0 ? <span className="badge orange">{formatMoney(s.remaining)}</span> : '—'}
                    </td>
                    <td>{s.employeeName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="page-state" style={{ minHeight: '30vh' }}>
            <FileText />
            <span>لا توجد فواتير مطابقة</span>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedInvoice)} onOpenChange={closeInvoiceDialog}>
        <DialogContent
          className="dialog-content compact-form-dialog invoice-adjustment-dialog"
          dir="rtl"
          style={{ maxWidth: 760 }}
        >
          <DialogHeader>
            <DialogTitle>
              {adjustmentKind
                ? adjustmentKind === 'return'
                  ? 'استرجاع صنف'
                  : 'استبدال صنف'
                : `تفاصيل الفاتورة ${selectedInvoice?.invoiceNumber ?? ''}`}
            </DialogTitle>
            <DialogDescription>
              {adjustmentKind
                ? 'يُسجل الصنف المرتجع كتالف ولا يعود إلى المخزون المتاح للبيع.'
                : 'راجع الأصناف والعمليات السابقة، أو ابدأ استرجاعاً أو استبدالاً.'}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <>
              {adjustmentNotice && !adjustmentKind && (
                <div className="badge green" role="status" style={{ padding: 10 }}>
                  {adjustmentNotice}
                </div>
              )}

              {adjustmentKind && adjustmentItem ? (
                <form onSubmit={handleAdjustmentSubmit} style={{ display: 'grid', gap: 14 }}>
                  <div style={{ padding: 12, background: '#f8f6fa', borderRadius: 10 }}>
                    <strong>{adjustmentItem.productName}</strong>
                    <div style={{ marginTop: 5, color: '#756b7a', fontSize: 13 }}>
                      الكمية الأصلية: {adjustmentItem.quantity} — سبق استرجاع:{' '}
                      {adjustmentItem.returnedQuantity} — المتاح:{' '}
                      {Math.max(0, adjustmentItem.quantity - adjustmentItem.returnedQuantity)}
                    </div>
                  </div>

                  <label className="form-group" style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <span>الكمية المراد {adjustmentKind === 'return' ? 'استرجاعها' : 'استبدالها'}</span>
                    <input
                      type="number"
                      min="0.01"
                      max={Math.max(0, adjustmentItem.quantity - adjustmentItem.returnedQuantity)}
                      step="0.01"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      style={{ width: '100%', padding: '9px 10px', border: '1px solid #d8d2dc', borderRadius: 8 }}
                      required
                    />
                  </label>

                  {adjustmentKind === 'exchange' && (
                    <>
                      <label className="form-group" style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                        <span>المنتج البديل المتاح</span>
                        <select
                          value={replacementProductId}
                          onChange={(event) => setReplacementProductId(event.target.value)}
                          style={{ width: '100%', padding: '9px 10px', border: '1px solid #d8d2dc', borderRadius: 8, background: '#fff' }}
                          required
                        >
                          <option value="">اختر المنتج</option>
                          {availableProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} — متاح {product.quantity} — {formatMoney(product.price)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-group" style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                        <span>كمية المنتج البديل</span>
                        <input
                          type="number"
                          min="0.01"
                          max={replacementProduct?.quantity ?? undefined}
                          step="0.01"
                          value={replacementQuantity}
                          onChange={(event) => setReplacementQuantity(event.target.value)}
                          style={{ width: '100%', padding: '9px 10px', border: '1px solid #d8d2dc', borderRadius: 8 }}
                          required
                        />
                      </label>
                    </>
                  )}

                  <div style={{ border: '1px solid #e8e2ec', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>قيمة الصنف المرتجع بعد الخصم</span>
                      <strong>{formatMoney(returnValue)}</strong>
                    </div>
                    {adjustmentKind === 'return' ? (
                      <p style={{ margin: '8px 0 0', color: '#756b7a', fontSize: 13 }}>
                        {refundAmount > 0
                          ? `المبلغ المطلوب رده: ${formatMoney(refundAmount)}`
                          : `سيُخصم ${formatMoney(debtReduction)} من المبلغ الآجل دون رد نقدي.`}
                      </p>
                    ) : !replacementProduct ? (
                      <p style={{ margin: '8px 0 0', color: '#756b7a', fontSize: 13 }}>
                        اختر المنتج البديل لمعرفة فرق السعر.
                      </p>
                    ) : (
                      <p style={{ margin: '8px 0 0', color: '#756b7a', fontSize: 13 }}>
                        قيمة البديل: {formatMoney(replacementValue)} —{' '}
                        {settlementDelta > 0
                          ? `المطلوب تحصيله: ${formatMoney(settlementDelta)}`
                          : settlementDelta < 0
                            ? `المطلوب رده: ${formatMoney(Math.abs(settlementDelta))}`
                            : 'لا يوجد فرق سعر'}
                      </p>
                    )}
                  </div>

                  {settlementDelta !== 0 && (
                    <label className="form-group" style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <span>
                        {settlementDelta > 0
                          ? 'طريقة تحصيل الفرق'
                          : 'طريقة رد المبلغ'}
                      </span>
                      <select
                        value={effectiveSettlementMethod}
                        onChange={(event) =>
                          setSettlementMethod(event.target.value as SettlementMethod)
                        }
                        style={{ width: '100%', padding: '9px 10px', border: '1px solid #d8d2dc', borderRadius: 8, background: '#fff' }}
                      >
                        {settlementChoices.map((method) => (
                          <option key={method} value={method}>
                            {method === 'رصيد'
                              ? 'إضافة رصيد للعميل'
                              : method}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {requiresProof && (
                    <label className="form-group" style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <span>
                        <ImagePlus size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
                        صورة إشعار رد المبلغ (مطلوبة)
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        required
                        onChange={(event) =>
                          setProofFile(event.target.files?.[0] ?? null)
                        }
                        style={{ width: '100%', padding: '9px 10px', border: '1px solid #d8d2dc', borderRadius: 8, background: '#fff' }}
                      />
                      <small>JPG أو PNG أو WebP، بحد أقصى 10 ميغابايت.</small>
                    </label>
                  )}

                  {adjustmentError && (
                    <p role="alert" style={{ color: '#a42f36', margin: 0 }}>
                      {adjustmentError}
                    </p>
                  )}
                  <div className="invoice-adjustment-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentKind(null);
                        setAdjustmentError('');
                        setProofFile(null);
                      }}
                      disabled={savingAdjustment}
                      style={{ border: '1px solid #d8cce2', background: '#fff', color: '#5c386c', borderRadius: 8, padding: '9px 12px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <ArrowLeft size={15} /> رجوع للفاتورة
                    </button>
                    <button
                      type="submit"
                      disabled={savingAdjustment}
                      style={{ border: 0, background: '#633b78', color: '#fff', borderRadius: 8, padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, cursor: 'pointer', opacity: savingAdjustment ? 0.7 : 1 }}
                    >
                      {savingAdjustment ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : adjustmentKind === 'return' ? (
                        <RotateCcw size={16} />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      {savingAdjustment
                        ? 'جارٍ الحفظ...'
                        : adjustmentKind === 'return'
                          ? 'تأكيد الاسترجاع'
                          : 'تأكيد الاستبدال'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div className="invoice-details">
                    <div className="invoice-box">
                      <span className="box-label">العميل</span>
                      <strong>{selectedInvoice.customerName}</strong>
                      {selectedInvoice.customerPhone && (
                        <p dir="ltr" style={{ textAlign: 'right' }}>
                          {selectedInvoice.customerPhone}
                        </p>
                      )}
                    </div>
                    <div className="invoice-box">
                      <span className="box-label">الحساب الحالي</span>
                      <p>الإجمالي الأصلي: <strong>{formatMoney(selectedInvoice.total)}</strong></p>
                      <p>الإجمالي بعد التعديلات: <strong>{formatMoney(adjustedInvoiceTotal)}</strong></p>
                      <p>المدفوع فعلياً: <strong>{formatMoney(netInvoicePaid)}</strong></p>
                      <p>المتبقي: <strong>{formatMoney(selectedInvoice.remaining)}</strong></p>
                      {selectedInvoice.creditApplied > 0 && (
                        <p>رصيد مستخدم: <strong>{formatMoney(selectedInvoice.creditApplied)}</strong></p>
                      )}
                    </div>
                  </div>

                  {!withinReturnWindow(selectedInvoice.createdAt) && (
                    <p className="badge orange" style={{ padding: 10 }}>
                      انتهت مهلة الاسترجاع والاستبدال المحددة بثلاثة أيام.
                    </p>
                  )}

                  <div style={{ display: 'grid', gap: 10 }}>
                    {selectedInvoice.items.map((item) => {
                      const availableToReturn = Math.max(
                        0,
                        item.quantity - item.returnedQuantity,
                      );
                      const canAdjust =
                        withinReturnWindow(selectedInvoice.createdAt) &&
                        availableToReturn > 0;
                      return (
                        <div
                          key={item.id}
                          style={{
                            border: '1px solid #e8e2ec',
                            borderRadius: 10,
                            padding: 12,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 14,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <strong>{item.productName}</strong>
                            <div style={{ color: '#756b7a', fontSize: 13, marginTop: 4 }}>
                              {item.quantity} × {formatMoney(item.unitPrice)} — مرتجع:{' '}
                              {item.returnedQuantity} — المتاح: {availableToReturn}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              disabled={!canAdjust}
                              onClick={() => startAdjustment('return', item.id)}
                              style={{ border: '1px solid #d8cce2', background: '#fff', color: '#5c386c', borderRadius: 8, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: canAdjust ? 'pointer' : 'not-allowed', opacity: canAdjust ? 1 : 0.5 }}
                            >
                              <RotateCcw size={15} /> استرجاع
                            </button>
                            <button
                              type="button"
                              disabled={!canAdjust || availableProducts.length === 0}
                              onClick={() => startAdjustment('exchange', item.id)}
                              style={{ border: '1px solid #d8cce2', background: '#fff', color: '#5c386c', borderRadius: 8, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: canAdjust && availableProducts.length > 0 ? 'pointer' : 'not-allowed', opacity: canAdjust && availableProducts.length > 0 ? 1 : 0.5 }}
                            >
                              <RefreshCw size={15} /> تبديل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedInvoice.adjustments.length > 0 && (
                    <section style={{ borderTop: '1px solid #eee9f0', paddingTop: 12 }}>
                      <h3 style={{ margin: '0 0 10px' }}>سجل الاسترجاع والاستبدال</h3>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {selectedInvoice.adjustments.map((adjustment) => (
                          <div
                            key={adjustment.id}
                            style={{ background: '#f8f6fa', borderRadius: 10, padding: 12 }}
                          >
                            <strong>
                              {adjustment.kind === 'return' ? 'استرجاع' : 'استبدال'}
                            </strong>
                            <span style={{ color: '#756b7a', marginRight: 8 }}>
                              {formatDate(adjustment.createdAt)} — الكمية {adjustment.quantity}
                            </span>
                            <div style={{ marginTop: 5, fontSize: 13 }}>
                              قيمة المرتجع: {formatMoney(adjustment.returnValue)}
                              {adjustment.replacementProductName && (
                                <> — البديل: {adjustment.replacementProductName} ({formatMoney(adjustment.replacementValue)})</>
                              )}
                            </div>
                            {(adjustment.refundCash > 0 ||
                              adjustment.refundBankak > 0 ||
                              adjustment.creditRefund > 0) && (
                              <div style={{ marginTop: 4, fontSize: 13 }}>
                                المبلغ المردود:{' '}
                                {formatMoney(
                                  adjustment.refundCash +
                                    adjustment.refundBankak +
                                    adjustment.creditRefund,
                                )}
                                {adjustment.settlementMethod && ` — ${adjustment.settlementMethod}`}
                              </div>
                            )}
                            {adjustment.refundProofPath && (
                              <a
                                href={`/api/storage${adjustment.refundProofPath}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'inline-flex', marginTop: 8 }}
                              >
                                <img
                                  src={`/api/storage${adjustment.refundProofPath}`}
                                  alt="صورة إشعار رد المبلغ"
                                  loading="lazy"
                                  style={{
                                    width: 112,
                                    height: 76,
                                    objectFit: 'cover',
                                    borderRadius: 8,
                                    border: '1px solid #ddd',
                                  }}
                                />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Only Single Invoice Sheet */}
      {invoiceToPrint && (
        <div className="print-area invoice-sheet hidden-screen">
          <div className="print-header">
            <BrandMark />
            <div className="print-meta">
              <h2>فاتورة مبيعات</h2>
              <p>رقم الفاتورة: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{invoiceToPrint.invoiceNumber}</strong></p>
              <p>التاريخ: {formatDate(invoiceToPrint.createdAt)}</p>
            </div>
          </div>

          <div className="invoice-details">
            <div className="invoice-box">
              <span className="box-label">بيانات العميل</span>
              <strong>{invoiceToPrint.customerName}</strong>
              {invoiceToPrint.customerPhone && <p dir="ltr" style={{ textAlign: 'right' }}>{invoiceToPrint.customerPhone}</p>}
            </div>
            <div className="invoice-box">
              <span className="box-label">معلومات الدفع</span>
              <p>طريقة الدفع: <strong>{invoiceToPrint.paymentMethod}</strong></p>
              <p>البائع: <strong>{invoiceToPrint.employeeName || '—'}</strong></p>
            </div>
          </div>

          <div className="print-table-container invoice-lines">
            <h4>تفاصيل الأصناف</h4>
            <table>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoiceToPrint.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td className="number">{item.quantity}</td>
                    <td className="number">{formatMoney(item.unitPrice)}</td>
                    <td className="number">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="invoice-totals">
            <div className="total-row">
              <span>المجموع الفرعي</span>
              <strong className="number">{formatMoney(invoiceToPrint.subtotal)}</strong>
            </div>
            {invoiceToPrint.discount > 0 && (
              <div className="total-row discount">
                <span>الخصم</span>
                <strong className="number">-{formatMoney(invoiceToPrint.discount)}</strong>
              </div>
            )}
            <div className="total-row grand">
              <span>الصافي المطلوب</span>
              <strong className="number">{formatMoney(invoiceToPrint.total)}</strong>
            </div>
            
            <div className="payment-breakdown">
              {invoiceToPrint.paidCash > 0 && (
                <div className="total-row small">
                  <span>مدفوع كاش</span>
                  <strong className="number">{formatMoney(invoiceToPrint.paidCash)}</strong>
                </div>
              )}
              {invoiceToPrint.paidBankak > 0 && (
                <div className="total-row small">
                  <span>مدفوع بنكك</span>
                  <strong className="number">{formatMoney(invoiceToPrint.paidBankak)}</strong>
                </div>
              )}
              {invoiceToPrint.creditApplied > 0 && (
                <div className="total-row small">
                  <span>مخصوم من رصيد العميل</span>
                  <strong className="number">{formatMoney(invoiceToPrint.creditApplied)}</strong>
                </div>
              )}
              {invoiceToPrint.remaining > 0 && (
                <div className="total-row small remaining">
                  <span>المتبقي (آجل)</span>
                  <strong className="number">{formatMoney(invoiceToPrint.remaining)}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="invoice-footer">
            <p>شكراً لتسوقكم من NEWTECH</p>
            <p>البضاعة المباعة لا ترد ولا تستبدل إلا في حالة وجود عيب مصنعي خلال 3 أيام.</p>
          </div>
        </div>
      )}
    </>
  );
}
