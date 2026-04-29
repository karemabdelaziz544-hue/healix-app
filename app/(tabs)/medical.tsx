import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, TextInput, RefreshControl, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { LineChart } from 'react-native-chart-kit';
import { decode } from 'base64-arraybuffer';
import { useFamily } from '../../src/context/FamilyContext';
import { useSubscriptionGuard } from '../../hooks/useSubscriptionGuard';
import ExpiredState from '../../components/ExpiredState';
import Skeleton from '../../components/Skeleton';
import * as Haptics from 'expo-haptics';
import type { InbodyRecord, ClientDocument, HealthProfile, LifestyleProfile } from '../../src/types';

const screenWidth = Dimensions.get('window').width;
const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const DISEASE_OPTIONS = ['سكري النوع 1', 'سكري النوع 2', 'ضغط مرتفع', 'ضغط منخفض', 'مقاومة أنسولين', 'خمول الغدة', 'نشاط الغدة', 'تكيس مبايض', 'جرثومة المعدة', 'قولون عصبي', 'نقرس', 'أنيميا', 'خشونة مفاصل', 'انزلاق غضروفي', 'أمراض قلب', 'مشاكل كلى', 'حساسية', 'ربو'];
const DIET_OPTIONS = ['عادي', 'نباتي (Vegan)', 'نباتي جزئي', 'كيتو', 'صيام متقطع'];
const FAMILY_HISTORY_OPTIONS = ['سكري', 'ضغط', 'سمنة', 'أمراض قلب', 'غدة', 'أورام'];
const GOAL_OPTIONS = ['خسارة وزن', 'زيادة وزن', 'تثبيت الوزن', 'بناء عضل'];
const DIGESTIVE_OPTIONS = ['حموضة مزمنة', 'إمساك', 'إسهال', 'انتفاخات وغازات'];
const WORK_NATURE_OPTIONS = ['مكتبي (جالس)', 'حركي خفيف', 'مجهود بدني شاق', 'شيفتات متغيرة'];
const APPETITE_OPTIONS = ['مفتوحة جداً', 'عادية', 'ضعيفة'];

