import AsyncStorage from '@react-native-async-storage/async-storage';
import { appointmentStartTime } from './appointmentTime';
import { REMINDER_LEAD_MS } from './reminders';

// The bell on Home lists each appointment's 2-hour reminder (the same moment the phone
// notification fires). Once the patient opens the bell and sees it, it is remembered on
// this phone and not shown again.

const seenKey = (phone) => `@doctor_app_seen_notifications_v1:${phone || 'guest'}`;
export const reminderNotificationId = (appointment) => `reminder-${appointment.id}`;

// Reminders due now: confirmed visits starting within the next 2 hours
export const dueReminders = (appointments, now = Date.now()) =>
  (appointments || [])
    .filter((apt) => apt && apt.status === 'confirmed')
    .map((apt) => ({ apt, start: appointmentStartTime(apt) }))
    .filter(({ start }) => start !== null && start > now && start - REMINDER_LEAD_MS <= now)
    .sort((a, b) => a.start - b.start)
    .map(({ apt, start }) => ({ id: reminderNotificationId(apt), appointment: apt, startsAt: start }));

export const loadSeenNotifications = async (phone) => {
  try {
    const raw = await AsyncStorage.getItem(seenKey(phone));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
};

// Remember these as seen; keeps the list short by dropping the oldest ids
export const markNotificationsSeen = async (phone, ids) => {
  const current = await loadSeenNotifications(phone);
  const next = Array.from(new Set([...current, ...ids])).slice(-200);
  try {
    await AsyncStorage.setItem(seenKey(phone), JSON.stringify(next));
  } catch (e) {
    // not saved: it may show once more next time, which is harmless
  }
  return next;
};
