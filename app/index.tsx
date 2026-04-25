import { Redirect } from 'expo-router';

export default function Index() {
  // أول ما الأبلكيشن يفتح، هيرميه أوتوماتيك على مسار اللوجين الصريح
  return <Redirect href="/login" />;
}