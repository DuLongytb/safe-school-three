import React, { useState, useEffect } from 'react';
import {
  subscribeReportsService,
  updateReportService,
  deleteReportService,
  getAssignableStaffService,
  REPORT_CATEGORIES,
} from '../../services/reportService';
import Toast from '../../components/Common/Toast';

const STATUS_CONFIG = {
  pending: { label: '⏳ Chờ tiếp nhận', bg: '#fee2e2', color: '#b91c1c' },
  processing: { label: '🔄 Đang xử lý', bg: '#fef3c7', color: '#b45309' },
  resolved: { label: '✅ Đã xử lý', bg: '#dcfce7', color: '#15803d' },
};

const PRIORITY_CONFIG = {
  sos: { label: '🚨 SOS KHẨN CẤP', bg: '#dc2626', color: '#ffffff' },
  high: { label: '🔴 Khẩn cấp', bg: '#fee2e2', color: '#b91c1c' },
  normal: { label: '🟢 Bình thường', bg: '#e0f2fe', color: '#0369a1' },
};

const ManageReports = ({ sosModeOnly = false }) => {
  const [reports, setReports] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal Detail & Edit state
  const [selectedReport, setSelectedReport] = useState(null);
  const [editStatus, setEditStatus] = useState('pending');
  const [editPriority, setEditPriority] = useState('normal');
  const [editNote, setEditNote] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // 1. Subscribe to real-time reports from Firestore
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeReportsService(
      (data) => {
        setReports(data);
        setLoading(false);
      },
      (err) => {
        console.error('Lỗi nhận dữ liệu báo cáo:', err);
        setError('Không thể kết nối danh sách báo cáo thời gian thực.');
        setLoading(false);
      }
    );

    // Fetch assignable staff list
    getAssignableStaffService().then((staff) => setStaffList(staff));

    return () => {
      unsubscribe();
    };
  }, []);

  // Open modal for details and processing
  const handleOpenDetailModal = (report) => {
    setSelectedReport(report);
    setEditStatus(report.status || 'pending');
    setEditPriority(report.priority || 'normal');
    setEditNote(report.note || report.resolution || '');
    setEditAssignedTo(report.assignedTo || '');
  };

  // Save report updates
  const handleSaveReportChanges = async () => {
    if (!selectedReport) return;

    try {
      setIsSaving(true);
      const assignedStaff = staffList.find((s) => s.uid === editAssignedTo);

      await updateReportService(selectedReport.id, {
        status: editStatus,
        priority: editPriority,
        note: editNote,
        resolution: editNote,
        assignedTo: editAssignedTo,
        assignedToName: assignedStaff ? assignedStaff.displayName : '',
      });

      setToast({
        message: `Đã cập nhật thành công báo cáo #${selectedReport.id.substring(0, 6)}!`,
        type: 'success',
      });

      setSelectedReport(null);
    } catch (err) {
      console.error('Lỗi khi cập nhật báo cáo:', err);
      setToast({
        message: 'Lỗi cập nhật: ' + (err.message || 'Vui lòng thử lại.'),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete report
  const handleDeleteReport = async (report) => {
    if (!report) return;

    const confirmDelete = window.confirm(
      `Bạn có chắc muốn xóa báo cáo "${report.title || report.id}" không? Hành động này không thể hoàn tác.`
    );
    if (!confirmDelete) return;

    try {
      await deleteReportService(report.id);
      setToast({
        message: `Đã xóa báo cáo #${report.id.substring(0, 6)} thành công!`,
        type: 'success',
      });
      if (selectedReport?.id === report.id) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Lỗi khi xóa báo cáo:', err);
      setToast({ message: 'Lỗi khi xóa báo cáo: ' + err.message, type: 'error' });
    }
  };

  // Calculate elapsed time
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

  // Format date
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

  // Filter and search reports
  const filteredReports = reports.filter((r) => {
    // Mode-based baseline filter: sosModeOnly shows only SOS; otherwise shows only non-SOS
    if (sosModeOnly && r.priority !== 'sos') return false;
    if (!sosModeOnly && r.priority === 'sos') return false;

    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const titleMatch = (r.title || '').toLowerCase().includes(term);
      const descMatch = (r.description || '').toLowerCase().includes(term);
      const locMatch = (r.location || '').toLowerCase().includes(term);
      const senderMatch = (r.sender || '').toLowerCase().includes(term);
      const idMatch = (r.id || '').toLowerCase().includes(term);
      return titleMatch || descMatch || locMatch || senderMatch || idMatch;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div>
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />

      {/* Header Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a', fontWeight: '700' }}>
          {sosModeOnly ? '🚨 Quản Lý Báo Cáo SOS Khẩn Cấp' : '📋 Quản Lý Báo Cáo Thông Thường'}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
          {sosModeOnly
            ? 'Tiếp nhận và xử lý khẩn cấp các báo cáo SOS ưu tiên cao từ học sinh cần trợ giúp ngay lập tức.'
            : 'Tiếp nhận, phân loại ưu tiên, phân công xử lý và theo dõi tiến trình báo cáo an toàn học đường theo thời gian thực.'}
        </p>
      </div>

      {/* Control Bar & Filters */}
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
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, người gửi, địa điểm, mã báo cáo..."
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

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>
              Trạng thái:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">⏳ Chờ tiếp nhận (Mới)</option>
              <option value="processing">🔄 Đang xử lý</option>
              <option value="resolved">✅ Đã xử lý</option>
            </select>
          </div>

          {/* Priority Filter — đồng bộ với các giá trị priority của Tạo báo cáo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>
              Mức độ:
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả mức độ</option>
              <option value="high">🔴 Khẩn cấp / Cần can thiệp sớm</option>
              <option value="normal">🟢 Bình thường / Theo quy trình</option>
            </select>
          </div>

          {/* Category Filter — đồng bộ dùng chung nguồn REPORT_CATEGORIES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>
              Danh mục:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả danh mục</option>
              {REPORT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.fullText}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setCategoryFilter('all');
              setSearchTerm('');
              setCurrentPage(1);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#475569',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <span style={{ fontSize: '2rem' }}>⏳</span>
          <p style={{ color: '#64748b', marginTop: '8px' }}>
            Đang tải dữ liệu báo cáo thời gian thực...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          <p style={{ color: '#dc2626', margin: '0 0 12px' }}>⚠️ {error}</p>
        </div>
      )}

      {/* Reports Table */}
      {!loading && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontWeight: '600',
                }}
              >
                <th style={{ padding: '14px 18px' }}>Mã & Tiêu Đề Báo Cáo</th>
                <th style={{ padding: '14px 18px' }}>Người Gửi / Vị Trí</th>
                <th style={{ padding: '14px 18px' }}>Danh Mục</th>
                <th style={{ padding: '14px 18px' }}>Thời Gian</th>
                <th style={{ padding: '14px 18px' }}>Mức Độ</th>
                <th style={{ padding: '14px 18px' }}>Trạng Thái</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}
                  >
                    Không có báo cáo nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((r) => {
                  const isSOS = r.priority === 'sos';
                  const statusConf = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const priorityConf = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.normal;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSOS ? '#fff1f2' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* Code & Title */}
                      <td style={{ padding: '14px 18px', maxWidth: '280px' }}>
                        <div
                          style={{
                            fontWeight: '600',
                            color: '#0f172a',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            fontFamily: 'monospace',
                            marginTop: '2px',
                          }}
                        >
                          #{r.id.substring(0, 8)}
                        </div>
                        {r.description && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: '#64748b',
                              marginTop: '3px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.description}
                          </div>
                        )}
                      </td>

                      {/* Sender / Location */}
                      <td style={{ padding: '14px 18px', color: '#334155' }}>
                        <div style={{ fontWeight: '500' }}>
                          {r.sender}
                          {r.isAnonymous && (
                            <span
                              style={{
                                marginLeft: '6px',
                                fontSize: '0.75rem',
                                backgroundColor: '#e2e8f0',
                                color: '#475569',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              🕵️ Ẩn danh
                            </span>
                          )}
                        </div>
                        {r.location && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            📍 {r.location}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '14px 18px', color: '#475569' }}>
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                          }}
                        >
                          {r.categoryLabel}
                        </span>
                      </td>

                      {/* Time */}
                      <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '0.85rem' }}>
                        <div>{formatDate(r.createdAt)}</div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#2563eb',
                            fontWeight: '600',
                            marginTop: '2px',
                          }}
                        >
                          ⏱️ {calculateElapsedTime(r.createdAt)}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            backgroundColor: priorityConf.bg,
                            color: priorityConf.color,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            letterSpacing: isSOS ? '0.5px' : 'normal',
                            animation: isSOS ? 'pulseBadge 1.5s infinite' : 'none',
                            display: 'inline-block',
                          }}
                        >
                          {priorityConf.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            backgroundColor: statusConf.bg,
                            color: statusConf.color,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            display: 'inline-block',
                          }}
                        >
                          {statusConf.label}
                        </span>
                        {r.assignedToName && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              marginTop: '4px',
                            }}
                          >
                            👤 {r.assignedToName}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(r)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              fontWeight: '600',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>👁</span> Xem & Xử lý
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteReport(r)}
                            title="Xóa báo cáo"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                            }}
                          >
                            🗑️
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
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Trang {currentPage} / {totalPages} (Tổng {filteredReports.length} báo cáo)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
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
                  type="button"
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

      {/* Modal: Chi tiết & Cập nhật / Phân công xử lý */}
      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '28px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '18px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '14px',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                  }}
                >
                  Mã sự cố: #{selectedReport.id}
                </span>
                <h2
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.25rem',
                    color: '#0f172a',
                    fontWeight: '700',
                  }}
                >
                  {selectedReport.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                ✕
              </button>
            </div>

            {/* Info Summary Box */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: '#f8fafc',
                padding: '14px 18px',
                borderRadius: '10px',
                marginBottom: '18px',
                fontSize: '0.875rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Người gửi: </span>
                <strong style={{ color: '#0f172a' }}>{selectedReport.sender}</strong>
                {selectedReport.isAnonymous && (
                  <span
                    style={{
                      marginLeft: '6px',
                      fontSize: '0.75rem',
                      backgroundColor: '#e2e8f0',
                      color: '#475569',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    🕵️ Ẩn danh
                  </span>
                )}
                {selectedReport.senderEmail && !selectedReport.isAnonymous && (
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {selectedReport.senderEmail}
                  </div>
                )}
                {selectedReport.senderId && (
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                    UID nội bộ: {selectedReport.senderId}
                  </div>
                )}
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Danh mục: </span>
                <strong style={{ color: '#0f172a' }}>{selectedReport.categoryLabel}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Thời gian gửi: </span>
                <span style={{ color: '#334155' }}>{formatDate(selectedReport.createdAt)}</span>
              </div>
              {selectedReport.location && (
                <div>
                  <span style={{ color: '#64748b' }}>Vị trí: </span>
                  <span style={{ color: '#dc2626', fontWeight: '500' }}>
                    📍 {selectedReport.location}
                  </span>
                </div>
              )}
            </div>

            {/* Full Report Content */}
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                📄 Nội dung phản ánh chi tiết:
              </label>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '14px',
                  borderRadius: '8px',
                  color: '#1e293b',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedReport.description || 'Không có mô tả chi tiết kèm theo.'}
              </div>
            </div>

            {/* Status & Priority Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: '#334155',
                  }}
                >
                  Trạng thái xử lý:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                >
                  <option value="pending">⏳ Chờ tiếp nhận (Pending / Mới)</option>
                  <option value="processing">🔄 Đang xử lý (Processing)</option>
                  <option value="resolved">✅ Đã xử lý (Resolved)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: '#334155',
                  }}
                >
                  Mức độ khẩn cấp:
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                >
                  <option value="high">🔴 Khẩn cấp / Cần can thiệp sớm</option>
                  <option value="normal">🟢 Bình thường / Theo quy trình</option>
                </select>
              </div>
            </div>

            {/* Staff Assignment */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: '#334155',
                }}
              >
                👤 Phân công cán bộ phụ trách xử lý:
              </label>
              <select
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              >
                <option value="">-- Chưa phân công --</option>
                {staffList.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.displayName} ({s.role}) - {s.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Note & Resolution */}
            <div style={{ marginBottom: '22px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: '#334155',
                }}
              >
                📝 Ghi chú / Tiến trình / Kết quả xử lý của Ban quản trị:
              </label>
              <textarea
                rows="3"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="Ví dụ: Đã cử bảo vệ kiểm tra hiện trường, phối hợp cùng giáo viên chủ nhiệm xử lý..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveReportChanges}
                style={{
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                }}
              >
                {isSaving ? '⏳ Đang lưu...' : '💾 Lưu cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseBadge {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ManageReports;
