import type { activitiesTable, productsTable } from "@workspace/db";

type Product = typeof productsTable.$inferSelect;
type ProductInsertValues = typeof productsTable.$inferInsert;
type ActivityInsertValues = typeof activitiesTable.$inferInsert;

const PRODUCT_BARCODE_CONFLICT_ERROR = "الباركود مستخدم لصنف آخر";
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

export interface ProductCreationRepository {
  create(
    values: ProductInsertValues,
    activity: ActivityInsertValues,
  ): Promise<Product>;
}

type ProductCreationResult =
  | { ok: true; product: Product }
  | { ok: false; status: 409; error: string };

export async function createProduct(
  values: ProductInsertValues,
  activity: ActivityInsertValues,
  repository: ProductCreationRepository,
): Promise<ProductCreationResult> {
  try {
    return { ok: true, product: await repository.create(values, activity) };
  } catch (error) {
    if (isBarcodeUniqueViolation(error)) {
      return {
        ok: false,
        status: 409,
        error: PRODUCT_BARCODE_CONFLICT_ERROR,
      };
    }
    throw error;
  }
}
