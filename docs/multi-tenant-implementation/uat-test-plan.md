# Hướng Dẫn Kiểm Thử Bằng Tay (Manual UAT Test Plan) cho Multi-Tenant

Do hệ thống Medusa Admin gốc không tự động chèn header `x-tenant-id`, bạn cần sử dụng Browser Extension (như ModHeader) hoặc một Reverse Proxy (như Nginx/Caddy) để ép header này vào mọi request tới `/admin/*`.

## Mục đích
Đảm bảo tính độc lập dữ liệu tuyệt đối giữa các Tenant (Tenant A và Tenant B) trên giao diện Admin, đồng thời xác minh cơ chế chống rò rỉ context của kết nối Database.

## Chuẩn bị
1. Chạy Backend bằng Role Runtime (`runtime_role`), với `MEDUSA_SKIP_CORE_DEFAULTS=true`.
2. Seed dữ liệu bằng script: `npx medusa exec ./src/scripts/seed-uat.ts`.
3. Ghi nhận ID của Tenant A và Tenant B từ DB (hoặc log chạy script).
4. Khởi chạy 2 Profile Trình Duyệt hoàn toàn độc lập (hoặc 1 trình duyệt thường và 1 trình duyệt ẩn danh).
   - **Profile 1**: Đại diện cho Admin A (Tenant A). Cài extension ModHeader, thêm header: `x-tenant-id: <Tenant_A_ID>`.
   - **Profile 2**: Đại diện cho Admin B (Tenant B). Cài extension ModHeader, thêm header: `x-tenant-id: <Tenant_B_ID>`.

## Kịch Bản 1: Cô lập Dữ Liệu Cơ Bản (List & Read)
**Hành động**:
1. (Profile 1) Đăng nhập bằng `adminA@test.com`. Tạo một Product mới có tên `A_ONLY_PRODUCT`.
2. (Profile 2) Đăng nhập bằng `adminB@test.com`. Vào danh sách Product.

**Kỳ vọng**:
- Profile 2 **KHÔNG THỂ** nhìn thấy `A_ONLY_PRODUCT`.
- Nếu Admin B cố tình lấy Product ID của A và dán trực tiếp vào URL (vd: `http://localhost:9000/app/products/prod_123A`), API phải trả về `403` hoặc `404`, giao diện hiển thị lỗi hoặc không tìm thấy.

## Kịch Bản 2: Chống Giả Mạo Tenant (Spoofing)
**Hành động**:
1. (Profile 1 - Admin A) Thay đổi cấu hình ModHeader, sửa header thành `x-tenant-id: <Tenant_B_ID>`.
2. Refresh trang hoặc thử gọi API lấy danh sách.

**Kỳ vọng**:
- Request thất bại với lỗi `403 Forbidden` (Not a member of this tenant), do tài khoản Admin A không có membership trong Tenant B.

## Kịch Bản 3: Fail-Closed Khi Thiếu Context
**Hành động**:
1. (Profile 1 - Admin A) Tắt extension ModHeader (không gửi `x-tenant-id`).
2. Tải lại trang Admin.

**Kỳ vọng**:
- Request thất bại với lỗi `400/401/403` (Missing x-tenant-id header). API tuyệt đối không được tự động liệt kê toàn bộ Product trong DB (bảo vệ chống rò rỉ dữ liệu).

## Kịch Bản 4: Kiểm Tra Song Song Rò Rỉ Pool (A/B Pool Leak)
**Hành động**:
1. Đặt Profile 1 (Tenant A) và Profile 2 (Tenant B) cạnh nhau trên màn hình.
2. Tại Profile 1, liên tục tạo/lưu Product liên tiếp hoặc giữ phím F5 để spam request.
3. Cùng lúc đó, tại Profile 2, tạo một Customer mới tên `Customer B` và tạo một Order cho Tenant B.

**Kỳ vọng**:
- Do backend sử dụng `WeakMap` khóa bất đồng bộ cho client trong pool, các request sẽ không bao giờ bị dính chéo. `Customer B` chắc chắn sẽ thuộc về `Tenant B` (có thể verify lại trong Database cột `tenant_id`). Nếu có tình trạng timeout, hệ thống tự động reset context, dữ liệu không bị trộn lẫn.

## Kịch Bản 5: Persistent RLS (Restart Server)
**Hành động**:
1. Tắt đột ngột server backend (`Ctrl + C`) trong lúc đang tải dữ liệu.
2. Khởi động lại backend.
3. Refresh lại Profile 1 và Profile 2.

**Kỳ vọng**:
- Mọi giới hạn isolation vẫn phải giữ nguyên do chính sách RLS nằm ở cơ sở dữ liệu PostgreSQL. Không được phép rò rỉ dữ liệu do server "chưa khởi tạo xong" hoặc "mất config".

---
*Lưu ý: Chức năng giới hạn quyền cấp Store (Store-scoped authorization) ví dụ Admin A chỉ quản lý Store A1, Admin B quản lý Store A2 chưa thuộc MVP của Phase này.*
