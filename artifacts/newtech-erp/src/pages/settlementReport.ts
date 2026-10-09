export type SettlementReportRecord = {
  channel: string;
  paymentMethod: string;
  amount: number;
  createdAt: string;
};

export type SettlementReportRange = {
  start: string;
  end: string;
};

export type SettlementReportTimeZone = 'Africa/Khartoum' | 'UTC';

const DATE_FORMAT_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
} as const;
const DATE_FORMATTERS: Record<SettlementReportTimeZone, Intl.DateTimeFormat> = {
  'Africa/Khartoum': new Intl.DateTimeFormat('en', {
    ...DATE_FORMAT_OPTIONS,
    timeZone: 'Africa/Khartoum',
  }),
  UTC: new Intl.DateTimeFormat('en', {
    ...DATE_FORMAT_OPTIONS,
    timeZone: 'UTC',
  }),
};

function reportDateKey(
  value: string | Date,
  timeZone: SettlementReportTimeZone = 'Africa/Khartoum',
): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(
    DATE_FORMATTERS[timeZone].formatToParts(date).map(({ type, value: part }) => [type, part]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getDefaultSettlementReportRange(
  now: Date = new Date(),
): SettlementReportRange {
  const end = reportDateKey(now);
  return { start: `${end.slice(0, 7)}-01`, end };
}

export function formatSettlementDate(
  value: string,
  timeZone: SettlementReportTimeZone = 'Africa/Khartoum',
): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function filterSettlementsByDateRange<T extends SettlementReportRecord>(
  settlements: T[],
  range: SettlementReportRange,
  timeZone: SettlementReportTimeZone = 'Africa/Khartoum',
): T[] {
  if (!range.start || !range.end || range.start > range.end) return [];

  return settlements.filter((settlement) => {
    const date = reportDateKey(settlement.createdAt, timeZone);
    return date >= range.start && date <= range.end;
  });
}

export function summarizeSettlements(settlements: SettlementReportRecord[]) {
  return settlements.reduce(
    (totals, settlement) => {
      const amount = Number.isFinite(settlement.amount) ? settlement.amount : 0;
      totals.total += amount;

      if (settlement.channel === 'عمر') totals.omar += amount;
      else if (settlement.channel === 'سيف') totals.saif += amount;

      if (settlement.paymentMethod === 'كاش') totals.cash += amount;
      else if (settlement.paymentMethod === 'بنكك') totals.bankak += amount;

      return totals;
    },
    { count: settlements.length, total: 0, omar: 0, saif: 0, cash: 0, bankak: 0 },
  );
}
