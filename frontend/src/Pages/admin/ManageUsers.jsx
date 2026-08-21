import React, { useState, useEffect } from 'react';
import { getUsers, updateUser, deleteUser } from '../../api/admin';
import Modal from '../../components/Common/Modal';
import Toast from '../../components/Common/Toast';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // State cho Modal xác nhận (Khóa/Mở khóa hoặc Xóa)
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState(null); // 'toggle' | 'delete'
  const [showModal, setShowModal] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const fetchUsersList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getUsers();
      if (res && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách user:', err);
      setError(err.message || 'Không thể lấy danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  // Mở modal xác nhận thay đổi trạng thái user
  const handleOpenToggleStatusModal = (user) => {
    setSelectedUser(user);
    setModalType('toggle');
    setReasonInput('');
    setShowModal(true);
  };

  // Mở modal xác nhận xóa user
  const handleOpenDeleteModal = (user) => {
    setSelectedUser(user);
    setModalType('delete');
    setReasonInput('');
    setShowModal(true);
  };

  // Thực thi Khóa/Mở khóa hoặc Xóa user
  const handleConfirmAction = async (reasonText = '') => {
    if (!selectedUser || !modalType) return;

    if (modalType === 'toggle') {
      const newActiveState = !(selectedUser.is_active ?? true);
      try {
        await updateUser(selectedUser.uid, {
          is_active: newActiveState,
          reason: reasonText?.trim() || undefined,
        });

        setToast({
          message: newActiveState
            ? `Đã mở khóa tài khoản [${selectedUser.displayName || selectedUser.email}]`
            : `Đã khóa tài khoản [${selectedUser.displayName || selectedUser.email}] thành công!`,
          type: newActiveState ? 'success' : 'warning',
        });

        setShowModal(false);
        setSelectedUser(null);
        setModalType(null);
        setReasonInput('');
        fetchUsersList();
      } catch (err) {
        setToast({ message: 'Lỗi cập nhật trạng thái user: ' + err.message, type: 'error' });
      }
    } else if (modalType === 'delete') {
      try {
        await deleteUser(selectedUser.uid, reasonText?.trim() || '');

        setToast({
          message: `Đã xóa vĩnh viễn tài khoản [${selectedUser.displayName || selectedUser.email}] thành công!`,
          type: 'success',
        });

        setShowModal(false);
        setSelectedUser(null);
        setModalType(null);
        setReasonInput('');
        fetchUsersList();
      } catch (err) {
        setToast({ message: 'Lỗi khi xóa tài khoản: ' + err.message, type: 'error' });
      }
    }
  };

  // Đổi vai trò (Role) trực tiếp
  const handleChangeRole = async (user, newRole) => {
    try {
      await updateUser(user.uid, { role: newRole });
      setToast({ message: `Đã cập nhật vai trò [${newRole}] cho ${user.displayName || user.email}`, type: 'success' });
      fetchUsersList();
    } catch (err) {
      setToast({ message: 'Lỗi cập nhật vai trò: ' + err.message, type: 'error' });
    }
  };

  // Lọc dữ liệu theo SearchTerm & RoleFilter
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.uid || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = roleFilter === 'all' || (u.role || 'student').toLowerCase() === roleFilter.toLowerCase();

    return matchSearch && matchRole;
  });

  // Phân trang
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getModalProps = () => {
    if (modalType === 'delete') {
      return {
        title: '🗑️ Xác Nhận Xóa Vĩnh Viễn Tài Khoản',
        message: `Bạn có CỰC KỲ CHẮC CHẮN muốn XÓA VĨNH VIỄN tài khoản "${selectedUser?.displayName || selectedUser?.email}"? Thao tác này sẽ xóa tài khoản khỏi Firebase Auth & Firestore và KHÔNG THỂ HOÀN TÁC!`,
        variant: 'danger',
        confirmText: 'Xóa Vĩnh Viễn',
        inputPlaceholder: 'Nhập lý do xóa tài khoản (nếu có)...',
        requireInput: true,
      };
    }
    const isActive = selectedUser?.is_active ?? true;
    return {
      title: isActive ? '🔒 Xác nhận Khóa Tài Khoản' : '🔓 Xác nhận Mở Khóa Tài Khoản',
      message: isActive
        ? `Bạn có chắc chắn muốn KHÓA tài khoản "${selectedUser?.displayName || selectedUser?.email}"? Người dùng này sẽ không thể đăng nhập vào hệ thống SafeSchool.`
        : `Bạn có chắc chắn muốn MỞ KHÓA tài khoản "${selectedUser?.displayName || selectedUser?.email}"?`,
      variant: isActive ? 'danger' : 'success',
      confirmText: isActive ? 'Khóa Tài Khoản' : 'Mở Khóa',
      inputPlaceholder: isActive ? 'Nhập lý do khóa tài khoản...' : 'Nhập lý do mở khóa tài khoản (nếu có)...',
      requireInput: isActive,
    };
  };

  const modalProps = getModalProps();

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Confirmation Modal */}
      <Modal
        isOpen={showModal}
        title={modalProps.title}
        message={modalProps.message}
        variant={modalProps.variant}
        confirmText={modalProps.confirmText}
        cancelText="Hủy"
        inputPlaceholder={modalProps.inputPlaceholder}
        initialInputValue={reasonInput}
        requireInput={modalProps.requireInput}
        onConfirm={(value) => {
          setReasonInput(value || '');
          handleConfirmAction(value || '');
        }}
        onCancel={() => {
          setShowModal(false);
          setSelectedUser(null);
          setModalType(null);
          setReasonInput('');
        }}
      />

      {/* Header Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a', fontWeight: '700' }}>
          👥 Quản Lý Người Dùng & Phân Quyền
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
          Xem danh sách, phân quyền vai trò, khóa/mở khóa hoặc xóa vĩnh viễn tài khoản người dùng
        </p>
      </div>

      {/* Control Bar: Search & Filter */}
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
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm theo Tên, Email hoặc UID..."
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

        {/* Role Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Lọc Vai Trò:</label>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
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
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Admin (Quản trị)</option>
            <option value="teacher">Teacher (Giáo viên)</option>
            <option value="student">Student (Học sinh)</option>
            <option value="counselor">Counselor (Tâm lý)</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <span style={{ fontSize: '2rem' }}>⏳</span>
          <p style={{ color: '#64748b', marginTop: '8px' }}>Đang tải danh sách người dùng...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', margin: '0 0 12px' }}>⚠️ {error}</p>
          <button onClick={fetchUsersList} style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            🔄 Thử lại
          </button>
        </div>
      )}

      {/* Users Table */}
      {!loading && !error && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
          <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Thông Tin Tài Khoản</th>
                <th style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Email</th>
                <th style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Vai Trò</th>
                <th style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                <th style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '170px' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    Không tìm thấy người dùng nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isActive = u.is_active ?? true;
                  const isAdmin = (u.role || '').toLowerCase() === 'admin';

                  return (
                    <tr key={u.uid} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                      {/* 1. Account Info: Avatar + Name + UID */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              backgroundColor: isAdmin ? '#dc2626' : '#1e3c72',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '0.95rem',
                              flexShrink: 0,
                            }}
                          >
                            {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                              {u.displayName || 'Chưa đặt tên'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              UID: {u.uid.substring(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Email */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', color: '#334155', whiteSpace: 'nowrap', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.email || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Ẩn danh / Không email</span>}
                      </td>

                      {/* 3. Role Dropdown */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <select
                          value={u.role || 'student'}
                          onChange={(e) => handleChangeRole(u, e.target.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            backgroundColor: isAdmin ? '#fef2f2' : '#f0fdf4',
                            color: isAdmin ? '#dc2626' : '#16a34a',
                            cursor: 'pointer',
                            outline: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="counselor">Counselor</option>
                          <option value="admin">Admin (Tối cao)</option>
                        </select>
                      </td>

                      {/* 4. Status Badge */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {isActive ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}>
                            ● Hoạt động
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}>
                            🔒 Đã khóa
                          </span>
                        )}
                      </td>

                      {/* 5. Actions: Lock/Unlock & Delete */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenToggleStatusModal(u)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: isActive ? '1px solid #fecaca' : '1px solid #bbf7d0',
                              backgroundColor: isActive ? '#fef2f2' : '#f0fdf4',
                              color: isActive ? '#dc2626' : '#16a34a',
                              fontWeight: '600',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isActive ? '🔒 Khóa' : '🔓 Mở'}
                          </button>

                          <button
                            onClick={() => handleOpenDeleteModal(u)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #fecdd3',
                              backgroundColor: '#fff1f2',
                              color: '#e11d48',
                              fontWeight: '600',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease',
                            }}
                            title="Xóa vĩnh viễn tài khoản người dùng"
                          >
                            🗑️ Xóa
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
                Hiển thị trang {currentPage} / {totalPages} (Tổng {filteredUsers.length} tài khoản)
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
    </div>
  );
};

export default ManageUsers;
