"use strict";
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db/database");
const { addBusinessHours, getLocalParts } = require("../services/businessHoursService");

// America/Bogota is UTC-5 year-round (no DST).
// Helper: build UTC Date for a given Bogota local time.
function bogo(year, month, day, hour, min = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour + 5, min, 0));
}

describe("Business Hours Service — deterministic (America/Bogota UTC-5)", () => {

  before(() => {
    try {
      db.prepare(
        `UPDATE business_hours_config SET timezone='America/Bogota', workday_start=8, workday_end=18, work_days='1,2,3,4,5', holiday_dates='[]' WHERE id=1`
      ).run();
    } catch (_) {
      db.prepare(
        `INSERT OR REPLACE INTO business_hours_config (id,timezone,workday_start,workday_end,work_days,holiday_dates) VALUES (1,'America/Bogota',8,18,'1,2,3,4,5','[]')`
      ).run();
    }
  });

  // BH-1: mid-morning, same day
  test("BH-1: 4h from Mon 10:00 Bogota → Mon 14:00 Bogota", () => {
    // Mon 2026-11-02 10:00 Bogota = Mon 2026-11-02 15:00 UTC
    const from   = bogo(2026, 11, 2, 10, 0);
    const result = addBusinessHours(from, 4);
    const lp     = getLocalParts(new Date(result), "America/Bogota");
    assert.equal(lp.year,       2026, "year");
    assert.equal(lp.month,      11,   "month");
    assert.equal(lp.day,        2,    "day");
    assert.equal(lp.hour,       14,   "hour 14");
    assert.equal(lp.minute,     0,    "minute 0");
  });

  // BH-2: near end of day — spills to Tue
  test("BH-2: 4h from Mon 16:00 Bogota → Tue 10:00 Bogota", () => {
    // Mon 16:00 → 2h left that day → Tue 08:00 + 2h = Tue 10:00
    const from   = bogo(2026, 11, 2, 16, 0);
    const result = addBusinessHours(from, 4);
    const lp     = getLocalParts(new Date(result), "America/Bogota");
    assert.equal(lp.isoWeekday, 2,  "Tuesday");
    assert.equal(lp.hour,       10, "hour 10");
    assert.equal(lp.minute,     0,  "minute 0");
  });

  // BH-3: Friday afternoon — skips weekend
  test("BH-3: 4h from Fri 17:00 Bogota → Mon 11:00 Bogota", () => {
    // Fri 17:00 → 1h left (until 18:00) → Mon 08:00 + 3h = Mon 11:00
    const from   = bogo(2026, 10, 30, 17, 0); // Fri 2026-10-30
    const result = addBusinessHours(from, 4);
    const lp     = getLocalParts(new Date(result), "America/Bogota");
    assert.equal(lp.isoWeekday, 1,  "Monday");
    assert.equal(lp.hour,       11, "hour 11");
    assert.equal(lp.minute,     0,  "minute 0");
  });

  // BH-4: Saturday — snaps to Monday
  test("BH-4: 4h starting Sat 10:00 Bogota → Mon 12:00 Bogota", () => {
    // Sat → snap to Mon 08:00, then +4h = Mon 12:00
    const from   = bogo(2026, 10, 31, 10, 0); // Sat 2026-10-31
    const result = addBusinessHours(from, 4);
    const lp     = getLocalParts(new Date(result), "America/Bogota");
    assert.equal(lp.isoWeekday, 1,  "Monday");
    assert.equal(lp.hour,       12, "hour 12");
  });

  // BH-5: Holiday skipped
  test("BH-5: 4h skips holiday Mon 2026-11-02 → lands Tue", () => {
    db.prepare(`UPDATE business_hours_config SET holiday_dates='["2026-11-02"]' WHERE id=1`).run();
    try {
      // Fri → would have gone Mon (holiday) → Tue 08:00 + 3h = Tue 11:00
      const from   = bogo(2026, 10, 30, 17, 0);
      const result = addBusinessHours(from, 4);
      const lp     = getLocalParts(new Date(result), "America/Bogota");
      assert.equal(lp.isoWeekday, 2,  "Tuesday (Monday is holiday)");
      assert.equal(lp.hour,       11, "hour 11");
    } finally {
      db.prepare(`UPDATE business_hours_config SET holiday_dates='[]' WHERE id=1`).run();
    }
  });

  // BH-6: 48h from Mon 08:00 — spans multiple days
  test("BH-6: 48h from Mon 08:00 Bogota → Fri 16:00 Bogota", () => {
    // Workday = 10h. 48h ÷ 10h/day = 4.8 days
    // Mon(10) + Tue(10) + Wed(10) + Thu(10) = 40h → 8 more on Fri → Fri 08:00+8 = Fri 16:00
    const from   = bogo(2026, 11, 2, 8, 0); // Mon 2026-11-02
    const result = addBusinessHours(from, 48);
    const lp     = getLocalParts(new Date(result), "America/Bogota");
    assert.equal(lp.isoWeekday, 5,  "Friday");
    assert.equal(lp.hour,       16, "hour 16");
    assert.equal(lp.minute,     0,  "minute 0");
  });

  // BH-7: 48h crossing a weekend
  test("BH-7: 48h from Thu 14:00 Bogota → Thu 12:00 Bogota (next week)", () => {
    // Thu 14:00 → Thu: 4h (14→18) → Fri: 10h → Mon: 10h → Tue: 10h → Wed: 10h → remaining=4 → Thu 08:00+4h = Thu 12:00
    const from   = bogo(2026, 11, 5, 14, 0); // Thu 2026-11-05
    const result = addBusinessHours(from, 48);
    const lp     = getLocalParts(new Date(result), "America/Bogota");
    assert.equal(lp.isoWeekday, 4,  "Thursday");
    assert.equal(lp.hour,       12, "hour 12");
    assert.equal(lp.minute,     0,  "minute 0");
  });
});
