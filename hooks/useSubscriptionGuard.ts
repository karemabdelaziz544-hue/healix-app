import { useEffect, useState } from 'react';
import { useFamily } from '../src/context/FamilyContext';

export function useSubscriptionGuard() {
  const { currentProfile } = useFamily();
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [isGuardLoading, setIsGuardLoading] = useState(true);

  useEffect(() => {
    if (currentProfile) {
      const isStatusActive = currentProfile.subscription_status === 'active';

      // 🔥 التحقق من التاريخ: لو التاريخ موجود لازم يكون لسه مش عدى
      const isDateValid = !currentProfile.subscription_end_date || 
        new Date(currentProfile.subscription_end_date) > new Date();

      setIsSubscribed(isStatusActive && isDateValid);
    }
    setIsGuardLoading(false);
  }, [currentProfile]);

  return { isSubscribed, isGuardLoading };
}