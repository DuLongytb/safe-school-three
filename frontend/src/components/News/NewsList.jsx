import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import NewsCard from './NewsCard';
import './NewsList.css';

const CATEGORIES = [
  'Tất cả',
  'Phòng chống bạo lực',
  'Sức khỏe tâm lý',
  'Kỹ năng sống',
  'An toàn mạng',
  'Khác'
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'views', label: 'Xem nhiều nhất' },
  { value: 'likes', label: 'Thích nhiều nhất' }
];

export default function NewsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const showFavorites = queryParams.get('filter') === 'favorites';

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [displayCount, setDisplayCount] = useState(6);

  // Stats for favorites view
  const [favStats, setFavStats] = useState({ totalLikes: 0, totalFavs: 0 });

  // Fetch articles from Firestore in real-time
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    let unsubscribeArticles = null;
    let unsubscribeFavorites = null;

    if (showFavorites) {
      if (!user) {
        setArticles([]);
        setLoading(false);
        return;
      }

      // 1. Listen to 'fav' collection for this user in real-time
      const favQuery = query(collection(db, 'fav'), where('userId', '==', user.uid));
      unsubscribeFavorites = onSnapshot(favQuery, (favSnap) => {
        const favoriteIds = favSnap.docs.map(d => d.data().articleId);
        
        if (favoriteIds.length === 0) {
          setArticles([]);
          setLoading(false);
          return;
        }

        // 2. Listen to active articles collection
        const articlesQuery = query(collection(db, 'articles'), where('isDeleted', '!=', true));
        if (unsubscribeArticles) unsubscribeArticles();
        
        unsubscribeArticles = onSnapshot(articlesQuery, (artSnap) => {
          let favArticles = artSnap.docs
            .map(docSnap => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
              };
            })
            .filter(a => favoriteIds.includes(a.id));

          // Client-side filtering & sorting
          if (selectedCategory && selectedCategory !== 'Tất cả') {
            favArticles = favArticles.filter(a => a.category === selectedCategory);
          }
          if (activeSearchQuery && activeSearchQuery.trim() !== '') {
            const term = activeSearchQuery.toLowerCase().trim();
            favArticles = favArticles.filter(a => 
              (a.title && a.title.toLowerCase().includes(term)) ||
              (a.summary && a.summary.toLowerCase().includes(term)) ||
              (a.content && a.content.toLowerCase().includes(term))
            );
          }
          if (selectedSort === 'newest') {
            favArticles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          } else if (selectedSort === 'oldest') {
            favArticles.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          } else if (selectedSort === 'views') {
            favArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
          } else if (selectedSort === 'likes') {
            favArticles.sort((a, b) => (b.likes || 0) - (a.likes || 0));
          }

          setArticles(favArticles);
          setLoading(false);
        }, (err) => {
          console.error("Error listening to articles:", err);
          setError("Không thể tải danh sách bài viết từ hệ thống.");
          setLoading(false);
        });
      }, (err) => {
        console.error("Error listening to favorites:", err);
        setError("Không thể tải danh sách yêu thích.");
        setLoading(false);
      });

    } else {
      // Normal articles list in real-time (filter out pending or rejected articles for public view)
      const articlesQuery = query(collection(db, 'articles'), where('isDeleted', '!=', true));
      unsubscribeArticles = onSnapshot(articlesQuery, (artSnap) => {
        let allArticles = artSnap.docs
          .map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
            };
          })
          .filter(a => (!a.status || a.status === 'approved') && (a.visibility === 'public' || !a.visibility));

        // Client-side filtering & sorting
        if (selectedCategory && selectedCategory !== 'Tất cả') {
          allArticles = allArticles.filter(a => a.category === selectedCategory);
        }
        if (activeSearchQuery && activeSearchQuery.trim() !== '') {
          const term = activeSearchQuery.toLowerCase().trim();
          allArticles = allArticles.filter(a => 
            (a.title && a.title.toLowerCase().includes(term)) ||
            (a.summary && a.summary.toLowerCase().includes(term)) ||
            (a.content && a.content.toLowerCase().includes(term))
          );
        }
        if (selectedSort === 'newest') {
          allArticles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (selectedSort === 'oldest') {
          allArticles.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (selectedSort === 'views') {
          allArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else if (selectedSort === 'likes') {
          allArticles.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        }

        setArticles(allArticles);
        setLoading(false);
      }, (err) => {
        console.error("Error listening to articles:", err);
        setError("Không thể tải danh sách bài viết từ hệ thống.");
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribeArticles) unsubscribeArticles();
      if (unsubscribeFavorites) unsubscribeFavorites();
    };
  }, [selectedCategory, selectedSort, showFavorites, user, activeSearchQuery]);

  // Compute favorites page stats: ALL interactions current user has performed
  useEffect(() => {
    if (!showFavorites || !user) {
      setFavStats({ totalLikes: 0, totalFavs: 0 });
      return;
    }

    // 1. Count articles this user has liked (includes own articles)
    const likedQuery = query(
      collection(db, 'articles'),
      where('likedBy', 'array-contains', user.uid)
    );
    const unsubLiked = onSnapshot(likedQuery, (snap) => {
      setFavStats(prev => ({ ...prev, totalLikes: snap.size }));
    }, err => console.error('Error computing liked stats:', err));

    // 2. Count all fav docs of this user (includes own articles)
    const favQuery = query(
      collection(db, 'fav'),
      where('userId', '==', user.uid)
    );
    const unsubFav = onSnapshot(favQuery, (snap) => {
      setFavStats(prev => ({ ...prev, totalFavs: snap.size }));
    }, err => console.error('Error computing fav stats:', err));

    return () => {
      unsubLiked();
      unsubFav();
    };
  }, [showFavorites, user]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearchQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
  };

  const visibleArticles = articles.slice(0, displayCount);


  return (
    <div className="news-list-container">
      {/* Header Bar */}
      <div className="news-header-bar">
        <div>
          <h1 className="page-title">
            {showFavorites ? 'Bài viết yêu thích' : 'Bài viết & Tin Tức Học Đường'}
          </h1>
          <p className="page-subtitle">
            {showFavorites
              ? 'Danh sách những bài viết bạn đã lưu và yêu thích trên hệ thống SafeSchool.'
              : 'Cập nhật những thông tin, kiến thức và kỹ năng sống bổ ích dành cho học sinh, phụ huynh và nhà trường.'}
          </p>
        </div>

        {!showFavorites && (
          <button
            className="btn btn-primary btn-create-post"
            onClick={() => {
              if (user) {
                navigate('/articles/create');
              } else {
                alert('Vui lòng đăng nhập để tạo bài viết mới.');
                navigate('/login');
              }
            }}
          >
            ➕ Tạo bài viết mới
          </button>
        )}
      </div>


      {/* Stats bar for favorites view */}
      {showFavorites && (
        <div className="fav-stats-bar">
          <span className="fav-stat-item">
            👍 <strong>{favStats.totalLikes.toLocaleString('vi-VN')}</strong> lượt thích đã thực hiện
          </span>
          <span className="fav-stat-item">
            ❤️ <strong>{favStats.totalFavs.toLocaleString('vi-VN')}</strong> lượt yêu thích đã thực hiện
          </span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="news-filter-toolbar">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm bài viết theo tiêu đề, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="clear-search-btn" onClick={handleClearSearch}>
                ✖
              </button>
            )}
          </div>
          <button type="submit" className="btn btn-secondary search-btn">
            Tìm kiếm
          </button>
        </form>

        {/* Sort Dropdown */}
        <div className="sort-wrapper">
          <label className="sort-label">Sắp xếp:</label>
          <select
            className="sort-select"
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="category-pills">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles Grid / Loading / Error / Empty States */}
      {loading ? (
        <div className="news-loading-state">
          <div className="spinner"></div>
          <p>Đang tải bài viết từ hệ thống...</p>
        </div>
      ) : error ? (
        <div className="news-error-state">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => navigate(0)}>Thử lại</button>
        </div>
      ) : visibleArticles.length === 0 ? (
        <div className="news-empty-state">
          <span className="empty-icon">📂</span>
          <h3>Chưa có bài viết nào</h3>
          <p>Không tìm thấy bài viết nào phù hợp với bộ lọc hoặc tìm kiếm hiện tại.</p>
          {user && !showFavorites && (
            <button className="btn btn-primary" onClick={() => navigate('/articles/create')}>
              Hãy là người đầu tiên viết bài
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="articles-grid">
            {visibleArticles.map(article => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>

          {/* Load More Button */}
          {displayCount < articles.length && (
            <div className="load-more-container">
              <button
                className="btn btn-secondary load-more-btn"
                onClick={() => setDisplayCount(prev => prev + 6)}
              >
                Xem thêm bài viết ({articles.length - displayCount})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

