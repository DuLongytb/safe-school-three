import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createArticleService,
  getArticleByIdService,
  updateArticleService
} from '../../services/articleService';
import './CreatePost.css';

const CATEGORIES = [
  'Phòng chống bạo lực',
  'Sức khỏe tâm lý',
  'Kỹ năng sống',
  'An toàn mạng',
  'Khác'
];

// Roles allowed to access admin/moderation panel
const MODERATOR_ROLES = ['admin', 'teacher', 'psychologist', 'expert', 'giáo viên', 'chuyên gia', 'moderator'];

export const isPublisherRole = (role) => {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return MODERATOR_ROLES.includes(r);
};

export default function CreatePost() {
  const { id } = useParams(); // If present, edit mode
  const navigate = useNavigate();
  const { user } = useAuth();
  const editorRef = useRef(null);

  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Phòng chống bạo lực',
    summary: '',
    content: '',
    coverImage: '',
    tagsInput: '',
    visibility: 'public',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingArticle, setFetchingArticle] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  // If edit mode, load article details
  useEffect(() => {
    if (isEditMode && id) {
      fetchExistingArticle();
    }
  }, [id]);

  const editorInitConfig = React.useMemo(() => ({
    license_key: 'gpl',   // Required for TinyMCE 7+ GPL Community edition
    height: 540,
    menubar: false,
    branding: false,
    promotion: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image',
      'charmap', 'preview', 'anchor', 'searchreplace',
      'visualblocks', 'code', 'fullscreen', 'insertdatetime',
      'media', 'table', 'help', 'wordcount'
    ],
    toolbar:
      'undo redo | ' +
      'fontfamily fontsize | ' +
      'bold italic underline strikethrough | ' +
      'forecolor backcolor | ' +
      'alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist | ' +
      'link image table blockquote code | ' +
      'removeformat | fullscreen preview',
    toolbar_sticky: true,
    content_style: `
      body {
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        font-size: 15px;
        line-height: 1.7;
        color: #1e293b;
        padding: 16px 20px;
      }
      img { max-width: 100%; height: auto; border-radius: 6px; }
      table { border-collapse: collapse; width: 100%; }
      table td, table th { border: 1px solid #e2e8f0; padding: 8px 12px; }
      table th { background-color: #f1f5f9; font-weight: 600; }
      blockquote {
        border-left: 4px solid #3b82f6;
        margin: 0;
        padding: 10px 16px;
        background: #f0f7ff;
        border-radius: 0 6px 6px 0;
        color: #475569;
        font-style: italic;
      }
      pre { background: #1e293b; color: #e2e8f0; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
      a { color: #2563eb; }
    `,
    language: 'vi',
    resize: true,
    image_advtab: true,
    link_assume_external_targets: true,
    automatic_uploads: false,
    // Prevent issues with relative URLs for assets
    skin_url: '/tinymce/skins/ui/oxide',
    content_css: '/tinymce/skins/content/default/content.min.css',
  }), []);

  const fetchExistingArticle = async () => {
    setFetchingArticle(true);
    try {
      const article = await getArticleByIdService(id, false);
      if (!article) {
        alert('Không tìm thấy bài viết hoặc bài viết đã bị xóa.');
        navigate('/articles');
        return;
      }

      // Check permissions
      if (user && user.uid !== article.authorId && !isPublisherRole(user.role)) {
        alert('Bạn không có quyền chỉnh sửa bài viết này.');
        navigate(`/articles/${id}`);
        return;
      }

      setFormData({
        title: article.title || '',
        category: article.category || 'Phòng chống bạo lực',
        summary: article.summary || '',
        content: article.content || '',
        coverImage: article.coverImage || '',
        tagsInput: article.tags ? article.tags.join(', ') : '',
        visibility: article.visibility || 'public',
        status: article.status || 'pending',
      });
    } catch (err) {
      console.error('Error fetching existing article:', err);
      alert('Đã xảy ra lỗi khi tải thông tin bài viết.');
    } finally {
      setFetchingArticle(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Called by TinyMCE on every content change
  const handleEditorChange = (content) => {
    setFormData(prev => ({ ...prev, content }));
    if (errors.content) {
      setErrors(prev => ({ ...prev, content: '' }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) {
      errs.title = 'Vui lòng nhập tiêu đề bài viết.';
    }
    if (!formData.summary.trim()) {
      errs.summary = 'Vui lòng nhập mô tả ngắn.';
    }
    // Get current content from editor if available
    const currentContent = editorRef.current
      ? editorRef.current.getContent()
      : formData.content;
    if (!currentContent || !currentContent.replace(/<[^>]*>/g, '').trim()) {
      errs.content = 'Vui lòng nhập nội dung chi tiết bài viết.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Vui lòng đăng nhập để thực hiện.');
      navigate('/login');
      return;
    }

    // Sync latest editor content before validation
    const editorContent = editorRef.current
      ? editorRef.current.getContent()
      : formData.content;
    const updatedFormData = { ...formData, content: editorContent };
    setFormData(updatedFormData);

    if (!validate()) return;

    setLoading(true);

    const tagsArray = updatedFormData.tagsInput
      ? updatedFormData.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const payload = {
      title: updatedFormData.title.trim(),
      category: updatedFormData.category,
      summary: updatedFormData.summary.trim(),
      content: editorContent,           // HTML from TinyMCE
      coverImage: updatedFormData.coverImage.trim() || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
      tags: tagsArray,
      visibility: updatedFormData.visibility,
      // Status always pending — moderation required for all roles
      status: isEditMode ? (updatedFormData.status || 'pending') : 'pending',
    };

    try {
      if (isEditMode) {
        await updateArticleService(id, payload);
        alert('Cập nhật bài viết thành công!');
        navigate(`/articles/${id}`);
      } else {
        await createArticleService(payload, user);
        alert('Bài viết của bạn đã được gửi thành công và đang chờ kiểm duyệt trước khi được công khai.');
        navigate('/articles');
      }
    } catch (err) {
      console.error('Error saving article:', err);
      alert('Đã xảy ra lỗi khi lưu bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingArticle) {
    return (
      <div className="create-post-container">
        <div className="create-post-loading">
          <div className="spinner"></div>
          <p>Đang nạp thông tin bài viết...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-post-container fade-in">
      <div className="create-post-header">
        <button className="back-link-btn" onClick={() => navigate('/articles')}>
          ← Quay lại danh sách
        </button>
        <h1 className="form-page-title">
          {isEditMode ? 'Chỉnh Sửa Bài Viết' : 'Tạo Bài Viết Mới'}
        </h1>
        <p className="form-page-subtitle">
          {isEditMode
            ? 'Cập nhật lại nội dung, ảnh bìa và các thông tin cần thiết cho bài viết của bạn.'
            : 'Chia sẻ kiến thức, giải pháp và kinh nghiệm bảo vệ an toàn học đường cùng cộng đồng.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="post-form-card">
        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="title">
            Tiêu đề bài viết <span className="text-required">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            className={`form-input ${errors.title ? 'input-error' : ''}`}
            placeholder="Ví dụ: Kỹ năng ứng phó khi bị bắt nạt học đường..."
            value={formData.title}
            onChange={handleChange}
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>

        {/* Category & Visibility Row */}
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="category">
              Danh mục <span className="text-required">*</span>
            </label>
            <select
              id="category"
              name="category"
              className="form-input select-input"
              value={formData.category}
              onChange={handleChange}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="visibility">
              Mức độ hiển thị
            </label>
            <select
              id="visibility"
              name="visibility"
              className="form-input select-input"
              value={formData.visibility}
              onChange={handleChange}
            >
              <option value="public">Công khai (Public)</option>
              <option value="private">Riêng tư (Private)</option>
            </select>
          </div>
        </div>

        {/* Short Summary */}
        <div className="form-group">
          <label className="form-label" htmlFor="summary">
            Mô tả ngắn <span className="text-required">*</span>
          </label>
          <textarea
            id="summary"
            name="summary"
            rows="3"
            className={`form-input ${errors.summary ? 'input-error' : ''}`}
            placeholder="Tóm tắt ngắn gọn nội dung bài viết (hiển thị trên thẻ bài viết)..."
            value={formData.summary}
            onChange={handleChange}
          />
          {errors.summary && <span className="error-message">{errors.summary}</span>}
        </div>

        {/* Cover Image URL & Live Preview */}
        <div className="form-group">
          <label className="form-label" htmlFor="coverImage">
            URL Ảnh bìa
          </label>
          <input
            type="url"
            id="coverImage"
            name="coverImage"
            className="form-input"
            placeholder="https://example.com/image.jpg (Dán đường dẫn hình ảnh)"
            value={formData.coverImage}
            onChange={handleChange}
          />
          {formData.coverImage && (
            <div className="cover-image-preview">
              <span className="preview-label">Xem trước ảnh bìa:</span>
              <img
                src={formData.coverImage}
                alt="Preview"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* Full Content — TinyMCE Editor */}
        <div className="form-group">
          <label className="form-label" htmlFor="content-editor">
            Nội dung chi tiết <span className="text-required">*</span>
          </label>
          <div
            id="content-editor"
            className={`tinymce-wrapper ${errors.content ? 'tinymce-error' : ''}`}
          >
            <Editor
              // Use self-hosted TinyMCE from /public/tinymce (no API key required)
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              onInit={(evt, editor) => {
                editorRef.current = editor;
                setEditorReady(true);
              }}
              initialValue={isEditMode ? formData.content : undefined}
              init={editorInitConfig}
              onEditorChange={handleEditorChange}
            />
          </div>
          {errors.content && <span className="error-message">{errors.content}</span>}
        </div>

        {/* Tags */}
        <div className="form-group">
          <label className="form-label" htmlFor="tagsInput">
            Thẻ chủ đề (Tags)
          </label>
          <input
            type="text"
            id="tagsInput"
            name="tagsInput"
            className="form-input"
            placeholder="Nhập các thẻ phân cách bằng dấu phẩy (Ví dụ: bạclực, kĩnăng, an toàn)"
            value={formData.tagsInput}
            onChange={handleChange}
          />
        </div>

        {/* Actions */}
        <div className="form-card-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEditMode ? `/articles/${id}` : '/articles')}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Đang lưu...' : isEditMode ? 'Lưu cập nhật' : 'Gửi chờ kiểm duyệt'}
          </button>
        </div>
      </form>
    </div>
  );
}
