import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ExpiredState() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons name="lock-closed" size={60} color="#EF4444" />
      </View>
      <Text style={styles.title}>اشتراكك منتهي ⚠️</Text>
      <Text style={styles.subtitle}>
        عذراً، لا يمكنك الوصول لهذه الصفحة. يرجى تجديد اشتراكك لمتابعة رحلتك مع Healix.
      </Text>
      
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/profile')}>
        <Text style={styles.btnText}>الذهاب لحسابي للتجديد</Text>
        <Ionicons name="arrow-back" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0', padding: 30 },
  iconBox: { width: 100, height: 100, backgroundColor: '#FEE2E2', borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#1F2937', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 30, fontWeight: 'bold' },
  btn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#2A4B46', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 15, gap: 10, elevation: 2 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});