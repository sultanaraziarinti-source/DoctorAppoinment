import { getAll, getCached, findById, insert, update, remove, replaceAll, newId } from './database';
import { healDoctor } from './schema';
import { departmentsData as initialDepartments } from '../data/doctorsData';

// DEPARTMENT rows joined with their DOCTOR rows; screens still read dept.doctors
const joinDepartments = (departments, doctors) =>
  departments.map((dept) => {
    const list = doctors.filter((doc) => doc.departmentId === dept.id);
    return { ...dept, doctorNo: list.length, doctorCount: list.length, doctors: list };
  });

// Load all departments and their doctors
export const loadDepartmentsData = async () => {
  const departments = await getAll('departments');
  const doctors = await getAll('doctors');
  return joinDepartments(departments, doctors);
};

// Get in-memory or sync copy
export const getCachedDepartments = () => {
  const departments = getCached('departments');
  return departments.length > 0
    ? joinDepartments(departments, getCached('doctors'))
    : initialDepartments;
};

// Save nested departments back as separate DEPARTMENT and DOCTOR rows
export const saveDepartmentsData = async (departments) => {
  const deptRows = [];
  const doctorRows = [];
  departments.forEach((dept) => {
    const { doctors = [], doctorCount, ...fields } = dept;
    deptRows.push({ ...fields, doctorNo: doctors.length });
    doctors.forEach((doc) => doctorRows.push(healDoctor({ ...doc, departmentId: dept.id })));
  });
  await replaceAll('departments', deptRows);
  await replaceAll('doctors', doctorRows);
  return loadDepartmentsData();
};

// Find or create the DEPARTMENT row a doctor is being placed in
const ensureDepartment = async (departmentId, data) => {
  const existing = await findById('departments', departmentId);
  if (existing) return existing;
  return insert('departments', {
    id: departmentId,
    nameBn: data.categoryNameBn || data.categoryName || 'নতুন বিভাগ',
    nameEn: data.categoryNameEn || data.categoryName || 'New Department',
    icon: trimmed(data.categoryIcon),
    color: '#0E747F',
    doctorNo: 0,
    descriptionBn: data.categoryDescBn || 'বিশেষজ্ঞ পরামর্শ সেবা',
    descriptionEn: data.categoryDescEn || 'Specialist consultation service',
  });
};

const trimmed = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');

// Add a doctor
export const addDoctor = async (doctorData) => {
  const departmentId = doctorData.categoryId || doctorData.departmentId || 'medicine';
  await ensureDepartment(departmentId, doctorData);

  const newDoctor = healDoctor({
    id: `doc-${Date.now()}`,
    departmentId,
    nameBn: doctorData.nameBn || 'ডাঃ নাম দেওয়া হয়নি',
    nameEn: doctorData.nameEn || 'Dr. Name',
    degreesBn: doctorData.degreesBn || 'এমবিবিএস',
    degreesEn: doctorData.degreesEn || 'MBBS',
    designationBn: doctorData.designationBn || 'বিশেষজ্ঞ ডাক্তার',
    designationEn: doctorData.designationEn || 'Specialist Doctor',
    hospitalBn: doctorData.hospitalBn || 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
    hospitalEn: doctorData.hospitalEn || 'Dhaka Medical College Hospital',
    chamberBn: doctorData.chamberBn || 'পপুলার ডায়াগনস্টিক সেন্টার',
    chamberEn: doctorData.chamberEn || 'Popular Diagnostic Centre',
    experienceBn: trimmed(doctorData.experience) || trimmed(doctorData.experienceBn),
    experienceEn: trimmed(doctorData.experienceEn) || trimmed(doctorData.experience),
    feeBn: trimmed(doctorData.fee) || trimmed(doctorData.feeBn),
    feeEn: trimmed(doctorData.feeEn) || trimmed(doctorData.fee),
    availableBn: doctorData.availableBn || 'শনি - বুধ: বিকাল ৫:০০ - রাত ৯:০০',
    availableEn: doctorData.availableEn || 'Sat - Wed: 5:00 PM - 9:00 PM',
    rating: doctorData.rating || '4.9',
    reviews: doctorData.reviews || 120,
    image: trimmed(doctorData.image),
  });

  await insert('doctors', newDoctor, { atStart: true });
  // DOCTOR "is a" USER, so both share the id
  await insert('users', {
    id: newDoctor.id,
    role: 'doctor',
    registered: false,
    createdAt: new Date().toISOString(),
  });
  return { updatedDepartments: await loadDepartmentsData(), newDoctor };
};

