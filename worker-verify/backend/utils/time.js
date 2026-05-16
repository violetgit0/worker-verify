// Normalize a date to midnight UTC (for one-record-per-day indexing)
function toMidnightUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Parse "HH:MM" string and attach to a base Date (same calendar day)
function parseTimeOnDate(hhmm, baseDate = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

// Minutes between two Date objects (positive if b > a)
function minutesDiff(a, b) {
  return Math.floor((b - a) / 60000);
}

// Get month + year of a date as { month (1-12), year }
function monthYear(date = new Date()) {
  const d = new Date(date);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

// Count working days in a month/year (Mon-Sat, i.e. 6-day week)
function workingDaysInMonth(month, year) {
  const days = new Date(year, month, 0).getDate(); // total days
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay(); // 0=Sun
    if (day !== 0) count++; // exclude Sunday
  }
  return count;
}

module.exports = { toMidnightUTC, parseTimeOnDate, minutesDiff, monthYear, workingDaysInMonth };
