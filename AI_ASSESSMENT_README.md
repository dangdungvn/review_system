# 🧠 AI-Powered Assessment System - Hệ thống Đánh giá Năng lực với AI

## 📋 Tổng quan

Hệ thống đánh giá năng lực **ngầm** (implicit assessment) sử dụng AI và Machine Learning để:
- Thu thập dữ liệu hành vi người dùng khi làm bài thi
- Phân tích patterns và đánh giá năng lực thực sự
- Đưa ra đề xuất nội dung học tập phù hợp (adaptive learning)
- Tạo feedback cá nhân hóa bằng AI (Gemini)

**User KHÔNG thấy:**
- ❌ Điểm số EXP, Level, Badge
- ❌ Ranking/Leaderboard
- ❌ "Bạn đang ở mức Advanced"

**User CHỈ thấy:**
- ✅ Feedback động viên sau bài thi
- ✅ Đề xuất bài tập tiếp theo (AI-powered)
- ✅ Tiến độ chung (số bài đã làm, streak)

---

## 🏗️ Architecture Core

### Thuật toán AI/ML

| Algorithm | Mục đích | Output |
|-----------|----------|--------|
| **BKT** (Bayesian Knowledge Tracing) | Đánh giá mức độ nắm vững từng skill | `masteryProbability` (0-1) |
| **IRT** (Item Response Theory) | Đánh giá năng lực tổng thể & độ khó câu hỏi | `theta` (-3 to +3) |
| **Behavioral Analysis** | Phát hiện learning patterns | `LearningStyle` enum |
| **Gemini AI** | Feedback & misconception analysis | Personalized text |

### Database Schema

```
user_exam_attempts
├── Basic metrics (score, correctAnswers, timeSpent)
├── Confidence breakdown (confidentCorrect, uncertainCorrect, guessingCorrect)
└── behavioralData (JSON): 20+ signals

user_answers
├── Per-question tracking
├── confidence (GUESSING/UNCERTAIN/CONFIDENT)
├── wasChanged, backtrackCount, sequenceOrder
└── timeSpentSeconds

user_knowledge_states (BKT)
├── skillId → masteryProbability
└── pLearn, pGuess, pSlip (BKT parameters)

user_abilities (IRT)
├── globalTheta (user ability)
└── topicThetas (per-topic abilities)

question_irt_params
├── difficulty, discrimination, guessing
└── Updated dynamically from user responses

user_learning_profiles
├── primaryStyle (FAST_LEARNER | STRUGGLING | etc.)
├── learningVelocity, persistenceLevel
└── detectedIssues (hasGuessPattern, hasRushingPattern, etc.)

user_misconceptions
└── AI-detected conceptual misunderstandings
```

---

## 🚀 API Documentation

### Base URL
```
http://localhost:3000/assessment
```

### Authentication
Tất cả endpoints yêu cầu JWT token trong header:
```
Authorization: Bearer <access_token>
```

---

## 📝 API Endpoints

### 1. Submit Exam Attempt

**POST** `/assessment/exams/:examId/submit`

Submit bài thi với **confidence level** cho từng câu trả lời.

#### Request Body

```typescript
{
  "answers": [
    {
      "questionId": 123,
      "answer": "A",                    // Required: A/B/C/D
      "confidence": "confident",        // Required: guessing/uncertain/confident
      "timeSpentSeconds": 45,           // Optional: thời gian trả lời câu này
      "wasChanged": false,              // Optional: có đổi đáp án không
      "backtrackCount": 0,              // Optional: số lần quay lại câu này
      "sequenceOrder": 1                // Optional: thứ tự làm câu (1, 2, 3...)
    },
    {
      "questionId": 124,
      "answer": "B",
      "confidence": "uncertain",
      "timeSpentSeconds": 120
    },
    // ... more answers
  ],
  "totalTimeSpentSeconds": 1800,       // Required: tổng thời gian làm bài
  "deviceType": "desktop"               // Optional: desktop/mobile/tablet
}
```

