/**
 * InBodyTab — قياسات الـ InBody والرسوم البيانية
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../../components/AppToast';
import { ARABIC_MONTHS, MedicalTabProps } from './medical.types';
import { medicalStyles as styles } from './medicalStyles';
import type { InbodyRecord } from '../../types';

const screenWidth = Dimensions.get('window').width;

interface InBodyTabProps extends MedicalTabProps {
  inbodyRecords: InbodyRecord[];
  onRefresh: () => Promise<void>;
}

export default function InBodyTab({ userId, inbodyRecords, uploading, setUploading, onRefresh }: InBodyTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [muscle, setMuscle] = useState('');
  const [fat, setFat] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string>('');

  const lastRec = inbodyRecords.length > 0 ? inbodyRecords[inbodyRecords.length - 1] : null;
  const chartData = {
    labels: inbodyRecords.slice(-5).map(r => new Date(r.record_date).getDate().toString()),
    datasets: [{ data: inbodyRecords.slice(-5).map(r => r.weight) }],
  };

  const handleAnalyzeImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAnalyzing(true);
        const file = result.assets[0];
        const uriParts = file.uri.split('.');
        const fileExt = uriParts[uriParts.length - 1];
        const fileName = `inbody/${userId}/${Date.now()}.${fileExt}`;

        if (!file.base64) throw new Error('لا توجد بيانات للصورة');

        // 1. رفع الصورة لـ Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('medical-docs')
          .upload(fileName, decode(file.base64), {
            contentType: file.mimeType || `image/${fileExt}`,
          });

        if (uploadError) throw uploadError;
        setImageUrl(fileName);

        // 2. استدعاء Edge Function لتحليل الصورة بـ Groq
        const { data: fnData, error: fnError } = await supabase.functions.invoke('analyze-inbody', {
          body: { imagePath: fileName },
        });

        if (fnError) {
          // طباعة تفاصيل الخطأ من الـ Edge Function
          console.error('[Edge Function Error Details]', JSON.stringify(fnError, null, 2));
          if (fnError.context) {
            try {
              const errBody = await fnError.context.json();
              console.error('[Edge Function Response Body]', errBody);
            } catch (_) {}
          }
          throw fnError;
        }

        // 3. تعبئة الحقول تلقائياً إذا أمكن
        if (fnData?.extracted?.weight) setWeight(String(fnData.extracted.weight));
        if (fnData?.extracted?.muscle) setMuscle(String(fnData.extracted.muscle));
        if (fnData?.extracted?.fat) setFat(String(fnData.extracted.fat));
        if (fnData?.analysis) setAiReport(fnData.analysis);

        setAnalyzing(false);
        showToast.success('تم تحليل الورقة! راجع الأرقام وتأكد منها.');
        setShowForm(true);
      }
    } catch (err: any) {
      setAnalyzing(false);
      showToast.error('حدث خطأ أثناء رفع الصورة أو التحليل');
      console.error('[handleAnalyzeImage]', err);
    }
  };

  const handleSubmit = async () => {
    if (!weight) return Alert.alert('خطأ', 'الرجاء إدخال الوزن');
    setUploading(true);
    try {
      const { error } = await supabase.from('inbody_records').insert({
        user_id: userId,
        weight: parseFloat(weight),
        muscle_mass: muscle ? parseFloat(muscle) : null,
        fat_percent: fat ? parseFloat(fat) : null,
        record_date: new Date().toISOString(),
        image_url: imageUrl,
      });
      if (error) throw error;
      await onRefresh();
      setShowForm(false);
      setWeight(''); setMuscle(''); setFat(''); setImageUrl(null); setAiReport('');
      showToast.success('تم حفظ القياس بنجاح!');
    } catch (err) {
      showToast.error('فشل حفظ القياس');
    } finally {
      setUploading(false);
    }
  };

  return (
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
          {lastRec.ai_summary && !showForm && (
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
              <Image source={{ uri: supabase.storage.from('medical-docs').getPublicUrl(inbodyRecords[0].image_url).data.publicUrl }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 5 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 8, color: '#2A4B46' }}>القياس الأخير</Text>
              <Image source={{ uri: supabase.storage.from('medical-docs').getPublicUrl(lastRec.image_url).data.publicUrl }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" />
            </View>
          </View>
        </View>
      )}

      {!showForm && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#F97316', backgroundColor: '#FFF7ED' }]} onPress={handleAnalyzeImage} disabled={analyzing}>
            {analyzing ? <ActivityIndicator color="#F97316" /> : <Ionicons name="color-wand" size={28} color="#F97316" />}
            <Text style={[styles.actionBtnText, { color: '#F97316' }]}>{analyzing ? 'جاري التحليل...' : 'قراءة ذكية للورقة'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="create-outline" size={28} color="#6B7280" />
            <Text style={styles.actionBtnText}>إدخال يدوي</Text>
          </TouchableOpacity>
        </View>
      )}

      {showForm && (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => { setShowForm(false); setImageUrl(null); setWeight(''); setMuscle(''); setFat(''); setAiReport(''); }}>
              <Ionicons name="close-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
            <Text style={styles.formTitle}>تسجيل قياس جديد</Text>
          </View>
          {aiReport ? (
            <View style={styles.aiSummaryBox}>
              <Text style={styles.aiSummaryTitle}>رأي الكوتش الذكي (تحقق من الأرقام):</Text>
              <Text style={styles.aiSummaryText}>{aiReport}</Text>
            </View>
          ) : imageUrl ? (
            <View style={[styles.aiSummaryBox, { borderColor: '#D1FAE5', backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.aiSummaryTitle, { color: '#065F46' }]}>✅ تم رفع صورة الورقة</Text>
              <Text style={[styles.aiSummaryText, { color: '#047857' }]}>راجع الأرقام وتأكد منها قبل الحفظ</Text>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}><Text style={styles.inputLabel}>الدهون %</Text><TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
            <View style={styles.inputWrap}><Text style={styles.inputLabel}>العضلات (كجم)</Text><TextInput style={styles.input} value={muscle} onChangeText={setMuscle} keyboardType="decimal-pad" /></View>
            <View style={styles.inputWrap}><Text style={styles.inputLabel}>الوزن (كجم)</Text><TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /></View>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ في السجل</Text>}
          </TouchableOpacity>
        </View>
      )}

      {inbodyRecords.length > 0 && !showForm && (
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>سجل القياسات السابقة <Ionicons name="calendar-outline" size={18} /></Text>
          {inbodyRecords.slice().reverse().map(record => {
            const d = new Date(record.record_date);
            return (
              <View key={record.id} style={styles.historyCard}>
                <View style={styles.historyDateBox}><Text style={styles.historyDay}>{d.getDate()}</Text><Text style={styles.historyMonth}>{ARABIC_MONTHS[d.getMonth()]}</Text></View>
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
  );
}
