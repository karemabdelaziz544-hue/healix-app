import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useFamily } from '../../src/context/FamilyContext';
// ملاحظة: قمنا بتأجيل تسجيل الصوت والملفات للخطوة القادمة لنضمن استقرار الشات النصي أولاً

export default function ChatScreen() {
const { currentProfile } = useFamily();
const currentUserId = currentProfile?.id;  
  // هل نحن في شاشة الاختيار أم داخل شات معين؟
  const [activeChannel, setActiveChannel] = useState<'doctor' | 'admin' | null>(null);
  
  // حالة الشات
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // 1. فتح شات معين (دكتور أو أدمن) وجلب الرسائل
  const openChat = async (type: 'doctor' | 'admin') => {
    setActiveChannel(type);
    setLoading(true);

    try {
      // البحث عن ID الطبيب أو الأدمن من جدول profiles
      const { data: receiverData } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', type)
        .limit(1)
        .single();

      if (receiverData && currentUserId) {
        setReceiverId(receiverData.id);

        // جلب الرسائل السابقة
        const { data: messagesData } = await supabase
          .from('messages')
          .select('*')
          .eq('recipient_type', type)
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverData.id}),and(sender_id.eq.${receiverData.id},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true });

        if (messagesData) setMessages(messagesData);

        // الاشتراك في التحديثات اللحظية (Realtime)
        const channelName = `chat_${type}_${currentUserId}`;
        supabase.channel(channelName)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages'
          }, (payload) => {
            // لو الرسالة مبعوتة ليا أو مني في الشات ده، ضيفها
            const msg = payload.new;
            if (
              (msg.sender_id === currentUserId && msg.receiver_id === receiverData.id) ||
              (msg.sender_id === receiverData.id && msg.receiver_id === currentUserId)
            ) {
              setMessages(prev => [...prev, msg]);
            }
          }).subscribe();
      }
    } catch (err) {
      console.log("Error loading chat:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. إرسال رسالة نصية
  const sendMessage = async () => {
    if (!newMessage.trim() || !receiverId || !currentUserId) return;

    const messageText = newMessage;
    setNewMessage(''); // تفريغ الخانة بسرعة للإحساس بالاستجابة

    try {
      const { error } = await supabase.from('messages').insert([{
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: messageText,
        recipient_type: activeChannel,
        is_read: false
      }]);

      if (error) throw error;
      
      // التمرير للأسفل
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (err) {
      Alert.alert('خطأ', 'لم يتم إرسال الرسالة، تأكد من اتصالك بالإنترنت.');
      setNewMessage(messageText); // إرجاع النص إذا فشل الإرسال
    }
  };

  // ----------------------------------------------------
  // شاشة 1: اختيار الجهة (الطبيب أم الدعم)
  // ----------------------------------------------------
  if (!activeChannel) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>مركز المراسلات 💬</Text>
          <Text style={styles.selectionSub}>اختر الجهة التي ترغب في التواصل معها</Text>
        </View>

        <View style={styles.channelsContainer}>
          {/* كارت الكوتش */}
          <TouchableOpacity style={styles.channelCard} onPress={() => openChat('doctor')}>
            <View style={styles.channelIconBox}>
              <Ionicons name="chevron-back" size={24} color="#D1D5DB" />
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>الكوتش الخاص</Text>
              <Text style={styles.channelDesc}>استفسارات التغذية والتدريب والمتابعة الطبية</Text>
            </View>
            <View style={[styles.mainIconBox, { backgroundColor: '#E8F3F1' }]}>
              <Ionicons name="fitness" size={32} color="#2A4B46" />
            </View>
          </TouchableOpacity>

          {/* كارت الدعم الفني */}
          <TouchableOpacity style={styles.channelCard} onPress={() => openChat('admin')}>
            <View style={styles.channelIconBox}>
              <Ionicons name="chevron-back" size={24} color="#D1D5DB" />
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>الدعم الإداري</Text>
              <Text style={styles.channelDesc}>مشاكل الاشتراك، المدفوعات، أو الأمور التقنية</Text>
            </View>
            <View style={[styles.mainIconBox, { backgroundColor: '#EBF4FF' }]}>
              <Ionicons name="headset" size={32} color="#3B82F6" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>خصوصية البيانات <Ionicons name="shield-checkmark" size={16} /></Text>
          <Text style={styles.privacyText}>محادثاتك مع الكوتش سرية تماماً ولا يطلع عليها إلا الفريق الطبي المختص لضمان أفضل متابعة لحالتك.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // شاشة 2: نافذة الشات الفعلية
  // ----------------------------------------------------
  return (
    <SafeAreaView style={styles.chatContainer}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* هيدر الشات */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveChannel(null)} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.chatHeaderTitle}>{activeChannel === 'doctor' ? 'الكوتش الطبي' : 'الدعم الفني'}</Text>
            <Text style={styles.onlineStatus}>متصل الآن</Text>
          </View>
          <View style={[styles.headerAvatar, { backgroundColor: activeChannel === 'doctor' ? '#E8F3F1' : '#EBF4FF' }]}>
            <Ionicons name={activeChannel === 'doctor' ? "fitness" : "headset"} size={20} color={activeChannel === 'doctor' ? "#2A4B46" : "#3B82F6"} />
          </View>
        </View>

        {/* منطقة الرسائل */}
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.messagesArea} 
          contentContainerStyle={{ padding: 15 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#2A4B46" style={{ marginTop: 50 }} />
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <View key={index} style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                  <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                      {msg.content}
                    </Text>
                    {/* هنا سيتم إضافة زر عرض المرفقات لاحقاً */}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* منطقة الإدخال (الكيبورد) */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="attach" size={28} color="#6B7280" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            placeholder="اكتب رسالتك..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />

          {newMessage.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn}>
              <Ionicons name="mic" size={24} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // تنسيقات شاشة الاختيار
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
  privacyBox: { marginTop: 40, backgroundColor: '#FFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed' },
  privacyTitle: { fontSize: 14, fontWeight: 'bold', color: '#9CA3AF', textAlign: 'right', marginBottom: 5 },
  privacyText: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', lineHeight: 20 },

  // تنسيقات نافذة الشات
  chatContainer: { flex: 1, backgroundColor: '#F3F4F6' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', elevation: 2 },
  backBtn: { padding: 5 },
  headerTitleBox: { alignItems: 'flex-end', flex: 1, paddingRight: 15 },
  chatHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  onlineStatus: { fontSize: 12, color: '#10B981', fontWeight: 'bold' },
  headerAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  messagesArea: { flex: 1 },
  messageWrapper: { marginBottom: 15, flexDirection: 'row' },
  myMessageWrapper: { justifyContent: 'flex-start' }, // في الموبايل العربي، رسائلي على اليسار أو اليمين حسب الرغبة (عملناها يسار لتشبه واتساب عربي)
  theirMessageWrapper: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '80%', padding: 15, borderRadius: 20 },
  myBubble: { backgroundColor: '#2A4B46', borderBottomLeftRadius: 5 },
  theirBubble: { backgroundColor: '#FFF', borderBottomRightRadius: 5, borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 15, lineHeight: 22 },
  myMessageText: { color: '#FFF' },
  theirMessageText: { color: '#1F2937' },

  inputArea: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 10, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  iconBtn: { padding: 5 },
  textInput: { flex: 1, backgroundColor: '#F3F4F6', minHeight: 45, maxHeight: 100, borderRadius: 25, paddingHorizontal: 15, paddingTop: 12, textAlign: 'right', fontSize: 15, marginHorizontal: 10 },
  sendBtn: { width: 45, height: 45, backgroundColor: '#2A4B46', borderRadius: 25, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '180deg' }] }, // لفة السهم ليتوافق مع العربي
  micBtn: { padding: 5 },
});