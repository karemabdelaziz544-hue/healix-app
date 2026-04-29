import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useFamily } from '../src/context/FamilyContext';
import type { AppNotification } from '../src/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const { currentProfile } = useFamily();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProfile?.id) {
      fetchNotifications();
      markAsRead();
    }
  }, [currentProfile?.id]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentProfile!.id)
      .order('created_at', { ascending: false });
    
    setNotifications(data || []);
    setLoading(false);
  };

  const markAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentProfile!.id)
      .eq('is_read', false);
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'plan': return <Ionicons name="document-text" size={24} color="#10B981" />;
      case 'chat': return <Ionicons name="chatbubbles" size={24} color="#3B82F6" />;
      case 'alert': return <Ionicons name="warning" size={24} color="#EF4444" />;
      default: return <Ionicons name="notifications" size={24} color="#F97316" />;
    }
  };

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {
      'اليوم': [],
      'أمس': [],
      'سابقاً': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifications.forEach(n => {
      const d = new Date(n.created_at);
      d.setHours(0, 0, 0, 0);

      if (d.getTime() === today.getTime()) {
        groups['اليوم'].push(n);
      } else if (d.getTime() === yesterday.getTime()) {
        groups['أمس'].push(n);
      } else {
        groups['سابقاً'].push(n);
      }
    });

    return [
      { title: 'اليوم', data: groups['اليوم'] },
      { title: 'أمس', data: groups['أمس'] },
      { title: 'سابقاً', data: groups['سابقاً'] }
    ].filter(g => g.data.length > 0);
  }, [notifications]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2A4B46" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإشعارات</Text>
        <View style={{ width: 40 }} />
      </View>

      <SectionList
        sections={groupedNotifications}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyText}>لا توجد إشعارات حالياً</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.notificationCard, item.is_read ? null : styles.unreadCard]}
            onPress={() => {
              if (item.link) {
                router.push(item.link as any);
              }
            }}
            disabled={!item.link}
          >
            <View style={styles.iconBox}>
              {renderIcon(item.type)}
            </View>
            <View style={styles.textContent}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
              <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {item.is_read ? null : <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFF' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
  listContent: { padding: 20 },
  notificationCard: { flexDirection: 'row-reverse', backgroundColor: '#FFF', padding: 15, borderRadius: 20, marginBottom: 15, elevation: 1, alignItems: 'center' },
  unreadCard: { backgroundColor: '#F0FDF4', borderColor: '#D1FAE5', borderWidth: 1 },
  iconBox: { width: 50, height: 50, backgroundColor: '#F3F4F6', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  textContent: { flex: 1, alignItems: 'flex-end' },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1F2937', marginBottom: 3 },
  message: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginBottom: 5 },
  time: { fontSize: 11, color: '#9CA3AF', fontWeight: 'bold' },
  unreadDot: { width: 10, height: 10, backgroundColor: '#10B981', borderRadius: 5, marginRight: 10 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#9CA3AF', fontWeight: 'bold', marginTop: 15 },
  sectionHeader: { fontSize: 16, fontWeight: '900', color: '#4B5563', textAlign: 'right', marginBottom: 10, marginTop: 5 },
});