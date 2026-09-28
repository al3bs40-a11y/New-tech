---
name: Role security boundary
description: Durable authorization rule for NEWTECH administrator and seller roles.
---

All privileged operations must be enforced server-side. The seller may record/view settlements, add products, edit selling prices, record expenses, and view cash/Bankak balances. Supplier cost, profit, and admin proceeds summaries remain restricted.

**Why:** UI-only restrictions previously left privileged APIs exposed. Seller-created products also need a cost-known state so incomplete costs cannot inflate reported profit.

**How to apply:** Keep role checks and field whitelists on the API. Sellers may only edit product sale price; new products stay inactive until an admin records supplier cost. Expenses are shared, while settlements are seller-only.