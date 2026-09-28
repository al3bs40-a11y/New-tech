import { Router, type IRouter, type RequestHandler } from "express";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import {
  CreateCustomerBody,
  CreateExpenseBody,
  CreateProductBody,
  CreateSaleAdjustmentBody,
  CreateSaleAdjustmentParams,
  CreateSaleAdjustmentResponse,
  CreateSaleBody,
  CreateSettlementBody,
  GetActivitiesResponse,
  GetCustomersResponse,
  GetDashboardResponse,
  GetExpensesResponse,
  GetProductsQueryParams,
  GetProductsResponse,
  GetReportSummaryQueryParams,
  GetReportSummaryResponse,
  GetSaleDetailsParams,
  GetSaleDetailsResponse,
  GetSalesResponse,
  GetSettlementsResponse,
  UpdateProductBody,
  UpdateProductParams,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { signedActivity } from "../lib/audit";
import { postSale, type SaleTransaction } from "../lib/sales/postSale";
import {
  activitiesTable,
  customersTable,
  expensesTable,
  productsTable,
  saleItemsTable,
  salesTable,
  salesAdjustmentsTable,
  settlementsTable,
} from "@workspace/db";
import { requireAdmin, requireAuth } from "./auth";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
router.use(requireAuth);
const requireSeller: RequestHandler = (req, res, next) => {
  if (req.authUser?.role !== "seller") {
    res.status(403).json({ error: "هذه العملية متاحة للبايع فقط" });
    return;
  }
  next();
};

const money = (value: string | number | null | undefined): number =>
  Number(value ?? 0);
const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const iso = (value: Date | null | undefined): string =>
  (value ?? new Date()).toISOString();
const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  const local =
    digits.startsWith("249") && digits.length === 12
      ? `0${digits.slice(3)}`
      : digits.length === 9 && digits.startsWith("9")
        ? `0${digits}`
        : digits;
  return /^0\d{9}$/.test(local) ? local : "";
};

function productResponse(product: typeof productsTable.$inferSelect) {
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
    payable: money(product.payable),
    profit: money(product.profit),
    costKnown: product.costKnown,
    status: product.status,
    barcode: product.barcode,
    imei: product.imei,
    serialNumber: product.serialNumber,
    imageUrl: product.imageUrl,
  };
}

function saleAdjustmentResponse(
  adjustment: typeof salesAdjustmentsTable.$inferSelect,
) {
  return {
    id: adjustment.id,
    saleId: adjustment.saleId,
    saleItemId: adjustment.saleItemId,
    kind: adjustment.kind,
    condition: adjustment.condition,
    quantity: money(adjustment.quantity),
    returnValue: money(adjustment.returnValue),
    replacementValue: money(adjustment.replacementValue),
    debtReduction: money(adjustment.debtReduction),
    additionalDebt: money(adjustment.additionalDebt),
    refundCash: money(adjustment.refundCash),
    refundBankak: money(adjustment.refundBankak),
    creditRefund: money(adjustment.creditRefund),
    collectionCash: money(adjustment.collectionCash),
    collectionBankak: money(adjustment.collectionBankak),
    settlementMethod: adjustment.settlementMethod,
    refundProofPath: adjustment.refundProofPath,
    replacementProductId: adjustment.replacementProductId,
    replacementProductName: adjustment.replacementProductName,
    replacementQuantity:
      adjustment.replacementQuantity === null
        ? null
        : money(adjustment.replacementQuantity),
    createdAt: iso(adjustment.createdAt),
    employeeName: adjustment.employeeName,
  };
}

