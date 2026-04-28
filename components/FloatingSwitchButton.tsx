import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFamily } from '../src/context/FamilyContext';
import { useRouter } from 'expo-router';

export default function FloatingSwitchButton() {
  const { currentProfile, switchProfile } = useFamily();
  const router = useRouter();

  const isSubAccount = currentProfile?.manager_id !== null && currentProfile?.manager_id !== undefined;

  if (!isSubAccount) return null;

  const handleSwitchBack = async () => {
    if (currentProfile?.manager_id) {
      await switchProfile(currentProfile.manager_id);
      router.replace('/'); // إجبار التطبيق يروح للرئيسية
    }
  };

  return (
    <TouchableOpacity style={styles.fab} onPress={handleSwitchBack} activeOpacity={0.8}>
      <Ionicons name="log-out-outline" size={18} color="#FFF" />
      <Text style={styles.fabText}>خروج للحساب الأساسي</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 50, // 👈 رفعناه فوق خالص تحت الـ SafeArea
    left: 20, // 👈 حطيناه على الشمال عشان ميزعجش العين
    backgroundColor: 'rgba(42, 75, 70, 0.9)', // 👈 أخضر غامق شفاف شوية
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 9999,
    gap: 6,
  },
  fabText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  }
});