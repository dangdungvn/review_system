# 🚀 Quick Start - AI Assessment System

## Tóm tắt nhanh

Hệ thống đánh giá năng lực **ngầm** với AI - user chỉ thấy feedback và đề xuất, KHÔNG thấy điểm số internal.

---

## 📋 Setup nhanh (5 phút)

### 1. Install & Config

```bash
# Install dependencies (nếu chưa)
npm install

# Thêm GEMINI_API_KEY vào .env
echo "GEMINI_API_KEY=your_key_here" >> .env
```

### 2. Tạo Database Tables

```bash
# Generate migration
npm run typeorm migration:generate -- src/migrations/AddAssessmentTables

# Run migration
npm run typeorm migration:run
```

### 3. Start Server

```bash
npm run start:dev
```

---

## 🔑 APIs chính (cho Frontend)

### 1. Submit Exam với Confidence

```typescript
POST /assessment/exams/:examId/submit
```

**Frontend GỬI:**
```json
{
  "answers": [
    {
      "questionId": 123,
      "answer": "A",
      "confidence": "confident",  // guessing/uncertain/confident
      "timeSpentSeconds": 45
    }
  ],
  "totalTimeSpentSeconds": 1800
}
```

**Backend TRẢ VỀ:**
```json
{
  "attemptId": "uuid",
  "correctAnswers": 15,
  "totalQuestions": 20,
  "accuracy": 75,
  "feedback": "Bạn làm rất tốt! Hãy thử bài khó hơn nhé."
}
```

---

### 2. Lấy Recommendations

```typescript
GET /assessment/recommendations
```

**TRẢ VỀ:**
```json
[
  {
    "type": "flashcard",
    "itemId": 123,
    "title": "Ôn tập: Đạo hàm",
    "reason": "Ôn lại để nhớ lâu hơn",
    "estimatedTimeMinutes": 10
  }
]
```

---

### 3. Lấy "Bài tiếp theo"

```typescript
GET /assessment/next-activity
```

**TRẢ VỀ:**
```json
{
  "activityType": "exam",
  "activityId": 456,
  "title": "Bài thi Toán",
  "description": "Thử sức với chủ đề mới"
}
```

---

### 4. Tiến độ người dùng

```typescript
GET /assessment/progress
```

**TRẢ VỀ:**
```json
{
  "examsCompleted": 25,
  "flashcardsMastered": 150,
  "currentStreak": 7,
  "motivationalMessage": "Bạn đang học rất đều đặn! 💪"
}
```

---

## 🎯 Frontend CẦN TRACK gì?

### Required (tối thiểu)

```typescript
{
  questionId: number,
  answer: "A" | "B" | "C" | "D",
  confidence: "guessing" | "uncertain" | "confident",
  timeSpentSeconds: number
}
```

### Recommended (để AI chính xác hơn)

```typescript
{
  wasChanged: boolean,        // Đổi đáp án?
  backtrackCount: number,     // Quay lại câu này bao nhiêu lần?
  sequenceOrder: number       // Thứ tự làm (1, 2, 3...)
}
```

---

## 🧠 AI hoạt động như thế nào?

```
User làm bài
  ↓
Thu thập: time, confidence, sequence
  ↓
[BKT] → Đánh giá mastery từng skill (0-1)
[IRT] → Đánh giá ability tổng thể (θ)
[AI]  → Generate feedback tiếng Việt
  ↓
Recommendations:
  1. Review weak skills
  2. Due flashcards (spaced repetition)
  3. New challenges (ZPD)
  4. Retry low-score exams
```

---

## 📊 User THẤY gì vs KHÔNG thấy gì

### ✅ User THẤY

- Số câu đúng/sai
- Feedback động viên (AI-generated)
- Đề xuất bài tập tiếp theo
- Tiến độ chung (số bài đã làm)

### ❌ User KHÔNG thấy

- EXP, Level, Badge
- Mastery probability (0.75)
- IRT theta (1.2)
- Learning style (FAST_LEARNER)
- Internal scores

---

## 🔧 Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key  # Required for AI feedback
```

**Lấy key:** https://makersuite.google.com/app/apikey

---

## 📖 Đọc thêm

Chi tiết đầy đủ: [AI_ASSESSMENT_README.md](./AI_ASSESSMENT_README.md)

---

## ✅ Checklist Implementation

### Backend (Done ✅)

- [x] 9 entities (UserExamAttempt, UserAnswer, UserKnowledgeState, etc.)
- [x] BKT service (Bayesian Knowledge Tracing)
- [x] IRT service (Item Response Theory)
- [x] AI service (Gemini integration)
- [x] AssessmentService (submit exam logic)
- [x] RecommendationService (adaptive algorithms)
- [x] AssessmentController (4 endpoints)
- [x] Module integration

### Frontend (TODO)

- [ ] UI: Confidence level selector (guessing/uncertain/confident)
- [ ] Track: Time per question
- [ ] Track: Total time spent
- [ ] Track: Answer changes
- [ ] Display: AI feedback sau bài thi
- [ ] Display: Recommendations list
- [ ] Display: "Bài tiếp theo" button
- [ ] Display: Progress overview

---

**Happy Coding! 🎉**
