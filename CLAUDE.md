# Review System - NestJS Backend

## Project Overview

Hệ thống Review System: Từ tài liệu PDF, tạo ra bộ câu hỏi, đề thi, flashcard phục vụ ôn tập.

**Stack**: NestJS + TypeORM + MySQL (Laragon) + class-validator + Swagger

---

## Architecture Rules (P0 - CRITICAL)

### Module Structure
- **Feature Modules**: Mỗi domain một module (Auth, Documents, Questions, Exams, Flashcards)
- **Core Module**: Config, Database, Global filters/guards/interceptors
- **Shared Module**: Utils, decorators, common DTOs
- Kiểm tra circular dependencies bằng `madge`

### Controllers & Services
- **Controllers**: Chỉ parse request + trả response. KHÔNG chứa business logic
- **Services**: Chứa toàn bộ business logic. Stateless, Singleton scope
- **Repository Pattern**: Services gọi Repositories, KHÔNG raw SQL
- Custom decorators thay vì `@Request() req` → dùng `@CurrentUser()`

### DTOs & Validation
- `whitelist: true` + `forbidNonWhitelisted: true` trong ValidationPipe
- `transform: true` để auto-convert primitives
- `@ValidateNested()` + `@Type()` cho nested objects
- KHÔNG bao giờ return raw entity → map sang Response DTO
- Dùng `ParseIntPipe`, `ParseUUIDPipe` cho route params

### Config
- Dùng `@nestjs/config` với `ConfigModule.forRoot({ isGlobal: true })`
- Validate env vars bằng Joi tại startup → crash nếu thiếu
- KHÔNG dùng `process.env` trực tiếp
- Khi thêm env var mới → update `env.validation.ts` + `.env.example`

---

## API Standards (P1)

### Response Format
- Wrap response trong `{ statusCode, data, meta }` qua `TransformInterceptor`
- Pagination: `PageOptionsDto` (page/take/order) + `PageDto<T>` (data/meta)
- Error response: `{ statusCode, message, error, timestamp, path }`

### Swagger Documentation
- Dùng Nest CLI Plugin (`@nestjs/swagger/plugin`) trong `nest-cli.json`
- `@ApiTags()` trên mọi controller
- `@ApiResponse({ status, type })` trên mọi endpoint
- Disable `/docs` trong production

---

## Database (P0 - MySQL/TypeORM)

### Setup
- `TypeOrmModule.forRootAsync` load từ `ConfigService`
- `synchronize: false` trong production → dùng migrations
- Khi modify entity → PHẢI generate migration

### Best Practices
- Pagination bắt buộc cho mọi list endpoint
- Index cho frequently filtered columns
- Transactions (`QueryRunner`) cho multi-step mutations
- KHÔNG return raw entity → map sang DTO

---

## Security (P0 - CRITICAL)

### Authentication
- JWT với `@nestjs/passport` + `passport-jwt`
- Algorithm: RS256 hoặc HS256, REJECT `none`
- Access token: 15 phút, Refresh token: 7 ngày (httpOnly cookie)

### Authorization
- `AuthGuard` bind globally (APP_GUARD), deny by default
- `@Public()` decorator cho open routes
- RBAC với `Reflector.getAllAndOverride`

### Hardening
- Helmet: bật HSTS, CSP
- CORS: explicit origins, KHÔNG dùng `*`
- Rate limiting: `@nestjs/throttler`
- ValidationPipe `whitelist: true` chống mass assignment

### Cryptography
- Hashing: **Argon2id** (KHÔNG dùng Bcrypt)
- Encryption: **AES-256-GCM**

---

## Error Handling (P1)

### Flow
1. **Service** throw domain errors
2. **Interceptor** map sang HttpException
3. **Global Filter** format JSON response

### Rules
- Dùng `HttpAdapterHost` (platform agnostic), KHÔNG import Express types
- KHÔNG expose stack traces trong production
- Logger: `error` cho 500s (kèm stack trace), `warn` cho 400s

