import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext();

export const usePushNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('usePushNotification phải được dùng bên trong NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  // Xóa thông báo khỏi hàng đợi
  const dismissNotification = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Thêm hoặc gộp thông báo push mới (Smart Batching Queue Engine)
  const addPushNotification = useCallback(
    (notifData) => {
      const {
        title,
        message,
        type = 'default',
        category = 'normal', // 'sos' | 'critical' | 'chat' | 'system' | 'normal'
        targetUrl = null,
        batchKey = null,
        icon = null,
        duration = category === 'sos' ? 8000 : 6000,
        meta = {},
      } = notifData;

      setNotifications((prev) => {
        // 1. Logic Smart Batching: Kiểm tra nếu có thông báo cùng batchKey đang hiển thị
        if (batchKey) {
          const existingIndex = prev.findIndex((item) => item.batchKey === batchKey);
          if (existingIndex !== -1) {
            const existingNotif = prev[existingIndex];
            const newCount = (existingNotif.count || 1) + 1;
            
            let batchedMessage = message;
            if (type === 'article_like') {
              const actorName = meta.actorName || 'Ai đó';
              batchedMessage = `${actorName} và ${newCount - 1} người khác đã thích bài viết của bạn.`;
            } else if (type === 'article_comment') {
              batchedMessage = `Có ${newCount} bình luận mới trên bài viết của bạn.`;
            } else if (type === 'chat_message') {
              batchedMessage = `Bạn có ${newCount} tin nhắn mới chưa đọc.`;
            } else {
              batchedMessage = `${message} (${newCount})`;
            }

            const updatedNotif = {
              ...existingNotif,
              title,
              message: batchedMessage,
              count: newCount,
              timestamp: Date.now(),
            };

            // Đặt lại timer tự động đóng cho thông báo vừa được gộp
            if (timersRef.current[existingNotif.id]) {
              clearTimeout(timersRef.current[existingNotif.id]);
            }
            timersRef.current[existingNotif.id] = setTimeout(() => {
              dismissNotification(existingNotif.id);
            }, duration);

            // Đưa thông báo vừa cập nhật lên vị trí mới nhất (đèn trên cùng)
            const filtered = prev.filter((item) => item.id !== existingNotif.id);
            return [updatedNotif, ...filtered];
          }
        }

        // 2. Thêm thông báo mới vào đầu danh sách stack
        const newId = `push_notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newNotif = {
          id: newId,
          title,
          message,
          type,
          category,
          targetUrl,
          batchKey,
          icon,
          count: 1,
          timestamp: Date.now(),
        };

        // Đặt timer tự động hủy sau khoảng duration
        timersRef.current[newId] = setTimeout(() => {
          dismissNotification(newId);
        }, duration);

        // Giữ tối đa 4 thông báo hiển thị trong stack cùng lúc để đảm bảo hiệu suất UI
        const updatedList = [newNotif, ...prev];
        if (updatedList.length > 4) {
          const removed = updatedList.pop();
          if (timersRef.current[removed.id]) {
            clearTimeout(timersRef.current[removed.id]);
            delete timersRef.current[removed.id];
          }
        }
        return updatedList;
      });
    },
    [dismissNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addPushNotification,
        dismissNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
