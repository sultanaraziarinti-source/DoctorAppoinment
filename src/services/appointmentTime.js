// Real booking dates and exact start times, used for the 2-hour reminder.

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const BN_DAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
const BN_MONTHS_SHORT = [
  'জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন',
  'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে',
];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toBnDigits = (value) => String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Today and the next few days, labelled the way the booking screen shows them
export const buildDateOptions = (now = new Date(), count = 4) =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const day = date.getDate();
    const month = date.getMonth();
    const bnDay = toBnDigits(day);
    const prefixBn = i === 0 ? 'আজ, ' : i === 1 ? 'আগামীকাল, ' : '';
    const prefixEn = i === 0 ? 'Today, ' : i === 1 ? 'Tomorrow, ' : `${EN_DAYS[date.getDay()]}, `;
    return {
      id: dayKey(date),
      dateKey: dayKey(date),
      weekday: date.getDay(), // 0 = Sunday … 6 = Saturday
      isToday: i === 0,
      titleBn: `${prefixBn}${bnDay} ${BN_MONTHS_SHORT[month]}`,
      titleEn: `${prefixEn}${EN_MONTHS[month]} ${day}`,
      cardDateBn: `${BN_DAYS[date.getDay()]}, ${bnDay} ${BN_MONTHS[month]}`,
      cardDateEn: `${EN_DAYS[date.getDay()]}, ${EN_MONTHS[month]} ${day}`,
    };
  });

// '09:15 am' / '06:45 pm' -> { hours, minutes } in 24-hour time
export const parseSlotTime = (slot = '') => {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(slot).trim());
  if (!m) return null;
  let hours = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') hours += 12;
  return { hours, minutes: Number(m[2]) };
};

// Older bookings (and the sample data) only have display text such as 'সোম, ২০ অক্টো ২০২৬' +
// '১০:৩০ AM' or 'Tue, Oct 26' + '10:00 am (15 mins)'. Read the moment back out of that text.
const MONTH_WORDS = [
  ...BN_MONTHS.map((w, i) => [w, i]),
  ...BN_MONTHS_SHORT.map((w, i) => [w, i]),
  ...EN_MONTHS.map((w, i) => [w.toLowerCase(), i]),
].sort((a, b) => b[0].length - a[0].length); // longest first, so 'অক্টোবর' wins over 'অক্টো'

