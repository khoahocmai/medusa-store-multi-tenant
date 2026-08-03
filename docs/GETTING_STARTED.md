# MedusaJS Multi-Tenant: Getting Started & Playbook

Chào mừng bạn đến với tài liệu hướng dẫn vận hành hệ thống MedusaJS Multi-Tenant. Hệ thống này được xây dựng với kiến trúc **PostgreSQL Row Level Security (RLS)**, đảm bảo dữ liệu của các cửa hàng (Tenant) được cô lập hoàn toàn ở mức Database, đồng thời giữ cho code logic (Application level) cực kỳ gọn nhẹ và chuẩn Medusa.

Tài liệu này sẽ hướng dẫn bạn step-by-step cách khởi tạo hệ thống từ một database trắng tinh, cách quản lý cấp Platform, và cách các Tenant vận hành.

---

## Phase 1: Database Initialization & Khởi tạo Hệ thống

Nếu bạn vừa clone project về hoặc reset lại database, hãy làm theo các bước sau để xây dựng nền móng an toàn cho hệ thống Multi-Tenant.

### 1. Khởi tạo tài khoản Non-Superuser (Bắt buộc cho RLS)
Trong file `.env`, hãy thiết lập tạm thời `DATABASE_URL` trỏ đến tài khoản Superuser (ví dụ: `postgres`), sau đó chạy script tạo tài khoản giới hạn:

```bash
npm run seed:rls-user
```
*(Ghi chú: Script này sẽ kết nối bằng quyền Superuser để tạo ra một user mới bị giới hạn quyền hạn, chuyên dùng để chạy ứng dụng nhằm đảm bảo PostgreSQL không bỏ qua luật RLS).*

Sau khi chạy xong, hãy quan sát **kết quả log trên màn hình (console)**. Script sẽ in ra chính xác chuỗi kết nối an toàn vừa được tạo (thường mặc định là user `medusa_app_user`). Hãy copy chuỗi đó và **cập nhật lại file `.env`** thành 2 biến tách biệt:
```env
DATABASE_SUPER_URL=postgres://postgres:postgres@localhost:5432/medusa_db
DATABASE_URL=postgres://medusa_app_user:postgres@localhost:5432/medusa_db
```

### 2. Chạy Database Migrations
Tiến hành tạo cấu trúc bảng, RLS Policies, và Database Triggers. Lệnh này cần quyền cao nhất để thay đổi rules. Tùy thuộc vào hệ điều hành bạn đang sử dụng, hãy chạy một trong hai lệnh sau:

**Windows:**
```bash
$env:DATABASE_URL=$env:DATABASE_SUPER_URL; npx medusa db:migrate
```

**macOS/Linux:**
```bash
DATABASE_URL=$DATABASE_SUPER_URL npx medusa db:migrate
```
*(Giải thích: Lệnh này sẽ tạm thời sử dụng biến `DATABASE_SUPER_URL` có quyền superuser để tạo bảng và RLS policies. Sau khi chạy xong, hệ thống sẽ tự động trả lại quyền non-superuser cho biến `DATABASE_URL` khi bạn chạy server ứng dụng).*

### 3. Chạy Script Bootstrap
Để hệ thống có thể hoạt động, bạn cần một tài khoản **Platform Admin (Super Admin)**. Chúng tôi đã chuẩn bị sẵn một script bootstrap để tạo tự động tài khoản này, cùng với Tenant mặc định và Store mặc định.

```bash
npm run seed:platform-admin
# hoặc
npx ts-node src/scripts/bootstrap-platform-admin.ts
```
Script này sẽ thực hiện:
- Khởi tạo `PlatformMembership` (cấp quyền tối cao vượt RLS) cho tài khoản admin của bạn.
- Tạo một Default Tenant và Default Store.

---

## Phase 2: Quản lý cấp Platform (Dành cho Super Admin)

Platform Admin là người có quyền cao nhất, quản lý toàn bộ hệ thống và cấp phát tài nguyên cho các Tenant.

1. **Đăng nhập:** Mở giao diện Medusa Admin UI (thường ở `http://localhost:9000/app`) và đăng nhập bằng tài khoản Super Admin vừa được bootstrap.
2. **Tạo Tenant mới:** 
   - Điều hướng tới mục quản lý **Tenants** (được custom riêng cho dự án).
   - Nhấn **Create Tenant** và điền thông tin (ví dụ: *Shop A*, tên miền, và email của chủ Shop).
