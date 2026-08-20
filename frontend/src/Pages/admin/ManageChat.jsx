import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Common/Modal';
import Toast from '../../components/Common/Toast';
import {
  subscribeToRooms,
  subscribeToMessages,
  createChatRoom,
  updateChatRoom,
  closeChatRoom,
  deleteChatRoom,
  formatTimestamp,
} from '../../services/chatService';
import './ManageChat.css';

const ManageChat = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const messagesEndRef = useRef(null);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  useEffect(() => {
    const unsub = subscribeToRooms(setRooms, statusFilter);
    return unsub;
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      return undefined;
    }

    const unsub = subscribeToMessages(selectedRoomId, setMessages);
    return unsub;
  }, [selectedRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateRoom = async (title) => {
    if (!title?.trim()) return;

    try {
      const roomId = await createChatRoom({
        title: title.trim(),
        userId: user.uid,
        userName: user.displayName || 'Admin',
        userRole: user.role || 'admin',
      });
      setShowCreateModal(false);
      setSelectedRoomId(roomId);
      setToast({ message: 'Đã tạo phòng chat mới!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Lỗi tạo phòng: ' + err.message, type: 'error' });
    }
  };

  const handleEditRoom = async (newTitle) => {
    if (!selectedRoomId || !newTitle?.trim()) return;

    try {
      await updateChatRoom(selectedRoomId, { title: newTitle.trim() });
      setShowEditModal(false);
      setToast({ message: 'Đã cập nhật phòng chat!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Lỗi cập nhật: ' + err.message, type: 'error' });
    }
  };

  const handleCloseRoom = async () => {
    if (!selectedRoomId) return;

    try {
      await closeChatRoom(selectedRoomId, user.displayName || 'Admin');
      setShowCloseModal(false);
      setToast({ message: 'Đã đóng phòng chat!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Lỗi đóng phòng: ' + err.message, type: 'error' });
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoomId) return;

    try {
      await deleteChatRoom(selectedRoomId);
      setShowDeleteModal(false);
      setSelectedRoomId(null);
      setToast({ message: 'Đã xóa phòng chat!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Lỗi xóa phòng: ' + err.message, type: 'error' });
    }
  };

  const filteredRooms = rooms;

  return (
    <div className="manage-chat-page">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Tạo phòng chat */}
      <Modal
        isOpen={showCreateModal}
        title="Tạo phòng chat"
        message="Tạo phòng chat mới cho học sinh tham gia trao đổi."
        inputPlaceholder="Tên phòng chat..."
        requireInput
        confirmText="Tạo phòng"
        cancelText="Hủy"
        onConfirm={handleCreateRoom}
        onCancel={() => setShowCreateModal(false)}
      />

      {/* Chỉnh sửa phòng */}
      <Modal
        isOpen={showEditModal}
        title="Chỉnh sửa phòng chat"
        message={`Cập nhật tên phòng "${selectedRoom?.title}"`}
        inputPlaceholder="Tên phòng mới..."
        initialInputValue={selectedRoom?.title || ''}
        requireInput
        confirmText="Lưu"
        cancelText="Hủy"
        onConfirm={handleEditRoom}
        onCancel={() => setShowEditModal(false)}
      />

      {/* Đóng phòng chat */}
      <Modal
        isOpen={showCloseModal}
        title="Đóng phòng chat"
        message={`Bạn có chắc muốn đóng phòng "${selectedRoom?.title}"? Học sinh sẽ không thể gửi tin nhắn mới.`}
        variant="danger"
        confirmText="Đóng phòng"
        cancelText="Hủy"
        onConfirm={handleCloseRoom}
        onCancel={() => setShowCloseModal(false)}
      />

      {/* Xóa phòng chat */}
      <Modal
        isOpen={showDeleteModal}
        title="Xóa phòng chat"
        message={`Bạn có chắc muốn XÓA VĨNH VIỄN phòng "${selectedRoom?.title}"? Hành động này không thể hoàn tác.`}
        variant="danger"
        confirmText="Xóa vĩnh viễn"
        cancelText="Hủy"
        onConfirm={handleDeleteRoom}
        onCancel={() => setShowDeleteModal(false)}
      />

      <div className="manage-chat-header">
        <div>
          <h1>Quản lý phòng chat</h1>
          <p>Theo dõi, xem nội dung chat mà không cần tham gia, chỉnh sửa hoặc đóng/xóa phòng.</p>
        </div>
        <div className="manage-chat-actions">
          <button className="btn-admin btn-admin-primary" onClick={() => setShowCreateModal(true)}>
            + Tạo phòng chat
          </button>
        </div>
      </div>

      {/* Bộ lọc trạng thái */}
      <div className="filter-bar">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'open', label: 'Đang mở' },
          { key: 'closed', label: 'Đã đóng' },
        ].map((f) => (
          <button
            key={f.key}
            className={`filter-btn ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="manage-chat-layout">
        {/* Xem danh sách phòng chat */}
        <div className="rooms-panel">
          <div className="rooms-panel-header">
            <span>Danh sách phòng chat</span>
            <span className="rooms-count">{filteredRooms.length} phòng</span>
          </div>

          <div className="rooms-table-wrap">
            {filteredRooms.length === 0 ? (
              <div className="loading-state">Chưa có phòng chat nào.</div>
            ) : (
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>Tên phòng</th>
                    <th>Người tạo</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => (
                    <tr
                      key={room.id}
                      className={selectedRoomId === room.id ? 'selected' : ''}
                      onClick={() => setSelectedRoomId(room.id)}
                    >
                      <td>
                        <strong>{room.title}</strong>
                        {room.lastMessage && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            {room.lastMessage.substring(0, 40)}
                            {room.lastMessage.length > 40 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td>{room.createdByName}</td>
                      <td>
                        <span className={`status-badge ${room.status}`}>
                          {room.status === 'open' ? '● Mở' : '● Đóng'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="row-action-btn view"
                            title="Xem chat"
                            onClick={() => setSelectedRoomId(room.id)}
                          >
                            👁 Xem
                          </button>
                          <button
                            className="row-action-btn edit"
                            title="Chỉnh sửa"
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              setShowEditModal(true);
                            }}
                          >
                            ✏ Sửa
                          </button>
                          <button
                            className="row-action-btn delete"
                            title="Xóa"
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              setShowDeleteModal(true);
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Xem chat - chỉ đọc, không tham gia */}
        <div className="preview-panel">
          {!selectedRoom ? (
            <div className="preview-empty">
              <div className="preview-empty-icon">👁</div>
              <h3>Chọn phòng để xem nội dung chat</h3>
              <p>Admin có thể xem toàn bộ tin nhắn mà không cần tham gia phòng chat.</p>
            </div>
          ) : (
            <>
              <div className="preview-panel-header">
                <h3>{selectedRoom.title}</h3>
                <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                  Tạo bởi {selectedRoom.createdByName} · {selectedRoom.participantIds?.length || 0} thành viên
                </div>
                <span className="preview-badge">👁 Chế độ xem — không tham gia chat</span>
              </div>

              <div className="preview-messages">
                {messages.length === 0 ? (
                  <div className="preview-empty" style={{ padding: '20px' }}>
                    <p>Chưa có tin nhắn nào trong phòng này.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`preview-message ${msg.senderRole === 'system' ? 'system' : ''}`}
                    >
                      {msg.senderRole !== 'system' && (
                        <span className="preview-message-sender">
                          {msg.senderName}
                          {msg.senderRole === 'admin' && ' (Admin)'}
                        </span>
                      )}
                      <div className="preview-message-bubble">{msg.text}</div>
                      {msg.senderRole !== 'system' && (
                        <span className="preview-message-time">{formatTimestamp(msg.createdAt)}</span>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="preview-footer">
                <button
                  className="btn-preview-action btn-preview-edit"
                  onClick={() => setShowEditModal(true)}
                >
                  ✏ Chỉnh sửa
                </button>
                {selectedRoom.status === 'open' && (
                  <button
                    className="btn-preview-action btn-preview-close"
                    onClick={() => setShowCloseModal(true)}
                  >
                    🔒 Đóng phòng
                  </button>
                )}
                <button
                  className="btn-preview-action btn-preview-delete"
                  onClick={() => setShowDeleteModal(true)}
                >
                  🗑 Xóa
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageChat;