#### Response

```typescript
{
  "attemptId": "uuid-here",
  "correctAnswers": 15,
  "totalQuestions": 20,
  "accuracy": 75.0,
  "timeSpent": 1800,
  "feedback": "Bạn làm rất tốt! Hãy thử những bài khó hơn nhé.",

  // Optional: Breakdown confidence (not shown to user in UI)
  "confidentCorrect": 10,
  "uncertainCorrect": 3,
  "guessingCorrect": 2
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `attemptId` | string | ID của lần làm bài (để tracking) |
| `correctAnswers` | number | Số câu trả lời đúng |
| `totalQuestions` | number | Tổng số câu hỏi |
| `accuracy` | number | Độ chính xác (%) |
| `timeSpent` | number | Thời gian làm bài (giây) |
| `feedback` | string | Phản hồi cá nhân hóa từ AI (tiếng Việt) |
| `confidentCorrect` | number | Số câu tự tin đúng |
| `uncertainCorrect` | number | Số câu không chắc đúng |
| `guessingCorrect` | number | Số câu đoán đúng |

#### Ví dụ cURL

```bash
curl -X POST http://localhost:3000/assessment/exams/1/submit \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": 1,
        "answer": "A",
        "confidence": "confident",
        "timeSpentSeconds": 30
      },
      {
        "questionId": 2,
        "answer": "B",
        "confidence": "guessing",
        "timeSpentSeconds": 15
      }
    ],
    "totalTimeSpentSeconds": 600,
    "deviceType": "desktop"
  }'
```

---

### 2. Get Recommendations

**GET** `/assessment/recommendations`

Lấy danh sách đề xuất hoạt động tiếp theo (adaptive learning).

#### Response

```typescript
[
  {
    "type": "flashcard",              // exam | flashcard | true_false
    "itemId": 123,
    "title": "Ôn tập: Đạo hàm cơ bản",
    "reason": "Ôn lại để nhớ lâu hơn",
    "estimatedTimeMinutes": 10
  },
  {
    "type": "exam",
    "itemId": 456,
    "title": "Bài kiểm tra: Tích phân",
    "reason": "Thử sức với chủ đề mới",
    "estimatedTimeMinutes": 30
  },
  {
    "type": "exam",
    "itemId": 789,
    "title": "Bài thi Toán cao cấp",
    "reason": "Thử lại để cải thiện điểm số",
    "estimatedTimeMinutes": 30
  }
]
```

#### Recommendation Types

| Type | Description |
|------|-------------|
| `exam` | Bài kiểm tra 4 lựa chọn |
| `flashcard` | Bộ flashcard (spaced repetition) |
| `true_false` | Bài tập đúng/sai |

#### Ví dụ cURL

```bash
curl -X GET http://localhost:3000/assessment/recommendations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 3. Get Next Activity

**GET** `/assessment/next-activity`

Lấy **1 activity** được đề xuất ưu tiên cao nhất.

#### Response

```typescript
{
  "activityType": "flashcard",
  "activityId": 123,
  "title": "Ôn tập: Đạo hàm cơ bản",
  "description": "Đã đến lúc ôn lại để nhớ lâu hơn"
}
```

#### Use Case

Frontend có thể hiển thị nút "Bài tập tiếp theo" → gọi API này → navigate đến activity.

#### Ví dụ cURL