router.get("/dashboard", async (req, res, next) => {
  try {
    const [products, sales, settlements, expenses, adjustments] = await Promise.all([
      db.select().from(productsTable),
      db.select().from(salesTable),
      db.select().from(settlementsTable),
      db.select().from(expensesTable),
      db.select().from(salesAdjustmentsTable),
    ]);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const salesToday = sales
      .filter((sale) => iso(sale.createdAt).slice(0, 10) === today)
      .reduce((sum, sale) => sum + money(sale.total), 0) +
      adjustments
        .filter((item) => iso(item.createdAt).slice(0, 10) === today)
        .reduce(
          (sum, item) => sum + money(item.replacementValue) - money(item.returnValue),
          0,
        );
    const salesMonth = sales
      .filter((sale) => iso(sale.createdAt).slice(0, 7) === month)
      .reduce((sum, sale) => sum + money(sale.total), 0) +
      adjustments
        .filter((item) => iso(item.createdAt).slice(0, 7) === month)
        .reduce(
          (sum, item) => sum + money(item.replacementValue) - money(item.returnValue),
          0,
        );
    const cashSales =
      sales.reduce((sum, sale) => sum + money(sale.paidCash), 0) +
      adjustments.reduce(
        (sum, item) => sum + money(item.collectionCash) - money(item.refundCash),
        0,
      );
    const bankakSales = sales.reduce(
      (sum, sale) => sum + money(sale.paidBankak),
      0,
    ) + adjustments.reduce(
      (sum, item) => sum + money(item.collectionBankak) - money(item.refundBankak),
      0,
    );
    const cashSettlements = settlements
      .filter((item) => item.paymentMethod === "كاش")
      .reduce((sum, item) => sum + money(item.amount), 0);
    const bankakSettlements = settlements
      .filter((item) => item.paymentMethod === "بنكك")
      .reduce((sum, item) => sum + money(item.amount), 0);
    const cashExpenses = expenses
      .filter((item) => item.paymentMethod === "كاش")
      .reduce((sum, item) => sum + money(item.amount), 0);
    const bankakExpenses = expenses
      .filter((item) => item.paymentMethod === "بنكك")
      .reduce((sum, item) => sum + money(item.amount), 0);
    const salesProceeds = sales.reduce(
      (sum, sale) => sum + money(sale.proceeds),
      0,
    ) + adjustments.reduce((sum, item) => sum + money(item.proceedsChange), 0);
    const totalSettlements = settlements.reduce(
      (sum, item) => sum + money(item.amount),
      0,
    );
    const omarSettlements = settlements
      .filter((item) => item.channel === "عمر")
      .reduce((sum, item) => sum + money(item.amount), 0);
    const saifSettlements = settlements
      .filter((item) => item.channel === "سيف")
      .reduce((sum, item) => sum + money(item.amount), 0);
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + money(item.amount),
      0,
    );
    const cashBalance = cashSales - cashSettlements - cashExpenses;
    const bankakBalance = bankakSales - bankakSettlements - bankakExpenses;
    const salesTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const value = sales
        .filter((sale) => iso(sale.createdAt).slice(0, 10) === key)
        .reduce((sum, sale) => sum + money(sale.total), 0) +
        adjustments
          .filter((item) => iso(item.createdAt).slice(0, 10) === key)
          .reduce(
            (sum, item) =>
              sum + money(item.replacementValue) - money(item.returnValue),
            0,
          );
      return {
        label: date.toLocaleDateString("ar-SD", { weekday: "short" }),
        value,
      };
    });

    const data = {
      salesToday,
      salesMonth,
      cashBalance,
      bankakBalance,
      liquidity: cashBalance + bankakBalance,
      inventoryValue: products.reduce(
        (sum, product) => sum + money(product.quantity) * money(product.price),
        0,
      ),
      salesProceeds,
      omarSettlements,
      saifSettlements,
      unsettled: Math.max(0, salesProceeds - totalSettlements),
      expenses: totalExpenses,
      netProfit:
        sales.reduce((sum, sale) => sum + money(sale.grossProfit), 0) +
        adjustments.reduce((sum, item) => sum + money(item.profitChange), 0) -
        totalExpenses,
      salesTrend,
      paymentBreakdown: [
        { label: "كاش", value: cashSales },
        { label: "بنكك", value: bankakSales },
      ],
    };
    const visibleData =
      req.authUser?.role === "seller"
        ? {
            ...data,
            liquidity: 0,
            salesProceeds: 0,
            omarSettlements: 0,
            saifSettlements: 0,
            unsettled: 0,
            expenses: 0,
            netProfit: 0,
          }
        : data;
    res.json(GetDashboardResponse.parse(visibleData));
  } catch (error) {
    next(error);
  }
});

router.get("/activities", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(activitiesTable)
      .orderBy(desc(activitiesTable.createdAt))
      .limit(12);
    res.json(
      GetActivitiesResponse.parse(
        rows
          .filter(
            (row) =>
              req.authUser?.role === "admin" ||
              (row.type !== "expense" &&
                row.type !== "settlement" &&
                row.type !== "account"),
          )
          .map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          description: row.description,
          amount: money(row.amount),
          createdAt: iso(row.createdAt),
          actorDisplayName: row.actorDisplayName,
          actorUsername: row.actorUsername,
        })),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/products", async (req, res, next) => {
  try {
    const params = GetProductsQueryParams.parse(req.query);
    const filters = [];
    if (params.search) {
      const query = `%${params.search}%`;
      filters.push(
        or(
          ilike(productsTable.name, query),
          ilike(productsTable.brand, query),
          ilike(productsTable.model, query),
          ilike(productsTable.specification, query),
          ilike(productsTable.barcode, query),
        ),
      );
    }
    if (params.status) filters.push(eq(productsTable.status, params.status));
    const rows = await db
      .select()
      .from(productsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(productsTable.createdAt));
    const products = rows.map(productResponse).map((product) =>
      req.authUser?.role === "seller"
        ? { ...product, payable: 0, profit: 0 }
        : product,
    );
    res.json(GetProductsResponse.parse(products));
  } catch (error) {
    next(error);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const body = CreateProductBody.parse(req.body);
    const isSeller = req.authUser?.role === "seller";
    if (!isSeller && body.payable === undefined) {
      res.status(400).json({ error: "تكلفة المورد مطلوبة لإضافة الصنف" });
      return;
    }
    const payable = isSeller ? 0 : body.payable!;
    const costKnown = !isSeller;
    const profit = costKnown ? body.price - payable : 0;
    const product = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(productsTable)
        .values({
          ...body,
          quantity: String(body.quantity),
          price: String(body.price),
          payable: String(payable),
          profit: String(profit),
          costKnown,
          status: isSeller ? "متوقف" : "متوفر",
        })
        .returning();
      await tx.insert(activitiesTable).values(
        signedActivity(req.authUser!, {
          type: "inventory",
          title: "إضافة بضاعة جديدة",
          description: `تمت إضافة ${body.name} إلى المخزون`,
          amount: String(body.price * body.quantity),
        }),
      );
      return product;
    });
    res.status(201).json(productResponse(product));
  } catch (error) {
    next(error);
  }
});

