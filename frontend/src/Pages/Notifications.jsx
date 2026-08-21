import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { respondToConsultationBooking } from '../services/consultationService';
import './Notifications.css';

const NOTIFICATION_ICONS = {
  sos_alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  chat_message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  article_like: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  ),
  article_comment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  consultation_request: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  ),
  consultation_response: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const TOGGLEABLE_TYPES = ['article_comment', 'comment_reply', 'article_like', 'article_favorite'];

export default function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [noticeMessage, setNoticeMessage] = useState('');

  // Modal từ chối lịch tham vấn
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        items.sort((a, b) => {
          const aTime = getDateValue(a.createdAt)?.getTime() ?? 0;
          const bTime = getDateValue(b.createdAt)?.getTime() ?? 0;
          return bTime - aTime;
        });
        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        console.error('Lỗi tải thông báo:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const getDateValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value?.toDate === 'function') {
      return value.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    return null;
  };

  const formatTime = (value) => {
    const date = getDateValue(value);
    if (!date) return '';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return '';
    }
  };

  const handleDelete = async (notificationId) => {
    if (!notificationId) return;
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('Lỗi xóa thông báo:', error);
    }
  };

  const handleOpenNotification = async (item) => {
    if (!item?.id) return;
    try {
      if (item.read === false) {
        await updateDoc(doc(db, 'notifications', item.id), { read: true });
      }
      if (item.targetUrl) {
        navigate(item.targetUrl);
      } else if (item.articleId) {
        navigate(`/articles/${item.articleId}`);
      } else if (item.type === 'consultation_request' || item.type === 'consultation_response') {
        navigate('/consultation');
      }
    } catch (error) {
      console.error('Lỗi mở thông báo:', error);
    }
  };

  // Xử lý Chấp nhận lịch tham vấn
  const handleAcceptConsultation = async (item, e) => {
    e.stopPropagation();
    if (!user || isSubmittingResponse) return;
    setIsSubmittingResponse(true);

    try {
      const consultationId = item.consultationId || item.relatedId;
      await respondToConsultationBooking({
        consultationId,
        notificationId: item.id,
        responseStatus: 'accepted',
        expertUser: user,
      });

      setNoticeMessage('✅ Đã chấp nhận yêu cầu tham vấn thành công!');
      setTimeout(() => setNoticeMessage(''), 4000);
    } catch (err) {
      console.error('Lỗi chấp nhận tham vấn:', err);
      alert('Có lỗi xảy ra: ' + (err.message || 'Không thể chấp nhận tham vấn.'));
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Mở modal từ chối tham vấn
  const handleOpenRejectModal = (item, e) => {
    e.stopPropagation();
    setRejectModalItem(item);
    setRejectReason('');
  };

  // Xử lý xác nhận Từ chối tham vấn
  const handleConfirmReject = async () => {
    if (!rejectModalItem || !user || isSubmittingResponse) return;
    setIsSubmittingResponse(true);

    try {
      const consultationId = rejectModalItem.consultationId || rejectModalItem.relatedId;
      await respondToConsultationBooking({
        consultationId,
        notificationId: rejectModalItem.id,
        responseStatus: 'rejected',
        expertUser: user,
        rejectReason: rejectReason.trim(),
      });

      setNoticeMessage('❌ Đã từ chối yêu cầu tham vấn.');
      setTimeout(() => setNoticeMessage(''), 4000);
      setRejectModalItem(null);
    } catch (err) {
      console.error('Lỗi từ chối tham vấn:', err);
      alert('Có lỗi xảy ra: ' + (err.message || 'Không thể từ chối tham vấn.'));
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const visibleNotifications = notifications.filter((item) => {
    if (item.type && TOGGLEABLE_TYPES.includes(item.type)) {
      const settings = user?.notificationSettings || {};
      if (settings[item.type] === false) {
        return false;
      }
    }

    if (filterMode === 'unread' && item.read !== false) return false;
    if (filterMode === 'read' && item.read === false) return false;

    if (searchQuery.trim() !== '') {
      const queryLower = searchQuery.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(queryLower);
      const messageMatch = item.message?.toLowerCase().includes(queryLower);
      return titleMatch || messageMatch;
    }
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="notifications-loading">
        <div className="notifications-wrapper">
          <header className="notifications-header">
            <h1 className="notifications-title">🔔 Thông báo</h1>
            <p className="notifications-subtitle">
              Theo dõi các cập nhật mới nhất về đặt lịch tham vấn, bài viết và tài khoản của bạn.
            </p>
          </header>
          <div className="notifications-card notifications-card--loading">
            <p>Đang tải thông báo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="notifications-wrapper">
        <header className="notifications-header">
          <h1 className="notifications-title">🔔 Thông báo</h1>
          <p className="notifications-subtitle">
            Theo dõi các cập nhật mới nhất về đặt lịch tham vấn, bài viết và tài khoản của bạn.
          </p>
        </header>

        <div className="notifications-stats">
          <div className="notifications-stat">
            <span className="notifications-stat-value">{notifications.length}</span>
            <span className="notifications-stat-label">Tổng thông báo</span>
          </div>
          <div className="notifications-stat notifications-stat--unread">
            <span className="notifications-stat-value">
              {notifications.filter((item) => item.read === false).length}
            </span>
            <span className="notifications-stat-label">Chưa đọc</span>
          </div>
          <div className="notifications-stat notifications-stat--read">
            <span className="notifications-stat-value">
              {notifications.filter((item) => item.read !== false).length}
            </span>
            <span className="notifications-stat-label">Đã đọc</span>
          </div>
        </div>

        <div className="notifications-toolbar">
          <div className="notifications-search">
            <svg className="notifications-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              className="notifications-search-input"
              placeholder="Tìm kiếm thông báo..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Tìm kiếm thông báo"
            />
          </div>
          <div className="notifications-filters">
            <button
              type="button"
              className={`notifications-filter${filterMode === 'all' ? ' notifications-filter--active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`notifications-filter${filterMode === 'unread' ? ' notifications-filter--active' : ''}`}
              onClick={() => setFilterMode('unread')}
            >
              Chưa đọc
            </button>
            <button
              type="button"
              className={`notifications-filter${filterMode === 'read' ? ' notifications-filter--active' : ''}`}
              onClick={() => setFilterMode('read')}
            >
              Đã đọc
            </button>
          </div>
        </div>

        {noticeMessage && (
          <div className="notifications-inline-banner" role="status">
            {noticeMessage}
          </div>
        )}

        <div className="notifications-card notifications-list-card">
          {visibleNotifications.length === 0 ? (
            <div className="notifications-empty">
              <p>Không có thông báo nào phù hợp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <ul className="notifications-list">
              {visibleNotifications.map((item) => {
                const isUnread = item.read === false;
                const isConsultationReq = item.type === 'consultation_request';
                const isConsultationResp = item.type === 'consultation_response';
                const isAlert = item.type === 'sos_alert';

                const iconType = isConsultationReq
                  ? 'consultation_request'
                  : isConsultationResp
                    ? 'consultation_response'
                    : item.type === 'chat_message'
                      ? 'chat_message'
                      : item.type === 'article_like' || item.type === 'article_comment' || item.type === 'article_favorite'
                        ? 'article_like'
                        : isAlert
                          ? 'sos_alert'
                          : item.type === 'admin' || item.title?.toLowerCase().includes('admin')
                            ? 'admin'
                            : 'default';

                const status = item.status || 'pending';

                return (
                  <li
                    key={item.id}
                    className={`notifications-item${isUnread ? ' notifications-item--unread' : ''}${isConsultationReq ? ' notifications-item--consultation' : ''}`}
                  >
                    <button
                      type="button"
                      className={`notifications-item-main${isUnread ? ' notifications-item-main--unread' : ''}`}
                      onClick={() => handleOpenNotification(item)}
                    >
                      <div className={`notifications-item-icon${isAlert ? ' notifications-item-icon--alert' : ''}${isConsultationReq ? ' notifications-item-icon--consultation' : ''}`}>
                        {NOTIFICATION_ICONS[iconType] || NOTIFICATION_ICONS.default}
                      </div>

                      <div className="notifications-item-body">
                        <div className="notifications-item-header">
                          <h3 className="notifications-item-title">{item.title || 'Thông báo mới'}</h3>
                          {isConsultationReq && (
                            <span className={`consultation-status-badge status-${status}`}>
                              {status === 'pending' && '⏳ Chờ xác nhận'}
                              {status === 'accepted' && '✅ Đã chấp nhận'}
                              {status === 'rejected' && '❌ Đã từ chối'}
                              {status === 'cancelled' && '🚫 Đã hủy'}
                            </span>
                          )}
                        </div>

                        <p className="notifications-item-message">{item.message || 'Không có nội dung'}</p>

                        {/* Thông tin chi tiết lịch tham vấn nếu có */}
                        {isConsultationReq && (
                          <div className="consultation-card-details">
                            <div className="detail-chip">
                              <span className="chip-label">👤 Người đặt:</span> {item.requesterName || 'Người dùng'}
                            </div>
                            <div className="detail-chip">
                              <span className="chip-label">📅 Ngày:</span> {item.date}
                            </div>
                            <div className="detail-chip">
                              <span className="chip-label">⏰ Khung giờ:</span> {item.timeSlot}
                            </div>
                            {item.topic && (
                              <div className="detail-chip">
                                <span className="chip-label">📌 Chủ đề:</span> {item.topic}
                              </div>
                            )}
                            {item.notes && (
                              <div className="detail-notes">
                                <span className="chip-label">📝 Ghi chú:</span> "{item.notes}"
                              </div>
                            )}

                            {/* HAI LỰA CHỌN CHẤP NHẬN HOẶC TỪ CHỐI DÀNH CHO CHUYÊN VIÊN */}
                            {status === 'pending' && (
                              <div className="consultation-action-buttons">
                                <button
                                  type="button"
                                  className="btn-consultation-accept"
                                  onClick={(e) => handleAcceptConsultation(item, e)}
                                  disabled={isSubmittingResponse}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Chấp nhận tham vấn
                                </button>
                                <button
                                  type="button"
                                  className="btn-consultation-reject"
                                  onClick={(e) => handleOpenRejectModal(item, e)}
                                  disabled={isSubmittingResponse}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                  Từ chối
                                </button>
                              </div>
                            )}

                            {status === 'accepted' && (
                              <div className="consultation-handled-notice accepted">
                                🎉 Bạn đã chấp nhận lịch tham vấn này.
                              </div>
                            )}

                            {status === 'rejected' && (
                              <div className="consultation-handled-notice rejected">
                                ❌ Bạn đã từ chối lịch tham vấn này.
                              </div>
                            )}
                          </div>
                        )}

                        {isConsultationResp && (
                          <div className="consultation-resp-actions">
                            <button
                              type="button"
                              className="btn-view-consultation"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/consultation');
                              }}
                            >
                              Xem trang đặt lịch tham vấn →
                            </button>
                          </div>
                        )}

                        {item.createdAt && (
                          <div className="notifications-item-footer">
                            <span className="notifications-item-time">{formatTime(item.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      className="notifications-item-delete"
                      onClick={() => handleDelete(item.id)}
                    >
                      Xóa
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Modal từ chối tham vấn */}
      {rejectModalItem && (
        <div className="reject-modal-overlay" onClick={() => setRejectModalItem(null)}>
          <div className="reject-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="reject-modal-title">Từ chối lịch tham vấn</h3>
            <p className="reject-modal-desc">
              Bạn đang từ chối lịch tham vấn của <strong>{rejectModalItem.requesterName}</strong> vào{' '}
              <strong>{rejectModalItem.timeSlot}</strong> ngày <strong>{rejectModalItem.date}</strong>.
            </p>
            <div className="reject-modal-field">
              <label htmlFor="reject-reason-input">Lý do từ chối (tùy chọn):</label>
              <textarea
                id="reject-reason-input"
                rows="3"
                placeholder="Nhập lý do hoặc lời nhắn đến người đặt lịch..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="reject-modal-actions">
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => setRejectModalItem(null)}
                disabled={isSubmittingResponse}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-confirm-reject"
                onClick={handleConfirmReject}
                disabled={isSubmittingResponse}
              >
                {isSubmittingResponse ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
