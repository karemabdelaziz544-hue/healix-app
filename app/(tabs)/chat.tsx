import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Keyboard, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../src/lib/supabase';
import { useFamily } from '../../src/context/FamilyContext';
import { useSubscriptionGuard } from '../../hooks/useSubscriptionGuard';
import ExpiredState from '../../components/ExpiredState';
import type { Message } from '../../src/types';

// 🌟 مُشغل المرفقات الداخلي (صور - فويس - ملفات)
const InlineAttachment = ({ path, type, isMe }: { path: string, type: string, isMe: boolean }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUrl = async () => {
      try {
        if (path.startsWith('http')) {
          if (isMounted) { setSignedUrl(path); setLoading(false); }
          return;
        }
        const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 604800);
        if (data && isMounted) setSignedUrl(data.signedUrl);
      } catch (e) {
        console.log(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchUrl();

    return () => {
      isMounted = false;
      if (sound) sound.unloadAsync(); 
    };
  }, [path, sound]);

  const toggleAudio = async () => {
    if (!signedUrl) return;
    try {
      // 🔥 إغلاق وضع التسجيل لتوجيه الصوت للسماعة الخارجية (Loudspeaker)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: signedUrl },
          { shouldPlay: true },
          (status: any) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
              newSound.setPositionAsync(0);
            } else if (!status.isLoaded && status.error) {
              Alert.alert('خطأ', 'لا يمكن تشغيل هذا الملف الصوتي.');
              setIsPlaying(false);
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (e) {
      console.log("Audio play error", e);
      Alert.alert('خطأ', 'تعذر تشغيل المقطع الصوتي، تأكد من اتصالك بالإنترنت.');
      setIsPlaying(false);
    }
  };

  if (loading) return <ActivityIndicator size="small" color={isMe ? "#FFF" : "#2A4B46"} style={{ marginTop: 10 }} />;
  if (!signedUrl) return null;

  if (type === 'image') {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(signedUrl)}>
        <Image source={{ uri: signedUrl }} style={styles.inlineImage} resizeMode="cover" />
      </TouchableOpacity>
    );
  }

  if (type === 'audio') {
    return (
      <View style={[styles.inlineAudioBox, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(42,75,70,0.05)' }]}>
        <TouchableOpacity onPress={toggleAudio} style={[styles.audioPlayBtn, { backgroundColor: isMe ? '#FFF' : '#2A4B46' }]}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={isMe ? "#2A4B46" : "#FFF"} style={{ marginLeft: isPlaying ? 0 : 4 }} />
        </TouchableOpacity>
        <Text style={[styles.audioText, { color: isMe ? '#FFF' : '#1F2937' }]}>
          {isPlaying ? "جاري التشغيل..." : "رسالة صوتية"}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={() => Linking.openURL(signedUrl)} style={[styles.inlineFileBox, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(42,75,70,0.05)' }]}>
      <Ionicons name="document-text" size={18} color={isMe ? "#FFF" : "#2A4B46"} />
      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isMe ? '#FFF' : '#2A4B46' }}>فتح الملف (PDF)</Text>
    </TouchableOpacity>
  );
};

// 🌟 الشاشة الرئيسية
export default function ChatScreen() {
  const { currentProfile } = useFamily();
  const currentUserId = currentProfile?.id;  
  const { isSubscribed, isGuardLoading } = useSubscriptionGuard();

  const [activeChannel, setActiveChannel] = useState<'doctor' | 'admin' | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{uri: string, name: string, mimeType: string} | null>(null);
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const kShow = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const kHide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { kShow.remove(); kHide.remove(); };
  }, []);

  useEffect(() => {
    if (!activeChannel || !receiverId || !currentUserId) return;
    const channelName = `chat_${activeChannel}_${currentUserId}`;
    channelRef.current = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === currentUserId && msg.receiver_id === receiverId) || (msg.sender_id === receiverId && msg.receiver_id === currentUserId)) {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }).subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [activeChannel, receiverId, currentUserId]);

  const openChat = async (type: 'doctor' | 'admin') => {
    setActiveChannel(type);
    setLoading(true);
    try {
      const { data: receiverData } = await supabase.from('profiles').select('id').eq('role', type).limit(1).single();
      if (receiverData && currentUserId) {
        setReceiverId(receiverData.id);
        const { data: messagesData } = await supabase.from('messages').select('*').eq('recipient_type', type)
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverData.id}),and(sender_id.eq.${receiverData.id},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true });
        if (messagesData) setMessages(messagesData as Message[]);
      }
    } catch (err) { console.log(err); } 
    finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
    }
  };

