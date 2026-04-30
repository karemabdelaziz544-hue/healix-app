import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../../components/AppToast';
import { MedicalTabProps } from './medical.types';
import { medicalStyles as styles } from './medicalStyles';
import type { ClientDocument } from '../../types';

interface DocumentsTabProps extends MedicalTabProps {
  docs: ClientDocument[];
  onRefresh: () => Promise<void>;
}

export default function DocumentsTab({ userId, docs, uploading, setUploading, onRefresh }: DocumentsTabProps) {
  
  const handleDocUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);
        const file = result.assets[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('client_documents').upload(fileName, file as any);
        if (uploadError) throw uploadError;
        await supabase.from('client_documents').insert({
          user_id: userId,
          file_name: file.name,
          file_url: fileName,
          file_type: fileExt,
        });
        await onRefresh();
        showToast.success('تم رفع الملف بنجاح');
      }
    } catch (err) {
      console.log(err);
      showToast.error('فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (pathOrUrl: string) => {
    try {
      const { data } = await supabase.storage.from('client_documents').createSignedUrl(pathOrUrl, 3600);
      if (data?.signedUrl) Linking.openURL(data.signedUrl);
    } catch (err) {
      showToast.error('لا يمكن فتح الملف');
    }
  };

  return (
    <View style={styles.fadeContainer}>
      <TouchableOpacity style={styles.uploadDocBtn} onPress={handleDocUpload} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator size="large" color="#2A4B46" />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={48} color="#2A4B46" />
            <Text style={styles.uploadDocTitle}>اضغط لرفع ملف جديد</Text>
            <Text style={styles.uploadDocSub}>صور تحاليل، روشتة، أو أي مستند طبي</Text>
          </>
        )}
      </TouchableOpacity>
      <View style={styles.docsList}>
        {docs.length === 0 ? (
          <Text style={styles.emptyText}>لا يوجد مستندات مرفوعة</Text>
        ) : (
          docs.map(doc => (
            <View key={doc.id} style={styles.docCard}>
              <TouchableOpacity style={styles.viewDocBtn} onPress={() => handleViewDocument(doc.file_url)}>
                <Text style={styles.viewDocBtnText}>عرض</Text>
              </TouchableOpacity>
              <View style={styles.docInfo}>
                <Text style={styles.docName} numberOfLines={1}>{doc.file_name}</Text>
                <Text style={styles.docDate}>{new Date(doc.created_at).toLocaleDateString('ar-EG')}</Text>
              </View>
              <View style={styles.docIconBox}>
                <Ionicons name="document-text" size={24} color="#3B82F6" />
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
