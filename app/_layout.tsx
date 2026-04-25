import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { FamilyProvider } from '../src/context/FamilyContext';

function InitialLayout() {
  const { session } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState(); 

  useEffect(() => {
    if (!navigationState?.key) return;
    const isAuthPage = segments[0] === 'login' || segments[0] === 'signup';

    const routingTimer = setTimeout(() => {
      if (session && isAuthPage) {
        router.replace('/(tabs)');
      } else if (!session && !isAuthPage) {
        router.replace('/login');
      }
    }, 10); 

    return () => clearTimeout(routingTimer);
  }, [session, segments, navigationState?.key]); 

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="subscriptions" /> 
      <Stack.Screen name="family" /> 
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <InitialLayout />
      </FamilyProvider>
    </AuthProvider>
  );
}