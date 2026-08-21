import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

/**
 * RichTextEditor Component sử dụng TinyMCE.
 * 
 * Props:
 * - value: Chuỗi HTML hiện tại của editor.
 * - onChange: Callback nhận giá trị mới (HTML string) khi nội dung thay đổi.
 * - height: Chiều cao editor (mặc định 400px).
 * - placeholder: Chữ gợi ý khi chưa có nội dung.
 * - apiKey: API key từ TinyMCE Cloud, mặc định dùng "no-api-key".
 */
export default function RichTextEditor({
  value = '',
  onChange,
  height = 400,
  placeholder = 'Nhập nội dung tại đây...',
  apiKey = 'no-api-key'
}) {
  const editorRef = useRef(null);

  const handleEditorChange = (content) => {
    if (onChange) {
      onChange(content);
    }
  };

  return (
    <div className="rich-text-editor-wrapper">
      <Editor
        apiKey={apiKey}
        onInit={(evt, editor) => (editorRef.current = editor)}
        value={value}
        onEditorChange={handleEditorChange}
        init={{
          height: height,
          menubar: 'file edit view insert format tools table help',
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
          ],
          toolbar:
            'undo redo | blocks | ' +
            'bold italic forecolor backcolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | image media link table | code preview help',
          content_style:
            'body { font-family: Inter, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; }',
          placeholder: placeholder,
          branding: false,
          promotion: false
        }}
      />
    </div>
  );
}
