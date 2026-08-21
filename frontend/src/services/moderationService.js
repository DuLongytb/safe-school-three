/**
 * moderationService.js
 * Hệ thống phân tích và hỗ trợ kiểm duyệt nội dung & ngôn từ bài viết cho Safe School.
 * 
 * NGUYÊN TẮC CỐT LÕI:
 * 1. Đây là hệ thống HỖ TRỢ PHÁT HIỆN TÍN HIỆU NGHI VẤN, KHÔNG PHẢI HỆ THỐNG PHÁN QUYẾT TỰ ĐỘNG.
 * 2. Không kết luận "vi phạm" chỉ dựa vào từ khóa đơn lẻ.
 * 3. Phân biệt rõ ngữ cảnh giáo dục/phòng chống bạo lực (false-positive prevention).
 * 4. Quyết định cuối cùng luôn thuộc về Admin.
 */

// Danh mục vi phạm cần kiểm duyệt
export const MODERATION_CATEGORIES = {
  BULLYING: {
    id: 'bullying',
    label: 'Bắt nạt & Cô lập',
    description: 'Hành vi đe dọa, cô lập, trấn lột hoặc bêu riếu học đường',
    color: '#d97706',
    bgColor: '#fef3c7',
  },
  INSULT: {
    id: 'insult',
    label: 'Xúc phạm & Công kích',
    description: 'Ngôn từ lăng mạ, miệt thị, hạ nhục danh dự cá nhân',
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  THREAT: {
    id: 'threat',
    label: 'Đe dọa & Hành hung',
    description: 'Lời đe dọa vũ lực, gây tổn hại thân thể hoặc an nguy',
    color: '#b91c1c',
    bgColor: '#fef2f2',
  },
  HATE: {
    id: 'hate_or_discrimination',
    label: 'Thù ghét & Phân biệt',
    description: 'Kỳ thị hoàn cảnh, gia đình, xuất thân hoặc phân biệt đối xử',
    color: '#7c3aed',
    bgColor: '#f3e8ff',
  },
  VIOLENCE: {
    id: 'violence',
    label: 'Cổ súy bạo lực',
    description: 'Kêu gọi đánh nhau, tụ tập gây rối hoặc sử dụng hung khí',
    color: '#c026d3',
    bgColor: '#fae8ff',
  },
  INAPPROPRIATE: {
    id: 'inappropriate_language',
    label: 'Ngôn từ không phù hợp',
    description: 'Tiếng lóng thô tục, chửi bới không phù hợp môi trường học đường',
    color: '#ea580c',
    bgColor: '#ffedd5',
  },
};

// Cụm từ mang ngữ cảnh giáo dục, tuyên truyền phòng chống (Giúp tránh False Positives)
const EDUCATIONAL_PREVENTATIVE_PATTERNS = [
  'phòng chống',
  'ngăn chặn',
  'chống bạo lực',
  'chống bắt nạt',
  'tác hại của',
  'hậu quả của',
  'kỹ năng ứng phó',
  'kỹ năng phòng tránh',
  'kỹ năng sống',
  'bảo vệ bản thân',
  'bảo vệ bạn bè',
  'hỗ trợ nạn nhân',
  'giúp đỡ nạn nhân',
  'giải pháp phòng ngừa',
  'nâng cao nhận thức',
  'môi trường an toàn',
  'học đường lành mạnh',
  'lên án hành vi',
  'tố cáo hành vi',
  'hãy lên tiếng',
  'tâm lý học đường',
  'tham vấn tâm lý',
  'quy tắc ứng xử',
  'bình đẳng',
  'yêu thương',
  'chia sẻ',
  'giúp nhau học tập',
];

// Mẫu tín hiệu nghi vấn theo từng danh mục
const CATEGORY_PATTERNS = [
  {
    category: 'threat',
    patterns: [
      /chờ đấy tao (đập|đánh|giết|xử)/i,
      /tao sẽ (giết|đập|cho mày biết tay|xử đẹp)/i,
      /gặp đâu đánh đấy/i,
      /không tha cho mày/i,
      /ra cổng trường coi chừng/i,
      /coi chừng tao/i,
      /bước ra khỏi trường/i,
    ],
  },
  {
    category: 'bullying',
    patterns: [
      /lập group (tẩy chay|chửi|bêu riếu)/i,
      /tẩy chay nó đi/i,
      /cô lập nó/i,
      /đừng chơi với nó/i,
      /chặn đường nó/i,
      /ép nộp tiền/i,
      /trấn lột/i,
      /bắt nạt dã man/i,
      /lột đồ/i,
      /quay clip bêu riếu/i,
    ],
  },
  {
    category: 'insult',
    patterns: [
      /\b(đồ ngu|đồ rác rưởi|đồ vô học|thằng khốn|thứ cặn bã|con điên|thằng điên|óc chó|mặt dày|đồ khuyết tật tâm hồn)\b/i,
      /\b(thằng hèn|con đĩ|thằng súc vật|đồ sâu bọ|thằng nhà quê bẩn thỉu)\b/i,
    ],
  },
  {
    category: 'hate_or_discrimination',
    patterns: [
      /\b(bọn nhà nghèo|thứ nhà quê rách rưới|đồ biến thái dị hợm|kỳ thị giới tính|thứ mọi rợ)\b/i,
      /loại người như mày không xứng/i,
    ],
  },
  {
    category: 'violence',
    patterns: [
      /hẹn nhau (sau cổng trường|huyết chiến|đánh nhau|solo)/i,
      /vác hung khí/i,
      /đem dao/i,
      /đem gậy/i,
      /đập nát mặt/i,
      /đánh hội đồng/i,
    ],
  },
  {
    category: 'inappropriate_language',
    patterns: [
      /\b(đm|vcl|vkl|đmm|dcm|đéo|đm mày|chó chết|mẹ kiếp|khốn nạn|chửi thề)\b/i,
    ],
  },
];

/**
 * Loại bỏ thẻ HTML từ rich text để lấy text thô phân tích
 */
export const stripHtml = (html = '') => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Phân tích nội dung bài viết và đưa ra tín hiệu kiểm duyệt
 * @param {string} title - Tiêu đề bài viết
 * @param {string} summary - Mô tả ngắn
 * @param {string} rawContent - Nội dung (có thể chứa HTML)
 * @returns {Object} Kết quả phân tích moderation
 */
export const analyzeContent = (title = '', summary = '', rawContent = '') => {
  const cleanTitle = (title || '').trim();
  const cleanSummary = (summary || '').trim();
  const cleanBody = stripHtml(rawContent || '');
  const fullText = `${cleanTitle} ${cleanSummary} ${cleanBody}`.toLowerCase();

  // 1. Kiểm tra ngữ cảnh giáo dục / tuyên truyền tích cực
  const educationalMatches = EDUCATIONAL_PREVENTATIVE_PATTERNS.filter(pattern =>
    fullText.includes(pattern.toLowerCase())
  );
  const isEducationalContext = educationalMatches.length > 0;

  // 2. Phát hiện các mẫu tín hiệu theo từng danh mục
  const detectedCategories = new Set();
  const flagDetails = [];

  CATEGORY_PATTERNS.forEach(({ category, patterns }) => {
    patterns.forEach(regex => {
      const match = fullText.match(regex);
      if (match) {
        detectedCategories.add(category);
        const catInfo = Object.values(MODERATION_CATEGORIES).find(c => c.id === category) || {
          label: category,
          description: 'Phát hiện tín hiệu ngôn từ cần chú ý',
        };

        // Tránh trùng lặp trong flagDetails
        if (!flagDetails.some(f => f.category === category)) {
          flagDetails.push({
            category,
            label: catInfo.label,
            description: catInfo.description,
            matchedSnippet: match[0],
          });
        }
      }
    });
  });

  const flags = Array.from(detectedCategories);

  // 3. Đánh giá trạng thái ban đầu:
  // Nếu có tín hiệu nghi vấn rõ ràng (như đe dọa, xúc phạm, tục tĩu), yêu cầu Admin xem xét.
  // Nếu là bài thuần giáo dục không chứa các cụm từ xúc phạm/đe dọa trực tiếp -> normal.
  const isReviewRequired = flags.length > 0;

  return {
    status: isReviewRequired ? 'review_required' : 'normal',
    isFlagged: isReviewRequired,
    flags,
    flagDetails,
    educationalContextDetected: isEducationalContext,
    educationalKeywords: educationalMatches.slice(0, 5),
    confidence: isReviewRequired ? (flags.length > 1 ? 'high' : 'medium') : 'low',
    analyzedAt: new Date().toISOString(),
  };
};
