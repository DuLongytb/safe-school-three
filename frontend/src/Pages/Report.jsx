import React, { useState } from 'react';
import './Report.css';

const INITIAL_REPORTS = [
  {
    id: 'REP-001',
    title: 'Sự cố hỏng thiết bị phòng lab 203',
    sender: 'Nguyễn Văn A',
    category: 'cs-vat-chat',
    categoryLabel: 'Cơ sở vật chất',
    createdAt: '2026-07-28 09:30',
    priority: 'Cao',
    status: 'Mới',
    description: 'Máy chiếu phòng 203 bị mất nguồn hoàn toàn, bàn phím máy số 05 bị hỏng phím cách.',
    note: '',
  },
  {
    id: 'REP-002',
    title: 'Phát hiện nguy cơ bạo lực học đường khu nhà thể chất',
    sender: 'Ẩn danh',
    category: 'an-ninh',
    categoryLabel: 'An ninh trường học',
    createdAt: '2026-07-30 14:15',
    priority: 'Khẩn cấp',
    status: 'Đang xử lý',
    description: 'Có nhóm học sinh tụ tập cãi vã gây gổ sau giờ học thể dục tại khu vực phía sau nhà thể chất.',
    note: 'Đã báo bảo vệ khu vực xuống kiểm tra.',
  },
  {
    id: 'REP-003',
    title: 'Hệ thống đèn chiếu sáng hành lang tầng 3 bị hỏng',
    sender: 'Trần Thị B',
    category: 'cs-vat-chat',
    categoryLabel: 'Cơ sở vật chất',
    createdAt: '2026-07-31 08:20',
    priority: 'Trung bình',
    status: 'Mới',
    description: '3 bóng đèn LED dãy hành lang lớp 11A1-11A3 bị nhấp nháy liên tục gây chói mắt.',
    note: '',
  },
  {
    id: 'REP-004',
    title: 'Nghi vấn va chạm giao thông trước cổng trường',
    sender: 'Lê Hoàng C',
    category: 'an-ninh',
    categoryLabel: 'An ninh trường học',
    createdAt: '2026-07-31 11:45',
    priority: 'Cao',
    status: 'Đang xử lý',
    description: 'Ùn tắc giao thông nghiêm trọng giờ tan học do hai xe máy va chạm nhẹ ngay trước cổng chính.',
    note: 'Đội xung kích nhà trường đang phối hợp điều tiết giao thông.',
  },
  {
    id: 'REP-005',
    title: 'Quạt trần phòng học 10A2 phát ra tiếng động lớn',
    sender: 'Phạm Minh D',
    category: 'cs-vat-chat',
    categoryLabel: 'Cơ sở vật chất',
    createdAt: '2026-07-25 15:10',
    priority: 'Thấp',
    status: 'Đã xử lý',
    description: 'Quạt trần số 2 bị lỏng ốc treo, rung lắc mạnh khi bật số lớn.',
    note: 'Kỹ thuật viên đã siết lại ốc và tra dầu bảo dưỡng hoàn tất.',
  },
];

