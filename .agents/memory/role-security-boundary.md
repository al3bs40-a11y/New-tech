---
name: Role security boundary
description: Durable authorization rule for NEWTECH administrator and seller roles.
---

All privileged operations must be enforced server-side. Sellers may record settlements, add products, edit selling prices, record expenses, and view cash/Bankak balances. Both admins and sellers may read settlement records and reports; supplier cost, profit, and admin-only financial summaries remain restricted from sellers.

**Why:** UI-only restrictions previously left privileged APIs exposed. Seller-created products also need a cost-known state so incomplete costs cannot inflate reported profit. The user explicitly approved admin read access to the settlement report.

**How to apply:** Keep role checks and field whitelists on the API. Settlement reads may serve admins and sellers, while settlement recording remains seller-only. Sellers may only edit product sale price; new products stay inactive until an admin records supplier cost. Expenses are shared.