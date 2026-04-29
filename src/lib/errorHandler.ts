import { Alert } from 'react-native';

/**
 * Global Error Handler
 * Unified way to handle and report errors across the app.
 */
export function handleError(error: unknown, context: string = 'App') {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'حدث خطأ غير متوقع';
  
  console.error(`[Healix Error] [${context}]`, error);
  
  // Future: Sentry.captureException(error)
  
  Alert.alert('عذراً', message);
}
