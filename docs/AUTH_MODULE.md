# Authentication Module - Hệ thống Xác thực JWT

## Tổng quan

Module Authentication cung cấp hệ thống xác thực hoàn chỉnh cho Review System, hỗ trợ **cả mobile và web** với JWT (JSON Web Tokens).

### Công nghệ sử dụng

- **JWT**: Access token (15 phút) + Refresh token (7 ngày)
- **Argon2id**: Hash password (chuẩn OWASP, bảo mật cao hơn Bcrypt)
- **Passport.js**: Middleware authentication cho NestJS
- **Cookie-based auth**: Cho web (httpOnly, secure)
- **Bearer token**: Cho mobile app

---

## Kiến trúc

```
src/modules/
├── auth/
│   ├── dto/                    # Data Transfer Objects
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   ├── auth-response.dto.ts
│   │   └── user-response.dto.ts
│   ├── guards/                 # Guards bảo vệ endpoints
│   │   ├── jwt-auth.guard.ts   # Guard access token
│   │   └── jwt-refresh.guard.ts
│   ├── strategies/             # Passport strategies
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   ├── auth.controller.ts      # REST endpoints
│   ├── auth.service.ts         # Business logic
│   └── auth.module.ts
├── users/
│   ├── entities/
│   │   └── user.entity.ts      # User entity với TypeORM
│   ├── users.service.ts
│   └── users.module.ts
└── common/
    └── decorators/
        ├── public.decorator.ts      # @Public() decorator
        └── current-user.decorator.ts # @CurrentUser() decorator
```

---

## API Endpoints

### 1. Đăng ký tài khoản - `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "fullName": "Nguyễn Văn A"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Nguyễn Văn A",
      "role": "user"
    }
  }
}
```

**Lưu ý:**
- Password tối thiểu 6 ký tự
- Email phải unique
- Response bao gồm cả tokens và thông tin user
- Web client: Tokens được set vào cookies tự động
- Mobile client: Lưu tokens từ response body

---

### 2. Đăng nhập - `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Nguyễn Văn A",
      "role": "user"
    }
  }
}
```

---

### 3. Đăng xuất - `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "message": "Đăng xuất thành công"
  }
}
```

**Chức năng:**
- Xóa refresh token khỏi database
- Clear cookies (web client)
- Mobile client: Tự xóa tokens local

---

### 4. Làm mới token - `POST /api/auth/refresh`

**Cách 1: Mobile (Bearer token)**
```
Authorization: Bearer {refreshToken}
```

**Cách 2: Web (Cookie)**
Cookies tự động gửi kèm request

**Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

### 5. Lấy thông tin user hiện tại - `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Hướng dẫn sử dụng

### A. Web Client (React/Vue/Angular)

#### 1. Đăng ký/Đăng nhập
```javascript
// Đăng nhập
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ⚠️ BẮT BUỘC để gửi/nhận cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});

const data = await response.json();
// Cookies đã được set tự động, không cần lưu tokens thủ công
```

#### 2. Gọi API có xác thực
```javascript
// Cookies tự động gửi kèm nếu có credentials: 'include'
const response = await fetch('http://localhost:3000/api/auth/me', {
  credentials: 'include'
});
```

#### 3. Làm mới token (tự động khi access token hết hạn)
```javascript
const response = await fetch('http://localhost:3000/api/auth/refresh', {
  method: 'POST',
  credentials: 'include'
});
```

---

### B. Mobile Client (React Native/Flutter)

#### 1. Đăng ký/Đăng nhập
```javascript
// React Native example
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});

const { data } = await response.json();
const { accessToken, refreshToken } = data;

// Lưu tokens vào AsyncStorage hoặc SecureStore
await AsyncStorage.setItem('accessToken', accessToken);
await AsyncStorage.setItem('refreshToken', refreshToken);
```

#### 2. Gọi API có xác thực
```javascript
const accessToken = await AsyncStorage.getItem('accessToken');

const response = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 3. Làm mới token
```javascript
const refreshToken = await AsyncStorage.getItem('refreshToken');

const response = await fetch('http://localhost:3000/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${refreshToken}`
  }
});

const { data } = await response.json();
await AsyncStorage.setItem('accessToken', data.accessToken);
await AsyncStorage.setItem('refreshToken', data.refreshToken);
```

---

## Bảo mật Endpoints

### Global Authentication (Default)
Tất cả endpoints **mặc định yêu cầu xác thực** (JWT Guard global).

### Public Endpoints (Không cần đăng nhập)
Sử dụng decorator `@Public()`:

```typescript
import { Public } from '@/common/decorators/public.decorator';

@Controller('documents')
export class DocumentsController {
  @Public() // ← Endpoint này không cần đăng nhập
  @Get()
  findAll() {
    return this.documentsService.findAll();
  }
}
```

### Lấy thông tin user trong Controller

```typescript
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('documents')
export class DocumentsController {
  @Post('upload')
  upload(@CurrentUser() user: any, @UploadedFile() file) {
    console.log(user.userId);  // UUID của user
    console.log(user.email);   // Email
    console.log(user.role);    // Role (user/admin)
    // ...
  }
}
```

---

## Cấu hình

### 1. Environment Variables (.env)

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_REFRESH_EXPIRES_IN=7d

# CORS (cho web client)
CORS_ORIGIN=http://localhost:3000

# Node Environment
NODE_ENV=development
```

