import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  specification: text("specification").notNull(),
  unit: text("unit").notNull().default("قطعة"),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull().default("0"),
  price: numeric("price", { precision: 14, scale: 2 }).notNull().default("0"),
  payable: numeric("payable", { precision: 14, scale: 2 }).notNull().default("0"),
  profit: numeric("profit", { precision: 14, scale: 2 }).notNull().default("0"),
  costKnown: boolean("cost_known").notNull().default(true),
  status: text("status").notNull().default("متوفر"),
  barcode: text("barcode").notNull().unique(),
  imei: text("imei"),
  serialNumber: text("serial_number"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  address: text("address"),
  notes: text("notes"),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  totalPurchases: numeric("total_purchases", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerName: text("customer_name").notNull().default("عميل نقدي"),
  customerPhone: text("customer_phone"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  proceeds: numeric("proceeds", { precision: 14, scale: 2 }).notNull().default("0"),
  grossProfit: numeric("gross_profit", { precision: 14, scale: 2 }).notNull().default("0"),
  paidCash: numeric("paid_cash", { precision: 14, scale: 2 }).notNull().default("0"),
  paidBankak: numeric("paid_bankak", { precision: 14, scale: 2 }).notNull().default("0"),
  remaining: numeric("remaining", { precision: 14, scale: 2 }).notNull().default("0"),
  creditApplied: numeric("credit_applied", { precision: 14, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull(),
  employeeName: text("employee_name").notNull().default("المدير"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const saleItemsTable = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
});

export const salesAdjustmentsTable = pgTable("sales_adjustments", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItemsTable.id),
  kind: text("kind").notNull(),
  condition: text("condition").notNull().default("تالف"),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  returnValue: numeric("return_value", { precision: 14, scale: 2 }).notNull(),
  replacementProductId: integer("replacement_product_id").references(() => productsTable.id),
  replacementProductName: text("replacement_product_name"),
  replacementQuantity: numeric("replacement_quantity", { precision: 14, scale: 2 }),
  replacementValue: numeric("replacement_value", { precision: 14, scale: 2 }).notNull().default("0"),
  damagedCost: numeric("damaged_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  debtReduction: numeric("debt_reduction", { precision: 14, scale: 2 }).notNull().default("0"),
  additionalDebt: numeric("additional_debt", { precision: 14, scale: 2 }).notNull().default("0"),
  refundCash: numeric("refund_cash", { precision: 14, scale: 2 }).notNull().default("0"),
  refundBankak: numeric("refund_bankak", { precision: 14, scale: 2 }).notNull().default("0"),
  creditRefund: numeric("credit_refund", { precision: 14, scale: 2 }).notNull().default("0"),
  collectionCash: numeric("collection_cash", { precision: 14, scale: 2 }).notNull().default("0"),
  collectionBankak: numeric("collection_bankak", { precision: 14, scale: 2 }).notNull().default("0"),
  settlementMethod: text("settlement_method"),
  refundProofPath: text("refund_proof_path"),
  proceedsChange: numeric("proceeds_change", { precision: 14, scale: 2 }).notNull().default("0"),
  profitChange: numeric("profit_change", { precision: 14, scale: 2 }).notNull().default("0"),
  employeeName: text("employee_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settlementsTable = pgTable("settlements", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),
  paymentMethod: text("payment_method").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  beneficiary: text("beneficiary").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  actorUsername: text("actor_username"),
  actorDisplayName: text("actor_display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({ id: true });
export const insertSettlementSchema = createInsertSchema(settlementsTable).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });

export type Product = typeof productsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Customer = typeof customersTable.$inferSelect;
export type Sale = typeof salesTable.$inferSelect;
export type SaleItem = typeof saleItemsTable.$inferSelect;
export type Settlement = typeof settlementsTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;