3. **Cơ chế tự động ngầm:** Khi Super Admin tạo Tenant, Workflow của hệ thống sẽ **tự động** thực thi việc tạo ra một `TenantMembership` (với role `admin`) gán cho email chủ Shop A. Từ lúc này, chủ Shop A đã có tài khoản hợp lệ để bắt đầu kinh doanh.

---

## Phase 3: Tenant Onboarding (Dành cho Tenant Admin)

Dưới góc độ của một chủ cửa hàng (Tenant Admin), việc onboarding diễn ra vô cùng tự nhiên và độc lập.

1. **Đăng nhập:** Chủ Shop A đăng nhập vào Admin UI bằng tài khoản được cấp. Lúc này, do họ chỉ có `TenantMembership`, mọi truy vấn của họ đều sẽ bị giới hạn bởi `tenant_id` của Shop A.
2. **Khởi tạo Dữ liệu Bán hàng (Products, Orders, Promotions...):**
   - Tenant Admin có thể bắt đầu tạo Product, Category, cấu hình Promotion, hay xử lý Order.
   - **Phép màu của RLS:** RLS đã bao bọc mọi thứ. Tenant Admin không cần phải biết về sự tồn tại của `tenant_id`. Mọi record họ tạo ra sẽ được **tự động gán `tenant_id` của Shop A** bởi Database Trigger. Mọi record họ truy vấn sẽ tự động bị filter ẩn bởi RLS Policy. Dữ liệu của họ hoàn toàn an toàn và cô lập với Shop B.
3. **⚠️ Hành động BẮT BUỘC đầu tiên: Tạo Sales Channel & Stock Location:**
   - Trong hệ thống của chúng ta, `sales_channel` và `stock_location` là các bảng thuộc **Tenant-Owned**. Điều này có nghĩa là chúng KHÔNG được chia sẻ giữa các Tenant.
   - Ngay sau khi đăng nhập, Tenant Admin phải tạo một Sales Channel (Kênh bán hàng) và một Stock Location (Kho vật lý) riêng của họ để có thể bắt đầu gán sản phẩm vào kho và xuất bán.

---

## Phase 4: Lưu ý Sống còn cho Developer

Để giữ cho kiến trúc này sạch và an toàn, tất cả các Developer tham gia dự án phải ghi nhớ 2 quy tắc vàng:

### 1. KHÔNG hardcode `tenant_id` vào query
Bạn không bao giờ phải viết những dòng code như:
```typescript
// ❌ SAI (Thừa thãi và nguy hiểm)
productService.list({ tenant_id: req.tenant_id, title: 'Shirt' })
```
Hãy sử dụng API và Service của Medusa như bình thường:
```typescript
// ✅ ĐÚNG (Để Database và Middleware tự lo)
productService.list({ title: 'Shirt' })
```
Hệ thống Middleware (AsyncLocalStorage) và PG-Hook đã tự động bắt `tenant_id` từ session và đưa xuống PostgreSQL transaction rồi.

### 2. Tách biệt tài khoản Database (Non-superuser vs Superuser)
PostgreSQL mặc định sẽ **BỎ QUA** toàn bộ luật RLS nếu query được thực thi bởi một user có quyền `SUPERUSER`. Do đó, ta cần tách biệt user chạy migration và user chạy app.

**Cấu hình `.env` tự động (Best Practice):**
Hãy thiết lập 2 biến môi trường riêng biệt trong file `.env` của bạn:

```env
# 1. Trỏ tới user bị giới hạn (non-superuser). App sẽ mặc định dùng cái này.
DATABASE_URL=postgres://runtime_role:runtime_password@localhost:5432/medusa_db

# 2. Trỏ tới postgres (superuser). Chỉ dùng khi chạy lệnh Migration.
DATABASE_SUPER_URL=postgres://postgres:postgres@localhost:5432/medusa_db
```
Bằng cách này, Server Application sẽ luôn chạy an toàn qua `DATABASE_URL` (bị giới hạn RLS), tránh nguy cơ rò rỉ dữ liệu chéo giữa các Tenant.
