import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import { db } from './firebase/config';

// User Pages
import Home from './Pages/Home';
import News from './Pages/News';
import CreatePost from './Pages/CreatePost';
import Report from './Pages/Report';
import Profile from './Pages/Profile';
import Chat from './Pages/Chat';
import Login from './Pages/Login';
import Register from './Pages/Register';
import SOS from "./Pages/SOS";

// Admin Layout & Pages
import AdminLayout from './components/Layout/AdminLayout';
import Dashboard from './Pages/admin/Dashboard';
import ManageUsers from './Pages/admin/ManageUsers';
import ManagePosts from './Pages/admin/ManagePosts';
import ManageReports from './Pages/admin/ManageReports';
import ManageChat from './Pages/admin/ManageChat';
import './Pages/Notifications.css';

const NOTIFICATION_ICONS = {
  sos_alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  chat_message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  article_like: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  ),
  article_comment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  article_favorite: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const NO_CHROME_ROUTES = ['/register', '/login'];

function NotificationsPlaceholder() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [noticeMessage, setNoticeMessage] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('user_id', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => {
        const aTime = getDateValue(a.createdAt)?.getTime() ?? 0;
        const bTime = getDateValue(b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      });
      setNotifications(items);
      setLoading(false);
    }, (error) => {
      console.error('Lỗi tải thông báo:', error);
      setLoading(false);
    });

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

  // Hàm xử lý khi bấm mở thông báo (Đã được bổ sung)
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
      }
    } catch (error) {
      console.error('Lỗi mở thông báo:', error);
    }
  };

  const TOGGLEABLE_TYPES = ['article_comment', 'comment_reply', 'article_like', 'article_favorite'];

  // Đã lọc danh sách thông báo theo Cài đặt người dùng + Bộ lọc Read/Unread + Từ khóa tìm kiếm
  const visibleNotifications = notifications.filter((item) => {
    // 1. Kiểm tra cài đặt nhận thông báo của user
    if (item.type && TOGGLEABLE_TYPES.includes(item.type)) {
      const settings = user?.notificationSettings || {};
      if (settings[item.type] === false) {
        return false;
      }
    }

    // 2. Lọc theo trạng thái Đọc / Chưa đọc
    if (filterMode === 'unread' && item.read !== false) return false;
    if (filterMode === 'read' && item.read === false) return false;

    // 3. Lọc theo Từ khóa tìm kiếm
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
              Theo dõi các cập nhật mới nhất về bài viết, báo cáo và tài khoản của bạn.
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
            Theo dõi các cập nhật mới nhất về bài viết, báo cáo và tài khoản của bạn.
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
            <svg className="notifications-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                const isAlert = item.type === 'sos_alert';
                const iconType = item.type === 'chat_message'
                  ? 'chat_message'
                  : item.type === 'article_like' || item.type === 'article_comment' || item.type === 'article_favorite'
                    ? 'article_like'
                    : item.type === 'system' && item.relatedType === 'chat_room'
                      ? 'chat_message'
                      : isAlert
                        ? 'sos_alert'
                        : item.type === 'admin' || item.title?.toLowerCase().includes('admin')
                          ? 'admin'
                          : 'default';

                return (
                  <li
                    key={item.id}
                    className={`notifications-item${isUnread ? ' notifications-item--unread' : ''}`}
                  >
                    <button
                      type="button"
                      className={`notifications-item-main${isUnread ? ' notifications-item-main--unread' : ''}`}
                      onClick={() => handleOpenNotification(item)}
                    >
                      <div className={`notifications-item-icon${isAlert ? ' notifications-item-icon--alert' : ''}`}>
                        {NOTIFICATION_ICONS[iconType] || NOTIFICATION_ICONS.default}
                      </div>
                      <div className="notifications-item-body">
                        <h3 className="notifications-item-title">{item.title || 'Thông báo mới'}</h3>
                        <p className="notifications-item-message">{item.message || 'Không có nội dung'}</p>
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
    </div>
  );
}

function ConsultationPlaceholder() {
  return (
    <div style={{ padding: '120px 24px 80px', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '16px', color: '#1e3c72' }}>Đặt Lịch Tham Vấn</h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '24px' }}>
          Đặt lịch trao đổi trực tiếp, bảo mật với các chuyên gia tâm lý học đường.
        </p>
      </div>
    </div>
  );
}

function AppShell() {
  const { pathname } = useLocation();

  const isNoChrome = NO_CHROME_ROUTES.includes(pathname) || pathname.startsWith('/admin');

  return (
    <>
      {!isNoChrome && <Header />}

      <main className="app-main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          {/* Public User Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/articles" element={<News />} />
          <Route path="/articles/:id" element={<News />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Trang SOS */}
          <Route path="/sos" element={<SOS />} />

          {/* Protected User Routes */}
          <Route path="/articles/create" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/articles/edit/:id" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

          {/* Placeholders */}
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPlaceholder /></ProtectedRoute>} />
          <Route path="/consultation" element={<ConsultationPlaceholder />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="posts" element={<ManagePosts />} />
            <Route path="reports" element={<ManageReports />} />
            <Route path="chat" element={<ManageChat />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isNoChrome && <Footer />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;