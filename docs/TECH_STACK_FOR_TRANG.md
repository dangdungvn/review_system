# Tổng hợp công nghệ dự án Review System

Tài liệu này dùng để gửi cho Trang. Mục tiêu là giải thích đơn giản các công nghệ đang dùng trong repo, đồng thời bổ sung thêm một số kỹ thuật AI có thể đưa vào hệ thống.

## 1. Tổng quan hệ thống

Review System là backend cho một ứng dụng học tập từ tài liệu PDF. Người dùng có thể upload tài liệu, hệ thống trích xuất nội dung, sau đó dùng AI để tạo các nội dung học tập như:

- Tóm tắt tài liệu.
- Bộ câu hỏi trắc nghiệm.
- Flashcard.
- Câu hỏi đúng/sai.
- Theo dõi tiến độ học tập và gợi ý nội dung nên ôn tiếp.

Nói ngắn gọn: đây là hệ thống biến tài liệu học tập thành bài ôn tập và bài kiểm tra bằng AI.

## 2. Công nghệ backend

### NestJS

Repo đang dùng NestJS, một framework Node.js viết bằng TypeScript. NestJS giúp chia backend thành các module rõ ràng như `auth`, `documents`, `ai`, `exams`, `flashcards`, `assessment`, `admin`.

Lợi ích:

- Code dễ chia lớp: controller, service, entity, dto.
- Dễ mở rộng thêm module mới.
- Phù hợp làm API backend lớn hơn một Express app thông thường.

### TypeScript

Dự án viết bằng TypeScript. TypeScript giúp code rõ kiểu dữ liệu hơn JavaScript, giảm lỗi khi truyền sai object, sai field hoặc sai kiểu dữ liệu.

### REST API

Backend expose API theo dạng REST. Trong `main.ts`, hệ thống đặt global prefix là `/api`, nghĩa là các endpoint sẽ nằm dưới đường dẫn `/api/...`.

### Swagger / OpenAPI

Hệ thống có Swagger tại `/api/docs`. Swagger giúp xem danh sách API, test API trực tiếp và hiểu API cần truyền body/header gì.

### CORS

Backend có cấu hình CORS để frontend từ domain khác có thể gọi API. Hiện tại CORS đọc từ biến môi trường `CORS_ORIGIN`, phù hợp khi cần allow localhost, ngrok hoặc Vercel.

## 3. Cơ sở dữ liệu

### MySQL

