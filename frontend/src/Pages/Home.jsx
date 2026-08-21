import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFeaturedArticlesService } from '../services/articleService';
import './Home.css';

const stats = [
  { id: 1, count: '120+', label: 'Tổng bài viết', icon: '📝', color: '#2563EB' },
  { id: 2, count: '342', label: 'Báo cáo đã xử lý', icon: '🛡️', color: '#10B981' },
  { id: 3, count: '15', label: 'Chuyên gia tư vấn', icon: '👨‍⚕️', color: '#F59E0B' },
  { id: 4, count: '2,500+', label: 'Người dùng active', icon: '👥', color: '#6366F1' },
];

const features = [
  {
    id: 'articles',
    title: 'Bài viết',
    desc: 'Tìm hiểu kiến thức về phòng chống bạo lực học đường, kỹ năng ứng phó để bảo vệ bản thân, xây dựng một môi trường lành mạnh.',
    route: '/articles',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'sos',
    title: 'Trợ giúp SOS Khẩn cấp',
    desc: 'Phát tín hiệu cứu trợ tức thì và kích hoạt quy trình bảo vệ khẩn cấp 24/7.',
    route: '/sos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'reports',
    title: 'Báo cáo bảo mật',
    desc: 'Gửi phản ánh cấp tốc, bảo mật về các hành vi bạo lực, bắt nạt hoặc không an toàn.',
    route: '/reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'consultation',
    title: 'Đặt lịch tham vấn',
    desc: 'Đặt lịch hẹn trao đổi trực tiếp với các chuyên gia tâm lý học đường giàu lòng nhân ái.',
    route: '/consultation',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14c1.105 0 2-.895 2-2V7c0-1.105-.895-2-2-2H5c-1.105 0-2 .895-2 2v12c0 1.105.895 2 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'chat',
    title: 'Hỗ trợ trò chuyện',
    desc: 'Kênh chat trực tuyến bảo mật tương đối giữa các người dùng.',
    route: '/chat',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    title: 'Hộp thư thông báo',
    desc: 'Cập nhật thông tin mới nhất về các luồng hoạt động của hệ thống (sự tương tác, trạng thái bài viết,...).',
    route: '/notifications',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const fallbackArticles = [
  {
    id: 1,
    title: 'Kỹ năng phòng chống bạo lực học đường cho học sinh THCS',
    desc: 'Làm thế nào để nhận biết dấu hiệu bạo lực học đường và những kỹ năng mềm giúp học sinh tự bảo vệ bản thân và bạn bè xung quanh hiệu quả.',
    author: 'PGS. TS. Nguyễn Thanh Hà',
    date: '18/07/2026',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 2,
    title: 'Ứng phó thế nào khi phát hiện bắt nạt trên không gian mạng?',
    desc: 'Hướng dẫn chi tiết từng bước xử lý thông tin, lưu lại bằng chứng và tìm kiếm sự trợ giúp đúng nơi khi bạn hoặc người thân bị quấy rối mạng xã hội.',
    author: 'ThS. Lê Minh Trang',
    date: '15/07/2026',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 3,
    title: 'Vai trò của gia đình trong việc đồng hành cùng tâm lý học đường',
    desc: 'Sự phối hợp chặt chẽ giữa phụ huynh và nhà trường là chìa khóa tháo gỡ những vướng mắc tâm lý tuổi dậy thì, xây dựng môi trường phát triển lành mạnh.',
    author: 'TS. Trần Văn Hùng',
    date: '10/07/2026',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
  },
];

const HERO_CAROUSEL_SLIDES = [
  {
    id: 1,
    title: 'Bạn bè cùng nhau',
    desc: 'Môi trường học tập thân thiện, chan hòa và ngập tràn niềm vui',
    image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80',
    alt: 'Nhóm học sinh cùng nhau trò chuyện và học tập vui vẻ trong khuôn viên trường',
    tag: 'Bạn bè gắn kết'
  },
  {
    id: 2,
    title: 'Giáo viên đồng hành',
    desc: 'Thầy cô luôn gần gũi, lắng nghe và dìu dắt từng bước đi',
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
    alt: 'Giáo viên thân thiện tương tác cùng nhóm học sinh trong giờ học',
    tag: 'Thầy cô đồng hành'
  },
  {
    id: 3,
    title: 'Học sinh hỗ trợ nhau',
    desc: 'Tình bạn chân thành, luôn lắng nghe và không ai bị bỏ lại phía sau',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80',
    alt: 'Học sinh hỗ trợ, động viên và sẻ chia cùng bạn bè',
    tag: 'Sẻ chia & Động viên'
  },
  {
    id: 4,
    title: 'Hoạt động học đường',
    desc: 'Teamwork sôi nổi, cùng nhau rèn luyện kỹ năng và trải nghiệm bổ ích',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Nhóm học sinh tham gia hoạt động nhóm và sáng tạo học đường',
    tag: 'Hoạt động học đường'
  },
];

const DEFAULT_ARTICLE_COVER = 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80';

export default function Home() {
  const { user } = useAuth();
  const [featuredArticles, setFeaturedArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [showHotlineModal, setShowHotlineModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hero Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  // Hero carousel autoplay (4.5s)
  useEffect(() => {
    if (isCarouselPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isCarouselPaused]);

  const handlePrevSlide = (e) => {
    if (e) e.stopPropagation();
    setCurrentSlide((prev) => (prev === 0 ? HERO_CAROUSEL_SLIDES.length - 1 : prev - 1));
  };

  const handleNextSlide = (e) => {
    if (e) e.stopPropagation();
    setCurrentSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    if (distance > 45) {
      handleNextSlide();
    } else if (distance < -45) {
      handlePrevSlide();
    }
  };

  const handleCopyHotline = () => {
    try {
      navigator.clipboard.writeText('111');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getFeaturedArticlesService(3)
      .then((data) => {
        if (isMounted) {
          setFeaturedArticles(data);
          setLoadingArticles(false);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi lấy bài viết chất lượng:', err);
        if (isMounted) setLoadingArticles(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="home-page fade-in">

      {/* ── 1. HERO ── */}
      <section className="hero-section">
        <div className="container hero-container">

          <div className="hero-content">
            <span className="hero-badge">🛡️ Lá chắn an toàn cho tương lai học đường</span>

            <h1 className="hero-title">
              Vì Một Môi Trường Học Đường <br />
              <span className="gradient-text">An Toàn &amp; Lành Mạnh</span>
            </h1>

            <p className="hero-description">
              Safe School đồng hành cùng học sinh, phụ huynh và nhà trường trong công cuộc
              xây dựng một môi trường không bạo lực học đường, cung cấp kiến thức liên quan và kết nối nhanh chóng
              với các chuyên gia tâm lý học.
            </p>

            <div className="hero-actions">
              <Link to="/reports" className="btn btn-report-now">
                📢 Báo cáo ngay
              </Link>

              <Link to="/sos" className="btn btn-danger">
                🚨 TRỢ GIÚP SOS
              </Link>

              <Link to="/articles" className="btn btn-primary">
                Khám phá bài viết
                <svg className="btn-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              {user ? (
                <Link to="/consultation" className="btn btn-secondary btn-consultation">
                  🗓️ Đặt lịch tham vấn
                </Link>
              ) : (
                <Link to="/login" className="btn btn-secondary btn-consultation">
                  🔑 Đăng nhập để bắt đầu
                </Link>
              )}
            </div>
          </div>

          <div className="hero-visual">
            <div
              className="visual-card"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Floating top badge */}
              <div className="visual-badge-floating">
                <span className="status-dot"></span> Đang hoạt động bảo mật
              </div>

              {/* 4-Image Carousel */}
              <div className="hero-carousel" aria-roledescription="carousel" aria-label="Hình ảnh SafeSchool">
                <div className="hero-carousel-track">
                  {HERO_CAROUSEL_SLIDES.map((slide, index) => {
                    const isActive = index === currentSlide;
                    return (
                      <div
                        key={slide.id}
                        className={`hero-slide ${isActive ? 'active' : ''}`}
                        aria-hidden={!isActive}
                      >
                        <img
                          src={slide.image}
                          alt={slide.alt}
                          className="hero-image"
                          loading={index === 0 ? 'eager' : 'lazy'}
                        />
                        <div className="hero-slide-overlay">
                          <span className="hero-slide-tag">{slide.tag}</span>
                          <h4 className="hero-slide-title">{slide.title}</h4>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Prev / Next Minimalist Buttons */}
                <button
                  type="button"
                  className="hero-carousel-nav hero-carousel-prev"
                  onClick={handlePrevSlide}
                  aria-label="Ảnh trước"
                  title="Ảnh trước"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button
                  type="button"
                  className="hero-carousel-nav hero-carousel-next"
                  onClick={handleNextSlide}
                  aria-label="Ảnh tiếp theo"
                  title="Ảnh tiếp theo"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>

                {/* Minimalist Indicators */}
                <div className="hero-carousel-indicators" role="tablist" aria-label="Chọn slide">
                  {HERO_CAROUSEL_SLIDES.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      className={`hero-carousel-dot ${index === currentSlide ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlide(index);
                      }}
                      aria-label={`Chuyển tới slide ${index + 1}: ${slide.title}`}
                      aria-selected={index === currentSlide}
                      role="tab"
                    />
                  ))}
                </div>
              </div>

              {/* Floating bottom glass stats card */}
              <div className="glass-stats-card">
                <div className="avatar-group">
                  <span className="avatar">👩‍🏫</span>
                  <span className="avatar">👨‍⚕️</span>
                  <span className="avatar">🧑‍🎓</span>
                </div>
                <div>
                  <p className="glass-title">Chuyên gia túc trực</p>
                  <p className="glass-subtitle">Hỗ trợ 24/7 hoàn toàn tiện lợi</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 2. STATS ── */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map((item) => (
              <div key={item.id} className="stat-card">
                <div className="stat-icon-wrapper" style={{ backgroundColor: `${item.color}15` }}>
                  <span className="stat-icon" style={{ color: item.color }}>{item.icon}</span>
                </div>
                <div className="stat-info">
                  <h3 className="stat-number">{item.count}</h3>
                  <p className="stat-label">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. FEATURES ── */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Chức Năng Nổi Bật</h2>
            <p className="section-subtitle">
              Tổng hợp các chức năng nổi bật làm nên tên tuổi của hệ thống
            </p>
          </div>

          <div className="features-grid">
            {features.map((feat) => (
              <Link key={feat.id} to={feat.route} className="feature-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="feature-icon-box">{feat.icon}</div>
                <h3 className="feature-card-title">{feat.title}</h3>
                <p className="feature-card-desc">{feat.desc}</p>
                <div className="feature-card-action">
                  <span>Trải nghiệm ngay</span>
                  <svg className="action-arrow" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. ARTICLES ── */}
      <section className="articles-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Bài Viết Chất Lượng</h2>
            <p className="section-subtitle">
              Cập nhật kiến thức bổ ích và những kỹ năng sống quan trọng từ đội ngũ chuyên gia hàng đầu hay từ những người dùng có hiểu biết về vấn đề.
            </p>
          </div>

          <div className="articles-grid">
            {(featuredArticles.length > 0 ? featuredArticles : (loadingArticles ? [] : fallbackArticles)).map((art) => {
              const rawImage = art.coverImage || art.cover_image || art.cover || art.thumbnail || art.image || art.imageUrl || art.photoUrl;
              const articleImage = (typeof rawImage === 'string' && rawImage.trim() !== '')
                ? rawImage.trim()
                : DEFAULT_ARTICLE_COVER;
              const articleAuthor = art.authorName || art.author || 'Safe School';
              const articleDate = art.createdAt ? formatDisplayDate(art.createdAt) : (art.date || '');
              const articleDesc = art.summary || (art.content ? (art.content.replace(/<[^>]+>/g, '').slice(0, 140) + '...') : '') || art.desc || '';
              const articleCategory = art.category || 'Kỹ năng';

              return (
                <article key={art.id} className="article-card">
                  <div className="article-image-wrapper">
                    <img
                      src={articleImage}
                      alt={art.title || 'Bài viết chất lượng Safe School'}
                      className="article-image"
                      onError={(e) => {
                        if (e.currentTarget.src !== DEFAULT_ARTICLE_COVER) {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = DEFAULT_ARTICLE_COVER;
                        }
                      }}
                      loading="lazy"
                    />
                    <span className="article-category">{articleCategory}</span>
                  </div>
                  <div className="article-body">
                    <div className="article-meta">
                      <span className="article-author">👤 {articleAuthor}</span>
                      <span className="article-date">📅 {articleDate}</span>
                    </div>
                    <h3 className="article-card-title">{art.title}</h3>
                    <p className="article-card-desc">{articleDesc}</p>
                    <Link to={`/articles/${art.id}`} className="article-btn-more">
                      Xem thêm
                      <svg className="arrow-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. CTA BANNER ── */}
      <section className="cta-banner-section">
        <div className="container">
          <div className="cta-banner-card">
            <div className="cta-banner-content">
              <h2 className="cta-title">Bạn Đang Gặp Vấn Đề Khó Khăn Cần Giúp Đỡ?</h2>
              <p className="cta-desc">
                LẶNG IM ĐẾN LÚC NÀO!!! CHÚNG TÔI SẼ GIÚP ĐỠ KHÓ KHĂN CỦA BẠN TRONG KHẢ NĂNG.
              </p>
            </div>
            <div className="cta-banner-actions">
              <Link to="/reports" className="btn btn-report-now" style={{ backgroundColor: '#ffffff', color: '#1e3c72 !important', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
                📢 Báo cáo ngay
              </Link>
              <Link to="/sos" className="btn btn-danger">
                🚨 Báo cáo khẩn cấp (SOS)
              </Link>
              <button
                type="button"
                onClick={() => setShowHotlineModal(true)}
                className="btn btn-secondary-white"
                style={{ cursor: 'pointer', border: 'none' }}
              >
                📞 Tổng đài bảo vệ trẻ em 111
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Hotline 111 Interactive Modal ── */}
      {showHotlineModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowHotlineModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowHotlineModal(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '16px',
                border: 'none',
                background: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#64748b',
                lineHeight: 1,
              }}
            >
              &times;
            </button>

            <div style={{ fontSize: '2.8rem', marginBottom: '6px' }}>📞</div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: '700' }}>
              Tổng Đài Quốc Gia Bảo Vệ Trẻ Em
            </h3>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '16px' }}>
              <span>●</span> Trực 24/7 - Miễn phí 100% cước gọi
            </div>

            {/* Main Phone Call Card */}
            <div style={{ backgroundColor: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#1d4ed8', letterSpacing: '2px', lineHeight: '1.1' }}>
                111
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: '#475569' }}>
                Đầu số điện thoại quốc gia ứng phó khẩn cấp và bảo vệ an toàn cho trẻ em
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <a
                href="tel:111"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                <span>📞</span> Gọi Ngay 111 (Miễn phí)
              </a>

              <button
                onClick={handleCopyHotline}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: copied ? '#f0fdf4' : '#f8fafc',
                  border: copied ? '1px solid #86efac' : '1px solid #cbd5e1',
                  color: copied ? '#16a34a' : '#334155',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <span>{copied ? '✅' : '📋'}</span> {copied ? 'Đã sao chép số 111!' : 'Sao chép số điện thoại 111'}
              </button>
            </div>

            <p style={{ margin: '0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Các đầu số khẩn cấp khác: <strong>113</strong> (Cảnh sát) | <strong>115</strong> (Cấp cứu y tế)
            </p>
          </div>
        </div>
      )}

    </div>
  );
}