// 🔥 1. اختيار صورة من الاستوديو (Gallery)
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // صور فقط
        quality: 0.8, // ضغط الصورة شوية عشان الرفع يكون سريع
      });

      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        // استنتاج نوع ومسار الصورة
        const uriParts = file.uri.split('.');
        const fileExt = uriParts[uriParts.length - 1];
        
        setAttachment({ 
          uri: file.uri, 
          name: `photo_${Date.now()}.${fileExt}`, 
          mimeType: file.mimeType || `image/${fileExt}` 
        });
      }
    } catch (err) {
      Alert.alert('خطأ', 'لا يمكن الوصول للاستوديو');
    }
  };

  // 🔥 2. اختيار ملف من الجهاز (PDF, Word, etc)
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // السماح بكل أنواع الملفات
      });
      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        setAttachment({ 
          uri: file.uri, 
          name: file.name, 
          mimeType: file.mimeType || 'application/octet-stream' 
        });
      }
    } catch (err) {
      console.log(err);
    }
  };

  // 🔥 3. الدالة اللي بتظهر القائمة للمستخدم لما يضغط على زرار المرفقات
  const handleAttachmentClick = () => {
    Alert.alert(
      "إرفاق",
      "اختر نوع المرفق الذي تريد إرساله",
      [
        { text: "صورة من الاستوديو 🖼️", onPress: pickImage },
        { text: "ملف / مستند 📄", onPress: pickDocument },
        { text: "إلغاء", style: "cancel" }
      ]
    );
  };
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) { Alert.alert('خطأ', 'لا يمكن الوصول للميكروفون'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (uri) setAttachment({ uri, name: 'voice-message.m4a', mimeType: 'audio/m4a' });
  };

  const sendMessage = async () => {
    if (!receiverId || (!newMessage.trim() && !attachment) || !currentUserId) return;
    setUploading(true);
    let attachmentPath = null;
    let attachmentType = null;

    try {
      if (attachment) {
        const fileExt = attachment.name.split('.').pop() || 'file';
        const filePath = `${currentUserId}/${Date.now()}.${fileExt}`;
        
        const formData = new FormData();
        formData.append('file', {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.mimeType || 'application/octet-stream'
        } as any);

        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(filePath, formData);
        if (uploadError) throw uploadError;
        
        attachmentPath = filePath;
        attachmentType = attachment.mimeType.startsWith('image/') ? 'image' : attachment.mimeType.startsWith('audio/') ? 'audio' : 'file';
      }

      const { error } = await supabase.from('messages').insert([{
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: attachmentType === 'audio' ? '🎤 رسالة صوتية' : (newMessage || (attachmentType === 'image' ? '📷 صورة مرفقة' : '📎 ملف مرفق')),
        attachment_url: attachmentPath,
        attachment_type: attachmentType,
        recipient_type: activeChannel,
        is_read: false
      }]);

      if (error) throw error;
      setNewMessage('');
      setAttachment(null);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (err) {
      Alert.alert('خطأ', 'فشل الإرسال، حاول مرة أخرى');
    } finally { setUploading(false); }
  };

  if (isGuardLoading || !currentProfile) return <ActivityIndicator size="large" color="#2A4B46" style={{flex:1, marginTop: 50}} />;
if (!isSubscribed) {
    return <ExpiredState />;
  }
  if (!activeChannel) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>مركز المراسلات 💬</Text>
          <Text style={styles.selectionSub}>اختر الجهة التي ترغب في التواصل معها</Text>
        </View>
        <View style={styles.channelsContainer}>
          <TouchableOpacity style={styles.channelCard} onPress={() => openChat('doctor')}>
            <View style={styles.channelIconBox}><Ionicons name="chevron-back" size={24} color="#D1D5DB" /></View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>الكوتش الخاص</Text>
              <Text style={styles.channelDesc}>استفسارات التغذية والتدريب والمتابعة الطبية</Text>
            </View>
            <View style={[styles.mainIconBox, { backgroundColor: '#E8F3F1' }]}><Ionicons name="fitness" size={32} color="#2A4B46" /></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.channelCard} onPress={() => openChat('admin')}>
            <View style={styles.channelIconBox}><Ionicons name="chevron-back" size={24} color="#D1D5DB" /></View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>الدعم الإداري</Text>
              <Text style={styles.channelDesc}>مشاكل الاشتراك، المدفوعات، أو الأمور التقنية</Text>
            </View>
            <View style={[styles.mainIconBox, { backgroundColor: '#EBF4FF' }]}><Ionicons name="headset" size={32} color="#3B82F6" /></View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.chatContainer}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveChannel(null)} style={styles.backBtn}><Ionicons name="arrow-forward" size={24} color="#1F2937" /></TouchableOpacity>
          <View style={styles.headerTitleBox}><Text style={styles.chatHeaderTitle}>{activeChannel === 'doctor' ? 'الكوتش الطبي' : 'الدعم الفني'}</Text></View>
          <View style={[styles.headerAvatar, { backgroundColor: activeChannel === 'doctor' ? '#E8F3F1' : '#EBF4FF' }]}><Ionicons name={activeChannel === 'doctor' ? "fitness" : "headset"} size={20} color={activeChannel === 'doctor' ? "#2A4B46" : "#3B82F6"} /></View>
        </View>

        <ScrollView ref={scrollViewRef} style={styles.messagesArea} contentContainerStyle={{ padding: 15 }}>
          {loading ? <ActivityIndicator size="large" color="#2A4B46" style={{ marginTop: 50 }} /> : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <View key={index} style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                  <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    
                    {/* تأمين عرض النصوص */}
                    {msg.content ? (
                      <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {msg.content}
                      </Text>
                    ) : null}
                    
                    {/* عرض المرفقات */}
                    {msg.attachment_url ? (
                      <InlineAttachment path={msg.attachment_url} type={msg.attachment_type || 'file'} isMe={isMe} />
                    ) : null}

                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.inputArea, !isKeyboardVisible && { paddingBottom: Platform.OS === 'ios' ? 90 : 80 }]}>
          {attachment ? (
            <View style={styles.previewBox}>
              <Text numberOfLines={1} style={styles.previewText}>{attachment.name}</Text>
              <TouchableOpacity onPress={() => setAttachment(null)}><Ionicons name="close-circle" size={20} color="#EF4444" /></TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleAttachmentClick} disabled={uploading || !!recording}>
              <Ionicons name="attach" size={28} color="#6B7280" />
            </TouchableOpacity>
            
            <TextInput style={styles.textInput} placeholder="اكتب رسالتك..." value={newMessage} onChangeText={setNewMessage} multiline editable={!recording && !uploading} />

            {(newMessage.trim().length > 0 || attachment) ? (
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={20} color="#FFF" />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.micBtn, recording ? styles.recordingBtn : null]} onPress={recording ? stopRecording : startRecording}>
                <Ionicons name={recording ? "stop" : "mic"} size={24} color={recording ? "#FFF" : "#6B7280"} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0', padding: 20 },
  selectionHeader: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  selectionTitle: { fontSize: 28, fontWeight: '900', color: '#1F2937', marginBottom: 10 },
  selectionSub: { fontSize: 16, color: '#6B7280', fontWeight: 'bold' },
  channelsContainer: { gap: 20 },
  channelCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 20, borderRadius: 25, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  channelIconBox: { width: 40, alignItems: 'center' },
  channelInfo: { flex: 1, alignItems: 'flex-end', paddingRight: 15 },
  channelName: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  channelDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: 5 },
  mainIconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  chatContainer: { flex: 1, backgroundColor: '#F3F4F6' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', elevation: 2 },
  backBtn: { padding: 5 },
  headerTitleBox: { alignItems: 'flex-end', flex: 1, paddingRight: 15 },
  chatHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  headerAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  messagesArea: { flex: 1 },
  messageWrapper: { marginBottom: 15, flexDirection: 'row' },
  myMessageWrapper: { justifyContent: 'flex-start' }, 
  theirMessageWrapper: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '80%', padding: 15, borderRadius: 20 },
  myBubble: { backgroundColor: '#2A4B46', borderBottomLeftRadius: 5 },
  theirBubble: { backgroundColor: '#FFF', borderBottomRightRadius: 5, borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 15, lineHeight: 22 },
  myMessageText: { color: '#FFF' },
  theirMessageText: { color: '#1F2937' },
  
  inlineImage: { width: 220, height: 220, borderRadius: 15, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.1)' },
  inlineAudioBox: { flexDirection: 'row-reverse', alignItems: 'center', padding: 10, borderRadius: 15, marginTop: 10, minWidth: 180, alignSelf: 'flex-end' },
  audioPlayBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  audioText: { marginRight: 15, fontSize: 13, fontWeight: 'bold' },
  inlineFileBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 10, padding: 10, borderRadius: 10, alignSelf: 'flex-end' },

  inputArea: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'column' },
  previewBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#F3F4F6', margin: 10, borderRadius: 10 },
  previewText: { fontSize: 12, color: '#1F2937', flex: 1, textAlign: 'right', marginRight: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 15 },
  iconBtn: { padding: 5 },
  textInput: { flex: 1, backgroundColor: '#F3F4F6', minHeight: 45, maxHeight: 100, borderRadius: 25, paddingHorizontal: 15, paddingTop: 12, textAlign: 'right', fontSize: 15, marginHorizontal: 10 },
  sendBtn: { width: 45, height: 45, backgroundColor: '#2A4B46', borderRadius: 25, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '180deg' }] },
  micBtn: { padding: 5 },
  recordingBtn: { backgroundColor: '#EF4444', borderRadius: 25, padding: 10 },
});