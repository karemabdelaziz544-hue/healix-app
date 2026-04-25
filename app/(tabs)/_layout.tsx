import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width - 40; 
// 👇 التعديل هنا: قسمنا على 5 لأن بقى عندنا 5 تابات بدل 4
const TAB_WIDTH = TAB_BAR_WIDTH / 5; 

function CustomTabBar({ state, descriptors, navigation }: any) {
  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'plan-details');
  const translateX = useRef(new Animated.Value(0)).current;
  const currentRouteName = state.routes[state.index].name;
  const activeIndex = visibleRoutes.findIndex((r: any) => r.name === currentRouteName);

  useEffect(() => {
    if (activeIndex !== -1) {
      Animated.spring(translateX, {
        toValue: activeIndex * TAB_WIDTH,
        useNativeDriver: true,
        bounciness: 12, 
        speed: 14,      
      }).start();
    }
  }, [activeIndex]);

  return (
    <View style={styles.tabBarContainer}>
      <Animated.View
        style={[
          styles.slidingIndicator,
          { transform: [{ translateX }] }
        ]}
      />

      {visibleRoutes.map((route: any, index: number) => {
        const isFocused = activeIndex === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // 👇 التعديل هنا: ضفنا الأيقونة بتاعة medical
        let iconName: any = 'home';
        if (route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
        if (route.name === 'chat') iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
        if (route.name === 'medical') iconName = isFocused ? 'pulse' : 'pulse-outline';
        if (route.name === 'history') iconName = isFocused ? 'time' : 'time-outline';
        if (route.name === 'profile') iconName = isFocused ? 'person' : 'person-outline';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={1} 
          >
            <Ionicons name={iconName} size={26} color={isFocused ? '#FFF' : '#9CA3AF'} />
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
      {/* 👇 التعديل هنا: تسجيل مسار medical */}
      <Tabs.Screen name="medical" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="plan-details" options={{ href: null }} />
    </Tabs>
  );
}

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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2A4B46',
    left: (TAB_WIDTH - 50) / 2, 
    zIndex: 0, 
    elevation: 8,
    shadowColor: '#2A4B46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});