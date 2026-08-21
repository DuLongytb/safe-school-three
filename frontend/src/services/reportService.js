import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { updateReport as updateReportApi, deleteReport as deleteReportApi, getReports as getReportsApi } from '../api/admin';

export const REPORTS_COLLECTION = 'reports';

// Bảng đề mục chuẩn dùng chung duy nhất cho cả trang Báo Cáo (User) và Quản Lý Báo Cáo (Admin)
export const REPORT_CATEGORIES = [
  {
    id: 'bao-luc',
    label: 'Bạo lực học đường / Đánh nhau',
    shortLabel: 'Bạo lực học đường',
    icon: '👊',
    fullText: '👊 Bạo lực học đường / Đánh nhau',
  },
  {
    id: 'bat-nat-online',
    label: 'Bắt nạt trực tuyến (Cyberbullying)',
    shortLabel: 'Bắt nạt trực tuyến',
    icon: '🌐',
    fullText: '🌐 Bắt nạt trực tuyến (Cyberbullying)',
  },
  {
    id: 'quay-roi',
    label: 'Quấy rối / Đe dọa / Tống tiền',
    shortLabel: 'Quấy rối & Đe dọa',
    icon: '⚠️',
    fullText: '⚠️ Quấy rối / Đe dọa / Tống tiền',
  },
  {
    id: 'tam-ly',
    label: 'Khủng hoảng tâm lý / Cần trợ giúp',
    shortLabel: 'Khủng hoảng tâm lý',
    icon: '🧠',
    fullText: '🧠 Khủng hoảng tâm lý / Cần trợ giúp',
  },
  {
    id: 'cs-vat-chat',
    label: 'Cơ sở vật chất hư hỏng / Nguy hiểm',
    shortLabel: 'Cơ sở vật chất',
    icon: '🏫',
    fullText: '🏫 Cơ sở vật chất hư hỏng / Nguy hiểm',
  },
  {
    id: 'an-ninh',
    label: 'An ninh & Trật tự trường học',
    shortLabel: 'An ninh & Trật tự',
    icon: '🛡️',
    fullText: '🛡️ An ninh & Trật tự trường học',
  },
  {
    id: 'khac',
    label: 'Vấn đề khác',
    shortLabel: 'Vấn đề khác',
    icon: '📌',
    fullText: '📌 Vấn đề khác',
  },
];

// Helper to normalize category labels (đồng bộ theo đúng danh mục từ form Tạo báo cáo)
export const getCategoryLabel = (categoryOrType) => {
  if (!categoryOrType) return 'Chung';
  const val = String(categoryOrType).toLowerCase().trim();
  const matched = REPORT_CATEGORIES.find((c) => c.id === val);
  if (matched) return matched.fullText;
  if (val === 'bao-luc' || val.includes('bạo lực') || val === 'violence') return '👊 Bạo lực học đường / Đánh nhau';
  if (val === 'bat-nat-online' || val.includes('cyberbullying') || val.includes('mạng') || val.includes('trực tuyến')) return '🌐 Bắt nạt trực tuyến (Cyberbullying)';
  if (val === 'quay-roi' || val.includes('quấy rối') || val.includes('đe dọa') || val.includes('tống tiền')) return '⚠️ Quấy rối / Đe dọa / Tống tiền';
  if (val === 'tam-ly' || val.includes('tâm lý') || val.includes('tam-ly') || val.includes('khủng hoảng')) return '🧠 Khủng hoảng tâm lý / Cần trợ giúp';
  if (val === 'cs-vat-chat' || val.includes('vật chất') || val.includes('thiết bị')) return '🏫 Cơ sở vật chất hư hỏng / Nguy hiểm';
  if (val === 'an-ninh' || val.includes('an ninh') || val.includes('trật tự')) return '🛡️ An ninh & Trật tự trường học';
  if (val === 'khac' || val.includes('khác')) return '📌 Vấn đề khác';
  if (val.includes('sos') || val.includes('emergency')) return '🚨 SOS Khẩn cấp';
  return categoryOrType.charAt(0).toUpperCase() + categoryOrType.slice(1);
};

