import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createReportService, subscribeUserReportsService, REPORT_CATEGORIES } from '../services/reportService';
import Toast from '../components/Common/Toast';
import './Report.css';

export default function Report() {
  const { user } = useAuth();

  // Tabs: 'create' | 'history'
  const [activeTab, setActiveTab] = useState('create');
  const [myReports, setMyReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('bao-luc');
  const [priority, setPriority] = useState('normal');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  // isAnonymous: false mặc định. Khi user đã đăng nhập, sync từ Firestore (user.isAnonymous qua AuthContext).
  // Lưu ý: user.isAnonymous ở đây là is_anonymous từ Firestore, KHÔNG phải Firebase Auth anonymous account.
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal View State
  const [selectedReport, setSelectedReport] = useState(null);

  // Toast
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // Sync chế độ ẩn danh từ Firestore profile (qua AuthContext) khi user đăng nhập hoặc thay đổi cài đặt
  useEffect(() => {
    if (user && user.isAnonymous !== undefined) {
      // user.isAnonymous = Boolean(userData.is_anonymous) — đọc từ Firestore qua AuthContext
      // Chỉ áp dụng cho người dùng đã đăng nhập (user !== null)
      setIsAnonymous(Boolean(user.isAnonymous));
    } else if (!user) {
      // Guest chưa đăng nhập — đặt về false, không thể chọn Anonymous
      setIsAnonymous(false);
    }
  }, [user]);

  // Subscribe to own reports
  useEffect(() => {
    if (!user?.uid) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    const unsubscribe = subscribeUserReportsService(
      user.uid,
      (reports) => {
        setMyReports(reports);
        setLoadingHistory(false);
      },
      (err) => {
        console.error('Lỗi khi tải danh sách báo cáo cá nhân:', err);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setToast({ message: 'Vui lòng nhập tiêu đề báo cáo!', type: 'warning' });
      return;
    }

    if (!description.trim()) {
      setToast({ message: 'Vui lòng nhập nội dung chi tiết phản ánh!', type: 'warning' });
      return;
    }

    try {
      setSubmitting(true);
      await createReportService(
        {
          title,
          category,
          priority,
          location,
          description,
          isAnonymous,
        },
        user
      );

      setToast({
        message: 'Gửi báo cáo thành công! Ban Quản Trị & Nhà Trường sẽ tiếp nhận xử lý ngay.',
        type: 'success',
      });

      // Reset form
      setTitle('');
      setCategory('bao-luc');
      setPriority('normal');
      setLocation('');
      setDescription('');

      // Switch to history tab to see the live status
      setActiveTab('history');
    } catch (err) {
      console.error('Lỗi khi gửi báo cáo:', err);
      setToast({
        message: 'Lỗi khi gửi báo cáo: ' + (err.message || 'Vui lòng thử lại sau.'),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'processing':
        return <span className="history-status-badge status-processing">🔄 Đang xử lý</span>;
      case 'resolved':
        return <span className="history-status-badge status-resolved">✅ Đã xử lý</span>;
      default:
        return <span className="history-status-badge status-pending">⏳ Chờ tiếp nhận</span>;
    }
  };

  return (
    <div className="report-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="report-header">
        <div className="report-badge">🛡️ Kênh Phản Ánh & Bảo Vệ Học Đường</div>
        <h1 className="report-title">Báo Cáo & Phản Ánh Sự Cố</h1>
        <p className="report-subtitle">
          Hãy chung tay bảo vệ môi trường học đường an toàn, lành mạnh. Mọi thông tin phản ánh đều được bảo mật
          và giải quyết kịp thời bởi Ban Giám Hiệu & Chuyên Gia Tâm Lý.
        </p>
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <span>✍️ Viết Báo Cáo Mới</span>
        </button>

        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span>📋 Báo Cáo Của Tôi</span>
          {myReports.length > 0 && <span className="tab-badge">{myReports.length}</span>}
        </button>
      </div>

      {/* TAB 1: FORM VIẾT BÁO CÁO */}
      {activeTab === 'create' && (
        <div className="report-card">
          <form onSubmit={handleSubmitReport} className="report-form">
            {/* Tiêu đề */}
            <div className="form-group">
              <label className="form-label">
                Tiêu đề báo cáo <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Phát hiện hành vi bắt nạt / Cơ sở vật chất có nguy cơ mất an toàn..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Row: Phân loại & Mức độ ưu tiên */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Phân loại vấn đề <span className="required-star">*</span>
                </label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {REPORT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.fullText}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Mức độ khẩn cấp</label>
                <select
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="normal">🟢 Bình thường / Cần giải quyết theo quy trình</option>
                  <option value="high">🔴 Khẩn cấp / Cần can thiệp sớm</option>
                </select>
              </div>
            </div>

            {/* Địa điểm xảy ra */}
            <div className="form-group">
              <label className="form-label">
                📍 Địa điểm / Khu vực xảy ra sự việc (Nếu có)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Khu vực nhà xe học sinh, Hành lang tầng 3 dãy B, Cổng phụ..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Nội dung chi tiết */}
            <div className="form-group">
              <label className="form-label">
                Nội dung phản ánh chi tiết <span className="required-star">*</span>
              </label>
              <textarea
                className="form-textarea"
                placeholder="Mô tả chi tiết sự việc: Thời gian, những người liên quan, diễn biến sự việc và các bằng chứng (nếu có) để Ban Giám Hiệu có thể xác minh nhanh nhất..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                required
              />
            </div>

            {/* Tuỳ chọn ẩn danh */}
            <label className="anon-toggle-box">
              <input
                type="checkbox"
                className="anon-checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <div>
                <div className="anon-text-title">
                  <span>🕵️ Gửi báo cáo ở chế độ Ẩn Danh</span>
                </div>
                <div className="anon-text-desc">
                  Tên và email của bạn sẽ được bảo vệ tuyệt đối và không hiển thị công khai. Nhà trường vẫn tiếp nhận
                  và xử lý nghiêm túc phản ánh này.
                </div>
              </div>
            </label>

            {/* Nút gửi */}
            <button
              type="submit"
              className="btn-submit-report"
              disabled={submitting}
            >
              {submitting ? '⏳ Đang gửi báo cáo...' : '🚀 Gửi Báo Cáo Bảo Mật'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: LỊCH SỬ BÁO CÁO CỦA TÔI */}
      {activeTab === 'history' && (
        <div className="report-card">
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <span style={{ fontSize: '2rem' }}>⏳</span>
              <p style={{ color: '#64748b', marginTop: '8px' }}>Đang tải lịch sử báo cáo của bạn...</p>
            </div>
          ) : myReports.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">📝</div>
              <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Bạn chưa gửi báo cáo nào</h3>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                Khi bạn gửi phản ánh hoặc báo cáo sự cố, tiến trình xử lý sẽ xuất hiện tại đây theo thời gian thực.
              </p>
              <button
                type="button"
                className="btn-submit-report"
                style={{ marginTop: '20px', padding: '10px 20px', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('create')}
              >
                + Tạo báo cáo ngay
              </button>
            </div>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Tiêu đề báo cáo</th>
                    <th>Danh mục</th>
                    <th>Thời gian gửi</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {myReports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{r.title}</strong>
                        {r.location && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            📍 {r.location}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#475569' }}>{r.categoryLabel}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {new Date(r.createdAt).toLocaleDateString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedReport(r)}
                          style={{
                            padding: '6px 14px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '0.825rem',
                            cursor: 'pointer',
                          }}
                        >
                          👁️ Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedReport && (
        <div className="report-modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="report-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem' }}>
                Chi Tiết Báo Cáo
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1e293b' }}>
                {selectedReport.title}
              </h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: '#64748b' }}>
                <span>📁 {selectedReport.categoryLabel}</span>
                <span>•</span>
                <span>🕒 {new Date(selectedReport.createdAt).toLocaleString('vi-VN')}</span>
                <span>•</span>
                {getStatusBadge(selectedReport.status)}
              </div>
            </div>

            {selectedReport.location && (
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
                <strong>📍 Vị trí:</strong> {selectedReport.location}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#334155', marginBottom: '6px', fontSize: '0.9rem' }}>
                📄 Nội dung đã phản ánh:
              </label>
              <div style={{ background: '#f1f5f9', padding: '14px', borderRadius: '8px', color: '#1e293b', fontSize: '0.925rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {selectedReport.description}
              </div>
            </div>

            {/* Phản hồi từ nhà trường */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
              <h5 style={{ margin: '0 0 8px', color: '#166534', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️</span> Tiến trình xử lý từ Ban Giám Hiệu:
              </h5>
              <p style={{ margin: 0, color: '#15803d', fontSize: '0.9rem', lineHeight: '1.6' }}>
                {selectedReport.resolution || selectedReport.note
                  ? (selectedReport.resolution || selectedReport.note)
                  : (selectedReport.status === 'resolved'
                      ? 'Báo cáo này đã được xác minh và xử lý hoàn tất an toàn.'
                      : (selectedReport.status === 'processing'
                          ? 'Nhà trường và cán bộ chuyên trách đang tiến hành xác minh và xử lý vụ việc.'
                          : 'Báo cáo đã được tiếp nhận và đưa vào hàng đợi xử lý ưu tiên.'))}
              </p>
              {selectedReport.assignedToName && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#166534' }}>
                  👤 Cán bộ phụ trách: <strong>{selectedReport.assignedToName}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{
                  padding: '8px 20px',
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}