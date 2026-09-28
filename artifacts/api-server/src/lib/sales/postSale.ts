import { randomUUID } from "node:crypto";

export interface SalePostingInput {
  customerName: string;
  customerPhone?: string | null;
  items: Array<{ productId: number; quantity: number; unitPrice: number }>;
  paidCash: number;
  paidBankak: number;
  discount?: number;
}

export interface SaleProduct {
  id: number;
  name: string;
  quantity: string | number;
  price: string | number;
  payable: string | number;
  costKnown: boolean;
  status: string;
}

export interface SaleCustomer {
  id: number;
  balance: string | number;
}

export interface NewSale {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  subtotal: string;
  discount: string;
  total: string;
  proceeds: string;
  grossProfit: string;
  paidCash: string;
  paidBankak: string;
  remaining: string;
  creditApplied: string;
  employeeName: string;
  paymentMethod: string;
}

export interface SaleResult extends NewSale {
  id: number;
  createdAt: Date;
}

export interface SaleTransaction {
  findProducts(productIds: number[]): Promise<SaleProduct[]>;
  findCustomer(
    normalizedPhone: string | null,
    customerName: string,
  ): Promise<SaleCustomer | undefined>;
  decrementStock(productId: number, quantity: number): Promise<number | undefined>;
  markProductSold(productId: number): Promise<void>;
  createSale(values: NewSale): Promise<SaleResult>;
  createSaleItem(values: {
    saleId: number;
    productId: number;
    productName: string;
    quantity: string;
    unitPrice: string;
    unitCost: string;
    lineTotal: string;
  }): Promise<void>;
  updateCustomerBalance(
    customerId: number,
    balanceIncrease: number,
    purchaseIncrease: number,
  ): Promise<void>;
  createCustomer(values: {
    name: string;
    phone: string;
    balance: string;
    totalPurchases: string;
  }): Promise<void>;
  createActivity(values: {
    type: "sale";
    title: string;
    description: string;
    amount: string;
  }): Promise<void>;
}

export interface SaleDatabase {
  transaction(
    operation: (tx: SaleTransaction) => Promise<SaleResult>,
  ): Promise<SaleResult>;
}

const money = (value: string | number | null | undefined): number =>
  Number(value ?? 0);

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

export async function postSale(
  db: SaleDatabase,
  body: SalePostingInput,
  employeeName: string,
): Promise<SaleResult> {
  const quantities = new Map<number, number>();
  for (const item of body.items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }

  return db.transaction(async (tx) => {
    const productIds = [...quantities.keys()];
    const products = await tx.findProducts(productIds);
    const productMap = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) {
      throw new Error("INVALID_PRODUCT");
    }

    const normalizedItems = productIds.map((productId) => ({
      product: productMap.get(productId)!,
      quantity: quantities.get(productId)!,
    }));
    if (normalizedItems.some((item) => item.product.status !== "متوفر")) {
      throw new Error("UNAVAILABLE_PRODUCT");
    }
    if (normalizedItems.some((item) => !item.product.costKnown)) {
      throw new Error("PRODUCT_COST_PENDING");
    }

    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + item.quantity * money(item.product.price),
      0,
    );
    const discount = body.discount ?? 0;
    const total = subtotal - discount;
    const payable = normalizedItems.reduce(
      (sum, item) => sum + item.quantity * money(item.product.payable),
      0,
    );
    const paid = body.paidCash + body.paidBankak;
    if (discount > subtotal) throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL");
    if (total < payable) throw new Error("SALE_BELOW_COST");
    if (paid > total) {
      throw new Error("OVERPAYMENT");
    }

    const normalizedPhone = body.customerPhone
      ? normalizePhone(body.customerPhone)
      : "";
    const customerName = body.customerName.trim();
    const customer = await tx.findCustomer(normalizedPhone || null, customerName);
    const creditApplied = Math.min(
      Math.max(0, -money(customer?.balance)),
      Math.max(0, total - paid),
    );
    const remaining = total - paid - creditApplied;
    if (remaining > 0 && !normalizedPhone) {
      throw new Error("PHONE_REQUIRED_FOR_CREDIT");
    }
    if (!customer && customerName !== "عميل نقدي" && !normalizedPhone) {
      throw new Error("PHONE_REQUIRED_FOR_CUSTOMER");
    }

    for (const item of normalizedItems) {
      const quantity = await tx.decrementStock(
        item.product.id,
        item.quantity,
      );
      if (quantity === undefined) throw new Error("INSUFFICIENT_STOCK");
      if (money(quantity) === 0) {
        await tx.markProductSold(item.product.id);
      }
    }

    const invoiceNumber = `INV-${new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const created = await tx.createSale({
      invoiceNumber,
      customerName,
      customerPhone: normalizedPhone || null,
      subtotal: String(subtotal),
      discount: String(discount),
      total: String(total),
      proceeds: String(payable),
      grossProfit: String(total - payable),
      paidCash: String(body.paidCash),
      paidBankak: String(body.paidBankak),
      remaining: String(remaining),
      creditApplied: String(creditApplied),
      employeeName,
      paymentMethod:
        [
          body.paidCash > 0 ? "كاش" : null,
          body.paidBankak > 0 ? "بنكك" : null,
          creditApplied > 0 ? "رصيد العميل" : null,
        ]
          .filter(Boolean)
          .join(" + ") || "آجل",
    });

    for (const item of normalizedItems) {
      await tx.createSaleItem({
        saleId: created.id,
        productId: item.product.id,
        productName: item.product.name,
        quantity: String(item.quantity),
        unitPrice: String(item.product.price),
        unitCost: String(item.product.payable),
        lineTotal: String(item.quantity * money(item.product.price)),
      });
    }

    if (customer) {
      await tx.updateCustomerBalance(customer.id, total - paid, total);
    } else if (
      normalizedPhone &&
      customerName !== "عميل نقدي"
    ) {
      await tx.createCustomer({
        name: customerName,
        phone: normalizedPhone,
        balance: String(total - paid),
        totalPurchases: String(total),
      });
    }

    await tx.createActivity({
      type: "sale",
      title: "فاتورة مبيعات جديدة",
      description: `تم إنشاء الفاتورة ${invoiceNumber}`,
      amount: String(total),
    });
    return created;
  });
}