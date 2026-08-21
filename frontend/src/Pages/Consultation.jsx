import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import {
  createConsultationBooking,
  fetchExpertsList,
  cancelConsultationBooking,
  respondToConsultationBooking
} from '../services/consultationService';
import './Consultation.css';

const TIME_SLOTS = [
  '08:00 - 09:00',
  '09:30 - 10:30',
  '11:00 - 12:00',
  '14:00 - 15:00',
  '15:30 - 16:30',
  '17:00 - 18:00'
];

const TOPICS = [
  'Tư vấn học tập & áp lực thi cử',
  'Giải tỏa căng thẳng, lo âu & cảm xúc',
  'Mối quan hệ bạn bè & học đường',
  'Gia đình & định hướng cá nhân',
  'Khác'
];

const CONTACT_METHODS = [
  'Trực tuyến (Chat SafeSchool)',
  'Gặp trực tiếp tại phòng tư vấn',
  'Cuộc gọi thoại / Video call'
];

export default function Consultation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('booking'); // 'booking' | 'my-bookings' | 'expert-manage'

  // Booking Form state
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [date, setDate] = useState(getTodayString());
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [selectedExpertId, setSelectedExpertId] = useState('');
  const [contactMethod, setContactMethod] = useState(CONTACT_METHODS[0]);
  const [notes, setNotes] = useState('');

  const [expertsList, setExpertsList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // History state
  const [myConsultations, setMyConsultations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Expert management state
  const [allConsultations, setAllConsultations] = useState([]);
  const isExpertOrAdmin = ['counselor', 'counseler', 'expert', 'psychologist', 'admin'].includes(user?.role);

  // Modal Từ chối (Dành cho Chuyên viên)
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // 1. Tải danh sách chuyên viên
  useEffect(() => {
    async function loadExperts() {
      const list = await fetchExpertsList();
      setExpertsList(list);
    }
    loadExperts();
  }, []);

  // 2. Lắng nghe lịch hẹn của user hiện tại
  useEffect(() => {
    if (!user?.uid) {
      setMyConsultations([]);
      setLoadingHistory(false);
      return;
    }

    const q = query(
      collection(db, 'consultations'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        items.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
        setMyConsultations(items);
        setLoadingHistory(false);
      },
      (error) => {
        console.error('Lỗi tải lịch hẹn cá nhân:', error);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // 3. Lắng nghe toàn bộ lịch hẹn (Dành cho Chuyên viên / Admin)
  useEffect(() => {
    if (!isExpertOrAdmin) return;

    const q = query(collection(db, 'consultations'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        items.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
        setAllConsultations(items);
      },
      (error) => {
        console.error('Lỗi tải danh sách tham vấn cho chuyên viên:', error);
      }
    );

    return () => unsubscribe();
  }, [isExpertOrAdmin]);

  // Gửi form đặt lịch
  const handleSubmitBooking = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('Vui lòng đăng nhập để đặt lịch tham vấn.');
      navigate('/login');
      return;
    }

    if (!date) {
      setBannerMessage({ type: 'error', text: 'Vui lòng chọn ngày tham vấn.' });
      return;
    }
    if (!timeSlot) {
      setBannerMessage({ type: 'error', text: 'Vui lòng chọn khung giờ tham vấn.' });
      return;
    }

    setIsSubmitting(true);
    setBannerMessage(null);

    try {
      let chosenExpertName = 'Tất cả tham vấn viên';
      if (selectedExpertId) {
        const expObj = expertsList.find((e) => e.id === selectedExpertId);
        if (expObj) chosenExpertName = expObj.displayName || expObj.email || 'Tham vấn viên';
      }

      await createConsultationBooking({
        userId: user.uid,
        userName: user.displayName || user.email || 'Học sinh',
        userEmail: user.email || '',
        date,
        timeSlot,
        topic,
        expertId: selectedExpertId || null,
        expertName: chosenExpertName,
        notes,
        contactMethod
      });

      setBannerMessage({
        type: 'success',
        text: '🎉 Đặt lịch tham vấn thành công! Yêu cầu của bạn đã được gửi tới chuyên viên.'
      });

      // Reset form
      setNotes('');
      // Tự động chuyển sang tab lịch hẹn cá nhân sau 1.5s
      setTimeout(() => {
        setActiveTab('my-bookings');
      }, 1500);

    } catch (err) {
      console.error('Lỗi đặt lịch tham vấn:', err);
      setBannerMessage({
        type: 'error',
        text: err.message || 'Không thể gửi yêu cầu đặt lịch. Vui lòng thử lại sau.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hủy lịch hẹn
  const handleCancelBooking = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn tham vấn này?')) return;
    try {
      await cancelConsultationBooking(id);
      alert('Đã hủy lịch hẹn tham vấn.');
    } catch (err) {
      console.error('Lỗi hủy lịch hẹn:', err);
      alert('Không thể hủy lịch hẹn: ' + err.message);
    }
  };

  // Chuyên viên Chấp nhận tham vấn từ tab quản lý
  const handleExpertAccept = async (consultation) => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await respondToConsultationBooking({
        consultationId: consultation.id,
        responseStatus: 'accepted',
        expertUser: user
      });
      alert('✅ Đã chấp nhận lịch tham vấn!');
    } catch (err) {
      console.error('Lỗi chấp nhận:', err);
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chuyên viên Từ chối tham vấn từ tab quản lý
  const handleExpertConfirmReject = async () => {
    if (!rejectModalItem || !user || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await respondToConsultationBooking({
        consultationId: rejectModalItem.id,
        responseStatus: 'rejected',
        expertUser: user,
        rejectReason: rejectReason.trim()
      });
      alert('❌ Đã từ chối lịch tham vấn.');
      setRejectModalItem(null);
    } catch (err) {
      console.error('Lỗi từ chối:', err);
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
    } catch (e) {}
    return dateStr;
  };

  return (
    <div className="consultation-page">
      <div className="consultation-wrapper">
        <header className="consultation-header">
          <h1 className="consultation-title">Đặt Lịch Tham Vấn Tâm Lý</h1>
          <p className="consultation-subtitle">
            Đặt lịch trao đổi trực tiếp, bảo mật và an toàn với các chuyên gia tư vấn tâm lý học đường SafeSchool.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="consultation-tabs">
          <button
            className={`consultation-tab-btn ${activeTab === 'booking' ? 'active' : ''}`}
            onClick={() => setActiveTab('booking')}
          >
            📝 Đặt lịch mới
          </button>
          <button
            className={`consultation-tab-btn ${activeTab === 'my-bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-bookings')}
          >
            📋 Lịch hẹn của tôi ({myConsultations.length})
          </button>
          {isExpertOrAdmin && (
            <button
              className={`consultation-tab-btn ${activeTab === 'expert-manage' ? 'active' : ''}`}
              onClick={() => setActiveTab('expert-manage')}
            >
              👨‍⚕️ Quản lý lịch tham vấn ({allConsultations.filter(c => c.status === 'pending').length} chờ)
            </button>
          )}
        </div>

        {/* Banner thông báo */}
        {bannerMessage && (
          <div className={`consultation-banner ${bannerMessage.type}`}>
            {bannerMessage.text}
          </div>
        )}

        {/* TAB 1: FORM ĐẶT LỊCH THAM VẤN */}
        {activeTab === 'booking' && (
          <div className="consultation-card">
            <form className="booking-form" onSubmit={handleSubmitBooking}>
              <div className="form-group-row">
                {/* Ngày tham vấn */}
                <div className="form-group">
                  <label className="form-label">
                    📅 Ngày tham vấn <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    min={getTodayString()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                {/* Chọn tham vấn viên */}
                <div className="form-group">
                  <label className="form-label">👨‍⚕️ Tham vấn viên</label>
                  <select
                    className="form-select"
                    value={selectedExpertId}
                    onChange={(e) => setSelectedExpertId(e.target.value)}
                  >
                    <option value="">-- Tất cả tham vấn viên (Hệ thống tự phân công) --</option>
                    {expertsList.map((exp) => (
                      <option key={exp.id} value={exp.id}>
                        {exp.displayName || exp.email} (Tham vấn viên)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Khung giờ */}
              <div className="form-group">
                <label className="form-label">
                  ⏰ Chọn khung giờ <span className="required">*</span>
                </label>
                <div className="time-slots-grid">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={`time-slot-pill ${timeSlot === slot ? 'selected' : ''}`}
                      onClick={() => setTimeSlot(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group-row">
                {/* Chủ đề */}
                <div className="form-group">
                  <label className="form-label">📌 Chủ đề tham vấn</label>
                  <select
                    className="form-select"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hình thức */}
                <div className="form-group">
                  <label className="form-label">💬 Hình thức tham vấn</label>
                  <select
                    className="form-select"
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                  >
                    {CONTACT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ghi chú thêm */}
              <div className="form-group">
                <label className="form-label">📝 Nội dung / Ghi chú cho chuyên viên</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder="Mô tả chi tiết hơn về vấn đề bạn đang gặp phải (bảo mật tuyệt đối)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Nút gửi */}
              <button
                type="submit"
                className="btn-submit-booking"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  'Đang xử lý...'
                ) : (
                  <>
                    <span>Đặt Lịch Tham Vấn Ngay</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: LỊCH HẸN CỦA TÔI */}
        {activeTab === 'my-bookings' && (
          <div className="consultation-card">
            {!user ? (
              <div className="empty-state">
                <p>Vui lòng đăng nhập để xem lịch hẹn của bạn.</p>
              </div>
            ) : loadingHistory ? (
              <div className="empty-state">
                <p>Đang tải danh sách lịch hẹn...</p>
              </div>
            ) : myConsultations.length === 0 ? (
              <div className="empty-state">
                <p>Bạn chưa có lịch hẹn tham vấn nào.</p>
              </div>
            ) : (
              <div className="consultation-list">
                {myConsultations.map((item) => (
                  <div key={item.id} className="consultation-item-card">
                    <div className="consultation-item-header">
                      <h3 className="consultation-item-title">{item.topic}</h3>
                      <span className={`consultation-status-badge status-${item.status}`}>
                        {item.status === 'pending' && '⏳ Chờ xác nhận'}
                        {item.status === 'accepted' && '✅ Đã chấp nhận'}
                        {item.status === 'rejected' && '❌ Đã từ chối'}
                        {item.status === 'cancelled' && '🚫 Đã hủy'}
                      </span>
                    </div>

                    <div className="consultation-item-body">
                      <div className="info-pair">
                        <span className="info-label">📅 Ngày tham vấn:</span>
                        <span className="info-value">{formatDateDisplay(item.date)}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-label">⏰ Khung giờ:</span>
                        <span className="info-value">{item.timeSlot}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-label">👨‍⚕️ Chuyên viên:</span>
                        <span className="info-value">{item.expertName || 'Chưa phân công'}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-label">💬 Hình thức:</span>
                        <span className="info-value">{item.contactMethod}</span>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="consultation-notes-box">
                        <strong>Ghi chú của bạn:</strong> "{item.notes}"
                      </div>
                    )}

                    {item.status === 'rejected' && item.rejectReason && (
                      <div className="consultation-notes-box" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
                        <strong>Lý do từ chối từ chuyên viên:</strong> "{item.rejectReason}"
                      </div>
                    )}

                    <div className="consultation-item-footer">
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          className="btn-cancel-booking"
                          onClick={() => handleCancelBooking(item.id)}
                        >
                          Hủy yêu cầu
                        </button>
                      )}

                      {item.status === 'accepted' && (
                        <button
                          type="button"
                          className="btn-open-chat"
                          onClick={() => navigate('/chat')}
                        >
                          💬 Vào phòng Chat SafeSchool →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUẢN LÝ THAM VẤN (DÀNH CHO CHUYÊN VIÊN) */}
        {activeTab === 'expert-manage' && isExpertOrAdmin && (
          <div className="consultation-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', color: '#1e293b' }}>
              Danh Sách Yêu Cầu Tham Vấn Của Học Sinh
            </h2>

            {allConsultations.length === 0 ? (
              <div className="empty-state">
                <p>Chưa có yêu cầu đặt lịch tham vấn nào trong hệ thống.</p>
              </div>
            ) : (
              <div className="consultation-list">
                {allConsultations.map((item) => (
                  <div key={item.id} className="consultation-item-card">
                    <div className="consultation-item-header">
                      <div>
                        <h3 className="consultation-item-title">{item.topic}</h3>
                        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          Người đặt: <strong>{item.userName}</strong> ({item.userEmail})
                        </span>
                      </div>

                      <span className={`consultation-status-badge status-${item.status}`}>
                        {item.status === 'pending' && '⏳ Chờ xác nhận'}
                        {item.status === 'accepted' && '✅ Đã chấp nhận'}
                        {item.status === 'rejected' && '❌ Đã từ chối'}
                        {item.status === 'cancelled' && '🚫 Đã hủy'}
                      </span>
                    </div>

                    <div className="consultation-item-body">
                      <div className="info-pair">
                        <span className="info-label">📅 Ngày tham vấn:</span>
                        <span className="info-value">{formatDateDisplay(item.date)}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-label">⏰ Khung giờ:</span>
                        <span className="info-value">{item.timeSlot}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-label">💬 Hình thức:</span>
                        <span className="info-value">{item.contactMethod}</span>
                      </div>
                      <div className="info-pair">
                        <span className="info-label">👨‍⚕️ Chuyên viên chỉ định:</span>
                        <span className="info-value">{item.expertName || 'Tất cả'}</span>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="consultation-notes-box">
                        <strong>Lý do / Nội dung từ học sinh:</strong> "{item.notes}"
                      </div>
                    )}

                    {item.status === 'pending' && (
                      <div className="consultation-action-buttons">
                        <button
                          type="button"
                          className="btn-consultation-accept"
                          onClick={() => handleExpertAccept(item)}
                          disabled={isSubmitting}
                        >
                          Chấp nhận tham vấn
                        </button>
                        <button
                          type="button"
                          className="btn-consultation-reject"
                          onClick={() => {
                            setRejectModalItem(item);
                            setRejectReason('');
                          }}
                          disabled={isSubmitting}
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal từ chối dành cho chuyên viên */}
      {rejectModalItem && (
        <div className="reject-modal-overlay" onClick={() => setRejectModalItem(null)}>
          <div className="reject-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="reject-modal-title">Từ chối lịch tham vấn</h3>
            <p className="reject-modal-desc">
              Từ chối lịch hẹn của <strong>{rejectModalItem.userName}</strong> vào{' '}
              <strong>{rejectModalItem.timeSlot}</strong> ngày <strong>{formatDateDisplay(rejectModalItem.date)}</strong>.
            </p>
            <div className="reject-modal-field">
              <label htmlFor="modal-reject-reason">Lý do từ chối (tùy chọn):</label>
              <textarea
                id="modal-reject-reason"
                rows="3"
                placeholder="Nhập lý do gửi đến người đặt lịch..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="reject-modal-actions">
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => setRejectModalItem(null)}
                disabled={isSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-confirm-reject"
                onClick={handleExpertConfirmReject}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
