import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Common/Modal';
import Toast from '../components/Common/Toast';
import {
  subscribeToRooms,
  subscribeToRoomsByType,
  subscribeToMessages,
  createExpertRoom,
  createStudentGroup,
  joinChatRoom,
  sendMessage,
  closeChatRoom,
  updateUserPresence,
  formatTimestamp,
  fetchUsers,
  ensureTeacherRoom,
  ROOM_TYPES,
  TEACHER_ROOM_ID,
} from '../services/chatService';
import './Chat.css';


// ─── Helper ─────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  student: 'Học sinh',
  teacher: 'Giáo viên',
  parent: 'Phụ huynh',
  expert: 'Chuyên gia',
  admin: 'Admin',
};

const ROLE_BADGE_CLASS = {
  student: 'role-student',
  teacher: 'role-teacher',
  parent: 'role-parent',
  expert: 'role-expert',
  admin: 'role-admin',
};

function getRoleBadge(role) {
  return (
    <span className={`role-badge ${ROLE_BADGE_CLASS[role] || ''}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

function getTabs(userRole) {
  const tabs = [];
  if (userRole === 'expert' || userRole === 'admin') {
    tabs.push({ id: 'expert', label: '📋 Tư vấn (Chuyên gia)', icon: '📋' });
  }
  if (userRole === 'teacher' || userRole === 'admin' || userRole === 'expert') {
    tabs.push({ id: 'teacher', label: '👩‍🏫 Phòng Giáo Viên', icon: '👩‍🏫' });
  }
  if (userRole === 'student' || userRole === 'admin') {
    tabs.push({ id: 'student', label: '🧑‍🤝‍🧑 Nhóm Học Sinh', icon: '🧑‍🤝‍🧑' });
  }
  // Consultation rooms visible to all (students can see rooms they're invited to)
  tabs.push({ id: 'my', label: '💬 Phòng của tôi', icon: '💬' });
  return tabs;
}

// ─── Message Area sub-component ───────────────────────────────────────────────

function MessageArea({ selectedRoom, messages, messageText, setMessageText, sending, onSend, onKeyDown, user, onCloseRoom }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isParticipant = selectedRoom?.participantIds?.includes(user?.uid);
  const isClosed = selectedRoom?.status === 'closed';
  const isOwner = selectedRoom?.createdBy === user?.uid;
  const isAdmin = user?.role === 'admin';

  if (!selectedRoom) {
    return (
      <div className="chat-main-empty">
        <div className="chat-main-empty-icon">💬</div>
        <h3>Chọn hoặc tạo phòng chat</h3>
        <p>Chọn phòng từ danh sách bên trái hoặc tạo phòng mới để bắt đầu trao đổi.</p>
      </div>
    );
  }

  return (
    <>
      <div className="chat-room-header">
        <div>
          <h3>{selectedRoom.title}</h3>
          <div className="chat-room-header-meta">
            Tạo bởi {selectedRoom.createdByName} · {selectedRoom.participantIds?.length || 0} thành viên
          </div>
        </div>
        {(isOwner || isAdmin) && !isClosed && (
          <button className="btn-close-room" onClick={onCloseRoom}>
            🔒 Đóng phòng
          </button>
        )}
      </div>

      <div className="messages-area">
        {messages.map((msg) => {
          const isOwn = msg.senderId === user.uid;
          const isSystem = msg.senderRole === 'system';
          return (
            <div
              key={msg.id}
              className={`message ${isSystem ? 'system' : isOwn ? 'own' : 'other'}`}
            >
              {!isSystem && !isOwn && (
                <span className="message-sender">
                  {msg.senderName}
                  {msg.senderRole && msg.senderRole !== 'student' && (
                    <span className={`msg-role-tag ${ROLE_BADGE_CLASS[msg.senderRole] || ''}`}>
                      {ROLE_LABELS[msg.senderRole] || msg.senderRole}
                    </span>
                  )}
                </span>
              )}
              <div className="message-bubble">{msg.text}</div>
              {!isSystem && (
                <span className="message-time">{formatTimestamp(msg.createdAt)}</span>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {isClosed ? (
        <div className="chat-closed-notice">
          🔒 Phòng chat này đã được đóng. Không thể gửi tin nhắn mới.
        </div>
      ) : !isParticipant ? (
        <div className="chat-closed-notice" style={{ color: 'var(--primary)' }}>
          Bạn chưa được thêm vào phòng này.
        </div>
      ) : (
        <div className="chat-input-area">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Nhập tin nhắn... (Enter để gửi)"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
          />
          <button
            className="btn-send"
            onClick={onSend}
            disabled={!messageText.trim() || sending}
          >
            ➤ Gửi
          </button>
        </div>
      )}
    </>
  );
}

// ─── Room Sidebar sub-component ───────────────────────────────────────────────

function RoomSidebar({ rooms, selectedRoomId, onSelectRoom, onCreateRoom, createLabel, createDisabled }) {
  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>Danh sách phòng</h2>
        {onCreateRoom && (
          <button
            className="btn-create-room"
            onClick={onCreateRoom}
            disabled={createDisabled}
          >
            <span>+</span> {createLabel || 'Tạo phòng'}
          </button>
        )}
      </div>
      <div className="room-list">
        {rooms.length === 0 ? (
          <div className="room-empty">
            <p>Chưa có phòng chat nào.</p>
            {onCreateRoom && <p>Nhấn &quot;Tạo phòng&quot; để bắt đầu!</p>}
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              className={`room-item ${selectedRoomId === room.id ? 'active' : ''}`}
              onClick={() => onSelectRoom(room)}
            >
              <div className="room-item-title">{room.title}</div>
              <div className="room-item-meta">
                <span>{room.createdByName}</span>
                <span className={`room-status ${room.status}`}>
                  {room.status === 'open' ? '● Mở' : '● Đóng'}
                </span>
              </div>
              {room.lastMessage && (
                <div className="room-item-preview">{room.lastMessage}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

// ─── Expert Tab ───────────────────────────────────────────────────────────────

function ExpertTab({ user, onToast }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Create room modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1=name, 2=pick users
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userFilter, setUserFilter] = useState('all');

  const [showCloseModal, setShowCloseModal] = useState(false);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  useEffect(() => {
    const unsub = subscribeToRoomsByType(ROOM_TYPES.CONSULTATION, setRooms, 'open');
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedRoomId) { setMessages([]); return undefined; }
    const unsub = subscribeToMessages(selectedRoomId, setMessages);
    return unsub;
  }, [selectedRoomId]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    updateUserPresence(user.uid, selectedRoomId || null);
    return () => { updateUserPresence(user.uid, null); };
  }, [user?.uid, selectedRoomId]);

  const openCreateModal = async () => {
    setCreateStep(1);
    setNewRoomTitle('');
    setSelectedUserIds([]);
    setUserFilter('all');
    setShowCreate(true);
    setUsersLoading(true);
    try {
      const users = await fetchUsers();
      setAllUsers(users.filter((u) => u.id !== user.uid));
    } catch {
      onToast('Không thể tải danh sách người dùng', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const filteredUsers = userFilter === 'all'
    ? allUsers
    : allUsers.filter((u) => u.role === userFilter);

  const toggleUser = (uid) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return;
    try {
      const roomId = await createExpertRoom({
        title: newRoomTitle.trim(),
        expertId: user.uid,
        expertName: user.displayName,
        invitedUserIds: selectedUserIds,
      });
      setShowCreate(false);
      setSelectedRoomId(roomId);
      onToast('Đã tạo phòng tư vấn!', 'success');
    } catch (err) {
      onToast('Lỗi tạo phòng: ' + err.message, 'error');
    }
  };

  const handleSelectRoom = async (room) => {
    try {
      await joinChatRoom(room.id, user.uid, user.role || 'expert');
      setSelectedRoomId(room.id);
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedRoomId) return;
    setSending(true);
    try {
      await sendMessage({
        roomId: selectedRoomId,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: user.role || 'expert',
        text: messageText,
      });
      setMessageText('');
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCloseRoom = async () => {
    try {
      await closeChatRoom(selectedRoomId, user.displayName);
      setShowCloseModal(false);
      setSelectedRoomId(null);
      onToast('Đã đóng phòng tư vấn.', 'success');
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  return (
    <div className="chat-layout">
      {/* Create Room Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="create-room-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Tạo phòng tư vấn</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            {createStep === 1 ? (
              <div className="modal-body">
                <label className="form-label">Tên phòng tư vấn</label>
                <input
                  className="form-input"
                  placeholder="VD: Tư vấn tâm lý học đường - Lớp 10A"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  autoFocus
                />
                <div className="modal-footer">
                  <button className="btn-modal-cancel" onClick={() => setShowCreate(false)}>Hủy</button>
                  <button
                    className="btn-modal-confirm"
                    onClick={() => setCreateStep(2)}
                    disabled={!newRoomTitle.trim()}
                  >
                    Tiếp theo →
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                <p className="form-desc">
                  Chọn học sinh, giáo viên hoặc phụ huynh từ danh sách đăng ký để thêm vào phòng <strong>{newRoomTitle}</strong>:
                </p>
                <div className="user-filter-tabs">
                  {['all', 'student', 'teacher', 'parent'].map((r) => (
                    <button
                      key={r}
                      className={`filter-tab ${userFilter === r ? 'active' : ''}`}
                      onClick={() => setUserFilter(r)}
                    >
                      {r === 'all' ? 'Tất cả' : ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
                {usersLoading ? (
                  <div className="loading-users">Đang tải danh sách...</div>
                ) : (
                  <div className="user-pick-list">
                    {filteredUsers.length === 0 ? (
                      <p className="no-users">Không có người dùng nào.</p>
                    ) : (
                      filteredUsers.map((u) => (
                        <label key={u.id} className="user-pick-item">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                          <div className="user-pick-info">
                            <span className="user-pick-name">{u.displayName || u.DisplayName || u.email}</span>
                            {getRoleBadge(u.role)}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <div className="modal-footer">
                  <button className="btn-modal-cancel" onClick={() => setCreateStep(1)}>← Quay lại</button>
                  <span className="selected-count">{selectedUserIds.length} đã chọn</span>
                  <button className="btn-modal-confirm" onClick={handleCreateRoom}>
                    ✓ Tạo phòng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Room Modal */}
      <Modal
        isOpen={showCloseModal}
        title="Đóng phòng tư vấn"
        message={`Bạn có chắc muốn đóng phòng "${selectedRoom?.title}"?`}
        variant="danger"
        confirmText="Đóng phòng"
        cancelText="Hủy"
        onConfirm={handleCloseRoom}
        onCancel={() => setShowCloseModal(false)}
      />

      <RoomSidebar
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={openCreateModal}
        createLabel="Tạo phòng tư vấn"
      />

      <section className="chat-main">
        <MessageArea
          selectedRoom={selectedRoom}
          messages={messages}
          messageText={messageText}
          setMessageText={setMessageText}
          sending={sending}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          user={user}
          onCloseRoom={() => setShowCloseModal(true)}
        />
      </section>
    </div>
  );
}

// ─── Teacher Tab ──────────────────────────────────────────────────────────────

function TeacherTab({ user, onToast }) {
  const [selectedRoomId, setSelectedRoomId] = useState(TEACHER_ROOM_ID);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    // Ensure teacher room exists then join
    ensureTeacherRoom().then(() => {
      joinChatRoom(TEACHER_ROOM_ID, user.uid, user.role || 'teacher').catch(() => {});
    });
  }, [user.uid, user.role]);

  useEffect(() => {
    const unsub = subscribeToMessages(TEACHER_ROOM_ID, setMessages);
    return unsub;
  }, []);

  // Subscribe to room doc to get metadata
  useEffect(() => {
    let unsubscribe = null;
    Promise.all([
      import('firebase/firestore'),
      import('../firebase/config'),
    ]).then(([firestoreModule, configModule]) => {
      const { onSnapshot, doc: firestoreDoc } = firestoreModule;
      const { db } = configModule;
      unsubscribe = onSnapshot(firestoreDoc(db, 'chatRooms', TEACHER_ROOM_ID), (snap) => {
        if (snap.exists()) setRoom({ id: snap.id, ...snap.data() });
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    updateUserPresence(user.uid, TEACHER_ROOM_ID);
    return () => { updateUserPresence(user.uid, null); };
  }, [user?.uid]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        roomId: TEACHER_ROOM_ID,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: user.role || 'teacher',
        text: messageText,
      });
      setMessageText('');
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="teacher-room-layout">
      <div className="teacher-room-banner">
        <div className="teacher-room-banner-icon">👩‍🏫</div>
        <div>
          <h2>Phòng Giáo Viên</h2>
          <p>Phòng chat dành riêng cho giáo viên — chỉ giáo viên và chuyên gia mới có thể tham gia.</p>
        </div>
        <div className="teacher-room-badge">🔒 Riêng tư</div>
      </div>
      <div className="chat-layout" style={{ height: 'calc(100vh - var(--header-height) - 240px)' }}>
        <section className="chat-main" style={{ width: '100%' }}>
          <MessageArea
            selectedRoom={room || { id: TEACHER_ROOM_ID, title: 'Phòng Giáo Viên', createdByName: 'Hệ thống', participantIds: [user.uid] }}
            messages={messages}
            messageText={messageText}
            setMessageText={setMessageText}
            sending={sending}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            user={user}
            onCloseRoom={null}
          />
        </section>
      </div>
    </div>
  );
}

// ─── Student Tab ──────────────────────────────────────────────────────────────

function StudentTab({ user, onToast }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  useEffect(() => {
    const unsub = subscribeToRoomsByType(ROOM_TYPES.STUDENT_GROUP, (data) => {
      // Students only see their own rooms
      setRooms(data.filter((r) => r.participantIds?.includes(user.uid)));
    }, 'open');
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    if (!selectedRoomId) { setMessages([]); return undefined; }
    const unsub = subscribeToMessages(selectedRoomId, setMessages);
    return unsub;
  }, [selectedRoomId]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    updateUserPresence(user.uid, selectedRoomId || null);
    return () => { updateUserPresence(user.uid, null); };
  }, [user?.uid, selectedRoomId]);

  const openCreateModal = async () => {
    setCreateStep(1);
    setNewRoomTitle('');
    setSelectedStudentIds([]);
    setShowCreate(true);
    setStudentsLoading(true);
    try {
      const students = await fetchUsers('student');
      setAllStudents(students.filter((s) => s.id !== user.uid));
    } catch {
      onToast('Không thể tải danh sách học sinh', 'error');
    } finally {
      setStudentsLoading(false);
    }
  };

  const toggleStudent = (uid) => {
    setSelectedStudentIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = async () => {
    if (!newRoomTitle.trim()) return;
    try {
      const roomId = await createStudentGroup({
        title: newRoomTitle.trim(),
        creatorId: user.uid,
        creatorName: user.displayName,
        invitedStudentIds: selectedStudentIds,
      });
      setShowCreate(false);
      setSelectedRoomId(roomId);
      onToast('Đã tạo nhóm chat!', 'success');
    } catch (err) {
      onToast('Lỗi tạo nhóm: ' + err.message, 'error');
    }
  };

  const handleSelectRoom = async (room) => {
    try {
      await joinChatRoom(room.id, user.uid, 'student');
      setSelectedRoomId(room.id);
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedRoomId) return;
    setSending(true);
    try {
      await sendMessage({
        roomId: selectedRoomId,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: 'student',
        text: messageText,
      });
      setMessageText('');
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCloseRoom = async () => {
    try {
      await closeChatRoom(selectedRoomId, user.displayName);
      setShowCloseModal(false);
      setSelectedRoomId(null);
      onToast('Đã đóng nhóm chat.', 'success');
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  return (
    <div className="chat-layout">
      {/* Create Group Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="create-room-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🧑‍🤝‍🧑 Tạo nhóm chat học sinh</h3>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            {createStep === 1 ? (
              <div className="modal-body">
                <label className="form-label">Tên nhóm chat</label>
                <input
                  className="form-input"
                  placeholder="VD: Nhóm học tập lớp 10A"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  autoFocus
                />
                <div className="modal-footer">
                  <button className="btn-modal-cancel" onClick={() => setShowCreate(false)}>Hủy</button>
                  <button
                    className="btn-modal-confirm"
                    onClick={() => setCreateStep(2)}
                    disabled={!newRoomTitle.trim()}
                  >
                    Tiếp theo →
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                <p className="form-desc">
                  Chọn học sinh để thêm vào nhóm <strong>{newRoomTitle}</strong>:
                </p>
                {studentsLoading ? (
                  <div className="loading-users">Đang tải danh sách học sinh...</div>
                ) : (
                  <div className="user-pick-list">
                    {allStudents.length === 0 ? (
                      <p className="no-users">Không có học sinh nào khác.</p>
                    ) : (
                      allStudents.map((s) => (
                        <label key={s.id} className="user-pick-item">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(s.id)}
                            onChange={() => toggleStudent(s.id)}
                          />
                          <div className="user-pick-info">
                            <span className="user-pick-name">{s.displayName || s.DisplayName || s.email}</span>
                            {getRoleBadge(s.role)}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <div className="modal-footer">
                  <button className="btn-modal-cancel" onClick={() => setCreateStep(1)}>← Quay lại</button>
                  <span className="selected-count">{selectedStudentIds.length} đã chọn</span>
                  <button className="btn-modal-confirm" onClick={handleCreateGroup}>
                    ✓ Tạo nhóm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={showCloseModal}
        title="Đóng nhóm chat"
        message={`Bạn có chắc muốn đóng nhóm "${selectedRoom?.title}"?`}
        variant="danger"
        confirmText="Đóng nhóm"
        cancelText="Hủy"
        onConfirm={handleCloseRoom}
        onCancel={() => setShowCloseModal(false)}
      />

      <RoomSidebar
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={openCreateModal}
        createLabel="Tạo nhóm"
      />

      <section className="chat-main">
        <MessageArea
          selectedRoom={selectedRoom}
          messages={messages}
          messageText={messageText}
          setMessageText={setMessageText}
          sending={sending}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          user={user}
          onCloseRoom={() => setShowCloseModal(true)}
        />
      </section>
    </div>
  );
}

// ─── My Rooms Tab (consultation rooms visible to user) ────────────────────────

function MyRoomsTab({ user, onToast }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  useEffect(() => {
    // Show all open rooms of consultation type that include this user
    const unsub = subscribeToRooms((data) => {
      setRooms(
        data.filter(
          (r) =>
            r.status === 'open' &&
            (r.type === ROOM_TYPES.CONSULTATION || r.type === ROOM_TYPES.GENERAL || !r.type) &&
            r.participantIds?.includes(user.uid)
        )
      );
    });
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    if (!selectedRoomId) { setMessages([]); return undefined; }
    const unsub = subscribeToMessages(selectedRoomId, setMessages);
    return unsub;
  }, [selectedRoomId]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    updateUserPresence(user.uid, selectedRoomId || null);
    return () => { updateUserPresence(user.uid, null); };
  }, [user?.uid, selectedRoomId]);

  const handleSelectRoom = async (room) => {
    try {
      await joinChatRoom(room.id, user.uid, user.role || 'student');
      setSelectedRoomId(room.id);
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedRoomId) return;
    setSending(true);
    try {
      await sendMessage({
        roomId: selectedRoomId,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: user.role || 'student',
        text: messageText,
      });
      setMessageText('');
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCloseRoom = async () => {
    try {
      await closeChatRoom(selectedRoomId, user.displayName);
      setShowCloseModal(false);
      setSelectedRoomId(null);
      onToast('Đã đóng phòng chat.', 'success');
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  return (
    <div className="chat-layout">
      <Modal
        isOpen={showCloseModal}
        title="Đóng phòng chat"
        message={`Bạn có chắc muốn đóng phòng "${selectedRoom?.title}"?`}
        variant="danger"
        confirmText="Đóng phòng"
        cancelText="Hủy"
        onConfirm={handleCloseRoom}
        onCancel={() => setShowCloseModal(false)}
      />

      <RoomSidebar
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={null}
      />

      <section className="chat-main">
        <MessageArea
          selectedRoom={selectedRoom}
          messages={messages}
          messageText={messageText}
          setMessageText={setMessageText}
          sending={sending}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          user={user}
          onCloseRoom={() => setShowCloseModal(true)}
        />
      </section>
    </div>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export default function Chat() {
  const { user } = useAuth();
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [activeTab, setActiveTab] = useState(null);

  const userRole = user?.role || 'student';
  const tabs = getTabs(userRole);

  // Set default tab
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [userRole]);

  const handleToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  return (
    <div className="chat-page">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />

      <div className="chat-container">
        <div className="chat-header">
          <h1>
            💬 Chat tư vấn học đường
          </h1>
          <p>
            Trao đổi bảo mật với chuyên gia, giáo viên và bạn cùng lớp.{' '}
            {getRoleBadge(userRole)}
          </p>
        </div>

        {/* Tabs */}
        <div className="chat-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`chat-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="chat-tab-content">
          {activeTab === 'expert' && (userRole === 'expert' || userRole === 'admin') && (
            <ExpertTab user={user} onToast={handleToast} />
          )}
          {activeTab === 'teacher' && (
            <TeacherTab user={user} onToast={handleToast} />
          )}
          {activeTab === 'student' && (
            <StudentTab user={user} onToast={handleToast} />
          )}
          {activeTab === 'my' && (
            <MyRoomsTab user={user} onToast={handleToast} />
          )}
        </div>
      </div>
    </div>
  );
}
