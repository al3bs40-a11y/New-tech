import assert from "node:assert/strict";
import test from "node:test";
import { productResponse } from "./productResponse.ts";
import { updateProduct } from "./updateProduct.ts";

const parseProductUpdate = (input) => input;

const createProduct = (overrides = {}) => ({
  id: 1,
  name: "Phone",
  category: "Electronics",
  brand: "North",
  model: "N1",
  specification: "128 GB",
  unit: "piece",
  quantity: "5",
  price: "100",
  payable: "40",
  profit: "60",
  costKnown: true,
  status: "متوفر",
  barcode: "111",
  imei: null,
  serialNumber: null,
  imageUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const makeRepository = (products = [createProduct()]) => {
  const state = structuredClone(products);
  let saveCalls = 0;

  return {
    state,
    get saveCalls() {
      return saveCalls;
    },
    async findById(id) {
      return state.find((product) => product.id === id);
    },
    async barcodeIsInUse(barcode, excludingId) {
      return state.some(
        (product) => product.id !== excludingId && product.barcode === barcode,
      );
    },
    async save(id, values) {
      saveCalls += 1;
      const product = state.find((item) => item.id === id);
      if (!product) return undefined;
      if (
        values.barcode !== undefined &&
        state.some(
          (item) => item.id !== id && item.barcode === values.barcode,
        )
      ) {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint: "products_barcode_unique",
        });
      }
      Object.assign(product, values);
      return product;
    },
  };
};

test("admin PATCH can edit product data without changing stock quantity", async () => {
  const repository = makeRepository();

  const result = await updateProduct(
    1,
    { name: "Updated phone", model: "N2" },
    "admin",
    repository,
    parseProductUpdate,
  );

  assert.equal(result.ok, true);
  assert.equal(repository.state[0].name, "Updated phone");
  assert.equal(repository.state[0].model, "N2");
  assert.equal(repository.state[0].quantity, "5");
});

test("PATCH rejects quantity and leaves the product record unchanged", async () => {
  const repository = makeRepository();
  const before = structuredClone(repository.state);

  const result = await updateProduct(
    1,
    { name: "Should not save", quantity: 99 },
    "admin",
    repository,
    parseProductUpdate,
  );

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "لا يمكن تعديل كمية المخزون من نافذة تعديل بيانات الصنف",
  });
  assert.deepEqual(repository.state, before);
  assert.equal(repository.saveCalls, 0);
});

test("seller PATCH changes only selling price and hides cost from its response", async () => {
  const repository = makeRepository();

  const result = await updateProduct(
    1,
    { price: 125 },
    "seller",
    repository,
    parseProductUpdate,
  );

  assert.equal(result.ok, true);
  assert.equal(repository.state[0].price, "125");
  assert.equal(repository.state[0].payable, "40");
  assert.equal(repository.state[0].name, "Phone");
  assert.equal(repository.state[0].quantity, "5");

  const response = productResponse(result.product, true);
  assert.equal(response.price, 125);
  assert.equal(response.payable, 0);
  assert.equal(response.profit, 0);
});

test("seller PATCH cannot change supplier cost or other product details", async () => {
  for (const input of [
    { price: 125, payable: 35 },
    { price: 125, name: "Changed by seller" },
    { name: "Changed by seller" },
  ]) {
    const repository = makeRepository();
    const before = structuredClone(repository.state);

    const result = await updateProduct(
      1,
      input,
      "seller",
      repository,
      parseProductUpdate,
    );

    assert.deepEqual(result, {
      ok: false,
      status: 403,
      error: "يمكن للبايع تعديل سعر البيع فقط",
    });
    assert.deepEqual(repository.state, before);
    assert.equal(repository.saveCalls, 0);
  }
});

