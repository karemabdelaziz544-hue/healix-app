import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer'; // هنحتاجها عشان نرفع الصورة من الموبايل
import { useRouter } from 'expo-router';
import { useFamily } from '../../src/context/FamilyContext';

export default function ProfileScreen() {
  const router = useRouter(); // 👈 السطر اللي ضفناه
  const { session } = useAuth();
  const user = session?.user;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 1. جلب بيانات البروفايل أول ما الشاشة تفتح
  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (err) {
      console.log('Error fetching profile:', err);
    } finally {
      setFetching(false);
    }
  };

  // 2. تحديث الاسم
  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const updates = {
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      Alert.alert('نجاح', 'تم تحديث الملف الشخصي بنجاح! 🎉');
    } catch (error: any) {
      Alert.alert('خطأ', 'فشل التحديث: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. اختيار صورة من الاستوديو ورفعها
  const handleAvatarUpload = async () => {
    // طلب إذن الدخول للاستوديو
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('تنبيه', 'يجب إعطاء صلاحية الوصول للصور لتتمكن من تغيير صورتك.');
      return;
    }

    // فتح الاستوديو
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // تقليل الجودة لسرعة الرفع
      base64: true, // ضروري عشان نرفعها لـ Supabase من الموبايل
    });

    if (pickerResult.canceled || !pickerResult.assets[0].base64) return;

    setLoading(true);
    try {
      const base64FileData = pickerResult.assets[0].base64;
      const fileExt = pickerResult.assets[0].uri.split('.').pop() || 'jpeg';
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      // رفع الصورة باستخدام base64-arraybuffer
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64FileData), { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      // الحصول على الرابط العام
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      Alert.alert('نجاح', 'تم رفع الصورة، اضغط "حفظ التغييرات" لتأكيد التغيير.');
      
    } catch (error: any) {
      Alert.alert('خطأ', 'فشل رفع الصورة: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. تغيير كلمة المرور
  const handleChangePassword = async () => {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) return Alert.alert('تنبيه', 'كلمات المرور غير متطابقة');
    if (newPassword.length < 6) return Alert.alert('تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('نجاح', 'تم تغيير كلمة المرور بنجاح! 🔒');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('خطأ', 'فشل التغيير: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. تسجيل الخروج
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // المايسترو (AuthContext) هيتصرف ويطرد العميل بره أوتوماتيك!
    } catch (err) {
      console.log('Error logging out:', err);
    }
  };

  if (fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2A4B46" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.pageTitle}>إعدادات الحساب</Text>

        {/* --- كارت البيانات الشخصية والصورة --- */}
        <View style={styles.card}>
          
          {/* الصورة */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarUpload} disabled={loading}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{fullName ? fullName[0].toUpperCase() : 'H'}</Text>
                </View>
              )}
              
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera" size={18} color="#FFF" />
              </View>

              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#F97316" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarHint}>اضغط على الصورة للتغيير</Text>
          </View>

          {/* الخانات */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>الاسم بالكامل</Text>
            <TextInput 
              style={styles.input} 
              value={fullName} 
              onChangeText={setFullName} 
              placeholder="اكتب اسمك هنا"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>البريد الإلكتروني (غير قابل للتعديل)</Text>
            <TextInput 
              style={[styles.input, styles.disabledInput]} 
              value={user?.email || ''} 
              editable={false} 
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile} disabled={loading}>
            <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
            <Ionicons name="save-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* --- كارت كلمة المرور --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>الأمان وكلمة المرور</Text>
            <Ionicons name="lock-closed" size={20} color="#F97316" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>كلمة المرور الجديدة</Text>
            <TextInput 
              style={styles.input} 
              value={newPassword} 
              onChangeText={setNewPassword} 
              placeholder="••••••••"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>تأكيد كلمة المرور</Text>
            <TextInput 
              style={styles.input} 
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              placeholder="••••••••"
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.outlineBtn, (!newPassword || loading) && { opacity: 0.5 }]} 
            onPress={handleChangePassword} 
            disabled={!newPassword || loading}
          >
            <Text style={styles.outlineBtnText}>تحديث كلمة المرور</Text>
          </TouchableOpacity>
        </View>
<TouchableOpacity style={styles.subBtn} onPress={() => router.push('/subscriptions')}>
          <View style={styles.subBtnLeft}>
            <Ionicons name="chevron-back" size={20} color="#F97316" />
          </View>
          <View style={styles.subBtnRight}>
            <Text style={styles.subBtnTitle}>إدارة الاشتراك</Text>
            <Text style={styles.subBtnDesc}>تجديد، تعديل الباقة، والسجل المالي</Text>
          </View>
          <View style={styles.subBtnIcon}>
            <Ionicons name="card" size={24} color="#FFF" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.subBtn} onPress={() => router.push('/family')}>
          <View style={styles.subBtnLeft}>
            <Ionicons name="chevron-back" size={20} color="#F97316" />
          </View>
          <View style={styles.subBtnRight}>
            <Text style={styles.subBtnTitle}>إدارة العائلة</Text>
            <Text style={styles.subBtnDesc}>أضف وبدل بين أفراد عائلتك</Text>
          </View>
          <View style={[styles.subBtnIcon, {backgroundColor: '#2A4B46'}]}>
            <Ionicons name="people" size={24} color="#FFF" />
          </View>
        </TouchableOpacity>
        {/* --- زر تسجيل الخروج --- */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 }, // مساحة تحت عشان الشريط العائم
  subBtn: { flexDirection: 'row', backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginBottom: 20, elevation: 2, alignItems: 'center', justifyContent: 'space-between' },
  subBtnIcon: { width: 50, height: 50, backgroundColor: '#F97316', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  subBtnRight: { flex: 1, alignItems: 'flex-end' },
  subBtnTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  subBtnDesc: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  subBtnLeft: { padding: 5 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#2A4B46', textAlign: 'right', marginBottom: 25 },
  
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.05, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2A4B46' },

  avatarSection: { alignItems: 'center', marginBottom: 25 },
  avatarWrapper: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'rgba(249, 115, 22, 0.2)', position: 'relative' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 55 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 55, backgroundColor: '#2A4B46', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: 'bold', color: '#FFF' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#F97316', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  avatarHint: { color: '#9CA3AF', fontSize: 12, marginTop: 10, fontWeight: 'bold' },

  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 13, color: '#6B7280', fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', height: 55, borderRadius: 15, paddingHorizontal: 15, textAlign: 'right', fontSize: 15, color: '#1F2937', fontFamily: 'System' },
  disabledInput: { color: '#9CA3AF', backgroundColor: '#F9FAFB' },

  saveBtn: { backgroundColor: '#2A4B46', height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  outlineBtn: { backgroundColor: '#FFF', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', marginTop: 10 },
  outlineBtnText: { color: '#4B5563', fontSize: 16, fontWeight: 'bold' },

  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 15, backgroundColor: '#FEF2F2', borderRadius: 15, borderWidth: 1, borderColor: '#FEE2E2' },
  logoutBtnText: { color: '#EF4444', fontSize: 16, fontWeight: 'bold' },
});