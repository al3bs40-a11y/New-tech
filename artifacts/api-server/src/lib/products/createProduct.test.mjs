import assert from "node:assert/strict";
import test from "node:test";
import { createProduct } from "./createProduct.ts";

const productValues = (overrides = {}) => ({
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
  barcode: "shared",
  ...overrides,
});

const activityValue = (name) => ({
  type: "inventory",
  title: "إضافة بضاعة جديدة",
  description: `تمت إضافة ${name} إلى المخزون`,
  amount: "500",
});

const duplicateBarcodeError = () =>
  Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint: "products_barcode_unique",
  });

const makeRepository = () => {
  const products = [];
  const activities = [];
  let waiting = 0;
  let releaseInsertBarrier;
  const insertBarrier = new Promise((resolve) => {
    releaseInsertBarrier = resolve;
  });

  return {
    products,
    activities,
    async create(values, activity) {
      // Both requests pass an initial uniqueness check before either commits.
      const duplicateAtCheck = products.some(
        (product) => product.barcode === values.barcode,
      );
      waiting += 1;
      if (waiting === 2) releaseInsertBarrier();
      await insertBarrier;

      // Model the database's atomic unique constraint at insert time.
      if (
        duplicateAtCheck ||
        products.some((product) => product.barcode === values.barcode)
      ) {
        throw duplicateBarcodeError();
      }

      const product = { id: products.length + 1, ...values };
      products.push(product);
      activities.push(activity);
      return product;
    },
  };
};

test("concurrent POSTs with the same barcode create only one product and activity", async () => {
  const repository = makeRepository();

  const results = await Promise.all(
    ["First phone", "Second phone"].map((name) =>
      createProduct(
        productValues({ name }),
        activityValue(name),
        repository,
      ),
    ),
  );

  const successes = results.filter((result) => result.ok);
  const conflicts = results.filter((result) => !result.ok);
  assert.equal(successes.length, 1);
  assert.deepEqual(conflicts, [
    {
      ok: false,
      status: 409,
      error: "الباركود مستخدم لصنف آخر",
    },
  ]);
  assert.equal(repository.products.length, 1);
  assert.equal(repository.products[0].barcode, "shared");
  assert.equal(repository.activities.length, 1);
  assert.equal(
    repository.activities[0].description,
    `تمت إضافة ${successes[0].product.name} إلى المخزون`,
  );
});

test("product creation rethrows unrelated unique-constraint failures", async () => {
  const repository = {
    async create() {
      throw Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "some_other_unique_constraint",
      });
    },
  };

  await assert.rejects(
    createProduct(productValues(), activityValue("Phone"), repository),
    { code: "23505", constraint: "some_other_unique_constraint" },
  );
});
