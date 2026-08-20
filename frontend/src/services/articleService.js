import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  arrayUnion, 
  arrayRemove, 
  increment, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ARTICLES_COLLECTION = 'articles';
const COMMENTS_COLLECTION = 'comments';
const FAV_COLLECTION = 'fav';
const REPORTS_COLLECTION = 'reports';

/**
 * Fetch list of articles (excluding isDeleted === true)
 */
export const getArticlesService = async ({ search = '', category = '', sortBy = 'newest' }) => {
  try {
    const articlesRef = collection(db, ARTICLES_COLLECTION);
    
    // Base query: not deleted
    let q = query(articlesRef, where('isDeleted', '!=', true));
    
    const querySnapshot = await getDocs(q);
    let articles = querySnapshot.docs
      .map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
        };
      })
      // Only show approved & public articles in the public list
      .filter(a => a.status === 'approved' && (a.visibility === 'public' || !a.visibility));

    // Client-side filtering & sorting for flexible UI handling
    if (category && category !== 'Tất cả') {
      articles = articles.filter(a => a.category === category);
    }

    if (search && search.trim() !== '') {
      const term = search.toLowerCase().trim();
      articles = articles.filter(a => 
        (a.title && a.title.toLowerCase().includes(term)) ||
        (a.summary && a.summary.toLowerCase().includes(term)) ||
        (a.content && a.content.toLowerCase().includes(term))
      );
    }

    // Sort
    if (sortBy === 'newest') {
      articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      articles.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'views') {
      articles.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'likes') {
      articles.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }

    return articles;
  } catch (error) {
    console.error('Error in getArticlesService:', error);
    throw error;
  }
};

/**
 * Fetch single article by ID (Does NOT increment view count automatically)
 */
export const getArticleByIdService = async (id) => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    if (data.isDeleted) {
      return null;
    }

    return {
      id: docSnap.id,
      ...data,
      views: data.views || 0,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in getArticleByIdService:', error);
    throw error;
  }
};

/**
 * Increment view count for an article in Firestore
 */
export const incrementArticleViewService = async (id) => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    await updateDoc(docRef, {
      views: increment(1)
    });
  } catch (error) {
    console.error('Error incrementing article view in Firestore:', error);
  }
};

/**
 * Create a new article — always status: 'pending', awaiting moderation
 */
export const createArticleService = async (articleData, user) => {
  try {
    const newArticle = {
      title: articleData.title || '',
      summary: articleData.summary || '',
      content: articleData.content || '',
      category: articleData.category || 'Phòng chống bạo lực',
      coverImage: articleData.coverImage || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
      tags: articleData.tags || [],
      visibility: articleData.visibility || 'public',
      // All articles start as pending — moderation required regardless of role
      status: 'pending',
      authorId: user?.uid || 'anonymous',
      authorName: user?.displayName || user?.email || 'Tác giả Safe School',
      authorAvatar: user?.avatarUrl || '',
      views: 0,
      likes: 0,
      likedBy: [],
      favoritesCount: 0,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, ARTICLES_COLLECTION), newArticle);
    return docRef.id;
  } catch (error) {
    console.error('Error in createArticleService:', error);
    throw error;
  }
};


/**
 * Update an existing article
 */
export const updateArticleService = async (id, articleData) => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const updatePayload = {
      title: articleData.title,
      summary: articleData.summary,
      content: articleData.content,
      category: articleData.category,
      coverImage: articleData.coverImage,
      tags: articleData.tags || [],
      visibility: articleData.visibility || 'public',
      status: articleData.status || 'pending',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    console.error('Error in updateArticleService:', error);
    throw error;
  }
};

/**
 * Soft delete an article (isDeleted = true)
 */
export const softDeleteArticleService = async (id) => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    await updateDoc(docRef, {
      isDeleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error in softDeleteArticleService:', error);
    throw error;
  }
};