---

## File Uploads (P0 - PDF Processing)

- Verify magic bytes bằng `file-type`, KHÔNG trust `content-type` header
- Set `limits: { fileSize }` trong Multer config
- File > 10MB → dùng streaming hoặc signed URL
- Processing async: Upload → push event to Queue → Worker xử lý

---

## Testing (P2)

### Unit Tests
- `Test.createTestingModule()` với mocked providers
- Pattern: AAA (Arrange-Act-Assert)
- `jest.clearAllMocks()` trong `afterEach`

### E2E Tests
- Dùng real test DB, KHÔNG mock DB
- Cleanup: transaction rollback hoặc TRUNCATE
- Override guards: `.overrideGuard(X).useValue({ canActivate: () => true })`

### Strict TypeScript
- KHÔNG dùng `any` → dùng `jest.Mocked<T>`
- KHÔNG dùng `eslint-disable`
- Verify DTO shapes trước khi viết mock data

---

## Observability (P1)

- Dùng `nestjs-pino` cho structured JSON logging
- KHÔNG dùng `console.log`
- Redact sensitive fields: password, token, email
- Request ID (`reqId`) bắt buộc trong mọi log line
- Health checks: `/health/liveness` + `/health/readiness`

---

## Performance (P1)

- Default SINGLETON scope, TRÁNH REQUEST scope
- Compression: Gzip/Brotli
- KHÔNG block HTTP request cho long-running tasks → dùng Queue
- `select: []` để fetch only needed columns
- Tránh N+1 queries

---

## Caching (P1)

- `cache-manager` + `cache-manager-redis-yet`
- Multi-level: L1 (in-memory/lru-cache) + L2 (Redis)
- TTL jitter (±10s) chống stampede
- KHÔNG dùng `KEYS` command trong production

---

## Queue Processing - BullMQ (P1)

- Dùng cho: PDF processing, email, heavy computation
- Pattern: Producer (Controller) → Queue → Consumer (Processor)
- Always try-catch trong processors
- DB state persist trước khi queue.add()

---

## Scheduling (P1)

- `@Cron()` + distributed locking (Redis) nếu multi-instance
- KHÔNG xử lý nặng trong cron handler → push to BullMQ
- LUÔN wrap cron logic trong try/catch

---

## Skills Reference

Chi tiết từng skill nằm trong `.claude/skills/nestjs-*/SKILL.md`:

| Skill | Priority | Mô tả |
|-------|----------|-------|
| nestjs-architecture | P0 | Module structure, DI patterns |
| nestjs-controllers-services | P0 | Layer separation, decorators |
| nestjs-database | P0 | TypeORM, migrations, repository pattern |
| nestjs-security | P0 | JWT, RBAC, hardening |
| nestjs-file-uploads | P0 | PDF upload, validation, streaming |
| nestjs-api-standards | P1 | Response wrapper, pagination |
| nestjs-error-handling | P1 | Global filters, error flow |
| nestjs-configuration | P1 | Env validation, ConfigModule |
| nestjs-caching | P1 | Redis, multi-level cache |
| nestjs-bullmq | P1 | Queue processing |
| nestjs-observability | P1 | Logging, metrics, health checks |
| nestjs-performance | P1 | Optimization, profiling |
| nestjs-scheduling | P1 | Cron, distributed locking |
| nestjs-real-time | P1 | WebSocket, SSE |
| nestjs-search | P1 | Full-text search |
| nestjs-transport | P0 | gRPC, RabbitMQ |
| nestjs-notification | P0 | Push, FCM |
| nestjs-deployment | P1 | Docker, graceful shutdown |
| nestjs-documentation | P2 | Swagger, OpenAPI |
| nestjs-testing | P2 | Unit, E2E tests |
| nestjs-security-isolation | P0 | Multi-tenant, RLS |
