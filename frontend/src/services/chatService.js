import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ROOMS_COLLECTION = 'chatRooms';

// Room types
export const ROOM_TYPES = {
  CONSULTATION: 'consultation',   // Expert creates from registration list
  STUDENT_GROUP: 'student_group', // Student creates group with other students
  TEACHER_ONLY: 'teacher_only',   // Default teacher-only room
  GENERAL: 'general',             // General room (legacy)
};

// Teacher-only room ID (fixed)
export const TEACHER_ROOM_ID = 'teacher-lounge';

/**
 * Ensure the default teacher-only room exists in Firestore.
 * Called once at app startup (or when a teacher visits the chat page).
 */
export async function ensureTeacherRoom() {
  const roomRef = doc(db, ROOMS_COLLECTION, TEACHER_ROOM_ID);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      title: 'Phòng Giáo Viên',
      createdBy: 'system',
      createdByName: 'Hệ thống',
      status: 'open',
      type: ROOM_TYPES.TEACHER_ONLY,
      allowedRoles: ['teacher', 'admin', 'expert'],
      participantIds: [],
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: '',
      isDefault: true,
    });
  }
  return TEACHER_ROOM_ID;
}

export function subscribeToRooms(callback, statusFilter = null) {
  const q = query(collection(db, ROOMS_COLLECTION), orderBy('lastMessageAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      let rooms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (statusFilter && statusFilter !== 'all') {
        rooms = rooms.filter((r) => r.status === statusFilter);
      }
      callback(rooms);
    },
    (error) => {
      console.error('Lỗi lấy danh sách phòng chat:', error);
      callback([]);
    }
  );
}

/**
 * Subscribe to rooms filtered by type (and optionally status).
 * Filters in memory to avoid requiring a Firestore composite index.
 */
export function subscribeToRoomsByType(type, callback, statusFilter = null) {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      let rooms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      rooms = rooms.filter((r) => r.type === type);
      if (statusFilter && statusFilter !== 'all') {
        rooms = rooms.filter((r) => r.status === statusFilter);
      }
      callback(rooms);
    },
    (error) => {
      console.error('Lỗi lấy danh sách phòng theo loại:', error);
      callback([]);
    }
  );
}

/**
 * Subscribe to rooms where the user is a participant.
 */
export function subscribeToMyRooms(userId, callback) {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    where('participantIds', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rooms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(rooms);
    },
    (error) => {
      console.error('Lỗi lấy phòng của tôi:', error);
      callback([]);
    }
  );
}

export function subscribeToMessages(roomId, callback) {
  const q = query(
    collection(db, ROOMS_COLLECTION, roomId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(messages);
    },
    (error) => {
      console.error('Lỗi lấy tin nhắn:', error);
      callback([]);
    }
  );
}

export async function createChatRoom({ title, userId, userName, userRole, type = ROOM_TYPES.GENERAL, invitedUserIds = [], allowedRoles = null }) {
  const roomData = {
    title: title.trim(),
    createdBy: userId,
    createdByName: userName,
    status: 'open',
    type,
    participantIds: [userId, ...invitedUserIds.filter((id) => id !== userId)],
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessage: '',
  };

  if (allowedRoles) {
    roomData.allowedRoles = allowedRoles;
  }

  const roomRef = await addDoc(collection(db, ROOMS_COLLECTION), roomData);

  await addDoc(collection(db, ROOMS_COLLECTION, roomRef.id, 'messages'), {
    senderId: 'system',
    senderName: 'Hệ thống',
    senderRole: 'system',
    text: `${userName} đã tạo phòng chat "${title.trim()}"`,
    createdAt: serverTimestamp(),
  });

  return roomRef.id;
}

/**
 * Expert creates a consultation room from a registration list.
 * invitedUserIds: array of user IDs (students, teachers, parents) from registrations.
 */
export async function createExpertRoom({ title, expertId, expertName, invitedUserIds = [] }) {
  return createChatRoom({
    title,
    userId: expertId,
    userName: expertName,
    userRole: 'expert',
    type: ROOM_TYPES.CONSULTATION,
    invitedUserIds,
  });
}

/**
 * Student creates a group chat with other students.
 * invitedStudentIds: array of student UIDs.
 */
export async function createStudentGroup({ title, creatorId, creatorName, invitedStudentIds = [] }) {
  return createChatRoom({
    title,
    userId: creatorId,
    userName: creatorName,
    userRole: 'student',
    type: ROOM_TYPES.STUDENT_GROUP,
    invitedUserIds: invitedStudentIds,
    allowedRoles: ['student'],
  });
}

export async function joinChatRoom(roomId, userId, userRole = 'student') {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error('Phòng chat không tồn tại');
  }

  const room = roomSnap.data();
  if (room.status === 'closed') {
    throw new Error('Phòng chat đã được đóng');
  }

  // Check role restriction
  if (room.allowedRoles && !room.allowedRoles.includes(userRole)) {
    throw new Error('Bạn không có quyền tham gia phòng này');
  }

  if (!room.participantIds?.includes(userId)) {
    await updateDoc(roomRef, {
      participantIds: arrayUnion(userId),
    });
  }

  return roomId;
}

export async function sendMessage({ roomId, senderId, senderName, senderRole, text }) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error('Phòng chat không tồn tại');
  }

  if (roomSnap.data().status === 'closed') {
    throw new Error('Phòng chat đã được đóng, không thể gửi tin nhắn');
  }

  await addDoc(collection(db, ROOMS_COLLECTION, roomId, 'messages'), {
    senderId,
    senderName,
    senderRole,
    text: trimmed,
    createdAt: serverTimestamp(),
  });

  await updateDoc(roomRef, {
    lastMessageAt: serverTimestamp(),
    lastMessage: trimmed,
  });
}

export async function updateChatRoom(roomId, { title, status }) {
  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (status !== undefined) updates.status = status;

  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), updates);
}

export async function closeChatRoom(roomId, closedByName) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: 'closed',
    closedAt: serverTimestamp(),
  });

  await addDoc(collection(db, ROOMS_COLLECTION, roomId, 'messages'), {
    senderId: 'system',
    senderName: 'Hệ thống',
    senderRole: 'system',
    text: `Phòng chat đã được đóng bởi ${closedByName}`,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserPresence(userId, roomId) {
  if (!userId) return;
  const presenceRef = doc(db, 'userPresence', userId);
  await setDoc(presenceRef, {
    activeRoomId: roomId || null,
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
}

export async function getUserPresence(userId) {
  if (!userId) return { activeRoomId: null };
  const presenceSnap = await getDoc(doc(db, 'userPresence', userId));
  return presenceSnap.exists() ? presenceSnap.data() : { activeRoomId: null };
}

export async function deleteChatRoom(roomId) {
  await deleteDoc(doc(db, ROOMS_COLLECTION, roomId));
}

/**
 * Fetch all users from Firestore for expert to pick from registration list.
 */
export async function fetchUsers(roleFilter = null) {
  let q;
  if (roleFilter) {
    q = query(collection(db, 'users'), where('role', '==', roleFilter));
  } else {
    q = query(collection(db, 'users'));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimeShort(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
