import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { createNotification } from './notificationService';

export const CONSULTATIONS_COLLECTION = 'consultations';

/**
 * Lấy danh sách tham vấn viên (role = 'counselor', 'counseler', 'psychologist', 'expert' - không lấy 'admin')
 */
export async function fetchExpertsList() {
  try {
    const usersRef = collection(db, 'users');
    const qExpert = query(usersRef, where('role', 'in', ['counselor', 'counseler', 'psychologist', 'expert']));
    const snap = await getDocs(qExpert);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tham vấn viên:', error);
    return [];
  }
}

/**
 * Đặt lịch tham vấn mới
 */
export async function createConsultationBooking({
  userId,
  userName,
  userEmail,
  date,
  timeSlot,
  topic = 'Tư vấn tâm lý chung',
  expertId = null,
  expertName = null,
  notes = '',
  contactMethod = 'Trực tuyến (Chat)'
}) {
  if (!userId || !date || !timeSlot) {
    throw new Error('Vui lòng cung cấp đầy đủ ngày và giờ tham vấn.');
  }

  // 1. Tạo document đặt lịch trong collection consultations
  const consultationData = {
    userId,
    userName: userName || 'Người dùng',
    userEmail: userEmail || '',
    date,
    timeSlot,
    topic,
    expertId: expertId || null,
    expertName: expertName || (expertId ? 'Chuyên viên' : 'Tất cả chuyên viên'),
    notes,
    contactMethod,
    status: 'pending', // 'pending' | 'accepted' | 'rejected' | 'cancelled'
    rejectReason: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, CONSULTATIONS_COLLECTION), consultationData);
  const consultationId = docRef.id;

  // 2. Tìm danh sách chuyên viên để gửi thông báo
  let targetExperts = [];
  if (expertId) {
    targetExperts = [expertId];
  } else {
    const experts = await fetchExpertsList();
    targetExperts = experts.map((e) => e.id);
  }

  // Nếu không tìm thấy chuyên viên cụ thể nào, fallback gửi cho các admin/expert mặc định
  if (targetExperts.length === 0) {
    console.warn('Không tìm thấy chuyên viên nào để gửi thông báo.');
  }

  // Formatted date for notification string display
  let formattedDateDisplay = date;
  try {
    const [y, m, d] = date.split('-');
    if (y && m && d) {
      formattedDateDisplay = `${d}/${m}/${y}`;
    }
  } catch (e) {
    // keep as is
  }

  // 3. Gửi thông báo đến từng chuyên viên
  for (const expertUid of targetExperts) {
    // tránh gửi cho chính người đặt nếu người đặt cũng là expert
    if (expertUid === userId && targetExperts.length > 1) continue;

    await createNotification({
      userId: expertUid,
      title: '📅 Yêu cầu đặt lịch tham vấn mới',
      message: `${userName} đặt lịch tham vấn vào ${timeSlot} ngày ${formattedDateDisplay}. Chủ đề: ${topic}`,
      type: 'consultation_request',
      relatedId: consultationId,
      relatedType: 'consultation',
      extraData: {
        consultationId,
        requesterId: userId,
        requesterName: userName,
        date: formattedDateDisplay,
        rawDate: date,
        timeSlot,
        topic,
        notes,
        contactMethod,
        status: 'pending'
      }
    });
  }

  return consultationId;
}

/**
 * Chuyên viên phản hồi lịch tham vấn (Chấp nhận hoặc Từ chối)
 */
export async function respondToConsultationBooking({
  consultationId,
  notificationId = null,
  responseStatus, // 'accepted' | 'rejected'
  expertUser,
  rejectReason = ''
}) {
  if (!consultationId || !responseStatus || !expertUser?.uid) {
    throw new Error('Thông tin phản hồi không hợp lệ.');
  }

  // 1. Cập nhật consultation doc
  const consultationRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);
  const consultationSnap = await getDoc(consultationRef);

  if (!consultationSnap.exists()) {
    throw new Error('Không tìm thấy yêu cầu đặt lịch tham vấn.');
  }

  const consultationData = consultationSnap.data();

  await updateDoc(consultationRef, {
    status: responseStatus,
    expertId: expertUser.uid,
    expertName: expertUser.displayName || 'Chuyên viên',
    rejectReason: responseStatus === 'rejected' ? rejectReason : '',
    updatedAt: serverTimestamp()
  });

  // 2. Cập nhật trạng thái thông báo của chuyên viên (nếu có notificationId)
  if (notificationId) {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        status: responseStatus,
        read: true
      });
    } catch (err) {
      console.error('Lỗi khi cập nhật thông báo của chuyên viên:', err);
    }
  }

  // Cập nhật tất cả notification liên quan đến consultationId này để các chuyên viên khác cũng thấy trạng thái đã xử lý
  try {
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('consultationId', '==', consultationId)
    );
    const notifsSnap = await getDocs(notifsQuery);
    for (const dSnap of notifsSnap.docs) {
      await updateDoc(doc(db, 'notifications', dSnap.id), {
        status: responseStatus,
        handledBy: expertUser.displayName || 'Chuyên viên'
      });
    }
  } catch (err) {
    console.error('Lỗi khi đồng bộ hóa thông báo chuyên viên:', err);
  }

  // 3. Gửi thông báo kết quả lại cho User đặt lịch
  const requesterId = consultationData.userId;
  const isAccepted = responseStatus === 'accepted';

  let formattedDateDisplay = consultationData.date;
  try {
    const [y, m, d] = consultationData.date.split('-');
    if (y && m && d) {
      formattedDateDisplay = `${d}/${m}/${y}`;
    }
  } catch (e) {
    // keep as is
  }

  const expertDisplayName = expertUser.displayName || 'Chuyên viên';

  await createNotification({
    userId: requesterId,
    title: isAccepted ? '✅ Lịch tham vấn đã được chấp nhận!' : '❌ Lịch tham vấn đã bị từ chối',
    message: isAccepted
      ? `Chuyên viên ${expertDisplayName} đã chấp nhận lịch tham vấn vào ${consultationData.timeSlot} ngày ${formattedDateDisplay}.`
      : `Chuyên viên ${expertDisplayName} đã từ chối lịch tham vấn vào ${consultationData.timeSlot} ngày ${formattedDateDisplay}.${rejectReason ? ` Lý do: ${rejectReason}` : ''}`,
    type: 'consultation_response',
    relatedId: consultationId,
    relatedType: 'consultation',
    extraData: {
      consultationId,
      status: responseStatus,
      expertId: expertUser.uid,
      expertName: expertDisplayName,
      targetUrl: '/consultation',
      rejectReason
    }
  });

  return true;
}

/**
 * Hủy yêu cầu tham vấn (dành cho người đặt)
 */
export async function cancelConsultationBooking(consultationId) {
  const consultationRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);
  await updateDoc(consultationRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp()
  });
}
