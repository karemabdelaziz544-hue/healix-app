import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { FamilyProvider } from '../src/context/FamilyContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { usePushNotifications } from '../hooks/usePushNotifications';
import OfflineBanner from '../components/OfflineBanner';
// 🌟 1. مدير الإشعارات
function PushNotificationManager() {
  usePushNotifications();
  return null;
}

// 🌟 2. حارس التوجيه الذكي المُعدل (Auth Guard)
function AuthGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [isReady, setIsReady] = useState(false);

  // 👈 التأكد من جاهزية الـ Router قبل التوجيه
  useEffect(() => {
    if (navigationState?.key) {
      // ننتظر جزء صغير جداً من الثانية لضمان رسم الـ Layout بالكامل
      const timeout = setTimeout(() => setIsReady(true), 100); 
      return () => clearTimeout(timeout);
    }
  }, [navigationState?.key]);

  useEffect(() => {
    if (!isReady || isLoading) return; // لا تفعل شيء حتى ينتهي التحميل ويكون الـ Router جاهز تماماً

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isReady, isLoading]);

  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <FamilyProvider>
          <AuthGuard />
          <PushNotificationManager />
          
          <Stack screenOptions={{ headerShown: false }} />
          <OfflineBanner />
        </FamilyProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}