const fromBnDigits = (text) =>
  String(text || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

export const parseDisplayDateTime = (dateText, timeText, now = new Date()) => {
  const text = fromBnDigits(dateText).toLowerCase();
  const month = MONTH_WORDS.find(([word]) => text.includes(word));
  const day = /(\d{1,2})(?!\d)/.exec(text.replace(/\d{4}/, ''));
  if (!month || !day) return null;
  const yearMatch = /(\d{4})/.exec(text);
  const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
  const time = parseSlotTime(fromBnDigits(timeText).replace(/\s*\(.*\)\s*$/, '')) || { hours: 0, minutes: 0 };
  const result = new Date(year, month[1], Number(day[1]), time.hours, time.minutes);
  return Number.isNaN(result.getTime()) ? null : result;
};

// When an appointment starts (ms), from its saved start time or, failing that, its display text
export const appointmentStartTime = (apt) => {
  if (apt && apt.startsAt) {
    const t = new Date(apt.startsAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  const parsed = apt ? parseDisplayDateTime(apt.date, apt.timeSlot || apt.time) : null;
  return parsed ? parsed.getTime() : null;
};

// ---- Doctor's visiting hours ----
// Reads texts like 'Sat - Wed: 5:00 PM - 9:00 PM', 'Sat, Mon, Wed: 4:30 PM - 8:00 PM',
// 'শনি - বুধ: বিকাল ৫:০০ - রাত ৯:০০' or 'Tuesday: 11.00-2.00' into
// { days: [0..6] or null (every day), ranges: [{ start, end }] in minutes after midnight }.

const DAY_WORDS = [
  ['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6],
  ['রবি', 0], ['সোম', 1], ['মঙ্গল', 2], ['বুধ', 3], ['বৃহস্পতি', 4], ['শুক্র', 5], ['শনি', 6],
];
const EVERY_DAY = /daily|every\s*day|all\s*days|প্রতিদিন/i;
const PM_WORDS = /(দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)\s*$/;
const AM_WORDS = /(সকাল|ভোর)\s*$/;

// Weekdays named in one piece of the day list, in order of appearance
const daysIn = (piece) => {
  const found = [];
  const lower = piece.toLowerCase();
  DAY_WORDS.forEach(([word, day]) => {
    const at = lower.indexOf(word);
    if (at >= 0) found.push({ at, day });
  });
  return found.sort((a, b) => a.at - b.at).map((f) => f.day);
};

const parseDays = (dayText) => {
  if (!dayText.trim() || EVERY_DAY.test(dayText)) return null;
  const days = new Set();
  dayText.split(/[,،;/&]|\band\b|ও/).forEach((piece) => {
    const named = daysIn(piece);
    if (named.length >= 2 && /[-–—]|\bto\b|থেকে/.test(piece)) {
      // a range such as Sat - Wed, wrapping round the week
      for (let d = named[0], guard = 0; guard < 7; d = (d + 1) % 7, guard += 1) {
        days.add(d);
        if (d === named[named.length - 1]) break;
      }
    } else {
      named.forEach((d) => days.add(d));
    }
  });
  return days.size > 0 ? Array.from(days).sort((a, b) => a - b) : null;
};

// One clock time with its am/pm (or Bangla time-of-day word) if given
const TIME_RE = /(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi;

const toMinutes = (hour, minute, meridiem, wordBefore) => {
  let h = hour % 12;
  let known = true;
  if (meridiem) {
    if (/p/i.test(meridiem)) h += 12;
  } else if (PM_WORDS.test(wordBefore)) {
    if (!(hour === 12)) h += 12;
    else h = 12;
  } else if (AM_WORDS.test(wordBefore)) {
    // morning: keep as is
  } else {
    known = false;
    h = hour === 12 ? 12 : hour;
  }
  return { minutes: h * 60 + minute, known, hour };
};

export const parseAvailability = (text) => {
  const src = fromBnDigits(text || '');
  const firstDigit = src.search(/\d/);
  if (firstDigit < 0) return { days: parseDays(src), ranges: [] };
  const dayText = src.slice(0, firstDigit);
  const timeText = src.slice(firstDigit);

  const times = [];
  let m;
  TIME_RE.lastIndex = 0;
  while ((m = TIME_RE.exec(timeText)) !== null) {
    const before = timeText.slice(0, m.index);
    times.push(toMinutes(Number(m[1]), Number(m[2] || 0), m[3], before));
  }

  const ranges = [];
  for (let i = 0; i + 1 < times.length; i += 2) {
    const a = { ...times[i] };
    const b = { ...times[i + 1] };
    // No am/pm given: 1–7 o'clock is read as afternoon/evening (clinic hours), 8–11 as morning
    if (!a.known && a.hour >= 1 && a.hour <= 7) a.minutes += 12 * 60;
    if (!b.known && b.minutes <= a.minutes && b.hour < 12) b.minutes += 12 * 60;
    if (b.minutes > a.minutes) ranges.push({ start: a.minutes, end: b.minutes });
  }
  return { days: parseDays(dayText), ranges };
};

// minutes after midnight -> '05:15 pm' (the slot format used across the app)
export const formatSlot = (minutes) => {
  const h24 = Math.floor(minutes / 60) % 24;
  const mm = String(minutes % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${mm} ${h24 < 12 ? 'am' : 'pm'}`;
};

// 15-minute slots that start and finish inside the doctor's hours
export const slotsFromAvailability = (availability, step = 15) => {
  const slots = [];
  (availability?.ranges || []).forEach(({ start, end }) => {
    for (let t = start; t + step <= end; t += step) slots.push(t);
  });
  return Array.from(new Set(slots)).sort((a, b) => a - b).map(formatSlot);
};

// dateKey 'YYYY-MM-DD' + slot -> ISO time of the appointment (phone's local time zone)
export const appointmentStartISO = (dateKey, slot) => {
  const time = parseSlotTime(slot);
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || '');
  if (!time || !d) return null;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), time.hours, time.minutes).toISOString();
};
