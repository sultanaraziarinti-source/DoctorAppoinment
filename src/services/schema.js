// Pure helpers for the ERD tables (see docs/ER_DIAGRAM.md) and the first-run seed.
// No storage access here, so every service can import it without import cycles.
import { departmentsData } from '../data/doctorsData';
import { seedAppointments } from '../data/seedAppointments';

export const TABLES = [
  'users',
  'patients',
  'phoneNumbers',
  'devices',
  'departments',
  'doctors',
  'schedules',
  'appointments',
];

// Columns of each Supabase table (supabase/schema.sql); rows are trimmed to these before saving
export const COLUMNS = {
  users: ['id', 'role', 'registered', 'createdAt'],
  patients: ['id', 'name', 'phone', 'password', 'age', 'doctorId', 'appointments', 'createdAt'],
  phoneNumbers: ['id', 'phone', 'patientId'],
  devices: ['id', 'userId', 'deviceName', 'platform', 'deviceToken', 'lastLogin'],
  departments: ['id', 'nameBn', 'nameEn', 'icon', 'color', 'descriptionBn', 'descriptionEn', 'doctorNo'],
  doctors: [
    'id', 'departmentId', 'nameBn', 'nameEn', 'degreesBn', 'degreesEn',
    'designationBn', 'designationEn', 'hospitalBn', 'hospitalEn', 'chamberBn', 'chamberEn',
    'experience', 'experienceBn', 'experienceEn', 'fee', 'feeBn', 'feeEn',
    'availableBn', 'availableEn', 'rating', 'reviews', 'image',
  ],
  schedules: ['id', 'date', 'time', 'doctorId', 'patientId', 'place'],
  appointments: [
    'id', 'serialNo', 'patientPhone', 'patientName', 'age', 'doctorNameBn', 'doctorNameEn',
    'date', 'time', 'startsAt', 'doctorId', 'patientId', 'scheduleId', 'deviceId', 'fee', 'reason',
    'status', 'createdAt',
  ],
};

// Order in which tables are uploaded, so every row's foreign keys already exist
export const UPLOAD_ORDER = [
  'users',
  'departments',
  'doctors',
  'patients',
  'phoneNumbers',
  'devices',
  'schedules',
  'appointments',
];

// Foreign keys in supabase/schema.sql: table -> { column: referenced table }
const FOREIGN_KEYS = {
  phoneNumbers: { patientId: 'patients' },
  devices: { userId: 'users' },
  doctors: { departmentId: 'departments' },
  schedules: { doctorId: 'doctors', patientId: 'patients' },
  appointments: { doctorId: 'doctors', patientId: 'patients', scheduleId: 'schedules', deviceId: 'devices' },
};

// Clear links to rows that no longer exist (e.g. a deleted doctor) so the upload is not rejected
export const dropDanglingLinks = (tables) => {
  const ids = {};
  TABLES.forEach((t) => {
    ids[t] = new Set(tables[t].map((row) => row.id));
  });
  const out = { ...tables };
  Object.entries(FOREIGN_KEYS).forEach(([table, fks]) => {
    out[table] = tables[table].map((row) => {
      const fixed = { ...row };
      Object.entries(fks).forEach(([col, target]) => {
        if (fixed[col] && !ids[target].has(fixed[col])) fixed[col] = null;
      });
      return fixed;
    });
  });
  return out;
};

export const pickColumns = (table, row) => {
  const out = {};
  COLUMNS[table].forEach((col) => {
    if (row[col] !== undefined) out[col] = row[col];
  });
  return out;
};

// Display order, since the database returns rows in no fixed order:
// departments and bundled doctors follow doctorsData; doctors the registrar added (doc-<time>) come first, newest first;
// appointments newest first.
const bundledDeptOrder = departmentsData.map((d) => d.id);
const bundledDoctorOrder = departmentsData.flatMap((d) => (d.doctors || []).map((doc) => doc.id));
const orderIndex = (list, id) => {
  const i = list.indexOf(id);
  return i === -1 ? list.length : i;
};
const addedDoctorTime = (id) => {
  const m = /^doc-(\d+)$/.exec(id || '');
  return m ? Number(m[1]) : null;
};

