import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import './NotificationSettingsModal.css';

const DEFAULT_SETTINGS = {
  article_comment: true,
  comment_reply: true,
  article_like: true,
  article_favorite: true,
};

export default function NotificationSettingsModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    if (user?.notificationSettings) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...user.notificationSettings,
      });
    }
  }, [user?.notificationSettings, isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = async (key) => {
    if (!user?.uid || saving) return;

    const updatedSettings = {
      ...settings,
      [key]: !settings[key],
    };

    setSettings(updatedSettings);
    setSaving(true);
    setSaveToast(false);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notificationSettings: updatedSettings,
      });
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (error) {
      console.error('Lỗi khi cập nhật cài đặt thông báo:', error);
      alert('Không thể cập nhật cài đặt thông báo. Vui lòng thử lại.');
      // Revert local state on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  // Render via React Portal directly into document.body to escape
  // any parent stacking context (backdrop-filter, transform, filter on Header)
  return ReactDOM.createPortal(
    <div className="notif-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Cài đặt thông báo">
      <div className="notif-modal-card" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header — always visible, flex-shrink: 0 */}
        <div className="notif-modal-header">
          <div className="notif-modal-title-box">
            <span className="notif-modal-header-icon">🔔</span>
            <div>
              <h3 className="notif-modal-title">Cài Đặt Thông Báo</h3>
              <p className="notif-modal-subtitle">Quản lý nhận thông báo tương tác của bạn</p>
            </div>
          </div>
          <button className="notif-modal-close-btn" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        {/* Modal Body — only this section scrolls */}
        <div className="notif-modal-body">
          {saveToast && (
            <div className="notif-save-toast">
              ✅ Đã áp dụng cài đặt thông báo mới!
            </div>
          )}

          <div className="notif-settings-group">
            <p className="notif-section-label">Tùy chọn thông báo</p>

            {/* 1. Article Comment */}
            <div className="notif-setting-row">
              <div className="notif-setting-info">
                <span className="notif-setting-icon">💬</span>
                <div className="notif-setting-text">
                  <span className="notif-setting-title">Bình luận bài viết của tôi</span>
                  <p className="notif-setting-desc">Nhận thông báo khi ai đó bình luận vào bài viết của bạn</p>
                </div>
              </div>
              <label className="notif-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings.article_comment)}
                  onChange={() => handleToggle('article_comment')}
                  disabled={saving}
                />
                <span className="notif-toggle-slider"></span>
              </label>
            </div>

            {/* 2. Comment Reply */}
            <div className="notif-setting-row">
              <div className="notif-setting-info">
                <span className="notif-setting-icon">↩️</span>
                <div className="notif-setting-text">
                  <span className="notif-setting-title">Trả lời bình luận của tôi</span>
                  <p className="notif-setting-desc">Nhận thông báo khi có người phản hồi bình luận của bạn</p>
                </div>
              </div>
              <label className="notif-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings.comment_reply)}
                  onChange={() => handleToggle('comment_reply')}
                  disabled={saving}
                />
                <span className="notif-toggle-slider"></span>
              </label>
            </div>

            {/* 3. Article Like */}
            <div className="notif-setting-row">
              <div className="notif-setting-info">
                <span className="notif-setting-icon">👍</span>
                <div className="notif-setting-text">
                  <span className="notif-setting-title">Lượt thích bài viết của tôi</span>
                  <p className="notif-setting-desc">Nhận thông báo khi bài viết của bạn nhận lượt thích</p>
                </div>
              </div>
              <label className="notif-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings.article_like)}
                  onChange={() => handleToggle('article_like')}
                  disabled={saving}
                />
                <span className="notif-toggle-slider"></span>
              </label>
            </div>

            {/* 4. Article Favorite */}
            <div className="notif-setting-row">
              <div className="notif-setting-info">
                <span className="notif-setting-icon">❤️</span>
                <div className="notif-setting-text">
                  <span className="notif-setting-title">Lượt yêu thích bài viết của tôi</span>
                  <p className="notif-setting-desc">Nhận thông báo khi bài viết được thêm vào mục yêu thích</p>
                </div>
              </div>
              <label className="notif-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings.article_favorite)}
                  onChange={() => handleToggle('article_favorite')}
                  disabled={saving}
                />
                <span className="notif-toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Admin Notification Guarantee Note */}
          <div className="notif-admin-note">
            <span className="admin-note-icon">🛡️</span>
            <p className="admin-note-text">
              <strong>Thông báo hệ thống &amp; Admin:</strong> Các thông báo từ Ban quản trị, duyệt bài và cảnh báo tài khoản sẽ <em>luôn được gửi</em> để bảo đảm an toàn.
            </p>
          </div>
        </div>

        {/* Modal Footer — always visible, flex-shrink: 0 */}
        <div className="notif-modal-footer">
          <button className="notif-close-btn" onClick={onClose}>
            Đóng
          </button>
        </div>

      </div>
    </div>,
    document.body   // ← Portal: renders outside Header's stacking context
  );
}