router.patch("/products/:id", async (req, res, next) => {
  try {
    const { id } = UpdateProductParams.parse(req.params);
    const body = UpdateProductBody.parse(req.body);
    const [current] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const isSeller = req.authUser?.role === "seller";
    if (
      isSeller &&
      (body.price === undefined ||
        Object.keys(body).some((key) => key !== "price"))
    ) {
      res.status(403).json({ error: "يمكن للبايع تعديل سعر البيع فقط" });
      return;
    }
    if (
      !isSeller &&
      body.status === "متوفر" &&
      !current.costKnown &&
      body.payable === undefined
    ) {
      res.status(400).json({ error: "سجل تكلفة المورد أولاً قبل تفعيل الصنف" });
      return;
    }
    const values: Partial<typeof productsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) values.name = body.name;
    if (body.category !== undefined) values.category = body.category;
    if (body.brand !== undefined) values.brand = body.brand;
    if (body.model !== undefined) values.model = body.model;
    if (body.specification !== undefined) values.specification = body.specification;
    if (body.unit !== undefined) values.unit = body.unit;
    if (body.status !== undefined) values.status = body.status;
    if (body.price !== undefined) values.price = String(body.price);
    if (body.payable !== undefined) values.payable = String(body.payable);
    if (body.payable !== undefined) values.costKnown = true;
    if (body.price !== undefined || body.payable !== undefined) {
      values.profit = String(
        current.costKnown || body.payable !== undefined
          ? (body.price ?? money(current.price)) -
              (body.payable ?? money(current.payable))
          : 0,
      );
    }
    const product = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(productsTable)
        .set(values)
        .where(eq(productsTable.id, id))
        .returning();
      if (updated) {
        await tx.insert(activitiesTable).values(
          signedActivity(req.authUser!, {
            type: "inventory",
            title: "تعديل صنف في المخزون",
            description: `تم تحديث بيانات ${current.name}`,
            amount: 0,
          }),
        );
      }
      return updated;
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(productResponse(product));
  } catch (error) {
    next(error);
  }
});