export default function MedicalRecordsScreen() {
  const { currentProfile } = useFamily();
  const { isSubscribed, isGuardLoading } = useSubscriptionGuard();
  const userId = currentProfile?.id;
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'inbody' | 'docs' | 'health' | 'lifestyle'>('inbody');
  const [inbodyRecords, setInbodyRecords] = useState<InbodyRecord[]>([]);
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [isEditingHealth, setIsEditingHealth] = useState(false);
  const [healthForm, setHealthForm] = useState<HealthProfile>({
    user_id: userId || '',
    diseases: [], has_allergies: false, allergies_details: '', diet_type: 'عادي', family_history: [], medications: '',
    surgeries: '', injuries: '', digestive_issues: [], hormonal_status: ''
  });

  const [lifestyleProfile, setLifestyleProfile] = useState<LifestyleProfile | null>(null);
  const [isEditingLifestyle, setIsEditingLifestyle] = useState(false);
  const [lifestyleForm, setLifestyleForm] = useState<any>({
    goal: 'خسارة وزن', meals_per_day: '3', has_breakfast: true, has_snacks: false, late_night_eating: false,
    favorite_foods: '', disliked_foods: '', water_liters: '2', beverages: [], activity_level: 'متوسط',
    does_exercise: false, exercise_details: { type: '', days: '0' }, sleep_hours: '7', sleep_quality: 'جيد', smoker: false, stress_level: 'متوسط',
    work_nature: 'مكتبي (جالس)', emotional_eating: false, diet_history: '', supplements: '', caffeine_intake: '', appetite_level: 'عادية', weight_plateau: false
  });

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showInbodyForm, setShowInbodyForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [muscle, setMuscle] = useState('');
  const [fat, setFat] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');

  const fetchAllData = useCallback(async () => {
    if (!userId) return;
    try {
      await Promise.all([ fetchInbody(), fetchDocs(), fetchProfiles() ]);
    } catch (error) {
      console.log('Error fetching all medical data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchAllData();
    }
  }, [fetchAllData, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, [fetchAllData]);

  const fetchProfiles = async () => {
    const { data: health } = await supabase.from('health_profile').select('*').eq('user_id', userId).single();
    if (health) { 
      setHealthProfile(health); 
      setHealthForm(health); 
    } else {
      setHealthProfile(null);
      setHealthForm({
        user_id: userId || '', diseases: [], has_allergies: false, allergies_details: '', diet_type: 'عادي', family_history: [], medications: '', surgeries: '', injuries: '', digestive_issues: [], hormonal_status: ''
      });
    }

    const { data: life } = await supabase.from('lifestyle_profile').select('*').eq('user_id', userId).single();
    if (life) { 
        setLifestyleProfile(life); 
        setLifestyleForm({
            ...life, water_liters: life.water_liters?.toString() || '2', sleep_hours: life.sleep_hours?.toString() || '7',
            exercise_details: { type: life.exercise_details?.type || '', days: life.exercise_details?.days?.toString() || '0' }
        }); 
    } else {
      setLifestyleProfile(null);
      setLifestyleForm({
        goal: 'خسارة وزن', meals_per_day: '3', has_breakfast: true, has_snacks: false, late_night_eating: false,
        favorite_foods: '', disliked_foods: '', water_liters: '2', beverages: [], activity_level: 'متوسط',
        does_exercise: false, exercise_details: { type: '', days: '0' }, sleep_hours: '7', sleep_quality: 'جيد', smoker: false, stress_level: 'متوسط',
        work_nature: 'مكتبي (جالس)', emotional_eating: false, diet_history: '', supplements: '', caffeine_intake: '', appetite_level: 'عادية', weight_plateau: false
      });
    }
  };

  const fetchInbody = async () => {
    const { data } = await supabase.from('inbody_records').select('*').eq('user_id', userId).order('record_date', { ascending: true });
    setInbodyRecords(data || []);
  };

  const fetchDocs = async () => {
    const { data } = await supabase.from('client_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setDocs(data || []);
  };

  const saveHealthProfile = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      const { error } = await supabase.from('health_profile').upsert({ ...healthForm, user_id: userId });
      if (error) throw error;
      await fetchProfiles();
      setIsEditingHealth(false);
      Alert.alert('نجاح', 'تم حفظ الملف الطبي بنجاح');
    } catch (err: any) {
      console.error('[saveHealthProfile] Error:', JSON.stringify(err));
      Alert.alert('خطأ', `كود: ${err?.code}\n${err?.message}`);
    } finally {
      setUploading(false);
    }
  };

  const saveLifestyleProfile = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      const { error } = await supabase.from('lifestyle_profile').upsert({ ...lifestyleForm, user_id: userId });
      if (error) throw error;
      await fetchProfiles();
      setIsEditingLifestyle(false);
      Alert.alert('نجاح', 'تم حفظ نمط الحياة بنجاح');
    } catch (err: any) {
      console.error('[saveLifestyleProfile] Error:', JSON.stringify(err));
      Alert.alert('خطأ', `كود: ${err?.code}\n${err?.message}`);
    } finally {
      setUploading(false);
    }
  };

  const toggleArrayItem = (arrayName: 'diseases' | 'family_history' | 'digestive_issues', item: string) => {
    setHealthForm((prev: any) => {
        const arr = prev[arrayName] || []; return { ...prev, [arrayName]: arr.includes(item) ? arr.filter((i: string) => i !== item) : [...arr, item] };
    });
  };

  const handleAnalyzeImage = async () => { Alert.alert('تنبيه', 'خاصية قراءة الورقة بالذكاء الاصطناعي قيد التطوير'); };
  const handleInbodySubmit = async () => {
    if (!weight) return Alert.alert('خطأ', 'الرجاء إدخال الوزن');
    setUploading(true);
    try {
      const { error } = await supabase.from('inbody_records').insert({ user_id: userId, weight: parseFloat(weight), muscle_mass: muscle ? parseFloat(muscle) : null, fat_percent: fat ? parseFloat(fat) : null, record_date: new Date().toISOString() });
      if (error) throw error;
      await fetchInbody();
      setShowInbodyForm(false);
      setWeight(''); setMuscle(''); setFat('');
    } catch (err) { Alert.alert('خطأ', 'فشل الحفظ'); }
    finally { setUploading(false); }
  };

  const handleDocUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);
        const file = result.assets[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('client_documents').upload(fileName, file as any); // using any for React Native file
        if (uploadError) throw uploadError;
        await supabase.from('client_documents').insert({ user_id: userId, file_name: file.name, file_url: fileName, file_type: fileExt });
        await fetchDocs();
        Alert.alert('نجاح', 'تم رفع الملف');
      }
    } catch (err) {
      console.log(err);
      Alert.alert('خطأ', 'فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (pathOrUrl: string) => {
    try {
      const { data } = await supabase.storage.from('client_documents').createSignedUrl(pathOrUrl, 3600);
      if (data?.signedUrl) Linking.openURL(data.signedUrl);
    } catch (err) { Alert.alert('خطأ', 'لا يمكن فتح الملف'); }
  };

  const lastRec = inbodyRecords.length > 0 ? inbodyRecords[inbodyRecords.length - 1] : null;
  const chartData = {
    labels: inbodyRecords.slice(-5).map(r => new Date(r.record_date).getDate().toString()), 
    datasets: [{ data: inbodyRecords.slice(-5).map(r => r.weight) }]
  };

  // 🌟 استبدال شاشة التحميل القديمة بشاشة Skeleton مطابقة للتصميم
  if (isGuardLoading || !currentProfile || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Skeleton width={180} height={32} borderRadius={10} style={{ marginBottom: 8 }} />
          <Skeleton width={230} height={16} borderRadius={8} />
        </View>
        <View style={styles.tabScrollContainer}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} width={90} height={40} borderRadius={12} style={{ marginLeft: 10 }} />)}
        </View>
        <View style={styles.scrollContent}>
          <Skeleton width="100%" height={120} borderRadius={20} style={{ marginBottom: 20 }} />
          <Skeleton width="100%" height={220} borderRadius={25} style={{ marginBottom: 20 }} />
          <View style={{ flexDirection: 'row-reverse', gap: 15 }}>
            <Skeleton width="48%" height={100} borderRadius={20} />
            <Skeleton width="48%" height={100} borderRadius={20} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSubscribed) {
    return <ExpiredState />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>مركز القياسات <Ionicons name="pulse" size={24} color="#F97316" /></Text>
          <Text style={styles.subtitle}>البيانات الطبية، نمط الحياة، والتحاليل</Text>
        </View>

        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContainer}>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'inbody' && styles.tabBtnActive]} onPress={() => setActiveTab('inbody')}>
                <Ionicons name="body" size={18} color={activeTab === 'inbody' ? "#2A4B46" : "#9CA3AF"} />
                <Text style={[styles.tabText, activeTab === 'inbody' && styles.tabTextActive]}>InBody</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'docs' && styles.tabBtnActive]} onPress={() => setActiveTab('docs')}>
                <Ionicons name="document-text" size={18} color={activeTab === 'docs' ? "#2A4B46" : "#9CA3AF"} />
                <Text style={[styles.tabText, activeTab === 'docs' && styles.tabTextActive]}>التحاليل</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tabBtn, activeTab === 'health' && styles.tabBtnActive]} onPress={() => setActiveTab('health')}>
                <Ionicons name="heart-half" size={18} color={activeTab === 'health' ? "#2A4B46" : "#9CA3AF"} />
                <Text style={[styles.tabText, activeTab === 'health' && styles.tabTextActive]}>الملف الطبي</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tabBtn, activeTab === 'lifestyle' && styles.tabBtnActive]} onPress={() => setActiveTab('lifestyle')}>
                <Ionicons name="cafe" size={18} color={activeTab === 'lifestyle' ? "#2A4B46" : "#9CA3AF"} />
                <Text style={[styles.tabText, activeTab === 'lifestyle' && styles.tabTextActive]}>نمط الحياة</Text>
            </TouchableOpacity>
            </ScrollView>
        </View>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F97316', '#2A4B46']} tintColor="#2A4B46" />}
        >
          
          {/* ===================== 1. InBody ===================== */}
          {activeTab === 'inbody' && (
            <View style={styles.fadeContainer}>
              {lastRec ? (
                <>
                  <View style={styles.lastRecordHeader}>
                    <Text style={styles.lastRecordTitle}>آخر قياس تم تسجيله</Text>
                    <Text style={styles.lastRecordDate}>{new Date(lastRec.record_date).toLocaleDateString('ar-EG')}</Text>
                  </View>
                  <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderColor: '#E8F3F1' }]}>
                      <Text style={styles.statLabel}>الوزن الحالي</Text>
                      <Text style={styles.statValue}>{lastRec.weight} <Text style={styles.statUnit}>كجم</Text></Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: '#FFEDD5' }]}>
                      <Text style={styles.statLabel}>العضلات</Text>
                      <Text style={styles.statValue}>{lastRec.muscle_mass || '-'} <Text style={styles.statUnit}>كجم</Text></Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: '#DBEAFE' }]}>
                      <Text style={styles.statLabel}>الدهون</Text>
                      <Text style={styles.statValue}>{lastRec.fat_percent || '-'} <Text style={styles.statUnit}>%</Text></Text>
                    </View>
                  </View>
                  {lastRec.ai_summary && !showInbodyForm && (
                    <View style={styles.aiSummaryBox}>
                      <Text style={styles.aiSummaryTitle}>رأي الكوتش الذكي:</Text>
                      <Text style={styles.aiSummaryText}>{lastRec.ai_summary}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyAlert}><Text style={styles.emptyAlertText}>ليس لديك سجلات بعد، أضف أول قياس لتبدأ رحلتك! 🚀</Text></View>
              )}

              {inbodyRecords.length > 1 && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>تطور الوزن</Text>
                  <LineChart
                    data={chartData} width={screenWidth - 40} height={220}
                    chartConfig={{ backgroundColor: '#FFF', backgroundGradientFrom: '#FFF', backgroundGradientTo: '#FFF', decimalPlaces: 1, color: (opacity = 1) => `rgba(42, 75, 70, ${opacity})`, labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`, propsForDots: { r: "6", strokeWidth: "2", stroke: "#F97316" } }}
                    bezier style={{ borderRadius: 16 }}
                  />
                </View>
              )}

              {inbodyRecords.length >= 2 && inbodyRecords[0]?.image_url && lastRec?.image_url && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>مقارنة التطور البصري (قبل وبعد)</Text>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 }}>
                    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 5 }}>
                      <Text style={{ fontWeight: 'bold', marginBottom: 8, color: '#4B5563' }}>أول قياس</Text>
                      <Image source={{ uri: supabase.storage.from('inbody_images').getPublicUrl(inbodyRecords[0].image_url).data.publicUrl }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" />
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 5 }}>
                      <Text style={{ fontWeight: 'bold', marginBottom: 8, color: '#2A4B46' }}>القياس الأخير</Text>
                      <Image source={{ uri: supabase.storage.from('inbody_images').getPublicUrl(lastRec.image_url).data.publicUrl }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" />
                    </View>
                  </View>
                </View>
              )}

              {!showInbodyForm && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#F97316', backgroundColor: '#FFF7ED' }]} onPress={handleAnalyzeImage} disabled={analyzing}>
                    {analyzing ? <ActivityIndicator color="#F97316" /> : <Ionicons name="color-wand" size={28} color="#F97316" />}
                    <Text style={[styles.actionBtnText, { color: '#F97316' }]}>{analyzing ? 'جاري التحليل...' : 'قراءة ذكية للورقة'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setShowInbodyForm(true)}>
                    <Ionicons name="create-outline" size={28} color="#6B7280" />
                    <Text style={styles.actionBtnText}>إدخال يدوي</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showInbodyForm && (
                <View style={styles.formContainer}>
                  <View style={styles.formHeader}>
                    <TouchableOpacity onPress={() => setShowInbodyForm(false)}><Ionicons name="close-circle" size={28} color="#EF4444" /></TouchableOpacity>
                    <Text style={styles.formTitle}>تسجيل قياس جديد</Text>
                  </View>
                  {aiSummary ? (<View style={styles.aiSummaryBox}><Text style={styles.aiSummaryTitle}>رأي الكوتش الذكي للقياس الجديد:</Text><Text style={styles.aiSummaryText}>{aiSummary}</Text></View>) : null}
                  <View style={styles.inputRow}>
                    <View style={styles.inputWrap}><Text style={styles.inputLabel}>الدهون %</Text><TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
                    <View style={styles.inputWrap}><Text style={styles.inputLabel}>العضلات (كجم)</Text><TextInput style={styles.input} value={muscle} onChangeText={setMuscle} keyboardType="decimal-pad" /></View>
                    <View style={styles.inputWrap}><Text style={styles.inputLabel}>الوزن (كجم)</Text><TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /></View>
                  </View>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleInbodySubmit} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ في السجل</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {inbodyRecords.length > 0 && !showInbodyForm && (
                <View style={styles.historySection}>
                  <Text style={styles.historySectionTitle}>سجل القياسات السابقة <Ionicons name="calendar-outline" size={18} /></Text>
                  {inbodyRecords.slice().reverse().map(record => {
                    const d = new Date(record.record_date);
                    return (
                      <View key={record.id} style={styles.historyCard}>
                        <View style={styles.historyDateBox}><Text style={styles.historyDay}>{d.getDate()}</Text><Text style={styles.historyMonth}>{arabicMonths[d.getMonth()]}</Text></View>
                        <View style={styles.historyDetails}>
                          <View style={styles.historyRow}>
                            <Text style={styles.historyWeight}>{record.weight} كجم</Text>
                            {record.muscle_mass && <Text style={styles.historyBadge}>💪 {record.muscle_mass}</Text>}
                            {record.fat_percent && <Text style={styles.historyBadge}>💧 {record.fat_percent}%</Text>}
                          </View>
                          {record.ai_summary && (<Text style={styles.historySummary} numberOfLines={2}>{record.ai_summary}</Text>)}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ===================== 2. التحاليل (Docs) ===================== */}
          {activeTab === 'docs' && (
            <View style={styles.fadeContainer}>
              <TouchableOpacity style={styles.uploadDocBtn} onPress={handleDocUpload} disabled={uploading}>
                {uploading ? (<ActivityIndicator size="large" color="#2A4B46" />) : (<><Ionicons name="cloud-upload" size={48} color="#2A4B46" /><Text style={styles.uploadDocTitle}>اضغط لرفع ملف جديد</Text><Text style={styles.uploadDocSub}>صور تحاليل، روشتة، أو أي مستند طبي</Text></>)}
              </TouchableOpacity>
              <View style={styles.docsList}>
                {docs.length === 0 ? (<Text style={styles.emptyText}>لا يوجد مستندات مرفوعة</Text>) : (
                  docs.map(doc => (
                    <View key={doc.id} style={styles.docCard}>
                      <TouchableOpacity style={styles.viewDocBtn} onPress={() => handleViewDocument(doc.file_url)}><Text style={styles.viewDocBtnText}>عرض</Text></TouchableOpacity>
                      <View style={styles.docInfo}><Text style={styles.docName} numberOfLines={1}>{doc.file_name}</Text><Text style={styles.docDate}>{new Date(doc.created_at).toLocaleDateString('ar-EG')}</Text></View>
                      <View style={styles.docIconBox}><Ionicons name="document-text" size={24} color="#3B82F6" /></View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ===================== 3. الملف الطبي (Health Profile) ===================== */}
          {activeTab === 'health' && (
            <View style={styles.fadeContainer}>
              {!isEditingHealth ? (
                <View style={styles.profileCard}>
                  <View style={styles.profileHeader}>
                    <TouchableOpacity style={styles.editBtnSmall} onPress={() => setIsEditingHealth(true)}>
                      <Ionicons name="pencil" size={16} color="#FFF" /><Text style={styles.editBtnText}>تعديل</Text>
                    </TouchableOpacity>
                    <Text style={styles.profileTitle}>البيانات الطبية الأساسية</Text>
                  </View>
                  {!healthProfile ? (
                    <View style={styles.emptyAlert}><Text style={styles.emptyAlertText}>لم تقم بإدخال بياناتك الطبية بعد!</Text></View>
                  ) : (
                    <View style={styles.profileBody}>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>الأمراض المزمنة</Text>
                        <View style={styles.chipsContainer}>
                          {healthProfile.diseases?.length ? healthProfile.diseases.map((d:string) => <View key={d} style={styles.chipRed}><Text style={styles.chipRedText}>{d}</Text></View>) : <View style={styles.chipGreen}><Text style={styles.chipGreenText}>لا يوجد</Text></View>}
                        </View>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>الحساسية</Text>
                        {healthProfile.has_allergies ? <Text style={styles.dataValueRed}>نعم ({healthProfile.allergies_details})</Text> : <Text style={styles.dataValueGreen}>لا يوجد</Text>}
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>الأدوية والمكملات</Text>
                        <Text style={styles.dataValueBox}>{healthProfile.medications || 'لا يوجد'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>العمليات الجراحية</Text>
                        <Text style={styles.dataValueBox}>{healthProfile.surgeries || 'لا يوجد'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>الإصابات المانعة للحركة</Text>
                        <Text style={styles.dataValueBox}>{healthProfile.injuries || 'لا يوجد'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>مشاكل الهضم</Text>
                        <View style={styles.chipsContainer}>
                          {healthProfile.digestive_issues?.length ? healthProfile.digestive_issues.map((d:string) => <View key={d} style={styles.chipRed}><Text style={styles.chipRedText}>{d}</Text></View>) : <View style={styles.chipGreen}><Text style={styles.chipGreenText}>لا يوجد</Text></View>}
                        </View>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>الحالة الهرمونية</Text>
                        <Text style={styles.dataValueBox}>{healthProfile.hormonal_status || 'لا يوجد / لا ينطبق'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>نوع النظام المفضل</Text>
                        <Text style={styles.dataValueBox}>{healthProfile.diet_type}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.formContainer}>
                  <View style={styles.formHeader}>
                    <TouchableOpacity onPress={() => setIsEditingHealth(false)}><Ionicons name="close-circle" size={28} color="#EF4444" /></TouchableOpacity>
                    <Text style={styles.formTitle}>تحديث الملف الطبي</Text>
                  </View>

                  <Text style={styles.inputLabel}>هل تعاني من أمراض مزمنة؟</Text>
                  <View style={styles.chipsContainer}>
                    {DISEASE_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, healthForm.diseases?.includes(d) && styles.chipSelectActiveRed]} onPress={() => toggleArrayItem('diseases', d)}>
                        <Text style={[styles.chipSelectText, healthForm.diseases?.includes(d) && styles.chipSelectTextActiveRed]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>هل لديك حساسية؟</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity style={[styles.radioBtn, !healthForm.has_allergies && styles.radioBtnActive]} onPress={() => setHealthForm({...healthForm, has_allergies: false})}><Text style={[styles.radioText, !healthForm.has_allergies && styles.radioTextActive]}>لا</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.radioBtn, healthForm.has_allergies && styles.radioBtnActive]} onPress={() => setHealthForm({...healthForm, has_allergies: true})}><Text style={[styles.radioText, healthForm.has_allergies && styles.radioTextActive]}>نعم</Text></TouchableOpacity>
                  </View>
                  {healthForm.has_allergies && (
                    <TextInput style={[styles.inputLong, {marginTop: 10}]} placeholder="اكتب تفاصيل الحساسية..." value={healthForm.allergies_details} onChangeText={t => setHealthForm({...healthForm, allergies_details: t})} />
                  )}

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>تاريخ مرضي بالعائلة</Text>
                  <View style={styles.chipsContainer}>
                    {FAMILY_HISTORY_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, healthForm.family_history?.includes(d) && styles.chipSelectActive]} onPress={() => toggleArrayItem('family_history', d)}>
                        <Text style={[styles.chipSelectText, healthForm.family_history?.includes(d) && styles.chipSelectTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>نوع النظام المفضل</Text>
                  <View style={styles.chipsContainer}>
                    {DIET_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, healthForm.diet_type === d && styles.chipSelectActive]} onPress={() => setHealthForm({...healthForm, diet_type: d})}>
                        <Text style={[styles.chipSelectText, healthForm.diet_type === d && styles.chipSelectTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>الأدوية (بالجرعات)</Text>
                  <TextInput style={styles.inputArea} multiline placeholder="مثال: جلوكوفاج 500 بعد الغداء..." value={healthForm.medications} onChangeText={t => setHealthForm({...healthForm, medications: t})} />

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>هل قمت بإجراء أي عمليات جراحية؟</Text>
                  <TextInput style={styles.inputArea} multiline placeholder="اذكر التفاصيل إن وجد..." value={healthForm.surgeries} onChangeText={t => setHealthForm({...healthForm, surgeries: t})} />

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>هل لديك أي إصابات تمنعك من تمرين معين؟</Text>
                  <TextInput style={styles.inputArea} multiline placeholder="مثل: غضروف الظهر، إصابة ركبة..." value={healthForm.injuries} onChangeText={t => setHealthForm({...healthForm, injuries: t})} />

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>مشاكل الجهاز الهضمي</Text>
                  <View style={styles.chipsContainer}>
                    {DIGESTIVE_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, healthForm.digestive_issues?.includes(d) && styles.chipSelectActive]} onPress={() => toggleArrayItem('digestive_issues', d)}>
                        <Text style={[styles.chipSelectText, healthForm.digestive_issues?.includes(d) && styles.chipSelectTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>الحالة الهرمونية (للسيدات: انتظام الدورة، تكيسات..)</Text>
                  <TextInput style={styles.inputArea} multiline placeholder="اذكر التفاصيل إن وجد..." value={healthForm.hormonal_status} onChangeText={t => setHealthForm({...healthForm, hormonal_status: t})} />

                  <TouchableOpacity style={[styles.saveBtn, {marginTop: 20}]} onPress={saveHealthProfile} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ البيانات الطبية</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ===================== 4. نمط الحياة (Lifestyle Profile) ===================== */}
          {activeTab === 'lifestyle' && (
            <View style={styles.fadeContainer}>
              {!isEditingLifestyle ? (
                <View style={styles.profileCard}>
                  <View style={styles.profileHeader}>
                    <TouchableOpacity style={[styles.editBtnSmall, {backgroundColor: '#F97316'}]} onPress={() => setIsEditingLifestyle(true)}>
                      <Ionicons name="pencil" size={16} color="#FFF" /><Text style={styles.editBtnText}>تحديث</Text>
                    </TouchableOpacity>
                    <Text style={styles.profileTitle}>العادات اليومية ونمط الحياة</Text>
                  </View>
                  {!lifestyleProfile ? (
                    <View style={styles.emptyAlert}><Text style={styles.emptyAlertText}>أخبرنا عن عاداتك لتصميم خطة تناسبك!</Text></View>
                  ) : (
                    <View style={styles.profileBody}>
                      <View style={styles.statsGrid}>
                        <View style={[styles.statCard, { borderColor: '#E8F3F1' }]}>
                          <Text style={styles.statLabel}>الهدف</Text><Text style={[styles.statValue, {fontSize: 16}]}>{lifestyleProfile.goal}</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: '#DBEAFE' }]}>
                          <Text style={styles.statLabel}>المياه</Text><Text style={[styles.statValue, {fontSize: 16}]}>{lifestyleProfile.water_liters} لتر</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: '#FFEDD5' }]}>
                          <Text style={styles.statLabel}>النوم</Text><Text style={[styles.statValue, {fontSize: 16}]}>{lifestyleProfile.sleep_hours} س</Text>
                        </View>
                      </View>
                      
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>عادات الأكل</Text>
                        <Text style={styles.dataValueBox}>يفطر: {lifestyleProfile.has_breakfast?'نعم':'لا'} | سناكس: {lifestyleProfile.has_snacks?'نعم':'لا'} | أكل متأخر: {lifestyleProfile.late_night_eating?'نعم':'لا'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>النشاط البدني وطبيعة العمل</Text>
                        <Text style={styles.dataValueBox}>{lifestyleProfile.work_nature} - {lifestyleProfile.activity_level} {lifestyleProfile.does_exercise ? `(${lifestyleProfile.exercise_details?.type})` : ''}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>معلومات إضافية (الشهية والمكملات)</Text>
                        <Text style={styles.dataValueBox}>الشهية: {lifestyleProfile.appetite_level} | المكملات: {lifestyleProfile.supplements || 'لا يوجد'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>تاريخ الدايت وتحدياته</Text>
                        <Text style={styles.dataValueBox}>ثبات وزن: {lifestyleProfile.weight_plateau?'نعم':'لا'} | أكل عاطفي: {lifestyleProfile.emotional_eating?'نعم':'لا'}{'\n'}الأنظمة السابقة: {lifestyleProfile.diet_history || 'لا يوجد'}</Text>
                      </View>
                      <View style={styles.dataGroup}>
                        <Text style={styles.dataLabel}>الأطعمة المفضلة والممنوعة</Text>
                        <Text style={styles.dataValueBox}>المفضل: {lifestyleProfile.favorite_foods || '-'}{'\n'}الممنوع: {lifestyleProfile.disliked_foods || '-'}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.formContainer}>
                  <View style={styles.formHeader}>
                    <TouchableOpacity onPress={() => setIsEditingLifestyle(false)}><Ionicons name="close-circle" size={28} color="#EF4444" /></TouchableOpacity>
                    <Text style={styles.formTitle}>تحديث نمط الحياة</Text>
                  </View>

                  <Text style={styles.inputLabel}>الهدف الأساسي</Text>
                  <View style={styles.chipsContainer}>
                    {GOAL_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, lifestyleForm.goal === d && styles.chipSelectActive]} onPress={() => setLifestyleForm({...lifestyleForm, goal: d})}>
                        <Text style={[styles.chipSelectText, lifestyleForm.goal === d && styles.chipSelectTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputWrap}><Text style={styles.inputLabel}>النوم (ساعات)</Text><TextInput style={styles.input} value={lifestyleForm.sleep_hours} onChangeText={t=>setLifestyleForm({...lifestyleForm, sleep_hours: t})} keyboardType="number-pad" /></View>
                    <View style={styles.inputWrap}><Text style={styles.inputLabel}>المياه (لتر)</Text><TextInput style={styles.input} value={lifestyleForm.water_liters} onChangeText={t=>setLifestyleForm({...lifestyleForm, water_liters: t})} keyboardType="decimal-pad" /></View>
                  </View>

                  <Text style={styles.inputLabel}>تفاصيل الأكل اليومي</Text>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>أتناول الإفطار</Text>
                    <TouchableOpacity style={[styles.toggleBtn, lifestyleForm.has_breakfast && styles.toggleBtnActive]} onPress={()=>setLifestyleForm({...lifestyleForm, has_breakfast: !lifestyleForm.has_breakfast})}>
                      <View style={[styles.toggleDot, lifestyleForm.has_breakfast && styles.toggleDotActive]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>آكل سناكس بين الوجبات</Text>
                    <TouchableOpacity style={[styles.toggleBtn, lifestyleForm.has_snacks && styles.toggleBtnActive]} onPress={()=>setLifestyleForm({...lifestyleForm, has_snacks: !lifestyleForm.has_snacks})}>
                      <View style={[styles.toggleDot, lifestyleForm.has_snacks && styles.toggleDotActive]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>آكل في وقت متأخر ليلاً</Text>
                    <TouchableOpacity style={[styles.toggleBtn, lifestyleForm.late_night_eating && styles.toggleBtnActive]} onPress={()=>setLifestyleForm({...lifestyleForm, late_night_eating: !lifestyleForm.late_night_eating})}>
                      <View style={[styles.toggleDot, lifestyleForm.late_night_eating && styles.toggleDotActive]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>الارتباط العاطفي بالأكل (شراهة عند التوتر؟)</Text>
                    <TouchableOpacity style={[styles.toggleBtn, lifestyleForm.emotional_eating && styles.toggleBtnActive]} onPress={()=>setLifestyleForm({...lifestyleForm, emotional_eating: !lifestyleForm.emotional_eating})}>
                      <View style={[styles.toggleDot, lifestyleForm.emotional_eating && styles.toggleDotActive]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>أعاني من ثبات الوزن الفترات الأخيرة</Text>
                    <TouchableOpacity style={[styles.toggleBtn, lifestyleForm.weight_plateau && styles.toggleBtnActive]} onPress={()=>setLifestyleForm({...lifestyleForm, weight_plateau: !lifestyleForm.weight_plateau})}>
                      <View style={[styles.toggleDot, lifestyleForm.weight_plateau && styles.toggleDotActive]} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>طبيعة العمل اليومي</Text>
                  <View style={styles.chipsContainer}>
                    {WORK_NATURE_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, lifestyleForm.work_nature === d && styles.chipSelectActive]} onPress={() => setLifestyleForm({...lifestyleForm, work_nature: d})}>
                        <Text style={[styles.chipSelectText, lifestyleForm.work_nature === d && styles.chipSelectTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>مستوى الشهية العام</Text>
                  <View style={styles.chipsContainer}>
                    {APPETITE_OPTIONS.map(d => (
                      <TouchableOpacity key={d} style={[styles.chipSelect, lifestyleForm.appetite_level === d && styles.chipSelectActive]} onPress={() => setLifestyleForm({...lifestyleForm, appetite_level: d})}>
                        <Text style={[styles.chipSelectText, lifestyleForm.appetite_level === d && styles.chipSelectTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>تاريخ الدايت (أنظمة قاسية سابقة؟)</Text>
                  <TextInput style={styles.inputLong} placeholder="مثال: جربت كيتو ونزلت ورجعت تاني..." value={lifestyleForm.diet_history} onChangeText={t=>setLifestyleForm({...lifestyleForm, diet_history: t})} />
                  
                  <Text style={[styles.inputLabel, {marginTop: 15}]}>المكملات الغذائية المستخدمة حالياً</Text>
                  <TextInput style={styles.inputLong} placeholder="مثال: واي بروتين، فيتامين د..." value={lifestyleForm.supplements} onChangeText={t=>setLifestyleForm({...lifestyleForm, supplements: t})} />
                  
                  <Text style={[styles.inputLabel, {marginTop: 15}]}>معدل استهلاك المنبهات (قهوة، شاي، طاقة)</Text>
                  <TextInput style={styles.inputLong} placeholder="مثال: 3 أكواب قهوة يومياً..." value={lifestyleForm.caffeine_intake} onChangeText={t=>setLifestyleForm({...lifestyleForm, caffeine_intake: t})} />

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>أطعمة مفضلة جداً</Text>
                  <TextInput style={styles.inputLong} placeholder="شوكولاتة، مكرونة..." value={lifestyleForm.favorite_foods} onChangeText={t=>setLifestyleForm({...lifestyleForm, favorite_foods: t})} />
                  
                  <Text style={[styles.inputLabel, {marginTop: 15}]}>أطعمة غير مفضلة أو ممنوعة</Text>
                  <TextInput style={styles.inputLong} placeholder="سمك، باذنجان..." value={lifestyleForm.disliked_foods} onChangeText={t=>setLifestyleForm({...lifestyleForm, disliked_foods: t})} />

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>هل تمارس الرياضة؟</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity style={[styles.radioBtn, !lifestyleForm.does_exercise && styles.radioBtnActive]} onPress={() => setLifestyleForm({...lifestyleForm, does_exercise: false})}><Text style={[styles.radioText, !lifestyleForm.does_exercise && styles.radioTextActive]}>لا</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.radioBtn, lifestyleForm.does_exercise && styles.radioBtnActive]} onPress={() => setLifestyleForm({...lifestyleForm, does_exercise: true})}><Text style={[styles.radioText, lifestyleForm.does_exercise && styles.radioTextActive]}>نعم</Text></TouchableOpacity>
                  </View>
                  
                  {lifestyleForm.does_exercise && (
                    <View style={[styles.inputRow, {marginTop: 10}]}>
                      <View style={styles.inputWrap}><Text style={styles.inputLabel}>أيام في الأسبوع</Text><TextInput style={styles.input} value={lifestyleForm.exercise_details.days} onChangeText={t=>setLifestyleForm({...lifestyleForm, exercise_details: {...lifestyleForm.exercise_details, days: t}})} keyboardType="number-pad" /></View>
                      <View style={[styles.inputWrap, {flex: 2}]}><Text style={styles.inputLabel}>نوع الرياضة</Text><TextInput style={styles.input} placeholder="جيم، مشي..." value={lifestyleForm.exercise_details.type} onChangeText={t=>setLifestyleForm({...lifestyleForm, exercise_details: {...lifestyleForm.exercise_details, type: t}})} /></View>
                    </View>
                  )}

                  <TouchableOpacity style={[styles.saveBtn, {marginTop: 20, backgroundColor: '#F97316'}]} onPress={saveLifestyleProfile} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>تحديث نمط الحياة</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  
  header: { padding: 20, paddingBottom: 10, alignItems: 'flex-end' },
  title: { fontSize: 26, fontWeight: '900', color: '#2A4B46', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#6B7280', fontWeight: 'bold' },

  // شريط التبويبات الأفقي الجديد
  tabScrollContainer: { paddingHorizontal: 15, paddingBottom: 15, flexDirection: 'row-reverse', gap: 10 },
  tabBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabBtnActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#9CA3AF' },
  tabTextActive: { color: '#2A4B46' },

  fadeContainer: { flex: 1 },

  // تنسيقات الكروت
  profileCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 20, elevation: 1 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 15, marginBottom: 15 },
  profileTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  editBtnSmall: { backgroundColor: '#2A4B46', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 5 },
  editBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  profileBody: { gap: 15 },
  dataGroup: { alignItems: 'flex-end' },
  dataLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: 'bold', marginBottom: 5 },
  dataValueBox: { backgroundColor: '#F9F6F0', width: '100%', padding: 12, borderRadius: 10, textAlign: 'right', fontWeight: 'bold', color: '#1F2937' },
  dataValueRed: { color: '#EF4444', fontWeight: 'bold' },
  dataValueGreen: { color: '#10B981', fontWeight: 'bold' },

  // تنسيقات الـ Chips والمجموعات
  chipsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chipRed: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipRedText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  chipGreen: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipGreenText: { color: '#10B981', fontSize: 12, fontWeight: 'bold' },
  
  chipSelect: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  chipSelectActive: { backgroundColor: '#E8F3F1', borderColor: '#2A4B46' },
  chipSelectActiveRed: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  chipSelectText: { color: '#6B7280', fontWeight: 'bold', fontSize: 13 },
  chipSelectTextActive: { color: '#2A4B46' },
  chipSelectTextActiveRed: { color: '#EF4444' },

  radioGroup: { flexDirection: 'row-reverse', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
  radioBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  radioBtnActive: { backgroundColor: '#FFF', elevation: 1 },
  radioText: { color: '#9CA3AF', fontWeight: 'bold' },
  radioTextActive: { color: '#1F2937' },

  // Toggle (عادات الأكل)
  toggleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9F6F0', padding: 12, borderRadius: 12, marginBottom: 8 },
  toggleText: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  toggleBtn: { width: 44, height: 24, backgroundColor: '#D1D5DB', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 2 },
  toggleBtnActive: { backgroundColor: '#10B981' },
  toggleDot: { width: 20, height: 20, backgroundColor: '#FFF', borderRadius: 10 },
  toggleDotActive: { transform: [{ translateX: 20 }] },

  inputLong: { backgroundColor: '#F3F4F6', height: 45, borderRadius: 12, textAlign: 'right', fontSize: 14, fontWeight: 'bold', paddingHorizontal: 15 },
  inputArea: { backgroundColor: '#F3F4F6', height: 80, borderRadius: 12, textAlign: 'right', fontSize: 14, fontWeight: 'bold', paddingHorizontal: 15, paddingTop: 10 },

  // InBody & Docs Styles
  lastRecordHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 },
  lastRecordTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  lastRecordDate: { fontSize: 13, color: '#9CA3AF', fontWeight: 'bold', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statsGrid: { flexDirection: 'row-reverse', gap: 10, marginBottom: 15 },
  statCard: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 2, elevation: 1 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', marginBottom: 5 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
  statUnit: { fontSize: 10, color: '#9CA3AF', fontWeight: 'normal' },
  emptyAlert: { backgroundColor: '#FFF7ED', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#FFEDD5', marginBottom: 20 },
  emptyAlertText: { textAlign: 'center', color: '#F97316', fontWeight: 'bold', fontSize: 14 },
  chartContainer: { backgroundColor: '#FFF', padding: 15, borderRadius: 25, marginBottom: 20, elevation: 1, alignItems: 'center' },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#2A4B46', marginBottom: 15, alignSelf: 'flex-end' },
  actionRow: { flexDirection: 'row-reverse', gap: 15, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#F3F4F6', borderStyle: 'dashed' },
  actionBtnText: { marginTop: 10, fontSize: 14, fontWeight: 'bold', color: '#6B7280', textAlign: 'center' },
  formContainer: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 20 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  aiSummaryBox: { backgroundColor: '#EFF6FF', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#DBEAFE' },
  aiSummaryTitle: { color: '#1E40AF', fontWeight: 'bold', fontSize: 13, marginBottom: 5, textAlign: 'right' },
  aiSummaryText: { color: '#1D4ED8', fontSize: 13, textAlign: 'right', lineHeight: 22 },
  inputRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20 },
  inputWrap: { flex: 1 },
  inputLabel: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#F3F4F6', height: 45, borderRadius: 12, textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#2A4B46', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  historySection: { marginTop: 10 },
  historySectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2A4B46', textAlign: 'right', marginBottom: 15 },
  historyCard: { flexDirection: 'row-reverse', backgroundColor: '#FFF', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', alignItems: 'center', elevation: 1 },
  historyDateBox: { width: 60, height: 60, backgroundColor: '#F9F6F0', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  historyDay: { fontSize: 20, fontWeight: '900', color: '#2A4B46' },
  historyMonth: { fontSize: 11, fontWeight: 'bold', color: '#6B7280' },
  historyDetails: { flex: 1, alignItems: 'flex-end' },
  historyRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyWeight: { fontSize: 17, fontWeight: '900', color: '#1F2937' },
  historyBadge: { fontSize: 11, fontWeight: 'bold', color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  historySummary: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', lineHeight: 18 },
  uploadDocBtn: { backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 30, padding: 30, alignItems: 'center', marginBottom: 25 },
  uploadDocTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginTop: 15 },
  uploadDocSub: { fontSize: 13, color: '#6B7280', marginTop: 5 },
  docsList: { gap: 12 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontWeight: 'bold' },
  docCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderRadius: 20, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#F3F4F6' },
  viewDocBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  viewDocBtnText: { color: '#2A4B46', fontWeight: 'bold', fontSize: 12 },
  docInfo: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 15 },
  docName: { fontSize: 14, fontWeight: 'bold', color: '#1F2937', textAlign: 'right' },
  docDate: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  docIconBox: { width: 45, height: 45, backgroundColor: '#EFF6FF', borderRadius: 15, justifyContent: 'center', alignItems: 'center' }
});