import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  Image,
  ImageBackground,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LogoutIcon from '../components/LogoutIcon';
import DoctorPhoto from '../components/DoctorPhoto';
import RegistrarBookingModal from '../components/RegistrarBookingModal';
import RegistrarTabBar from '../components/RegistrarTabBar';
import DepartmentIcon from '../components/DepartmentIcon';
import {
  addDoctor,
  updateDoctor,
  deleteDoctor,
  addDepartment,
  deleteDepartment,
} from '../services/doctorsStorage';

import {
  deptIconFor,
  DERMATOLOGY_LOGO,
  MEDICINE_LOGO,
  CARDIOLOGY_LOGO,
  PEDIATRICS_LOGO,
  GYNECOLOGY_LOGO,
  ORTHOPEDICS_LOGO,
  ENT_LOGO,
  NEUROLOGY_LOGO,
  OPHTHALMOLOGY_LOGO,
  DENTISTRY_LOGO,
  GASTROENTEROLOGY_LOGO,
  PSYCHIATRY_LOGO,
  SURGERY_LOGO,
} from '../components/departmentLogos';

export default function DoctorsInfoScreen({
  departments = [],
  onUpdateDepartments,
  lang = 'bn',
  onChangeLang,
  onNavigateToHome,
  onNavigateToAppointments,
  onSelectDepartment,
  onLogout,
  onRegistrarTab, // bottom bar: 'doctors' | 'appointments' | 'home'
}) {
  const isBn = lang === 'bn';
  // Only the part of the status bar that actually covers the screen (none in Expo Go, all of it in the APK)
  const insets = useSafeAreaInsets();

  const scrollRef = useRef(null);
  // Where the content below the pinned bar starts, and the pinned bar's height (for scrolling to a section)
  const contentTopY = useRef(0);
  const stickyBarHeight = useRef(0);
  const doctorsListSectionY = useRef(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [showAllDepartments, setShowAllDepartments] = useState(false);

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Android Hardware / Phone Back Button Handler
  useEffect(() => {
    const onHardwareBack = () => {
      // 1. If Add/Edit Doctor Modal is open, close it
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      // 2. If search or filter is active, reset it
      if (searchQuery.trim().length > 0 || selectedCategoryFilter !== 'all') {
        setSearchQuery('');
        setSelectedCategoryFilter('all');
        return true;
      }
      // 3. Otherwise let it bubble to App.js (prompts double-tap exit or returns to previous screen)
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [modalVisible, searchQuery, selectedCategoryFilter]);
  const [editingDoctorId, setEditingDoctorId] = useState(null);

  // Form Fields
  const [categoryName, setCategoryName] = useState('মেডিসিন');
  // What's typed in the department field, and whether its dropdown is open
  const [deptQuery, setDeptQuery] = useState('');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  // Every text field is kept in Bangla and English; the form shows the set for the chosen language
  const [form, setForm] = useState({ bn: {}, en: {} });
  const formLang = isBn ? 'bn' : 'en';
  const setField = (key) => (text) =>
    setForm((f) => ({ ...f, [formLang]: { ...f[formLang], [key]: text } }));
  const doctorName = form[formLang].name || '';
  const setDoctorName = setField('name');
  const designation = form[formLang].designation || '';
  const setDesignation = setField('designation');
  const degrees = form[formLang].degrees || '';
  const setDegrees = setField('degrees');
  const workingPlace = form[formLang].hospital || '';
  const setWorkingPlace = setField('hospital');
  const chamber = form[formLang].chamber || '';
  const setChamber = setField('chamber');
  const availability = form[formLang].available || '';
  const setAvailability = setField('available');
  const consultationFee = form[formLang].fee || '';
  const setConsultationFee = setField('fee');
  const experience = form[formLang].experience || '';
  const setExperience = setField('experience');
  const [imageUrl, setImageUrl] = useState('');

  // "Doctor Details" panel: manage doctors and departments in one place
  const [managerVisible, setManagerVisible] = useState(false);
  // Registrar books a serial for a patient (button fixed at the bottom of the page)
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [managerTab, setManagerTab] = useState('doctors'); // 'doctors' | 'departments'
  const [managerQuery, setManagerQuery] = useState('');
  const [newDeptBn, setNewDeptBn] = useState('');
  const [newDeptEn, setNewDeptEn] = useState('');
  // Icon image link for a new department; left blank, nothing is saved (screens show 🩺 in its place)
  const [newDeptIcon, setNewDeptIcon] = useState('');

  // Extract all doctors with their parent category details
  const allDoctors = departments.flatMap((dept) =>
    (dept.doctors || []).map((doc) => ({
      ...doc,
      categoryId: dept.id,
      categoryNameBn: dept.nameBn,
      categoryNameEn: dept.nameEn,
      categoryIcon: dept.icon,
    }))
  );

  // All Doctor Departments - All departments shown directly
  const allDepartmentsList = useMemo(() => {
    const defaultDepts = [
      { id: 'medicine', nameBn: 'মেডিসিন', nameEn: 'General Physician', icon: MEDICINE_LOGO, bgColor: '#E6F5F6' },
      { id: 'cardiology', nameBn: 'কার্ডিওলজিস্ট', nameEn: 'Cardiologist', icon: CARDIOLOGY_LOGO, bgColor: '#FEE2E2' },
      { id: 'dermatology', nameBn: 'চর্মরোগ বিশেষজ্ঞ', nameEn: 'Dermatologist', icon: DERMATOLOGY_LOGO, bgColor: '#FFEDD5' },
      { id: 'gynecology', nameBn: 'গাইনী বিশেষজ্ঞ', nameEn: 'Gynecologist', icon: GYNECOLOGY_LOGO, bgColor: '#FCE7F3' },
      { id: 'pediatrics', nameBn: 'শিশু বিশেষজ্ঞ', nameEn: 'Pediatrician', icon: PEDIATRICS_LOGO, bgColor: '#FEF9C3' },
      { id: 'orthopedics', nameBn: 'অর্থোপেডিক', nameEn: 'Orthopedic', icon: ORTHOPEDICS_LOGO, bgColor: '#D1FAE5' },
      { id: 'ent', nameBn: 'নাক, কান ও গলা', nameEn: 'ENT Specialist', icon: ENT_LOGO, bgColor: '#E0E7FF' },
      { id: 'neurology', nameBn: 'নিউরোলজি', nameEn: 'Neurology', icon: NEUROLOGY_LOGO, bgColor: '#EDE9FE' },
      { id: 'ophthalmology', nameBn: 'চক্ষু বিশেষজ্ঞ', nameEn: 'Ophthalmology', icon: OPHTHALMOLOGY_LOGO, bgColor: '#F3E8FF' },
      { id: 'dentistry', nameBn: 'দন্ত চিকিৎসা', nameEn: 'Dentistry', icon: DENTISTRY_LOGO, bgColor: '#CCFBF1' },
      { id: 'gastroenterology', nameBn: 'গ্যাস্ট্রোএন্টারোলজি', nameEn: 'Gastroenterology', icon: GASTROENTEROLOGY_LOGO, bgColor: '#FFE4E6' },
      { id: 'psychiatry', nameBn: 'মনোরোগ বিশেষজ্ঞ', nameEn: 'Psychiatrist', icon: PSYCHIATRY_LOGO, bgColor: '#FEF3C7' },
      { id: 'surgery', nameBn: 'জেনারেল সার্জারি', nameEn: 'General Surgery', icon: SURGERY_LOGO, bgColor: '#F1F5F9' },
    ];

    // Only departments that exist (so a deleted one disappears); the standard ones keep their look above
    if (!departments || departments.length === 0) return defaultDepts;
    const styled = new Map(defaultDepts.map((d) => [d.id, d]));
    return departments
      .filter((dept) => dept && dept.id)
      .map((dept) => {
        const known = styled.get(dept.id);
        // Standard departments keep their look, but always show the saved name (same as Doctor Details)
        if (known) {
          return { ...known, nameBn: dept.nameBn || known.nameBn, nameEn: dept.nameEn || known.nameEn };
        }
        return {
          id: dept.id,
          nameBn: dept.nameBn || dept.id,
          nameEn: dept.nameEn || dept.id,
          icon: deptIconFor(dept) || '🩺',
          bgColor: '#E6F5F6',
        };
      });
  }, [departments]);

  // Currently active filtered department object
  const activeDept = useMemo(() => {
    if (selectedCategoryFilter === 'all') return null;
    return allDepartmentsList.find((d) => d.id === selectedCategoryFilter) || null;
  }, [allDepartmentsList, selectedCategoryFilter]);

  // Available categories for selection in Add/Edit Modal
  const categoryOptions = [
    { id: 'medicine', nameBn: 'মেডিসিন', nameEn: 'General Medicine', icon: '💊' },
    { id: 'cardiology', nameBn: 'কার্ডিওলজি (হার্ট)', nameEn: 'Cardiology (Heart)', icon: '❤️' },
    { id: 'pediatrics', nameBn: 'শিশু বিশেষজ্ঞ', nameEn: 'Pediatrics (Child)', icon: '👶' },
    { id: 'gynecology', nameBn: 'গাইনী ও প্রসূতি', nameEn: 'Gynecology', icon: '♀️' },
    { id: 'orthopedics', nameBn: 'অর্থোপেডিকস (হাড়)', nameEn: 'Orthopedics', icon: '🦴' },
    { id: 'dermatology', nameBn: 'চর্ম ও যৌন রোগ', nameEn: 'Dermatology & Skin', icon: '🩹' },
    { id: 'ent', nameBn: 'নাক, কান ও গলা (ENT)', nameEn: 'ENT', icon: '👂' },
    { id: 'neurology', nameBn: 'নিউরোলজি (মস্তিষ্ক)', nameEn: 'Neurology', icon: '🧠' },
    { id: 'ophthalmology', nameBn: 'চক্ষু বিশেষজ্ঞ', nameEn: 'Ophthalmology (Eye)', icon: '👁️' },
    { id: 'dentistry', nameBn: 'দন্ত চিকিৎসা (Dental)', nameEn: 'Dentistry', icon: '🦷' },
    { id: 'surgery', nameBn: 'জেনারেল সার্জারি', nameEn: 'General Surgery', icon: '🩺' },
  ];

  // Departments offered in the form's dropdown: the ones already saved
  const deptOptions = useMemo(() => {
    const saved = (departments || [])
      .filter((d) => d && d.id)
      .map((d) => ({
        id: d.id,
        nameBn: d.nameBn || d.nameEn || d.id,
        nameEn: d.nameEn || d.nameBn || d.id,
        icon: deptIconFor(d) || '🩺',
      }));
    return saved.length > 0 ? saved : categoryOptions;
  }, [departments]);

  const deptLabel = (opt) => (opt ? (isBn ? opt.nameBn : opt.nameEn) : '');
  const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  // An existing department whose name is exactly what was typed
  const findDeptByName = (text) =>
    deptOptions.find((d) => sameText(d.nameBn, text) || sameText(d.nameEn, text));

  const deptQueryTrimmed = deptQuery.trim().toLowerCase();
  const selectedDept = deptOptions.find((d) => d.id === categoryName) || null;
  // While a department is picked, its name is in the field, so list them all
  const filteredDeptOptions =
    !deptQueryTrimmed || (selectedDept && sameText(deptLabel(selectedDept), deptQuery))
      ? deptOptions
      : deptOptions.filter(
          (d) =>
            d.nameBn.toLowerCase().includes(deptQueryTrimmed) ||
            d.nameEn.toLowerCase().includes(deptQueryTrimmed)
        );

  // Switching language shows the picked department's name in that language
  useEffect(() => {
    const picked = deptOptions.find((d) => d.id === categoryName);
    if (picked) setDeptQuery(deptLabel(picked));
  }, [lang]);

  const handleDeptTextChange = (text) => {
    setDeptQuery(text);
    const match = findDeptByName(text);
    setCategoryName(match ? match.id : '');
    setShowDeptDropdown(true);
  };

  const handlePickDept = (opt) => {
    setCategoryName(opt.id);
    setDeptQuery(deptLabel(opt));
    setShowDeptDropdown(false);
  };

  // Open modal for Adding a new Doctor
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingDoctorId(null);
    setCategoryName('');
    setDeptQuery('');
    setShowDeptDropdown(false);
    setForm({
      bn: { available: 'শনি - বুধ: বিকাল ৫:০০ - রাত ৯:০০', fee: '৳১,০০০', experience: '১০+ বছরের অভিজ্ঞতা' },
      en: { available: 'Sat - Wed: 5:00 PM - 9:00 PM', fee: '৳1,000', experience: '10+ Years Exp.' },
    });
    setImageUrl('');
    setModalVisible(true);
  };

  // Open modal for Editing an existing Doctor
  const handleOpenEditModal = (doc) => {
    setIsEditing(true);
    setEditingDoctorId(doc.id);
    const docDept = deptOptions.find((d) => d.id === doc.categoryId);
    setCategoryName(doc.categoryId || '');
    setDeptQuery(docDept ? deptLabel(docDept) : (isBn ? doc.categoryNameBn : doc.categoryNameEn) || '');
    setShowDeptDropdown(false);
    setForm({
      bn: {
        name: doc.nameBn || '',
        designation: doc.designationBn || '',
        degrees: doc.degreesBn || '',
        hospital: doc.hospitalBn || '',
        chamber: doc.chamberBn || '',
        available: doc.availableBn || doc.available || '',
        fee: doc.feeBn || doc.fee || '',
        experience: doc.experienceBn || doc.experience || '',
      },
      en: {
        name: doc.nameEn || '',
        designation: doc.designationEn || '',
        degrees: doc.degreesEn || '',
        hospital: doc.hospitalEn || '',
        chamber: doc.chamberEn || '',
        available: doc.availableEn || doc.available || '',
        fee: doc.feeEn || doc.fee || '',
        experience: doc.experienceEn || doc.experience || '',
      },
    });
    setImageUrl(doc.image || '');
    setModalVisible(true);
  };

  // Save (Add or Update) Doctor
  const handleSaveDoctor = async () => {
    const deptText = deptQuery.trim();
    if (!categoryName && !deptText) {
      Alert.alert(
        isBn ? 'বিভাগ আবশ্যক' : 'Department Required',
        isBn ? 'তালিকা থেকে একটি বিভাগ বেছে নিন অথবা নতুন বিভাগের নাম লিখুন।' : 'Pick a department from the list or type a new one.'
      );
      return;
    }
    // Bangla and English value of a field; a language left empty takes the other one's text
    const both = (key, defaultBn = '', defaultEn = '') => {
      const bn = String(form.bn[key] || '').trim();
      const en = String(form.en[key] || '').trim();
      return { bn: bn || en || defaultBn, en: en || bn || defaultEn };
    };
    const name = both('name');
    const hospital = both('hospital');
    if (!name.bn) {
      Alert.alert(isBn ? 'নাম আবশ্যক' : 'Name Required', isBn ? 'দয়া করে ডাক্তারের নাম লিখুন।' : 'Please enter doctor name.');
      return;
    }
    if (!hospital.bn) {
      Alert.alert(isBn ? 'কর্মস্থল আবশ্যক' : 'Working Place Required', isBn ? 'দয়া করে ডাক্তারের কর্মস্থল বা হাসপাতালের নাম লিখুন।' : 'Please enter hospital / working place.');
      return;
    }

    // A picked or exactly-typed department is reused; any other name becomes a new department
    const matchedCat =
      deptOptions.find((c) => c.id === categoryName) || findDeptByName(deptText);
    const catId = matchedCat ? matchedCat.id : `dept-${Date.now()}`;
    const catNameBn = matchedCat ? matchedCat.nameBn : deptText;
    const catNameEn = matchedCat ? matchedCat.nameEn : deptText;
    // A department typed in here is new and has no icon yet
    const catIcon = matchedCat ? matchedCat.icon : '';

    const designationText = both('designation', 'বিশেষজ্ঞ ডাক্তার', 'Specialist Doctor');
    const degreesText = both('degrees', 'এমবিবিএস', 'MBBS');
    const chamberText = both('chamber', 'চেম্বার', 'Chamber');
    const availableText = both('available', 'শনি - বুধ: বিকাল ৫:০০ - রাত ৯:০০', 'Sat - Wed: 5:00 PM - 9:00 PM');
    const feeText = both('fee', '৳১,০০০', '৳1,000');
    const expText = both('experience', '১০+ বছরের অভিজ্ঞতা', '10+ Years Exp.');

    const doctorData = {
      categoryId: catId,
      categoryNameBn: catNameBn,
      categoryNameEn: catNameEn,
      categoryIcon: catIcon,
      nameBn: name.bn,
      nameEn: name.en,
      designationBn: designationText.bn,
      designationEn: designationText.en,
      degreesBn: degreesText.bn,
      degreesEn: degreesText.en,
      hospitalBn: hospital.bn,
      hospitalEn: hospital.en,
      chamberBn: chamberText.bn,
      chamberEn: chamberText.en,
      availableBn: availableText.bn,
      availableEn: availableText.en,
      // storage reads the plain fee / experience as the Bangla value
      fee: feeText.bn,
      feeBn: feeText.bn,
      feeEn: feeText.en,
      experience: expText.bn,
      experienceBn: expText.bn,
      experienceEn: expText.en,
      // Left blank when no photo is given; screens show a doctor icon instead
      image: imageUrl.trim(),
    };

    try {
      if (isEditing && editingDoctorId) {
        // Update existing doctor
        const res = await updateDoctor(editingDoctorId, doctorData);
        if (onUpdateDepartments) onUpdateDepartments(res.updatedDepartments);
        Alert.alert(isBn ? 'সফল!' : 'Success!', isBn ? 'ডাক্তার তথ্য সফলভাবে আপডেট করা হয়েছে।' : 'Doctor updated successfully.');
      } else {
        // Add new doctor
        const res = await addDoctor(doctorData);
        if (onUpdateDepartments) onUpdateDepartments(res.updatedDepartments);
        Alert.alert(isBn ? 'সফল!' : 'Success!', isBn ? 'নতুন ডাক্তার সফলভাবে যুক্ত করা হয়েছে এবং উপলব্ধ ডাক্তার তালিকায় যুক্ত হয়েছে।' : 'New doctor added successfully.');
      }
      setModalVisible(false);
    } catch (error) {
      console.warn('Error saving doctor:', error);
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'সংরক্ষণে সমস্যা হয়েছে।' : 'Failed to save doctor.');
    }
  };

  // Delete a doctor
  const handleDeleteDoctor = (doc) => {
    Alert.alert(
      isBn ? 'ডাক্তার অপসারণ' : 'Delete Doctor',
      isBn
        ? `আপনি কি নিশ্চিত যে "${doc.nameBn || doc.nameEn}" কে ডাক্তার তালিকা থেকে মুছে ফেলতে চান?`
        : `Are you sure you want to delete "${doc.nameEn || doc.nameBn}"?`,
      [
        { text: isBn ? 'না' : 'Cancel', style: 'cancel' },
        {
          text: isBn ? 'হ্যাঁ, মুছুন' : 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteDoctor(doc.id);
              if (onUpdateDepartments) onUpdateDepartments(res.updatedDepartments);
              Alert.alert(isBn ? 'মুছে ফেলা হয়েছে' : 'Deleted', isBn ? 'ডাক্তার সফলভাবে অপসারণ করা হয়েছে।' : 'Doctor deleted successfully.');
            } catch (err) {
              Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'অপসারণে সমস্যা হয়েছে।' : 'Failed to delete doctor.');
            }
          },
        },
      ]
    );
  };

  // Bottom bar inside the full-screen panels: close them, then go to that tab's page
  const handlePanelTab = (tab) => {
    setModalVisible(false);
    setManagerVisible(false);
    setShowBookingModal(false);
    if (tab !== 'doctors' && onRegistrarTab) onRegistrarTab(tab);
  };

  const handleOpenManager = () => {
    setManagerTab('doctors');
    setManagerQuery('');
    setManagerVisible(true);
  };

  // Panel search: doctors by name, department, designation, degrees or hospital; departments by name
  const managerQ = managerQuery.trim().toLowerCase();
  const matchesQuery = (...values) =>
    !managerQ || values.some((v) => String(v || '').toLowerCase().includes(managerQ));
  const managerDoctors = allDoctors.filter((doc) =>
    matchesQuery(
      doc.nameBn, doc.nameEn, doc.categoryNameBn, doc.categoryNameEn,
      doc.designationBn, doc.designationEn, doc.degreesBn, doc.degreesEn,
      doc.hospitalBn, doc.hospitalEn
    )
  );
  const managerDepartments = (departments || []).filter((dept) => matchesQuery(dept.nameBn, dept.nameEn));

  const handleAddDepartment = async () => {
    const bn = newDeptBn.trim();
    const en = newDeptEn.trim();
    if (!bn && !en) {
      Alert.alert(
        isBn ? 'নাম আবশ্যক' : 'Name Required',
        isBn ? 'বিভাগের নাম বাংলা বা ইংরেজিতে লিখুন।' : 'Type the department name in Bangla or English.'
      );
      return;
    }
    const exists = (departments || []).some(
      (d) => sameText(d.nameBn, bn || en) || sameText(d.nameEn, en || bn)
    );
    if (exists) {
      Alert.alert(
        isBn ? 'বিভাগ আগে থেকেই আছে' : 'Already Exists',
        isBn ? 'এই নামে একটি বিভাগ ইতিমধ্যে আছে।' : 'A department with this name already exists.'
      );
      return;
    }
    try {
      const res = await addDepartment({ nameBn: bn, nameEn: en, icon: newDeptIcon.trim() });
      if (onUpdateDepartments) onUpdateDepartments(res.updatedDepartments);
      setNewDeptBn('');
      setNewDeptEn('');
      setNewDeptIcon('');
      Alert.alert(isBn ? 'সফল!' : 'Success!', isBn ? 'নতুন বিভাগ যুক্ত হয়েছে।' : 'Department added.');
    } catch (err) {
      console.warn('Error adding department:', err);
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'বিভাগ যুক্ত করতে সমস্যা হয়েছে।' : 'Failed to add department.');
    }
  };

  const handleDeleteDepartment = (dept) => {
    const name = isBn ? dept.nameBn || dept.nameEn : dept.nameEn || dept.nameBn;
    const count = (dept.doctors || []).length;
    if (count > 0) {
      Alert.alert(
        isBn ? 'মুছে ফেলা যাবে না' : "Can't Delete",
        isBn
          ? `"${name}" বিভাগে ${count} জন ডাক্তার আছেন। আগে ডাক্তারদের অন্য বিভাগে সরান বা মুছে ফেলুন।`
          : `"${name}" still has ${count} doctor(s). Move them to another department or delete them first.`
      );
      return;
    }
    Alert.alert(
      isBn ? 'বিভাগ মুছুন' : 'Delete Department',
      isBn ? `"${name}" বিভাগটি মুছে ফেলতে চান?` : `Delete the "${name}" department?`,
      [
        { text: isBn ? 'না' : 'Cancel', style: 'cancel' },
        {
          text: isBn ? 'হ্যাঁ, মুছুন' : 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteDepartment(dept.id);
              if (onUpdateDepartments) onUpdateDepartments(res.updatedDepartments);
              if (selectedCategoryFilter === dept.id) setSelectedCategoryFilter('all');
            } catch (err) {
              console.warn('Error deleting department:', err);
              Alert.alert(
                isBn ? 'ত্রুটি' : 'Error',
                err.code === 'DEPARTMENT_HAS_DOCTORS'
                  ? isBn ? 'এই বিভাগে এখনো ডাক্তার আছেন।' : 'This department still has doctors.'
                  : isBn ? 'বিভাগ মুছতে সমস্যা হয়েছে।' : 'Failed to delete department.'
              );
            }
          },
        },
      ]
    );
  };

  // Helper to check if a doctor belongs to a department
  const isDoctorInDepartment = (doc, deptId) => {
    if (!doc || !deptId || deptId === 'all') return true;
    if (doc.categoryId && doc.categoryId.toLowerCase() === deptId.toLowerCase()) return true;
    const targetDept = allDepartmentsList.find((d) => d.id === deptId);
    if (targetDept) {
      if (doc.categoryNameBn && targetDept.nameBn && doc.categoryNameBn.trim() === targetDept.nameBn.trim()) return true;
      if (doc.categoryNameEn && targetDept.nameEn && doc.categoryNameEn.trim().toLowerCase() === targetDept.nameEn.trim().toLowerCase()) return true;
      if (doc.categoryNameBn && doc.categoryNameBn.includes(targetDept.nameBn)) return true;
      if (targetDept.nameBn && targetDept.nameBn.includes(doc.categoryNameBn)) return true;
    }
    return false;
  };

  // Filtering doctors for display
  const filteredDoctors = allDoctors.filter((doc) => {
    // Category filter
    if (selectedCategoryFilter !== 'all' && !isDoctorInDepartment(doc, selectedCategoryFilter)) {
      return false;
    }
    // Search query filter
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (doc.nameBn && doc.nameBn.toLowerCase().includes(q)) ||
      (doc.nameEn && doc.nameEn.toLowerCase().includes(q)) ||
      (doc.categoryNameBn && doc.categoryNameBn.toLowerCase().includes(q)) ||
      (doc.categoryNameEn && doc.categoryNameEn.toLowerCase().includes(q)) ||
      (doc.hospitalBn && doc.hospitalBn.toLowerCase().includes(q)) ||
      (doc.chamberBn && doc.chamberBn.toLowerCase().includes(q)) ||
      (doc.designationBn && doc.designationBn.toLowerCase().includes(q))
    );
  });
  const showDoctorList = selectedCategoryFilter !== 'all' || searchQuery.trim().length > 0;
  // The department grid follows the same search, by Bangla or English name
  const searchedDepartments = allDepartmentsList.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    return !q || [d.nameBn, d.nameEn, d.id].some((v) => String(v || '').toLowerCase().includes(q));
  });

  const handleSelectDepartmentFilter = (item) => {
    if (selectedCategoryFilter === item.id) {
      setSelectedCategoryFilter('all');
    } else {
      setSelectedCategoryFilter(item.id);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, contentTopY.current + doctorsListSectionY.current - stickyBarHeight.current - 12),
          animated: true,
        });
      }, 70);
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Covers the status bar area (APK draws under it) so the pinned bar never slides beneath it */}
      <View style={[styles.statusBarCover, { height: insets.top }]} />

      {/* Main Scroll Content Area: the banner scrolls away, tabs + search stay pinned (child 1) */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.pageScroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Banner Styled like the Home Page View */}
        <ImageBackground
          source={require('../../assets/medical_pattern.jpg')}
          style={styles.bannerBackground}
          resizeMode="cover"
        >
          <View style={[styles.bannerWhiteWash, { paddingTop: 8 }]}>
            {/* Language switch on its own line, above the portal badge and logout */}
            <View style={styles.langRow}>
              <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
            </View>

            {/* Top Navigation Row */}
            <View style={styles.topNavRow}>
              <View style={styles.badgeRegistrar}>
                <Text style={styles.badgeRegistrarText} numberOfLines={1} adjustsFontSizeToFit>
                  🛡️ {isBn ? 'রেজিস্ট্রার অ্যাডমিন পোর্টাল' : 'Registrar Admin Portal'}
                </Text>
              </View>
              <TouchableOpacity style={styles.logoutPill} onPress={onLogout} activeOpacity={0.8}>
                <LogoutIcon size={15} />
                <Text style={styles.logoutPillText}>{isBn ? 'লগআউট' : 'Logout'}</Text>
              </TouchableOpacity>
            </View>

            {/* Banner Main Section: Text on Left + Provided Image on Right */}
            <View style={styles.bannerContentRow}>
              <View style={styles.bannerTextCol}>
                <Text style={styles.helloGreeting}>
                  {isBn ? 'স্বাগতম, রেজিস্টার' : 'Welcome, Registrar'}
                </Text>
                <Text style={styles.takeCareHeading}>
                  {isBn ? 'ডাক্তার ব্যবস্থাপনা' : 'Doctor Management'}
                </Text>
                <Text style={styles.takeCareSubtitle}>
                  {isBn
                    ? 'ডাক্তারদের ক্যাটাগরি, কর্মস্থল, চেম্বার, সময়সূচি ও ফি পরিচালনা করুন।'
                    : 'Manage doctor categories, working place, chamber, schedule & fees.'}
                </Text>

                <TouchableOpacity
                  style={styles.addDoctorBannerBtn}
                  onPress={handleOpenManager}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addDoctorBannerBtnIcon}>🗂️</Text>
                  <Text style={styles.addDoctorBannerBtnText}>
                    {isBn ? 'ডাক্তারের বিবরণ' : 'Doctor Details'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bannerImageCol}>
                <Image
                  source={require('../../assets/registrar_reception.png')}
                  style={styles.bannerReceptionImage}
                  resizeMode="cover"
                />
                <View style={styles.floatingHeartBadge}>
                  <Text style={styles.floatingHeartText}>🏥</Text>
                </View>
              </View>
            </View>

          </View>
        </ImageBackground>

        {/* Pinned bar: search */}
        <View
          style={styles.stickyBar}
          onLayout={(e) => {
            stickyBarHeight.current = e.nativeEvent.layout.height;
          }}
        >

        {/* Search Bar Section */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Image
              source={require('../../assets/search_icon.png')}
              style={styles.searchIconImage}
              resizeMode="contain"
            />
            <TextInput
              style={styles.searchInput}
              placeholder={
                isBn
                  ? 'ডাক্তার নাম বা বিভাগ দিয়ে খুঁজুন...'
                  : 'Search doctor name or department...'
              }
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchIcon}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        </View>

        <View
          style={styles.doctorsListScroll}
          onLayout={(e) => {
            contentTopY.current = e.nativeEvent.layout.y;
          }}
        >

        {/* All Doctor Departments Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {isBn ? 'সকল বিভাগ' : 'All Departments'}
          </Text>
          {selectedCategoryFilter !== 'all' ? (
            <TouchableOpacity
              onPress={() => setSelectedCategoryFilter('all')}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>
                {isBn ? 'সকল ডাক্তার দেখুন ✕' : 'Show All Doctors ✕'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.seeAllText}>
              {searchedDepartments.length} {isBn ? 'টি বিভাগ' : 'Depts'}
            </Text>
          )}
        </View>

        {/* All Doctor Departments Grid */}
        <View style={styles.specialtiesGrid}>
          {[
            ...searchedDepartments,
            // empty cells keep the last row's cards in their columns (no gap in the middle)
            ...Array.from({ length: (3 - (searchedDepartments.length % 3)) % 3 }, (_, i) => ({
              id: `filler-${i}`,
              filler: true,
            })),
          ].map((item) => {
            if (item.filler) return <View key={item.id} style={styles.specialtyFiller} />;
            const isSelected = selectedCategoryFilter === item.id;
            const deptDoctors = allDoctors.filter((d) => isDoctorInDepartment(d, item.id));
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.specialtyItemCard,
                  isSelected && styles.specialtyItemCardActive,
                ]}
                onPress={() => handleSelectDepartmentFilter(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.specialtyIconCircle, { backgroundColor: item.bgColor }]}>
                  {/* size only enlarges pictures (like the dermatology logo); emoji keep fontSize 22 from specialtyIcon */}
                  <DepartmentIcon icon={item.icon} size={30} textStyle={styles.specialtyIcon} />
                </View>
                <Text
                  style={[
                    styles.specialtyItemTitle,
                    isSelected && styles.specialtyItemTitleActive,
                  ]}
                  numberOfLines={3}
                >
                  {isBn ? item.nameBn : item.nameEn}
                </Text>
                <Text style={styles.deptDoctorCountText}>
                  {deptDoctors.length > 0
                    ? `${deptDoctors.length} ${isBn ? 'জন' : 'docs'}`
                    : isBn
                    ? '০'
                    : '0'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Doctors Section with onLayout */}
        <View
          onLayout={(e) => {
            doctorsListSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          {/* Active Filter Indicator Banner if filtered */}
          {selectedCategoryFilter !== 'all' && (
            <View style={styles.activeFilterBanner}>
              <View style={styles.activeFilterTextCol}>
                <View style={styles.inlineIconRow}>
                  <DepartmentIcon icon={activeDept?.icon} size={16} textStyle={styles.activeFilterBannerText} />
                  <Text style={[styles.activeFilterBannerText, styles.inlineIconText]}>
                    {isBn ? `${activeDept?.nameBn || ''} বিভাগ` : `${activeDept?.nameEn || ''} Department`}
                  </Text>
                </View>
                <Text style={styles.activeFilterSubText}>
                  {filteredDoctors.length} {isBn ? 'জন ডাক্তার নিবন্ধিত' : 'Doctors Registered'}
                </Text>
              </View>

              <View style={styles.activeFilterBtnsRow}>
                {onSelectDepartment && (
                  <TouchableOpacity
                    style={styles.viewDeptPublicBtn}
                    onPress={() => onSelectDepartment(activeDept || { id: selectedCategoryFilter })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewDeptPublicBtnText}>
                      👁️ {isBn ? 'ডাক্তার ভিউ' : 'Doctor View'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.clearActiveFilterBtn}
                  onPress={() => setSelectedCategoryFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearActiveFilterText}>
                    {isBn ? 'সব দেখুন ✕' : 'Show All ✕'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Doctors list: only while a department is picked or a search is typed
              (doctors are managed from the Doctor Details panel) */}
          {showDoctorList && (
          <View style={styles.listHeaderRow}>
            <View style={styles.listTitleWrap}>
              <View style={styles.inlineIconRow}>
                {selectedCategoryFilter !== 'all' && (
                  <DepartmentIcon icon={activeDept?.icon} fallback="👨‍⚕️" size={16} textStyle={styles.listCountTitle} />
                )}
                <Text style={[styles.listCountTitle, styles.inlineIconText]}>
                  {selectedCategoryFilter !== 'all'
                    ? `${isBn ? activeDept?.nameBn : activeDept?.nameEn} ${isBn ? 'বিভাগের ডাক্তারবৃন্দ' : 'Doctors'}`
                    : (isBn ? 'নিবন্ধিত ডাক্তার তালিকা' : 'Registered Doctors List')}
                </Text>
              </View>
              {selectedCategoryFilter !== 'all' && (
                <Text style={styles.listFilterHintText}>
                  {isBn ? 'নির্বাচিত বিভাগের ডাক্তার তালিকা নিচে দেখানো হচ্ছে' : 'Showing doctors for selected department'}
                </Text>
              )}
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {filteredDoctors.length} {isBn ? 'জন' : 'Doctors'}
              </Text>
            </View>
          </View>
          )}
        </View>

        {!showDoctorList ? null : filteredDoctors.length > 0 ? (
          filteredDoctors.map((doc) => (
            // The whole card opens this doctor's queue, same as its Queue button
            <TouchableOpacity
              key={doc.id}
              style={styles.doctorAdminCard}
              onPress={() => onNavigateToAppointments && onNavigateToAppointments(doc)}
              activeOpacity={0.9}
            >
              {/* Doctor Category Badge & Actions */}
              <View style={styles.cardTopRow}>
                <View style={styles.categoryBadge}>
                  <View style={styles.inlineIconRow}>
                    <DepartmentIcon
                      icon={deptIconFor({ id: doc.categoryId, icon: doc.categoryIcon, nameEn: doc.categoryNameEn, nameBn: doc.categoryNameBn }) || '🩺'}
                      size={11}
                      textStyle={styles.categoryBadgeText}
                    />
                    <Text style={[styles.categoryBadgeText, styles.inlineIconText]}>
                      {isBn ? doc.categoryNameBn : doc.categoryNameEn}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.viewAptsBtn}
                    onPress={() => onNavigateToAppointments && onNavigateToAppointments(doc)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewAptsBtnText}>📋 {isBn ? 'সিরিয়াল' : 'Queue'}</Text>
                  </TouchableOpacity>

                  {/* Edit / Delete live in the Doctor Details panel */}
                </View>
              </View>

              {/* Main Info */}
              <View style={styles.cardMainInfo}>
                <DoctorPhoto uri={doc.image} style={styles.doctorAvatar} />
                <View style={styles.doctorDetailsCol}>
                  <Text style={styles.doctorCardName}>
                    {isBn ? doc.nameBn : doc.nameEn}
                  </Text>
                  <Text style={styles.doctorDesignation}>
                    {isBn ? doc.designationBn : doc.designationEn}
                  </Text>
                  <Text style={styles.doctorDegrees}>
                    {isBn ? doc.degreesBn : doc.degreesEn}
                  </Text>
                </View>
              </View>

              {/* Working Place, Chamber, Availability, Fee, Experience Details */}
              <View style={styles.cardDetailsBox}>
                <View style={styles.detailRowItem}>
                  <Text style={styles.detailIcon}>🏥</Text>
                  <Text style={styles.detailLabelBold}>{isBn ? 'কর্মস্থল:' : 'Hospital:'} </Text>
                  <Text style={styles.detailValueText} numberOfLines={1}>
                    {isBn ? doc.hospitalBn : doc.hospitalEn}
                  </Text>
                </View>

                <View style={styles.detailRowItem}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <Text style={styles.detailLabelBold}>{isBn ? 'চেম্বার:' : 'Chamber:'} </Text>
                  <Text style={styles.detailValueText} numberOfLines={1}>
                    {isBn ? doc.chamberBn : doc.chamberEn}
                  </Text>
                </View>

                <View style={styles.detailRowItem}>
                  <Text style={styles.detailIcon}>🕒</Text>
                  <Text style={styles.detailLabelBold}>{isBn ? 'উপলব্ধতা:' : 'Availability:'} </Text>
                  <Text style={styles.detailValueText} numberOfLines={1}>
                    {isBn ? doc.availableBn : doc.availableEn}
                  </Text>
                </View>

                <View style={styles.splitRowDetails}>
                  <View style={styles.splitItem}>
                    <Text style={styles.detailIcon}>💰</Text>
                    <Text style={styles.detailLabelBold}>{isBn ? 'ফি:' : 'Fee:'} </Text>
                    <Text style={[styles.detailValueText, styles.feeText]} numberOfLines={1}>
                      {(isBn ? doc.feeBn || doc.feeEn : doc.feeEn || doc.feeBn) || doc.fee || (isBn ? '৳১,০০০' : '৳1,000')}
                    </Text>
                  </View>

                  <View style={styles.splitItem}>
                    <Text style={styles.detailIcon}>⏳</Text>
                    <Text style={styles.detailLabelBold}>{isBn ? 'অভিজ্ঞতা:' : 'Exp:'} </Text>
                    <Text style={styles.detailValueText} numberOfLines={2}>
                      {(isBn ? doc.experienceBn || doc.experienceEn : doc.experienceEn || doc.experienceBn) || doc.experience || (isBn ? '১০+ বছরের অভিজ্ঞতা' : '10+ Years Exp.')}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCardBox}>
            <Text style={styles.emptyIcon}>👨‍⚕️</Text>
            <Text style={styles.emptyTitle}>
              {isBn ? 'কোনো ডাক্তার পাওয়া যায়নি' : 'No Doctors Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isBn
                ? 'উপরে "ডাক্তারের বিবরণ" বাটনে চাপ দিয়ে ডাক্তার যুক্ত করুন।'
                : 'Tap "Doctor Details" button above to add a new doctor.'}
            </Text>
          </View>
        )}
        </View>
      </ScrollView>

      {/* Make Appointment, fixed at the bottom of the page */}
      <View style={styles.bottomBookingBar}>
        <TouchableOpacity
          style={styles.bottomBookingBtn}
          onPress={() => setShowBookingModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.bottomBookingBtnText}>
            ➕ {isBn ? 'অ্যাপয়েন্টমেন্ট করুন' : 'Make Appointment'}
          </Text>
        </TouchableOpacity>
      </View>

      <RegistrarTabBar active="doctors" lang={lang} onPress={onRegistrarTab} />

      <RegistrarBookingModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        departments={departments}
        lang={lang}
        activeTab="doctors"
        onTabPress={handlePanelTab}
      />

      {/* DOCTOR DETAILS PANEL: doctors (add / edit / delete) and departments (add / delete).
          Rendered before the add/edit form so the form opens on top of it. */}
      <Modal
        visible={managerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setManagerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {/* Medical pattern behind the whole panel, lightly washed so the cards stay readable */}
          <ImageBackground
            source={require('../../assets/medical_pattern.jpg')}
            style={styles.managerBg}
            resizeMode="cover"
          >
          <View style={styles.managerBgWash}>
          {/* Back + title straight on the pattern, no colored bar */}
          <View style={[styles.managerHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setManagerVisible(false)} style={styles.modalBackBtn}>
              <Text style={[styles.modalBackIcon, styles.managerHeaderText]}>←</Text>
              <Text style={[styles.modalBackText, styles.managerHeaderText]}>{isBn ? 'ফিরে যান' : 'Back'}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, styles.managerHeaderTitle]}>
              {isBn ? 'ডাক্তারের বিবরণ' : 'Doctor Details'}
            </Text>
            <View style={styles.managerHeaderSpacer} />
          </View>

          {/* Language for the whole panel: names and fields show and save in the picked language */}
          <View style={styles.managerLangRow}>
            <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
          </View>

          {/* Tabs */}
          <View style={styles.managerTabs}>
            {[
              { id: 'doctors', label: isBn ? `👨‍⚕️ ডাক্তার (${allDoctors.length})` : `👨‍⚕️ Doctors (${allDoctors.length})` },
              { id: 'departments', label: isBn ? `🏥 বিভাগ (${departments.length})` : `🏥 Departments (${departments.length})` },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.managerTab, managerTab === tab.id && styles.managerTabActive]}
                onPress={() => setManagerTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.managerTabText, managerTab === tab.id && styles.managerTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search, for whichever tab is open */}
          <View style={styles.managerSearchBox}>
            <Image
              source={require('../../assets/search_icon.png')}
              style={styles.searchIconImage}
              resizeMode="contain"
            />
            <TextInput
              style={styles.managerSearchInput}
              placeholder={
                managerTab === 'doctors'
                  ? isBn ? 'ডাক্তারের নাম, বিভাগ বা হাসপাতাল খুঁজুন...' : 'Search doctor, department or hospital...'
                  : isBn ? 'বিভাগ খুঁজুন...' : 'Search departments...'
              }
              placeholderTextColor="#94A3B8"
              value={managerQuery}
              onChangeText={setManagerQuery}
              returnKeyType="search"
            />
            {managerQuery.length > 0 && (
              <TouchableOpacity onPress={() => setManagerQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.managerSearchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <KeyboardAvoidingView style={styles.formKeyboardArea} behavior="padding">
            <ScrollView
              contentContainerStyle={styles.formScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {managerTab === 'doctors' ? (
                <>
                  <TouchableOpacity style={styles.managerPrimaryBtn} onPress={handleOpenAddModal} activeOpacity={0.85}>
                    <Text style={styles.managerPrimaryBtnText}>
                      ➕ {isBn ? 'নতুন ডাক্তার যোগ করুন' : 'Add New Doctor'}
                    </Text>
                  </TouchableOpacity>

                  {managerDoctors.length === 0 && (
                    <Text style={styles.managerEmpty}>
                      {managerQ
                        ? isBn ? `"${managerQuery.trim()}" নামে কোনো ডাক্তার পাওয়া যায়নি।` : `No doctors match "${managerQuery.trim()}".`
                        : isBn ? 'কোনো ডাক্তার নেই।' : 'No doctors yet.'}
                    </Text>
                  )}
                  {managerDoctors.map((doc) => (
                    <View key={doc.id} style={styles.managerRow}>
                      <DoctorPhoto uri={doc.image} style={styles.managerAvatar} />
                      <View style={styles.managerRowInfo}>
                        <Text style={styles.managerRowTitle} numberOfLines={1}>
                          {isBn ? doc.nameBn || doc.nameEn : doc.nameEn || doc.nameBn}
                        </Text>
                        {/* Department icon beside its name, so a picture icon (the dermatology logo) shows too */}
                        <View style={styles.managerRowSubLine}>
                          <DepartmentIcon
                            icon={deptIconFor({ id: doc.categoryId, icon: doc.categoryIcon, nameEn: doc.categoryNameEn, nameBn: doc.categoryNameBn }) || '🩺'}
                            size={12}
                            textStyle={styles.managerRowSubIcon}
                          />
                          <Text style={[styles.managerRowSub, styles.managerRowSubText]} numberOfLines={1}>
                            {isBn ? doc.categoryNameBn : doc.categoryNameEn}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.managerEditBtn} onPress={() => handleOpenEditModal(doc)}>
                        <Text style={styles.managerEditText}>✏️ {isBn ? 'সম্পাদনা' : 'Edit'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.managerDeleteBtn} onPress={() => handleDeleteDoctor(doc)}>
                        <Text style={styles.managerDeleteText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : (
                <>
                  {/* Add a department (hidden while search results are shown) */}
                  {!managerQ && (
                  <View style={styles.managerCard}>
                    <Text style={styles.managerCardTitle}>➕ {isBn ? 'নতুন বিভাগ যোগ করুন' : 'Add New Department'}</Text>

                    {/* One name field: Bangla name while বাংলা is picked, English name while English is */}
                    <Text style={styles.formFieldLabel}>
                      {isBn ? 'বিভাগের নাম (বাংলায়)' : 'Department name (in English)'} *
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder={isBn ? 'উদাঃ কিডনি বিশেষজ্ঞ' : 'e.g. Nephrology'}
                      placeholderTextColor="#94A3B8"
                      value={isBn ? newDeptBn : newDeptEn}
                      onChangeText={isBn ? setNewDeptBn : setNewDeptEn}
                    />
                    <Text style={styles.formLangHint}>
                      {isBn
                        ? 'ইংরেজি নামের জন্য পেজের উপরে English বেছে নিন। খালি রাখলে বাংলা নামই দেখানো হবে।'
                        : 'Pick বাংলা at the top of the page for the Bangla name. Left empty, the English name is shown.'}
                    </Text>

                    {/* Icon: an image link, previewed beside the field */}
                    <Text style={styles.formFieldLabel}>{isBn ? 'আইকনের ছবির লিংক (ঐচ্ছিক)' : 'Icon image URL (Optional)'}</Text>
                    <View style={styles.deptIconInputRow}>
                      <View style={styles.managerDeptIcon}>
                        <DepartmentIcon icon={newDeptIcon.trim()} size={20} />
                      </View>
                      <TextInput
                        style={[styles.formInput, styles.deptIconInput]}
                        placeholder="https://..."
                        placeholderTextColor="#94A3B8"
                        value={newDeptIcon}
                        onChangeText={setNewDeptIcon}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                    </View>
                    <TouchableOpacity style={styles.managerPrimaryBtn} onPress={handleAddDepartment} activeOpacity={0.85}>
                      <Text style={styles.managerPrimaryBtnText}>✓ {isBn ? 'বিভাগ সংরক্ষণ করুন' : 'Save Department'}</Text>
                    </TouchableOpacity>
                  </View>
                  )}

                  {/* Existing departments, or the search results */}
                  <Text style={styles.managerSectionTitle}>
                    {managerQ
                      ? isBn ? `খোঁজের ফলাফল (${managerDepartments.length})` : `Search results (${managerDepartments.length})`
                      : isBn ? 'সকল বিভাগ' : 'All Departments'}
                  </Text>
                  {managerDepartments.length === 0 && !!managerQ && (
                    <Text style={styles.managerEmpty}>
                      {isBn ? `"${managerQuery.trim()}" নামে কোনো বিভাগ পাওয়া যায়নি।` : `No departments match "${managerQuery.trim()}".`}
                    </Text>
                  )}
                  {managerDepartments.map((dept) => {
                    const count = (dept.doctors || []).length;
                    return (
                      <View key={dept.id} style={styles.managerRow}>
                        <View style={styles.managerDeptIcon}>
                          <DepartmentIcon icon={deptIconFor(dept)} size={26} textStyle={styles.managerDeptEmoji} />
                        </View>
                        <View style={styles.managerRowInfo}>
                          <Text style={styles.managerRowTitle} numberOfLines={1}>
                            {isBn ? dept.nameBn || dept.nameEn : dept.nameEn || dept.nameBn}
                          </Text>
                          <Text style={styles.managerRowSub}>
                            {isBn ? `${count} জন ডাক্তার` : `${count} doctor${count === 1 ? '' : 's'}`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.managerDeleteBtn, count > 0 && styles.managerDeleteBtnMuted]}
                          onPress={() => handleDeleteDepartment(dept)}
                        >
                          <Text style={styles.managerDeleteText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          </View>
          </ImageBackground>
          <RegistrarTabBar
            active="doctors"
            lang={lang}
            onPress={handlePanelTab}
            style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
          />
        </View>
      </Modal>

      {/* ADD / EDIT DOCTOR MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#0E747F" />

          {/* Modal Header */}
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBackBtn}>
              <Text style={styles.modalBackIcon}>←</Text>
              <Text style={styles.modalBackText}>{isBn ? 'বাতিল' : 'Cancel'}</Text>
            </TouchableOpacity>

            <Text style={styles.modalHeaderTitle}>
              {isEditing
                ? isBn ? 'ডাক্তার তথ্য সম্পাদনা' : 'Update Doctor Info'
                : isBn ? 'নতুন ডাক্তার যোগ করুন' : 'Add New Doctor'}
            </Text>

            <TouchableOpacity style={styles.modalSaveHeaderBtn} onPress={handleSaveDoctor}>
              <Text style={styles.modalSaveHeaderBtnText}>
                {isBn ? 'সংরক্ষণ' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields: lifted above the keyboard so the fee and experience fields stay visible */}
          <KeyboardAvoidingView style={styles.formKeyboardArea} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Which language's details are being typed */}
            <View style={styles.formLangBox}>
              <View style={styles.formLangRow}>
                <Text style={styles.formLangLabel}>{isBn ? '🌐 তথ্যের ভাষা' : '🌐 Details language'}</Text>
                <LanguageSwitcher lang={lang} onChangeLang={onChangeLang} />
              </View>
              <Text style={styles.formLangHint}>
                {isBn
                  ? 'বাংলায় তথ্য লিখুন, তারপর English বেছে ইংরেজিতে লিখুন। যে ভাষা খালি থাকবে, সেখানে অন্য ভাষার লেখা দেখানো হবে।'
                  : 'Type the details in English, then pick বাংলা to type them in Bangla. A language left empty shows the other one.'}
              </Text>
            </View>

            {/* 1. Category Selection */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '১. ডাক্তারের বিভাগ / ক্যাটাগরি' : '1. Doctor Category / Department'} *
            </Text>
            <View style={[styles.deptInputRow, showDeptDropdown && styles.deptInputRowOpen]}>
              <View style={styles.deptInputIconBox}><DepartmentIcon icon={selectedDept ? selectedDept.icon : '🏥'} size={16} /></View>
              <TextInput
                style={styles.deptInput}
                placeholder={isBn ? 'বিভাগ বেছে নিন বা লিখুন' : 'Choose or type a department'}
                placeholderTextColor="#94A3B8"
                value={deptQuery}
                onChangeText={handleDeptTextChange}
                onFocus={() => setShowDeptDropdown(true)}
              />
              <TouchableOpacity
                onPress={() => setShowDeptDropdown((open) => !open)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.deptInputArrow}>{showDeptDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            </View>
            {showDeptDropdown && (
              <View style={styles.deptDropdown}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredDeptOptions.map((opt) => {
                    const active = categoryName === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.deptOption, active && styles.deptOptionActive]}
                        onPress={() => handlePickDept(opt)}
                      >
                        <View style={styles.deptOptionIconBox}><DepartmentIcon icon={opt.icon} size={16} /></View>
                        <Text style={[styles.deptOptionText, active && styles.deptOptionTextActive]}>
                          {deptLabel(opt)}
                        </Text>
                        {active && <Text style={styles.deptOptionCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                  {filteredDeptOptions.length === 0 && (
                    <Text style={styles.deptNewHint}>
                      {isBn
                        ? `কোনো বিভাগ মেলেনি। সংরক্ষণ করলে "${deptQuery.trim()}" নতুন বিভাগ হিসেবে যুক্ত হবে।`
                        : `No department matches. "${deptQuery.trim()}" will be added as a new department.`}
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* 2. Doctor Name */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '২. ডাক্তারের নাম' : '2. Doctor Name'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ ডাঃ মোঃ আশিকুর রহমান' : 'e.g. Dr. Md. Ashiqur Rahman'}
              placeholderTextColor="#94A3B8"
              value={doctorName}
              onChangeText={setDoctorName}
            />

            {/* 3. Designation */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৩. পদবী' : '3. Designation'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ সহযোগী অধ্যাপক ও মেডিসিন বিশেষজ্ঞ' : 'e.g. Associate Professor & Specialist'}
              placeholderTextColor="#94A3B8"
              value={designation}
              onChangeText={setDesignation}
            />

            {/* 4. Degrees */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৪. শিক্ষাগত যোগ্যতা ও ডিগ্রী' : '4. Degrees & Qualifications'}
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ এমবিবিএস, এফসিপিএস, এমডি' : 'e.g. MBBS, FCPS, MD'}
              placeholderTextColor="#94A3B8"
              value={degrees}
              onChangeText={setDegrees}
            />

            {/* 5. Working Place / Hospital */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৫. কর্মস্থল / হাসপাতাল' : '5. Working Place / Hospital'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ ঢাকা মেডিকেল কলেজ হাসপাতাল' : 'e.g. Dhaka Medical College Hospital'}
              placeholderTextColor="#94A3B8"
              value={workingPlace}
              onChangeText={setWorkingPlace}
            />

            {/* 6. Chamber */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৬. চেম্বার ও রুম নম্বর' : '6. Chamber & Room'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ পপুলার ডায়াগনস্টিক সেন্টার, ধানমন্ডি (রুম #২০৪)' : 'e.g. Popular Diagnostic, Room #204'}
              placeholderTextColor="#94A3B8"
              value={chamber}
              onChangeText={setChamber}
            />

            {/* 7. Availability */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৭. রোগী দেখার সময় (এই ফরম্যাট মেনে লিখুন)' : '7. Availability Schedule (maintain this format)'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ শনি - বুধ: বিকাল ৫:০০ - রাত ৯:০০' : 'e.g. Sat - Wed: 5:00 PM - 9:00 PM'}
              placeholderTextColor="#94A3B8"
              value={availability}
              onChangeText={setAvailability}
            />
            {/* Booking slots are read from this text, so it has to follow the format */}
            <Text style={styles.formLangHint}>
              {isBn
                ? 'ফরম্যাট: দিন: শুরুর সময় - শেষের সময়। যেমন: শনি - বুধ: বিকাল ৫:০০ - রাত ৯:০০ অথবা শনি, সোম, বুধ: বিকাল ৪:৩০ - রাত ৮:০০'
                : 'Format: Days: start time - end time. e.g. Sat - Wed: 5:00 PM - 9:00 PM or Sat, Mon, Wed: 4:30 PM - 8:00 PM'}
            </Text>

            {/* 8. Consultation Fee */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৮. পরামর্শ ফি' : '8. Consultation Fee'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ ৳১,০০০' : 'e.g. ৳1,000'}
              placeholderTextColor="#94A3B8"
              value={consultationFee}
              onChangeText={setConsultationFee}
            />
            {/* Quick Fee Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSuggestRow}>
              {(isBn
                ? ['৳৫০০', '৳৮০০', '৳১,০০০', '৳১,২০০', '৳১,৫০০', '৳২,০০০']
                : ['৳500', '৳800', '৳1,000', '৳1,200', '৳1,500', '৳2,000']
              ).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.quickSuggestChip, consultationFee === f && styles.quickSuggestChipActive]}
                  onPress={() => setConsultationFee(f)}
                >
                  <Text style={[styles.quickSuggestText, consultationFee === f && styles.quickSuggestTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 9. Experience */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '৯. কাজের অভিজ্ঞতা' : '9. Work Experience'} *
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder={isBn ? 'উদাঃ ১২+ বছরের অভিজ্ঞতা' : 'e.g. 12+ Years Exp.'}
              placeholderTextColor="#94A3B8"
              value={experience}
              onChangeText={setExperience}
            />
            {/* Quick Experience Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSuggestRow}>
              {(isBn
                ? ['৩+ বছরের অভিজ্ঞতা', '৫+ বছরের অভিজ্ঞতা', '৮+ বছরের অভিজ্ঞতা', '১০+ বছরের অভিজ্ঞতা', '১২+ বছরের অভিজ্ঞতা', '১৫+ বছরের অভিজ্ঞতা', '২০+ বছরের অভিজ্ঞতা']
                : ['3+ Years Exp.', '5+ Years Exp.', '8+ Years Exp.', '10+ Years Exp.', '12+ Years Exp.', '15+ Years Exp.', '20+ Years Exp.']
              ).map((exp) => (
                <TouchableOpacity
                  key={exp}
                  style={[styles.quickSuggestChip, experience === exp && styles.quickSuggestChipActive]}
                  onPress={() => setExperience(exp)}
                >
                  <Text style={[styles.quickSuggestText, experience === exp && styles.quickSuggestTextActive]}>
                    {exp}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 10. Photo URL */}
            <Text style={styles.formFieldLabel}>
              {isBn ? '১০. ছবির লিংক (ঐচ্ছিক)' : '10. Doctor Photo URL (Optional)'}
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
              value={imageUrl}
              onChangeText={setImageUrl}
            />

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSaveDoctor} activeOpacity={0.85}>
              <Text style={styles.submitButtonText}>
                {isEditing
                  ? isBn ? '✓ ডাক্তার তথ্য আপডেট করুন' : '✓ Update Doctor Info'
                  : isBn ? '✓ নতুন ডাক্তার সংরক্ষণ করুন' : '✓ Save Doctor & Publish'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
          <RegistrarTabBar
            active="doctors"
            lang={lang}
            onPress={handlePanelTab}
            style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bannerBackground: {
    width: '100%',
  },
  bannerWhiteWash: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  langRow: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Portal badge and logout share the row equally, same width and height
  badgeRegistrar: {
    width: '48%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  badgeRegistrarText: {
    color: '#0E747F',
    fontSize: 11.5,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Same size and shape as the portal badge beside it
  logoutPill: {
    width: '48%',
    flexDirection: 'row',
    gap: 7,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  bannerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  bannerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  helloGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  takeCareHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 25,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  takeCareSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    fontWeight: '500',
    marginBottom: 10,
  },
  // The page's main action: large, with a border and shadow so it stands out on the banner
  addDoctorBannerBtn: {
    backgroundColor: '#0E747F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#0A5A62',
    elevation: 6,
    shadowColor: '#0E747F',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  addDoctorBannerBtnIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 7,
    fontWeight: '900',
  },
  addDoctorBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  bannerImageCol: {
    width: 125,
    height: 140,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerReceptionImage: {
    width: 125,
    height: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFE9ED',
  },
  floatingHeartBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  floatingHeartText: {
    fontSize: 12,
  },
  quickNavTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  navTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  navTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  navTabTextActive: {
    color: '#0E747F',
    fontWeight: '900',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  // same magnifier and size as the Home search bar
  searchIconImage: {
    width: 20,
    height: 20,
    marginRight: 9,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  clearSearchIcon: {
    fontSize: 14,
    color: '#64748B',
    padding: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
    marginBottom: 18,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0E747F',
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 18,
  },
  specialtyFiller: {
    width: '31%',
  },
  specialtyItemCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  specialtyItemCardActive: {
    borderColor: '#0E747F',
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
    elevation: 4,
  },
  specialtyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  specialtyIcon: {
    fontSize: 22,
  },
  specialtyItemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  specialtyItemTitleActive: {
    color: '#0E747F',
    fontWeight: '800',
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E6F5F6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    elevation: 2,
    shadowColor: '#0E747F',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activeFilterTextCol: {
    flex: 1,
    marginRight: 8,
  },
  activeFilterBannerText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  activeFilterSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  activeFilterBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewDeptPublicBtn: {
    backgroundColor: '#0E747F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  viewDeptPublicBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  clearActiveFilterBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearActiveFilterText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  listTitleWrap: {
    flex: 1,
  },
  listFilterHintText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  emptyDeptBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    marginBottom: 20,
  },
  emptyDeptIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyDeptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyDeptSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyAddDoctorBtn: {
    backgroundColor: '#0E747F',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddDoctorBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomBookingBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  bottomBookingBtn: {
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bottomBookingBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  statusBarCover: {
    backgroundColor: '#FFFFFF',
  },
  pageScroll: {
    paddingBottom: 40,
  },
  stickyBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  doctorsListScroll: {
    padding: 14,
    paddingBottom: 40,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listCountTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  doctorAdminCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryBadge: {
    backgroundColor: '#E6F5F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0E747F',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  viewAptsBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  viewAptsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  cardMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  doctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#E2E8F0',
  },
  doctorDetailsCol: {
    flex: 1,
  },
  doctorCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  doctorDesignation: {
    fontSize: 12,
    color: '#0E747F',
    fontWeight: '700',
    marginBottom: 2,
  },
  doctorDegrees: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 5,
  },
  detailRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  detailLabelBold: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  detailValueText: {
    fontSize: 11.5,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  // Fee and experience, one per line like the rows above (side by side they ran off the card)
  splitRowDetails: {
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  // Full card width, so the value text beside the label has room to show
  splitItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeText: {
    color: '#0E747F',
    fontWeight: '800',
  },
  emptyCardBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  /* MODAL STYLES */
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeaderBar: {
    backgroundColor: '#0E747F',
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    marginRight: 4,
    fontWeight: 'bold',
  },
  modalBackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  modalSaveHeaderBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  modalSaveHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  formKeyboardArea: {
    flex: 1,
  },
  managerHeaderSpacer: {
    width: 70,
  },
  managerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  managerHeaderText: {
    color: '#0E747F',
  },
  managerHeaderTitle: {
    color: '#0F172A',
    fontSize: 18,
  },
  managerBg: {
    flex: 1,
  },
  managerBgWash: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  managerLangRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  managerTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 6,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  managerTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  managerTabActive: {
    backgroundColor: '#0E747F',
  },
  managerTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  managerTabTextActive: {
    color: '#FFFFFF',
  },
  managerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  managerSearchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  managerSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
  },
  managerSearchClear: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '800',
    paddingLeft: 8,
  },
  managerPrimaryBtn: {
    backgroundColor: '#0E747F',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  managerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  managerEmpty: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 20,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  managerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  managerDeptEmoji: {
    fontSize: 20,
  },
  managerDeptIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F5F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerRowInfo: {
    flex: 1,
  },
  managerRowTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  // An icon (emoji or picture) beside a line of text
  inlineIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineIconText: {
    flexShrink: 1,
  },
  managerRowSubLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  managerRowSubIcon: {
    fontSize: 12,
  },
  managerRowSubText: {
    flexShrink: 1,
    marginTop: 0,
  },
  managerRowSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  managerEditBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  managerEditText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  managerDeleteBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  managerDeleteBtnMuted: {
    opacity: 0.45,
  },
  managerDeleteText: {
    fontSize: 13,
  },
  managerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    paddingBottom: 2,
    marginBottom: 16,
  },
  managerCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0E747F',
  },
  deptIconInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  deptIconInput: {
    flex: 1,
  },
  managerSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  formLangBox: {
    backgroundColor: '#E6F5F6',
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
  },
  formLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formLangLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0E747F',
    flexShrink: 1,
    marginRight: 8,
  },
  formLangHint: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 8,
    lineHeight: 16,
  },
  formScroll: {
    padding: 16,
    // room above Android's navigation buttons for the last field and the save button
    paddingBottom: 96,
  },
  formFieldLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    marginTop: 10,
  },
  categoryPickerScroll: {
    gap: 8,
    marginBottom: 8,
  },
  deptInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  deptInputRowOpen: {
    borderColor: '#0E747F',
  },
  deptInputIconBox: {
    marginRight: 8,
  },
  deptInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  deptInputArrow: {
    fontSize: 12,
    color: '#0E747F',
    paddingLeft: 8,
  },
  deptDropdown: {
    maxHeight: 240,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  deptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  deptOptionActive: {
    backgroundColor: '#E6F5F6',
  },
  deptOptionIconBox: {
    marginRight: 10,
  },
  deptOptionText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  deptOptionTextActive: {
    color: '#0E747F',
    fontWeight: '800',
  },
  deptOptionCheck: {
    fontSize: 14,
    color: '#0E747F',
    fontWeight: '800',
  },
  deptNewHint: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 12.5,
    color: '#64748B',
  },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6,
  },
  pickerChipActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  pickerChipIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  pickerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pickerChipTextActive: {
    color: '#FFFFFF',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#0E747F',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  quickSuggestRow: {
    marginTop: 6,
    marginBottom: 6,
  },
  quickSuggestChip: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickSuggestChipActive: {
    backgroundColor: '#0E747F',
    borderColor: '#0E747F',
  },
  quickSuggestText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quickSuggestTextActive: {
    color: '#FFFFFF',
  },
  deptDoctorCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
});