Repo đang dùng MySQL làm database chính. Các thông tin kết nối nằm trong `.env`, ví dụ:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`

### TypeORM

TypeORM được dùng để kết nối NestJS với MySQL. Các bảng được mô tả bằng entity trong code, ví dụ user, document, exam, flashcard, summary, AI log và các bảng assessment.

Lợi ích:

- Làm việc với database bằng object TypeScript.
- Có migration.
- Dễ query và liên kết dữ liệu giữa các module.

## 4. Xác thực và phân quyền

### JWT

Hệ thống dùng JWT cho đăng nhập. Khi user login thành công, backend sinh access token và refresh token.

- Access token dùng để gọi API cần đăng nhập.
- Refresh token dùng để xin cấp lại access token khi hết hạn.

### Passport JWT

Passport JWT được dùng để bảo vệ các API cần xác thực. Các guard như `JwtAuthGuard` và `JwtRefreshGuard` giúp kiểm tra token trước khi cho phép truy cập.

### Argon2id

Mật khẩu và refresh token được hash bằng Argon2id. Đây là cách hash mật khẩu an toàn hơn việc lưu mật khẩu dạng plain text.

## 5. Xử lý tài liệu

### Upload file với Multer

Hệ thống dùng Multer để upload file PDF vào thư mục `uploads`.

### MarkItDown

Sau khi upload PDF, backend dùng MarkItDown để chuyển PDF thành Markdown. Markdown sau đó được dùng làm đầu vào cho AI.

Nếu PDF là file scan/ảnh và không có text, hệ thống có thể không trích xuất được nội dung. Trường hợp đó có thể cần thêm OCR.

### pdf-parse

Repo có thư viện `pdf-parse`, phục vụ xử lý nội dung PDF trong Node.js khi cần.

## 6. AI đang dùng

### Google Gemini

Backend đang dùng `@google/generative-ai` để gọi Google Gemini. AI nhận nội dung tài liệu đã trích xuất và tạo ra JSON theo từng loại nội dung:

- Đề trắc nghiệm.
- Flashcard.
- Tóm tắt.
- Câu hỏi đúng/sai.

Model mặc định trong code là `gemini-3-flash-preview`, có thể cấu hình lại qua database hoặc biến môi trường.

### Prompt riêng cho từng tác vụ

Repo có các file prompt riêng:

- `exam.prompt.ts`
- `flashcard.prompt.ts`
- `summary.prompt.ts`
- `true-false.prompt.ts`

Mỗi prompt quy định AI phải trả về nội dung theo format nào. Cách này giúp đầu ra ổn định hơn, dễ parse thành JSON và lưu database.

### AI Generation Log

Hệ thống có log cho mỗi lần gọi AI, gồm:

- Loại nội dung cần tạo.
- Model đã dùng.
- Số ký tự đầu vào.
- Số ký tự bị cắt nếu tài liệu quá dài.
- Số ký tự đầu ra.
- Thời gian xử lý.
- Trạng thái thành công/thất bại.
- Lỗi parse JSON hoặc lỗi provider nếu có.

Phần này quan trọng cho admin theo dõi chi phí, chất lượng và lỗi khi AI sinh nội dung.

## 7. Assessment và cá nhân hóa học tập

Repo có module `assessment` để theo dõi năng lực và gợi ý học tập.

### Item Response Theory, viết tắt IRT

IRT là kỹ thuật ước lượng năng lực người học dựa trên câu trả lời đúng/sai và độ khó câu hỏi.

Giải thích đơn giản:

- Nếu user làm đúng câu khó, hệ thống tăng ước lượng năng lực.
- Nếu user làm sai câu dễ, hệ thống giảm ước lượng năng lực.
- Hệ thống có thể chọn câu hỏi vừa sức, không quá dễ và không quá khó.

Trong repo có service `item-response-theory.service.ts`.

### Bayesian Knowledge Tracing, viết tắt BKT

BKT dùng để ước tính xác suất user đã nắm vững một kỹ năng/kiến thức nào đó.

Giải thích đơn giản:

- Mỗi lần user trả lời, hệ thống cập nhật xác suất "đã hiểu bài".
- Nếu user đúng nhiều lần và tự tin, xác suất thành thạo tăng.
- Nếu user sai nhưng lại rất tự tin, hệ thống có thể xem như có hiểu nhầm.

Trong repo có service `bayesian-knowledge-tracing.service.ts`.

### Recommendation

Hệ thống có gợi ý học tập dựa trên:

- Kỹ năng yếu.
- Flashcard cần ôn lại.
- Bài mới phù hợp với năng lực hiện tại.
- Bài điểm thấp nên làm lại.

Đây là nền tảng cho cá nhân hóa lộ trình học tập.

## 8. Admin và quản trị AI

Repo có module `admin`, trong đó có các service liên quan đến:

- Quản lý user.
- Quản lý tài liệu.
- Dashboard.
- Theo dõi nội dung AI tạo ra.
- Cấu hình API key, model, số câu hỏi và prompt.

AI key có thể lưu trong database và được mã hóa bằng AES-256-GCM. Nếu database không có key, hệ thống lấy key từ `.env`.

## 9. Công cụ dev và kiểm thử

### Jest

Dùng để viết và chạy test.

### Supertest

Dùng cho e2e test API.

### ESLint và Prettier

Dùng để giữ code sạch, đúng convention và format thống nhất.

### Nest CLI

Dùng để build, start và generate code theo chuẩn NestJS.

## 10. Hệ thống skill.md

Đây là phần có thể bổ sung vào hệ thống.

`skill.md` có thể hiểu là một bộ hướng dẫn riêng cho AI khi làm một nhóm việc cụ thể. Thay vì chỉ nói chung chung "hãy phân tích repo", ta có thể viết một file `SKILL.md` quy định rõ:

- AI cần đọc những file nào.
- Cần phân tích theo các bước nào.
- Đầu ra phải có format gì.
- Cần review chất lượng ra sao.
- Khi gặp lỗi thì xử lý thế nào.

Ví dụ trong repo có skill `understand`, mục tiêu là phân tích codebase và tạo knowledge graph. Ý tưởng tương tự có thể áp dụng cho các tác vụ khác:

- Skill tạo đề thi.
- Skill review chất lượng câu hỏi.
- Skill tóm tắt tài liệu.
- Skill sinh flashcard.
- Skill kiểm tra độ khó và phân bổ câu hỏi.

Giải thích đơn giản: `skill.md` là "quy trình làm việc" viết bằng Markdown để AI làm theo, giúp đầu ra ổn định và dễ kiểm soát hơn.

## 11. RAG

RAG là viết tắt của Retrieval-Augmented Generation. Đây là kỹ thuật cho AI tìm lại nội dung liên quan trước, sau đó mới sinh câu trả lời hoặc sinh bài tập.

Giải thích đơn giản:

1. Cắt tài liệu thành các đoạn nhỏ.
2. Khi cần tạo câu hỏi hoặc trả lời, hệ thống tìm các đoạn liên quan nhất.
3. Đưa các đoạn đó vào prompt cho AI.
4. AI chỉ tạo nội dung dựa trên phần tài liệu đã tìm được.

Lợi ích:

- Giảm việc AI nói sai nội dung.
- Câu hỏi bám sát tài liệu hơn.
- Có thể dẫn nguồn: câu hỏi này lấy từ đoạn nào trong tài liệu.
- Phù hợp khi tài liệu dài hơn giới hạn context của model.

Loại RAG dễ thêm vào hệ thống này:

- Lightweight RAG: cắt Markdown thành chunk, tìm kiếm bằng từ khóa hoặc full-text search trong MySQL. Cách này dễ làm, chưa cần vector database ngay.
- Vector RAG: tạo embedding cho từng chunk và tìm kiếm bằng vector similarity. Cách này tốt hơn cho tìm kiếm ngữ nghĩa, ví dụ user hỏi khác từ nhưng cùng ý.
- Hybrid RAG: kết hợp keyword search và vector search. Cách này thường cho kết quả ổn định nhất.

Để bắt đầu nhanh, có thể dùng Lightweight RAG trước. Sau này nếu tài liệu nhiều và cần tìm ngữ nghĩa tốt hơn thì nâng lên Vector RAG hoặc Hybrid RAG.

## 12. AI review đầu ra theo tiêu chí

Kỹ thuật anh đang nói đến thường gọi là `LLM-as-a-Judge`, hoặc đơn giản hơn là `AI Evaluator`.

Giải thích đơn giản: sau khi một AI tạo câu hỏi/bài tập, dùng thêm một AI khác để chấm lại đầu ra theo rubric. Rubric là bảng tiêu chí đánh giá.

Ví dụ với đề thi sinh từ tài liệu, AI reviewer sẽ kiểm tra:

- Câu hỏi có đúng nội dung tài liệu không.
- Đáp án đúng có thật sự đúng không.
- Các đáp án sai có hợp lý không, không quá vô lý.
- Giải thích có rõ ràng không.
- Câu hỏi có bị trùng lặp không.
- Đề có đủ các mức độ không: làm quen, bình thường, khó.
- Chất lượng ngôn ngữ có tốt không.
- JSON có đúng format backend cần không.

Có thể chia bộ câu hỏi theo mức:

- Làm quen: câu hỏi dễ, giúp người học nhớ khái niệm cơ bản.
- Bình thường: câu hỏi yêu cầu hiểu và áp dụng trực tiếp.
- Khó: câu hỏi yêu cầu suy luận, so sánh, tổng hợp.
- Chất lượng cao: câu hỏi đúng, rõ, không mơ hồ, có giải thích tốt và bám sát tài liệu.

Để đưa vào hệ thống, flow có thể là:

1. AI Generator tạo đề thi/flashcard/tóm tắt.
2. AI Evaluator đọc lại đầu ra và chấm điểm theo rubric.
3. Nếu điểm đạt ngưỡng, lưu vào database.
4. Nếu chưa đạt, yêu cầu AI Generator sửa lại.
5. Lưu điểm review vào bảng log để admin theo dõi chất lượng.

Tên kỹ thuật nên ghi trong proposal:

- LLM-as-a-Judge.
- Rubric-based AI Evaluation.
- AI Output Quality Gate.

Trong đó, tên dễ hiểu nhất khi nói với người không quá kỹ thuật là: "AI review lại đầu ra theo bộ tiêu chí chất lượng".

## 13. Đề xuất kiến trúc AI hoàn chỉnh hơn

Một pipeline AI có thể thiết kế như sau:

1. Upload PDF.
2. Chuyển PDF sang Markdown bằng MarkItDown.
3. Chia Markdown thành các chunk nhỏ.
4. Dùng RAG để lấy đúng các chunk liên quan.
5. AI Generator tạo nội dung học tập.
6. AI Evaluator review theo rubric.
7. Nếu đạt chuẩn thì lưu database.
8. Nếu chưa đạt chuẩn thì cho AI sửa lại hoặc gắn cờ để admin review.
9. Khi user làm bài, module assessment dùng IRT/BKT để cập nhật năng lực.
10. Recommendation service gợi ý bài học tiếp theo.

## 14. Tóm tắt ngắn để gửi nhanh

Dự án hiện là backend NestJS + TypeScript, dùng MySQL và TypeORM để lưu dữ liệu. Hệ thống có JWT/Argon2id cho đăng nhập, Swagger cho API docs, Multer và MarkItDown để upload và chuyển PDF sang Markdown. Phần AI dùng Google Gemini để tạo tóm tắt, trắc nghiệm, flashcard và câu hỏi đúng/sai từ nội dung tài liệu. Ngoài ra repo đã có module assessment với IRT, BKT và recommendation để theo dõi năng lực và cá nhân hóa việc học.

Nên bổ sung thêm 3 kỹ thuật AI:

- `skill.md`: bộ quy trình Markdown để AI làm việc ổn định theo từng tác vụ.
- `RAG`: giúp AI tìm đúng nội dung trong tài liệu trước khi sinh câu hỏi/tóm tắt.
- `LLM-as-a-Judge`: dùng một AI reviewer chấm lại đầu ra theo rubric, đảm bảo có đủ mức làm quen, bình thường, khó và chất lượng cao.
