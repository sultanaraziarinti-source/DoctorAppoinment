import { Platform } from 'react-native';
import { getAll, insert, update, newId } from './database';

const currentDeviceName = () =>
  (Platform.constants && (Platform.constants.Model || Platform.constants.model)) ||
  (Platform.OS === 'ios' ? 'iPhone' : 'Android device');

// Record (or refresh) the DEVICE row for this phone each time a user gets in
export const recordDeviceLogin = async (userId) => {
  if (!userId) return null;
  const deviceName = currentDeviceName();
  const lastLogin = new Date().toISOString();
  const devices = await getAll('devices');
  const existing = devices.find(
    (d) => d.userId === userId && d.deviceName === deviceName && d.platform === Platform.OS
  );
  if (existing) {
    return update('devices', existing.id, { lastLogin });
  }
  return insert('devices', {
    id: newId('dev'),
    userId,
    deviceName,
    platform: Platform.OS,
    deviceToken: '', // filled in once push notifications are added
    lastLogin,
  });
};

export const getDevicesForUser = async (userId) => {
  const devices = await getAll('devices');
  return devices.filter((d) => d.userId === userId);
};
