import api from './axios';

/**
 * Lấy danh sách tất cả người dùng trong hệ thống (chỉ Admin)
 */
export const getUsers = async () => {
  return await api.get('/api/admin/users');
};

/**
 * Cập nhật thông tin người dùng (Khóa/Mở khóa, Đổi role)
 * @param {string} uid 
 * @param {Object} data { is_active: boolean, role: string, is_anonymous: boolean, reason: string }
 */
export const updateUser = async (uid, data) => {
  return await api.put(`/api/admin/users/${uid}`, data);
};

/**
 * Xóa vĩnh viễn tài khoản người dùng
 * @param {string} uid 
 */
export const deleteUser = async (uid, reason = '') => {
  return await api.delete(`/api/admin/users/${uid}`, {
    params: { reason },
  });
};


/**
 * Lấy danh sách bài viết trong hệ thống
 * @param {string} status 'all' | 'pending' | 'approved' | 'rejected'
 */
export const getPosts = async (status = 'all') => {
  return await api.get('/api/admin/posts', {
    params: { status }
  });
};

/**
 * Duyệt hoặc từ chối bài viết
 * @param {string} postId 
 * @param {Object} data { status: 'approved' | 'rejected', reason: string }
 */
export const approvePost = async (postId, data) => {
  return await api.put(`/api/admin/posts/${postId}`, data);
};

/**
 *Xóa vĩnh viễn bài viết (chỉ Admin)
 * @param {string} postId 
 */
export const deletePost = async (postId) => {
  return await api.delete(`/api/admin/posts/${postId}`);
};

/**
 * Lấy danh sách báo cáo vi phạm/khẩn cấp
 * @param {string} status 'all' | 'pending' | 'processing' | 'resolved'
 */
export const getReports = async (status = 'all', priority = 'all') => {
  return await api.get('/api/admin/reports', {
    params: { status, priority }
  });
};

/**
 * Cập nhật trạng thái báo cáo
 * @param {string} reportId 
 * @param {Object} data { status: 'processing' | 'resolved' | 'rejected', resolution: string }
 */
export const updateReport = async (reportId, data) => {
  return await api.put(`/api/admin/reports/${reportId}`, data);
};

export const deleteReport = async (reportId) => {
  return await api.delete(`/api/admin/reports/${reportId}`);
};

/**
 * Lấy dữ liệu thống kê tổng quan cho Dashboard
 */
export const getStatistics = async () => {
  return await api.get('/api/admin/statistics');
};
