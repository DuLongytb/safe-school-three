// contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot = null;
        let currentFirebaseUser = null;
        let hiddenTimeout = null;
        const HIDDEN_TIMEOUT_MS = 3 * 60 * 1000;

        const updatePresence = async (firebaseUser, isOnline) => {
            if (!firebaseUser?.uid) return;
            try {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                await updateDoc(userDocRef, {
                    is_Online: isOnline,
                    lastSeenAt: serverTimestamp(),
                });
            } catch (error) {
                console.error('Lỗi cập nhật trạng thái online:', error);
            }
        };

        const handleVisibilityChange = () => {
            if (!currentFirebaseUser?.uid) return;

            if (hiddenTimeout) {
                clearTimeout(hiddenTimeout);
                hiddenTimeout = null;
            }

            if (document.hidden) {
                hiddenTimeout = setTimeout(() => {
                    updatePresence(currentFirebaseUser, false);
                }, HIDDEN_TIMEOUT_MS);
            } else {
                updatePresence(currentFirebaseUser, true);
            }
        };

        const handleBeforeUnload = () => {
            if (currentFirebaseUser?.uid) {
                updatePresence(currentFirebaseUser, false);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            currentFirebaseUser = firebaseUser;

            if (firebaseUser) {
                try {
                    const userDocRef = doc(db, 'users', firebaseUser.uid);

                    if (unsubscribeSnapshot) {
                        unsubscribeSnapshot();
                    }

                    unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
                        const defaultNotifSettings = {
                            article_comment: true,
                            comment_reply: true,
                            article_like: true,
                            article_favorite: true,
                        };

                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            setUser({
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                displayName: userData?.displayName || userData?.DisplayName || firebaseUser.displayName || 'User',
                                avatarUrl: userData?.avatarUrl || firebaseUser.photoURL || '',
                                role: userData?.role || 'student',
                                isOnline: userData?.is_Online || false,
                                isActive: userData?.is_active || true,
                                emailVerified: firebaseUser.emailVerified || false,
                                isAnonymous: userData?.is_anonymous || false,
                                lastLogin: userData?.lastLogin || null,
                                notificationSettings: {
                                    ...defaultNotifSettings,
                                    ...(userData?.notificationSettings || userData?.notification_settings || {}),
                                },
                            });
                        } else {
                            setUser({
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                displayName: firebaseUser.displayName || 'User',
                                avatarUrl: firebaseUser.photoURL || '',
                                role: 'student',
                                isAnonymous: false,
                                notificationSettings: defaultNotifSettings,
                            });
                        }
                        setLoading(false);
                    }, (error) => {
                        console.error('Lỗi lắng nghe user từ Firestore:', error);
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || 'User',
                            avatarUrl: firebaseUser.photoURL || '',
                            role: 'student',
                            isAnonymous: false,
                            notificationSettings: defaultNotifSettings,
                        });
                        setLoading(false);
                    });

                    await updatePresence(firebaseUser, true);
                } catch (error) {
                    console.error('Lỗi lấy user từ Firestore:', error);
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || 'User',
                        avatarUrl: firebaseUser.photoURL || '',
                        role: 'student',
                        isAnonymous: false,
                    });
                    setLoading(false);
                }
            } else {
                if (unsubscribeSnapshot) {
                    unsubscribeSnapshot();
                    unsubscribeSnapshot = null;
                }
                await updatePresence(currentFirebaseUser, false);
                currentFirebaseUser = null;
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            if (hiddenTimeout) {
                clearTimeout(hiddenTimeout);
                hiddenTimeout = null;
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
            unsubscribe();
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
            }
            if (currentFirebaseUser?.uid) {
                updatePresence(currentFirebaseUser, false);
            }
        };
    }, []);

    const value = { user, loading };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
