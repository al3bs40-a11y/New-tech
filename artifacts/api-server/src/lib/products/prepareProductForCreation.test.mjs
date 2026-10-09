import assert from "node:assert/strict";
import test from "node:test";
import { prepareProductForCreation } from "./prepareProductForCreation.ts";

const productInput = {
  name: "Phone",
  category: "Electronics",
  brand: "North",
  model: "N1",
  specification: "128 GB",
  unit: "piece",
  quantity: 5,
  price: 100,
  payable: 40,
  barcode: "111",
};

test("seller-created products stay stopped and supplier cost remains unknown", () => {
  const result = prepareProductForCreation(productInput, "seller");

  assert.equal(result.ok, true);
  assert.equal(result.values.status, "متوقف");
  assert.equal(result.values.costKnown, false);
  assert.equal(result.values.payable, "0");
  assert.equal(result.values.profit, "0");
  assert.equal(result.values.barcode, "111");
});

test("product creation generates a unique barcode when one is omitted", () => {
  const { barcode: _barcode, ...inputWithoutBarcode } = productInput;
  const first = prepareProductForCreation(inputWithoutBarcode, "seller");
  const second = prepareProductForCreation(inputWithoutBarcode, "seller");

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.match(first.values.barcode, /^NT-[0-9A-F]{32}$/);
  assert.match(second.values.barcode, /^NT-[0-9A-F]{32}$/);
  assert.notEqual(first.values.barcode, second.values.barcode);
});

test("admin cannot create an available product without recording supplier cost", () => {
  const { payable: _payable, ...inputWithoutCost } = productInput;
  const result = prepareProductForCreation(inputWithoutCost, "admin");

  assert.deepEqual(result, {
    ok: false,
    error: "تكلفة المورد مطلوبة لإضافة الصنف",
  });
});
