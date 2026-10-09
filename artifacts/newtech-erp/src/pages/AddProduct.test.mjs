import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addProductFormReducer,
  getProductCreateErrorMessage,
  initialAddProductFormState,
} from './addProductFormState.ts';

test('a rejected create shows the server message and retains entered product details', () => {
  const enteredForm = [
    ['name', 'Wall AC'],
    ['category', 'مكيفات'],
    ['brand', 'Samsung'],
  ].reduce(
    (state, [name, value]) =>
      addProductFormReducer(state, { type: 'fieldChanged', name, value }),
    initialAddProductFormState,
  );

  const rejectedForm = addProductFormReducer(enteredForm, {
    type: 'creationFailed',
    serverError: { data: { message: 'Barcode is already in use.' } },
  });

  assert.equal(rejectedForm.error, 'Barcode is already in use.');
  assert.deepEqual(rejectedForm.formData, enteredForm.formData);
});

test('an empty server error uses the general product creation fallback', () => {
  assert.equal(
    getProductCreateErrorMessage({ data: { message: '   ' } }),
    'حدث خطأ أثناء إضافة المنتج. تأكد من صحة البيانات.',
  );
});

test('a plain-string server error is shown to the user', () => {
  assert.equal(
    getProductCreateErrorMessage({ data: 'not readable' }),
    'not readable',
  );
});
