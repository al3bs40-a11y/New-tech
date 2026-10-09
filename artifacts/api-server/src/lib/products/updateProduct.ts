import type { UpdateProductBody } from "@workspace/api-zod";
import type { productsTable } from "@workspace/db";

type Product = typeof productsTable.$inferSelect;
type ProductUpdateValues = Partial<typeof productsTable.$inferInsert>;
type ProductUpdateBody = ReturnType<typeof UpdateProductBody.parse>;

const BARCODE_CONFLICT_ERROR = "الباركود مستخدم لصنف آخر";
const BARCODE_UNIQUE_CONSTRAINT = "products_barcode_unique";

function isBarcodeUniqueViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === BARCODE_UNIQUE_CONSTRAINT
  );
}

export interface ProductUpdateRepository {
  findById(id: number): Promise<Product | undefined>;
  barcodeIsInUse(barcode: string, excludingId: number): Promise<boolean>;
  save(
    id: number,
    values: ProductUpdateValues,
    current: Product,
  ): Promise<Product | undefined>;
}

type ProductUpdateResult =
  | { ok: true; product: Product }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export async function updateProduct(
  id: number,
  input: unknown,
  role: "admin" | "seller",
  repository: ProductUpdateRepository,
  parseBody: (input: unknown) => ProductUpdateBody,
): Promise<ProductUpdateResult> {
  if (
    input !== null &&
    typeof input === "object" &&
    Object.prototype.hasOwnProperty.call(input, "quantity")
  ) {
    return {
      ok: false,
      status: 400,
      error: "لا يمكن تعديل كمية المخزون من نافذة تعديل بيانات الصنف",
    };
  }

  const body = parseBody(input);
  const current = await repository.findById(id);
  if (!current) {
    return { ok: false, status: 404, error: "Product not found" };
  }

  const isSeller = role === "seller";
  if (
    isSeller &&
    (body.price === undefined ||
      Object.keys(body).some((key) => key !== "price"))
  ) {
    return {
      ok: false,
      status: 403,
      error: "يمكن للبايع تعديل سعر البيع فقط",
    };
  }

  if (
    body.barcode !== undefined &&
    (await repository.barcodeIsInUse(body.barcode, id))
  ) {
    return { ok: false, status: 409, error: BARCODE_CONFLICT_ERROR };
  }

  if (
    !isSeller &&
    body.status === "متوفر" &&
    !current.costKnown &&
    body.payable === undefined
  ) {
    return {
      ok: false,
      status: 400,
      error: "سجل تكلفة المورد أولاً قبل تفعيل الصنف",
    };
  }

  const values: ProductUpdateValues = { updatedAt: new Date() };
  if (body.name !== undefined) values.name = body.name;
  if (body.category !== undefined) values.category = body.category;
  if (body.brand !== undefined) values.brand = body.brand;
  if (body.model !== undefined) values.model = body.model;
  if (body.specification !== undefined)
    values.specification = body.specification;
  if (body.unit !== undefined) values.unit = body.unit;
  if (body.status !== undefined) values.status = body.status;
  if (body.price !== undefined) values.price = String(body.price);
  if (body.payable !== undefined) values.payable = String(body.payable);
  if (body.barcode !== undefined) values.barcode = body.barcode;
  if (body.imei !== undefined) values.imei = body.imei;
  if (body.serialNumber !== undefined) values.serialNumber = body.serialNumber;
  if (body.payable !== undefined) values.costKnown = true;
  if (body.price !== undefined || body.payable !== undefined) {
    values.profit = String(
      current.costKnown || body.payable !== undefined
        ? (body.price ?? Number(current.price)) -
            (body.payable ?? Number(current.payable))
        : 0,
    );
  }

  let product: Product | undefined;
  try {
    product = await repository.save(id, values, current);
  } catch (error) {
    if (isBarcodeUniqueViolation(error)) {
      return {
        ok: false,
        status: 409,
        error: BARCODE_CONFLICT_ERROR,
      };
    }
    throw error;
  }
  if (!product) {
    return { ok: false, status: 404, error: "Product not found" };
  }
  return { ok: true, product };
}
