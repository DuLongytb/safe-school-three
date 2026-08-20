import { useState } from 'react';
import {
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInAnonymously,
} from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';

const getFirebaseErrorMessage = (code) => {
    const messages = {
        'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
        'auth/user-not-found': 'Email chưa được đăng ký.',
        'auth/wrong-password': 'Mật khẩu không chính xác.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/too-many-requests': 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.',
        'auth/popup-closed-by-user': 'Cửa sổ đăng nhập Google đã được đóng.',
        'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập Google.',
        'auth/network-request-failed': 'Kết nối mạng không ổn định. Vui lòng thử lại.',
    };

    return messages[code] || 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.';
};

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [anonymousLoading, setAnonymousLoading] = useState(false);
    const navigate = useNavigate();

    const applyPersistence = () => setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
    );

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;

            // Kiểm tra email đã xác thực chưa
            if (!user.emailVerified) {
                await auth.signOut();
                setError('Tài khoản chưa được xác thực. Vui lòng kiểm tra email để kích hoạt!');
                setLoading(false);
                return;
            }

            // Kiểm tra is_active (có bị admin khóa?)
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            if (!userData?.is_active) {
                await auth.signOut();
                setError('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên');
                setLoading(false);
                return;
            }

            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: new Date().toISOString(),
                is_Online: true,
            });

            await applyPersistence();
            await signInWithEmailAndPassword(auth, email.trim(), password);
            navigate('/');
        } catch (err) {
            setError(getFirebaseErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setError('');

        try {
            await applyPersistence();
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Lưu vào firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    displayName: user.displayName || 'User',
                    email: user.email,
                    role: 'student',
                    avatarUrl: user.photoURL || '',
                    gender: '',
                    dob: '',
                    is_Online: true,
                    is_active: true,
                    emailVerified: true,
                    is_anonymous: false,
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                });
            } else {
                await updateDoc(userDocRef, {
                    is_Online: true,
                    lastLogin: new Date().toISOString(),
                });
            }
            
            navigate('/');
        } catch (err) {
            setError(getFirebaseErrorMessage(err.code));
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleAnonymousLogin = async () => {
        setAnonymousLoading(true);
        setError('');

        try {
            // Tài khoản khách chỉ tồn tại trong phiên trình duyệt hiện tại.
            await setPersistence(auth, browserSessionPersistence);
            const result = await signInAnonymously(auth);
            const user = result.user;
            const now = new Date().toISOString();
            const userDocRef = doc(db, 'users', user.uid);

            await setDoc(userDocRef, {
                uid: user.uid,
                displayName: 'Khách ẩn danh',
                email: null,
                role: 'anonymous',
                avatarUrl: '',
                is_Online: true,
                is_active: true,
                emailVerified: false,
                is_anonymous: true,
                createdAt: now,
                lastLogin: now,
            }, { merge: true });

            navigate('/');
        } catch (err) {
            setError(getFirebaseErrorMessage(err.code));
        } finally {
            setAnonymousLoading(false);
        }
    };

    return (
        <main className={styles.authPage}>
            <div className={styles.backgroundShapeOne} />
            <div className={styles.backgroundShapeTwo} />

            <section className={styles.authCard} aria-labelledby="login-title">
                <div className={styles.brand}>🛡️ <span>SafeSchool</span></div>
                <div className={styles.authHeader}>
                    <h1 id="login-title">Đăng nhập</h1>
                    <p>Chào mừng bạn quay trở lại với SafeSchool.</p>
                </div>

                {error && (
                    <div className={styles.errorMessage} role="alert">
                        <strong>Không thể đăng nhập</strong>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.fieldGroup}>
                        <label htmlFor="login-email">Email</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>✉️</span>
                            <input
                                id="login-email"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label htmlFor="login-password">Mật khẩu</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>🔒</span>
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Nhập mật khẩu"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className={styles.passwordToggle}
                                onClick={() => setShowPassword((value) => !value)}
                                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <div className={styles.formOptions}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(event) => setRememberMe(event.target.checked)}
                            />
                            <span>Ghi nhớ đăng nhập</span>
                        </label>
                        <Link to="/forgot-password" className={styles.textLink}>Quên mật khẩu?</Link>
                    </div>

                    <button type="submit" className={styles.primaryButton} disabled={loading || googleLoading}>
                        {loading ? <span className={styles.spinner} /> : null}
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>

                <div className={styles.divider}><span>hoặc</span></div>

                <button
                    type="button"
                    className={styles.googleButton}
                    onClick={handleGoogleLogin}
                    disabled={loading || googleLoading}
                >
                    <span className={styles.googleIcon}>G</span>
                    {googleLoading ? 'Đang kết nối...' : 'Đăng nhập với Google'}
                </button>
                <button
                    type="button"
                    className={styles.anonymousButton}
                    onClick={handleAnonymousLogin}
                    disabled={loading || googleLoading || anonymousLoading}
                >
                    <span aria-hidden="true">👤</span>
                    {anonymousLoading ? 'Đang tạo phiên khách...' : 'Tiếp tục với tư cách khách'}
                </button>


                <p className={styles.authFooter}>
                    Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
                </p>
            </section>
        </main>
    );
};

export default Login;