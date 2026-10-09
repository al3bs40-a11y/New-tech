import { randomUUID } from "node:crypto";
import type { ProductInput } from "@workspace/api-zod";
import type { productsTable } from "@workspace/db";

type ProductCreatorRole = "admin" | "seller";
type ProductInsertValues = typeof productsTable.$inferInsert;

type PrepareProductResult =
  | { ok: true; values: ProductInsertValues }
  | { ok: false; error: string };

export function prepareProductForCreation(
  body: ProductInput,
  role: ProductCreatorRole,
): PrepareProductResult {
  const isSeller = role === "seller";
  if (!isSeller && body.payable === undefined) {
    return { ok: false, error: "تكلفة المورد مطلوبة لإضافة الصنف" };
  }

  const payable = isSeller ? 0 : body.payable!;
  const costKnown = !isSeller;
  const barcode =
    body.barcode?.trim() ||
    `NT-${randomUUID().replaceAll("-", "").toUpperCase()}`;
  return {
    ok: true,
    values: {
      ...body,
      barcode,
      quantity: String(body.quantity),
      price: String(body.price),
      payable: String(payable),
      profit: String(costKnown ? body.price - payable : 0),
      costKnown,
      status: isSeller ? "متوقف" : "متوفر",
    },
  };
}
