import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, updateProfile, deleteUser } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/User/Avatar';
import './Profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, loading: authLoading } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const targetUid = queryParams.get('uid') || currentUser?.uid;
  const isOwner = !queryParams.get('uid') || queryParams.get('uid') === currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // User data initial state
  const [userData, setUserData] = useState({
    avatar: '',
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    address: '',
    role: 'Học sinh',
    createdAt: '',
    hidePhone: false,
    hideAddress: false
  });


  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...userData });
  const [errors, setErrors] = useState({});

  // Password change states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});

  // Activity stats — interactions the user has PERFORMED
  const [totalLikesGiven, setTotalLikesGiven] = useState(0);
  const [totalFavGiven, setTotalFavGiven] = useState(0);
  const [myArticles, setMyArticles] = useState([]);

  // Delete account states & refs
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const cancelBtnRef = useRef(null);

  // Auto focus Cancel button when modal opens
  useEffect(() => {
    if (showDeleteModal && cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }
  }, [showDeleteModal]);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showDeleteModal) {
        setShowDeleteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteModal]);

  // Fetch user data from Firestore
  useEffect(() => {
    if (authLoading) return;
    if (!targetUid) {
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', targetUid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const isUserAnonymous = data.is_anonymous || false;
          const showAsAnonymous = isUserAnonymous && !isOwner;

          const loadedData = {
            avatar: showAsAnonymous ? '' : (data.avatarUrl || ''),
            fullName: showAsAnonymous ? 'Người dùng ẩn danh' : (data.DisplayName || data.displayName || 'Chưa đặt tên'),
            email: showAsAnonymous ? '******' : (data.email || ''),
            phone: showAsAnonymous ? '******' : (data.phone || ''),
            dob: showAsAnonymous ? '******' : (data.dob || ''),
            gender: showAsAnonymous ? 'Ẩn' : (data.gender || 'Nam'),
            address: showAsAnonymous ? '******' : (data.address || ''),
            role: showAsAnonymous ? 'Học sinh ẩn danh' : (data.role === 'teacher' ? 'Giáo viên' : data.role === 'parent' ? 'Phụ huynh' : data.role === 'psychologist' ? 'Chuyên gia' : 'Học sinh'),
            createdAt: showAsAnonymous ? '******' : (data.createdAt
              ? (data.createdAt.seconds
                ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('vi-VN')
                : new Date().toLocaleDateString('vi-VN'))
              : new Date().toLocaleDateString('vi-VN')),
            hidePhone: data.hidePhone || false,
            hideAddress: data.hideAddress || false,
            isAnonymous: isUserAnonymous
          };
          setUserData(loadedData);
          setFormData(loadedData);
        } else {
          // Fallback if target user is current user
          if (targetUid === currentUser?.uid) {
            const loadedData = {
              avatar: currentUser.avatarUrl || '',
              fullName: currentUser.displayName || 'Chưa đặt tên',
              email: currentUser.email || '',
              phone: '',
              dob: '',
              gender: 'Nam',
              address: '',
              role: currentUser.role === 'teacher' ? 'Giáo viên' : currentUser.role === 'parent' ? 'Phụ huynh' : currentUser.role === 'psychologist' ? 'Chuyên gia' : 'Học sinh',
              createdAt: new Date().toLocaleDateString('vi-VN'),
              hidePhone: false,
              hideAddress: false,
              isAnonymous: currentUser.isAnonymous || false
            };
            setUserData(loadedData);
            setFormData(loadedData);
          } else {
            alert('Không tìm thấy thông tin người dùng này trong hệ thống.');
          }
        }
      } catch (error) {
        console.error('Lỗi khi tải thông tin người dùng:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [targetUid, currentUser, authLoading]);

  // Real-time activity stats — count interactions the user has PERFORMED
  useEffect(() => {
    if (!targetUid) return;

    // 1. Fetch articles by this user (Filter isDeleted in JS to avoid composite index error on cold F5 load)
    const articlesQuery = query(
      collection(db, 'articles'),
      where('authorId', '==', targetUid)
    );
    const unsubArticles = onSnapshot(articlesQuery, (snap) => {
      const userArts = snap.docs
        .map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt || new Date().toISOString()
        }))
        .filter(art => art.isDeleted !== true);

      userArts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMyArticles(userArts);
    }, err => console.error('Stats articles snapshot error:', err));

    // 2. Count articles the user has liked (array-contains query on all articles)
    const likedQuery = query(
      collection(db, 'articles'),
      where('likedBy', 'array-contains', targetUid)
    );
    const unsubLikes = onSnapshot(likedQuery, (snap) => {
      const activeLiked = snap.docs.filter(d => d.data().isDeleted !== true);
      setTotalLikesGiven(activeLiked.length);
    }, err => console.error('Stats likes given snapshot error:', err));

    // 3. Count fav docs where userId == targetUid
    const favQuery = query(
      collection(db, 'fav'),
      where('userId', '==', targetUid)
    );
    const unsubFav = onSnapshot(favQuery, (snap) => {
      setTotalFavGiven(snap.size);
    }, err => console.error('Stats fav given snapshot error:', err));

    return () => {
      unsubArticles();
      unsubLikes();
      unsubFav();
    };
  }, [targetUid]);


  // Input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear validation error on change
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value
    });
    if (passwordErrors[name]) {
      setPasswordErrors({
        ...passwordErrors,
        [name]: ''
      });
    }
  };

  const handlePrivacyToggle = (name) => {
    setFormData(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check valid format (mime type and extension)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const validExtensions = ['jpeg', 'jpg', 'png', 'webp'];

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      alert('Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG, hoặc WEBP.');
      return;
    }

    // Limit to 2MB to fit comfortably in Firestore
    if (file.size > 2 * 1024 * 1024) {
      alert('Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result); // Base64 data URL
    };
    reader.readAsDataURL(file);
  };

  // Validation
  const validateForm = () => {
    const tempErrors = {};
    if (!formData.fullName.trim()) {
      tempErrors.fullName = 'Họ và tên không được để trống.';
    }

    // Email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      tempErrors.email = 'Email không được để trống.';
    } else if (!emailRegex.test(formData.email)) {
      tempErrors.email = 'Email không hợp lệ (Ví dụ: abc@safeschool.edu.vn).';
    }

    // Phone regex (e.g. 10 digits starting with 0)
    const phoneRegex = /^(0[3|5|7|8|9])([0-9]{8})$/;
    if (!formData.phone.trim()) {
      tempErrors.phone = 'Số điện thoại không được để trống.';
    } else if (!phoneRegex.test(formData.phone)) {
      tempErrors.phone = 'Số điện thoại phải gồm 10 chữ số (Ví dụ: 0987654321).';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const validatePassword = () => {
    const tempErrors = {};
    if (!passwordForm.currentPassword) {
      tempErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }
    if (!passwordForm.newPassword) {
      tempErrors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (passwordForm.newPassword.length < 6) {
      tempErrors.newPassword = 'Mật khẩu mới phải dài ít nhất 6 ký tự.';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      tempErrors.confirmPassword = 'Mật khẩu xác nhận không trùng khớp.';
    }

    setPasswordErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Save changes
  const handleSave = async (e) => {
    e.preventDefault();
    if (!isOwner) return;

    if (validateForm()) {
      try {
        setLoading(true);

        // Build the payload with only modified fields
        const updatePayload = {};

        if (formData.fullName !== userData.fullName) {
          updatePayload.displayName = formData.fullName;
          updatePayload.DisplayName = formData.fullName;
        }
        if (formData.email !== userData.email) {
          updatePayload.email = formData.email;
        }
        if (formData.phone !== userData.phone) {
          updatePayload.phone = formData.phone;
        }
        if (formData.dob !== userData.dob) {
          updatePayload.dob = formData.dob;
        }
        if (formData.gender !== userData.gender) {
          updatePayload.gender = formData.gender;
        }
        if (formData.address !== userData.address) {
          updatePayload.address = formData.address;
        }
        if (formData.hidePhone !== userData.hidePhone) {
          updatePayload.hidePhone = formData.hidePhone;
        }
        if (formData.hideAddress !== userData.hideAddress) {
          updatePayload.hideAddress = formData.hideAddress;
        }

        const newAvatar = avatarPreview || formData.avatar;
        if (avatarPreview && avatarPreview !== userData.avatar) {
          updatePayload.avatarUrl = avatarPreview;
        }

        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          // Document exists: update only changed fields
          if (Object.keys(updatePayload).length > 0) {
            await updateDoc(userRef, updatePayload);

            // Sync with firebase auth profile if display name or avatar changed
            const authUpdate = {};
            if (updatePayload.DisplayName) {
              authUpdate.displayName = updatePayload.DisplayName;
            }
            if (updatePayload.avatarUrl) {
              authUpdate.photoURL = updatePayload.avatarUrl;
            }
            if (Object.keys(authUpdate).length > 0) {
              await updateProfile(auth.currentUser, authUpdate);
            }
          }
        } else {
          // Document does not exist: create it with setDoc using all profile data
          const technicalRole =
            userData.role === 'Giáo viên' ? 'teacher' :
              userData.role === 'Phụ huynh' ? 'parent' :
                userData.role === 'Chuyên gia' ? 'psychologist' :
                  'student';

          const initialData = {
            uid: currentUser.uid,
            email: formData.email || currentUser.email || '',
            displayName: formData.fullName || currentUser.displayName || 'Chưa đặt tên',
            DisplayName: formData.fullName || currentUser.displayName || 'Chưa đặt tên',
            role: technicalRole,
            avatarUrl: newAvatar || '',
            phone: formData.phone || '',
            dob: formData.dob || '',
            gender: formData.gender || 'Nam',
            address: formData.address || '',
            is_Online: true,
            is_active: true,
            is_anonymous: false,
            createdAt: serverTimestamp(),
            hidePhone: formData.hidePhone || false,
            hideAddress: formData.hideAddress || false
          };

          await setDoc(userRef, initialData);

          // Also sync with firebase auth profile
          await updateProfile(auth.currentUser, {
            displayName: initialData.displayName,
            photoURL: initialData.avatarUrl
          });
        }

        const newUserData = {
          ...userData,
          ...formData,
          avatar: newAvatar
        };
        setUserData(newUserData);
        setFormData(newUserData);
        setAvatarPreview(null);
        setIsEditing(false);
        alert('Cập nhật thông tin tài khoản thành công!');
      } catch (error) {
        console.error('Lỗi khi lưu thay đổi:', error);
        alert(`Lỗi cập nhật: ${error.message || 'Vui lòng thử lại.'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Cancel edit
  const handleCancel = () => {
    setFormData({ ...userData });
    setAvatarPreview(null);
    setErrors({});
    setIsEditing(false);
  };

  // Save password
  const handleSavePassword = (e) => {
    e.preventDefault();
    if (validatePassword()) {
      alert('Đổi mật khẩu thành công! (Mock action - logic tích hợp sau)');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordSection(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
      alert('Đăng xuất thất bại. Vui lòng thử lại.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!isOwner) return;

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        // Delete from Firestore
        await deleteDoc(doc(db, 'users', user.uid));
        // Delete from Auth
        await deleteUser(user);

        alert('Xóa tài khoản thành công!');
        setShowDeleteModal(false);
        navigate('/login');
      }
    } catch (error) {
      console.error('Lỗi khi xóa tài khoản:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Để bảo mật thông tin, bạn cần đăng nhập lại trước khi thực hiện hành động xóa tài khoản này.');
      } else {
        alert(`Lỗi xóa tài khoản: ${error.message || 'Vui lòng thử lại sau.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading spinner
  if (authLoading || (loading && !userData.fullName)) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner"></div>
        <p>Đang tải dữ liệu hồ sơ...</p>
      </div>
    );
  }

  // Value masking for private info when viewed by others
  const displayPhone = isOwner
    ? (isEditing ? formData.phone : userData.phone)
    : (userData.hidePhone ? '****** (Đã ẩn)' : userData.phone);

  const displayAddress = isOwner
    ? (isEditing ? formData.address : userData.address)
    : (userData.hideAddress ? '****** (Đã ẩn)' : userData.address);

  return (
    <div className="profile-page fade-in">
      <div className="container profile-container">

        {/* Hidden File Input for Avatar Picker */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleFileChange}
        />

        {/* Profile Card Header */}
        <div className="profile-header-card">
          <div className="profile-header-visual">
            <div
              className={`profile-avatar-wrapper ${isEditing ? 'editable' : ''}`}
              onClick={() => isEditing && fileInputRef.current.click()}
              title={isEditing ? 'Nhấn để chọn ảnh mới' : ''}
            >
              <Avatar
                src={avatarPreview || (isEditing ? formData.avatar : userData.avatar)}
                alt="User Avatar"
                className="profile-avatar-img"
                style={{ width: '100%', height: '100%' }}
              />
              {isEditing && (
                <div className="avatar-edit-overlay">
                  <span>Thay đổi ảnh</span>
                </div>
              )}
            </div>

            <div className="profile-header-info">
              <h2 className="profile-name">
                {userData.fullName || 'Chưa đặt tên'}
                {userData.isAnonymous && (
                  <span className="anon-badge" style={{ marginLeft: '12px', fontSize: '0.8rem', backgroundColor: '#e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '12px', fontWeight: '500' }}>
                    🕵️ Ẩn danh
                  </span>
                )}
              </h2>
              <span className="profile-role-badge">🏷️ {userData.role}</span>
              <p className="profile-meta-text">Tài khoản được tạo ngày: {userData.createdAt}</p>



            </div>
          </div>

          <div className="profile-header-actions">
            {isOwner && (
              !isEditing ? (
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  ✍️ Chỉnh sửa thông tin
                </button>
              ) : (
                <div className="edit-actions-group">
                  <button className="btn btn-success" onClick={handleSave}>
                    💾 Lưu thay đổi
                  </button>
                  <button className="btn btn-secondary" onClick={handleCancel}>
                    Hủy
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Activity Statistics */}
        <div className="profile-stats-section">
          <h3 className="profile-stats-title">Thống kê hoạt động</h3>
          <div className="profile-stats-grid">
            <div className="profile-stat-card">
              <span className="profile-stat-icon">📝</span>
              <span className="profile-stat-value">{myArticles.length.toLocaleString('vi-VN')}</span>
              <span className="profile-stat-label">Bài viết đã tạo</span>
            </div>
            <div className="profile-stat-card">
              <span className="profile-stat-icon">👍</span>
              <span className="profile-stat-value">{totalLikesGiven.toLocaleString('vi-VN')}</span>
              <span className="profile-stat-label">Bài viết đã thích</span>
            </div>
            <div className="profile-stat-card">
              <span className="profile-stat-icon">❤️</span>
              <span className="profile-stat-value">{totalFavGiven.toLocaleString('vi-VN')}</span>
              <span className="profile-stat-label">Bài viết đã lưu</span>
            </div>
          </div>
        </div>

        {/* User's Created Articles Section — always visible to owner */}
        {isOwner && (
          <div className="profile-details-card" style={{ marginBottom: '0px' }}>
            <h3 className="card-title">📝 Bài viết của tôi ({myArticles.length})</h3>
            {myArticles.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '12px', fontStyle: 'italic' }}>
                Bạn chưa có bài viết nào. Hãy <span
                  onClick={() => navigate('/articles/create')}
                  style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                >viết bài mới</span> để chia sẻ kiến thức của bạn!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                {myArticles.map((art) => {
                  const isPending = art.status === 'pending' || !art.status;
                  const isRejected = art.status === 'rejected';
                  const isApproved = art.status === 'approved';
                  return (
                    <div
                      key={art.id}
                      onClick={() => navigate(`/articles/${art.id}`)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '12px 16px',
                        backgroundColor: isRejected ? '#fff5f5' : '#f8fafc',
                        borderRadius: '8px',
                        border: `1px solid ${isRejected ? '#fca5a5' : isPending ? '#fcd34d' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isRejected ? '#fee2e2' : '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isRejected ? '#fff5f5' : '#f8fafc'}
                    >
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', color: '#0f172a', fontWeight: '600' }}>{art.title}</h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                          🏷️ {art.category || 'Khác'} • {new Date(art.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                        {/* Show rejection reason inline */}
                        {isRejected && art.rejectionReason && (
                          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#dc2626', fontStyle: 'italic' }}>
                            💬 Lý do: {art.rejectionReason}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isPending && (
                          <span style={{
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                            border: '1px solid #fcd34d',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ⏳ Chờ kiểm duyệt
                          </span>
                        )}
                        {isRejected && (
                          <span style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ❌ Bị từ chối
                          </span>
                        )}
                        {isApproved && (
                          <span style={{
                            backgroundColor: '#dcfce7',
                            color: '#16a34a',
                            border: '1px solid #86efac',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✅ Đã duyệt
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Profile Main Content Grid */}
        <div className={`profile-grid ${!isOwner ? 'single-column' : ''}`}>
          {/* Details Section */}
          <div className="profile-details-card">
            <h3 className="card-title">Thông Tin Cá Nhân</h3>
            <form onSubmit={handleSave} className="profile-form">
              <div className="form-grid">

                {/* Fullname */}
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">Họ và tên</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    className={`form-input ${errors.fullName ? 'input-error' : ''}`}
                    value={isEditing ? formData.fullName : userData.fullName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Nhập họ và tên"
                  />
                  {errors.fullName && <span className="error-message">{errors.fullName}</span>}
                </div>

                {/* Email */}
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email liên hệ</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={`form-input ${errors.email ? 'input-error' : ''}`}
                    value={isEditing ? formData.email : userData.email}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="yourname@safeschool.edu.vn"
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                </div>

                {/* Phone */}
                <div className="form-group">
                  <div className="form-label-row">
                    <label className="form-label" htmlFor="phone">Số điện thoại</label>
                    {isOwner && (
                      <div className="privacy-toggle-container">
                        <label className="switch-wrapper">
                          <input
                            type="checkbox"
                            name="hidePhone"
                            checked={isEditing ? formData.hidePhone : userData.hidePhone}
                            onChange={() => isEditing && handlePrivacyToggle('hidePhone')}
                            disabled={!isEditing}
                          />
                          <span className="switch-slider"></span>
                        </label>
                        <span className="switch-text">
                          {isEditing
                            ? (formData.hidePhone ? '🔒 Ẩn' : '🔓 Hiện')
                            : (userData.hidePhone ? '🔒 Đang ẩn' : '🔓 Đang công khai')
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    className={`form-input ${errors.phone ? 'input-error' : ''}`}
                    value={displayPhone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Nhập số điện thoại (10 chữ số)"
                  />
                  {errors.phone && <span className="error-message">{errors.phone}</span>}
                </div>

                {/* Date of Birth */}
                <div className="form-group">
                  <label className="form-label" htmlFor="dob">Ngày sinh</label>
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    className="form-input"
                    value={isEditing ? formData.dob : userData.dob}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </div>

                {/* Gender */}
                <div className="form-group">
                  <label className="form-label" htmlFor="gender">Giới tính</label>
                  <select
                    id="gender"
                    name="gender"
                    className="form-input select-input"
                    value={isEditing ? formData.gender : userData.gender}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                {/* Role (Read Only) */}
                <div className="form-group">
                  <label className="form-label" htmlFor="role">Vai trò</label>
                  <input
                    type="text"
                    id="role"
                    name="role"
                    className="form-input disabled"
                    value={userData.role}
                    disabled
                  />
                </div>

                {/* Address */}
                <div className="form-group span-full">
                  <div className="form-label-row">
                    <label className="form-label" htmlFor="address">Địa chỉ thường trú</label>
                    {isOwner && (
                      <div className="privacy-toggle-container">
                        <label className="switch-wrapper">
                          <input
                            type="checkbox"
                            name="hideAddress"
                            checked={isEditing ? formData.hideAddress : userData.hideAddress}
                            onChange={() => isEditing && handlePrivacyToggle('hideAddress')}
                            disabled={!isEditing}
                          />
                          <span className="switch-slider"></span>
                        </label>
                        <span className="switch-text">
                          {isEditing
                            ? (formData.hideAddress ? '🔒 Ẩn' : '🔓 Hiện')
                            : (userData.hideAddress ? '🔒 Đang ẩn' : '🔓 Đang công khai')
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    className="form-input"
                    value={displayAddress}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Nhập địa chỉ thường trú"
                  />
                </div>

                {/* Account Created Date (Read Only) */}
                <div className="form-group span-full">
                  <label className="form-label" htmlFor="createdAt">Ngày tham gia</label>
                  <input
                    type="text"
                    id="createdAt"
                    name="createdAt"
                    className="form-input disabled"
                    value={userData.createdAt}
                    disabled
                  />
                </div>

              </div>
            </form>
          </div>

          {/* Account Settings / Actions Section */}
          {isOwner && (
            <div className="profile-settings-card">
              <h3 className="card-title">Cài Đặt Tài Khoản</h3>
              <div className="settings-buttons">

                {/* Toggle Change Password Section */}
                <button
                  className={`settings-btn ${showPasswordSection ? 'active' : ''}`}
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                >
                  <span className="btn-label">🔒 Đổi mật khẩu đăng nhập</span>
                  <svg className={`chevron-icon ${showPasswordSection ? 'rotate' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Password Section */}
                {showPasswordSection && (
                  <form onSubmit={handleSavePassword} className="password-form fade-in">
                    <div className="form-group">
                      <label className="form-label" htmlFor="currentPassword">Mật khẩu hiện tại</label>
                      <input
                        type="password"
                        id="currentPassword"
                        name="currentPassword"
                        className={`form-input ${passwordErrors.currentPassword ? 'input-error' : ''}`}
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                      />
                      {passwordErrors.currentPassword && <span className="error-message">{passwordErrors.currentPassword}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="newPassword">Mật khẩu mới</label>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        className={`form-input ${passwordErrors.newPassword ? 'input-error' : ''}`}
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                      />
                      {passwordErrors.newPassword && <span className="error-message">{passwordErrors.newPassword}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        className={`form-input ${passwordErrors.confirmPassword ? 'input-error' : ''}`}
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                      />
                      {passwordErrors.confirmPassword && <span className="error-message">{passwordErrors.confirmPassword}</span>}
                    </div>
                    <div className="password-actions">
                      <button type="submit" className="btn btn-primary btn-sm">
                        Lưu mật khẩu mới
                      </button>
                    </div>
                  </form>
                )}

                <hr className="settings-divider" />

                {/* Log out option */}
                <button className="settings-btn logout-btn" onClick={handleLogout}>
                  <span className="btn-label text-danger-heavy">
                    <svg className="btn-icon-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất tài khoản
                  </span>
                </button>

                {/* Delete Account option */}
                <button className="settings-btn delete-account-btn" onClick={() => setShowDeleteModal(true)}>
                  <span className="btn-label text-danger-heavy">
                    <svg className="btn-icon-delete" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Xóa tài khoản
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal-backdrop fade-in" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content scale-up" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">⚠️ Xóa tài khoản</h3>
                <button className="modal-close-btn" onClick={() => setShowDeleteModal(false)} aria-label="Đóng">
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <p>Bạn có chắc chắn muốn xóa tài khoản này?</p>
                <p className="modal-warning-text">
                  Hành động này có thể không thể hoàn tác và bạn sẽ mất quyền truy cập vào tài khoản cũng như dữ liệu liên quan.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  ref={cancelBtnRef}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-danger-action"
                  onClick={handleDeleteAccount}
                >
                  Xóa tài khoản
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
