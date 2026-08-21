import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotification } from '../contexts/NotificationContext';
import { db } from '../firebase/config';
import './NotificationSettings.css';

// System notification categories & default settings (NO Email options)
const NOTIFICATION_CATEGORIES = [
  {
    id: 'reports_sos',
    title: '🛡️ Báo cáo & Khẩn cấp',
    typeBadge: 'critical',
    badgeText: 'Quan trọng',
    items: [
      {
        id: 'sos_alert',
        name: 'Cảnh báo S.O.S khẩn cấp',
        desc: 'Thông báo tức thì khi có báo cáo nguy cơ bạo lực học đường (Khuyến cáo không tắt)',
        isCritical: true,
        category: 'sos',
        sampleTitle: '🚨 Báo cáo SOS Khẩn cấp mới!',
        sampleMessage: 'Học sinh tại Lớp 10A2 đã kích hoạt cảnh báo SOS nguy cơ bạo lực.',
      },
      {
        id: 'report_status',
        name: 'Cập nhật tiến độ báo cáo',
        desc: 'Thông báo phản hồi và kết quả xử lý sự vụ từ Ban Giám Hiệu hoặc Chuyên gia',
        isCritical: false,
        category: 'critical',
        sampleTitle: '✅ Báo cáo sự vụ #1042 đã được tiếp nhận',
        sampleMessage: 'Chuyên gia Tâm lý Nguyễn Văn B đã cập nhật trạng thái xử lý cho báo cáo của bạn.',
      },
    ],
  },
  {
    id: 'school_system',
    title: '📢 Nhà trường & Hệ thống',
    typeBadge: 'normal',
    badgeText: 'Hệ thống',
    items: [
      {
        id: 'school_announcement',
        name: 'Thông báo từ Ban Giám Hiệu',
        desc: 'Cập nhật các chương trình phòng chống bạo lực, hoạt động đoàn đội toàn trường',
        isCritical: false,
        category: 'system',
        sampleTitle: '📢 Thông báo Chuyên đề Kỹ năng An toàn Học đường',
        sampleMessage: 'Buổi sinh hoạt chuyên đề sẽ diễn ra vào lúc 08:00 sáng Thứ Hai tuần tới.',
      },
      {
        id: 'system_update',
        name: 'Bảo trì & Tính năng mới',
        desc: 'Cập nhật lịch bảo trì hệ thống SafeSchool và các tính năng hỗ trợ mới',
        isCritical: false,
        category: 'system',
        sampleTitle: '⚙️ SafeSchool cập nhật phiên bản 2.4',
        sampleMessage: 'Hệ thống đã bổ sung tính năng Cài đặt Thông báo Thông minh Antigravity.',
      },
    ],
  },
  {
    id: 'consultation_chat',
    title: '💬 Tham vấn & Nhắn tin',
    typeBadge: 'noise',
    badgeText: 'Tương tác',
    items: [
      {
        id: 'chat_message',
        name: 'Tin nhắn Tham vấn Tâm lý',
        desc: 'Thông báo tin nhắn mới từ phòng tư vấn tâm lý học đường',
        isCritical: false,
        category: 'chat',
        sampleTitle: '💬 Tin nhắn mới từ Chuyên gia Tâm lý',
        sampleMessage: '"Chào em, thầy đã nhận được câu hỏi và sẵn sàng lắng nghe..."',
      },
      {
        id: 'consultation_reminder',
        name: 'Nhắc lịch hẹn tư vấn',
        desc: 'Nhắc nhở trước 15 phút khi đến giờ tham vấn trực tuyến',
        isCritical: false,
        category: 'chat',
        sampleTitle: '⏰ Nhắc nhở Lịch hẹn Tham vấn',
        sampleMessage: 'Lịch tư vấn với Cô Trần Thị C sẽ bắt đầu sau 15 phút.',
      },
    ],
  },
  {
    id: 'posts_social',
    title: '📝 Bài viết & Tương tác',
    typeBadge: 'noise',
    badgeText: 'Dễ gây nhiễu',
    items: [
      {
        id: 'article_like',
        name: 'Lượt thích bài viết',
        desc: 'Thông báo khi ai đó thích bài viết hoặc chia sẻ của bạn (Có hỗ trợ gộp)',
        isCritical: false,
        category: 'normal',
        sampleTitle: '👍 Tương tác bài viết mới',
        sampleMessage: 'Nguyễn Văn A và 4 người khác đã thích bài viết của bạn.',
      },
      {
        id: 'article_comment',
        name: 'Bình luận & Phản hồi',
        desc: 'Thông báo khi có bình luận mới hoặc phản hồi câu hỏi của bạn',
        isCritical: false,
        category: 'normal',
        sampleTitle: '💬 Bình luận mới trên bài viết',
        sampleMessage: 'Trần Minh B đã bình luận: "Bài viết chia sẻ rất hữu ích!"',
      },
      {
        id: 'new_post_followed',
        name: 'Bài viết mới từ Người dùng',
        desc: 'Thông báo khi các tư vấn viên hoặc tác giả bạn theo dõi đăng bài mới',
        isCritical: false,
        category: 'normal',
        sampleTitle: '📰 Bài viết mới: "Kỹ năng làm chủ cảm xúc"',
        sampleMessage: 'Tác giả Chuyên gia Lê Văn D vừa đăng một bài viết mới.',
      },
    ],
  },
];

