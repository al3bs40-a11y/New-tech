---
name: Sales posting invariants
description: Business rules that keep NEWTECH sales, inventory, and customer balances reconcilable.
---

A sale may use only products marked «متوفر». Posting must atomically decrement stock, create the invoice and lines, attribute the employee, and update the matched customer's purchases and debt.

Credit sales require a normalized, unique customer phone so the remaining amount cannot become an orphaned receivable. Seller-facing product data must omit payable and profit.

Return/exchange adjustments must be transactional and auditable. Returned defective units stay out of sellable stock, and their original cost remains a loss rather than being reversed from proceeds. Apply returns against invoice debt first; refund only any excess. Cash/Bankak refunds require a private proof image, while exchange shortfalls must be collected through cash or Bankak.

**Why:** End-to-end review found that mismatched status values hid valid stock from POS and that invoices could be correct while customer totals stayed stale or unlinked.

**How to apply:** Keep these checks on the server, mirror canonical status values in the UI, and invalidate products, sales, customers, dashboard, and activities after a sale or adjustment succeeds. Keep customer debt, cash/Bankak, damaged cost, replacement stock, and reporting changes in the same database transaction.