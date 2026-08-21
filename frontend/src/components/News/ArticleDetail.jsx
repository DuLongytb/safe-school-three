import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import {
  doc, getDoc, onSnapshot,
  collection, query, where,
  getDocs, addDoc, updateDoc, deleteDoc,
  increment, arrayUnion, arrayRemove, serverTimestamp
} from 'firebase/firestore';
import Avatar from '../User/Avatar';
import {
  getArticleByIdService,
  toggleLikeService,
  addCommentService,
  updateCommentService,
  deleteCommentService,
  deleteArticleCascadeService,
  approveArticleService,
  rejectArticleService,
  generateAnonymousStudentName
} from '../../services/articleService';
import { createNotification } from '../../services/notificationService';
import './ArticleDetail.css';

// ── Helper: Relative time format (e.g. "Vừa xong", "5 phút trước", "2 giờ trước") ──
export const formatTimeAgo = (dateVal) => {
  if (!dateVal) return 'Vừa xong';
  try {
    let date;
    if (typeof dateVal === 'object' && dateVal !== null) {
      if (typeof dateVal.toDate === 'function') date = dateVal.toDate();
      else if (typeof dateVal.seconds === 'number') date = new Date(dateVal.seconds * 1000);
    }
    if (!date) date = new Date(dateVal);
    if (isNaN(date.getTime())) return 'Vừa xong';

    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 45) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ngày trước`;

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'Vừa xong';
  }
};

// ── CommentItem: Facebook-inspired modern comment bubble + likes + replies ──
function CommentItem({
  cmt,
  depth = 0,
  user,
  allComments,
  articleAuthorId,
  canModerate,
  editingCommentId,
  editingCommentText,
  setEditingCommentId,
  setEditingCommentText,
  handleSaveEditComment,
  handleDeleteComment,
  handleUserClick,
  formatDate,
  onReplySubmit,
  showToast,
}) {
  const isInitialAnon = Boolean(
    cmt.anonymous ||
    cmt.isAnonymous ||
    cmt.is_anonymous ||
    cmt.userId === 'anonymous' ||
    cmt.userName === 'Ẩn danh' ||
    cmt.userName === 'Người dùng ẩn danh' ||
    (cmt.displayName && typeof cmt.displayName === 'string' && cmt.displayName.startsWith('Bạn học #')) ||
    (cmt.userName && typeof cmt.userName === 'string' && cmt.userName.startsWith('Bạn học #'))
  );
  const [isAnonymousUser, setIsAnonymousUser] = useState(isInitialAnon);
  const [cmtUserName, setCmtUserName] = useState(
    cmt.displayName || cmt.userName || (isInitialAnon ? 'Bạn học #----' : 'Thành viên')
  );
  const [cmtUserAvatar, setCmtUserAvatar] = useState(isInitialAnon ? '' : (cmt.userAvatar || ''));
  const [likeCount, setLikeCount] = useState(cmt.likes || 0);
  const [isLikedByMe, setIsLikedByMe] = useState(
    user && cmt.likedBy && Array.isArray(cmt.likedBy)
      ? cmt.likedBy.includes(user.uid)
      : false
  );
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isAnonymousReply, setIsAnonymousReply] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const menuRef = useRef(null);
  const replyInputRef = useRef(null);

  // Real-time author profile sync - ONLY sync if NOT anonymous!
  useEffect(() => {
    // If comment is stored as anonymous, NEVER fetch or overwrite with real user profile
    if (isInitialAnon || cmt.anonymous || cmt.isAnonymous || cmt.is_anonymous || !cmt.userId || cmt.userId === 'anonymous') {
      setIsAnonymousUser(true);
      setCmtUserName(cmt.displayName || cmt.userName || 'Bạn học #----');
      setCmtUserAvatar('');
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', cmt.userId), (snap) => {
      if (snap.exists()) {
        const d = snap.data() || {};
        if (d.is_anonymous || d.isAnonymous) {
          setIsAnonymousUser(true);
          setCmtUserName(cmt.displayName || cmt.userName || 'Ẩn danh');
          setCmtUserAvatar('');
        } else {
          setIsAnonymousUser(false);
          setCmtUserName(d.DisplayName || d.displayName || cmt.displayName || cmt.userName || 'Thành viên');
          setCmtUserAvatar(d.avatarUrl || '');
        }
      }
    }, err => console.error('CommentItem user snapshot error:', err));
    return () => unsub();
  }, [cmt.userId, isInitialAnon, cmt.anonymous, cmt.isAnonymous, cmt.displayName, cmt.userName]);

  // Real-time comment likes sync
  useEffect(() => {
    if (!cmt.id) return;
    const unsub = onSnapshot(doc(db, 'comments', cmt.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data() || {};
        setLikeCount(d.likes || 0);
        setIsLikedByMe(
          user && d.likedBy && Array.isArray(d.likedBy)
            ? d.likedBy.includes(user.uid)
            : false
        );
      }
    }, err => console.error('CommentItem like snapshot error:', err));
    return () => unsub();
  }, [cmt.id, user]);

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMenu]);

  // Auto focus reply textarea when opened
  useEffect(() => {
    if (showReplyBox && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyBox]);

  const handleLikeComment = async (e) => {
    e.stopPropagation();
    if (!user) {
      showToast?.('Vui lòng đăng nhập để thích bình luận.');
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const prevLiked = isLikedByMe;
    const prevCount = likeCount;

    // Optimistic UI update
    setIsLikedByMe(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const cmtRef = doc(db, 'comments', cmt.id);
      if (prevLiked) {
        await updateDoc(cmtRef, {
          likes: increment(-1),
          likedBy: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(cmtRef, {
          likes: increment(1),
          likedBy: arrayUnion(user.uid)
        });

        // Send notification to comment author if not current user and not anonymous
        if (cmt.userId && cmt.userId !== 'anonymous' && cmt.userId !== user.uid) {
          await createNotification({
            userId: cmt.userId,
            title: 'Bình luận được thích',
            message: `${user.displayName || 'Một người dùng'} vừa thích bình luận của bạn.`,
            type: 'article_like',
            relatedId: cmt.articleId,
            relatedType: 'article',
          });
        }
      }
    } catch (err) {
      console.error('Error liking comment:', err);
      // Revert optimistic update
      setIsLikedByMe(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitReply = async (e) => {
    if (e) e.preventDefault();
    if (!user) {
      showToast?.('Vui lòng đăng nhập để trả lời bình luận.');
      return;
    }
    if (!replyText.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const parentAuthorDisplayName = cmtUserName;
      await onReplySubmit(cmt.id, replyText, parentAuthorDisplayName, isAnonymousReply);
      setReplyText('');
      setIsAnonymousReply(false);
      setShowReplyBox(false);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEditComment(cmt.id);
    }
  };

  const handleCopyComment = () => {
    setShowMenu(false);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cmt.content || '');
      showToast?.('Đã sao chép nội dung bình luận!');
    }
  };

  const handleReportComment = () => {
    setShowMenu(false);
    showToast?.('Đã gửi báo cáo bình luận tới ban quản trị SafeSchool.');
  };

  const isOwner = user && user.uid === cmt.userId && !isAnonymousUser;
  const isArticleAuthor = !isAnonymousUser && cmt.userId === articleAuthorId;
  const isEditing = editingCommentId === cmt.id;

  // Flattened replies directly under this comment
  const replies = allComments.filter(c => c.parentId === cmt.id);

  return (
    <div className={`modern-comment-thread ${depth > 0 ? 'is-reply' : ''}`}>
      <div className="modern-comment-row">
        {/* User Avatar - Always guaranteed with Anonymous fallback */}
        <Avatar
          src={isAnonymousUser ? '' : cmtUserAvatar}
          alt={isAnonymousUser ? 'Ẩn danh' : cmtUserName}
          isAnonymous={isAnonymousUser}
          className="modern-comment-avatar"
          style={{
            width: depth > 0 ? '34px' : '40px',
            height: depth > 0 ? '34px' : '40px',
          }}
          onClick={isAnonymousUser ? undefined : () => handleUserClick(cmt.userId)}
        />

        <div className="modern-comment-body">
          {/* Comment Bubble with Content & Menu */}
          <div className="modern-comment-bubble-wrapper">
            <div className={`modern-comment-bubble ${isEditing ? 'is-editing' : ''}`}>
              {/* Top Header inside bubble */}
              <div className="modern-bubble-header">
                <div className="modern-bubble-user-info">
                  <span
                    className={`modern-comment-author ${isAnonymousUser ? 'is-anonymous' : ''}`}
                    onClick={isAnonymousUser ? undefined : () => handleUserClick(cmt.userId)}
                    style={isAnonymousUser ? { cursor: 'default' } : {}}
                  >
                    {isAnonymousUser ? 'Ẩn danh' : cmtUserName}
                  </span>

                  {isArticleAuthor && (
                    <span className="modern-badge-author" title="Tác giả bài viết">
                      Tác giả
                    </span>
                  )}

                  {cmt.replyToName && (
                    <span className="modern-reply-tag">
                      ↩ {cmt.replyToName}
                    </span>
                  )}
                </div>

                {/* 3-Dots Action Menu */}
                <div className="modern-comment-menu-wrapper" ref={menuRef}>
                  <button
                    type="button"
                    className="modern-comment-menu-btn"
                    onClick={() => setShowMenu(prev => !prev)}
                    aria-label="Tùy chọn bình luận"
                    title="Tùy chọn"
                  >
                    •••
                  </button>

                  {showMenu && (
                    <div className="modern-comment-dropdown fade-in">
                      {isOwner && (
                        <button
                          type="button"
                          className="modern-dropdown-item"
                          onClick={() => {
                            setShowMenu(false);
                            setEditingCommentId(cmt.id);
                            setEditingCommentText(cmt.content);
                          }}
                        >
                          ✏️ Chỉnh sửa
                        </button>
                      )}

                      {(isOwner || canModerate) && (
                        <button
                          type="button"
                          className="modern-dropdown-item text-danger"
                          onClick={() => {
                            setShowMenu(false);
                            handleDeleteComment(cmt.id);
                          }}
                        >
                          🗑️ Xóa bình luận
                        </button>
                      )}

                      {!isOwner && (
                        <button
                          type="button"
                          className="modern-dropdown-item"
                          onClick={handleReportComment}
                        >
                          🚩 Báo cáo bình luận
                        </button>
                      )}

                      <button
                        type="button"
                        className="modern-dropdown-item"
                        onClick={handleCopyComment}
                      >
                        📋 Sao chép nội dung
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bubble Content or Inline Edit */}
              {isEditing ? (
                <div className="modern-edit-box">
                  <textarea
                    className="modern-edit-textarea"
                    rows="2"
                    value={editingCommentText}
                    onChange={(e) => setEditingCommentText(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    autoFocus
                  />
                  <div className="modern-edit-actions">
                    <span className="modern-edit-hint">Nhấn Enter để lưu</span>
                    <div className="modern-edit-btn-group">
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingCommentText('');
                        }}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => handleSaveEditComment(cmt.id)}
                        disabled={!editingCommentText.trim()}
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="modern-comment-text">{cmt.content}</p>
              )}
            </div>

            {/* Like Counter Badge floating on bottom right of bubble */}
            {likeCount > 0 && (
              <div className="modern-like-badge" title={`${likeCount} người thích`}>
                <span className="like-badge-icon">👍</span>
                <span className="like-badge-count">{likeCount}</span>
              </div>
            )}
          </div>

          {/* Action Row: Like · Reply · Timestamp */}
          <div className="modern-comment-actions-row">
            {/* Like Button */}
            <button
              type="button"
              className={`modern-action-btn like-action ${isLikedByMe ? 'is-liked' : ''}`}
              onClick={handleLikeComment}
              title={isLikedByMe ? 'Bỏ thích' : 'Thích bình luận này'}
            >
              <span className="action-icon">👍</span>
              <span>{isLikedByMe ? 'Đã thích' : 'Thích'}</span>
            </button>

            <span className="modern-action-divider">·</span>

            {/* Reply Button */}
            <button
              type="button"
              className="modern-action-btn reply-action"
              onClick={() => {
                if (!user) {
                  showToast?.('Vui lòng đăng nhập để trả lời bình luận.');
                  return;
                }
                setShowReplyBox(prev => !prev);
              }}
            >
              <span>Trả lời</span>
            </button>

            <span className="modern-action-divider">·</span>

            {/* Timestamp with full date tooltip */}
            <span className="modern-comment-time" title={formatDate(cmt.createdAt)}>
              {formatTimeAgo(cmt.createdAt)}
            </span>
          </div>

          {/* Inline Reply Input Box */}
          {showReplyBox && (
            <div className="modern-reply-input-box fade-in">
              <Avatar
                src={isAnonymousReply ? '' : user?.avatarUrl}
                alt={isAnonymousReply ? 'Ẩn danh' : (user?.displayName || 'Your Avatar')}
                isAnonymous={isAnonymousReply}
                className="modern-reply-user-avatar"
                style={{ width: '32px', height: '32px' }}
              />
              <div className="modern-reply-form-wrapper">
                <textarea
                  ref={replyInputRef}
                  className="modern-reply-textarea"
                  rows={2}
                  placeholder={`Trả lời ${cmtUserName}...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                />
                <div className="modern-reply-actions-bar">
                  <label className="comment-anonymous-toggle">
                    <input
                      type="checkbox"
                      checked={isAnonymousReply}
                      onChange={(e) => setIsAnonymousReply(e.target.checked)}
                    />
                    <span className="anon-toggle-text">Trả lời ẩn danh</span>
                  </label>

                  <div className="modern-reply-btn-group">
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => {
                        setReplyText('');
                        setIsAnonymousReply(false);
                        setShowReplyBox(false);
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={handleSubmitReply}
                      disabled={!replyText.trim() || submittingReply}
                    >
                      {submittingReply ? 'Đang gửi...' : 'Trả lời'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Child Replies */}
          {replies.length > 0 && (
            <div className="modern-replies-container">
              {replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  cmt={reply}
                  depth={depth + 1}
                  user={user}
                  allComments={allComments}
                  articleAuthorId={articleAuthorId}
                  canModerate={canModerate}
                  editingCommentId={editingCommentId}
                  editingCommentText={editingCommentText}
                  setEditingCommentId={setEditingCommentId}
                  setEditingCommentText={setEditingCommentText}
                  handleSaveEditComment={handleSaveEditComment}
                  handleDeleteComment={handleDeleteComment}
                  handleUserClick={handleUserClick}
                  formatDate={formatDate}
                  onReplySubmit={onReplySubmit}
                  showToast={showToast}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ArticleDetail ────────────────────────────────────────────────────────
export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time Author
  const [authorName, setAuthorName] = useState('Safe School Author');
  const [authorAvatar, setAuthorAvatar] = useState('');

  // Like
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  // Favorite (real-time from fav collection)
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);

  // Comments & Modern Interactions
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSort, setCommentSort] = useState('newest'); // 'newest' | 'popular' | 'oldest'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentToast, setCommentToast] = useState({ message: '', isVisible: false });

  // UI
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const sortDropdownRef = useRef(null);
  const mainInputRef = useRef(null);

  const showToast = (message) => {
    setCommentToast({ message, isVisible: true });
    setTimeout(() => {
      setCommentToast({ message: '', isVisible: false });
    }, 3000);
  };

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setShowSortDropdown(false);
      }
    };
    if (showSortDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSortDropdown]);

  // ── Fetch article + comments ──
  useEffect(() => {
    if (id) fetchArticleAndData();
  }, [id, user]);

  // ── Real-time author sync ──
  useEffect(() => {
    if (!article) return;
    if (article.authorId === 'anonymous' || article.is_anonymous || article.isAnonymous) {
      setAuthorName('Ẩn danh');
      setAuthorAvatar('');
      return;
    }
    setAuthorName(article.authorName || 'Safe School Author');
    setAuthorAvatar(article.authorAvatar || '');
    if (article.authorExists === false || !article.authorId) return;

    const unsub = onSnapshot(doc(db, 'users', article.authorId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.is_anonymous || d.isAnonymous) { setAuthorName('Ẩn danh'); setAuthorAvatar(''); }
        else {
          setAuthorName(d.DisplayName || d.displayName || article.authorName || 'Safe School Author');
          setAuthorAvatar(d.avatarUrl || '');
        }
      }
    }, err => console.error('ArticleDetail author snapshot error:', err));
    return () => unsub();
  }, [article?.authorId, article?.authorExists, article?.is_anonymous, article?.isAnonymous]);

  // ── Real-time fav sync ──
  useEffect(() => {
    if (!id) return;
    // total fav count for this article
    const allFavUnsub = onSnapshot(
      query(collection(db, 'fav'), where('articleId', '==', id)),
      snap => setFavoritesCount(snap.size),
      err => console.error('ArticleDetail fav count error:', err)
    );

    let userFavUnsub = () => {};
    if (user) {
      userFavUnsub = onSnapshot(
        query(collection(db, 'fav'), where('userId', '==', user.uid), where('articleId', '==', id)),
        snap => setIsFavorite(!snap.empty),
        err => console.error('ArticleDetail user fav error:', err)
      );
    } else {
      setIsFavorite(false);
    }

    return () => { allFavUnsub(); userFavUnsub(); };
  }, [id, user]);

  // ── Real-time comments sync ──
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'comments'), where('articleId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      const cmts = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
        };
      });
      setComments(cmts);
    }, err => console.error('Comments snapshot error:', err));
    return () => unsub();
  }, [id]);

  const fetchArticleAndData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArticleByIdService(id, true);
      if (!data) { setError('Bài viết không tồn tại hoặc đã bị xóa.'); setLoading(false); return; }

      setArticle(data);
      setAuthorName(data.authorName || 'Safe School Author');
      setAuthorAvatar(data.authorAvatar || '');
      setLikesCount(data.likes || 0);
      if (user && data.likedBy && Array.isArray(data.likedBy)) setIsLiked(data.likedBy.includes(user.uid));
      else setIsLiked(false);
    } catch (err) {
      console.error('Error fetching article detail:', err);
      setError('Đã xảy ra lỗi khi tải bài viết.');
    } finally {
      setLoading(false);
    }
  };

  // ── Like article ──
  const handleLike = async () => {
    if (!user) { alert('Vui lòng đăng nhập để thích bài viết.'); navigate('/login'); return; }
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      await toggleLikeService(id, user.uid, prevLiked);
      if (!prevLiked && article?.authorId && article.authorId !== user.uid) {
        await createNotification({
          userId: article.authorId,
          title: 'Bài viết được thích',
          message: `${user.displayName || 'Một người dùng'} vừa thích bài viết "${article.title || 'của bạn'}".`,
          type: 'article_like',
          relatedId: id,
          relatedType: 'article',
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  // ── Favorite article — duplicate-safe ──
  const handleFavorite = async () => {
    if (!user) { alert('Vui lòng đăng nhập để yêu thích bài viết.'); navigate('/login'); return; }
    try {
      const favRef = collection(db, 'fav');
      const snap = await getDocs(query(favRef, where('userId', '==', user.uid), where('articleId', '==', id)));
      if (!snap.empty) {
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'fav', d.id))));
      } else {
        await addDoc(favRef, { userId: user.uid, articleId: id, createdAt: serverTimestamp() });
        if (article?.authorId && article.authorId !== user.uid) {
          await createNotification({
            userId: article.authorId,
            title: 'Bài viết được thêm vào yêu thích',
            message: `${user.displayName || 'Một người dùng'} vừa thêm bài viết "${article.title || 'của bạn'}" vào mục yêu thích.`,
            type: 'article_favorite',
            relatedId: id,
            relatedType: 'article',
          });
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // ── Add comment (with persistent anonymous option) ──
  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!user) {
      alert('Vui lòng đăng nhập để bình luận.');
      navigate('/login');
      return;
    }
    if (!newCommentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      await addCommentService(id, user, newCommentText, { anonymous: isAnonymousComment });
      if (article?.authorId && article.authorId !== user.uid) {
        const commentSenderName = isAnonymousComment ? 'Một bạn học' : (user.displayName || 'Một người dùng');
        await createNotification({
          userId: article.authorId,
          title: 'Có bình luận mới',
          message: `${commentSenderName} vừa bình luận về bài viết "${article.title || 'của bạn'}".`,
          type: 'article_comment',
          relatedId: id,
          relatedType: 'article',
        });
      }
      setNewCommentText('');
      setIsAnonymousComment(false);
      setIsInputExpanded(false);
      showToast(isAnonymousComment ? 'Đã đăng bình luận ẩn danh thành công!' : 'Đã đăng bình luận thành công!');
    } catch (err) {
      console.error('Error adding comment:', err);
      showToast('Không thể đăng bình luận. Vui lòng thử lại.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleMainInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  // ── Reply to comment (with persistent anonymous option) ──
  const handleReplySubmit = async (parentId, replyContent, replyToName, isReplyAnon = false) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để trả lời.');
      return;
    }
    if (!replyContent.trim()) return;
    try {
      const isAnonymous = Boolean(isReplyAnon);
      const replyDisplayName = isAnonymous
        ? generateAnonymousStudentName()
        : (user.displayName || user.email || 'Người dùng Safe School');

      const newReply = {
        articleId: id,
        userId: user.uid,
        userName: replyDisplayName,
        displayName: replyDisplayName,
        userAvatar: isAnonymous ? '' : (user.avatarUrl || ''),
        anonymous: isAnonymous,
        isAnonymous: isAnonymous,
        content: replyContent.trim(),
        parentId: parentId,
        replyToName: replyToName,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'comments'), newReply);

      // Send notification to parent comment author if not current user
      const parentCmt = comments.find(c => c.id === parentId);
      if (parentCmt?.userId && parentCmt.userId !== 'anonymous' && parentCmt.userId !== user.uid) {
        const replySenderName = isAnonymous ? 'Một bạn học' : (user.displayName || 'Một người dùng');
        await createNotification({
          userId: parentCmt.userId,
          title: 'Có phản hồi cho bình luận của bạn',
          message: `${replySenderName} vừa trả lời bình luận của bạn trong bài viết "${article?.title || 'bài viết'}".`,
          type: 'comment_reply',
          relatedId: id,
          relatedType: 'article',
        });
      }
      showToast(isAnonymous ? 'Đã gửi câu trả lời ẩn danh!' : 'Đã gửi câu trả lời!');
    } catch (err) {
      console.error('Error adding reply:', err);
      showToast('Không thể gửi trả lời. Vui lòng thử lại.');
    }
  };

  // ── Edit comment ──
  const handleSaveEditComment = async (commentId) => {
    if (!editingCommentText.trim()) return;
    try {
      await updateCommentService(commentId, editingCommentText);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editingCommentText } : c));
      setEditingCommentId(null);
      setEditingCommentText('');
      showToast('Đã cập nhật bình luận!');
    } catch (err) {
      console.error('Error updating comment:', err);
      showToast('Không thể cập nhật bình luận.');
    }
  };

  // ── Delete comment ──
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    try {
      await deleteCommentService(commentId);
      // Also delete child replies
      const childIds = comments.filter(c => c.parentId === commentId).map(c => c.id);
      await Promise.all(childIds.map(cid => deleteCommentService(cid)));
      showToast('Đã xóa bình luận.');
    } catch (err) {
      console.error('Error deleting comment:', err);
      showToast('Không thể xóa bình luận.');
    }
  };

  // ── Share ──
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } else {
      alert(`Đã sao chép: ${window.location.href}`);
    }
  };

  // ── Hard (cascade) delete ──
  const handleSoftDelete = async () => {
    const confirmed = window.confirm(
      'Bạn có chắc muốn xóa bài viết này?\nToàn bộ bình luận, lượt yêu thích và báo cáo liên quan cũng sẽ bị xóa vĩnh viễn.'
    );
    if (!confirmed) return;
    try {
      await deleteArticleCascadeService(id);
      alert('Bài viết đã được xóa thành công.');
      navigate('/articles');
    } catch (err) {
      console.error('Error deleting article:', err);
      alert('Không thể xóa bài viết. Vui lòng thử lại.');
    }
  };

  const handleUserClick = async (userId) => {
    if (!userId || userId === 'anonymous') return;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) navigate(`/profile?uid=${userId}`);
      else alert('Không thể mở trang cá nhân vì tài khoản này không còn tồn tại.');
    } catch (err) {
      alert('Không thể mở trang cá nhân.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateString; }
  };

  const defaultImage = 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80';
  const isAuthor = user && article && (user.uid === article.authorId || user.role === 'admin');

  const MODERATOR_ROLES = ['admin', 'teacher', 'psychologist', 'giáo viên', 'chuyên gia'];
  const canModerate = user && user.role && MODERATOR_ROLES.includes(String(user.role).trim().toLowerCase());

  const handleApprove = async () => {
    try {
      await approveArticleService(id, user?.uid || 'admin');
      setArticle(prev => ({ ...prev, status: 'approved', reviewedBy: user?.uid || 'admin', reviewedAt: new Date().toISOString() }));
      alert('Bài viết đã được duyệt thành công!');
    } catch (err) {
      console.error('Error approving article:', err);
      alert('Không thể duyệt bài viết. Vui lòng thử lại.');
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Nhập lý do từ chối bài viết:');
    if (reason === null) return;
    try {
      await rejectArticleService(id, reason, user?.uid || 'admin');
      setArticle(prev => ({ ...prev, status: 'rejected', rejectionReason: reason, reviewedBy: user?.uid || 'admin', reviewedAt: new Date().toISOString() }));
      alert('Bài viết đã bị từ chối.');
    } catch (err) {
      console.error('Error rejecting article:', err);
      alert('Không thể từ chối bài viết. Vui lòng thử lại.');
    }
  };

  // ── Filter and sort root comments ──
  const rootComments = comments.filter(c => !c.parentId);

  const sortedRootComments = [...rootComments].sort((a, b) => {
    if (commentSort === 'popular') {
      const repliesA = comments.filter(c => c.parentId === a.id).length;
      const repliesB = comments.filter(c => c.parentId === b.id).length;
      const scoreA = (a.likes || 0) * 2 + repliesA * 3;
      const scoreB = (b.likes || 0) * 2 + repliesB * 3;
      return scoreB - scoreA;
    }
    if (commentSort === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    // Default 'newest'
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const sortLabelMap = {
    newest: 'Mới nhất',
    popular: 'Phù hợp nhất',
    oldest: 'Cũ nhất'
  };

  if (loading) return (
    <div className="article-detail-container">
      <div className="detail-loading-state"><div className="spinner"></div><p>Đang tải bài viết...</p></div>
    </div>
  );

  // Access control check
  const isAuthorUser = user && article && user.uid === article.authorId;
  const isPrivateViewBlocked = article && article.visibility === 'private' && !isAuthorUser && user?.role !== 'admin';
  const isUnapprovedViewBlocked = article && (article.status === 'pending' || article.status === 'rejected') && !isAuthorUser && !canModerate;

  if (error || !article || isPrivateViewBlocked || isUnapprovedViewBlocked) {
    let errorMessage = error || 'Bài viết không tìm thấy.';
    if (isPrivateViewBlocked) {
      errorMessage = 'Bài viết này ở chế độ riêng tư, chỉ tác giả mới có quyền xem.';
    } else if (isUnapprovedViewBlocked) {
      errorMessage = 'Bài viết này chưa được duyệt công khai. Chỉ tác giả hoặc người kiểm duyệt mới có thể xem.';
    }

    return (
      <div className="article-detail-container">
        <div className="detail-error-state">
          <h2>⚠️ Lỗi truy cập</h2>
          <p>{errorMessage}</p>
          <button className="btn btn-primary" onClick={() => navigate('/articles')}>Quay lại danh sách bài viết</button>
        </div>
      </div>
    );
  }

  return (
    <div className="article-detail-container fade-in">
      <div className="detail-breadcrumb">
        <button className="back-link-btn" onClick={() => navigate('/articles')}>← Quay lại danh sách bài viết</button>
      </div>

      <div className="article-reader-card">
        {/* Moderation Status Banner */}
        {article.status === 'pending' && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <strong style={{ color: '#b45309' }}>⏳ Bài viết đang chờ kiểm duyệt</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#92400e' }}>
                Bài viết này đang được kiểm duyệt trước khi hiển thị công khai.
              </p>
            </div>
            {canModerate && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-success btn-sm" onClick={handleApprove}>
                  ✅ Duyệt bài
                </button>
                <button className="btn btn-danger-outline btn-sm" onClick={handleReject}>
                  ❌ Từ chối bài
                </button>
              </div>
            )}
          </div>
        )}

        {article.status === 'rejected' && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <strong style={{ color: '#b91c1c' }}>❌ Bài viết đã bị từ chối</strong>
            {article.rejectionReason && (
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#991b1b' }}>
                Lý do: {article.rejectionReason}
              </p>
            )}
          </div>
        )}

        {/* Cover */}
        <div className="detail-cover-wrapper">
          <img
            src={article.coverImage || defaultImage}
            alt={article.title}
            className="detail-cover-img"
            onError={(e) => { e.target.src = defaultImage; }}
          />
          <span className="detail-category-badge">{article.category || 'Bài viết'}</span>
        </div>

        {/* Header */}
        <div className="detail-header">
          <h1 className="detail-title">{article.title}</h1>
          <div className="detail-author-row">
            <div
              className="author-box"
              style={{ cursor: article.authorId && article.authorId !== 'anonymous' ? 'pointer' : 'default' }}
              onClick={() => handleUserClick(article.authorId)}
            >
              <Avatar src={authorAvatar} alt={authorName} className="author-avatar-md" style={{ width: '48px', height: '48px' }} />
              <div>
                <p className="author-name-text">{authorName}</p>
                <p className="publish-time-text">Đăng ngày {formatDate(article.createdAt)}</p>
              </div>
            </div>

            {isAuthor && (
              <div className="author-controls">
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/articles/edit/${article.id}`)}>✏️ Chỉnh sửa</button>
                <button className="btn btn-danger-outline btn-sm" onClick={() => setShowDeleteModal(true)}>🗑️ Xóa bài</button>
              </div>
            )}
          </div>
        </div>

        {article.summary && <div className="detail-summary-box"><p>{article.summary}</p></div>}

        <div className="detail-body-content tinymce-content">
          {article.content
            ? <div dangerouslySetInnerHTML={{ __html: article.content }} />
            : <p>Không có nội dung bài viết.</p>
          }
        </div>

        {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
          <div className="detail-tags-section">
            <span className="tags-label">Thẻ chủ đề:</span>
            <div className="tags-list">{article.tags.map((tag, idx) => <span key={idx} className="tag-pill">#{tag}</span>)}</div>
          </div>
        )}

        <hr className="detail-divider" />

        {/* Interaction Bar */}
        <div className="detail-stats-action-bar">
          <div className="detail-stats">
            <span className="stat-badge" title="Lượt xem">👁️ <strong>{article.views || 0}</strong> lượt xem</span>
            <span className="stat-badge" title="Lượt thích">👍 <strong>{likesCount}</strong> lượt thích</span>
            <span className="stat-badge" title="Yêu thích">❤️ <strong>{favoritesCount}</strong> yêu thích</span>
            <span className="stat-badge" title="Bình luận">💬 <strong>{comments.length}</strong> bình luận</span>
          </div>

          <div className="detail-action-buttons">
            <button className={`action-btn like-btn ${isLiked ? 'active' : ''}`} onClick={handleLike}>
              {isLiked ? '👍 Đã thích' : '👍🏻 Thích'} ({likesCount})
            </button>

            <button className={`action-btn fav-btn ${isFavorite ? 'active' : ''}`} onClick={handleFavorite}>
              {isFavorite ? '❤️ Đã yêu thích' : '🤍 Yêu thích'}
            </button>

            <button className="action-btn share-btn" onClick={handleShare}>🔗 Chia sẻ</button>
          </div>
        </div>

        {shareSuccess && <div className="share-toast">✅ Đã sao chép liên kết bài viết vào bộ nhớ tạm!</div>}
      </div>

      {/* ── Modern Comments Section ── */}
      <section className="comments-section" id="comments-section">
        {/* Comment Header with Sort Selector */}
        <div className="comments-header-row">
          <h2 className="comments-title">
            Bình luận <span className="comments-count-pill">{comments.length}</span>
          </h2>

          {/* Sort Selector Dropdown */}
          <div className="comments-sort-wrapper" ref={sortDropdownRef}>
            <button
              type="button"
              className="comments-sort-btn"
              onClick={() => setShowSortDropdown(prev => !prev)}
              aria-label="Sắp xếp bình luận"
            >
              <span className="sort-label">Sắp xếp:</span>
              <span className="sort-active-val">{sortLabelMap[commentSort]}</span>
              <span className="sort-chevron">▾</span>
            </button>

            {showSortDropdown && (
              <div className="comments-sort-menu fade-in">
                <button
                  type="button"
                  className={`sort-menu-item ${commentSort === 'newest' ? 'active' : ''}`}
                  onClick={() => {
                    setCommentSort('newest');
                    setShowSortDropdown(false);
                  }}
                >
                  ⚡ Mới nhất
                </button>
                <button
                  type="button"
                  className={`sort-menu-item ${commentSort === 'popular' ? 'active' : ''}`}
                  onClick={() => {
                    setCommentSort('popular');
                    setShowSortDropdown(false);
                  }}
                >
                  🔥 Phù hợp nhất
                </button>
                <button
                  type="button"
                  className={`sort-menu-item ${commentSort === 'oldest' ? 'active' : ''}`}
                  onClick={() => {
                    setCommentSort('oldest');
                    setShowSortDropdown(false);
                  }}
                >
                  ⏳ Cũ nhất
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Global Comment Toast Notification */}
        {commentToast.isVisible && (
          <div className="comment-feedback-toast fade-in">
            {commentToast.message}
          </div>
        )}

        {/* Modern Facebook-inspired Comment Input Box */}
        <div className="modern-comment-composer">
          <Avatar
            src={isAnonymousComment ? '' : user?.avatarUrl}
            alt={isAnonymousComment ? 'Ẩn danh' : (user?.displayName || 'User')}
            isAnonymous={isAnonymousComment}
            className="composer-user-avatar"
            style={{ width: '40px', height: '40px' }}
          />

          <div className={`composer-input-card ${isInputExpanded ? 'is-expanded' : ''}`}>
            {user ? (
              <>
                <textarea
                  ref={mainInputRef}
                  className="composer-textarea"
                  rows={isInputExpanded ? 3 : 1}
                  placeholder="Viết bình luận..."
                  value={newCommentText}
                  onFocus={() => setIsInputExpanded(true)}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={handleMainInputKeyDown}
                />

                {isInputExpanded && (
                  <div className="composer-actions-row fade-in">
                    <div className="composer-options-left">
                      <label className="comment-anonymous-toggle">
                        <input
                          type="checkbox"
                          checked={isAnonymousComment}
                          onChange={(e) => setIsAnonymousComment(e.target.checked)}
                        />
                        <span className="anon-toggle-text">Bình luận ẩn danh (Bạn học #XXXX)</span>
                      </label>
                      <span className="composer-shortcut-hint">
                        Enter để gửi · Shift+Enter xuống dòng
                      </span>
                    </div>

                    <div className="composer-btn-group">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setNewCommentText('');
                          setIsAnonymousComment(false);
                          setIsInputExpanded(false);
                        }}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm btn-post-comment"
                        onClick={handleAddComment}
                        disabled={!newCommentText.trim() || submittingComment}
                      >
                        {submittingComment ? 'Đang đăng...' : 'Đăng'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="composer-guest-box" onClick={() => navigate('/login')}>
                <span className="guest-placeholder-text">Đăng nhập để tham gia bình luận...</span>
                <button type="button" className="btn btn-primary btn-xs">
                  Đăng nhập
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comments Stream / List */}
        <div className="modern-comments-stream">
          {sortedRootComments.length === 0 ? (
            <div className="modern-no-comments-state fade-in">
              <div className="empty-chat-icon">💬</div>
              <h3 className="empty-title">Chưa có bình luận nào</h3>
              <p className="empty-desc">
                Hãy là người đầu tiên chia sẻ suy nghĩ và cảm nhận của bạn về bài viết này.
              </p>
            </div>
          ) : (
            sortedRootComments.map(cmt => (
              <CommentItem
                key={cmt.id}
                cmt={cmt}
                depth={0}
                user={user}
                allComments={comments}
                articleAuthorId={article?.authorId}
                canModerate={canModerate}
                editingCommentId={editingCommentId}
                editingCommentText={editingCommentText}
                setEditingCommentId={setEditingCommentId}
                setEditingCommentText={setEditingCommentText}
                handleSaveEditComment={handleSaveEditComment}
                handleDeleteComment={handleDeleteComment}
                handleUserClick={handleUserClick}
                formatDate={formatDate}
                onReplySubmit={handleReplySubmit}
                showToast={showToast}
              />
            ))
          )}
        </div>
      </section>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Xác Nhận Xóa Bài Viết</h3>
            <p>Bạn có chắc chắn muốn xóa bài viết <strong>"{article.title}"</strong> không?</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Hủy bỏ</button>
              <button className="btn btn-danger" onClick={handleSoftDelete}>Xác nhận xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
