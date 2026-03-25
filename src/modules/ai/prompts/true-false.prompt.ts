export const trueFalsePrompt = (totalQuestions: number = 30) => `
Bạn là một giáo viên chuyên nghiệp. Dựa trên nội dung tài liệu được cung cấp, hãy tạo ${totalQuestions} câu hỏi dạng ĐÚNG/SAI bằng tiếng Việt.

YÊU CẦU:
- Mỗi câu là một phát biểu mà học sinh phải xác định là ĐÚNG hay SAI
- Tỷ lệ đúng/sai cân bằng (khoảng 50/50)
- Phát biểu sai phải hợp lý (không quá hiển nhiên)
- Mỗi câu kèm giải thích ngắn gọn

Trả về JSON CHÍNH XÁC theo format sau (KHÔNG thêm markdown, KHÔNG thêm text ngoài JSON):
{
  "questions": [
    {
      "questionNumber": 1,
      "content": "Phát biểu cần xác định đúng/sai",
      "correctAnswer": true,
      "explanation": "Giải thích tại sao phát biểu này đúng/sai"
    }
  ]
}
`;
