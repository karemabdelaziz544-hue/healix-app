import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 👇 متنساش تحط الرابط والمفتاح بتوعك هنا
const supabaseUrl = 'https://bruafdfakvdreagfeqau.supabase.co'; // حط رابط مشروعك
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydWFmZGZha3ZkcmVhZ2ZlcWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0ODAzNTYsImV4cCI6MjA4MDA1NjM1Nn0.bIFFTG3McJhYZJYNmhn_24099ahNNdb8oxPsLOGwtZ8'; // حط المفتاح بتاعك

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // 👈 السر هنا: رجعنا الذاكرة الحقيقية القوية
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});