export default function Report() {
  const [reports, setReports] = useState(INITIAL_REPORTS);

  const [filterTime, setFilterTime] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [selectedReport, setSelectedReport] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editNote, setEditNote] = useState('');

  const handleResetFilters = () => {
    setFilterTime('all');
    setFilterCategory('all');
    setFilterStatus('all');
  };

  const filteredReports = reports.filter((item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) {
      return false;
    }
    if (filterStatus !== 'all' && item.status !== filterStatus) {
      return false;
    }
    if (filterTime === 'today') {
      return item.createdAt.startsWith('2026-07-31');
    }
    return true;
  });

  const handleOpenModal = (report) => {
    setSelectedReport(report);
    setEditStatus(report.status);
    setEditPriority(report.priority);
    setEditNote(report.note || '');
  };

  const handleSaveChanges = () => {
    if (!selectedReport) return;

    setReports((prev) =>
      prev.map((item) =>
        item.id === selectedReport.id
          ? {
            ...item,
            status: editStatus,
            priority: editPriority,
            note: editNote,
          }
          : item
      )
    );

    setSelectedReport(null);
  };

  const handleDeleteReport = (id) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa báo cáo ${id}?`)) {
      setReports((prev) => prev.filter((item) => item.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    }
  };

  return (
    <div className="admin-reports-page">
      {/* Container chính bọc toàn bộ nội dung và đẩy tất cả xuống 120px */}
      <div style={{ marginTop: '120px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="admin-reports-header">
          <h1 className="admin-reports-title">Quản lý Báo cáo &amp; Xử lý Sự cố</h1>
          <p className="admin-reports-subtitle">
            Xem danh sách báo cáo, phân loại ưu tiên và cập nhật tiến trình xử lý trong phạm vi quản lý.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="admin-reports-filters">
          <div className="filter-group">
            <label htmlFor="filter-time">Thời gian:</label>
            <select
              id="filter-time"
              className="filter-select"
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-category">Loại báo cáo:</label>
            <select
              id="filter-category"
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Tất cả danh mục</option>
              <option value="cs-vat-chat">Cơ sở vật chất</option>
              <option value="an-ninh">An ninh trường học</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-status">Trạng thái:</label>
            <select
              id="filter-status"
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Mới">Mới</option>
              <option value="Đang xử lý">Đang xử lý</option>
              <option value="Đã xử lý">Đã xử lý</option>
            </select>
          </div>

          <button type="button" className="btn-reset-filter" onClick={handleResetFilters}>
            Đặt lại bộ lọc
          </button>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Mã &amp; Tiêu đề</th>
                <th>Người gửi</th>
                <th>Danh mục</th>
                <th>Thời gian</th>
                <th>Mức độ</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Không tìm thấy báo cáo nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredReports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      <div className="report-code">{item.id}</div>
                    </td>
                    <td>{item.sender}</td>
                    <td>{item.categoryLabel}</td>
                    <td>{item.createdAt}</td>
                    <td>
                      <span className={`badge badge-priority-${item.priority === 'Khẩn cấp' ? 'Khancap' : item.priority}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-status-${item.status === 'Đang xử lý' ? 'Dangxuly' : item.status === 'Đã xử lý' ? 'Daxuly' : 'Moi'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn-action-view"
                          onClick={() => handleOpenModal(item)}
                        >
                          👁 Xem &amp; Xử lý
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          style={{
                            border: 'none',
                            background: '#fee2e2',
                            color: '#dc2626',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDeleteReport(item.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chi Tiết & Cập Nhật */}
      {selectedReport && (
        <div className="modal-overlay" style={modalStyles.overlay}>
          <div className="modal-content" style={modalStyles.content}>
            <div style={modalStyles.header}>
              <h2>Chi tiết báo cáo: {selectedReport.id}</h2>
              <button type="button" onClick={() => setSelectedReport(null)} style={modalStyles.closeBtn}>✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '4px' }}>{selectedReport.title}</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                Người gửi: <strong>{selectedReport.sender}</strong> | Thời gian: {selectedReport.createdAt}
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                <strong>Nội dung phản ánh:</strong> <br />
                {selectedReport.description}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Trạng thái xử lý:
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="Mới">Mới</option>
                  <option value="Đang xử lý">Đang xử lý</option>
                  <option value="Đã xử lý">Đã xử lý</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Mức độ ưu tiên:
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                >
                  <option value="Thấp">Thấp</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Cao">Cao</option>
                  <option value="Khẩn cấp">Khẩn cấp</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Ghi chú của Ban quản lý:
              </label>
              <textarea
                rows="3"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
                placeholder="Nhập tiến trình xử lý..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn-reset-filter"
                onClick={() => setSelectedReport(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-action-view"
                style={{ background: '#2563eb', color: '#fff', padding: '8px 20px' }}
                onClick={handleSaveChanges}
              >
                Lưu cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '560px',
    width: '90%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '12px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: '#64748b',
  },
};