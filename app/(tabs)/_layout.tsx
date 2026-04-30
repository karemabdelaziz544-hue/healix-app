import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamily } from '../../src/context/FamilyContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AppColors } from '../../constants/AppTheme';

const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width - 40;

// ✅ الـ labels النصية الظاهرة تحت الأيقونة المفعلة
const TAB_LABELS: Record<string, string> = {
  index: 'الرئيسية',
  chat: 'المحادثة',
  medical: 'الطبي',
  history: 'التاريخ',
  profile: 'الحساب',
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { currentProfile, switchProfile } = useFamily();
  const isSubAccount = currentProfile?.manager_id !== null && currentProfile?.manager_id !== undefined;

  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'plan-details');
  const TAB_WIDTH = TAB_BAR_WIDTH / visibleRoutes.length;
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
  }, [safeActiveIndex, TAB_WIDTH]);

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
              size={isFocused ? 24 : 26} 
              color={isFocused ? '#FFF' : (route.name === 'profile' && isSubAccount ? AppColors.accent : AppColors.tabInactive)} 
            />
            {/* ✅ Label نصي يظهر فقط تحت الأيقونة المفعلة */}
            {isFocused && (
              <Text style={styles.tabLabel}>
                {route.name === 'profile' && isSubAccount ? 'تبديل' : (TAB_LABELS[route.name] || '')}
              </Text>
            )}
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
    backgroundColor: AppColors.surface,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowColor: AppColors.primary,
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
  // ✅ Label صغير تحت الأيقونة المفعلة
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  slidingIndicator: {
    position: 'absolute',
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: AppColors.primary,
    // ✅ نستخدم alignSelf للتمركز الصحيح بدل left ثابت
    left: (TAB_BAR_WIDTH / 5 - INDICATOR_SIZE) / 2,
    zIndex: 0, 
    elevation: 8,
  },
});