import assert from "node:assert/strict";
import test from "node:test";
import { canReadSettlementReport } from "./access.ts";

test("settlement report is readable by admins and sellers only", () => {
  assert.equal(canReadSettlementReport("admin"), true);
  assert.equal(canReadSettlementReport("seller"), true);
  assert.equal(canReadSettlementReport(undefined), false);
  assert.equal(canReadSettlementReport("guest"), false);
});