/**
 * Helper: commit a batch and flush ops array
 */
const _commitBatchOps = async (ops) => {
  if (ops.length === 0) return;
  const batch = writeBatch(db);
  ops.forEach(ref => batch.delete(ref));
  await batch.commit();
};

/**
 * Hard (cascade) delete an article and ALL related data:
 *  - articles/{id}
 *  - comments where articleId == id
 *  - fav where articleId == id
 *  - reports where articleId == id (if collection exists)
 */
export const deleteArticleCascadeService = async (articleId) => {
  if (!articleId) throw new Error('articleId is required');

  try {
    // Collect all doc refs to delete
    const toDelete = [];

    // 1. The article document itself
    toDelete.push(doc(db, ARTICLES_COLLECTION, articleId));

    // 2. Comments linked to this article
    const commentsSnap = await getDocs(
      query(collection(db, COMMENTS_COLLECTION), where('articleId', '==', articleId))
    );
    commentsSnap.forEach(d => toDelete.push(doc(db, COMMENTS_COLLECTION, d.id)));

    // 3. Fav (bookmarks) linked to this article
    const favSnap = await getDocs(
      query(collection(db, FAV_COLLECTION), where('articleId', '==', articleId))
    );
    favSnap.forEach(d => toDelete.push(doc(db, FAV_COLLECTION, d.id)));

    // 4. Reports linked to this article (collection may not exist — safe to query)
    try {
      const reportsSnap = await getDocs(
        query(collection(db, REPORTS_COLLECTION), where('articleId', '==', articleId))
      );
      reportsSnap.forEach(d => toDelete.push(doc(db, REPORTS_COLLECTION, d.id)));
    } catch (_) {
      // reports collection doesn't exist yet — ignore
    }

    // Firestore batch limit is 500 ops per commit — chunk if needed
    const BATCH_LIMIT = 500;
    for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
      const chunk = toDelete.slice(i, i + BATCH_LIMIT);
      await _commitBatchOps(chunk);
    }
  } catch (error) {
    console.error('Error in deleteArticleCascadeService:', error);
    throw error;
  }
};



/**
 * Toggle Like / Unlike for an article
 */
export const toggleLikeService = async (articleId, userId, isLiked) => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, articleId);
    if (isLiked) {
      await updateDoc(docRef, {
        likes: increment(-1),
        likedBy: arrayRemove(userId)
      });
    } else {
      await updateDoc(docRef, {
        likes: increment(1),
        likedBy: arrayUnion(userId)
      });
    }
  } catch (error) {
    console.error('Error in toggleLikeService:', error);
    throw error;
  }
};

/**
 * Toggle Favorite for an article in 'fav' collection
 */
export const toggleFavoriteService = async (articleId, userId, isFavorite) => {
  try {
    const favRef = collection(db, FAV_COLLECTION);
    const articleRef = doc(db, ARTICLES_COLLECTION, articleId);

    if (isFavorite) {
      // Find and delete from 'fav'
      const q = query(favRef, where('userId', '==', userId), where('articleId', '==', articleId));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        deleteDoc(doc(db, FAV_COLLECTION, docSnap.id));
      });
      await updateDoc(articleRef, {
        favoritesCount: increment(-1)
      }).catch(() => {});
    } else {
      // Add to 'fav'
      await addDoc(favRef, {
        userId,
        articleId,
        createdAt: serverTimestamp()
      });
      await updateDoc(articleRef, {
        favoritesCount: increment(1)
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error in toggleFavoriteService:', error);
    throw error;
  }
};

/**
 * Check if article is in user's 'fav' collection
 */
export const checkIsFavoriteService = async (articleId, userId) => {
  if (!userId) return false;
  try {
    const favRef = collection(db, FAV_COLLECTION);
    const q = query(favRef, where('userId', '==', userId), where('articleId', '==', articleId));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    console.error('Error in checkIsFavoriteService:', error);
    return false;
  }
};

/**
 * Fetch comments for an article
 */
export const getCommentsService = async (articleId) => {
  try {
    const commentsRef = collection(db, COMMENTS_COLLECTION);
    const q = query(commentsRef, where('articleId', '==', articleId));
    const snap = await getDocs(q);
    
    let comments = snap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
      };
    });

    comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return comments;
  } catch (error) {
    console.error('Error in getCommentsService:', error);
    return [];
  }
};