router.get("/sales", async (_req, res, next) => {
  try {
    const [rows, adjustments] = await Promise.all([
      db.select().from(salesTable).orderBy(desc(salesTable.createdAt)),
      db.select().from(salesAdjustmentsTable),
    ]);
    const adjustmentTotals = new Map<number, number>();
    for (const adjustment of adjustments) {
      adjustmentTotals.set(
        adjustment.saleId,
        (adjustmentTotals.get(adjustment.saleId) ?? 0) +
          money(adjustment.replacementValue) -
          money(adjustment.returnValue),
      );
    }
    res.json(
      GetSalesResponse.parse(
        rows.map((sale) => {
          const adjustedTotal = roundMoney(
            money(sale.total) + (adjustmentTotals.get(sale.id) ?? 0),
          );
          return {
            id: sale.id,
            invoiceNumber: sale.invoiceNumber,
            customerName: sale.customerName,
            total: money(sale.total),
            adjustedTotal,
            netPaid: roundMoney(Math.max(0, adjustedTotal - money(sale.remaining))),
            paidCash: money(sale.paidCash),
            paidBankak: money(sale.paidBankak),
            remaining: money(sale.remaining),
            creditApplied: money(sale.creditApplied),
            paymentMethod: sale.paymentMethod,
            employeeName: sale.employeeName,
            createdAt: iso(sale.createdAt),
          };
        }),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/sales/:id", async (req, res, next) => {
  try {
    const { id } = GetSaleDetailsParams.parse(req.params);
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(eq(salesTable.id, id))
      .limit(1);
    if (!sale) {
      res.status(404).json({ error: "الفاتورة غير موجودة" });
      return;
    }
    const items = await db
      .select()
      .from(saleItemsTable)
      .where(eq(saleItemsTable.saleId, id))
      .orderBy(saleItemsTable.id);
    const adjustments = await db
      .select()
      .from(salesAdjustmentsTable)
      .where(eq(salesAdjustmentsTable.saleId, id))
      .orderBy(desc(salesAdjustmentsTable.createdAt));
    const returnedByItem = new Map<number, number>();
    for (const adjustment of adjustments) {
      returnedByItem.set(
        adjustment.saleItemId,
        (returnedByItem.get(adjustment.saleItemId) ?? 0) +
          money(adjustment.quantity),
      );
    }
    res.json(
      GetSaleDetailsResponse.parse({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        subtotal: money(sale.subtotal),
        discount: money(sale.discount),
        total: money(sale.total),
        paidCash: money(sale.paidCash),
        paidBankak: money(sale.paidBankak),
        remaining: money(sale.remaining),
        creditApplied: money(sale.creditApplied),
        paymentMethod: sale.paymentMethod,
        employeeName: sale.employeeName,
        createdAt: iso(sale.createdAt),
        items: items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: money(item.quantity),
          unitPrice: money(item.unitPrice),
          lineTotal: money(item.lineTotal),
          returnedQuantity: returnedByItem.get(item.id) ?? 0,
        })),
        adjustments: adjustments.map(saleAdjustmentResponse),
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/reports/summary", async (req, res, next) => {
  try {
    const { start, end } = GetReportSummaryQueryParams.parse(req.query);
    const [sales, expenses, adjustments] = await Promise.all([
      db.select().from(salesTable),
      db.select().from(expensesTable),
      db.select().from(salesAdjustmentsTable),
    ]);
    const periodSales = sales.filter((sale) => {
      const date = iso(sale.createdAt).slice(0, 10);
      return date >= start && date <= end;
    });
    const periodExpenses = expenses.filter((expense) => {
      const date = iso(expense.createdAt).slice(0, 10);
      return date >= start && date <= end;
    });
    const periodAdjustments = adjustments.filter((adjustment) => {
      const date = iso(adjustment.createdAt).slice(0, 10);
      return date >= start && date <= end;
    });
    const expensesTotal = periodExpenses.reduce(
      (sum, expense) => sum + money(expense.amount),
      0,
    );
    const common = {
      salesTotal:
        periodSales.reduce((sum, sale) => sum + money(sale.total), 0) +
        periodAdjustments.reduce(
          (sum, adjustment) =>
            sum +
            money(adjustment.replacementValue) -
            money(adjustment.returnValue),
          0,
        ),
      salesCash: periodSales.reduce(
        (sum, sale) => sum + money(sale.paidCash),
        0,
      ) +
        periodAdjustments.reduce(
          (sum, adjustment) =>
            sum +
            money(adjustment.collectionCash) -
            money(adjustment.refundCash),
          0,
        ),
      salesBankak: periodSales.reduce(
        (sum, sale) => sum + money(sale.paidBankak),
        0,
      ) +
        periodAdjustments.reduce(
          (sum, adjustment) =>
            sum +
            money(adjustment.collectionBankak) -
            money(adjustment.refundBankak),
          0,
        ),
      salesRemaining: periodSales.reduce(
        (sum, sale) => sum + money(sale.remaining),
        0,
      ),
      expensesTotal,
      expensesCash: periodExpenses
        .filter((expense) => expense.paymentMethod === "كاش")
        .reduce((sum, expense) => sum + money(expense.amount), 0),
      expensesBankak: periodExpenses
        .filter((expense) => expense.paymentMethod === "بنكك")
        .reduce((sum, expense) => sum + money(expense.amount), 0),
      invoiceCount: periodSales.length,
      expenseCount: periodExpenses.length,
    };
    if (req.authUser?.role === "admin") {
      const grossProfit = periodSales.reduce(
        (sum, sale) => sum + money(sale.grossProfit),
        0,
      ) +
        periodAdjustments.reduce(
          (sum, adjustment) => sum + money(adjustment.profitChange),
          0,
        );
      res.json(
        GetReportSummaryResponse.parse({
          ...common,
          grossProfit,
          netProfit: grossProfit - expensesTotal,
        }),
      );
      return;
    }
    res.json(GetReportSummaryResponse.parse(common));
  } catch (error) {
    next(error);
  }
});

router.post("/sales", async (req, res, next) => {
  try {
    const body = CreateSaleBody.parse(req.body);
    const sale = await postSale(
      {
        transaction: (operation) =>
          db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(763104)`);
            const transaction: SaleTransaction = {
              findProducts: (productIds) =>
                tx
                  .select()
                  .from(productsTable)
                  .where(inArray(productsTable.id, productIds)),
              findCustomer: async (normalizedPhone, customerName) => {
                const [customer] = await tx
                  .select()
                  .from(customersTable)
                  .where(
                    normalizedPhone
                      ? eq(customersTable.phone, normalizedPhone)
                      : eq(customersTable.name, customerName),
                  )
                  .limit(1);
                return customer;
              },
              decrementStock: async (productId, quantity) => {
                const [updated] = await tx
                  .update(productsTable)
                  .set({
                    quantity: sql`${productsTable.quantity} - ${String(quantity)}`,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(productsTable.id, productId),
                      gte(productsTable.quantity, String(quantity)),
                    ),
                  )
                  .returning({ quantity: productsTable.quantity });
                return updated ? money(updated.quantity) : undefined;
              },
              markProductSold: async (productId) => {
                await tx
                  .update(productsTable)
                  .set({ status: "مباع", updatedAt: new Date() })
                  .where(eq(productsTable.id, productId));
              },
              createSale: async (values) => {
                const [created] = await tx
                  .insert(salesTable)
                  .values(values)
                  .returning();
                return created;
              },
              createSaleItem: async (values) => {
                await tx.insert(saleItemsTable).values(values);
              },
              updateCustomerBalance: async (
                customerId,
                balanceIncrease,
                purchaseIncrease,
              ) => {
                await tx
                  .update(customersTable)
                  .set({
                    balance: sql`${customersTable.balance} + ${String(balanceIncrease)}`,
                    totalPurchases: sql`${customersTable.totalPurchases} + ${String(purchaseIncrease)}`,
                  })
                  .where(eq(customersTable.id, customerId));
              },
              createCustomer: async (values) => {
                await tx.insert(customersTable).values(values);
              },
              createActivity: async (values) => {
                await tx
                  .insert(activitiesTable)
                  .values(signedActivity(req.authUser!, values));
              },
            };
            return operation(transaction);
          }),
      },
      body,
      req.authUser!.displayName,
    );
    res.status(201).json({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerName: sale.customerName,
      total: money(sale.total),
      adjustedTotal: money(sale.total),
      netPaid: money(sale.total) - money(sale.remaining),
      paidCash: money(sale.paidCash),
      paidBankak: money(sale.paidBankak),
      remaining: money(sale.remaining),
      creditApplied: money(sale.creditApplied),
      paymentMethod: sale.paymentMethod,
      employeeName: sale.employeeName,
      createdAt: iso(sale.createdAt),
    });
    return;
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        INVALID_PRODUCT: "أحد المنتجات غير موجود",
        UNAVAILABLE_PRODUCT: "أحد المنتجات موقوف أو غير متاح للبيع",
        PRODUCT_COST_PENDING: "لا يمكن بيع صنف جديد قبل تسجيل تكلفة المورد من المدير",
        INSUFFICIENT_STOCK: "المخزون غير كافٍ لإتمام البيع",
        DISCOUNT_EXCEEDS_SUBTOTAL: "قيمة الخصم لا يمكن أن تتجاوز مجموع الفاتورة.",
        SALE_BELOW_COST:
          "إجمالي سعر البيع أقل من تكلفة المورد المسجلة. راجع سعر البيع أو تكلفة الصنف من المخزون.",
        OVERPAYMENT: "قيمة الدفع أكبر من إجمالي الفاتورة",
        PHONE_REQUIRED_FOR_CREDIT:
          "رقم هاتف العميل مطلوب عند وجود مبلغ آجل",
        PHONE_REQUIRED_FOR_CUSTOMER:
          "رقم هاتف سوداني صحيح مطلوب لحفظ بيانات العميل في قائمة العملاء.",
      };
      const message = messages[error.message];
      if (message) {
        res.status(400).json({ error: message });
        return;
      }
    }
    next(error);
  }
});

router.post("/sales/:id/adjustments", async (req, res, next) => {
  try {
    const { id } = CreateSaleAdjustmentParams.parse(req.params);
    const body = CreateSaleAdjustmentBody.parse(req.body);
    const proofPath = body.refundProofPath ?? null;

    if (proofPath) {
      try {
        if (!proofPath.startsWith("/objects/uploads/")) {
          throw new Error("INVALID_REFUND_PROOF");
        }
        const proof = await objectStorage.getObjectEntityFile(proofPath);
        const [metadata] = await proof.getMetadata();
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(
            String(metadata.contentType),
          ) ||
          Number(metadata.size ?? 0) > 10 * 1024 * 1024
        ) {
          throw new Error("INVALID_REFUND_PROOF");
        }
      } catch {
        throw new Error("INVALID_REFUND_PROOF");
      }
    }

    const adjustment = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(763104)`);
      const [existing] = await tx
        .select()
        .from(salesAdjustmentsTable)
        .where(eq(salesAdjustmentsTable.requestId, body.requestId))
        .limit(1);
      if (existing) return existing;

      const [sale] = await tx
        .select()
        .from(salesTable)
        .where(eq(salesTable.id, id))
        .limit(1);
      if (!sale) throw new Error("SALE_NOT_FOUND");
      const saleAge = Date.now() - sale.createdAt.getTime();
      if (saleAge < 0 || saleAge > 3 * 24 * 60 * 60 * 1000) {
        throw new Error("RETURN_WINDOW_EXPIRED");
      }

      const [saleItem] = await tx
        .select()
        .from(saleItemsTable)
        .where(
          and(
            eq(saleItemsTable.id, body.saleItemId),
            eq(saleItemsTable.saleId, id),
          ),
        )
        .limit(1);
      if (!saleItem) throw new Error("SALE_ITEM_NOT_FOUND");

      const itemAdjustments = await tx
        .select()
        .from(salesAdjustmentsTable)
        .where(eq(salesAdjustmentsTable.saleItemId, saleItem.id));
      const alreadyReturned = itemAdjustments.reduce(
        (sum, item) => sum + money(item.quantity),
        0,
      );
      const quantity = roundMoney(body.quantity);
      const availableToReturn = roundMoney(
        money(saleItem.quantity) - alreadyReturned,
      );
      if (quantity <= 0 || quantity > availableToReturn) {
        throw new Error("RETURN_QUANTITY_EXCEEDED");
      }

      const subtotal = money(sale.subtotal);
      const lineTotal = money(saleItem.lineTotal);
      const lineQuantity = money(saleItem.quantity);
      const discountShare =
        subtotal > 0
          ? money(sale.discount) * (lineTotal / subtotal) * (quantity / lineQuantity)
          : 0;
      const returnValue = roundMoney(
        Math.max(0, quantity * money(saleItem.unitPrice) - discountShare),
      );
      const originalCost = roundMoney(
        money(saleItem.unitCost) > 0
          ? money(saleItem.unitCost) * quantity
          : subtotal > 0
            ? money(sale.proceeds) *
              (lineTotal / subtotal) *
              (quantity / lineQuantity)
            : 0,
      );
      const debtReduction = roundMoney(
        Math.min(returnValue, money(sale.remaining)),
      );

      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(
          sale.customerPhone
            ? eq(customersTable.phone, sale.customerPhone)
            : eq(customersTable.name, sale.customerName.trim()),
        )
        .limit(1);
      if (money(sale.remaining) > 0 && !customer) {
        throw new Error("CUSTOMER_RECORD_MISSING");
      }

      let replacementProduct: typeof productsTable.$inferSelect | null = null;
      let replacementQuantity: number | null = null;
      let replacementValue = 0;
      let replacementCost = 0;
      if (body.kind === "exchange") {
        if (!body.replacementProductId || !body.replacementQuantity) {
          throw new Error("REPLACEMENT_REQUIRED");
        }
        const [selectedProduct] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, body.replacementProductId))
          .limit(1);
        if (!selectedProduct) throw new Error("INVALID_REPLACEMENT");
        if (
          selectedProduct.status !== "متوفر" ||
          money(selectedProduct.quantity) < body.replacementQuantity
        ) {
          throw new Error("REPLACEMENT_UNAVAILABLE");
        }
        if (!selectedProduct.costKnown) {
          throw new Error("PRODUCT_COST_PENDING");
        }
        replacementProduct = selectedProduct;
        replacementQuantity = roundMoney(body.replacementQuantity);
        replacementValue = roundMoney(
          money(selectedProduct.price) * replacementQuantity,
        );
        replacementCost = roundMoney(
          money(selectedProduct.payable) * replacementQuantity,
        );
      } else if (body.replacementProductId || body.replacementQuantity) {
        throw new Error("UNEXPECTED_REPLACEMENT");
      }

      const replacementCredit = roundMoney(
        Math.max(0, returnValue - debtReduction),
      );
      const difference =
        body.kind === "exchange"
          ? roundMoney(replacementValue - replacementCredit)
          : -roundMoney(returnValue - debtReduction);
      const settlementMethod = body.settlementMethod ?? null;
      let refundCash = 0;
      let refundBankak = 0;
      let creditRefund = 0;
      let collectionCash = 0;
      let collectionBankak = 0;
      let additionalDebt = 0;
      const refundAmount = Math.max(0, -difference);
      const collectionAmount = Math.max(0, difference);

      if (refundAmount > 0) {
        if (settlementMethod === "كاش") refundCash = refundAmount;
        else if (settlementMethod === "بنكك") refundBankak = refundAmount;
        else if (settlementMethod === "رصيد" && customer) {
          creditRefund = refundAmount;
        } else {
          throw new Error("REFUND_METHOD_REQUIRED");
        }
      } else if (collectionAmount > 0) {
        if (settlementMethod === "كاش") collectionCash = collectionAmount;
        else if (settlementMethod === "بنكك") {
          collectionBankak = collectionAmount;
        } else {
          throw new Error("COLLECTION_METHOD_REQUIRED");
        }
      }

      const needsProof = refundCash > 0 || refundBankak > 0;
      if (needsProof && !proofPath) throw new Error("REFUND_PROOF_REQUIRED");
      if (!needsProof && proofPath) throw new Error("UNEXPECTED_REFUND_PROOF");

      if (replacementProduct && replacementQuantity !== null) {
        const updated = await tx
          .update(productsTable)
          .set({
            quantity: sql`${productsTable.quantity} - ${String(replacementQuantity)}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productsTable.id, replacementProduct.id),
              eq(productsTable.status, "متوفر"),
              gte(productsTable.quantity, String(replacementQuantity)),
            ),
          )
          .returning({ quantity: productsTable.quantity });
        if (!updated.length) throw new Error("REPLACEMENT_UNAVAILABLE");
        if (money(updated[0].quantity) === 0) {
          await tx
            .update(productsTable)
            .set({ status: "مباع", updatedAt: new Date() })
            .where(eq(productsTable.id, replacementProduct.id));
        }
      }

      // Returned units are treated as damaged and intentionally do not re-enter sellable stock.
      const newRemaining = roundMoney(
        Math.max(
          0,
          money(sale.remaining) - debtReduction + additionalDebt,
        ),
      );
      await tx
        .update(salesTable)
        .set({ remaining: String(newRemaining) })
        .where(eq(salesTable.id, sale.id));

      if (customer) {
        const balanceChange = roundMoney(
          -debtReduction + additionalDebt - creditRefund,
        );
        const purchasesChange = roundMoney(-returnValue + replacementValue);
        await tx
          .update(customersTable)
          .set({
            balance: sql`${customersTable.balance} + ${String(balanceChange)}`,
            totalPurchases: sql`${customersTable.totalPurchases} + ${String(purchasesChange)}`,
          })
          .where(eq(customersTable.id, customer.id));
      } else if (additionalDebt > 0 || creditRefund > 0) {
        throw new Error("CUSTOMER_RECORD_MISSING");
      }

      const proceedsChange = roundMoney(replacementCost);
      const profitChange = roundMoney(
        -returnValue + replacementValue - replacementCost,
      );
      const [created] = await tx
        .insert(salesAdjustmentsTable)
        .values({
          requestId: body.requestId,
          saleId: sale.id,
          saleItemId: saleItem.id,
          kind: body.kind,
          condition: "تالف",
          quantity: String(quantity),
          returnValue: String(returnValue),
          replacementProductId: replacementProduct?.id ?? null,
          replacementProductName: replacementProduct?.name ?? null,
          replacementQuantity:
            replacementQuantity === null ? null : String(replacementQuantity),
          replacementValue: String(replacementValue),
          damagedCost: String(originalCost),
          debtReduction: String(debtReduction),
          additionalDebt: String(additionalDebt),
          refundCash: String(refundCash),
          refundBankak: String(refundBankak),
          creditRefund: String(creditRefund),
          collectionCash: String(collectionCash),
          collectionBankak: String(collectionBankak),
          settlementMethod,
          refundProofPath: proofPath,
          proceedsChange: String(proceedsChange),
          profitChange: String(profitChange),
          employeeName: req.authUser!.displayName,
        })
        .returning();
      await tx.insert(activitiesTable).values(
        signedActivity(req.authUser!, {
          type: body.kind,
          title: body.kind === "return" ? "استرجاع صنف من فاتورة" : "استبدال صنف من فاتورة",
          description: `تم تسجيل ${body.kind === "return" ? "استرجاع" : "استبدال"} صنف من الفاتورة ${sale.invoiceNumber}`,
          amount: String(Math.abs(replacementValue - returnValue)),
        }),
      );
      return created;
    });

    res.status(201).json(
      CreateSaleAdjustmentResponse.parse(saleAdjustmentResponse(adjustment)),
    );
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        SALE_NOT_FOUND: "الفاتورة غير موجودة",
        RETURN_WINDOW_EXPIRED: "انتهت مهلة الاسترجاع والاستبدال المحددة بثلاثة أيام",
        SALE_ITEM_NOT_FOUND: "الصنف غير موجود في هذه الفاتورة",
        RETURN_QUANTITY_EXCEEDED: "الكمية تتجاوز الكمية المتبقية للاسترجاع",
        CUSTOMER_RECORD_MISSING: "تعذر العثور على سجل العميل لتحديث الرصيد",
        INVALID_REPLACEMENT: "المنتج البديل غير موجود",
        REPLACEMENT_REQUIRED: "اختر المنتج البديل والكمية",
        REPLACEMENT_UNAVAILABLE: "الكمية المتاحة من المنتج البديل غير كافية",
        PRODUCT_COST_PENDING: "لا يمكن اختيار منتج لم تُسجل تكلفته بعد",
        UNEXPECTED_REPLACEMENT: "بيانات المنتج البديل غير متوقعة لعملية الاسترجاع",
        REFUND_METHOD_REQUIRED: "اختر طريقة رد المبلغ",
        COLLECTION_METHOD_REQUIRED: "اختر طريقة تحصيل الفرق",
        REFUND_PROOF_REQUIRED: "صورة إشعار رد المبلغ مطلوبة",
        INVALID_REFUND_PROOF: "صورة الإشعار غير صالحة أو غير موجودة",
        UNEXPECTED_REFUND_PROOF: "لا تُرفق صورة إلا عند رد مبلغ نقدي أو عبر بنكك",
      };
      const message = messages[error.message];
      if (message) {
        res.status(400).json({ error: message });
        return;
      }
    }
    next(error);
  }
});

router.get("/settlements", requireSeller, async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(settlementsTable)
      .orderBy(desc(settlementsTable.createdAt));
    res.json(
      GetSettlementsResponse.parse(
        rows.map((item) => ({
          id: item.id,
          channel: item.channel,
          paymentMethod: item.paymentMethod,
          amount: money(item.amount),
          reference: item.reference,
          notes: item.notes,
          createdAt: iso(item.createdAt),
        })),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/settlements", requireSeller, async (req, res, next) => {
  try {
    const body = CreateSettlementBody.parse(req.body);
    const settlement = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(763104)`);
      const sales = await tx.select().from(salesTable);
      const adjustments = await tx.select().from(salesAdjustmentsTable);
      const settlements = await tx.select().from(settlementsTable);
      const expenses = await tx.select().from(expensesTable);
      const outstanding =
        sales.reduce((sum, sale) => sum + money(sale.proceeds), 0) -
        settlements.reduce((sum, item) => sum + money(item.amount), 0) +
        adjustments.reduce((sum, item) => sum + money(item.proceedsChange), 0);
      const methodSales = sales.reduce(
        (sum, sale) =>
          sum +
          money(
            body.paymentMethod === "كاش" ? sale.paidCash : sale.paidBankak,
          ),
        0,
      ) +
        adjustments.reduce(
          (sum, item) =>
            sum +
            money(
              body.paymentMethod === "كاش"
                ? money(item.collectionCash) - money(item.refundCash)
                : money(item.collectionBankak) - money(item.refundBankak),
            ),
          0,
        );
      const methodSettlements = settlements
        .filter((item) => item.paymentMethod === body.paymentMethod)
        .reduce((sum, item) => sum + money(item.amount), 0);
      const methodExpenses = expenses
        .filter((item) => item.paymentMethod === body.paymentMethod)
        .reduce((sum, item) => sum + money(item.amount), 0);
      const openingBalance = body.paymentMethod === "كاش" ? 1000000 : 2000000;
      const available =
        openingBalance + methodSales - methodSettlements - methodExpenses;
      if (body.amount > outstanding) throw new Error("EXCEEDS_PROCEEDS");
      if (body.amount > available) throw new Error("EXCEEDS_BALANCE");
      const [created] = await tx
        .insert(settlementsTable)
        .values({ ...body, amount: String(body.amount) })
        .returning();
      await tx.insert(activitiesTable).values(
        signedActivity(req.authUser!, {
          type: "settlement",
          title: `توريد عبر ${body.channel}`,
          description: `تم تسجيل توريد ${body.paymentMethod}`,
          amount: String(body.amount),
        }),
      );
      return created;
    });
    res.status(201).json({
      id: settlement.id,
      channel: settlement.channel,
      paymentMethod: settlement.paymentMethod,
      amount: money(settlement.amount),
      reference: settlement.reference,
      notes: settlement.notes,
      createdAt: iso(settlement.createdAt),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EXCEEDS_PROCEEDS") {
      res.status(400).json({ error: "المبلغ أكبر من مستحق حصيلة المبيعات" });
      return;
    }
    if (error instanceof Error && error.message === "EXCEEDS_BALANCE") {
      res.status(400).json({ error: "الرصيد المتاح لا يكفي لإتمام التوريد" });
      return;
    }
    next(error);
  }
});

router.get("/expenses", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(expensesTable)
      .orderBy(desc(expensesTable.createdAt));
    res.json(
      GetExpensesResponse.parse(
        rows.map((item) => ({
          id: item.id,
          category: item.category,
          description: item.description,
          amount: money(item.amount),
          paymentMethod: item.paymentMethod,
          beneficiary: item.beneficiary,
          reference: item.reference,
          createdAt: iso(item.createdAt),
        })),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/expenses", async (req, res, next) => {
  try {
    const body = CreateExpenseBody.parse(req.body);
    const expense = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(763104)`);
      const sales = await tx.select().from(salesTable);
      const adjustments = await tx.select().from(salesAdjustmentsTable);
      const settlements = await tx.select().from(settlementsTable);
      const expenses = await tx.select().from(expensesTable);
      const methodSales = sales.reduce(
        (sum, sale) =>
          sum +
          money(
            body.paymentMethod === "كاش" ? sale.paidCash : sale.paidBankak,
          ),
        0,
      ) +
        adjustments.reduce(
          (sum, item) =>
            sum +
            (body.paymentMethod === "كاش"
              ? money(item.collectionCash) - money(item.refundCash)
              : money(item.collectionBankak) - money(item.refundBankak)),
          0,
        );
      const methodSettlements = settlements
        .filter((item) => item.paymentMethod === body.paymentMethod)
        .reduce((sum, item) => sum + money(item.amount), 0);
      const methodExpenses = expenses
        .filter((item) => item.paymentMethod === body.paymentMethod)
        .reduce((sum, item) => sum + money(item.amount), 0);
      const openingBalance = body.paymentMethod === "كاش" ? 1000000 : 2000000;
      const available =
        openingBalance + methodSales - methodSettlements - methodExpenses;
      if (body.amount > available) throw new Error("EXCEEDS_BALANCE");
      const [created] = await tx
        .insert(expensesTable)
        .values({
          ...body,
          amount: String(body.amount),
        })
        .returning();
      await tx.insert(activitiesTable).values(
        signedActivity(req.authUser!, {
          type: "expense",
          title: "مصروف جديد",
          description: body.description,
          amount: String(body.amount),
        }),
      );
      return created;
    });
    res.status(201).json({
      id: expense.id,
      category: expense.category,
      description: expense.description,
      amount: money(expense.amount),
      paymentMethod: expense.paymentMethod,
      beneficiary: expense.beneficiary,
      reference: expense.reference,
      createdAt: iso(expense.createdAt),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EXCEEDS_BALANCE") {
      res.status(400).json({ error: "الرصيد المتاح لا يكفي لتسجيل المصروف" });
      return;
    }
    next(error);
  }
});

router.get("/customers", async (_req, res, next) => {
  try {
    const rows = await db.select().from(customersTable).orderBy(desc(customersTable.createdAt));
    res.json(
      GetCustomersResponse.parse(
        rows.map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          balance: money(customer.balance),
          totalPurchases: money(customer.totalPurchases),
        })),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/customers", async (req, res, next) => {
  try {
    const body = CreateCustomerBody.parse(req.body);
    const phone = normalizePhone(body.phone);
    if (!phone) {
      res.status(400).json({ error: "رقم الهاتف مطلوب" });
      return;
    }
    const [existing] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.phone, phone))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "يوجد عميل مسجل بهذا الرقم" });
      return;
    }
    const customer = await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customersTable)
        .values({ ...body, phone })
        .returning();
      await tx.insert(activitiesTable).values(
        signedActivity(req.authUser!, {
          type: "customer",
          title: "إضافة عميل جديد",
          description: `تم تسجيل العميل ${customer.name}`,
          amount: 0,
        }),
      );
      return customer;
    });
    res.status(201).json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      balance: money(customer.balance),
      totalPurchases: money(customer.totalPurchases),
    });
  } catch (error) {
    next(error);
  }
});

export default router;