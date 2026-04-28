import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamily } from '../../src/context/FamilyContext';

const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width - 40; 
const TAB_WIDTH = TAB_BAR_WIDTH / 5; // ثابت على 5 تابات للحفاظ على التوازن

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { currentProfile, switchProfile } = useFamily();
  const isSubAccount = currentProfile?.manager_id !== null && currentProfile?.manager_id !== undefined;

  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'plan-details');
  const translateX = useRef(new Animated.Value(0)).current;
  const currentRouteName = state.routes[state.index].name;
  
  const activeIndex = visibleRoutes.findIndex((r: any) => r.name === currentRouteName);
  // 🛡️ حماية الأنيميشن: لو الصفحة مخفية نثبت المؤشر على الرئيسية
  const safeActiveIndex = activeIndex !== -1 ? activeIndex : 0; 

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: safeActiveIndex * TAB_WIDTH,
      useNativeDriver: true,
      bounciness: 12, 
      speed: 14,      
    }).start();
  }, [safeActiveIndex]);

  const handleSwitchBack = async () => {
    if (currentProfile?.manager_id) {
      await switchProfile(currentProfile.manager_id);
    }
  };

  return (
    <View style={styles.tabBarContainer}>
      <Animated.View
        style={[
          styles.slidingIndicator,
          { transform: [{ translateX }] }
        ]}
      />

      {visibleRoutes.map((route: any, index: number) => {
        const isFocused = safeActiveIndex === index;

        const onPress = () => {
          // لو الحساب فرعي وضغط على أيقونة البروفايل، نفذ التبديل بدل التنقل
          if (route.name === 'profile' && isSubAccount) {
            handleSwitchBack();
          } else {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }
        };

        let iconName: any = 'home';
        if (route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
        if (route.name === 'chat') iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
        if (route.name === 'medical') iconName = isFocused ? 'pulse' : 'pulse-outline';
        if (route.name === 'history') iconName = isFocused ? 'time' : 'time-outline';
        
        // 🎨 أيقونة البروفايل الديناميكية
        if (route.name === 'profile') {
          if (isSubAccount) {
            iconName = 'swap-horizontal-outline'; // أيقونة التبديل للحساب الفرعي
          } else {
            iconName = isFocused ? 'person' : 'person-outline';
          }
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={1} 
          >
            <Ionicons 
              name={iconName} 
              size={26} 
              color={isFocused ? '#FFF' : (route.name === 'profile' && isSubAccount ? '#F97316' : '#9CA3AF')} 
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="medical" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="plan-details" options={{ href: null }} />
    </Tabs>
  );
}

const INDICATOR_SIZE = 50;

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#2A4B46',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1, 
  },
  slidingIndicator: {
    position: 'absolute',
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: '#2A4B46',
    // حساب ديناميكي: المركز = (عرض التاب - عرض المؤشر) / 2
    left: (TAB_WIDTH - INDICATOR_SIZE) / 2, 
    zIndex: 0, 
    elevation: 8,
  },
});