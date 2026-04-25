import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
// تم الإبقاء على useAuth فقط إذا كنت تحتاجه في مكان آخر، لكن الاعتماد الكلي أصبح على useFamily
import { useAuth } from '../../src/context/AuthContext'; 
import { useFamily } from '../../src/context/FamilyContext';

export default function DashboardScreen() {
  const { currentProfile } = useFamily();
  const userId = currentProfile?.id;
  
  const [plan, setPlan] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // استخراج الاسم الأول من البروفايل الحالي النشط (سواء رئيسي أو تابع)
  const userName = currentProfile?.full_name?.split(' ')[0] || 'يا بطل';

  const fetchDashboardData = useCallback(async () => {
    // التعديل: الاعتماد على userId (المستخرج من currentProfile)
    if (!userId) return;
    setLoading(true);

    try {
      // 1. نجيب الخطة الأساسية بناءً على المعرف الحالي
      const { data: planData } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId) // التعديل هنا
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planData) {
        setPlan(planData);
        
        // 2. نجيب المهام المرتبطة بالخطة دي
        const { data: allTasks } = await supabase
          .from('plan_tasks')
          .select('*')
          .eq('plan_id', planData.id)
          .order('order_index', { ascending: true });

        if (allTasks && allTasks.length > 0) {
          const startDate = new Date(planData.start_date || planData.created_at);
          const today = new Date();
          startDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          const currentDayNum = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1;

          const filtered = allTasks.filter(t => {
            const name = t.day_name || "";
            if (currentDayNum === 1) return name.includes("الأول") || name.includes("1");
            return name.includes(String(currentDayNum));
          });
          
          setTasks(filtered);
        }
      } else {
        // لو مفيش خطة للحساب ده بنصفر الداتا
        setPlan(null);
        setTasks([]);
      }
    } catch (err) {
      console.log("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]); // التعديل هنا: التحديث يعتمد على userId

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));

    try {
      await supabase.from('plan_tasks').update({ is_completed: newStatus }).eq('id', taskId);
    } catch (err) {
      console.log("Error updating task:", err);
      fetchDashboardData();
    }
  };

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // التعديل: التحقق من وجود البروفايل
  if (!currentProfile || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2A4B46" />
        <Text style={{ marginTop: 10, color: '#2A4B46', fontWeight: 'bold' }}>
          {loading ? 'جاري تجهيز خطة اليوم...' : 'جاري التحميل...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={fetchDashboardData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={24} color="#2A4B46" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            {/* التعديل: عرض اسم البروفايل الحالي */}
            <Text style={styles.greeting}>أهلاً بك، {userName}!</Text>
            <Text style={styles.subGreeting}>أنت الآن تتابع {tasks[0]?.day_name || 'يوم جديد'}</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>تقدمك اليوم</Text>
          <Text style={styles.progressPercent}>{progress}%</Text>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.progressFooter}>
            <Text style={styles.progressFooterText}>{completedCount} من {tasks.length} مهام</Text>
            <Text style={styles.progressFooterText}>النظام: {plan?.title || 'لا يوجد نظام نشط حالياً'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>جدول المهام</Text>
        
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TouchableOpacity 
              key={task.id}
              activeOpacity={0.8}
              onPress={() => toggleTask(task.id, task.is_completed)}
              style={[styles.taskCard, task.is_completed && styles.taskCardCompleted]}
            >
              <View style={styles.checkCircle}>
                {task.is_completed ? (
                  <Ionicons name="checkmark-circle" size={32} color="#2A4B46" />
                ) : (
                  <Ionicons name="ellipse-outline" size={32} color="#D1D5DB" />
                )}
              </View>

              <View style={styles.taskInfo}>
                <Text style={[styles.taskContent, task.is_completed && styles.textCompleted]}>
                  {task.content}
                </Text>
                <View style={styles.taskTags}>
                  {task.is_completed && <Text style={styles.successTag}>تم بنجاح! ✅</Text>}
                  <Text style={styles.typeTag}>
                    {task.task_type === 'workout' ? 'تمرين' : 'تغذية'}
                  </Text>
                </View>
              </View>

              <View style={[styles.taskIconBox, task.is_completed ? { backgroundColor: '#E8F3F1' } : { backgroundColor: '#F3F4F6' }]}>
                <Ionicons 
                  name={task.task_type === 'workout' ? "barbell" : "restaurant"} 
                  size={24} 
                  color={task.is_completed ? "#2A4B46" : "#6B7280"} 
                />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>لا يوجد مهام اليوم</Text>
            <Text style={styles.emptySub}>استرح قليلاً، غداً نواصل العمل.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' },
  scrollContent: { padding: 20, paddingBottom: 100 }, // ضفنا مساحة تحت عشان الشريط العائم
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  refreshBtn: { padding: 10, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
  headerText: { alignItems: 'flex-end' },
  greeting: { fontSize: 24, fontWeight: '900', color: '#1F2937' },
  subGreeting: { fontSize: 14, color: '#6B7280', marginTop: 4, fontWeight: 'bold' },
  
  progressCard: { backgroundColor: '#2A4B46', padding: 25, borderRadius: 30, marginBottom: 30, elevation: 5 },
  progressTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  progressPercent: { color: '#FFF', fontSize: 40, fontWeight: '900', textAlign: 'right', marginTop: 5 },
  progressBarBg: { height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, marginTop: 20, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#F97316', borderRadius: 5 },
  progressFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 15 },
  progressFooterText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' },

  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1F2937', textAlign: 'right', marginBottom: 15 },
  
  taskCard: { flexDirection: 'row-reverse', backgroundColor: '#FFF', padding: 18, borderRadius: 25, marginBottom: 15, alignItems: 'center', borderWidth: 2, borderColor: '#F3F4F6', elevation: 1 },
  taskCardCompleted: { backgroundColor: '#F0FDF4', borderColor: 'rgba(42, 75, 70, 0.2)' },
  
  checkCircle: { marginRight: 0, marginLeft: 15 },
  
  taskInfo: { flex: 1, alignItems: 'flex-end' },
  taskContent: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', textAlign: 'right', lineHeight: 24 },
  textCompleted: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  
  taskTags: { flexDirection: 'row-reverse', marginTop: 8, gap: 8 },
  typeTag: { backgroundColor: '#F3F4F6', color: '#6B7280', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: 'bold' },
  successTag: { backgroundColor: '#DEF7EC', color: '#03543F', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: 'bold' },

  taskIconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },

  emptyState: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', padding: 40, borderRadius: 30, borderWidth: 2, borderColor: '#F3F4F6', borderStyle: 'dashed', marginTop: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#9CA3AF', marginTop: 15 },
  emptySub: { fontSize: 14, color: '#D1D5DB', marginTop: 5, fontWeight: 'bold' }
});