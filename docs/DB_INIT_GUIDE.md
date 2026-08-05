# Hướng Dẫn Khởi Tạo Cơ Sở Dữ Liệu Từ Số 0 (DB Init Guide)

Tài liệu này cung cấp các bước chính xác và tuần tự để thiết lập một cơ sở dữ liệu PostgreSQL hoàn toàn mới cho dự án Medusa Multi-Tenant, bao gồm việc tạo Roles, chạy Migrations và Seeding dữ liệu.

## Trình Tự Thực Hiện

### Bước 1: Khởi động môi trường Docker

Trước tiên, hãy đảm bảo PostgreSQL và Redis đang chạy thông qua Docker Compose ở thư mục gốc:

```bash
docker compose up -d
```

### Bước 2: Cài đặt dependencies, Cấu hình môi trường và Build

Di chuyển vào thư mục backend, cài đặt các gói NPM và tạo file cấu hình môi trường:

```bash
cd apps/backend
npm install

# Copy file mẫu thành file .env thực tế (nếu chưa có)
cp .env.template .env
```

Sau khi đã có file `.env`, hãy tiến hành build dự án:

```bash
npm run build
```

### Bước 3: Thiết lập Roles & Phân Quyền (PostgreSQL)

Kiến trúc Multi-Tenant sử dụng Row Level Security (RLS) nên đòi hỏi các Roles cụ thể (`migration_role`, `runtime_role`) để không bỏ qua (bypass) RLS khi ứng dụng chạy. 

Đầu tiên, gõ lệnh `docker ps` để lấy **Container ID** hoặc **Tên** của container PostgreSQL (ví dụ: `8996ce9f5cce` hoặc `postgres-1`). Đảm bảo bạn đang đứng ở thư mục `apps/backend`, sau đó chạy lệnh nạp file `setup-db-roles.sql` tương ứng với Terminal bạn đang sử dụng:

**▶ Dành cho Windows PowerShell:**
*(PowerShell không hỗ trợ dấu `<` nên phải dùng `Get-Content`)*
```powershell
Get-Content src/scripts/setup-db-roles.sql | docker exec -i <tên_container_postgres> psql -U postgres -d medusa_multi_tenant -v migration_password="'runtime_password'" -v runtime_password="'runtime_password'"
```

**▶ Dành cho Windows CMD (Command Prompt):**
```cmd
docker exec -i <tên_container_postgres> psql -U postgres -d medusa_multi_tenant -v migration_password="'runtime_password'" -v runtime_password="'runtime_password'" < src/scripts/setup-db-roles.sql
```

**▶ Dành cho Ubuntu / Linux / MacOS / Git Bash:**
```bash
docker exec -i <tên_container_postgres> psql -U postgres -d medusa_multi_tenant -v migration_password="'runtime_password'" -v runtime_password="'runtime_password'" < src/scripts/setup-db-roles.sql
```

> **⚠️ LƯU Ý QUAN TRỌNG VỀ BIẾN MÔI TRƯỜNG (.env)**
> Dự án này sử dụng 2 biến kết nối DB để bảo mật RLS. Hãy kiểm tra file `.env` của bạn chắc chắn có:
> - `DATABASE_URL=postgres://runtime_role:runtime_password@localhost:6543/medusa_multi_tenant` (Dùng để chạy app an toàn).
> - `DATABASE_SUPER_URL=postgres://postgres:postgres@localhost:6543/medusa_multi_tenant` (Dùng đặc quyền cao nhất để can thiệp hệ thống).

### Bước 4: Chạy Migrations (Tạo cấu trúc bảng)

Medusa cần tạo các bảng dữ liệu gốc. Vì lệnh Migration đòi hỏi quyền cao (tạo/sửa bảng), nếu `runtime_role` của bạn không có quyền DDL, hãy chạy lệnh migrate bằng quyền Super User.

