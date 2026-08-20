import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../User/Avatar';
import './Header.css';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [location]);

  // Add background on scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.more-menu-container')) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  // Icon click: logged-in → /profile, guest → /login
  const handleProfileIconClick = () => {
    navigate(user ? '/profile' : '/login');
  };

  const handleFavoritesClick = () => {
    setIsDropdownOpen(false);
    navigate('/articles?filter=favorites');
  };

  const handleSOSClick = () => {
    setIsDropdownOpen(false);
    navigate('/sos');
  };

  const handleToggleAnonymous = async () => {
    setIsDropdownOpen(false);
    if (!user) return;
    try {
      const { db } = await import('../../firebase/config');
      const { doc, updateDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        is_anonymous: !user.isAnonymous
      });
    } catch (err) {
      console.error('Lỗi khi bật/tắt chế độ ẩn danh:', err);
      alert('Không thể cập nhật chế độ ẩn danh. Vui lòng thử lại.');
    }
  };

  return (
    <header className={`app-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header-container">

        {/* Logo */}
        <NavLink to="/" className="header-logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 11L11 13L15 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="logo-text">Safe<span className="accent-text">School</span></span>
        </NavLink>

        {/* Desktop Nav */}
        <nav className={`header-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                Trang chủ
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/articles" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Bài viết
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Báo cáo
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Thông báo
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/consultation" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Đặt lịch tham vấn
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* Right: Profile Icon + Options dropdown + Hamburger */}
        <div className="header-actions">
          {/* Profile/User icon — always visible, behaviour depends on auth state */}
          <button
            className="avatar-btn"
            onClick={handleProfileIconClick}
            aria-label={user ? 'Trang cá nhân' : 'Đăng nhập'}
            title={user ? (user.isAnonymous ? 'Đang bật chế độ ẩn danh' : `Xin chào, ${user.displayName || user.email}`) : 'Đăng nhập'}
          >
            {user ? (
              <Avatar
                src={user.isAnonymous ? '' : user.avatarUrl}
                alt="Avatar"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <svg className="user-icon" viewBox="0 0 24 24" fill="none">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* ⋮ More/Options Menu Button */}
          {user && (
            <div className="more-menu-container">
              <button
                className="more-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(prev => !prev);
                }}
                aria-label="Tùy chọn thêm"
                title="Tùy chọn thêm"
              >
                ⋮
              </button>

              {isDropdownOpen && (
                <div className="more-dropdown fade-in">
                  <button className="dropdown-item" onClick={handleFavoritesClick}>
                    ❤️ Bài viết yêu thích
                  </button>
                  <button className="dropdown-item" onClick={handleToggleAnonymous}>
                    👤 {user.isAnonymous ? 'Tắt chế độ ẩn danh' : 'Bật chế độ ẩn danh'}
                  </button>
                  <button
                    className="dropdown-item sos-item"
                    onClick={handleSOSClick}
                    style={{ color: '#dc2626', fontWeight: 'bold' }}
                  >
                    🚨 SOS Khẩn cấp
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hamburger (mobile) */}
          <button
            className={`hamburger ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>
      </div>
    </header>
  );
}