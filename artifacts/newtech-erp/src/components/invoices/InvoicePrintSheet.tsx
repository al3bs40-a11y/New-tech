import type { SaleDetail } from '@workspace/api-client-react';
import { formatDate, formatMoney } from '../../lib/utils';

export function InvoicePrintSheet({ invoice }: { invoice: SaleDetail | null }) {
  if (!invoice) return null;
  const blankRowCount = Math.max(0, 12 - invoice.items.length);

  return (
    <div className="print-area invoice-sheet hidden-screen">
      <article className="invoice-paper" dir="rtl">
        <header className="invoice-paper-header">
          <div className="invoice-contact-block">
            <span className="invoice-emblem" aria-hidden="true">NT</span>
            <div className="invoice-phone-list" dir="ltr">
              <strong>0910006003</strong>
              <strong>0910006005</strong>
            </div>
          </div>

          <div className="invoice-wordmark">
            <strong className="invoice-company-ar">نيوتك</strong>
            <div className="invoice-company-en"><span>NEW</span><b>TECH</b></div>
            <strong className="invoice-company-description">للأجهزة الكهربائية</strong>
            <span className="invoice-address">الخرطوم - شارع الستين</span>
          </div>

          <div className="invoice-contact-block invoice-contact-opposite">
            <span className="invoice-emblem" aria-hidden="true">NT</span>
            <div className="invoice-phone-list" dir="ltr">
              <strong>0910006007</strong>
              <strong>0910006008</strong>
            </div>
          </div>
        </header>

        <div className="invoice-kind-row">
          <span className="invoice-kind-pill">فاتورة مبايعة</span>
          <span className="invoice-number-tag">
            رقم الفاتورة: <b dir="ltr">{invoice.invoiceNumber}</b>
          </span>
        </div>

        <div className="invoice-meta-grid">
          <div className="invoice-meta-field">
            <span>التاريخ</span>
            <strong>{formatDate(invoice.createdAt)}</strong>
          </div>
          <div className="invoice-meta-field">
            <span>المطلوب من السيد</span>
            <strong>{invoice.customerName}</strong>
          </div>
          {invoice.customerPhone && (
            <div className="invoice-meta-field">
              <span>رقم الهاتف</span>
              <strong dir="ltr">{invoice.customerPhone}</strong>
            </div>
          )}
          <div className="invoice-meta-field">
            <span>البائع</span>
            <strong>{invoice.employeeName || '—'}</strong>
          </div>
        </div>

        <table className="invoice-lines-table">
          <colgroup>
            <col className="invoice-price-column" />
            <col className="invoice-quantity-column" />
            <col className="invoice-product-column" />
            <col className="invoice-total-column" />
          </colgroup>
          <thead>
            <tr>
              <th>السعر</th>
              <th>العدد</th>
              <th>البيع</th>
              <th>المبلغ الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="number">{formatMoney(item.unitPrice)}</td>
                <td className="number">{item.quantity}</td>
                <td className="invoice-product-name">{item.productName}</td>
                <td className="number">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
            {Array.from({ length: blankRowCount }, (_, index) => (
              <tr className="invoice-empty-line" key={`empty-${index}`} aria-hidden="true">
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>الإجمالي المطلوب</td>
              <td className="number">{formatMoney(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="invoice-payment-summary" aria-label="ملخص الفاتورة">
          <div className="invoice-summary-line">
            <span>المجموع قبل الخصم</span>
            <strong className="number">{formatMoney(invoice.subtotal)}</strong>
          </div>
          {invoice.discount > 0 && (
            <div className="invoice-summary-line">
              <span>الخصم</span>
              <strong className="number">-{formatMoney(invoice.discount)}</strong>
            </div>
          )}
          <div className="invoice-summary-line invoice-summary-grand">
            <span>الصافي المطلوب</span>
            <strong className="number">{formatMoney(invoice.total)}</strong>
          </div>
          <div className="invoice-payment-method">
            طريقة الدفع: <strong>{invoice.paymentMethod}</strong>
          </div>
          <div className="invoice-paid-grid">
            <div><span>مدفوع كاش</span><strong className="number">{formatMoney(invoice.paidCash)}</strong></div>
            <div><span>مدفوع بنكك</span><strong className="number">{formatMoney(invoice.paidBankak)}</strong></div>
            {invoice.creditApplied > 0 && (
              <div><span>من رصيد العميل</span><strong className="number">{formatMoney(invoice.creditApplied)}</strong></div>
            )}
            {invoice.remaining > 0 && (
              <div className="invoice-remaining"><span>المتبقي (آجل)</span><strong className="number">{formatMoney(invoice.remaining)}</strong></div>
            )}
          </div>
        </section>

        <div className="invoice-signatures">
          <div><span>توقيع العميل</span><i /></div>
          <div><span>توقيع البائع</span><i /></div>
        </div>

        <footer className="invoice-paper-footer">
          <strong>شكراً لتسوقكم من NEWTECH</strong>
          <span>البضاعة المباعة لا ترد ولا تستبدل إلا في حالة وجود عيب مصنعي خلال 3 أيام.</span>
        </footer>
      </article>
    </div>
  );
}