Hãy chạy lệnh tương ứng với Terminal của bạn để tạm thời ghi đè biến `DATABASE_URL` (bằng giá trị của `DATABASE_SUPER_URL`) chỉ cho tiến trình migrate này:

**▶ Dành cho Windows PowerShell:**
```powershell
$env:DATABASE_URL=$env:DATABASE_SUPER_URL; npx medusa db:migrate
```

**▶ Dành cho Windows CMD (Command Prompt):**
```cmd
set DATABASE_URL=%DATABASE_SUPER_URL% && npx medusa db:migrate
```

**▶ Dành cho Ubuntu / Linux / MacOS / Git Bash:**
```bash
DATABASE_URL=$DATABASE_SUPER_URL npx medusa db:migrate
```

*(Mẹo nhỏ: Nếu Terminal của bạn không tự động đọc được biến từ file `.env`, bạn có thể copy trực tiếp chuỗi kết nối dán vào lệnh. Ví dụ trên Linux: `DATABASE_URL="postgres://postgres:postgres@localhost:6543/medusa_multi_tenant" npx medusa db:migrate`)*

> **📝 QUAN TRỌNG: Quy trình cho Custom Modules mới**
> Nếu bạn vừa viết thêm Custom Module mới mà chưa có file migration, bạn **PHẢI** chạy lệnh sinh file trước khi chạy lệnh migrate ở phía trên.
> Cú pháp sinh file: `npx medusa db:generate <module-name>`

### Bước 5: Khởi tạo tài khoản Platform Admin

Để hệ thống có thể quản lý các Tenant, bạn cần tạo một tài khoản người dùng có mật khẩu trước, sau đó mới chạy tập lệnh để cấp quyền quản trị (Platform Admin) cho tài khoản đó.

#### 1. Tạo tài khoản người dùng:
Chạy lệnh Medusa CLI sau để đăng ký một tài khoản mới vào cơ sở dữ liệu (hãy thay thế bằng email và mật khẩu bạn muốn sử dụng để đăng nhập):

```bash
npx medusa user -e <địa-chỉ-email> -p <mật-khẩu>
```

#### 2. Cấu hình biến môi trường:
Kiểm tra file `.env` (trong `apps/backend`) và đảm bảo biến `PLATFORM_ADMIN_EMAIL` khớp chính xác với email bạn vừa tạo ở trên:
```env
PLATFORM_ADMIN_EMAIL=<địa-chỉ-email>
```

#### 3. Khởi tạo quyền và Tenant mặc định:
Cuối cùng, chạy tập lệnh bootstrap. Tập lệnh này sẽ tìm tài khoản dựa trên email trong `.env`, tự động cấp quyền Platform Admin và thiết lập Store/Tenant mặc định cho hệ thống:
```bash
npx medusa exec ./src/scripts/bootstrap-platform-admin.ts
```

### Bước 6: (Tùy chọn) Chạy Seed Dữ Liệu UAT

Nếu bạn muốn có sẵn dữ liệu mẫu cho môi trường Test/UAT (bao gồm Tenant A, Tenant B cùng với các Store Locators mẫu), hãy chạy tập lệnh sau:

```bash
npx medusa exec ./src/scripts/seed-uat.ts
```

---

**🎉 Chúc mừng!** Bạn đã khởi tạo thành công cơ sở dữ liệu Multi-Tenant an toàn và sẵn sàng chạy ứng dụng bằng lệnh `npm run dev`.

> **⚠️ LƯU Ý KHI KHỞI ĐỘNG SERVER BẰNG POWERSHELL / CMD**
> Nếu chạy `npm run dev` và gặp lỗi: 
> `FATAL: Backend process is running as a SUPERUSER. Row Level Security will be bypassed!`
> 
> **Cách khắc phục:** 
> Tắt tab Terminal hiện tại, mở một tab Terminal hoàn toàn mới và gõ lại `npm run dev`. Hệ thống sẽ đọc lại đúng tài khoản an toàn từ file `.env` và ứng dụng sẽ.