import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

// 🎨 1. تحديد باليتة الألوان للوضعين (النهاري والليلي)
export const lightColors = {
  background: '#F9F6F0',
  card: '#FFFFFF',
  text: '#1F2937',        // رمادي غامق جداً
  textMuted: '#6B7280',   // رمادي فاتح
  primary: '#2A4B46',     // الأخضر بتاعنا
  accent: '#F97316',      // الأورنج
  border: '#F3F4F6',
  danger: '#EF4444',
  success: '#10B981',
};

export const darkColors = {
  background: '#111827',  // كحلي غامق جداً (Dark Mode)
  card: '#1F2937',        // لون الكروت الغامقة
  text: '#F9FAFB',        // أبيض
  textMuted: '#9CA3AF',   // رمادي للوضع المظلم
  primary: '#34D399',     // أخضر فاتح شوية عشان ينطق في الأسود
  accent: '#F97316',      // الأورنج بيفضل زي ما هو
  border: '#374151',
  danger: '#F87171',
  success: '#34D399',
};

type ThemeContextType = {
  isDarkMode: boolean;
  colors: typeof lightColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // 📱 بنقرأ نظام الموبايل الافتراضي
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  // تحديث الثيم لو العميل غير نظام الموبايل نفسه
  useEffect(() => {
    setIsDarkMode(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  // دالة للتبديل اليدوي
  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // اختيار الألوان بناءً على الوضع الحالي
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};