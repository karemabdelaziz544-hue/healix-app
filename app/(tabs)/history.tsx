import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { useFamily } from '../../src/context/FamilyContext';
export default function HistoryScreen() {
const { currentProfile } = useFamily();
const currentUserId = currentProfile?.id;
  const router = useRouter();

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUserId) fetchHistory();
  }, [currentUserId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*, plan_tasks (count)') 
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.log('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRowMain}>
          <Ionicons name="time-outline" size={28} color="#F97316" />
          <Text style={styles.title}>أرشيف رحلتك</Text>
        </View>
        <Text style={styles.subtitle}>سجل كامل لجميع خططك الغذائية والتدريبية</Text>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2A4B46" />
          <Text style={styles.loadingText}>جاري تحميل الأرشيف...</Text>
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={60} color="#D1D5DB" />
          <Text style={styles.emptyText}>لا يوجد سجل تاريخي حتى الآن.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {plans.map((plan) => {
            const isCurrent = plan.status === 'active';
            const taskCount = plan.plan_tasks?.[0]?.count || 0;

            return (
              <TouchableOpacity 
                key={plan.id} 
                style={[styles.planCard, isCurrent && styles.currentPlanCard]}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/(tabs)/plan-details', params: { planId: plan.id } })} 
              >
                
                <View style={styles.cardLeft}>
                  <View style={[styles.taskCountBadge, isCurrent && styles.taskCountBadgeCurrent]}>
                    <Text style={[styles.taskCountText, isCurrent && styles.taskCountTextCurrent]}>{taskCount} مهمة</Text>
                  </View>
                  <Ionicons name="chevron-back" size={20} color={isCurrent ? "#F97316" : "#9CA3AF"} />
                </View>

                <View style={styles.cardRight}>
                  <View style={styles.titleRow}>
                    {isCurrent && (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>الحالية</Text>
                      </View>
                    )}
                    <Text style={[styles.planTitle, isCurrent && styles.planTitleCurrent]}>{plan.title || 'خطة بدون اسم'}</Text>
                  </View>
                  
                  <View style={styles.dateRow}>
                    <Text style={styles.dateText}>
                      {new Date(plan.created_at).toLocaleDateString('ar-EG')}
                    </Text>
                    <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                  </View>
                </View>

                <View style={[styles.iconBox, isCurrent && styles.iconBoxCurrent]}>
                  <Ionicons name="document-text" size={24} color={isCurrent ? "#F97316" : "#6B7280"} />
                </View>

              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 20, alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFF' },
  titleRowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 5 },
  title: { fontSize: 24, fontWeight: '900', color: '#2A4B46', marginLeft: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', fontWeight: 'bold' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#6B7280', fontWeight: 'bold' },
  emptyText: { marginTop: 15, color: '#9CA3AF', fontSize: 16, fontWeight: 'bold' },
  scrollContent: { padding: 15 },
  planCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 20, borderRadius: 20, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 1 },
  currentPlanCard: { borderColor: '#F97316', borderWidth: 1.5, elevation: 3, shadowColor: '#F97316', shadowOpacity: 0.1, shadowRadius: 10 },
  cardRight: { flex: 1, alignItems: 'flex-end', paddingRight: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  planTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginLeft: 8 },
  planTitleCurrent: { color: '#2A4B46' },
  activeTag: { backgroundColor: '#F97316', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  activeTagText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 12, color: '#9CA3AF', fontWeight: 'bold', marginRight: 5 },
  iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  iconBoxCurrent: { backgroundColor: '#FFF7ED' },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  taskCountBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 10 },
  taskCountBadgeCurrent: { backgroundColor: '#FFF7ED' },
  taskCountText: { fontSize: 12, fontWeight: 'bold', color: '#6B7280' },
  taskCountTextCurrent: { color: '#F97316' },
});