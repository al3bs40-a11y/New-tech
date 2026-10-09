import type { productsTable } from "@workspace/db";

type Product = typeof productsTable.$inferSelect;

const money = (value: string | number | null | undefined): number =>
  Number(value ?? 0);

export function productResponse(product: Product, isSeller = false) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand,
    model: product.model,
    specification: product.specification,
    unit: product.unit,
    quantity: money(product.quantity),
    price: money(product.price),
    payable: isSeller ? 0 : money(product.payable),
    profit: isSeller ? 0 : money(product.profit),
    costKnown: product.costKnown,
    status: product.status,
    barcode: product.barcode,
    imei: product.imei,
    serialNumber: product.serialNumber,
    imageUrl: product.imageUrl,
  };
}
