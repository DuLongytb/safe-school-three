import api from './axios';
import { db } from '../firebase/config';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';

/**
 * Lấy danh sách tất cả người dùng trong hệ thống (Chỉ Admin)
 */
export const getUsers = async () => {
  try {
    const res = await api.get('/api/admin/users').catch(() => null);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res;
    }
  } catch (_) {
    // API offline, fallback to Firestore
  }

  // Direct Firestore fetch
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  const users = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    const rawRole = data.role || 'student';
    const cleanRole = rawRole === 'anonymous' ? 'student' : rawRole;
    return {
      uid: docSnap.id,
      ...data,
      displayName: data.displayName || data.DisplayName || 'Chưa đặt tên',
      email: data.email || '',
      role: cleanRole,
      is_active: data.is_active ?? true,
      is_anonymous: Boolean(data.is_anonymous),
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt?.seconds
          ? new Date(data.createdAt.seconds * 1000).toISOString()
          : (data.createdAt || null)),
    };
  });

  return { data: users };
};

/**
 * Cập nhật thông tin người dùng (Khóa/Mở khóa, Đổi role)
 * @param {string} uid 
 * @param {Object} data { is_active: boolean, role: string, is_anonymous: boolean, reason: string }
 */
export const updateUser = async (uid, data) => {
  try {
    await api.put(`/api/admin/users/${uid}`, data).catch(() => null);
  } catch (_) {
    // API offline, fallback to Firestore
  }

  const userRef = doc(db, 'users', uid);
  const updatePayload = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(userRef, updatePayload);
  return { success: true, uid, ...updatePayload };
};

/**
 * Xóa vĩnh viễn tài khoản người dùng khỏi Firestore
 * @param {string} uid 
 * @param {string} reason
 */
export const deleteUser = async (uid, reason = '') => {
  try {
    await api.delete(`/api/admin/users/${uid}`, {
      params: { reason },
    }).catch(() => null);
  } catch (_) {
    // API offline, fallback to Firestore
  }

  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);

  // Optional: Log admin action
  try {
    await addDoc(collection(db, 'admin_logs'), {
      action: 'delete_user',
      targetUid: uid,
      reason: reason || 'Admin xóa tài khoản',
      timestamp: serverTimestamp(),
    }).catch(() => null);
  } catch (_) {}

  return { success: true, uid };
};

/**
 * Lấy danh sách bài viết trong hệ thống
 * @param {string} status 'all' | 'pending' | 'approved' | 'rejected'
 */
export const getPosts = async (status = 'all') => {
  try {
    const res = await api.get('/api/admin/posts', {
      params: { status }
    }).catch(() => null);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res;
    }
  } catch (_) {}

  const articlesRef = collection(db, 'articles');
  let q = query(articlesRef, where('isDeleted', '!=', true));
  if (status !== 'all') {
    q = query(articlesRef, where('isDeleted', '!=', true), where('status', '==', status));
  }

  const snap = await getDocs(q);
  const posts = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString()),
    };
  });

  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { data: posts };
};

/**
 * Duyệt hoặc từ chối bài viết
 * @param {string} postId 
 * @param {Object} data { status: 'approved' | 'rejected', reason: string }
 */
export const approvePost = async (postId, data) => {
  try {
    await api.put(`/api/admin/posts/${postId}`, data).catch(() => null);
  } catch (_) {}

  const postRef = doc(db, 'articles', postId);
  const updatePayload = {
    ...data,
    reviewedAt: serverTimestamp(),
  };
  await updateDoc(postRef, updatePayload);
  return { success: true, postId, ...updatePayload };
};

/**
 * Xóa vĩnh viễn bài viết (Chỉ Admin)
 * @param {string} postId 
 */
export const deletePost = async (postId) => {
  try {
    await api.delete(`/api/admin/posts/${postId}`).catch(() => null);
  } catch (_) {}

  const postRef = doc(db, 'articles', postId);
  await updateDoc(postRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
  });
  return { success: true, postId };
};

/**
 * Lấy danh sách báo cáo vi phạm/khẩn cấp
 * @param {string} status 'all' | 'pending' | 'processing' | 'resolved'
 * @param {string} priority 'all' | 'sos' | 'high' | 'normal' | 'low'
 */
export const getReports = async (status = 'all', priority = 'all') => {
  try {
    const res = await api.get('/api/admin/reports', {
      params: { status, priority }
    }).catch(() => null);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res;
    }
  } catch (_) {}

  const reportsRef = collection(db, 'reports');
  const snap = await getDocs(reportsRef);
  let reports = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      title: data.title || 'Báo cáo sự cố',
      status: data.status || 'pending',
      priority: data.priority || 'normal',
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString()),
    };
  });

  if (status !== 'all') {
    reports = reports.filter((r) => r.status === status);
  }
  if (priority !== 'all') {
    reports = reports.filter((r) => (r.priority || '').toLowerCase() === priority.toLowerCase());
  }

  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { data: reports };
};

/**
 * Cập nhật trạng thái báo cáo
 * @param {string} reportId 
 * @param {Object} data { status: 'processing' | 'resolved' | 'rejected', resolution: string }
 */
export const updateReport = async (reportId, data) => {
  try {
    await api.put(`/api/admin/reports/${reportId}`, data).catch(() => null);
  } catch (_) {}

  const reportRef = doc(db, 'reports', reportId);
  const updatePayload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(reportRef, updatePayload);
  return { success: true, reportId, ...updatePayload };
};

export const deleteReport = async (reportId) => {
  try {
    await api.delete(`/api/admin/reports/${reportId}`).catch(() => null);
  } catch (_) {}

  const reportRef = doc(db, 'reports', reportId);
  await deleteDoc(reportRef);
  return { success: true, reportId };
};

/**
 * Lấy dữ liệu thống kê tổng quan cho Dashboard
 */
export const getStatistics = async () => {
  try {
    const res = await api.get('/api/admin/statistics').catch(() => null);
    if (res && res.data) {
      return res;
    }
  } catch (_) {}

  const [usersSnap, postsSnap, reportsSnap] = await Promise.all([
    getDocs(collection(db, 'users')).catch(() => ({ size: 0, docs: [] })),
    getDocs(query(collection(db, 'articles'), where('isDeleted', '!=', true))).catch(() => ({ size: 0, docs: [] })),
    getDocs(collection(db, 'reports')).catch(() => ({ size: 0, docs: [] })),
  ]);

  const pendingPosts = postsSnap.docs.filter(
    (d) => (d.data().status || 'pending') === 'pending'
  ).length;

  const pendingReports = reportsSnap.docs.filter((d) => {
    const s = String(d.data().status || 'pending').toLowerCase();
    return s === 'pending' || s === 'mới' || s.includes('chưa xử lý');
  }).length;

  const sosReports = reportsSnap.docs.filter((d) => {
    const p = String(d.data().priority || '').toLowerCase();
    const t = String(d.data().type || '').toLowerCase();
    return p === 'sos' || p === 'khẩn cấp' || t.includes('sos');
  }).length;

  return {
    data: {
      users: usersSnap.size || 0,
      posts: postsSnap.size || 0,
      reports: reportsSnap.size || 0,
      pendingReports,
      pendingPosts,
      sosReports,
    },
  };
};
