import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatistics } from '../../api/admin';
import Toast from '../../components/Common/Toast';

const Dashboard = () => {
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    reports: 0,
    pendingReports: 0,
    pendingPosts: 0,
    sosReports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const navigate = useNavigate();

  const fetchStats = async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const res = await getStatistics();
      if (res && res.data) {
        setStats(res.data);
        if (isManual) {
          setToast({ message: 'Đã cập nhật dữ liệu mới nhất!', type: 'success' });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu thống kê:', err);
      setError(err.message || 'Không thể kết nối đến máy lưu trữ thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Antigravity Real-Time Polling: Tự động tải lại sau mỗi 10 giây
    const interval = setInterval(() => {
      fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      title: 'TỔNG NGƯỜI DÙNG',
      value: stats.users,
      icon: '👥',
      bgGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      desc: 'Tài khoản học sinh, giáo viên & quản trị',
    },
    {
      title: 'BÀI VIẾT DIỄN ĐÀN',
      value: stats.posts,
      icon: '📰',
      bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      desc: `${stats.pendingPosts || 0} bài viết đang chờ duyệt`,
    },
    {
      title: 'BÁO CÁO VI PHẠM',
      value: stats.reports,
      icon: '📋',
      bgGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      desc: 'Tổng báo cáo gửi lên hệ thống',
    },
    {
      title: 'BÁO CÁO CHỜ XỬ LÝ',
      value: stats.pendingReports,
      icon: '🚨',
      bgGradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      desc: '⚠️ Cần xử lý ngay lập tức!',
      highlight: true,
      clickable: true,
      onClick: () => navigate('/admin/reports'),
    },
  ];

  if (loading && !stats.users) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>⏳</div>
        <p style={{ color: '#64748b', marginTop: '12px' }}>Đang tải dữ liệu Dashboard...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !stats.users) {
    return (
      <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '32px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <h3 style={{ color: '#991b1b', marginTop: '12px' }}>Lỗi tải dữ liệu Dashboard</h3>
        <p style={{ color: '#7f1d1d', margin: '12px 0 20px' }}>{error}</p>
        <button
          onClick={() => fetchStats(true)}
          style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          🔄 Thử lại
        </button>
      </div>
    );
  }

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header section with refresh button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a', fontWeight: '700' }}>
            📊 Tổng Quan Thống Kê
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            Số liệu thời gian thực được tự động làm mới từ hệ thống SafeSchool
          </p>
        </div>

        <button
          onClick={() => fetchStats(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#334155',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.9rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <span>🔄</span>
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* SOS Alert Banner (If any SOS reports present) */}
      {stats.sosReports > 0 && (
        <div
          onClick={() => navigate('/admin/reports')}
          style={{
            backgroundColor: '#fef2f2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '16px 24px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            animation: 'pulseSOS 2s infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '2rem' }}>🚨</span>
            <div>
              <h4 style={{ margin: 0, color: '#991b1b', fontSize: '1.1rem' }}>
                CẢNH BÁO KHẨN CẤP: Có {stats.sosReports} Báo Cáo SOS Cần Xử Lý Ngay!
              </h4>
              <p style={{ margin: '4px 0 0', color: '#b91c1c', fontSize: '0.9rem' }}>
                Phát hiện các sự cố bạo lực khẩn cấp được gửi từ học sinh. Nhấn để kiểm tra ngay lập tức.
              </p>
            </div>
          </div>
          <span style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem' }}>
            Xem Báo Cáo SOS ▶
          </span>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '36px' }}>
        {cards.map((card, index) => (
          <div
            key={index}
            onClick={card.onClick}
            style={{
              background: card.bgGradient,
              borderRadius: '16px',
              padding: '24px',
              color: '#ffffff',
              boxShadow: card.highlight
                ? '0 10px 25px rgba(220, 38, 38, 0.35)'
                : '0 10px 20px rgba(0, 0, 0, 0.06)',
              cursor: card.clickable ? 'pointer' : 'default',
              transition: 'transform 0.2s ease, boxShadow 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background watermark icon */}
            <span
              style={{
                position: 'absolute',
                right: '-10px',
                bottom: '-10px',
                fontSize: '5.5rem',
                opacity: 0.15,
                pointerEvents: 'none',
              }}
            >
              {card.icon}
            </span>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.8px', opacity: 0.9 }}>
                {card.title}
              </span>
              <span style={{ fontSize: '1.6rem' }}>{card.icon}</span>
            </div>

            <div style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: 1, marginBottom: '8px' }}>
              {card.value}
            </div>

            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '4px' }}>
              {card.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Shortcut Dashboard Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        {/* Quick Action Box */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> Truy Cập Nhanh Quản Lý
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => navigate('/admin/reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.3rem' }}>📋</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Quản lý Báo Cáo Vi Phạm</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Đang chờ xử lý: {stats.pendingReports}</div>
                </div>
              </div>
              <span style={{ color: '#2563eb', fontWeight: '600' }}>→</span>
            </button>

            <button
              onClick={() => navigate('/admin/posts')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.3rem' }}>📰</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Duyệt Bài Viết Diễn Đàn</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Đang chờ duyệt: {stats.pendingPosts}</div>
                </div>
              </div>
              <span style={{ color: '#2563eb', fontWeight: '600' }}>→</span>
            </button>

            <button
              onClick={() => navigate('/admin/users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.3rem' }}>👥</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Quản Lý Người Dùng & Quyền</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Tổng số tài khoản: {stats.users}</div>
                </div>
              </div>
              <span style={{ color: '#2563eb', fontWeight: '600' }}>→</span>
            </button>
          </div>
        </div>

        {/* System Guidelines Box */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💡</span> Hướng Dẫn Vận Hành An Toàn
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '0.9rem', lineHeight: '1.7' }}>
            <li>
              <strong>Ưu tiên Báo Cáo SOS:</strong> Phản ứng lập tức với các báo cáo SOS đỏ khẩn cấp.
            </li>
            <li>
              <strong>Kiểm duyệt bài viết:</strong> Đảm bảo không bỏ sót các từ khóa bạo lực học đường nhạy cảm.
            </li>
            <li>
              <strong>Quản lý Người dùng:</strong> Khóa tài khoản vi phạm sẽ tự động gửi thông báo giải thích tới học sinh.
            </li>
            <li>
              <strong>Nhật ký Admin:</strong> Tất cả các thao tác của Ban Quản Trị đều được mã hóa và lưu vào <code>admin_logs</code>.
            </li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes pulseSOS {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
