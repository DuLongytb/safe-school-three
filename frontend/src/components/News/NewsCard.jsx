import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { doc, onSnapshot, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getCommentsService } from '../../services/articleService';
import Avatar from '../User/Avatar';
import './NewsCard.css';

export default function NewsCard({ article }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [commentsCount, setCommentsCount] = useState(0);

  // Real-time author profile
  const [authorName, setAuthorName] = useState(
    article.authorExists === false ? 'Người dùng không tồn tại' : (article.authorName || 'Safe School')
  );
  const [authorAvatar, setAuthorAvatar] = useState(
    article.authorExists === false ? '' : (article.authorAvatar || '')
  );

  // Favorite state for this card
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Fetch comments count
  useEffect(() => {
    if (!article?.id) return;
    getCommentsService(article.id)
      .then(data => setCommentsCount(data.length))
      .catch(err => console.error('Error fetching comments count:', err));
  }, [article.id]);

  // Real-time author profile sync
  useEffect(() => {
    if (article.authorExists === false || !article.authorId || article.authorId === 'anonymous') return;
    const userDocRef = doc(db, 'users', article.authorId);
    const unsub = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.is_anonymous) {
          setAuthorName('Người dùng ẩn danh');
          setAuthorAvatar('');
        } else {
          setAuthorName(data.DisplayName || data.displayName || article.authorName || 'Safe School');
          setAuthorAvatar(data.avatarUrl || '');
        }
      }
    }, err => console.error('NewsCard author snapshot error:', err));
    return () => unsub();
  }, [article.authorId, article.authorExists, article.authorName, article.authorAvatar]);

  // Real-time favorite status sync from `fav` collection
  useEffect(() => {
    if (!user || !article?.id) {
      setIsFavorite(false);
      return;
    }
    const favQuery = query(
      collection(db, 'fav'),
      where('userId', '==', user.uid),
      where('articleId', '==', article.id)
    );
    const unsub = onSnapshot(favQuery, (snap) => {
      setIsFavorite(!snap.empty);
    }, err => console.error('NewsCard fav snapshot error:', err));
    return () => unsub();
  }, [user, article.id]);

  if (!article) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch { return dateString; }
  };

  const defaultImage = 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80';

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();
    if (!user) {
      alert('Vui lòng đăng nhập để yêu thích bài viết.');
      navigate('/login');
      return;
    }
    if (favLoading) return;
    setFavLoading(true);
    try {
      const favRef = collection(db, 'fav');
      const q = query(favRef, where('userId', '==', user.uid), where('articleId', '==', article.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Remove from favorites
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'fav', d.id))));
      } else {
        // Add to favorites (prevent duplicates by checking first)
        await addDoc(favRef, {
          userId: user.uid,
          articleId: article.id,
          createdAt: serverTimestamp(),
        });
      }
      // State updates automatically via onSnapshot above
    } catch (err) {
      console.error('Error toggling favorite in NewsCard:', err);
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <article className="news-card">
      {/* Cover Image */}
      <div className="card-image-container" onClick={() => navigate(`/articles/${article.id}`)}>
        <img
          src={article.coverImage || defaultImage}
          alt={article.title}
          className="card-cover-image"
          onError={(e) => { e.target.src = defaultImage; }}
        />
        <span className="card-category-tag">{article.category || 'Kiến thức'}</span>
      </div>

      {/* Card Body */}
      <div className="card-body">
        {/* Author & Meta */}
        <div className="card-author-meta">
          <div
            className="author-info"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (article.authorExists !== false && article.authorId && article.authorId !== 'anonymous') {
                navigate(`/profile?uid=${article.authorId}`);
              } else if (article.authorExists === false) {
                alert('Không thể mở trang cá nhân vì tài khoản này không còn tồn tại.');
              }
            }}
          >
            <Avatar
              src={authorAvatar}
              alt={authorName}
              className="author-avatar-sm"
              style={{ width: '28px', height: '28px' }}
            />
            <span className="author-name">{authorName}</span>
          </div>
          <span className="publish-date">{formatDate(article.createdAt)}</span>
        </div>

        {/* Title */}
        <h3
          className="card-title"
          onClick={() => navigate(`/articles/${article.id}`)}
          title={article.title}
        >
          {article.title}
        </h3>

        {/* Summary */}
        <p className="card-summary">
          {article.summary || (article.content?.substring(0, 120) + '...')}
        </p>

        {/* Footer */}
        <div className="card-footer">
          <div className="card-metrics">
            <span className="metric-item" title="Lượt xem">👁️ {article.views || 0}</span>
            <span className="metric-item" title="Lượt thích">❤️ {article.likes || 0}</span>
            <span className="metric-item" title="Bình luận">💬 {commentsCount || 0}</span>
          </div>

          <div className="card-actions-row">
            {/* Favorite Button */}
            <button
              className={`btn-card-fav ${isFavorite ? 'active' : ''}`}
              onClick={handleToggleFavorite}
              disabled={favLoading}
              title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            >
              {isFavorite ? '❤️ Đã yêu thích' : '🤍 Yêu thích'}
            </button>

            {/* Read More */}
            <button
              className="btn-read-more"
              onClick={() => navigate(`/articles/${article.id}`)}
            >
              Đọc tiếp
              <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
