---
name: Seller account history
description: Permanent removal of the built-in seller and preservation of operation attribution.
---

The built-in «البايع» / «موظف المبيعات» account is permanently removed and must not be recreated on startup. Administrators may still create other seller accounts.

Deleting an account must not delete invoices, adjustments, expenses, settlements, or activity records. New activity entries keep the actor's account ID plus username and display-name snapshots; deletion nulls only the user reference so those snapshots remain. Existing activity rows without known actors stay unattributed rather than being guessed.

**Why:** The user explicitly chose permanent account removal while preserving prior records, and requested an account signature for each new operation.

**How to apply:** Keep seller deletion admin-only, never reintroduce the default seller seed, and derive new activity actors from the authenticated server session rather than client input.