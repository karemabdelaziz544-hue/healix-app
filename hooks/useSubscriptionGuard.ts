import { useEffect, useState } from 'react';
import { useFamily } from '../src/context/FamilyContext';

export function useSubscriptionGuard() {
  const { currentProfile } = useFamily();
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [isGuardLoading, setIsGuardLoading] = useState(true);

  useEffect(() => {
    if (currentProfile) {
      // لو الحالة active يبقى مشترك، غير كده لأ
      setIsSubscribed(currentProfile.subscription_status === 'active');
    }
    setIsGuardLoading(false);
  }, [currentProfile]);

  return { isSubscribed, isGuardLoading };
}