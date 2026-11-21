"use strict";
const db = require("../db/database");

function getConfig() {
  return db.prepare("SELECT * FROM business_hours_config WHERE id=1").get();
}

/**
 * Get local date/time parts in the given IANA timezone for a UTC Date.
 */
function getLocalParts(utcDate, timezone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(utcDate).map(p => [p.type, p.value]));
  const hour = parseInt(parts.hour === "24" ? "0" : parts.hour, 10);
  return {
    year:       parseInt(parts.year, 10),
    month:      parseInt(parts.month, 10),
    day:        parseInt(parts.day, 10),
    hour,
    minute:     parseInt(parts.minute, 10),
    second:     parseInt(parts.second, 10),
    isoWeekday: isoWeekdayOfUTCDate(parseInt(parts.year), parseInt(parts.month), parseInt(parts.day)),
    dateStr:    `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function isoWeekdayOfUTCDate(year, month, day) {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Advance a local calendar date by n days (uses UTC arithmetic on date-only components).
 */
function advanceLocalDay(year, month, day, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Convert a local (timezone) date+time → UTC Date.
 *
 * Strategy: start with approxUTC = treating local as UTC, then correct by
 * adding the observed offset (UTC = local + offset → offset = UTC - local).
 * Two passes handles DST edge cases.
 */
function localToUTC(year, month, day, hour, minute, timezone) {
  // Pass 1: approx
  const approxUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const lp1 = getLocalParts(approxUTC, timezone);
  // local(approxUTC) ≈ lp1. We want local(result) = (year,month,day,hour,minute).
  // result = approxUTC + (target_local_minutes - actual_local_minutes)
  const diff1Ms = (hour - lp1.hour) * 3600000
                + (minute - lp1.minute) * 60000
                + (day - lp1.day) * 86400000;
  const pass1 = new Date(approxUTC.getTime() + diff1Ms);

  // Pass 2: fine-correct
  const lp2 = getLocalParts(pass1, timezone);
  const diff2Ms = (hour - lp2.hour) * 3600000
                + (minute - lp2.minute) * 60000
                + (day - lp2.day) * 86400000;
  return new Date(pass1.getTime() + diff2Ms);
}

/**
 * Given a local day (year,month,day) find the next workday and return its
 * UTC start time (wStart hour).
 */
function nextWorkdayStart(utcDate, tz, wStart, workDays, holidays) {
  const lp = getLocalParts(utcDate, tz);
  // Start from next LOCAL calendar day
  let next = advanceLocalDay(lp.year, lp.month, lp.day, 1);
  let safety = 0;
  while (safety++ < 20) {
    const w = isoWeekdayOfUTCDate(next.year, next.month, next.day);
    const ds = `${String(next.year).padStart(4,"0")}-${String(next.month).padStart(2,"0")}-${String(next.day).padStart(2,"0")}`;
    if (workDays.has(w) && !holidays.has(ds)) {
      return localToUTC(next.year, next.month, next.day, wStart, 0, tz);
    }
    next = advanceLocalDay(next.year, next.month, next.day, 1);
  }
  // Fallback (shouldn't happen)
  return localToUTC(next.year, next.month, next.day, wStart, 0, tz);
}

/**
 * Snap utcDate to the next valid work moment in the given timezone.
 * If currently in valid work hours, returns as-is.
 */
function snapToWorkHours(utcDate, tz, wStart, wEnd, workDays, holidays) {
  let cur = new Date(utcDate);
  let safety = 0;
  while (safety++ < 10000) {
    const lp = getLocalParts(cur, tz);
    const ds = lp.dateStr;
    if (!workDays.has(lp.isoWeekday) || holidays.has(ds)) {
      cur = nextWorkdayStart(cur, tz, wStart, workDays, holidays);
      continue;
    }
    if (lp.hour < wStart) {
      cur = localToUTC(lp.year, lp.month, lp.day, wStart, 0, tz);
      continue;
    }
    if (lp.hour >= wEnd) {
      cur = nextWorkdayStart(cur, tz, wStart, workDays, holidays);
      continue;
    }
    break; // valid work moment
  }
  return cur;
}

/**
 * Add N business hours to fromDate (Date or ISO string).
 * All date arithmetic is timezone-aware via Intl.DateTimeFormat.
 * Returns a UTC ISO string.
 */
function addBusinessHours(fromDate, hours) {
  const cfg      = getConfig() || {};
  const tz       = cfg.timezone      || "America/Bogota";
  const wStart   = cfg.workday_start ?? 8;
  const wEnd     = cfg.workday_end   ?? 18;
  const workDays = new Set(((cfg.work_days) || "1,2,3,4,5").split(",").map(Number));
  const holidays = new Set(JSON.parse(cfg.holiday_dates || "[]"));

  let current   = new Date(fromDate);
  let remaining = hours;

  current = snapToWorkHours(current, tz, wStart, wEnd, workDays, holidays);

  let safety = 0;
  while (remaining > 0 && safety++ < 10000) {
    const lp = getLocalParts(current, tz);

    if (!workDays.has(lp.isoWeekday) || holidays.has(lp.dateStr)) {
      current = nextWorkdayStart(current, tz, wStart, workDays, holidays);
      continue;
    }

    const minutesLeftInDay = (wEnd - lp.hour) * 60 - lp.minute - lp.second / 60;
    const hoursLeftInDay   = minutesLeftInDay / 60;

    if (hoursLeftInDay <= 0) {
      current = nextWorkdayStart(current, tz, wStart, workDays, holidays);
      continue;
    }

    if (remaining <= hoursLeftInDay) {
      current   = new Date(current.getTime() + remaining * 3600000);
      remaining = 0;
    } else {
      remaining -= hoursLeftInDay;
      current    = nextWorkdayStart(current, tz, wStart, workDays, holidays);
    }
  }

  return current.toISOString();
}

module.exports = { addBusinessHours, getConfig, getLocalParts, localToUTC };