test("admin cannot activate a seller-created product before supplier cost is recorded", async () => {
  const repository = makeRepository([
    createProduct({
      payable: "0",
      profit: "0",
      costKnown: false,
      status: "متوقف",
    }),
  ]);
  const before = structuredClone(repository.state);

  const result = await updateProduct(
    1,
    { status: "متوفر" },
    "admin",
    repository,
    parseProductUpdate,
  );

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "سجل تكلفة المورد أولاً قبل تفعيل الصنف",
  });
  assert.deepEqual(repository.state, before);
  assert.equal(repository.saveCalls, 0);
});

test("admin can record supplier cost and then activate a seller-created product", async () => {
  const repository = makeRepository([
    createProduct({
      payable: "0",
      profit: "0",
      costKnown: false,
      status: "متوقف",
    }),
  ]);

  const costResult = await updateProduct(
    1,
    { payable: 40 },
    "admin",
    repository,
    parseProductUpdate,
  );

  assert.equal(costResult.ok, true);
  assert.equal(repository.state[0].payable, "40");
  assert.equal(repository.state[0].costKnown, true);
  assert.equal(repository.state[0].status, "متوقف");

  const activationResult = await updateProduct(
    1,
    { status: "متوفر" },
    "admin",
    repository,
    parseProductUpdate,
  );

  assert.equal(activationResult.ok, true);
  assert.equal(repository.state[0].status, "متوفر");
  assert.equal(repository.state[0].costKnown, true);
  assert.equal(repository.state[0].payable, "40");
});

test("PATCH returns 409 with a clear message for a duplicate barcode", async () => {
  const repository = makeRepository([
    createProduct(),
    createProduct({ id: 2, name: "Other product", barcode: "222" }),
  ]);
  const before = structuredClone(repository.state);

  const result = await updateProduct(
    1,
    { barcode: "222" },
    "admin",
    repository,
    parseProductUpdate,
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "الباركود مستخدم لصنف آخر",
  });
  assert.deepEqual(repository.state, before);
  assert.equal(repository.saveCalls, 0);
});

test("concurrent PATCH requests cannot assign the same barcode", async () => {
  const repository = makeRepository([
    createProduct(),
    createProduct({ id: 2, name: "Other product", barcode: "222" }),
  ]);
  const before = structuredClone(repository.state);
  const checkBarcodeInUse = repository.barcodeIsInUse.bind(repository);
  let preflightChecks = 0;
  let releasePreflight;
  const preflightBarrier = new Promise((resolve) => {
    releasePreflight = resolve;
  });

  repository.barcodeIsInUse = async (...args) => {
    const isInUse = await checkBarcodeInUse(...args);
    preflightChecks += 1;
    if (preflightChecks === 2) releasePreflight();
    await preflightBarrier;
    return isInUse;
  };

  const results = await Promise.all([
    updateProduct(
      1,
      { name: "First update", barcode: "shared" },
      "admin",
      repository,
      parseProductUpdate,
    ),
    updateProduct(
      2,
      { name: "Second update", barcode: "shared" },
      "admin",
      repository,
      parseProductUpdate,
    ),
  ]);

  const conflicts = results.filter((result) => !result.ok);
  const successes = results.filter((result) => result.ok);
  assert.equal(conflicts.length, 1);
  assert.equal(successes.length, 1);
  assert.deepEqual(conflicts[0], {
    ok: false,
    status: 409,
    error: "الباركود مستخدم لصنف آخر",
  });

  const successfulId = successes[0].product.id;
  const losingId = successfulId === 1 ? 2 : 1;
  assert.equal(
    repository.state.filter((product) => product.barcode === "shared").length,
    1,
  );
  assert.deepEqual(
    repository.state.find((product) => product.id === losingId),
    before.find((product) => product.id === losingId),
  );
});

test("PATCH does not turn unrelated unique violations into barcode conflicts", async () => {
  const repository = makeRepository();
  repository.save = async () => {
    throw Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "some_other_unique_constraint",
    });
  };

  await assert.rejects(
    updateProduct(
      1,
      { barcode: "new barcode" },
      "admin",
      repository,
      parseProductUpdate,
    ),
    { code: "23505", constraint: "some_other_unique_constraint" },
  );
});