```bash
curl -X GET http://localhost:3000/assessment/next-activity \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 4. Get User Progress

**GET** `/assessment/progress`

Lấy thông tin tiến độ tổng quan (KHÔNG chứa internal scores).

#### Response

```typescript
{
  "examsCompleted": 25,
  "flashcardsMastered": 150,
  "currentStreak": 7,
  "motivationalMessage": "Bạn đang học rất đều đặn! Tiếp tục nhé 💪",
  "averageAccuracy": 78.5         // Optional
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `examsCompleted` | number | Số bài thi đã hoàn thành |
| `flashcardsMastered` | number | Số flashcard đã master |
| `currentStreak` | number | Chuỗi ngày học liên tiếp |
| `motivationalMessage` | string | Tin nhắn động viên (AI-generated) |
| `averageAccuracy` | number | Độ chính xác trung bình (%) - optional |

#### Ví dụ cURL

```bash
curl -X GET http://localhost:3000/assessment/progress \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🔧 Environment Variables

Thêm vào `.env` file:

```env
# Gemini API Key (required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Lấy Gemini API Key

1. Truy cập: https://makersuite.google.com/app/apikey
2. Tạo API key mới
3. Copy và paste vào `.env`

**Lưu ý:** Nếu không có API key, hệ thống sẽ dùng fallback feedback (không có AI).

---

## 📊 Behavioral Data Collection

### Dữ liệu Frontend CẦN gửi lên

Để hệ thống AI hoạt động tốt, frontend cần track và gửi các thông tin sau:

#### ✅ Required Fields

```typescript
{
  "questionId": number,           // ID câu hỏi
  "answer": "A" | "B" | "C" | "D", // Đáp án chọn
  "confidence": "guessing" | "uncertain" | "confident", // Độ tự tin
  "timeSpentSeconds": number      // Seconds spent on this question
}
```

#### ⭐ Recommended Fields (Enhance AI accuracy)

```typescript
{
  "wasChanged": boolean,          // User có đổi đáp án không?
  "backtrackCount": number,       // Số lần quay lại câu này
  "sequenceOrder": number         // Thứ tự làm câu (1, 2, 3...)
}
```

### Cách track ở Frontend

#### 1. Time Tracking

```typescript
// Per question
let questionStartTime = Date.now();

function onAnswerSubmit() {
  const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
  answers.push({
    questionId: currentQuestion.id,
    answer: selectedAnswer,
    timeSpentSeconds: timeSpent,
    // ...
  });
}

// Total time
let examStartTime = Date.now();

function onExamSubmit() {
  const totalTime = Math.floor((Date.now() - examStartTime) / 1000);
  submitExam({
    answers,
    totalTimeSpentSeconds: totalTime
  });
}
```

#### 2. Confidence Level Tracking

```tsx
// UI Example (React)
<div>
  <p>Bạn tự tin với câu trả lời này không?</p>
  <button onClick={() => setConfidence('confident')}>
    😎 Tự tin
  </button>
  <button onClick={() => setConfidence('uncertain')}>
    🤔 Không chắc
  </button>
  <button onClick={() => setConfidence('guessing')}>
    🎲 Đoán
  </button>
</div>
```

#### 3. Answer Change Tracking

```typescript
let originalAnswer = null;

function onAnswerSelect(answer: string) {
  if (originalAnswer === null) {
    originalAnswer = answer;
  }

  currentAnswer = answer;
}

function getWasChanged() {
  return originalAnswer !== currentAnswer;
}
```

#### 4. Sequence Order Tracking

```typescript
let sequenceCounter = 1;
const questionSequence = new Map();

function onQuestionView(questionId: number) {
  if (!questionSequence.has(questionId)) {
    questionSequence.set(questionId, sequenceCounter++);
  }
}

function getSequenceOrder(questionId: number) {
  return questionSequence.get(questionId);
}
```

---

## 🎯 Frontend Integration Example

### Submit Exam - Full Example

```typescript
import axios from 'axios';

interface Answer {
  questionId: number;
  answer: 'A' | 'B' | 'C' | 'D';
  confidence: 'guessing' | 'uncertain' | 'confident';
  timeSpentSeconds: number;
  wasChanged?: boolean;
  backtrackCount?: number;
  sequenceOrder?: number;
}

interface SubmitExamRequest {
  answers: Answer[];
  totalTimeSpentSeconds: number;
  deviceType?: string;
}

interface ExamResult {
  attemptId: string;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  timeSpent: number;
  feedback: string;
  confidentCorrect?: number;
  uncertainCorrect?: number;
  guessingCorrect?: number;
}

async function submitExam(
  examId: number,
  data: SubmitExamRequest,
  token: string
): Promise<ExamResult> {
  const response = await axios.post<ExamResult>(
    `http://localhost:3000/assessment/exams/${examId}/submit`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

// Usage
const result = await submitExam(1, {
  answers: [
    {
      questionId: 1,
      answer: 'A',
      confidence: 'confident',
      timeSpentSeconds: 30,
      wasChanged: false,
      sequenceOrder: 1
    },
    {
      questionId: 2,
      answer: 'B',
      confidence: 'guessing',
      timeSpentSeconds: 15,
      wasChanged: true,
      sequenceOrder: 2
    }
  ],
  totalTimeSpentSeconds: 600,
  deviceType: 'desktop'
}, accessToken);

// Show feedback to user
alert(result.feedback);
```

---

## 🧪 Testing APIs

### 1. Login để lấy token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### 2. Submit Exam

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3000/assessment/exams/1/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": 1,
        "answer": "A",
        "confidence": "confident",
        "timeSpentSeconds": 30
      }
    ],
    "totalTimeSpentSeconds": 600
  }'
```

### 3. Get Recommendations

```bash
curl -X GET http://localhost:3000/assessment/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔬 AI Algorithms Explained

### 1. Bayesian Knowledge Tracing (BKT)

**Mục đích:** Đánh giá xác suất user đã nắm vững 1 skill.

**Parameters:**
- `P(L)`: Probability mastered (output)
- `P(T)`: Probability of learning (transition rate)
- `P(G)`: Probability of guessing correctly
- `P(S)`: Probability of slip (know but answer wrong)

**Update Formula:**
```
P(L | correct) = [P(L) * P(correct|L)] / P(correct)

Where:
  P(correct|L) = 1 - P(S)
  P(correct|¬L) = P(G)
```

**Adaptive Adjustment:**
- High confidence + correct → increase P(T)
- High confidence + incorrect → decrease P(T) (misconception)
- Guessing + correct → small increase

---

### 2. Item Response Theory (IRT)

**Mục đích:** Đánh giá năng lực user (`θ`) và độ khó câu hỏi (`b`).

**3PL Model:**
```
P(correct) = c + (1-c) / (1 + exp(-a*(θ - b)))

Where:
  θ = user ability (-3 to +3)
  a = discrimination (0-2)
  b = difficulty (-3 to +3)
  c = guessing (0.25 for 4 options)
```

**Update θ (simplified MLE):**
```
θ_new = θ_old + α * a * (observed - expected)

Where:
  α = learning rate (0.1)
  observed = 1 if correct, 0 if incorrect
  expected = P(correct) from 3PL model
```

---

### 3. Adaptive Recommendation (Zone of Proximal Development)

**Optimal Difficulty:**
```
target_difficulty = θ + 0.5

Adjustments:
  - FAST_LEARNER: +0.5 (challenge more)
  - STRUGGLING: -0.3 (gentler slope)
```

**Recommendation Priority:**
1. **Weak skills** (mastery < 0.5) → Review flashcards
2. **Due flashcards** (spaced repetition) → Review
3. **New challenges** (ZPD difficulty) → New exams
4. **Low score retries** (score < 70%) → Retry exams

---

## 📈 Dashboard Admin (Future)

Admin có thể xem internal assessments của users:

**GET** `/admin/users/:userId/assessment` (Admin only)

```typescript
{
  "userId": "uuid",
  "globalAbility": 1.2,           // IRT theta
  "knowledgeStates": [
    {
      "skillId": "calculus_derivatives",
      "masteryProbability": 0.75,
      "lastUpdated": "2026-03-28T10:30:00Z"
    }
  ],
  "learningProfile": {
    "primaryStyle": "fast_learner",
    "learningVelocity": 0.8,
    "persistenceLevel": 0.9,
    "detectedIssues": {
      "hasGuessPattern": false,
      "hasRushingPattern": false
    }
  },
  "misconceptions": [
    {
      "skillId": "calculus_derivatives",
      "description": "Confuses product rule with chain rule",
      "severity": 0.6,
      "detectedAt": "2026-03-25T14:20:00Z"
    }
  ]
}
```

---

## 🚦 Error Handling

### Common Errors

| Status | Error | Причина |
|--------|-------|---------|
| 400 | Bad Request | DTO validation failed |
| 401 | Unauthorized | Missing/invalid JWT token |
| 404 | Not Found | Exam not found |
| 500 | Internal Server Error | AI service error, DB error |

### Error Response Format

```typescript
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-03-28T10:30:00Z",
  "path": "/assessment/exams/1/submit"
}
```

---

## 🔄 Data Flow Diagram

```
User làm bài thi
  ↓
