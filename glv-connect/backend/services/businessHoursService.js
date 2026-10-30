"use strict";
const db = require("../db/database");

function getConfig() {
  return db.prepare("SELECT * FROM business_hours_config WHERE id=1").get();
}

function getIsoWeekday(d) {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function nextWorkdayStart(d, workDays, start, holidays) {
  let cur = new Date(d);
  cur.setDate(cur.getDate() + 1);
  cur.setHours(start, 0, 0, 0);
  while (!workDays.has(getIsoWeekday(cur)) || holidays.has(toDateStr(cur))) {
    cur.setDate(cur.getDate() + 1);
  }
  return cur;
}

function snapToWorkHours(d, workDays, start, end, holidays) {
  let cur = new Date(d);
  const dow = getIsoWeekday(cur);
  const ds = toDateStr(cur);
  if (!workDays.has(dow) || holidays.has(ds)) {
    return nextWorkdayStart(cur, workDays, start, holidays);
  }
  if (cur.getHours() < start) {
    cur.setHours(start, 0, 0, 0);
  } else if (cur.getHours() >= end) {
    return nextWorkdayStart(cur, workDays, start, holidays);
  }
  return cur;
}

function addBusinessHours(fromDate, hours) {
  const cfg = getConfig() || {};
  const workDays = new Set(((cfg.work_days) || "1,2,3,4,5").split(",").map(Number));
  const start = cfg.workday_start ?? 8;
  const end   = cfg.workday_end   ?? 18;
  const holidays = new Set(JSON.parse(cfg.holiday_dates || "[]"));

  let remaining = hours;
  let current = new Date(fromDate);
  current = snapToWorkHours(current, workDays, start, end, holidays);

  while (remaining > 0) {
    const dow = getIsoWeekday(current);
    const ds  = toDateStr(current);
    if (!workDays.has(dow) || holidays.has(ds)) {
      current = nextWorkdayStart(current, workDays, start, holidays);
      continue;
    }
    const endOfDay = new Date(current);
    endOfDay.setHours(end, 0, 0, 0);
    const hoursLeft = (endOfDay - current) / 3600000;
    if (remaining <= hoursLeft) {
      current = new Date(current.getTime() + remaining * 3600000);
      remaining = 0;
    } else {
      remaining -= hoursLeft;
      current = nextWorkdayStart(current, workDays, start, holidays);
    }
  }
  return current.toISOString();
}

module.exports = { addBusinessHours, getConfig };
