import assert from 'node:assert/strict';
import test from 'node:test';
import { getApiErrorMessage } from '../lib/apiErrorMessage.ts';

const fallback = 'Unable to save product.';
const invoiceAdjustmentFallback =
  'تعذر حفظ عملية الاسترجاع أو الاستبدال. حاول مرة أخرى.';

test('returns the first readable server message', () => {
  assert.equal(
    getApiErrorMessage({ data: { error: '   ', message: '  Invalid barcode.  ' } }, fallback),
    'Invalid barcode.',
  );
});

test('uses the fallback when the response has no readable message', () => {
  assert.equal(getApiErrorMessage(undefined, fallback), fallback);
  assert.equal(getApiErrorMessage({ data: '   ' }, fallback), fallback);
  assert.equal(getApiErrorMessage({ data: { message: '   ', detail: null } }, fallback), fallback);
  assert.equal(getApiErrorMessage({ message: '   ' }, fallback), fallback);
});

test('supports plain-string response data and a top-level message', () => {
  assert.equal(getApiErrorMessage({ data: '  Username already exists.  ' }, fallback), 'Username already exists.');
  assert.equal(getApiErrorMessage({ message: '  Account is locked.  ' }, fallback), 'Account is locked.');
});

test('supports the other server message fields consistently', () => {
  assert.equal(getApiErrorMessage({ data: { detail: 'Invalid price.' } }, fallback), 'Invalid price.');
  assert.equal(getApiErrorMessage({ data: { title: 'Request rejected.' } }, fallback), 'Request rejected.');
});

test('preserves readable server validation messages for invoice adjustments', () => {
  assert.equal(
    getApiErrorMessage(
      { data: { message: 'الكمية المتاحة أقل من الكمية المطلوبة.' } },
      invoiceAdjustmentFallback,
    ),
    'الكمية المتاحة أقل من الكمية المطلوبة.',
  );
});

test('uses the localized invoice adjustment fallback for blank or unreadable responses', () => {
  assert.equal(
    getApiErrorMessage({ data: { message: '   ', detail: null } }, invoiceAdjustmentFallback),
    invoiceAdjustmentFallback,
  );
  assert.equal(
    getApiErrorMessage(new Error('   '), invoiceAdjustmentFallback),
    invoiceAdjustmentFallback,
  );
});
