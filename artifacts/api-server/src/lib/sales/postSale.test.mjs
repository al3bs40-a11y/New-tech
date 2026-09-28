import assert from "node:assert/strict";
import test from "node:test";
import { postSale } from "./postSale.ts";

const product = (overrides = {}) => ({
  id: 1,
  name: "Phone",
  quantity: "5",
  price: "100",
  payable: "40",
  costKnown: true,
  status: "متوفر",
  ...overrides,
});

const makeState = (products = [product()]) => ({
  products,
  customers: [
    {
      id: 10,
      name: "Existing customer",
      phone: "0900000000",
      balance: "25",
      totalPurchases: "400",
    },
  ],
  sales: [],
  saleItems: [],
  activities: [],
});

const makeDatabase = (initialState) => {
  let state = structuredClone(initialState);

  const database = {
    get state() {
      return state;
    },
    async transaction(operation) {
      const workingState = structuredClone(state);
      const tx = {
        async findProducts(ids) {
          return workingState.products.filter((item) => ids.includes(item.id));
        },
        async findCustomer(phone, name) {
          return workingState.customers.find((customer) =>
            phone ? customer.phone === phone : customer.name === name,
          );
        },
        async decrementStock(productId, quantity) {
          const item = workingState.products.find(
            (candidate) => candidate.id === productId,
          );
          if (!item || Number(item.quantity) < quantity) return undefined;
          item.quantity = String(Number(item.quantity) - quantity);
          return item.quantity;
        },
        async markProductSold(productId) {
          const item = workingState.products.find(
            (candidate) => candidate.id === productId,
          );
          item.status = "مباع";
        },
        async createSale(values) {
          const created = {
            ...values,
            id: workingState.sales.length + 1,
            createdAt: new Date("2026-09-26T12:00:00.000Z"),
          };
          workingState.sales.push(created);
          return created;
        },
        async createSaleItem(values) {
          workingState.saleItems.push(values);
        },
        async updateCustomerBalance(id, balanceIncrease, purchaseIncrease) {
          const customer = workingState.customers.find((item) => item.id === id);
          customer.balance = String(Number(customer.balance) + balanceIncrease);
          customer.totalPurchases = String(
            Number(customer.totalPurchases) + purchaseIncrease,
          );
        },
        async createCustomer(values) {
          workingState.customers.push({
            ...values,
            id: workingState.customers.length + 1,
          });
        },
        async createActivity(values) {
          workingState.activities.push(values);
        },
      };

      const result = await operation(tx);
      state = workingState;
      return result;
    },
  };

  return database;
};

const sale = (overrides = {}) => ({
  customerName: "New customer",
  customerPhone: "0912345678",
  items: [{ productId: 1, quantity: 1, unitPrice: 100 }],
  paidCash: 100,
  paidBankak: 0,
  discount: 0,
  ...overrides,
});

const assertRejectedWithoutChanges = async (state, input, expectedError) => {
  const database = makeDatabase(state);
  const before = structuredClone(database.state);

  await assert.rejects(
    postSale(database, input, "Seller"),
    (error) => error.message === expectedError,
  );
  assert.deepEqual(database.state, before);
};

test("rejects overpayment without changing stock, invoices, customers, or activity", async () => {
  await assertRejectedWithoutChanges(
    makeState(),
    sale({ paidCash: 101 }),
    "OVERPAYMENT",
  );
});

test("rejects a discount that drops proceeds below product cost without side effects", async () => {
  await assertRejectedWithoutChanges(
    makeState(),
    sale({ discount: 61, paidCash: 39 }),
    "SALE_BELOW_COST",
  );
});

test("explains a zero-discount sale whose product cost is above its sale price", async () => {
  await assertRejectedWithoutChanges(
    makeState([product({ price: "40", payable: "50" })]),
    sale({
      items: [{ productId: 1, quantity: 1, unitPrice: 40 }],
      paidCash: 40,
      discount: 0,
    }),
    "SALE_BELOW_COST",
  );
});

test("rejects a discount larger than the invoice subtotal", async () => {
  await assertRejectedWithoutChanges(
    makeState(),
    sale({ discount: 101, paidCash: 0 }),
    "DISCOUNT_EXCEEDS_SUBTOTAL",
  );
});

test("rejects unavailable stock without side effects", async () => {
  await assertRejectedWithoutChanges(
    makeState([product({ status: "موقوف" })]),
    sale(),
    "UNAVAILABLE_PRODUCT",
  );
});

test("rolls back earlier stock decrements when a later cart item is insufficient", async () => {
  const secondProduct = product({
    id: 2,
    name: "Accessory",
    quantity: "0",
    price: "50",
    payable: "10",
  });
  await assertRejectedWithoutChanges(
    makeState([product(), secondProduct]),
    sale({
      items: [
        { productId: 1, quantity: 1, unitPrice: 100 },
        { productId: 2, quantity: 1, unitPrice: 50 },
      ],
      paidCash: 150,
    }),
    "INSUFFICIENT_STOCK",
  );
});

test("rejects credit without a normalized phone before changing any records", async () => {
  for (const phone of [null, "not a Sudanese number"]) {
    await assertRejectedWithoutChanges(
      makeState(),
      sale({
        customerPhone: phone,
        paidCash: 25,
      }),
      "PHONE_REQUIRED_FOR_CREDIT",
    );
  }
});

test("requires a phone to save a new named cash customer", async () => {
  await assertRejectedWithoutChanges(
    makeState(),
    sale({ customerPhone: null, paidCash: 100 }),
    "PHONE_REQUIRED_FOR_CUSTOMER",
  );
});

test("commits stock, invoice, customer balance, and activity together on success", async () => {
  const database = makeDatabase(makeState());
  await postSale(database, sale({ paidCash: 60 }), "Seller");

  assert.equal(database.state.products[0].quantity, "4");
  assert.equal(database.state.sales.length, 1);
  assert.equal(database.state.saleItems.length, 1);
  assert.equal(database.state.customers.length, 2);
  assert.deepEqual(
    {
      name: database.state.customers[1].name,
      phone: database.state.customers[1].phone,
      balance: database.state.customers[1].balance,
      totalPurchases: database.state.customers[1].totalPurchases,
    },
    {
      name: "New customer",
      phone: "0912345678",
      balance: "40",
      totalPurchases: "100",
    },
  );
  assert.equal(database.state.activities.length, 1);
});