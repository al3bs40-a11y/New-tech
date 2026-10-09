import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterSettlementsByDateRange,
  formatSettlementDate,
  getDefaultSettlementReportRange,
  summarizeSettlements,
} from './settlementReport.ts';

test('the default report range is the current month in Khartoum time', () => {
  assert.deepEqual(
    getDefaultSettlementReportRange(new Date('2026-10-04T23:30:00.000Z')),
    { start: '2026-10-01', end: '2026-10-05' },
  );
});

test('date filtering includes both endpoints using Khartoum calendar days', () => {
  const entries = [
    { id: 1, channel: 'عمر', paymentMethod: 'كاش', amount: 100, createdAt: '2026-10-04T22:30:00.000Z' },
    { id: 2, channel: 'سيف', paymentMethod: 'بنكك', amount: 200, createdAt: '2026-10-05T21:59:00.000Z' },
    { id: 3, channel: 'عمر', paymentMethod: 'كاش', amount: 300, createdAt: '2026-10-05T22:30:00.000Z' },
  ];

  assert.deepEqual(
    filterSettlementsByDateRange(entries, { start: '2026-10-05', end: '2026-10-05' }).map((item) => item.id),
    [1, 2],
  );
  assert.deepEqual(
    filterSettlementsByDateRange(entries, { start: '2026-10-06', end: '2026-10-05' }),
    [],
  );
});

test('the reports page filters settlements using its UTC date boundaries', () => {
  const entries = [
    { id: 1, channel: 'عمر', paymentMethod: 'كاش', amount: 100, createdAt: '2026-10-05T23:30:00.000Z' },
    { id: 2, channel: 'سيف', paymentMethod: 'بنكك', amount: 200, createdAt: '2026-10-06T00:30:00.000Z' },
  ];

  assert.deepEqual(
    filterSettlementsByDateRange(entries, { start: '2026-10-05', end: '2026-10-05' }, 'UTC').map((item) => item.id),
    [1],
  );
});

test('summary totals match channel, payment method, and row count', () => {
  const summary = summarizeSettlements([
    { channel: 'عمر', paymentMethod: 'كاش', amount: 125, createdAt: '2026-10-05T10:00:00.000Z' },
    { channel: 'سيف', paymentMethod: 'بنكك', amount: 275, createdAt: '2026-10-05T11:00:00.000Z' },
  ]);

  assert.deepEqual(summary, {
    count: 2,
    total: 400,
    omar: 125,
    saif: 275,
    cash: 125,
    bankak: 275,
  });
});

test('displayed settlement dates use the same Khartoum timezone as the report filter', () => {
  assert.match(
    formatSettlementDate('2026-10-04T22:30:00.000Z'),
    /٥/,
  );
});
