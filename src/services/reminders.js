import { Platform } from 'react-native';

// Patients get a notification 2 hours before each confirmed appointment.
// Reminders are scheduled on the phone itself, so they fire even when the app is closed.
export const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
const CHANNEL_ID = 'appointment-reminders';
const ID_PREFIX = 'apt-reminder-';
const reminderId = (appointmentId) => `${ID_PREFIX}${appointmentId}`;

// Only the local-notification parts of expo-notifications are loaded. Its main entry also loads
// remote-push code (topic subscriptions, push tokens) whose native module Expo Go doesn't have,
// which crashed the app at startup there. Local scheduled reminders work in Expo Go and the APK.
let Notifications = null;
try {
  Notifications = {
    ...require('expo-notifications/build/NotificationsHandler'),
    ...require('expo-notifications/build/setNotificationChannelAsync'),
    ...require('expo-notifications/build/NotificationPermissions'),
    ...require('expo-notifications/build/scheduleNotificationAsync'),
    ...require('expo-notifications/build/cancelScheduledNotificationAsync'),
    ...require('expo-notifications/build/getAllScheduledNotificationsAsync'),
    ...require('expo-notifications/build/NotificationChannelManager.types'),
    ...require('expo-notifications/build/Notifications.types'),
  };
} catch (error) {
  Notifications = null;
  console.warn('Reminders unavailable in this build:', error.message);
}
export const remindersAvailable = !!Notifications;

// Show reminders as a banner even while the app is open
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// null = not tried yet; true = our channel exists; false = can't create channels (Expo Go),
// so reminders go to the default channel instead
let channelReady = null;

const ensureChannel = async () => {
  if (Platform.OS !== 'android' || channelReady !== null) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Appointment reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    channelReady = true;
  } catch (error) {
    channelReady = false;
  }
};

// Ask once for notification permission (Android 13+ / iOS); returns whether reminders can be shown
export const ensureReminderPermission = async () => {
  if (!Notifications) return false;
  await ensureChannel();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch (error) {
    console.warn('Notification permission error:', error);
    return false;
  }
};

// When the reminder should fire, or null if there is nothing to remind about
export const reminderTimeFor = (appointment, now = Date.now()) => {
  if (!appointment || appointment.status !== 'confirmed' || !appointment.startsAt) return null;
  const start = new Date(appointment.startsAt).getTime();
  if (!Number.isFinite(start) || start <= now) return null;
  // Booked less than 2 hours ahead: remind a few seconds from now instead
  return Math.max(start - REMINDER_LEAD_MS, now + 5000);
};

const reminderContent = (appointment, lang) => {
  const isBn = lang === 'bn';
  const doctor = isBn ? appointment.doctorNameBn : appointment.doctorNameEn;
  const serial = appointment.serialNumber || appointment.serialNo;
  // '10:00 am (15 mins)' -> '10:00 am'
  const time = String(appointment.timeSlot || appointment.time || '').replace(/\s*\(.*\)\s*$/, '');
  return {
    title: isBn ? '⏰ সিরিয়াল রিমাইন্ডার' : '⏰ Appointment reminder',
    body: isBn
      ? `${doctor} এর সাথে আপনার সিরিয়াল #${serial} আজ ${time}-এ। সময়মতো চেম্বারে পৌঁছান।`
      : `Your serial #${serial} with ${doctor} is today at ${time}. Please reach the chamber on time.`,
    data: { appointmentId: appointment.id },
  };
};

export const cancelAppointmentReminder = async (appointmentId) => {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId(appointmentId));
  } catch (error) {
    // nothing scheduled for this appointment
  }
};

// Schedule (or reschedule) the reminder for one appointment
export const scheduleAppointmentReminder = async (appointment, lang = 'bn') => {
  if (!Notifications) return null;
  const fireAt = reminderTimeFor(appointment);
  await cancelAppointmentReminder(appointment.id);
  if (!fireAt) return null;
  if (!(await ensureReminderPermission())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: reminderId(appointment.id),
      content: reminderContent(appointment, lang),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        ...(channelReady ? { channelId: CHANNEL_ID } : {}),
      },
    });
  } catch (error) {
    console.warn('Scheduling reminder failed:', error);
    return null;
  }
};

// Match this phone's reminders to the patient's bookings: add missing ones,
// drop ones for cancelled, finished or deleted appointments
export const syncAppointmentReminders = async (appointments, lang = 'bn') => {
  if (!Notifications) return;
  const wanted = (appointments || []).filter((apt) => reminderTimeFor(apt) !== null);
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const wantedIds = new Set(wanted.map((apt) => reminderId(apt.id)));
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(ID_PREFIX) && !wantedIds.has(n.identifier))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (error) {
    console.warn('Reading scheduled reminders failed:', error);
  }
  for (const apt of wanted) {
    await scheduleAppointmentReminder(apt, lang);
  }
};

// On logout: this phone should stop reminding about that patient's bookings
export const cancelAllAppointmentReminders = async () => {
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (error) {
    console.warn('Clearing reminders failed:', error);
  }
};
