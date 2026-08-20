import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const TOGGLEABLE_TYPES = ['article_comment', 'comment_reply', 'article_like', 'article_favorite'];

export const createNotification = async ({
    userId,
    title,
    message,
    type = 'system',
    relatedId = null,
    relatedType = null,
    extraData = {},
}) => {
    if (!userId || !title || !message) return null;

    try {
        // If type is one of the user-toggleable notification types,
        // check recipient's notificationSettings in Firestore
        if (TOGGLEABLE_TYPES.includes(type)) {
            const userDocSnap = await getDoc(doc(db, 'users', userId));
            if (userDocSnap.exists()) {
                const uData = userDocSnap.data();
                const settings = uData?.notificationSettings || uData?.notification_settings || {};
                if (settings[type] === false) {
                    // Recipient disabled this notification type -> do not create notification
                    return null;
                }
            }
        }
        const payload = {
            user_id: userId,
            title,
            message,
            type,
            read: false,
            createdAt: serverTimestamp(),
            ...extraData,
        };

        if (relatedId) payload.relatedId = relatedId;
        if (relatedType) payload.relatedType = relatedType;

        const ref = await addDoc(collection(db, 'notifications'), payload);
        return ref.id;
    } catch (error) {
        console.error('Lỗi tạo thông báo:', error);
        return null;
    }
};
