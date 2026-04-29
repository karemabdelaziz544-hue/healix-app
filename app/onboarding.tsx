import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'تابع خطتك الصحية يومياً',
    description: 'خطتك مخصصة ليك 100%. التزم بمهامك اليومية وشوف تقدمك خطوة بخطوة.',
    icon: 'barbell',
    color: '#2A4B46'
  },
  {
    id: '2',
    title: 'تحدث مع طبيبك مباشرة',
    description: 'دعم فني وطبي معاك في أي وقت. أسأل واستشير فريق هيليكس بكل سهولة.',
    icon: 'chatbubbles',
    color: '#F97316'
  },
  {
    id: '3',
    title: 'سجل قياساتك وشوف تطورك',
    description: 'ارفع تحاليلك وصور الـ InBody وتابع رحلة نزول وزنك وبناء عضلاتك.',
    icon: 'analytics',
    color: '#3B82F6'
  }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      await AsyncStorage.setItem('has_seen_onboarding', 'true');
      router.replace('/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
      </View>
      
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon as any} size={80} color={item.color} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, currentIndex === index && styles.activeDot]} />
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleNext}>
          <Text style={styles.btnText}>{currentIndex === slides.length - 1 ? 'ابدأ رحلتك' : 'التالي'}</Text>
          <Ionicons name="arrow-back" size={20} color="#FFF" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { alignItems: 'center', marginTop: 20 },
  logo: { width: 60, height: 60, borderRadius: 15 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  iconBox: { width: 180, height: 180, borderRadius: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#1F2937', textAlign: 'center', marginBottom: 15 },
  description: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, fontWeight: 'bold' },
  footer: { padding: 30 },
  pagination: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D1D5DB', marginHorizontal: 5 },
  activeDot: { width: 25, backgroundColor: '#2A4B46' },
  btn: { backgroundColor: '#2A4B46', height: 55, borderRadius: 15, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});