// Helper to normalize status
export const normalizeStatus = (status) => {
  if (!status) return 'pending';
  const s = String(status).toLowerCase().trim();
  if (s === 'mới' || s === 'pending' || s.includes('chưa xử lý') || s.includes('nguy cấp')) return 'pending';
  if (s === 'đang xử lý' || s === 'processing' || s.includes('tiến hành')) return 'processing';
  if (s === 'đã xử lý' || s === 'resolved' || s.includes('hoàn thành') || s.includes('đã giải quyết')) return 'resolved';
  return s;
};

// Helper to normalize priority
export const normalizePriority = (priority, type) => {
  const p = String(priority || '').toLowerCase().trim();
  const t = String(type || '').toLowerCase().trim();
  if (p === 'sos' || p === 'khẩn cấp' || t.includes('sos') || p === 'high' && t.includes('emergency')) return 'sos';
  if (p === 'cao' || p === 'high') return 'high';
  if (p === 'trung bình' || p === 'medium' || p === 'normal') return 'normal';
  if (p === 'thấp' || p === 'low') return 'low';
  return 'normal';
};

// Convert Firestore document to standardized report object
const transformReportDoc = (docSnap) => {
  const data = docSnap.data();
  const rawStatus = data.status || 'pending';
  const rawPriority = data.priority || 'normal';
  const rawType = data.type || data.category || 'chung';

  let createdAtIso = new Date().toISOString();
  if (data.createdAt) {
    if (typeof data.createdAt.toDate === 'function') {
      createdAtIso = data.createdAt.toDate().toISOString();
    } else if (data.createdAt.seconds) {
      createdAtIso = new Date(data.createdAt.seconds * 1000).toISOString();
    } else if (typeof data.createdAt === 'string') {
      createdAtIso = data.createdAt;
    }
  }

  let updatedAtIso = null;
  if (data.updatedAt) {
    if (typeof data.updatedAt.toDate === 'function') {
      updatedAtIso = data.updatedAt.toDate().toISOString();
    } else if (data.updatedAt.seconds) {
      updatedAtIso = new Date(data.updatedAt.seconds * 1000).toISOString();
    } else if (typeof data.updatedAt === 'string') {
      updatedAtIso = data.updatedAt;
    }
  }

  return {
    id: docSnap.id,
    title: data.title || (rawType === 'sos_emergency' ? '🚨 CẢNH BÁO SOS KHẨN CẤP' : 'Báo cáo sự cố'),
    description: data.description || data.content || data.noidung || '',
    category: data.category || data.type || 'chung',
    categoryLabel: data.categoryLabel || getCategoryLabel(data.category || data.type),
    sender: data.sender || data.user_name || data.reporterName || (data.is_anonymous || data.isAnonymous ? 'Người dùng ẩn danh' : (data.user_email || 'Học sinh')),
    senderEmail: data.user_email || data.senderEmail || (data.is_anonymous ? 'Ẩn danh' : ''),
    senderId: data.user_id || data.senderId || data.reporterId || '',
    isAnonymous: data.is_anonymous || data.isAnonymous || false,
    location: data.location || '',
    coordinates: data.coordinates || null,
    status: normalizeStatus(rawStatus),
    rawStatus: rawStatus,
    priority: normalizePriority(rawPriority, rawType),
    rawPriority: rawPriority,
    note: data.note || data.resolution || '',
    resolution: data.resolution || data.note || '',
    assignedTo: data.assignedTo || '',
    assignedToName: data.assignedToName || '',
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
};

/**
 * Subscribe to real-time reports stream from Firestore
 * @param {Function} onNext - Callback receiving sorted array of reports
 * @param {Function} onError - Error callback
 * @returns {Function} Unsubscribe function
 */
export const subscribeReportsService = (onNext, onError) => {
  const reportsRef = collection(db, REPORTS_COLLECTION);

  return onSnapshot(
    reportsRef,
    (snapshot) => {
      const reports = snapshot.docs.map(transformReportDoc);

      // Sort: SOS first, then newest createdAt
      reports.sort((a, b) => {
        if (a.priority === 'sos' && b.priority !== 'sos') return -1;
        if (b.priority === 'sos' && a.priority !== 'sos') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      onNext(reports);
    },
    (err) => {
      console.error('Lỗi khi lắng nghe dữ liệu Reports từ Firestore:', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Get all reports (one-time fetch)
 */
export const getReportsService = async () => {
  try {
    const reportsRef = collection(db, REPORTS_COLLECTION);
    const snap = await getDocs(reportsRef);
    const reports = snap.docs.map(transformReportDoc);

    reports.sort((a, b) => {
      if (a.priority === 'sos' && b.priority !== 'sos') return -1;
      if (b.priority === 'sos' && a.priority !== 'sos') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return reports;
  } catch (err) {
    console.warn('Firestore getDocs reports error, trying backend API fallback...', err);
    try {
      const res = await getReportsApi();
      if (res && res.data) return res.data;
    } catch (apiErr) {
      console.error('Backend API fallback also failed:', apiErr);
    }
    throw err;
  }
};

/**
 * Update report status, resolution notes, priority, or staff assignment
 */
export const updateReportService = async (reportId, payload) => {
  const docRef = doc(db, REPORTS_COLLECTION, reportId);
  const updateData = {
    ...payload,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(docRef, updateData);

  // Optional sync with backend API if available
  try {
    await updateReportApi(reportId, payload).catch(() => null);
  } catch (_) {
    // Ignore backend API failure if Firestore succeeded
  }

  return { id: reportId, ...updateData };
};

/**
 * Delete a report from Firestore
 */
export const deleteReportService = async (reportId) => {
  const docRef = doc(db, REPORTS_COLLECTION, reportId);
  await deleteDoc(docRef);

  // Optional sync with backend API if available
  try {
    await deleteReportApi(reportId).catch(() => null);
  } catch (_) {
    // Ignore backend API failure if Firestore succeeded
  }

  return true;
};

/**
 * Create a new user incident report
 */
export const createReportService = async (reportData, user) => {
  const isAnonymous = Boolean(reportData.isAnonymous);
  const senderName = isAnonymous
    ? 'Người dùng ẩn danh'
    : (user?.displayName || user?.email || 'Người dùng SafeSchool');
  const senderEmail = isAnonymous ? '' : (user?.email || '');

  const newReport = {
    userId: user?.uid || null,
    user_id: user?.uid || null,
    title: reportData.title.trim(),
    category: reportData.category || 'bao-luc',
    type: reportData.category || 'bao-luc',
    description: reportData.description.trim(),
    location: (reportData.location || '').trim(),
    priority: reportData.priority || 'normal',
    isAnonymous: isAnonymous,
    is_anonymous: isAnonymous,
    sender: senderName,
    senderEmail: senderEmail,
    status: 'pending',
    note: '',
    resolution: '',
    assignedTo: '',
    assignedToName: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, REPORTS_COLLECTION), newReport);
  return docRef.id;
};

/**
 * Subscribe to reports submitted by a specific user (Live status tracking)
 */
export const subscribeUserReportsService = (userId, onNext, onError) => {
  if (!userId) {
    if (onNext) onNext([]);
    return () => {};
  }

  const reportsRef = collection(db, REPORTS_COLLECTION);
  return onSnapshot(
    reportsRef,
    (snapshot) => {
      const userReports = snapshot.docs
        .map(transformReportDoc)
        .filter((r) => r.senderId === userId);

      userReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      onNext(userReports);
    },
    (err) => {
      console.error('Lỗi khi lắng nghe báo cáo của user:', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Get list of staff users (admin, teacher, expert, psychologist) for assignment
 */
export const getAssignableStaffService = async () => {
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocs(usersRef);
    const staff = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const role = String(data.role || '').toLowerCase();
      if (['admin', 'teacher', 'expert', 'psychologist', 'counselor', 'moderator'].includes(role)) {
        staff.push({
          uid: docSnap.id,
          displayName: data.displayName || data.DisplayName || data.email || 'Cán bộ quản trị',
          email: data.email || '',
          role: data.role || 'teacher',
        });
      }
    });

    return staff;
  } catch (err) {
    console.error('Lỗi khi lấy danh sách nhân sự phụ trách:', err);
    return [];
  }
};

