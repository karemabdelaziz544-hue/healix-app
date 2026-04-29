import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../src/lib/supabase';
import { useFamily } from '../../src/context/FamilyContext';
import { useSubscriptionGuard } from '../../hooks/useSubscriptionGuard';
import NotificationBell from '../../components/NotificationBell';
import ExpiredState from '../../components/ExpiredState';
import Skeleton from '../../components/Skeleton';
import type { Plan, PlanTask } from '../../src/types';

const MOTIVATIONAL_QUOTES = [
  "🌟 يومك فاضي — جسمك بيشكرك على الراحة!",
  "💪 استعد ليوم جديد مليان طاقة",
  "🧘 خذ نفس عميق — الاستراحة جزء من النجاح",
  "✨ التطور بيحصل حتى وقت الراحة",
  "🔋 اشحن طاقتك لبكرة"
];

export default function DashboardScreen() {
  const { currentProfile } = useFamily();
  const userId = currentProfile?.id;
  const { isSubscribed, isGuardLoading } = useSubscriptionGuard();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [celebrated, setCelebrated] = useState(false);

  const userName = currentProfile?.full_name?.split(' ')[0] || 'يا بطل';

  const randomQuote = React.useMemo(() => {
    const index = Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24)) % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[index];
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data: planData } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planData) {
        setPlan(planData as Plan);
        
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

          const filtered = (allTasks as PlanTask[]).filter(t => {
            const name = t.day_name || "";
            if (currentDayNum === 1) return /اليوم\s*(الأول|1($|\D))/.test(name);
            return new RegExp(`(^|\\D)${currentDayNum}($|\\D)`).test(name);
          });          
          setTasks(filtered);
        }
      } else {
        setPlan(null);
        setTasks([]);
      }

      // حساب الـ Streak
      await calculateStreak();
    } catch (err) {
      console.log("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 🔥 حساب الـ Streak: عدد الأيام المتتالية اللي المستخدم أنجز كل مهامه فيها
  const calculateStreak = async () => {
    if (!userId) return;
    try {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('log_date, all_tasks_completed')
        .eq('user_id', userId)
        .order('log_date', { ascending: false })
        .limit(30);

      if (!logs || logs.length === 0) { setStreak(0); return; }

      let count = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < logs.length; i++) {
        const logDate = new Date(logs[i].log_date);
        logDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);

        // لو التاريخ مش متتالي أو المهام مش كاملة، وقف
        if (logDate.getTime() !== expectedDate.getTime() || !logs[i].all_tasks_completed) break;
        count++;
      }
      setStreak(count);
    } catch (err) {
      console.log("Error calculating streak:", err);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await fetchDashboardData();
    };
    loadInitialData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));

    // 🎯 Haptic Feedback عند التبديل
    await Haptics.impactAsync(
      newStatus ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );

    try {
      await supabase.from('plan_tasks').update({ is_completed: newStatus }).eq('id', taskId);
    } catch (err) {
      console.log("Error updating task:", err);
      fetchDashboardData();
    }
  };

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // 🎉 احتفال عند إتمام 100% من المهام
  useEffect(() => {
    if (progress === 100 && tasks.length > 0 && !celebrated) {
      setCelebrated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (progress < 100) {
      setCelebrated(false);
    }
  }, [progress, tasks.length]);

  // 🌟 Skeleton Loading State
  if (isGuardLoading || !currentProfile || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}>
          {/* هيدر وهمي */}
          <View style={styles.header}>
            <View style={{ alignItems: 'flex-end' }}>
              <Skeleton width={180} height={28} borderRadius={10} style={{ marginBottom: 8 }} />
              <Skeleton width={120} height={16} borderRadius={8} />
            </View>
            <Skeleton width={45} height={45} borderRadius={22.5} />
          </View>

          {/* كارت التقدم الوهمي */}
          <Skeleton width="100%" height={160} borderRadius={30} style={{ marginBottom: 30 }} />

          {/* عنوان المهام الوهمي */}
          <Skeleton width={130} height={24} borderRadius={10} style={{ marginBottom: 15, alignSelf: 'flex-end' }} />

          {/* لستة المهام الوهمية */}
          <Skeleton width="100%" height={85} borderRadius={25} style={{ marginBottom: 15 }} />
          <Skeleton width="100%" height={85} borderRadius={25} style={{ marginBottom: 15 }} />
          <Skeleton width="100%" height={85} borderRadius={25} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isSubscribed) {
    return <ExpiredState />;
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F97316', '#2A4B46']} tintColor="#2A4B46" />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>مرحباً يا {userName} 👋</Text>
            <Text style={styles.subGreeting}>أنت تتابع {tasks[0]?.day_name || 'يوم جديد'}</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
          </View>
        </View>

        {/* 🔥 Streak Counter */}
        {streak > 0 && (
          <View style={styles.streakCard}>
            <View style={styles.streakContent}>
              <View style={styles.streakTextBox}>
                <Text style={styles.streakLabel}>أيام متتالية 🔥</Text>
                <Text style={styles.streakSubLabel}>
                  {streak >= 7 ? 'أداء أسطوري! واصل 💪' : streak >= 3 ? 'ممتاز! استمر كده 🌟' : 'بداية قوية!'}
                </Text>
              </View>
              <View style={styles.streakNumBox}>
                <Text style={styles.streakNum}>{streak}</Text>
              </View>
            </View>
          </View>
        )}

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
          {/* رسالة تشجيعية عند الإنجاز الكامل */}
          {progress === 100 && tasks.length > 0 && (
            <View style={styles.celebrationBanner}>
              <Text style={styles.celebrationText}>🎉 عمل رائع! أنهيت كل مهام اليوم!</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionTitle}>جدول المهام</Text>
        
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TouchableOpacity 
              key={task.id} activeOpacity={0.8} onPress={() => toggleTask(task.id, task.is_completed)}
              style={[styles.taskCard, task.is_completed && styles.taskCardCompleted]}
            >
              <View style={styles.checkCircle}>
                {task.is_completed ? <Ionicons name="checkmark-circle" size={32} color="#2A4B46" /> : <Ionicons name="ellipse-outline" size={32} color="#D1D5DB" />}
              </View>
              <View style={styles.taskInfo}>
                <Text style={[styles.taskContent, task.is_completed && styles.textCompleted]}>{task.content}</Text>
                <View style={styles.taskTags}>
                  {task.is_completed && <Text style={styles.successTag}>تم بنجاح! ✅</Text>}
                  <Text style={styles.typeTag}>{task.task_type === 'workout' ? 'تمرين' : 'تغذية'}</Text>
                </View>
              </View>
              <View style={[styles.taskIconBox, task.is_completed ? { backgroundColor: '#E8F3F1' } : { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name={task.task_type === 'workout' ? "barbell" : "restaurant"} size={24} color={task.is_completed ? "#2A4B46" : "#6B7280"} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>لا يوجد مهام اليوم</Text>
            <Text style={styles.emptySub}>{randomQuote}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  scrollContent: { padding: 20 },
  
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  headerText: { alignItems: 'flex-end' },
  greeting: { fontSize: 24, fontWeight: '900', color: '#2A4B46' },
  subGreeting: { fontSize: 14, color: '#6B7280', marginTop: 4, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },

  // 🔥 Streak Counter Styles
  streakCard: { backgroundColor: '#FFF7ED', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: '#FFEDD5', elevation: 2 },
  streakContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  streakTextBox: { alignItems: 'flex-end', flex: 1 },
  streakLabel: { fontSize: 16, fontWeight: '900', color: '#EA580C' },
  streakSubLabel: { fontSize: 12, fontWeight: 'bold', color: '#F97316', marginTop: 3 },
  streakNumBox: { width: 55, height: 55, backgroundColor: '#F97316', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 15, elevation: 3 },
  streakNum: { fontSize: 26, fontWeight: '900', color: '#FFF' },
  
  progressCard: { backgroundColor: '#2A4B46', padding: 25, borderRadius: 30, marginBottom: 30, elevation: 5 },
  progressTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  progressPercent: { color: '#FFF', fontSize: 40, fontWeight: '900', textAlign: 'right', marginTop: 5 },
  progressBarBg: { height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, marginTop: 20, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#F97316', borderRadius: 5 },
  progressFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 15 },
  progressFooterText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' },
  celebrationBanner: { backgroundColor: 'rgba(249,115,22,0.2)', borderRadius: 12, padding: 10, marginTop: 15, alignItems: 'center' },
  celebrationText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

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