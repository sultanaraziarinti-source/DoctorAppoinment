import { getAll, findById, insert, update, newId } from './database';
import { normalizePhone, REGISTRAR_PHONE, REGISTRAR_USER_ID } from './schema';
import { recordDeviceLogin } from './devicesStorage';

export { normalizePhone, REGISTRAR_PHONE };

// The user object the screens receive after getting in; deviceId is the phone they got in on
const toSessionUser = (patient, user, device) => ({
  id: patient.id,
  name: patient.name,
  phone: patient.phone,
  age: patient.age,
  role: 'patient',
  registered: !!(user && user.registered),
  deviceId: device ? device.id : null,
  deviceName: device ? device.deviceName : '',
});

// PHONE_NUMBER -> PATIENT lookup
export const findPatientByPhone = async (phone) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) return null;
  const numbers = await getAll('phoneNumbers');
  const match = numbers.find((n) => normalizePhone(n.phone) === normPhone);
  return match ? findById('patients', match.patientId) : null;
};

// Find the patient for this phone, or create an unregistered USER + PATIENT + PHONE_NUMBER
export const ensurePatient = async ({ phone, name = '', age = '' }) => {
  const normPhone = normalizePhone(phone);
  const existing = await findPatientByPhone(normPhone);
  if (existing) return existing;

  const id = newId('user');
  const createdAt = new Date().toISOString();
  await insert('users', { id, role: 'patient', registered: false, createdAt });
  const patient = await insert('patients', {
    id,
    name,
    phone: normPhone,
    password: '',
    age,
    doctorId: null,
    appointments: [],
    createdAt,
  });
  await insert('phoneNumbers', { id: newId('phone'), phone: normPhone, patientId: id });
  return patient;
};

// Patient changes their age from the profile; returns the saved age (as text)
export const updatePatientAge = async (phone, age) => {
  const patient = await findPatientByPhone(phone);
  if (!patient) throw new Error('Patient not found');
  const saved = await update('patients', patient.id, { age: String(age) });
  return saved ? saved.age : String(age);
};

// Register a new user (or finish registering a phone that was used before signing up)
export const registerUser = async ({ name, phone, age, password }) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) {
    return { success: false, error: 'PHONE_REQUIRED' };
  }

  const patient = await ensurePatient({ phone: normPhone });
  const updatedPatient = await update('patients', patient.id, {
    name: name.trim(),
    age: age ? String(age).trim() : patient.age || '',
    password: String(password).trim(),
  });
  const user = await update('users', patient.id, { registered: true });
  const device = await recordDeviceLogin(patient.id);

  return { success: true, user: toSessionUser(updatedPatient, user, device) };
};

// Get Started: a valid phone goes straight in, except the registrar who needs a password
export const startWithPhone = async (phone) => {
  const normPhone = normalizePhone(phone);
  if (normPhone === REGISTRAR_PHONE) {
    return { needsLogin: true };
  }
  const patient = await ensurePatient({ phone: normPhone });
  const user = await findById('users', patient.id);
  const device = await recordDeviceLogin(patient.id);
  return { needsLogin: false, user: toSessionUser(patient, user, device) };
};

const wrongPassword = {
  success: false,
  error: 'WRONG_PASSWORD',
  messageBn: 'পাসওয়ার্ড ভুল হয়েছে! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।',
  messageEn: 'Incorrect password! Please enter the correct password.',
};

// Authenticate user login
export const authenticateUser = async (phone, password) => {
  const normPhone = normalizePhone(phone);
  const cleanPassword = String(password || '').trim();

  if (!normPhone) {
    return { success: false, error: 'PHONE_REQUIRED' };
  }

  // Registrar / Admin Special Credentials
  const REGISTRAR_PASS = '123456';

  if (normPhone === REGISTRAR_PHONE) {
    if (cleanPassword !== REGISTRAR_PASS) return wrongPassword;
    const device = await recordDeviceLogin(REGISTRAR_USER_ID);
    return {
      success: true,
      user: {
        id: REGISTRAR_USER_ID,
        deviceId: device ? device.id : null,
        name: 'রেজিস্ট্রার / অ্যাডমিন',
        nameEn: 'Registrar / Admin',
        phone: REGISTRAR_PHONE,
        age: '35',
        role: 'registrar',
        isRegistrar: true,
      },
    };
  }

  const patient = await findPatientByPhone(normPhone);
  const user = patient ? await findById('users', patient.id) : null;

  if (!patient || !user || !user.registered) {
    // User does not exist (not registered yet)
    return {
      success: false,
      error: 'NOT_FOUND',
      messageBn: 'এই ফোন নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে প্রথমে সাইন আপ করুন।',
      messageEn: 'No account found with this phone number. Please sign up first.',
    };
  }

  if (patient.password !== cleanPassword) {
    return wrongPassword;
  }

  const device = await recordDeviceLogin(patient.id);
  return { success: true, user: toSessionUser(patient, user, device) };
};