export const sortRows = (table, rows) => {
  const list = [...rows];
  if (table === 'departments') {
    return list.sort((a, b) => orderIndex(bundledDeptOrder, a.id) - orderIndex(bundledDeptOrder, b.id));
  }
  if (table === 'doctors') {
    return list.sort((a, b) => {
      const ta = addedDoctorTime(a.id);
      const tb = addedDoctorTime(b.id);
      if (ta !== null || tb !== null) return (tb || 0) - (ta || 0);
      return orderIndex(bundledDoctorOrder, a.id) - orderIndex(bundledDoctorOrder, b.id);
    });
  }
  if (table === 'appointments') {
    return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  return list;
};

export const REGISTRAR_PHONE = '01718183957';
export const REGISTRAR_USER_ID = 'user-registrar';
export const DEFAULT_DOCTOR_IMAGE =
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80';

// Helper to normalize Bangladeshi phone numbers
export const normalizePhone = (phone = '') => {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+88')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
};

const firstFilled = (...values) => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

// Fill missing experience and fee fields so every DOCTOR row has both languages
export const healDoctor = (doc) => {
  const expBn =
    firstFilled(doc.experienceBn, doc.experience, doc.experienceEn) || '১০+ বছরের অভিজ্ঞতা';
  const expEn =
    firstFilled(doc.experienceEn, doc.experience, doc.experienceBn) || '10+ Years Exp.';
  const feeBn = firstFilled(doc.feeBn, doc.fee, doc.feeEn) || '৳১,০০০';
  const feeEn = firstFilled(doc.feeEn, doc.fee, doc.feeBn) || '৳1,000';
  return {
    ...doc,
    experience: expBn,
    experienceBn: expBn,
    experienceEn: expEn,
    fee: feeBn,
    feeBn,
    feeEn,
  };
};

export const emptyTables = () =>
  TABLES.reduce((acc, table) => ({ ...acc, [table]: [] }), {});

// USER + PATIENT + PHONE_NUMBER rows for one person. PATIENT "is a" USER, so both share the id.
export const addPatientRows = (tables, { id, name = '', phone, age = '', password = '', registered, createdAt }) => {
  const now = createdAt || new Date().toISOString();
  tables.users.push({ id, role: 'patient', registered: !!registered, createdAt: now });
  tables.patients.push({
    id,
    name,
    phone,
    password,
    age,
    doctorId: null,
    appointments: [],
    createdAt: now,
  });
  tables.phoneNumbers.push({ id: `phone-${id}`, phone, patientId: id });
  return tables.patients[tables.patients.length - 1];
};

const findPatientRow = (tables, phone) => {
  const num = tables.phoneNumbers.find((n) => normalizePhone(n.phone) === phone);
  return num ? tables.patients.find((p) => p.id === num.patientId) : null;
};

// Turn an old flat appointment (v1 storage or seed file) into SCHEDULE + APPOINTMENT rows
const importAppointment = (tables, apt, index) => {
  const doctor =
    tables.doctors.find((d) => d.id === apt.doctorId) ||
    tables.doctors.find((d) => d.nameEn === apt.doctorNameEn || d.nameBn === apt.doctorNameBn);
  const phone = normalizePhone(apt.patientPhone);

  let patient = phone ? findPatientRow(tables, phone) : null;
  if (!patient && phone) {
    patient = addPatientRows(tables, {
      id: `user-${tables.users.length + 1}`,
      name: apt.patientName || '',
      phone,
      age: apt.patientAge || '',
      registered: false,
    });
  }

  const scheduleId = `sch-${index + 1}`;
  tables.schedules.push({
    id: scheduleId,
    date: apt.date || '',
    time: apt.timeSlot || '',
    doctorId: doctor ? doctor.id : apt.doctorId || null,
    patientId: patient ? patient.id : null,
    place: apt.chamber || (doctor && doctor.chamberBn) || '',
  });

  const row = {
    id: apt.id || `apt-${index + 1}`,
    serialNo: apt.serialNumber || index + 1,
    patientPhone: phone,
    patientName: apt.patientName || '',
    age: apt.patientAge || '',
    doctorNameBn: apt.doctorNameBn || (doctor && doctor.nameBn) || '',
    doctorNameEn: apt.doctorNameEn || (doctor && doctor.nameEn) || '',
    date: apt.date || '',
    time: apt.timeSlot || '',
    doctorId: doctor ? doctor.id : apt.doctorId || null,
    patientId: patient ? patient.id : null,
    scheduleId,
    fee: apt.fee || '',
    reason: apt.reason || '',
    status: apt.status || 'confirmed',
    createdAt: apt.createdAt || new Date().toISOString(),
  };
  tables.appointments.push(row);

  if (patient) {
    patient.appointments.push(row.id);
    if (row.doctorId) patient.doctorId = row.doctorId;
  }
};

// Build every table for the first v2 run. Data saved by the old (v1) app wins over the bundled seed.
export const buildInitialTables = (legacy = {}) => {
  const tables = emptyTables();

  tables.users.push({
    id: REGISTRAR_USER_ID,
    role: 'registrar',
    registered: true,
    createdAt: new Date().toISOString(),
  });

  // DEPARTMENT + DOCTOR: doctors used to live inside department.doctors
  const sourceDepartments =
    Array.isArray(legacy.departments) && legacy.departments.length > 0
      ? legacy.departments
      : JSON.parse(JSON.stringify(departmentsData));
  sourceDepartments.forEach((dept) => {
    const { doctors = [], doctorCount, ...deptFields } = dept;
    tables.departments.push({ ...deptFields, doctorNo: doctors.length });
    doctors.forEach((doc) => {
      tables.doctors.push(healDoctor({ ...doc, departmentId: dept.id }));
      // DOCTOR "is a" USER, so both share the id
      tables.users.push({ id: doc.id, role: 'doctor', registered: false, createdAt: new Date().toISOString() });
    });
  });

  // Registered patients from v1
  (Array.isArray(legacy.users) ? legacy.users : []).forEach((u) => {
    const phone = normalizePhone(u.phone);
    if (!phone || findPatientRow(tables, phone)) return;
    addPatientRows(tables, {
      id: `user-${tables.users.length + 1}`,
      name: u.name || '',
      phone,
      age: u.age || '',
      password: u.password || '',
      registered: true,
      createdAt: u.createdAt,
    });
  });

  const sourceAppointments =
    Array.isArray(legacy.appointments) && legacy.appointments.length > 0
      ? legacy.appointments
      : seedAppointments;
  sourceAppointments.forEach((apt, i) => importAppointment(tables, apt, i));

  return tables;
};