⚠️ **LƯU Ý:**
- Đổi `JWT_SECRET` và `JWT_REFRESH_SECRET` trong production
- Sử dụng secrets dài, phức tạp (ít nhất 32 ký tự)
- Enable `NODE_ENV=production` khi deploy

---

### 2. CORS Setup (main.ts)

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Cho phép cookies
});
```

Điều chỉnh `CORS_ORIGIN` theo domain frontend của bạn.

---

## Cơ chế bảo mật

### 1. Password Hashing
- Sử dụng **Argon2id** (winner của Password Hashing Competition)
- Tham số: memoryCost=64MB, timeCost=3, parallelism=1
- Khuyến nghị OWASP 2024

### 2. JWT Security
- Access token: 15 phút (ngắn để giảm thiểu rủi ro)
- Refresh token: 7 ngày (lưu hash trong DB)
- Algorithm: HS256 (có thể chuyển sang RS256)

### 3. Cookie Security (Web)
```typescript
{
  httpOnly: true,        // Chặn XSS (JavaScript không đọc được)
  secure: true,          // Chỉ gửi qua HTTPS (production)
  sameSite: 'strict',    // Chặn CSRF
  maxAge: 15 * 60 * 1000 // 15 phút
}
```

### 4. Refresh Token Rotation
- Mỗi lần refresh → tạo cặp tokens mới
- Refresh token cũ bị vô hiệu hóa
- Chống token replay attacks

---

## Database Schema

### Users Table

```sql
CREATE TABLE `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') DEFAULT 'user',
  `refresh_token` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## Testing với Swagger

1. Mở Swagger UI: `http://localhost:3000/api/docs`
2. Đăng ký tài khoản qua **POST /api/auth/register**
3. Copy `accessToken` từ response
4. Click nút **Authorize** (🔒) ở góc phải trên
5. Nhập: `Bearer {accessToken}` (thay `{accessToken}` bằng token thực)
6. Click **Authorize** → **Close**
7. Giờ có thể test các protected endpoints (có icon 🔒)

---

## Xử lý lỗi

### Error Responses

| Status | Message | Nguyên nhân |
|--------|---------|-------------|
| 400 | Dữ liệu không hợp lệ | DTO validation fail |
| 401 | Email hoặc mật khẩu không đúng | Sai thông tin đăng nhập |
| 401 | Access Denied | Refresh token không hợp lệ |
| 409 | Email đã được sử dụng | Email trùng khi đăng ký |

**Format:**
```json
{
  "statusCode": 401,
  "message": "Email hoặc mật khẩu không đúng",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login"
}
```

---

## Best Practices

### 1. Token Storage
- **Web**: Dùng httpOnly cookies (bảo mật hơn localStorage)
- **Mobile**: SecureStore/Keychain (KHÔNG dùng AsyncStorage cho tokens)

### 2. Token Expiration Handling
```javascript
// Interceptor tự động refresh token (Axios example)
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token hết hạn → refresh
      const newTokens = await refreshTokens();
      // Retry request với token mới
      error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 3. Logout
- Luôn gọi endpoint `/logout` để xóa refresh token
- Clear tokens ở client-side
- Redirect về trang login

---

## Roadmap

### Tính năng sắp tới:
- [ ] Email verification
- [ ] Password reset (forgot password)
- [ ] Two-Factor Authentication (2FA)
- [ ] OAuth2 (Google, Facebook login)
- [ ] Rate limiting cho login attempts
- [ ] Account lockout sau nhiều lần sai password
- [ ] Audit logs (theo dõi hoạt động user)

---

## Troubleshooting

### Lỗi CORS khi gọi từ web
```
Access to fetch at 'http://localhost:3000/api/auth/login' from origin
'http://localhost:5173' has been blocked by CORS policy
```

**Giải pháp:**
- Thêm origin vào `.env`: `CORS_ORIGIN=http://localhost:5173`
- Đảm bảo `credentials: 'include'` trong fetch options

### Lỗi "Invalid token" khi gọi API
**Nguyên nhân:**
- Token hết hạn
- Token format sai (thiếu "Bearer ")
- JWT_SECRET đã thay đổi

**Giải pháp:**
- Refresh token
- Kiểm tra format: `Authorization: Bearer {token}`
- Restart server nếu đổi JWT_SECRET

### Cookie không được set (web)
**Nguyên nhân:**
- Thiếu `credentials: 'include'` ở client
- CORS origin không khớp
- Secure flag = true nhưng dùng HTTP (chỉ production)

**Giải pháp:**
- Thêm `credentials: 'include'` trong fetch
- Kiểm tra CORS_ORIGIN
- Development: Đảm bảo `NODE_ENV=development`

---

## Liên hệ & Hỗ trợ

📧 Email: your-email@example.com
📘 Documentation: [Swagger UI](http://localhost:3000/api/docs)
🐛 Issues: GitHub Issues

---

**Develop by Review System Team** 🚀
