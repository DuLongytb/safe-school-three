import React, { useState, useEffect } from 'react';
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
  rejectArticleService
} from '../../services/articleService';
import { createNotification } from '../../services/notificationService';
import './ArticleDetail.css';

// ── CommentItem: real-time user sync + like + reply ──────────────────────────
function CommentItem({
  cmt, depth = 0,
  user, allComments,
  editingCommentId, editingCommentText,
  setEditingCommentId, setEditingCommentText,
  handleSaveEditComment, handleDeleteComment,
  handleUserClick, formatDate,
  onReplySubmit,
}) {
  const [cmtUserName, setCmtUserName] = useState(cmt.userName || 'Thành viên');
  const [cmtUserAvatar, setCmtUserAvatar] = useState(cmt.userAvatar || '');
  const [likeCount, setLikeCount] = useState(cmt.likes || 0);
  const [isLikedByMe, setIsLikedByMe] = useState(
    user && cmt.likedBy && Array.isArray(cmt.likedBy)
      ? cmt.likedBy.includes(user.uid)
      : false
  );
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Real-time author sync
  useEffect(() => {
    if (!cmt.userId) return;
    const unsub = onSnapshot(doc(db, 'users', cmt.userId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.is_anonymous) {
          setCmtUserName('Người dùng ẩn danh');
          setCmtUserAvatar('');
        } else {
          setCmtUserName(d.DisplayName || d.displayName || cmt.userName || 'Thành viên');
          setCmtUserAvatar(d.avatarUrl || '');
        }
      }
    }, err => console.error('CommentItem user snapshot error:', err));
    return () => unsub();
  }, [cmt.userId]);

  // Real-time comment like sync
  useEffect(() => {
    if (!cmt.id) return;
    const unsub = onSnapshot(doc(db, 'comments', cmt.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
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

  const handleLikeComment = async (e) => {
    e.stopPropagation();
    if (!user) { alert('Vui lòng đăng nhập để thích bình luận.'); return; }
    if (user.uid === cmt.userId) return; // can't like own comment
    const cmtRef = doc(db, 'comments', cmt.id);
    if (isLikedByMe) {
      await updateDoc(cmtRef, { likes: increment(-1), likedBy: arrayRemove(user.uid) });
    } else {
      await updateDoc(cmtRef, { likes: increment(1), likedBy: arrayUnion(user.uid) });
    }
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      await onReplySubmit(cmt.id, replyText, cmtUserName);
      setReplyText('');
      setShowReplyBox(false);
    } finally {
      setSubmittingReply(false);
    }
  };

  const replies = allComments.filter(c => c.parentId === cmt.id);

  return (
    <div className={`comment-item ${depth > 0 ? 'comment-reply' : ''}`} style={depth > 0 ? { marginLeft: `${Math.min(depth, 3) * 40}px` } : {}}>
      <Avatar
        src={cmtUserAvatar}
        alt={cmtUserName}
        className="comment-avatar"
        style={{ width: depth > 0 ? '36px' : '48px', height: depth > 0 ? '36px' : '48px' }}
        onClick={() => handleUserClick(cmt.userId)}
      />

      <div className="comment-content-wrapper">
        <div className="comment-header">
          <span className="comment-user-name" onClick={() => handleUserClick(cmt.userId)}>
            {cmtUserName}
          </span>
          {cmt.replyToName && (
            <span className="comment-reply-to">↩ {cmt.replyToName}</span>
          )}
        </div>
        <span className="comment-time">{formatDate(cmt.createdAt)}</span>

        {editingCommentId === cmt.id ? (
          <div className="edit-comment-box">
            <textarea
              className="comment-textarea edit-mode"
              rows="2"
              value={editingCommentText}
              onChange={(e) => setEditingCommentText(e.target.value)}
            />
            <div className="edit-comment-actions">
              <button className="btn btn-primary btn-xs" onClick={() => handleSaveEditComment(cmt.id)}>Lưu</button>
              <button className="btn btn-secondary btn-xs" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}>Hủy</button>
            </div>
          </div>
        ) : (
          <p className="comment-text">{cmt.content}</p>
        )}

        {/* Actions row */}
        <div className="comment-actions">
          {/* Like */}
          {user && user.uid !== cmt.userId && (
            <button
              className={`comment-action-link ${isLikedByMe ? 'liked' : ''}`}
              onClick={handleLikeComment}
            >
              {isLikedByMe ? '👍' : '👍🏻'} {likeCount > 0 ? likeCount : ''}
            </button>
          )}
          {(!user || user.uid === cmt.userId) && likeCount > 0 && (
            <span className="comment-like-count">👍 {likeCount}</span>
          )}

          {/* Reply */}
          {user && depth < 3 && (
            <button
              className="comment-action-link"
              onClick={() => setShowReplyBox(v => !v)}
            >
              Trả lời
            </button>
          )}

          {/* Owner actions */}
          {user && user.uid === cmt.userId && editingCommentId !== cmt.id && (
            <>
              <button className="comment-action-link" onClick={() => { setEditingCommentId(cmt.id); setEditingCommentText(cmt.content); }}>Sửa</button>
              <button className="comment-action-link text-danger" onClick={() => handleDeleteComment(cmt.id)}>Xóa</button>
            </>
          )}
        </div>

        {/* Reply input box */}
        {showReplyBox && (
          <form className="reply-form" onSubmit={handleSubmitReply}>
            <textarea
              className="comment-textarea"
              rows="2"
              placeholder={`Trả lời ${cmtUserName}...`}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
            />
            <div className="edit-comment-actions">
              <button type="submit" className="btn btn-primary btn-xs" disabled={submittingReply}>
                {submittingReply ? 'Đang gửi...' : 'Gửi'}
              </button>
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => setShowReplyBox(false)}>Hủy</button>
            </div>
          </form>
        )}
      </div>

      {/* Recursive replies */}
      {replies.map(reply => (
        <CommentItem
          key={reply.id}
          cmt={reply}
          depth={depth + 1}
          user={user}
          allComments={allComments}
          editingCommentId={editingCommentId}
          editingCommentText={editingCommentText}
          setEditingCommentId={setEditingCommentId}
          setEditingCommentText={setEditingCommentText}
          handleSaveEditComment={handleSaveEditComment}
          handleDeleteComment={handleDeleteComment}
          handleUserClick={handleUserClick}
          formatDate={formatDate}
          onReplySubmit={onReplySubmit}
        />
      ))}
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

  // Comments
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // UI
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // ── Fetch article + comments ──
  useEffect(() => {
    if (id) fetchArticleAndData();
  }, [id, user]);

  // ── Real-time author sync ──
  useEffect(() => {
    if (!article) return;
    setAuthorName(article.authorName || 'Safe School Author');
    setAuthorAvatar(article.authorAvatar || '');
    if (article.authorExists === false || !article.authorId || article.authorId === 'anonymous') return;

    const unsub = onSnapshot(doc(db, 'users', article.authorId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.is_anonymous) { setAuthorName('Người dùng ẩn danh'); setAuthorAvatar(''); }
        else {
          setAuthorName(d.DisplayName || d.displayName || article.authorName || 'Safe School Author');
          setAuthorAvatar(d.avatarUrl || '');
        }
      }
    }, err => console.error('ArticleDetail author snapshot error:', err));
    return () => unsub();
  }, [article?.authorId, article?.authorExists]);

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
      cmts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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

  // ── Add comment ──
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) { alert('Vui lòng đăng nhập để bình luận.'); navigate('/login'); return; }
    if (!newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addCommentService(id, user, newCommentText);
      if (article?.authorId && article.authorId !== user.uid) {
        await createNotification({
          userId: article.authorId,
          title: 'Có bình luận mới',
          message: `${user.displayName || 'Một người dùng'} vừa bình luận về bài viết "${article.title || 'của bạn'}".`,
          type: 'article_comment',
          relatedId: id,
          relatedType: 'article',
        });
      }
      setNewCommentText('');
      // onSnapshot will auto-update comments list
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Không thể gửi bình luận. Vui lòng thử lại.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Reply to comment ──
  const handleReplySubmit = async (parentId, replyContent, replyToName) => {
    if (!user) { alert('Vui lòng đăng nhập để trả lời.'); return; }
    if (!replyContent.trim()) return;
    try {
      const newReply = {
        articleId: id,
        userId: user.uid,
        userName: user.displayName || user.email || 'Người dùng Safe School',
        userAvatar: user.avatarUrl || '',
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
      if (parentCmt?.userId && parentCmt.userId !== user.uid) {
        await createNotification({
          userId: parentCmt.userId,
          title: 'Có phản hồi cho bình luận của bạn',
          message: `${user.displayName || 'Một người dùng'} vừa trả lời bình luận của bạn trong bài viết "${article?.title || 'bài viết'}".`,
          type: 'comment_reply',
          relatedId: id,
          relatedType: 'article',
        });
      }
    } catch (err) {
      console.error('Error adding reply:', err);
      alert('Không thể gửi trả lời. Vui lòng thử lại.');
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
    } catch (err) {
      console.error('Error updating comment:', err);
      alert('Không thể cập nhật bình luận.');
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
      // onSnapshot will auto-update
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Không thể xóa bình luận.');
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

  const rootComments = comments.filter(c => !c.parentId);

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

      {/* Comments Section */}
      <section className="comments-section" id="comments-section">
        <h2 className="comments-title">Bình Luận ({comments.length})</h2>

        <form onSubmit={handleAddComment} className="comment-form">
          <div className="comment-input-row">
            <Avatar src={user?.avatarUrl} alt="User Avatar" className="comment-user-avatar" style={{ width: '40px', height: '40px' }} />
            <div className="comment-input-box">
              <textarea
                className="comment-textarea"
                rows="3"
                placeholder={user ? 'Viết bình luận của bạn tại đây...' : 'Đăng nhập để tham gia bình luận...'}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                disabled={!user}
              />
              <div className="comment-form-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={!user || !newCommentText.trim() || submittingComment}>
                  {submittingComment ? 'Đang gửi...' : 'Gửi bình luận'}
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="comments-list">
          {rootComments.length === 0 ? (
            <div className="no-comments-box"><p>Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ ý kiến.</p></div>
          ) : (
            rootComments.map(cmt => (
              <CommentItem
                key={cmt.id}
                cmt={cmt}
                depth={0}
                user={user}
                allComments={comments}
                editingCommentId={editingCommentId}
                editingCommentText={editingCommentText}
                setEditingCommentId={setEditingCommentId}
                setEditingCommentText={setEditingCommentText}
                handleSaveEditComment={handleSaveEditComment}
                handleDeleteComment={handleDeleteComment}
                handleUserClick={handleUserClick}
                formatDate={formatDate}
                onReplySubmit={handleReplySubmit}
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