// Update an existing doctor
export const updateDoctor = async (doctorId, updatedFields) => {
  const doctorFound = await findById('doctors', doctorId);
  if (!doctorFound) {
    throw new Error('Doctor not found');
  }

  const targetDepartmentId =
    updatedFields.categoryId || updatedFields.departmentId || doctorFound.departmentId;
  if (targetDepartmentId !== doctorFound.departmentId) {
    await ensureDepartment(targetDepartmentId, updatedFields);
  }

  const pick = (key) => trimmed(updatedFields[key]) || doctorFound[key];
  const updatedDoc = healDoctor({
    ...doctorFound,
    departmentId: targetDepartmentId,
    nameBn: pick('nameBn'),
    nameEn: pick('nameEn'),
    degreesBn: pick('degreesBn'),
    degreesEn: pick('degreesEn'),
    designationBn: pick('designationBn'),
    designationEn: pick('designationEn'),
    hospitalBn: pick('hospitalBn'),
    hospitalEn: pick('hospitalEn'),
    chamberBn: pick('chamberBn'),
    chamberEn: pick('chamberEn'),
    experienceBn: trimmed(updatedFields.experience) || pick('experienceBn'),
    experienceEn: pick('experienceEn'),
    feeBn: trimmed(updatedFields.fee) || pick('feeBn'),
    feeEn: pick('feeEn'),
    availableBn: pick('availableBn'),
    availableEn: pick('availableEn'),
    // A cleared photo field removes the photo
    image: 'image' in updatedFields ? trimmed(updatedFields.image) : doctorFound.image,
  });

  await update('doctors', doctorId, updatedDoc);
  return { updatedDepartments: await loadDepartmentsData(), updatedDoctor: updatedDoc };
};

// Add a department; a name left empty in one language takes the other
export const addDepartment = async ({ nameBn = '', nameEn = '', icon = '' }) => {
  const bn = trimmed(nameBn) || trimmed(nameEn);
  const en = trimmed(nameEn) || trimmed(nameBn);
  if (!bn) throw new Error('Department name is required');
  const newDepartment = await insert('departments', {
    id: `dept-${Date.now()}`,
    nameBn: bn,
    nameEn: en,
    // Blank when no icon is given; screens show a stand-in icon for it
    icon: trimmed(icon),
    color: '#0E747F',
    doctorNo: 0,
    descriptionBn: 'বিশেষজ্ঞ পরামর্শ সেবা',
    descriptionEn: 'Specialist consultation service',
  });
  return { updatedDepartments: await loadDepartmentsData(), newDepartment };
};

// Delete an empty department. Every DOCTOR must belong to a DEPARTMENT,
// so one that still has doctors is refused (error code DEPARTMENT_HAS_DOCTORS).
export const deleteDepartment = async (departmentId) => {
  const doctors = await getAll('doctors');
  const count = doctors.filter((doc) => doc.departmentId === departmentId).length;
  if (count > 0) {
    const error = new Error(`Department still has ${count} doctor(s)`);
    error.code = 'DEPARTMENT_HAS_DOCTORS';
    error.count = count;
    throw error;
  }
  const deleted = await remove('departments', departmentId);
  return { updatedDepartments: await loadDepartmentsData(), deleted };
};

// Delete a doctor
export const deleteDoctor = async (doctorId) => {
  const deleted = await remove('doctors', doctorId);
  if (deleted) await remove('users', doctorId);
  return { updatedDepartments: await loadDepartmentsData(), deleted };
};
