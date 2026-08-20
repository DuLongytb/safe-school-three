import React, { useState, useEffect } from 'react';
import { getReports, updateReport, deleteReport } from '../../api/admin';
import Modal from '../../components/Common/Modal';
import Toast from '../../components/Common/Toast';

const ManageReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionStatus, setActionStatus] = useState(null); // 'processing' | 'resolved'
  const [showModal, setShowModal] = useState(false);

  const [toast, setToast] = useState({ message: '', type: 'info' });

  const fetchReportsList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getReports(statusFilter, priorityFilter);
      if (res && res.data) {
        setReports(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy báo cáo:', err);
      setError(err.message || 'Không thể tải danh sách báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsList();
  }, [statusFilter, priorityFilter]);

  // Mở modal cập nhật trạng thái báo cáo
  const handleOpenReportModal = (report, targetStatus) => {
    setSelectedReport(report);
    setActionStatus(targetStatus);
    setShowModal(true);
  };

  // Xác nhận cập nhật báo cáo
  const handleConfirmReportAction = async (resolutionNotes) => {
    if (!selectedReport || !actionStatus) return;

    try {
      await updateReport(selectedReport.id, {
        status: actionStatus,
        resolution: resolutionNotes || '',
      });

      const statusLabels = {
        processing: 'Đang xử lý',
        resolved: 'Đã giải quyết hoàn tất',
      };

      setToast({
        message: `Báo cáo #${selectedReport.id.substring(0, 6)} đã chuyển sang trạng thái: ${statusLabels[actionStatus]}!`,
        type: 'success',
      });

      setShowModal(false);
      setSelectedReport(null);
      setActionStatus(null);
      fetchReportsList();
    } catch (err) {
      setToast({ message: 'Lỗi khi cập nhật báo cáo: ' + err.message, type: 'error' });
    }
  };

  const handleDeleteReport = async (report) => {
    if (!report) return;

    const confirmDelete = window.confirm(`Bạn có chắc muốn xóa báo cáo "${report.title || report.id}" không? Hành động này không thể hoàn tác.`);
    if (!confirmDelete) return;

    try {
      await deleteReport(report.id);
      setToast({ message: `Đã xóa báo cáo #${report.id.substring(0, 6)} thành công!`, type: 'success' });
      fetchReportsList();
    } catch (err) {
      setToast({ message: 'Lỗi khi xóa báo cáo: ' + err.message, type: 'error' });
    }
  };

  // Tính thời gian đã trôi qua kể từ khi nhận báo cáo
  const calculateElapsedTime = (createdAtStr) => {
    if (!createdAtStr) return 'N/A';
    try {
      const created = new Date(createdAtStr);
      const now = new Date();
      const diffMs = now - created;
      if (diffMs < 0) return 'Vừa mới gửi';

      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) return `${diffDays} ngày trước`;
      if (diffHours > 0) return `${diffHours} giờ ${diffMins % 60} phút trước`;
      return `${diffMins} phút trước`;
    } catch {
      return createdAtStr;
    }
  };

  // Format ngày tạo
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Lọc bài báo cáo theo ô tìm kiếm
  const filteredReports = reports.filter((r) => {
    const titleMatch = (r.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const descMatch = (r.description || r.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    const reporterMatch = (r.reporterId || r.reporterName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return titleMatch || descMatch || reporterMatch;
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Action Modal */}
      <Modal
        isOpen={showModal}
        title={
          actionStatus === 'processing'
            ? '🔄 Bắt Đầu Xử Lý Báo Cáo'
            : '✅ Hoàn Thành Xử Lý Báo Cáo'
        }
        message={
          actionStatus === 'processing'
            ? `Cập nhật trạng thái báo cáo #${selectedReport?.id.substring(0, 8)} sang "Đang Xử Lý". Nhập ghi chú xử lý ban đầu:`
            : `Xác nhận báo cáo #${selectedReport?.id.substring(0, 8)} đã được GIẢI QUYẾT HOÀN TẤT. Nhập kết quả xử lý:`
        }
        variant={actionStatus === 'processing' ? 'primary' : 'success'}
        inputPlaceholder="Nhập ghi chú xử lý (ví dụ: Đã làm việc với ban giám hiệu và giáo viên chủ nhiệm)..."
        requireInput={false}
        confirmText={actionStatus === 'processing' ? 'Lưu Trạng Thái Xử Lý' : 'Hoàn Thành Báo Cáo'}
        cancelText="Hủy Bỏ"
        onConfirm={handleConfirmReportAction}
        onCancel={() => {
          setShowModal(false);
          setSelectedReport(null);
          setActionStatus(null);
        }}
      />

      {/* Header Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a', fontWeight: '700' }}>
          📋 Tiếp Nhận & Xử Lý Báo Cáo Bạo Lực
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
          Hệ thống tiếp nhận báo cáo từ học sinh. Báo cáo <strong>SOS</strong> được tự động ưu tiên xếp lên đầu
        </p>
      </div>

      {/* Control Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, địa điểm hoặc người báo cáo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Lọc Trạng Thái:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả báo cáo</option>
              <option value="pending">Chờ tiếp nhận (Pending)</option>
              <option value="processing">Đang xử lý (Processing)</option>
              <option value="resolved">Đã giải quyết (Resolved)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Lọc Mức Ưu Tiên:</label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả mức ưu tiên</option>
              <option value="sos">SOS</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <span style={{ fontSize: '2rem' }}>⏳</span>
          <p style={{ color: '#64748b', marginTop: '8px' }}>Đang tải danh sách báo cáo vi phạm...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', margin: '0 0 12px' }}>⚠️ {error}</p>
          <button onClick={fetchReportsList} style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            🔄 Thử lại
          </button>
        </div>
      )}

      {/* Reports Table */}
      {!loading && !error && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '14px 20px' }}>Loại & Tiêu Đề Báo Cáo</th>
                <th style={{ padding: '14px 20px' }}>Người Gửi / Địa Điểm</th>
                <th style={{ padding: '14px 20px' }}>Thời Gian Nhận</th>
                <th style={{ padding: '14px 20px' }}>Trạng Thái</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Hành Động Xử Lý</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    Không có báo cáo nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((r) => {
                  const reportType = (r.type || '').toLowerCase();
                  const isSOS = reportType === 'sos_emergency' || (r.priority || '').toUpperCase() === 'SOS';
                  const isPending = (r.status || 'pending') === 'pending';
                  const isProcessing = r.status === 'processing';
                  const isResolved = r.status === 'resolved';

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSOS ? '#fef2f2' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* Priority Tag & Title */}
                      <td style={{ padding: '14px 20px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          {isSOS ? (
                            <span
                              style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                fontWeight: '800',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                letterSpacing: '0.5px',
                                animation: 'pulseBadge 1.5s infinite',
                              }}
                            >
                              🚨 SOS KHẨN CẤP
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                              Thông thường
                            </span>
                          )}
                        </div>

                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>
                          {r.title || 'Báo cáo sự cố bạo lực'}
                        </div>
                        {r.description && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.description}
                          </div>
                        )}
                      </td>

                      {/* Reporter / Location */}
                      <td style={{ padding: '14px 20px', color: '#334155' }}>
                        <div style={{ fontWeight: '500' }}>{r.reporterName || r.reporterId || 'Học sinh ẩn danh'}</div>
                        {r.location && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>📍 {r.location}</div>}
                      </td>

                      {/* Created Time & Processing duration */}
                      <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.85rem' }}>
                        <div>{formatDate(r.createdAt)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '600', marginTop: '2px' }}>
                          ⏱️ {calculateElapsedTime(r.createdAt)}
                        </div>
                      </td>

                      {/* Status Tag */}
                      <td style={{ padding: '14px 20px' }}>
                        {isPending && (
                          <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600' }}>
                            🔴 Chờ xử lý
                          </span>
                        )}
                        {isProcessing && (
                          <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600' }}>
                            🟡 Đang xử lý
                          </span>
                        )}
                        {isResolved && (
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600' }}>
                            🟢 Đã hoàn thành
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenReportModal(r, 'processing')}
                            disabled={isResolved}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isResolved ? '#e2e8f0' : '#2563eb',
                              color: isResolved ? '#94a3b8' : '#ffffff',
                              fontWeight: '600',
                              fontSize: '0.825rem',
                              cursor: isResolved ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>🔄</span> Xử lý
                          </button>

                          <button
                            onClick={() => handleOpenReportModal(r, 'resolved')}
                            disabled={isResolved}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isResolved ? '#e2e8f0' : '#16a34a',
                              color: isResolved ? '#94a3b8' : '#ffffff',
                              fontWeight: '600',
                              fontSize: '0.825rem',
                              cursor: isResolved ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>✅</span> Hoàn thành
                          </button>

                          <button
                            onClick={() => handleDeleteReport(r)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              fontWeight: '600',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>🗑️</span> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Trang {currentPage} / {totalPages} (Tổng {filteredReports.length} báo cáo)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ◀ Trước
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Sau ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulseBadge {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ManageReports;