/**
 * Add a comment to an article
 */
export const addCommentService = async (articleId, user, content) => {
  try {
    const newComment = {
      articleId,
      userId: user.uid,
      userName: user.displayName || user.email || 'Người dùng Safe School',
      userAvatar: user.avatarUrl || '',
      content: content.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), newComment);
    return {
      id: docRef.id,
      ...newComment,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in addCommentService:', error);
    throw error;
  }
};

/**
 * Edit a comment
 */
export const updateCommentService = async (commentId, content) => {
  try {
    const docRef = doc(db, COMMENTS_COLLECTION, commentId);
    await updateDoc(docRef, {
      content: content.trim(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error in updateCommentService:', error);
    throw error;
  }
};

/**
 * Delete a comment
 */
export const deleteCommentService = async (commentId) => {
  try {
    const docRef = doc(db, COMMENTS_COLLECTION, commentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error in deleteCommentService:', error);
    throw error;
  }
};

/**
 * Fetch favorite articles for a user
 */
export const getFavoriteArticlesService = async (userId) => {
  if (!userId) return [];
  try {
    const favRef = collection(db, FAV_COLLECTION);
    const q = query(favRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    const articleIds = snap.docs.map(docSnap => docSnap.data().articleId);
    
    if (articleIds.length === 0) return [];
    
    const articles = await Promise.all(
      articleIds.map(async (id) => {
        try {
          const art = await getArticleByIdService(id);
          return art;
        } catch (err) {
          console.error(`Error fetching article ${id} in favorites:`, err);
          return null;
        }
      })
    );
    
    return articles.filter(Boolean);
  } catch (error) {
    console.error('Error in getFavoriteArticlesService:', error);
    return [];
  }
};

/**
 * Approve a pending article (moderator action)
 * Sets status='approved' and visibility='public' so the article appears in the public list.
 */
export const approveArticleService = async (id, reviewerId = 'admin') => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const nowIso = new Date().toISOString();
    await updateDoc(docRef, {
      status: 'approved',
      visibility: 'public',   // Make article publicly visible after approval
      reviewedBy: reviewerId,
      reviewedAt: nowIso,
      moderatedBy: reviewerId,
      moderatedAt: nowIso,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error in approveArticleService:', error);
    throw error;
  }
};

/**
 * Reject a pending article (moderator action)
 * Sets status='rejected' and visibility='private' so the article is hidden from public.
 */
export const rejectArticleService = async (id, reason = '', reviewerId = 'admin') => {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const nowIso = new Date().toISOString();
    await updateDoc(docRef, {
      status: 'rejected',
      visibility: 'private',  // Hide from public view
      rejectionReason: reason,
      reason: reason,
      reviewedBy: reviewerId,
      reviewedAt: nowIso,
      moderatedBy: reviewerId,
      moderatedAt: nowIso,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error in rejectArticleService:', error);
    throw error;
  }
};

/**
 * Fetch articles by authorId (including pending/rejected, for profile view)
 */
export const getArticlesByAuthorService = async (authorId) => {
  if (!authorId) return [];
  try {
    const articlesRef = collection(db, ARTICLES_COLLECTION);
    const q = query(articlesRef, where('authorId', '==', authorId), where('isDeleted', '!=', true));
    const snap = await getDocs(q);
    const articles = snap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
      };
    });
    articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return articles;
  } catch (error) {
    console.error('Error in getArticlesByAuthorService:', error);
    return [];
  }
};
