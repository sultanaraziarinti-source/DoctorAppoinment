# DoctorAppoinment 🩺 (React Native)

A Doctor Appointment booking mobile application built with **React Native** and styled with the provided medical doodle pattern background.

---

## 📱 Features

- **🔐 Login Page**:
  - Phone number input (with validation)
  - Password input with show/hide password toggle (`👁️` / `🙈`)
  - "Remember me" checkbox
  - "Forgot password?" prompt
  - Direct navigation to Sign Up
  - Styled with the provided medical doodle pattern background overlay

- **📝 Sign Up Page**:
  - **Full Name** (`👤`)
  - **Phone Number** (`📞`, with 11-digit mobile validation)
  - **Age** (numeric, 1-120)
  - **Password** (minimum 6 characters)
  - Patient terms & privacy policy agreement
  - Direct navigation to Log In

- **🏠 Home / Dashboard**:
  - Welcome greeting showing patient's name, phone, and age
  - Medical specialties (Medicine, Cardiology, Pediatrics, Orthopedics)
  - Upcoming serial and chamber schedule card
  - Logout functionality

---

## 🗂️ Data Model

The app stores its data in eight Supabase tables that follow the ER diagram: User, Patient, Phone Number, Device, Department, Doctor, Schedule and Appointment.

**Supabase setup:** run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL Editor, and put the project URL and anon key in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Restart `npx expo start` after changing `.env`.

- [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md): Mermaid diagram plus how each table is stored
- [docs/er-diagram.html](docs/er-diagram.html): styled diagram (open in a browser)

---

## 📁 Project Structure

```
DoctorAppoinment/
├── assets/
│   └── medical_pattern.jpg      # The uploaded medical pattern image
├── src/
│   ├── components/
│   │   ├── CustomButton.js       # Reusable button with loading indicator
│   │   └── CustomInput.js        # Polished input with icons & error states
│   ├── screens/
│   │   ├── LoginScreen.js        # Phone + Password Login
│   │   ├── SignupScreen.js       # Name + Phone + Age + Password Signup
│   │   └── HomeScreen.js         # Patient Dashboard
│   └── theme/
│       └── colors.js             # Teal, Coral, Mint & Medical Palette
├── App.js                        # Root navigation controller
├── app.json                      # Expo / React Native configuration
├── package.json
└── README.md
```

---

## 🚀 How to Run

Navigate into the project folder:
```bash
cd c:\Users\RintiRazia\android_projects\DoctorAppoinment
```

Install dependencies:
```bash
npm install
```

Start the application:
```bash
npx expo start
```
- Press `a` in the terminal to launch on your connected Android device or emulator (`emulator-5554` or `Realme`).
- Or scan the QR code with **Expo Go** on your physical phone.
