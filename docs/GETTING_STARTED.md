# MedusaJS Multi-Tenant: Getting Started & Operations Guide

Tài liệu này là hướng dẫn chính để **khởi tạo môi trường từ database trắng**, tạo Platform Admin và thực hiện các bước vận hành ban đầu cho hệ thống MedusaJS Multi-Tenant.

Hệ thống sử dụng PostgreSQL Row Level Security (RLS) để cô lập dữ liệu giữa các Tenant. Phần giải thích sâu về middleware, AsyncLocalStorage, PG hook, API, workflow và các quy tắc dành cho developer được tách riêng trong [`MULTI_TENANT_DOCS.md`](./MULTI_TENANT_DOCS.md).

---

## 1. Khởi tạo môi trường từ số 0

### Bước 1: Khởi động PostgreSQL và Redis

Tại thư mục gốc của project:

```bash
docker compose up -d
```

Có thể dùng `docker ps` để kiểm tra tên hoặc Container ID của PostgreSQL container. Giá trị này sẽ được dùng ở bước thiết lập database roles.

### Bước 2: Cài dependencies và cấu hình backend

```bash
cd apps/backend
npm install

# Tạo file .env nếu chưa có
cp .env.template .env

npm run build
```

### Bước 3: Thiết lập PostgreSQL roles cho RLS

Kiến trúc Multi-Tenant sử dụng các role riêng cho migration và runtime. Application phải chạy bằng tài khoản không có quyền bypass RLS.

Đảm bảo đang đứng tại `apps/backend`, sau đó chạy `src/scripts/setup-db-roles.sql` bằng PostgreSQL container.

#### Windows PowerShell

```powershell
Get-Content src/scripts/setup-db-roles.sql | docker exec -i <tên_container_postgres> psql -U postgres -d medusa_multi_tenant -v runtime_password="'runtime_password'"
```

#### Windows CMD

```cmd
docker exec -i <tên_container_postgres> psql -U postgres -d medusa_multi_tenant -v runtime_password="'runtime_password'" < src/scripts/setup-db-roles.sql
```

#### Ubuntu / Linux / macOS / Git Bash

```bash
docker exec -i <tên_container_postgres> psql -U postgres -d medusa_multi_tenant -v runtime_password="'runtime_password'" < src/scripts/setup-db-roles.sql
```

### Bước 4: Kiểm tra cấu hình database trong `.env`

Application và migration phải dùng hai connection string khác nhau:

```env
# Application runtime: tài khoản bị giới hạn, không bypass RLS
DATABASE_URL=postgres://runtime_role:runtime_password@localhost:6543/medusa_multi_tenant

# Database administration / migration
DATABASE_SUPER_URL=postgres://postgres:postgres@localhost:6543/medusa_multi_tenant
```

> Không chạy application bằng PostgreSQL superuser. Superuser có thể bypass RLS và làm mất cơ chế cô lập dữ liệu giữa các Tenant.

### Bước 5: Chạy database migrations

Migration cần quyền DDL nên chạy bằng `DATABASE_SUPER_URL`.

#### Windows PowerShell

```powershell
$env:DATABASE_URL=$env:DATABASE_SUPER_URL; npx medusa db:migrate
```

#### Windows CMD

```cmd
set DATABASE_URL=%DATABASE_SUPER_URL% && npx medusa db:migrate
```

#### Ubuntu / Linux / macOS / Git Bash

```bash
DATABASE_URL=$DATABASE_SUPER_URL npx medusa db:migrate
```

Nếu terminal không tự load biến từ `.env`, có thể truyền trực tiếp connection string cho tiến trình migrate.

#### Khi thêm Custom Module mới

Nếu Custom Module chưa có migration file, phải generate migration trước:

```bash
npx medusa db:generate <module-name>
```

Sau đó mới chạy `npx medusa db:migrate`.

### Bước 6: Tạo Platform Admin

#### 6.1. Tạo user

```bash
npx medusa user -e <địa-chỉ-email> -p <mật-khẩu>
```

#### 6.2. Khai báo email Platform Admin

Trong `apps/backend/.env`:

```env
PLATFORM_ADMIN_EMAIL=<địa-chỉ-email>
```

#### 6.3. Bootstrap quyền Platform Admin và dữ liệu mặc định

```bash
npx medusa exec ./src/scripts/bootstrap-platform-admin.ts
```

Script bootstrap sử dụng user được xác định bởi `PLATFORM_ADMIN_EMAIL`, cấp quyền Platform Admin và thiết lập Tenant/Store mặc định cho hệ thống.

### Bước 7: Seed dữ liệu UAT (tùy chọn)

Nếu cần dữ liệu mẫu cho môi trường Test/UAT, bao gồm Tenant A, Tenant B và Store Locator mẫu:

```bash
npx medusa exec ./src/scripts/seed-uat.ts
```

### Bước 8: Khởi động backend

```bash
npm run dev
```

Nếu gặp lỗi:

```text
FATAL: Backend process is running as a SUPERUSER. Row Level Security will be bypassed!
```

hãy đóng terminal hiện tại, mở terminal mới rồi chạy lại `npm run dev` để process đọc lại `DATABASE_URL` dành cho runtime từ `.env`.

---

## 2. Platform Admin: vận hành hệ thống

Platform Admin quản lý cấp nền tảng và tạo tài nguyên cho các Tenant.

1. Mở Medusa Admin UI, thường tại:

   ```text
   http://localhost:9000/app
   ```

2. Đăng nhập bằng tài khoản Platform Admin đã bootstrap.
3. Mở phần quản lý **Tenants** của project.
4. Chọn **Create Tenant** và nhập các thông tin cần thiết như tên Tenant, handle/domain và thông tin user sở hữu Tenant.
5. Workflow tạo Tenant sẽ tạo Tenant và gán `TenantMembership` cho user sở hữu với role phù hợp.

Chi tiết API và workflow xem tại [`MULTI_TENANT_DOCS.md`](./MULTI_TENANT_DOCS.md).

---

## 3. Tenant Admin: onboarding ban đầu

Sau khi được gán `TenantMembership`, Tenant Admin có thể đăng nhập và bắt đầu cấu hình dữ liệu của Tenant.

### Các bước ban đầu

1. Đăng nhập Admin UI bằng tài khoản Tenant Admin.
2. Tạo dữ liệu kinh doanh của Tenant như Product, Category, Promotion và các tài nguyên liên quan.
3. Tạo **Sales Channel** riêng của Tenant.
4. Tạo **Stock Location** riêng của Tenant.
5. Gán Product/Inventory vào Sales Channel và Stock Location tương ứng trước khi bắt đầu bán hàng.

`sales_channel` và `stock_location` được thiết kế là tài nguyên thuộc Tenant, không dùng chung giữa các Tenant.

Tenant Admin không cần tự thêm `tenant_id` vào các query nghiệp vụ; cơ chế phân giải Tenant Context và PostgreSQL RLS chịu trách nhiệm cô lập dữ liệu. Quy tắc kỹ thuật này được mô tả chi tiết trong tài liệu kiến trúc.

---

## 4. Tài liệu liên quan

- [`MULTI_TENANT_DOCS.md`](./MULTI_TENANT_DOCS.md): kiến trúc Multi-Tenant, Tenant Context, RLS hook, API, workflows, authorization và quy tắc dành cho developer.
