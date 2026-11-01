import { getAll, findById, insert, update, remove, newId } from './database';
import { normalizePhone } from './schema';
import { ensurePatient } from './authStorage';

// APPOINTMENT row joined with its DOCTOR, DEPARTMENT, SCHEDULE and DEVICE, in the shape the screens read
const toView = (apt, doctors, departments, schedules, devices) => {
  const doctor = doctors.find((d) => d.id === apt.doctorId);
  const dept = doctor ? departments.find((d) => d.id === doctor.departmentId) : null;
  const schedule = schedules.find((s) => s.id === apt.scheduleId);
  const device = apt.deviceId ? devices.find((d) => d.id === apt.deviceId) : null;
  return {
    ...apt,
    deviceName: device ? device.deviceName : '',
    serialNumber: apt.serialNo,
    patientAge: apt.age,
    timeSlot: apt.time,
    doctorNameBn: (doctor && doctor.nameBn) || apt.doctorNameBn || 'বিশেষজ্ঞ ডাক্তার',
    doctorNameEn: (doctor && doctor.nameEn) || apt.doctorNameEn || 'Specialist Doctor',
    // Doctor with no photo, or no longer listed: blank, and screens show a doctor icon
    doctorImage: (doctor && doctor.image) || '',
    departmentNameBn: (dept && dept.nameBn) || 'সাধারণ',
    departmentNameEn: (dept && dept.nameEn) || 'General',
    chamber: (schedule && schedule.place) || (doctor && doctor.chamberBn) || 'চেম্বার',
  };
};

export const loadAppointments = async () => {
  const [appointments, doctors, departments, schedules, devices] = await Promise.all([
    getAll('appointments'),
    getAll('doctors'),
    getAll('departments'),
    getAll('schedules'),
    getAll('devices'),
  ]);
  return appointments.map((apt) => toView(apt, doctors, departments, schedules, devices));
};

// My Appointments: everything booked with this phone number, newest first
export const getAppointmentsForPhone = async (phone) => {
  const normPhone = normalizePhone(phone);
  if (!normPhone) return [];
  const all = await loadAppointments();
  return all.filter((apt) => normalizePhone(apt.patientPhone) === normPhone);
};

export const getAppointmentsByDoctor = async (doctorIdOrName) => {
  const all = await loadAppointments();
  if (!doctorIdOrName || doctorIdOrName === 'all') return all;
  const q = doctorIdOrName.toLowerCase().trim();
  return all.filter((apt) => {
    return (
      (apt.doctorId && apt.doctorId.toLowerCase() === q) ||
      (apt.doctorNameBn && apt.doctorNameBn.toLowerCase().includes(q)) ||
      (apt.doctorNameEn && apt.doctorNameEn.toLowerCase().includes(q))
    );
  });
};

// Book: one SCHEDULE row (doctor, patient, date, time, place) fills one APPOINTMENT row
export const saveAppointment = async (bookingData) => {
  const doctor = bookingData.doctor || {};
  const doctorId = doctor.id || bookingData.doctorId || null;
  const date = bookingData.date || 'আজ';
  const time = bookingData.timeSlot || '১০:০০ AM';
  const phone = normalizePhone(bookingData.patientPhone);

  const patient = phone
    ? await ensurePatient({
        phone,
        name: bookingData.patientName || '',
        age: bookingData.patientAge || '',
      })
    : null;

  // Serial = next number in this doctor's queue for that day
  const startsAt = bookingData.startsAt || null;
  // Same day by the real start time when both have one (date text differs between Bangla and English)
  const localDay = (iso) => new Date(iso).toDateString();
  const sameDay = (a) =>
    a.startsAt && startsAt ? localDay(a.startsAt) === localDay(startsAt) : a.date === date;

  const existing = await getAll('appointments');
  const serialNo =
    existing.filter((a) => a.doctorId === doctorId && sameDay(a) && a.status !== 'cancelled')
      .length + 1;

  const schedule = await insert('schedules', {
    id: newId('sch'),
    date,
    time,
    doctorId,
    patientId: patient ? patient.id : null,
    place: doctor.chamberBn || bookingData.chamber || '',
  });

  const newRow = await insert(
    'appointments',
    {
      id: bookingData.id || newId('apt'),
      serialNo,
      patientPhone: phone,
      patientName: bookingData.patientName || (patient && patient.name) || 'রোগী',
      age: bookingData.patientAge || (patient && patient.age) || '',
      doctorNameBn: doctor.nameBn || bookingData.doctorNameBn || '',
      doctorNameEn: doctor.nameEn || bookingData.doctorNameEn || '',
      date,
      time,
      startsAt, // exact start time, used for the 2-hour reminder
      doctorId,
      patientId: patient ? patient.id : null,
      scheduleId: schedule.id,
      deviceId: bookingData.deviceId || null, // the phone the patient booked from
      fee: bookingData.fee || doctor.feeBn || '৳১,০০০',
      reason: bookingData.reason || '',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    },
    { atStart: true }
  );

  if (patient) {
    await update('patients', patient.id, {
      appointments: [newRow.id, ...(patient.appointments || [])],
      doctorId: doctorId || patient.doctorId,
    });
  }

  const updatedList = await loadAppointments();
  const newAppointment = updatedList.find((a) => a.id === newRow.id);
  return { updatedList, newAppointment };
};

export const updateAppointmentStatus = async (appointmentId, newStatus) => {
  await update('appointments', appointmentId, { status: newStatus });
  return loadAppointments();
};

export const deleteAppointment = async (appointmentId) => {
  const apt = await findById('appointments', appointmentId);
  if (apt) {
    await remove('appointments', appointmentId);
    if (apt.scheduleId) await remove('schedules', apt.scheduleId);
    const patient = apt.patientId ? await findById('patients', apt.patientId) : null;
    if (patient) {
      await update('patients', patient.id, {
        appointments: (patient.appointments || []).filter((id) => id !== appointmentId),
      });
    }
  }
  return loadAppointments();
};
