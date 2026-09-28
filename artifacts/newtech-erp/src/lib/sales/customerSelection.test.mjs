import assert from "node:assert/strict";
import test from "node:test";
import {
  findCustomerByPhone,
  normalizeSudanPhone,
  updateCustomerSelection,
} from "./customerSelection.ts";

const customers = [
  { name: "Customer A", phone: "0911111111" },
  { name: "Customer B", phone: "0922222222" },
];

test("changing the selected customer replaces the automatically matched phone", () => {
  const firstSelection = updateCustomerSelection(
    "Customer A",
    customers,
    "",
    null,
  );
  const secondSelection = updateCustomerSelection(
    "Customer B",
    customers,
    firstSelection.phone,
    firstSelection.autoMatchedPhone,
  );

  assert.deepEqual(secondSelection, {
    phone: "0922222222",
    autoMatchedPhone: "0922222222",
  });
});

test("changing to an unmatched name clears the previous auto-matched phone", () => {
  const firstSelection = updateCustomerSelection(
    "Customer A",
    customers,
    "",
    null,
  );
  const nextSelection = updateCustomerSelection(
    "A different customer",
    customers,
    firstSelection.phone,
    firstSelection.autoMatchedPhone,
  );

  assert.deepEqual(nextSelection, { phone: "", autoMatchedPhone: null });
});

test("changing the name preserves a phone the user entered manually", () => {
  const firstSelection = updateCustomerSelection(
    "Customer A",
    customers,
    "",
    null,
  );
  const nextSelection = updateCustomerSelection(
    "A different customer",
    customers,
    "0900000000",
    firstSelection.autoMatchedPhone,
  );

  assert.deepEqual(nextSelection, {
    phone: "0900000000",
    autoMatchedPhone: null,
  });
});

test("phone lookup matches Sudanese local and international formats", () => {
  assert.equal(normalizeSudanPhone("+249 911 111 111"), "0911111111");
  assert.equal(normalizeSudanPhone("911111111"), "0911111111");
  assert.deepEqual(findCustomerByPhone("+249 911 111 111", customers), {
    name: "Customer A",
    phone: "0911111111",
  });
});

test("phone lookup does not match incomplete or invalid numbers", () => {
  assert.equal(findCustomerByPhone("09111", customers), undefined);
  assert.equal(findCustomerByPhone("1234567890", customers), undefined);
});