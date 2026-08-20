import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="container footer-container">
        {/* Top Section */}
        <div className="footer-top">
          {/* Brand Column */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 11L11 13L15 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="logo-text">Safe<span className="accent-text">School</span></span>
            </Link>
            <p className="footer-desc">
              Hệ thống hỗ trợ bảo vệ và xây dựng môi trường học đường an toàn, lành mạnh và đáng tin cậy cho học sinh, phụ huynh và nhà trường.
            </p>
          </div>

          {/* Nav Column */}
          <div className="footer-links-col">
            <h4 className="footer-title">Khám phá</h4>
            <ul className="footer-links-list">
              <li><Link to="/" className="footer-link">Trang chủ</Link></li>
              <li><Link to="/articles" className="footer-link">Bài viết & Tin tức</Link></li>
              <li><Link to="/reports" className="footer-link">Báo cáo & Phản ánh</Link></li>
            </ul>
          </div>

          {/* Contact Column */}
          <div className="footer-links-col">
            <h4 className="footer-title">Hỗ trợ</h4>
            <ul className="footer-links-list">
              <li><a href="tel:111" className="footer-link text-danger">Tổng đài Trẻ em 111</a></li>
              <li><Link to="/chat" className="footer-link">Tư vấn trực tuyến</Link></li>
              <li><Link to="/profile" className="footer-link">Trang cá nhân</Link></li>
            </ul>
          </div>

          {/* Info Column */}
          <div className="footer-contact-col">
            <h4 className="footer-title">Liên hệ</h4>
            <p className="footer-info">
              <strong className="info-label">Email:</strong> support@safeschool.edu.vn
            </p>
            <p className="footer-info">
              <strong className="info-label">Điện thoại:</strong> (024) 3756 7899
            </p>
            <p className="footer-info">
              <strong className="info-label">Địa chỉ:</strong> 760 Quảng trường Liên Hợp Quốc, New York, New York 10017, Hoa Kỳ
            </p>
          </div>
        </div>

        <hr className="footer-divider" />

        {/* Bottom Section */}
        <div className="footer-bottom">
          <p className="copyright">
            © {currentYear} Safe School. Bảo lưu mọi quyền.
          </p>
          <div className="footer-bottom-links">
            <a href="#privacy" className="footer-bottom-link">Chính sách bảo mật</a>
            <span className="divider-dot">•</span>
            <a href="#terms" className="footer-bottom-link">Điều khoản sử dụng</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
