// Logo pictures for the departments, shown everywhere in place of their saved emoji
const DEPT_LOGOS = {
  dermatology: require('../../assets/dermatology_logo.png'),
  medicine: require('../../assets/medicine_logo.png'),
  cardiology: require('../../assets/cardiology_logo.png'),
  pediatrics: require('../../assets/pediatrics_logo.png'),
  gynecology: require('../../assets/gynecology_logo.png'),
  orthopedics: require('../../assets/orthopedics_logo.png'),
  ent: require('../../assets/ent_logo.png'),
  neurology: require('../../assets/neurology_logo.png'),
  ophthalmology: require('../../assets/ophthalmology_logo.png'),
  dentistry: require('../../assets/dentistry_logo.png'),
  gastroenterology: require('../../assets/gastroenterology_logo.png'),
  psychiatry: require('../../assets/psychiatry_logo.png'),
  surgery: require('../../assets/surgery_logo.png'),
};

// Departments added from the app get a generated id, so these are matched by name instead
const NAMED_LOGOS = [
  { match: /nephro|kidney|কিডনি|নেফ্রো/i, logo: require('../../assets/nephrology_logo.png') },
];

// The icon to draw for a department ({ id, icon, nameEn, nameBn }): its logo, else its saved icon
export const deptIconFor = (dept) => {
  if (!dept) return undefined;
  if (DEPT_LOGOS[dept.id]) return DEPT_LOGOS[dept.id];
  const name = `${dept.nameEn || ''} ${dept.nameBn || ''}`;
  const named = NAMED_LOGOS.find((entry) => entry.match.test(name));
  return named ? named.logo : dept.icon;
};

export const DERMATOLOGY_LOGO = DEPT_LOGOS.dermatology;
export const MEDICINE_LOGO = DEPT_LOGOS.medicine;
export const CARDIOLOGY_LOGO = DEPT_LOGOS.cardiology;
export const PEDIATRICS_LOGO = DEPT_LOGOS.pediatrics;
export const GYNECOLOGY_LOGO = DEPT_LOGOS.gynecology;
export const ORTHOPEDICS_LOGO = DEPT_LOGOS.orthopedics;
export const ENT_LOGO = DEPT_LOGOS.ent;
export const NEUROLOGY_LOGO = DEPT_LOGOS.neurology;
export const OPHTHALMOLOGY_LOGO = DEPT_LOGOS.ophthalmology;
export const DENTISTRY_LOGO = DEPT_LOGOS.dentistry;
export const GASTROENTEROLOGY_LOGO = DEPT_LOGOS.gastroenterology;
export const PSYCHIATRY_LOGO = DEPT_LOGOS.psychiatry;
export const SURGERY_LOGO = DEPT_LOGOS.surgery;
