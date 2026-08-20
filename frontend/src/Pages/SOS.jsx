import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './SOS.css';

export default function SOS() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // State quản lý luồng xử lý
    const [stage, setStage] = useState('idle'); // 'idle' | 'counting' | 'sending' | 'active'
    const [countdown, setCountdown] = useState(3);
    const [locationInfo, setLocationInfo] = useState(null);
    const [locationStatus, setLocationStatus] = useState('Đang lấy vị trí...');
    const [errorMsg, setErrorMsg] = useState('');
    const [emergencyReportId, setEmergencyReportId] = useState(null);

    const timerRef = useRef(null);

    // Xử lý đếm ngược 3 giây (Basic Flow 2)
    useEffect(() => {
        if (stage === 'counting') {
            if (countdown > 0) {
                timerRef.current = setTimeout(() => {
                    setCountdown((prev) => prev - 1);
                }, 1000);
            } else {
                // Hết đếm ngược -> tự động kích hoạt gửi cảnh báo (Basic Flow 4)
                triggerSOSAlert();
            }
        }
        return () => clearTimeout(timerRef.current);
    }, [stage, countdown]);

    // Bắt đầu đếm ngược (Trigger)
    const handleStartSOS = () => {
        setCountdown(3);
        setStage('counting');
    };

    // Hủy kích hoạt trong lúc đếm ngược (Alternative Flow 2a)
    const handleCancelCountdown = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setStage('idle');
        setCountdown(3);
    };

    // Bỏ qua đếm ngược - Gửi ngay khi double click (Alternative Flow 3a)
    const handleDoubleClickSOS = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        triggerSOSAlert();
    };

    // Thu thập vị trí GPS và đẩy dữ liệu lên Firestore (Basic Flow 4, 5, 7)
    const triggerSOSAlert = async () => {
        setStage('sending');
        let coords = null;
        let locationString = 'Vị trí: Không xác định (Chưa bật GPS)'; // Exception Flow 4b2

        // Lấy vị trí GPS của thiết bị
        if ('geolocation' in navigator) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                    });
                });
                coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                locationString = `Vĩ độ: ${coords.latitude}, Kinh độ: ${coords.longitude}`;
                setLocationStatus('Đã lấy được tọa độ vị trí');
            } catch (err) {
                console.warn('Lỗi lấy GPS:', err);
                setLocationStatus('Không lấy được GPS. Đang sử dụng vị trí mặc định.');
            }
        } else {
            setLocationStatus('Thiết bị không hỗ trợ GPS.');
        }

        setLocationInfo(locationString);

        try {
            // 1. Tạo Báo cáo khẩn cấp trong Firestore (Basic Flow 7)
            const reportRef = await addDoc(collection(db, 'reports'), {
                user_id: user?.uid || 'guest',
                user_name: user?.displayName || user?.email || 'Người dùng khẩn cấp',
                user_email: user?.email || 'N/A',
                type: 'sos_emergency',
                title: '🚨 CẢNH BÁO SOS KHẨN CẤP',
                description: 'Tín hiệu SOS đã được kích hoạt khẩn cấp từ ứng dụng!',
                status: 'Chưa xử lý - Nguy cấp', // Theo đúng BR-SOS / Basic Flow 7
                location: locationString,
                coordinates: coords,
                priority: 'HIGH', // BR-SOS-02
                createdAt: serverTimestamp(),
            });

            setEmergencyReportId(reportRef.id);

            // 2. Gửi Thông báo đẩy Push Notification cho Admin / Giáo viên / Tham vấn viên (Basic Flow 5)
            await addDoc(collection(db, 'notifications'), {
                user_id: user?.uid || 'system',
                type: 'sos_alert',
                title: '🚨 TÍN HIỆU SOS NGUY CẤP',
                message: `${user?.displayName || 'Một học sinh/giáo viên'} vừa phát tín hiệu SOS khẩn cấp! Vị trí: ${locationString}`,
                read: false,
                priority: 'HIGH',
                createdAt: serverTimestamp(),
            });

            setStage('active');
        } catch (error) {
            console.error('Lỗi khi gửi SOS:', error);
            setErrorMsg('Không thể kết nối máy chủ. Vui lòng gọi trực tiếp Hotline hotline bên dưới!');
            setStage('active');
        }
    };

    // Hủy cảnh báo khi đã an toàn
    const handleSafeResolution = () => {
        setStage('idle');
        setCountdown(3);
        setEmergencyReportId(null);
    };

    return (
        <div className="sos-container">
            <div className="sos-card">
                {/* MÀN HÌNH CHỜ / BAN ĐẦU */}
                {stage === 'idle' && (
                    <div className="sos-idle-view">
                        <h1 className="sos-title">Kích Hoạt SOS Khẩn Cấp</h1>
                        <p className="sos-subtitle">
                            Sử dụng khi bạn hoặc bạn học đang gặp nguy hiểm, bạo lực học đường cần cứu trợ tức thời.
                        </p>

                        <button
                            className="sos-main-btn"
                            onClick={handleStartSOS}
                            onDoubleClick={handleDoubleClickSOS}
                            title="Nhấn để đếm ngược 3s hoặc Nhấn đúp để gửi ngay"
                        >
                            <span className="sos-btn-icon">🚨</span>
                            <span className="sos-btn-text">NÚT SOS KHẨN CẤP</span>
                            <span className="sos-btn-hint">(Nhấn đúp để gửi tức thì)</span>
                        </button>

                        <div className="sos-guide-box">
                            <h3>📌 Hướng dẫn sử dụng:</h3>
                            <ul>
                                <li>Nhấn 1 lần: Hệ thống sẽ đếm ngược 3 giây trước khi phát tín hiệu.</li>
                                <li>Nhấn đúp (Double click): Bỏ qua đếm ngược và gửi tín hiệu ngay lập tức.</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* MÀN HÌNH ĐẾM NGƯỢC (3 GIÂY) */}
                {stage === 'counting' && (
                    <div className="sos-counting-view">
                        <h2 className="sos-alert-heading">Đang phát tín hiệu SOS khẩn cấp!</h2>
                        <div className="sos-timer-circle">{countdown}</div>
                        <p className="sos-timer-note">
                            Tín hiệu và vị trí GPS sẽ tự động gửi tới Ban giám hiệu, Giáo viên & Tham vấn viên sau {countdown} giây.
                        </p>

                        <div className="sos-action-group">
                            <button className="btn-cancel-sos" onClick={handleCancelCountdown}>
                                ✖ HỦY PHÁT CẢNH BÁO (Bấm nhầm)
                            </button>
                            <button className="btn-force-sos" onClick={handleDoubleClickSOS}>
                                ⚡ GỬI NGAY LẬP TỨC
                            </button>
                        </div>
                    </div>
                )}

                {/* MÀN HÌNH ĐANG GỬI */}
                {stage === 'sending' && (
                    <div className="sos-sending-view">
                        <div className="sos-spinner"></div>
                        <h2>Đang thu thập GPS và gửi tín hiệu cứu trợ...</h2>
                        <p>{locationStatus}</p>
                    </div>
                )}

                {/* MÀN HÌNH HƯỚNG DẪN AN TOÀN KHI ĐÃ PHÁT CẢNH BÁO */}
                {stage === 'active' && (
                    <div className="sos-active-view">
                        <div className="sos-success-header">
                            <span className="sos-alert-icon">⚠️</span>
                            <h2>TÍN HIỆU SOS ĐÃ ĐƯỢC PHÁT!</h2>
                        </div>

                        <p className="sos-status-desc">
                            Hệ thống đã tự động tạo Báo cáo nguy cấp và thông báo tới <strong>Ban Giám Hiệu, Giáo Viên Chủ Nhiệm</strong> và <strong>Chuyên Viên Tâm Lý</strong>.
                        </p>

                        {locationInfo && (
                            <div className="sos-location-box">
                                <strong>📍 Định vị gửi đi:</strong> {locationInfo}
                            </div>
                        )}

                        {errorMsg && <div className="sos-error-box">{errorMsg}</div>}

                        {/* Màn hình hướng dẫn an toàn (Basic Flow 8) */}
                        <div className="sos-safety-instructions">
                            <h3>🛡️ Hướng dẫn giữ an toàn tại chỗ:</h3>
                            <ol>
                                <li>Hãy di chuyển đến nơi đông người hoặc phòng bảo vệ gần nhất nếu có thể.</li>
                                <li>Giữ bình tĩnh và duy trì khoảng cách an toàn với đối tượng gây bạo lực.</li>
                                <li>Mở âm thanh cuộc gọi hoặc giữ thiết bị kết nối mạng.</li>
                            </ol>

                            <div className="sos-hotline-list">
                                <h4>📞 Hotline cứu trợ 24/7:</h4>
                                <a href="tel:111" className="hotline-item">
                                    <span>Tổng đài Quốc gia Bảo vệ Trẻ em:</span> <strong>111</strong>
                                </a>
                                <a href="tel:113" className="hotline-item">
                                    <span>Cảnh sát phản ứng nhanh:</span> <strong>113</strong>
                                </a>
                            </div>
                        </div>

                        <button className="btn-resolve-sos" onClick={handleSafeResolution}>
                            ✅ Tôi đã an toàn / Hủy trạng thái khẩn cấp
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}