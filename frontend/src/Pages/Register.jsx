import { useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';

const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: 'Chưa nhập mật khẩu', className: 'empty' };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'Yếu', className: 'weak' };
    if (score <= 3) return { score: 2, label: 'Trung bình', className: 'medium' };
    return { score: 3, label: 'Mạnh', className: 'strong' };
};

const getRegisterErrorMessage = (code) => {
    const messages = {
        'auth/email-already-in-use': 'Email này đã được sử dụng.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/weak-password': 'Mật khẩu chưa đáp ứng yêu cầu bảo mật.',
        'auth/network-request-failed': 'Kết nối mạng không ổn định. Vui lòng thử lại.',
    };

    return messages[code] || 'Đăng ký thất bại. Vui lòng thử lại.';
};

const Register = () => {
    const [form, setForm] = useState({
        fullname: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const passwordStrength = useMemo(
        () => getPasswordStrength(form.password),
        [form.password]
    );

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const validateForm = () => {
        if (form.fullname.trim().length < 2) return 'Họ tên phải có ít nhất 2 ký tự.';
        if (form.password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
        if (passwordStrength.score < 2) return 'Mật khẩu cần có chữ hoa, chữ thường, số hoặc ký tự đặc biệt.';
        if (form.password !== form.confirmPassword) return 'Mật khẩu xác nhận không khớp.';
        return '';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                form.email.trim(),
                form.password
            );
            const user = userCredential.user;
            
            // Gửi email xác thực
            await sendEmailVerification(user);

            // Cập nhật tên hiển thị trong Firebase Auth để Home có thể dùng ngay.
            await updateProfile(user, { displayName: form.fullname.trim() });

            // Lưu hồ sơ mở rộng trong Firestore.
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                displayName: form.fullname.trim(),
                email: form.email.trim(),
                role: form.role,
                avatarUrl: '',
                gender: '',
                dob: '',
                is_Online: true,
                is_active: true,
                emailVerified: false,
                is_anonymous: false,
                createdAt: serverTimestamp(),
                lastLogin: null
            });

            setSuccess('Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.');
            window.setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(getRegisterErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={`${styles.authPage} ${styles.registerPage}`}>
            <div className={styles.backgroundShapeOne} />
            <div className={styles.backgroundShapeTwo} />

            <section className={`${styles.authCard} ${styles.registerCard}`} aria-labelledby="register-title">
                <div className={styles.brand}>🛡️ <span>SafeSchool</span></div>
                <div className={styles.authHeader}>
                    <h1 id="register-title">Đăng ký tài khoản</h1>
                    <p>Tạo tài khoản để cùng xây dựng môi trường học đường an toàn.</p>
                </div>

                {error && (
                    <div className={styles.errorMessage} role="alert">
                        <strong>Chưa thể đăng ký</strong>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className={styles.successMessage} role="status">
                        <strong>Đăng ký thành công</strong>
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.fieldGroup}>
                        <label htmlFor="fullname">Họ tên</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>👤</span>
                            <input
                                id="fullname"
                                type="text"
                                name="fullname"
                                placeholder="Nguyễn Văn A"
                                value={form.fullname}
                                onChange={handleChange}
                                autoComplete="name"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label htmlFor="register-email">Email</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>✉️</span>
                            <input
                                id="register-email"
                                type="email"
                                name="email"
                                placeholder="your@email.com"
                                value={form.email}
                                onChange={handleChange}
                                autoComplete="email"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.twoColumns}>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="register-password">Mật khẩu</label>
                            <div className={styles.inputWrap}>
                                <span className={styles.inputIcon}>🔒</span>
                                <input
                                    id="register-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    placeholder="Ít nhất 8 ký tự"
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
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

                        <div className={styles.fieldGroup}>
                            <label htmlFor="confirm-password">Xác nhận mật khẩu</label>
                            <div className={styles.inputWrap}>
                                <span className={styles.inputIcon}>✅</span>
                                <input
                                    id="confirm-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    placeholder="Nhập lại mật khẩu"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowConfirmPassword((value) => !value)}
                                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showConfirmPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.strengthBlock}>
                        <div className={styles.strengthHeader}>
                            <span>Độ mạnh mật khẩu</span>
                            <strong className={styles[passwordStrength.className]}>{passwordStrength.label}</strong>
                        </div>
                        <div className={styles.strengthBars} aria-hidden="true">
                            {[1, 2, 3].map((level) => (
                                <span
                                    key={level}
                                    className={level <= passwordStrength.score ? styles[passwordStrength.className] : ''}
                                />
                            ))}
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label htmlFor="role">Vai trò</label>
                        <div className={styles.inputWrap}>
                            <span className={styles.inputIcon}>🎓</span>
                            <select id="role" name="role" value={form.role} onChange={handleChange}>
                                <option value="student">Học sinh</option>
                                <option value="teacher">Giáo viên</option>
                                <option value="parent">Phụ huynh</option>
                                <option value="psychologist">Chuyên gia</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" className={styles.primaryButton} disabled={loading}>
                        {loading ? <span className={styles.spinner} /> : null}
                        {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                    </button>
                </form>

                <p className={styles.authFooter}>
                    Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </p>
            </section>
        </main>
    );
};

export default Register;