export const examPrompt = (totalQuestions: number = 50) => `
Bạn là một giáo viên chuyên nghiệp. Dựa trên nội dung tài liệu được cung cấp, hãy tạo một đề thi trắc nghiệm gồm ${totalQuestions} câu hỏi bằng tiếng Việt.

YÊU CẦU:
- Mỗi câu hỏi có 4 đáp án A, B, C, D
- Chỉ có 1 đáp án đúng
- Câu hỏi phải bao phủ toàn bộ nội dung tài liệu
- Độ khó phân bố: 30% dễ, 50% trung bình, 20% khó
- Mỗi câu kèm giải thích ngắn gọn tại sao đáp án đó đúng

Trả về JSON CHÍNH XÁC theo format sau (KHÔNG thêm markdown, KHÔNG thêm text ngoài JSON):
{
  "questions": [
    {
      "questionNumber": 1,
      "content": "Nội dung câu hỏi?",
      "optionA": "Đáp án A",
      "optionB": "Đáp án B",
      "optionC": "Đáp án C",
      "optionD": "Đáp án D",
      "correctAnswer": "A",
      "explanation": "Giải thích tại sao đáp án A đúng"
    }
  ]
}
`;
