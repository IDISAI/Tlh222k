# Bắt đầu với lh222k

> **⚠️ Lưu ý:** Hướng dẫn này mô tả setup đầy đủ hệ thống target (Docker, PostgreSQL, NestJS api-gateway). **Trạng thái hiện tại:** chỉ cần Node ≥ 20, pnpm, và `git clone --recurse-submodules`. Bỏ qua các bước Docker/database.
>
> **Quick start thực tế:**
> ```bash
> git clone --recurse-submodules <repo-url>
> cd lh222k
> pnpm install
> pnpm dev   # web :3000, admin :3002, super-admin :3003
> ```

Hướng dẫn này đưa bạn từ zero đến một môi trường local đang chạy đầy đủ — ba service, database có dữ liệu demo, và admin panel sẵn sàng để khám phá.

**Thời gian ước tính:** 15–20 phút (lần đầu tiên)

---

## Mục lục

1. [Yêu cầu trước khi bắt đầu](#1-yêu-cầu-trước-khi-bắt-đầu)
2. [Clone repository](#2-clone-repository)
3. [Cài đặt dependencies](#3-cài-đặt-dependencies)
4. [Khởi động PostgreSQL](#4-khởi-động-postgresql)
5. [Thiết lập file môi trường](#5-thiết-lập-file-môi-trường)
6. [Khởi tạo database](#6-khởi-tạo-database)
7. [Chạy tất cả service](#7-chạy-tất-cả-service)
8. [Xác minh và khám phá](#8-xác-minh-và-khám-phá)
9. [Khởi động lại nhanh (các ngày sau)](#9-khởi-động-lại-nhanh-các-ngày-sau)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)

---

## 1. Yêu cầu trước khi bắt đầu

Cài đặt các công cụ sau trước khi tiếp tục:

| Công cụ        | Phiên bản tối thiểu | Link cài đặt                                                                          |
| -------------- | ------------------- | ------------------------------------------------------------------------------------- |
| Node.js        | 20+                 | [nodejs.org](https://nodejs.org)                                                      |
| pnpm           | 10+                 | `npm install -g pnpm`                                                                 |
| Docker Desktop | mới nhất            | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Git            | bất kỳ              | [git-scm.com](https://git-scm.com)                                                    |

Kiểm tra tất cả công cụ đã được cài đúng phiên bản:

```bash
node -v
pnpm -v
docker -v
git --version
```

Kết quả mong đợi:

```
v20.17.0      # hoặc cao hơn
10.30.2       # hoặc cao hơn
Docker version 27.x.x, build ...
git version 2.x.x
```

> **Windows:** Đảm bảo Docker Desktop đang chạy (biểu tượng cá voi trong system tray) trước khi tiếp tục.

---

## 2. Clone repository

Dự án dùng SSH để authenticate với GitHub. Chọn một trong hai cách:

### Cách A — SSH (khuyên dùng, cần SSH key đã thêm vào GitHub)

```bash
git clone git@github.com:AIVIETNAM-AIO-HUYTRUONG/lh222k.git
cd lh222k
```

### Cách B — HTTPS (dùng khi chưa có SSH key)

```bash
git clone https://github.com/AIVIETNAM-AIO-HUYTRUONG/lh222k.git
cd lh222k
```

> **Chưa có SSH key?** Xem hướng dẫn tạo SSH key tại [docs.github.com/en/authentication/connecting-to-github-with-ssh](https://docs.github.com/en/authentication/connecting-to-github-with-ssh). Với người mới, HTTPS đơn giản hơn để bắt đầu.

---

## 3. Cài đặt dependencies

Từ thư mục gốc của repo:

```bash
pnpm install
```

pnpm cài packages cho toàn bộ monorepo (tất cả apps và packages) trong một lệnh duy nhất. Lần đầu mất khoảng 1–2 phút tùy tốc độ mạng.

Kết quả mong đợi (dòng cuối cùng):

```
Done in 45.3s
```

---

## 4. Khởi động PostgreSQL

lh222k dùng PostgreSQL 16 chạy trong Docker container:

```bash
docker compose up -d postgres
```

Cờ `-d` (detach) giúp container chạy nền — terminal của bạn không bị chiếm.

Xác nhận container đang chạy:

```bash
docker compose ps
```

Kết quả mong đợi:

```
NAME       IMAGE                COMMAND                  SERVICE    CREATED         STATUS         PORTS
postgres   postgres:16-alpine   "docker-entrypoint.s…"   postgres   5 seconds ago   Up 4 seconds   0.0.0.0:5432->5432/tcp
```

Cột `STATUS` phải là `Up`. Nếu thấy `Exit` hoặc `Restarting`, xem phần [Xử lý lỗi](#11-xử-lý-lỗi-thường-gặp).

**Thông tin kết nối database:**

- Host: `localhost:5432`
- User: `vizteck`
- Password: `vizteck`
- Database: `lh222k`

---

## 5. Thiết lập file môi trường

Repo hiện chưa có file `.env.example` được commit. Tạo thủ công các file `.env` cho từng app:

### apps/api-gateway — tạo file `apps/api-gateway/.env`

```env
DATABASE_URL=postgresql://vizteck:vizteck@localhost:5432/lh222k
ADMIN_TOKEN=supersecret
PORT=3000
```

### apps/web — tạo file `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### apps/admin — tạo file `apps/admin/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

> **Lưu ý:** Next.js apps dùng `.env.local` (không phải `.env`). NestJS app (`api-gateway`) dùng `.env`. Các giá trị mặc định trên hoạt động ngay với môi trường local — không cần chỉnh sửa.

---

## 6. Khởi tạo database

### 6a. Đẩy schema Prisma lên database

```bash
DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/lh222k" pnpm --filter @vizteck/db db:push
```

Lệnh này tạo toàn bộ bảng theo schema Prisma mà không tạo migration file (phù hợp cho môi trường dev).

Kết quả mong đợi:

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "lh222k", schema "public" at "localhost:5432"

Your database is now in sync with your Prisma schema. Done in 842ms
```

### 6b. Seed dữ liệu demo

```bash
DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/lh222k" pnpm --filter @vizteck/db db:seed
```

Script seed tạo 3 roadmap mẫu: **Frontend Developer**, **Backend Developer**, và **Fullstack Developer** (với 2 nodes liên kết đến 2 roadmap kia).

Kết quả mong đợi:

```
Seed complete.
```

> **Windows PowerShell:** Cú pháp `KEY=value command` không hoạt động trên PowerShell gốc. Dùng Git Bash (đi kèm với Git for Windows) hoặc WSL để chạy lệnh trên. Ngoài ra, bạn có thể tạo file `.env` trong `packages/db/` với nội dung `DATABASE_URL=postgresql://vizteck:vizteck@localhost:5432/lh222k` rồi chạy `pnpm --filter @vizteck/db db:push` mà không cần prefix.

---

## 7. Chạy tất cả service

Từ thư mục gốc của repo:

```bash
pnpm dev
```

Turborepo khởi động cả ba service theo thứ tự dependency (database package → api-gateway → web + admin).

**Chờ đến khi thấy đủ 3 dòng này** (có thể mất 30–60 giây lần đầu):

```
api-gateway  | [NestJS] Application is running on: http://[::1]:3000
web          | ▲ Next.js 15 ready on http://localhost:3001
admin        | ▲ Next.js 15 ready on http://localhost:3002
```

> **Thứ tự xuất hiện** có thể khác nhau mỗi lần — không cần lo lắng miễn là cả 3 dòng đều xuất hiện.

Giữ terminal này mở. Tất cả service sẽ tự động reload khi bạn sửa code (hot reload).

---

## 8. Xác minh và khám phá

### 8a. Kiểm tra từng service

Mở trình duyệt và truy cập từng URL sau:

| Service               | URL                            | Kết quả mong đợi                                                  |
| --------------------- | ------------------------------ | ----------------------------------------------------------------- |
| Public roadmap viewer | http://localhost:3001          | Trang danh sách roadmap (có thể trống nếu chưa có roadmap PUBLIC) |
| Admin CMS             | http://localhost:3002          | Chuyển hướng đến `/login`                                         |
| Swagger UI            | http://localhost:3000/api-docs | Tài liệu API tương tác                                            |
| GraphQL Playground    | http://localhost:3000/graphql  | Apollo Sandbox                                                    |

### 8b. Đăng nhập Admin Panel

1. Mở http://localhost:3002 — bạn sẽ tự động được chuyển đến `/login`
2. Nhập token: `supersecret`
3. Nhấn **Login**

Token này được định nghĩa trong `ADMIN_TOKEN` tại `apps/api-gateway/.env`. Trong môi trường production, hãy đổi giá trị này thành một chuỗi bí mật thực sự.

### 8c. Khám phá tính năng cơ bản

Sau khi đăng nhập thành công, thử các bước sau để kiểm tra hệ thống hoạt động đúng:

**Tạo Roadmap mới:**

1. Trong Admin CMS, nhấn **New Roadmap**
2. Nhập title (ví dụ: "My First Roadmap") và slug (ví dụ: "my-first-roadmap")
3. Nhấn **Create** — roadmap mới xuất hiện trong danh sách

**Mở Graph Editor:**

1. Nhấn vào roadmap vừa tạo
2. Bạn sẽ thấy canvas graph editor với NodeInventory ở bên trái
3. Kéo node từ NodeInventory vào canvas để thêm node

**Thêm Lesson Node:**

1. Trong graph editor, nhấn vào node `LESSON`
2. Một side panel sẽ mở ra — nhấn **Edit Lesson**
3. Bạn sẽ vào trang lesson editor với BlockNote rich text editor

**Publish roadmap để hiển thị trên public viewer:**

1. Quay lại danh sách roadmap
2. Nhấn nút cycle status để chuyển từ `DRAFT` → `PUBLIC`
3. Mở http://localhost:3001 — roadmap của bạn sẽ xuất hiện

---

## 9. Khởi động lại nhanh (các ngày sau)

Từ ngày thứ hai trở đi, bạn không cần thực hiện lại toàn bộ setup. Chỉ cần:

```bash
# 1. Khởi động Docker (nếu đã tắt máy)
docker compose up -d postgres

# 2. Chạy tất cả service
pnpm dev
```

Docker volume `postgres_data` được persistent — dữ liệu của bạn vẫn còn sau khi tắt container hoặc tắt máy.

**Khi nào cần chạy lại các bước khác:**

| Tình huống                            | Lệnh cần chạy                                        |
| ------------------------------------- | ---------------------------------------------------- |
| Thêm package mới vào monorepo         | `pnpm install`                                       |
| Thay đổi Prisma schema                | `DATABASE_URL=... pnpm --filter @vizteck/db db:push` |
| Reset toàn bộ database về dữ liệu gốc | `db:push` rồi `db:seed`                              |

---

## 10. Xử lý lỗi thường gặp

### `docker compose up -d postgres` thất bại

**Nguyên nhân:** Docker Desktop chưa chạy.

**Cách sửa:** Mở Docker Desktop từ Start Menu (Windows) hoặc Applications (Mac), chờ biểu tượng cá voi ổn định trong system tray, rồi thử lại.

---

### PostgreSQL container ở trạng thái `Restarting` hoặc `Exit`

**Kiểm tra logs:**

```bash
docker compose logs postgres
```

**Nguyên nhân phổ biến:** Port 5432 đã bị chiếm bởi một instance PostgreSQL khác (ví dụ: PostgreSQL cài trực tiếp trên máy).

**Cách sửa:**

```bash
# Tắt PostgreSQL local (Windows)
net stop postgresql-x64-16

# Sau đó thử lại
docker compose up -d postgres
```

---

### `pnpm install` lỗi peer dependency

```bash
pnpm install --no-strict-peer-dependencies
```

---

### `db:push` lỗi "Connection refused" hoặc "ECONNREFUSED"

Database chưa sẵn sàng. Đợi 5–10 giây sau khi chạy `docker compose up -d postgres`, rồi thử lại.

Xác nhận database đang chạy trước:

```bash
docker compose ps
# STATUS phải là "Up"
```

---

### Port đã bị chiếm (EADDRINUSE)

Tìm và tắt process đang chiếm port:

**Windows (PowerShell):**

```powershell
# Tìm PID đang dùng port 3000
netstat -ano | findstr :3000

# Tắt process theo PID
taskkill /PID <PID> /F
```

**Mac/Linux:**

```bash
lsof -ti:3000 | xargs kill
```

Thay `3000` bằng port thực tế bị lỗi (`3000`, `3001`, hoặc `3002`).

---

### Admin page trả về 404 dù file tồn tại (Turbopack cache cũ)

```bash
# Xóa cache .next của admin
rm -rf apps/admin/.next
# Hoặc trên Windows PowerShell:
Remove-Item -Recurse -Force apps\admin\.next
```

Sau đó khởi động lại `pnpm dev`.

---

### `pnpm dev` chỉ thấy output của một số service, không phải tất cả

Một service bị crash sớm. Cuộn lên tìm dòng có `ERROR` hoặc `Error`. Nguyên nhân phổ biến:

- File `.env` bị thiếu hoặc sai giá trị → kiểm tra lại [Bước 5](#5-thiết-lập-file-môi-trường)
- Database chưa có schema → chạy lại [Bước 6a](#6a-đẩy-schema-prisma-lên-database)

---

### Windows PowerShell: `KEY=value command` không chạy được

PowerShell không hỗ trợ cú pháp `KEY=value cmd` của bash. Dùng một trong các cách sau:

**Cách 1:** Dùng Git Bash (đi kèm Git for Windows):

```bash
# Mở Git Bash thay vì PowerShell, rồi chạy lệnh bình thường
DATABASE_URL="postgresql://vizteck:vizteck@localhost:5432/lh222k" pnpm --filter @vizteck/db db:push
```

**Cách 2:** Set biến môi trường tạm thời trong PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://vizteck:vizteck@localhost:5432/lh222k"
pnpm --filter @vizteck/db db:push
pnpm --filter @vizteck/db db:seed
```

**Cách 3:** Tạo file `packages/db/.env` với nội dung:

```env
DATABASE_URL=postgresql://vizteck:vizteck@localhost:5432/lh222k
```

Rồi chạy lệnh không cần prefix biến môi trường.

---

## Tiếp theo

Sau khi môi trường local đang chạy, đọc thêm:

- **[Tổng quan kiến trúc](./architecture.md)** — hiểu ba service kết nối với nhau như thế nào
- **[Quy trình làm việc hàng ngày](./daily-workflow.md)** — GitFlow, commit format, cách tạo branch đúng
- **[Cheat Sheet](./cheatsheet.md)** — tất cả lệnh quan trọng trong một trang
- **[CI/CD](./cicd.md)** — CI pipeline, deploy staging/production
