export function canReadSettlementReport(role: string | undefined): boolean {
  return role === "admin" || role === "seller";
}
