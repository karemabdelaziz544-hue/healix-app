import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { LineChart } from 'react-native-chart-kit';
import { decode } from 'base64-arraybuffer';
import { useFamily } from '../../src/context/FamilyContext';

const screenWidth = Dimensions.get('window').width;

// مصفوفة بسيطة لأسماء الشهور عشان نعرضها بشكل شيك في الموبايل
const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function MedicalRecordsScreen() {
const { currentProfile } = useFamily();
const userId = currentProfile?.id;
  const [activeTab, setActiveTab] = useState<'inbody' | 'docs'>('inbody');
  const [inbodyRecords, setInbodyRecords] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [showInbodyForm, setShowInbodyForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [muscle, setMuscle] = useState('');
  const [fat, setFat] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');

  useEffect(() => {
    if (userId) {
      fetchInbody();
      fetchDocs();
    }
  }, [userId]);

  const fetchInbody = async () => {
    const { data } = await supabase.from('inbody_records').select('*').eq('user_id', userId).order('record_date', { ascending: true });
    setInbodyRecords(data || []);
    setLoading(false);
  };

  const fetchDocs = async () => {
    const { data } = await supabase.from('client_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setDocs(data || []);
  };

  const handleAnalyzeImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true, 
    });

    if (result.canceled || !result.assets[0].base64) return;

    setAnalyzing(true);
    try {
      const base64FileData = result.assets[0].base64;
      const fileExt = result.assets[0].uri.split('.').pop() || 'jpg';
      const fileName = `inbody/${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-docs')
        .upload(fileName, decode(base64FileData), { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;
      setUploadedImageUrl(fileName);

      const { data, error: functionError } = await supabase.functions.invoke('analyze-inbody', {
        body: { base64: base64FileData }
      });

      if (functionError) throw new Error("فشل الاتصال بالخادم، يرجى المحاولة لاحقاً.");

      const analysis = data?.data;
      if (analysis) {
        setWeight(analysis.weight?.toString() || '');
        setMuscle(analysis.muscle?.toString() || '');
        setFat(analysis.fat?.toString() || '');
        setAiSummary(analysis.summary || '');
        setShowInbodyForm(true);
        Alert.alert("نجاح", "تم استخراج البيانات! راجعها واضغط حفظ");
      }

    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleInbodySubmit = async () => {
    if (!weight) return Alert.alert("تنبيه", "يرجى إدخال الوزن على الأقل");
    setUploading(true);
    try {
      const { error } = await supabase.from('inbody_records').insert([{
        user_id: userId,
        weight: parseFloat(weight),
        muscle_mass: muscle ? parseFloat(muscle) : null,
        fat_percent: fat ? parseFloat(fat) : null,
        ai_summary: aiSummary,
        image_url: uploadedImageUrl,
        record_date: new Date().toISOString()
      }]);

      if (error) throw error;

      setShowInbodyForm(false);
      setWeight(''); setMuscle(''); setFat(''); setAiSummary(''); setUploadedImageUrl('');
      fetchInbody();
      Alert.alert("نجاح", "تم تسجيل القياس الجديد بنجاح 🚀");
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDocUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    setUploading(true);
    const file = result.assets[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `docs/${userId}/${Math.random()}-${Date.now()}.${fileExt}`;

    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('medical-docs')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('client_documents').insert({
        user_id: userId,
        file_name: file.name,
        file_url: fileName, 
        file_type: 'general'
      });

      if (dbError) throw dbError;

      fetchDocs();
      Alert.alert("نجاح", "تم رفع المستند بنجاح");
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (pathOrUrl: string) => {
    try {
      if (pathOrUrl.startsWith('http')) {
        Linking.openURL(pathOrUrl);
        return;
      }
      const { data, error } = await supabase.storage.from('medical-docs').createSignedUrl(pathOrUrl, 3600);
      if (error || !data) throw new Error("فشل في فتح الملف السري");
      Linking.openURL(data.signedUrl);
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    }
  };

  // استخراج آخر قياس تم إدخاله
  const lastRec = inbodyRecords.length > 0 ? inbodyRecords[inbodyRecords.length - 1] : null;

  const chartData = {
    labels: inbodyRecords.slice(-5).map(r => new Date(r.record_date).getDate().toString()), 
    datasets: [{
      data: inbodyRecords.length > 0 ? inbodyRecords.slice(-5).map(r => r.weight) : [0]
    }]
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2A4B46" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>مركز القياسات <Ionicons name="pulse" size={24} color="#F97316" /></Text>
          <Text style={styles.subtitle}>تابع تطور جسمك وتحاليلك في مكان واحد</Text>
        </View>
      </View>

      <View style={styles.tabSwitcher}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'docs' && styles.tabBtnActive]} onPress={() => setActiveTab('docs')}>
          <Ionicons name="document-text" size={18} color={activeTab === 'docs' ? "#2A4B46" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === 'docs' && styles.tabTextActive]}>التحاليل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'inbody' && styles.tabBtnActive]} onPress={() => setActiveTab('inbody')}>
          <Ionicons name="body" size={18} color={activeTab === 'inbody' ? "#2A4B46" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === 'inbody' && styles.tabTextActive]}>InBody</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ===================== شاشة الـ InBody ===================== */}
        {activeTab === 'inbody' && (
          <View style={styles.fadeContainer}>
            
            {/* ملخص آخر قياس */}
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

                {/* رأي الكوتش الذكي لآخر قياس (يظهر فقط لو مفيش فورم مفتوح) */}
                {lastRec.ai_summary && !showInbodyForm && (
                  <View style={styles.aiSummaryBox}>
                    <Text style={styles.aiSummaryTitle}>رأي الكوتش الذكي:</Text>
                    <Text style={styles.aiSummaryText}>{lastRec.ai_summary}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyAlert}>
                <Text style={styles.emptyAlertText}>ليس لديك سجلات بعد، أضف أول قياس لتبدأ رحلتك! 🚀</Text>
              </View>
            )}

            {/* الرسم البياني */}
            {inbodyRecords.length > 1 && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>تطور الوزن</Text>
                <LineChart
                  data={chartData}
                  width={screenWidth - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#FFF',
                    backgroundGradientFrom: '#FFF',
                    backgroundGradientTo: '#FFF',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(42, 75, 70, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                    propsForDots: { r: "6", strokeWidth: "2", stroke: "#F97316" }
                  }}
                  bezier
                  style={{ borderRadius: 16 }}
                />
              </View>
            )}

            {/* أزرار الإضافة */}
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

            {/* فورم الإدخال اليدوي أو نتيجة الذكاء الاصطناعي الجديدة */}
            {showInbodyForm && (
              <View style={styles.formContainer}>
                <View style={styles.formHeader}>
                  <TouchableOpacity onPress={() => setShowInbodyForm(false)}><Ionicons name="close-circle" size={28} color="#EF4444" /></TouchableOpacity>
                  <Text style={styles.formTitle}>تسجيل قياس جديد</Text>
                </View>

                {aiSummary ? (
                  <View style={styles.aiSummaryBox}>
                    <Text style={styles.aiSummaryTitle}>رأي الكوتش الذكي للقياس الجديد:</Text>
                    <Text style={styles.aiSummaryText}>{aiSummary}</Text>
                  </View>
                ) : null}

                <View style={styles.inputRow}>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>الدهون %</Text>
                    <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>العضلات (كجم)</Text>
                    <TextInput style={styles.input} value={muscle} onChangeText={setMuscle} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>الوزن (كجم)</Text>
                    <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
                  </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleInbodySubmit} disabled={uploading}>
                  {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ في السجل</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ===================== سجل القياسات (History List) ===================== */}
            {inbodyRecords.length > 0 && !showInbodyForm && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>سجل القياسات السابقة <Ionicons name="calendar-outline" size={18} /></Text>
                
                {inbodyRecords.slice().reverse().map(record => {
                  const d = new Date(record.record_date);
                  return (
                    <View key={record.id} style={styles.historyCard}>
                      
                      <View style={styles.historyDateBox}>
                        <Text style={styles.historyDay}>{d.getDate()}</Text>
                        <Text style={styles.historyMonth}>{arabicMonths[d.getMonth()]}</Text>
                      </View>

                      <View style={styles.historyDetails}>
                        <View style={styles.historyRow}>
                          <Text style={styles.historyWeight}>{record.weight} كجم</Text>
                          {record.muscle_mass && <Text style={styles.historyBadge}>💪 {record.muscle_mass}</Text>}
                          {record.fat_percent && <Text style={styles.historyBadge}>💧 {record.fat_percent}%</Text>}
                        </View>
                        {record.ai_summary && (
                          <Text style={styles.historySummary} numberOfLines={2}>
                            {record.ai_summary}
                          </Text>
                        )}
                      </View>
                      
                    </View>
                  );
                })}
              </View>
            )}

          </View>
        )}

        {/* ===================== شاشة التحاليل ===================== */}
        {activeTab === 'docs' && (
          <View style={styles.fadeContainer}>
            <TouchableOpacity style={styles.uploadDocBtn} onPress={handleDocUpload} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="large" color="#2A4B46" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={48} color="#2A4B46" />
                  <Text style={styles.uploadDocTitle}>اضغط لرفع ملف جديد</Text>
                  <Text style={styles.uploadDocSub}>صور تحاليل، روشتة، أو أي مستند طبي</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.docsList}>
              {docs.length === 0 ? (
                <Text style={styles.emptyText}>لا يوجد مستندات مرفوعة</Text>
              ) : (
                docs.map(doc => (
                  <View key={doc.id} style={styles.docCard}>
                    <TouchableOpacity style={styles.viewDocBtn} onPress={() => handleViewDocument(doc.file_url)}>
                      <Text style={styles.viewDocBtnText}>عرض</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.docInfo}>
                      <Text style={styles.docName} numberOfLines={1}>{doc.file_name}</Text>
                      <Text style={styles.docDate}>{new Date(doc.created_at).toLocaleDateString('ar-EG')}</Text>
                    </View>
                    
                    <View style={styles.docIconBox}>
                      <Ionicons name="document-text" size={24} color="#3B82F6" />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  header: { padding: 20, paddingBottom: 10, alignItems: 'flex-end' },
  title: { fontSize: 26, fontWeight: '900', color: '#2A4B46', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#6B7280', fontWeight: 'bold' },

  tabSwitcher: { flexDirection: 'row', backgroundColor: '#F3F4F6', marginHorizontal: 20, borderRadius: 15, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 12, gap: 5 },
  tabBtnActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#9CA3AF' },
  tabTextActive: { color: '#2A4B46' },

  fadeContainer: { flex: 1 },

  // تنسيقات آخر قياس
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

  // تنسيقات الأرشيف الجديد (History)
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
  docIconBox: { width: 45, height: 45, backgroundColor: '#EFF6FF', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
});