const DEFAULT_PREFERENCES = {
  masterEnabled: true,
  channels: {
    sos_alert: { in_app: true, push: true },
    report_status: { in_app: true, push: true },
    school_announcement: { in_app: true, push: false },
    system_update: { in_app: true, push: false },
    chat_message: { in_app: true, push: true },
    consultation_reminder: { in_app: true, push: true },
    article_like: { in_app: true, push: false },
    article_comment: { in_app: true, push: true },
    new_post_followed: { in_app: true, push: false },
  },
  quietHours: {
    enabled: true,
    startTime: '22:00',
    endTime: '06:00',
    allowSosBypass: true,
  },
  batching: {
    enabled: true,
    frequency: 'batch_15m',
  },
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const { addPushNotification } = usePushNotification();

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [activePreview, setActivePreview] = useState({
    id: 'sos_alert',
    name: 'Cảnh báo S.O.S khẩn cấp',
    category: 'sos',
    title: '🚨 Báo cáo SOS Khẩn cấp mới!',
    message: 'Học sinh tại Lớp 10A2 đã kích hoạt cảnh báo SOS nguy cơ bạo lực.',
  });
  const [toastMessage, setToastMessage] = useState('');

  // Realtime Listener Sync across all user devices
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, 'users', user.uid, 'notificationSettings', 'preferences');
    const unsubscribe = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPreferences((prev) => ({
            ...DEFAULT_PREFERENCES,
            ...data,
            channels: { ...DEFAULT_PREFERENCES.channels, ...data.channels },
            quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...data.quietHours },
            batching: { ...DEFAULT_PREFERENCES.batching, ...data.batching },
          }));
        } else {
          savePreferencesToFirestore(DEFAULT_PREFERENCES);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Lỗi khi tải cài đặt thông báo:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const savePreferencesToFirestore = async (newPrefs) => {
    if (!user?.uid) return;
    try {
      const settingsRef = doc(db, 'users', user.uid, 'notificationSettings', 'preferences');
      await setDoc(
        settingsRef,
        {
          ...newPrefs,
          uid: user.uid,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Lỗi khi lưu cài đặt:', err);
    }
  };

  const handleToggleMaster = () => {
    const updated = { ...preferences, masterEnabled: !preferences.masterEnabled };
    setPreferences(updated);
    savePreferencesToFirestore(updated);
    showToast(updated.masterEnabled ? '🔔 Đã bật tất cả thông báo' : '🔕 Đã tắt toàn bộ thông báo');
  };

  const handleChannelToggle = (notifId, channelKey) => {
    const currentChannels = preferences.channels[notifId] || { in_app: true, push: false };
    const updatedChannels = {
      ...preferences.channels,
      [notifId]: {
        ...currentChannels,
        [channelKey]: !currentChannels[channelKey],
      },
    };
    const updated = { ...preferences, channels: updatedChannels };
    setPreferences(updated);
    savePreferencesToFirestore(updated);
  };

  const handleQuietHoursChange = (field, value) => {
    const updated = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value,
      },
    };
    setPreferences(updated);
    savePreferencesToFirestore(updated);
  };

  const handleBatchingChange = (frequency) => {
    const updated = {
      ...preferences,
      batching: {
        ...preferences.batching,
        frequency,
      },
    };
    setPreferences(updated);
    savePreferencesToFirestore(updated);
    showToast('⚡ Đã cập nhật chế độ gộp thông báo');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Trigger Antigravity Push Notification Toast Demo via Context
  const handleSendTestNotification = () => {
    const isLike = activePreview.id === 'article_like';
    const isComment = activePreview.id === 'article_comment';

    addPushNotification({
      title: activePreview.title,
      message: activePreview.message,
      type: activePreview.id,
      category: activePreview.category || 'normal',
      batchKey: isLike ? 'demo_like_post_101' : isComment ? 'demo_comment_post_101' : null,
      meta: { actorName: 'Nguyễn Văn A' },
      targetUrl: activePreview.id === 'sos_alert' ? '/admin/reports-sos' : '/notifications',
    });

    showToast(`🔔 Kích hoạt Push Toast: "${activePreview.name}"`);
  };

  if (loading) {
    return (
      <div className="notif-settings-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Đang đồng bộ cài đặt thông báo của bạn...</p>
      </div>
    );
  }

  return (
    <div className="notif-settings-container">
      {/* Header Section */}
      <header className="notif-settings-header">
        <div className="notif-settings-header-content">
          <h1>⚙️ Cài đặt Thông báo Thông minh</h1>
          <p className="notif-settings-subtitle">
            Tùy chỉnh linh hoạt kênh nhận (In-App, Push), bật chế độ Giờ yên lặng (DND), gộp thông báo tương tác và tránh quá tải thông báo.
          </p>
        </div>
        <div className="notif-settings-actions">
          <div className="sync-badge" title="Cài đặt được đồng bộ tự động thời gian thực trên mọi thiết bị">
            <span className="sync-badge-dot"></span>
            Đồng bộ Đa thiết bị
          </div>
        </div>
      </header>

      {/* Master Control Card */}
      <div className="master-control-card">
        <div className="master-info">
          <div className="master-icon">{preferences.masterEnabled ? '🔔' : '🔕'}</div>
          <div>
            <div className="master-title">Bật / Tắt Toàn bộ Thông báo</div>
            <div className="master-desc">
              {preferences.masterEnabled
                ? 'Hệ thống đang gửi thông báo theo tùy chỉnh riêng từng loại ở bên dưới.'
                : 'Bạn đang tắt tất cả thông báo. Bạn sẽ không nhận được bất kỳ thông báo nào.'}
            </div>
          </div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={preferences.masterEnabled}
            onChange={handleToggleMaster}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {/* Main Grid Layout */}
      <div className="notif-grid-layout">
        {/* Left Column: Notification Matrix Categories */}
        <div className="notif-main-content">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category.id} className="notif-section">
              <div className="notif-section-header">
                <div className="notif-section-title">
                  <span>{category.title}</span>
                  <span className={`category-badge ${category.typeBadge}`}>
                    {category.badgeText}
                  </span>
                </div>
              </div>

              {/* Matrix Table Headers (3 columns: Name, In-App, Push) */}
              <div className="matrix-headers">
                <span>Loại thông báo</span>
                <span>In-App 🔔</span>
                <span>Push 📱</span>
              </div>

              {/* Matrix Rows */}
              {category.items.map((item) => {
                const itemChannels = preferences.channels[item.id] || {
                  in_app: true,
                  push: false,
                };
                const isSelected = activePreview.id === item.id;

                return (
                  <div
                    key={item.id}
                    className={`notif-item-row ${isSelected ? 'preview-active' : ''}`}
                    onClick={() =>
                      setActivePreview({
                        id: item.id,
                        name: item.name,
                        category: item.category,
                        title: item.sampleTitle,
                        message: item.sampleMessage,
                      })
                    }
                  >
                    <div className="notif-item-info">
                      <div className="notif-item-name">
                        {item.name}
                        {item.isCritical && (
                          <span style={{ color: '#ef4444', fontSize: '0.8rem' }} title="Loại thông báo quan trọng">
                            ⚠️
                          </span>
                        )}
                      </div>
                      <div className="notif-item-desc">{item.desc}</div>
                    </div>

                    {/* In-App Toggle */}
                    <div className="channel-toggle" onClick={(e) => e.stopPropagation()}>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          disabled={!preferences.masterEnabled}
                          checked={itemChannels.in_app}
                          onChange={() => handleChannelToggle(item.id, 'in_app')}
                        />
                        <span className={`toggle-slider ${item.isCritical ? 'critical-slider' : ''}`}></span>
                      </label>
                    </div>

                    {/* Push Toggle */}
                    <div className="channel-toggle" onClick={(e) => e.stopPropagation()}>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          disabled={!preferences.masterEnabled}
                          checked={itemChannels.push}
                          onChange={() => handleChannelToggle(item.id, 'push')}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Section: Quiet Hours (Do Not Disturb - DND) */}
          <div className="notif-section">
            <div className="notif-section-header">
              <div className="notif-section-title">
                <span>🌙 Giờ Yên Lặng (Do Not Disturb)</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.quietHours.enabled}
                  onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-box">
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                Trong khoảng thời gian này, hệ thống sẽ tự động tạm hoãn gửi thông báo đẩy (Push) để không làm phiền bạn.
              </p>

              {preferences.quietHours.enabled && (
                <>
                  <div className="time-range-picker">
                    <div className="time-input-group">
                      <label>Từ giờ (Bắt đầu)</label>
                      <input
                        type="time"
                        value={preferences.quietHours.startTime}
                        onChange={(e) => handleQuietHoursChange('startTime', e.target.value)}
                      />
                    </div>
                    <span className="time-separator">➔</span>
                    <div className="time-input-group">
                      <label>Đến giờ (Kết thúc)</label>
                      <input
                        type="time"
                        value={preferences.quietHours.endTime}
                        onChange={(e) => handleQuietHoursChange('endTime', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="dnd-bypass-option">
                    <label className="toggle-switch" style={{ flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={preferences.quietHours.allowSosBypass}
                        onChange={(e) => handleQuietHoursChange('allowSosBypass', e.target.checked)}
                      />
                      <span className="toggle-slider critical-slider"></span>
                    </label>
                    <span>
                      <strong>Cho phép SOS Khẩn cấp ghi đè Giờ yên lặng:</strong> Nhận ngay cảnh báo SOS bạo lực học đường bất kể thời gian.
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Notification Batching */}
          <div className="notif-section">
            <div className="notif-section-header">
              <div className="notif-section-title">
                <span>⚡ Tần Suất Gộp Thông Báo (Notification Batching)</span>
              </div>
            </div>
            <div className="settings-box">
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                Gộp nhiều thông báo tương tác bài viết (Like, Comment) thành 1 bản tin thay vì gửi lẻ tẻ nhiều lần.
              </p>

              <div className="batching-grid">
                {[
                  { id: 'instant', title: 'Tức thì', desc: 'Nhận ngay mỗi khi có lượt tương tác' },
                  { id: 'batch_15m', title: 'Gộp 15 phút', desc: 'Gộp thông báo tương tác mỗi 15 phút (Khuyên dùng)' },
                  { id: 'batch_1h', title: 'Gộp 1 giờ', desc: 'Tóm tắt lượt thích & bình luận mỗi giờ' },
                  { id: 'daily_digest', title: 'Tóm tắt ngày', desc: 'Nhận 1 bản tin tổng hợp vào 18:00 hàng ngày' },
                ].map((option) => (
                  <div
                    key={option.id}
                    className={`batch-option-card ${preferences.batching.frequency === option.id ? 'active' : ''}`}
                    onClick={() => handleBatchingChange(option.id)}
                  >
                    <div className="batch-option-title">{option.title}</div>
                    <div className="batch-option-desc">{option.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Compact Notification Preview Card */}
        <div className="preview-sidebar">
          <div className={`compact-preview-card ${isPreviewExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="compact-preview-header">
              <div className="compact-preview-title">
                <span>👁️ Xem trước Push</span>
              </div>
              <button
                type="button"
                className="expand-toggle-btn"
                aria-expanded={isPreviewExpanded}
                onClick={() => setIsPreviewExpanded((prev) => !prev)}
              >
                {isPreviewExpanded ? '▲ Thu gọn' : '▼ Mở rộng'}
              </button>
            </div>
            {isPreviewExpanded && (
              <div className="compact-preview-body">
                <div className="compact-active-indicator">
                  <span style={{ color: '#64748b' }}>Đang chọn:</span>
                  <span className="compact-active-name" title={activePreview.name}>
                    {activePreview.name}
                  </span>
                </div>

                <div className="compact-mock-box">
                  <div className="compact-mock-title">{activePreview.title}</div>
                  <div className="compact-mock-msg">{activePreview.message}</div>

                  <div className="mock-channel-tags">
                    {preferences.channels[activePreview.id]?.in_app && (
                      <span className="channel-tag in_app">🔔 In-App</span>
                    )}
                    {preferences.channels[activePreview.id]?.push && (
                      <span className="channel-tag push">📱 Push FCM</span>
                    )}
                  </div>
                </div>

                <button className="compact-test-btn" onClick={handleSendTestNotification}>
                  🔔 Thử nghiệm Push Antigravity
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Popup Notification */}
      {toastMessage && (
        <div className="notif-toast" role="status">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