Frontend tracks: time, confidence, sequence
  ↓
POST /assessment/exams/:id/submit
  ↓
AssessmentService
  ├→ Calculate metrics (sync)
  ├→ Save attempt + answers (sync)
  ├→ Generate AI feedback (sync)
  └→ Return result to user

Background Jobs (async - không block response):
  ├→ BKT update (knowledge states)
  ├→ IRT update (user ability + question params)
  ├→ Learning profile classification
  └→ Misconception detection

Next request:
GET /assessment/recommendations
  ↓
RecommendationService
  ├→ Get knowledge states (BKT)
  ├→ Get user ability (IRT)
  ├→ Calculate optimal difficulty (ZPD)
  └→ Return adaptive recommendations
```

---

## 📦 Installation & Setup

### 1. Install Dependencies

```bash
cd review_system
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=
DATABASE_NAME=review_system

JWT_SECRET=your_secret_key_here
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Migrations

```bash
npm run typeorm migration:run
```

### 4. Start Server

```bash
npm run start:dev
```

Server chạy tại: `http://localhost:3000`

### 5. Test API

```bash
# Check health
curl http://localhost:3000

# Access Swagger docs
open http://localhost:3000/api
```

---

## 🎨 UI/UX Recommendations

### Hiển thị Feedback

```tsx
{/* After exam submission */}
<div className="feedback-card">
  <h3>Kết quả</h3>
  <p className="score">{correctAnswers}/{totalQuestions} câu đúng</p>
  <p className="feedback">{result.feedback}</p>

  {/* DON'T show internal scores */}
  {/* ❌ <p>Mastery: 0.75</p> */}
  {/* ❌ <p>Ability θ: 1.2</p> */}
</div>
```

### Hiển thị Recommendations

```tsx
<div className="recommendations">
  <h3>Đề xuất cho bạn</h3>
  {recommendations.map(rec => (
    <div className="rec-card" key={rec.itemId}>
      <h4>{rec.title}</h4>
      <p>{rec.reason}</p>
      <span>⏱️ {rec.estimatedTimeMinutes} phút</span>
      <button onClick={() => navigate(rec)}>
        Bắt đầu
      </button>
    </div>
  ))}
</div>
```

---

## 📚 References

- **Bayesian Knowledge Tracing:** Corbett, A.T., & Anderson, J.R. (1995)
- **Item Response Theory:** Lord, F.M. (1980)
- **Zone of Proximal Development:** Vygotsky, L.S. (1978)
- **Gemini AI:** https://ai.google.dev/

---

## 🤝 Support

Nếu gặp vấn đề, tạo issue tại: https://github.com/your-repo/issues

---

## 📝 License

MIT License - Copyright (c) 2026

---

**Happy Coding! 🚀**
