import AsyncStorage from '@react-native-async-storage/async-storage';

// The logged-in user, kept on this phone until they log out
const SESSION_KEY = '@doctor_app_session_v1';

export const saveSession = async (user) => {
  try {
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ user, savedAt: new Date().toISOString() })
    );
  } catch (error) {
    console.warn('Error saving session:', error);
  }
};

export const loadSession = async () => {
  try {
    const json = await AsyncStorage.getItem(SESSION_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return parsed && parsed.user && parsed.user.phone ? parsed.user : null;
  } catch (error) {
    console.warn('Error reading session:', error);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('Error clearing session:', error);
  }
};
