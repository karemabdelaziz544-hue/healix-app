import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// تعريف شكل بيانات البروفايل
export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  manager_id: string | null;
  subscription_status: string;
  subscription_end_date: string | null;
  gender?: string;
  birth_date?: string;
  weight?: number;
  height?: number;
}

interface FamilyContextType {
  currentProfile: Profile | null;
  familyMembers: Profile[];
  switchProfile: (profileId: string) => void;
  refreshFamily: () => void;
  loadingFamily: boolean;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

export const FamilyProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(true);

  const fetchFamily = async () => {
    if (!userId) {
      setCurrentProfile(null);
      setFamilyMembers([]);
      setLoadingFamily(false);
      return;
    }

    setLoadingFamily(true);
    try {
      // جلب الحساب الرئيسي وكل الحسابات اللي هو مديرها
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${userId},manager_id.eq.${userId}`);

      if (error) throw error;

      if (data) {
        const profilesData = data as Profile[];
        const manager = profilesData.find(p => p.id === userId);

        // توريث حالة الاشتراك من الحساب الرئيسي للفرعي
        const processedMembers = profilesData.map(member => {
          if (member.manager_id && manager) {
            const isManagerExpired = manager.subscription_status === 'expired';
            const isMemberExpired = member.subscription_status === 'expired';
            return {
              ...member,
              subscription_status: (isManagerExpired || isMemberExpired) ? 'expired' : 'active',
              subscription_end_date: manager.subscription_end_date,
            };
          }
          return member;
        });

        setFamilyMembers(processedMembers);

        // تعيين الحساب النشط (لو مفيش حساب نشط، اختار الأساسي)
        if (!currentProfile) {
          setCurrentProfile(processedMembers.find(p => p.id === userId) || processedMembers[0]);
        } else {
          // تحديث بيانات الحساب النشط حالياً لو حصل فيها تغيير
          const updatedCurrent = processedMembers.find(p => p.id === currentProfile.id);
          if (updatedCurrent) setCurrentProfile(updatedCurrent);
        }
      }
    } catch (err) {
      console.log("Error fetching family:", err);
    } finally {
      setLoadingFamily(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [userId]);

  // دالة التبديل بين الحسابات
  const switchProfile = (profileId: string) => {
    const profile = familyMembers.find(p => p.id === profileId);
    if (profile) setCurrentProfile(profile);
  };

  return (
    <FamilyContext.Provider value={{ currentProfile, familyMembers, switchProfile, refreshFamily: fetchFamily, loadingFamily }}>
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) throw new Error("useFamily must be used within a FamilyProvider");
  return context;
};