# Quick Start - Hướng dẫn nhanh test API

## 🚀 Khởi động server

```bash
npm run start:dev
```

Server sẽ chạy tại: **http://localhost:3000**
Swagger UI: **http://localhost:3000/api/docs**

---

## 🧪 Test Authentication trên Swagger

### Bước 1: Đăng ký tài khoản

1. Mở Swagger UI: http://localhost:3000/api/docs
2. Tìm endpoint **POST /api/auth/register**
3. Click **"Try it out"**
4. Nhập thông tin:

```json
{
  "email": "test@example.com",
  "password": "Test123456",
  "fullName": "Nguyễn Văn Test"
}
```

5. Click **"Execute"**
6. Nếu thành công, bạn sẽ nhận được:

```json
{
  "statusCode": 201,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "email": "test@example.com",
      "fullName": "Nguyễn Văn Test",
      "role": "user"
    }
  }
}
```

7. **Copy `accessToken`** từ response

---

### Bước 2: Authorize (Xác thực)

1. Cuộn lên đầu trang Swagger
2. Click nút **Authorize** 🔒 (góc phải trên)
3. Nhập vào ô **JWT**:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   (Thay bằng token thực của bạn, **nhớ có từ "Bearer "** ở đầu)

4. Click **"Authorize"**
5. Click **"Close"**

---

### Bước 3: Test Protected Endpoint

1. Tìm endpoint **GET /api/auth/me**
2. Click **"Try it out"** → **"Execute"**
3. Bạn sẽ thấy thông tin user hiện tại:

```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "email": "test@example.com",
    "fullName": "Nguyễn Văn Test",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 📝 Test các chức năng khác

### 1. Upload tài liệu PDF

**POST /api/documents/upload**

1. Click **"Try it out"**
2. Click **"Choose File"** → chọn file PDF (max 10MB)
3. Nhập `title` (tùy chọn)
4. Click **"Execute"**

Response:
```json
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "title": "Tài liệu test",
    "filename": "uuid.pdf",
    "filepath": "uploads/uuid.pdf",
    "extractedText": "Nội dung PDF...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 2. Sinh đề thi trắc nghiệm

**POST /api/exams/generate/{documentId}**

1. Thay `{documentId}` bằng ID tài liệu (ví dụ: 1)
2. Click **"Execute"**
3. Đợi AI xử lý (khoảng 10-30 giây)

Response: Đề thi 50 câu trắc nghiệm ABCD

---

### 3. Sinh Flashcards

**POST /api/flashcard-sets/generate/{documentId}**

Tương tự như sinh đề thi, response là bộ flashcard (câu hỏi - đáp án).

---

### 4. Sinh câu hỏi Đúng/Sai

**POST /api/true-false/generate/{documentId}**

Response: Bộ câu hỏi đúng/sai kèm giải thích.

---

## 🔑 Các endpoint Auth quan trọng

| Endpoint | Mô tả | Auth |
|----------|-------|------|
| POST /api/auth/register | Đăng ký | ❌ |
| POST /api/auth/login | Đăng nhập | ❌ |
| POST /api/auth/logout | Đăng xuất | ✅ |
| POST /api/auth/refresh | Làm mới token | ❌ (dùng refresh token) |
| GET /api/auth/me | Thông tin user | ✅ |

---

## ⚠️ Lưu ý

### Token hết hạn
- **Access token** hết hạn sau **15 phút**
- Nếu gọi API bị lỗi 401, làm mới token bằng endpoint **POST /api/auth/refresh**

### Protected vs Public endpoints
- Hiện tại **TẤT CẢ endpoints đều public** (để dễ test)
- Để bật auth cho endpoint cụ thể, xóa decorator `@Public()` trong controller
- Ví dụ: Muốn bật auth cho upload PDF → xóa `@Public()` ở DocumentsController

---

## 🐛 Troubleshooting

### Lỗi 401 Unauthorized
- Kiểm tra xem đã click **Authorize** chưa
- Kiểm tra format token: `Bearer {token}` (có dấu cách sau "Bearer")
- Token có thể đã hết hạn → dùng `/refresh` để lấy token mới

### Lỗi CORS khi gọi từ frontend
Thêm origin vào `.env`:
```
CORS_ORIGIN=http://localhost:5173
```

### Lỗi kết nối database
- Kiểm tra MySQL đang chạy (Laragon)
- Kiểm tra thông tin DB trong `.env`

---

## 📚 Tài liệu chi tiết

- **Authentication**: [`docs/AUTH_MODULE.md`](./AUTH_MODULE.md)
- **Architecture**: [`CLAUDE.md`](../CLAUDE.md)

---

## 🎯 Flow hoàn chỉnh

1. **Đăng ký/Đăng nhập** → Lấy access token
2. **Authorize** trên Swagger với token
3. **Upload PDF** → Lấy documentId
4. **Sinh đề thi/flashcard/câu hỏi** từ documentId
5. **Xem danh sách** đã tạo
6. **Xem chi tiết** từng item

---

**Happy coding! 🚀**
