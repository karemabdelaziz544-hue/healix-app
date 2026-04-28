import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// جلب المفاتيح من ملف بيئة العمل بأمان
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// تأمين ضد الأخطاء إذا نسينا إضافة ملف .env
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("تنبيه: مفاتيح Supabase غير موجودة. يرجى التأكد من ملف .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // 👈 السر هنا: رجعنا الذاكرة الحقيقية القوية
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});