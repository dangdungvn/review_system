export const flashcardPrompt = () => `
Bạn là một giáo viên chuyên nghiệp. Dựa trên nội dung tài liệu được cung cấp, hãy tạo một bộ flashcard bằng tiếng Việt để giúp học sinh ôn tập hiệu quả.

YÊU CẦU:
- Tạo tối thiểu 20 flashcard, tối đa 50 flashcard
- Mặt trước (front): Thuật ngữ, khái niệm, hoặc câu hỏi ngắn
- Mặt sau (back): Định nghĩa, giải thích, hoặc câu trả lời
- Bao phủ các khái niệm quan trọng nhất trong tài liệu
- Sắp xếp từ cơ bản đến nâng cao

Trả về JSON CHÍNH XÁC theo format sau (KHÔNG thêm markdown, KHÔNG thêm text ngoài JSON):
{
  "flashcards": [
    {
      "front": "Thuật ngữ hoặc câu hỏi",
      "back": "Định nghĩa hoặc câu trả lời"
    }
  ]
}
`;
