import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase/config';
import { signOut } from 'firebase/auth';
import Modal from '../Common/Modal';
import Toast from '../Common/Toast';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('vi-VN'));
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/users', label: 'Quản lý Users', icon: '👥' },
    { path: '/admin/posts', label: 'Quản lý Bài viết', icon: '📰' },
    { path: '/admin/reports', label: 'Quản lý Báo cáo', icon: '📋' },
    { path: '/admin/chat', label: 'Quản lý Phòng Chat', icon: '💬' },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      navigate('/login');
    } catch (error) {
      setToast({ message: 'Lỗi khi đăng xuất: ' + error.message, type: 'error' });
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f9', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Toast Notification */}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        title="Xác nhận Đăng Xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi trang Quản Trị Admin SafeSchool không?"
        variant="danger"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside
        style={{
          width: collapsed ? '80px' : '260px',
          backgroundColor: '#1e3c72',
          backgroundImage: 'linear-gradient(180deg, #1e3c72 0%, #162b52 100%)',
          color: '#ffffff',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 15px rgba(0, 0, 0, 0.1)',
          zIndex: 100,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Sidebar Header / Logo */}
        <div
          style={{
            padding: '20px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <span style={{ fontSize: '1.6rem' }}>🛡️</span>
              <span style={{ fontWeight: '700', fontSize: '1.15rem', letterSpacing: '0.5px', color: '#ffffff', whiteSpace: 'nowrap' }}>
                SafeSchool <span style={{ fontSize: '0.75rem', backgroundColor: '#3b82f6', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Admin</span>
              </span>
            </div>
          )}

          {collapsed && <span style={{ fontSize: '1.8rem' }}>🛡️</span>}

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: collapsed ? '12px 0' : '12px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: '10px',
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'all 0.2s ease',
                  fontSize: '0.95rem',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Buttons */}
        <div
          style={{
            padding: '16px 12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
            }}
          >
            <span>🏠</span>
            {!collapsed && <span>Về trang chủ</span>}
          </button>

          <button
            onClick={() => setShowLogoutModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: '10px 14px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              width: '100%',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
            }}
          >
            <span>🚪</span>
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ==================== RIGHT MAIN CONTENT AREA ==================== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: '70px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          {/* Left Welcome message */}
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '600' }}>
              Bảng Quản Trị An Toàn Học Đường
            </h2>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              SafeSchool Administrative Control Panel
            </span>
          </div>

          {/* Right Admin Status & Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Live Clock */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.875rem',
                color: '#334155',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🕒</span>
              <span>{currentTime}</span>
            </div>

            {/* Admin Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#1e3c72',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '1rem',
                }}
              >
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#0f172a' }}>
                  {user?.displayName || 'Admin SafeSchool'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '600' }}>
                  ● Quản trị viên
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Outlet Content */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
