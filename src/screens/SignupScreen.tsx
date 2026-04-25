import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('male');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // أنيميشن لدخول الشاشة بنعومة (Fade In & Scale)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, []);

  const handleSignup = async () => {
    // 1. التحقق من البيانات (Validation)
    if (!name || !email || !phone || !password) {
      Alert.alert('تنبيه', 'يرجى إكمال جميع الحقول');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('تنبيه', 'كلمات المرور غير متطابقة');
      return;
    }
    if (password.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      // 2. إنشاء الحساب في Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: name,
            phone: phone,
            gender: gender,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('تعذر إنشاء الحساب');

      // 3. إنشاء أو تحديث بروفايل المستخدم
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: name,
        phone: phone,
        role: 'client', // افتراضياً أي مسجل جديد هو عميل
        updated_at: new Date().toISOString(),
      });

      // 4. توجيه مباشر (المايسترو اللي في _layout.tsx هيشعر بالدخول ويوجهك للتابات)
      router.replace('/(tabs)');
      
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* دوائر الخلفية التجميلية */}
      <View style={[styles.bgCircle, styles.circleTopRight]} />
      <View style={[styles.bgCircle, styles.circleBottomLeft]} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Animated.View style={[styles.formCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          
          <View style={styles.header}>
            <Text style={styles.title}>انضم لعائلة هيليكس</Text>
            <Text style={styles.subtitle}>ابدأ رحلة صحية جديدة ومخصصة لك</Text>
          </View>

          {/* نموذج التسجيل */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>الاسم بالكامل</Text>
            <TextInput style={styles.input} placeholder="مثال: أحمد محمد" value={name} onChangeText={setName} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput style={styles.input} placeholder="name@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>رقم الهاتف</Text>
              <TextInput style={styles.input} placeholder="01xxxxxxxxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>النوع</Text>
              <View style={styles.genderToggle}>
                <TouchableOpacity 
                  style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]} 
                  onPress={() => setGender('male')}
                >
                  <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>ذكر</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]} 
                  onPress={() => setGender('female')}
                >
                  <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>أنثى</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>كلمة المرور</Text>
              <TextInput style={styles.input} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>تأكيد المرور</Text>
              <TextInput style={styles.input} placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            </View>
          </View>

          {/* زر التسجيل */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>إنشاء حساب جديد</Text>
            )}
          </TouchableOpacity>

          {/* رابط تسجيل الدخول */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>سجل دخولك</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  
  bgCircle: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.4 },
  circleTopRight: { backgroundColor: '#DEF7EC', top: -100, right: -150 },
  circleBottomLeft: { backgroundColor: '#FFEDD5', bottom: -100, left: -150 },

  formCard: { backgroundColor: '#FFF', padding: 30, borderRadius: 30, elevation: 10, shadowColor: '#2A4B46', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '900', color: '#2A4B46', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#6B7280', fontWeight: 'bold' },

  inputGroup: { marginBottom: 15 },
  row: { flexDirection: 'row-reverse', gap: 15 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#4B5563', textAlign: 'right', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', height: 50, borderRadius: 15, paddingHorizontal: 15, textAlign: 'right', fontSize: 14, color: '#1F2937' },

  genderToggle: { flexDirection: 'row-reverse', backgroundColor: '#F3F4F6', height: 50, borderRadius: 15, padding: 4 },
  genderBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  genderBtnActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  genderText: { fontSize: 14, fontWeight: 'bold', color: '#9CA3AF' },
  genderTextActive: { color: '#2A4B46' },

  submitBtn: { backgroundColor: '#2A4B46', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  submitBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  footer: { flexDirection: 'row-reverse', justifyContent: 'center', marginTop: 25 },
  footerText: { color: '#6B7280', fontSize: 14, fontWeight: 'bold' },
  loginLink: { color: '#F97316', fontSize: 14, fontWeight: '900' },
});