# Tài liệu Kỹ thuật Kiến trúc Multi-Tenant

## Tổng quan & Cách sử dụng (Overview & Usage Guide)

Kiến trúc Multi-Tenant trong hệ thống Medusa này được xây dựng dựa trên sự kết hợp chặt chẽ giữa Middleware chặn bắt luồng (Request Interception), cơ chế quản lý Context trong Node.js (AsyncLocalStorage) và bảo mật cấp cơ sở dữ liệu (PostgreSQL Row Level Security - RLS).

### Cơ chế Cốt lõi (Core Mechanism)

1. **`tenantResolutionMiddleware`**: Được chạy đầu tiên để xác định bối cảnh của Tenant (`tenantContext`). Nó lấy thông tin từ các request headers (`x-tenant-id`), domain truy cập (thông qua `StoreLocator` đối với các route `/store` hoặc `/tenant`), hoặc dựa trên quyền của `actor_id` đã đăng nhập.
2. **`tenantContext` (AsyncLocalStorage)**: Sau khi xác định được danh tính Tenant, thông tin này (`tenantId`, `actorId`, `accessMode`) sẽ được lưu vào một phiên làm việc bất đồng bộ (AsyncLocalStorage) giúp truyền tải `tenant_id` xuyên suốt quá trình xử lý HTTP request.
3. **`tenantResourceIsolationMiddleware`**: Chặn các thao tác ghi (Mutations: POST/PUT/DELETE) của người dùng Tenant trên các tài nguyên dùng chung hoặc không có cơ chế cách ly, chỉ cho phép thực thi `GET`.
4. **`rls-pg-hook.ts` (Database Isolation)**: Cơ chế can thiệp trực tiếp vào thư viện PostgreSQL (`pg.Client.prototype.query`). Trước khi thực hiện bất kỳ truy vấn nghiệp vụ nào, hook này sẽ nhúng cấu hình `SET LOCAL app.current_tenant_id` vào trong Transaction (BEGIN). Kết hợp với PostgreSQL RLS, dữ liệu sẽ tự động được cách ly hoàn toàn theo `tenant_id` đang truy cập mà không cần phải thủ công thêm lệnh `WHERE tenant_id = ...` vào mỗi truy vấn.

Tính năng quản lý sản phẩm theo từng tenant đã được thực hiện thành công.

### Code snippets: Cách lấy `tenant_id`

Trong API Routes, Services, hoặc Subscribers, bạn có thể truy xuất `tenant_id` như sau:

```typescript
import { tenantContext } from "../../utils/tenant-context"

// Lấy tenant context hiện hành
const ctx = tenantContext.getStore()

if (ctx && ctx.tenantId) {
  console.log("Current Tenant ID:", ctx.tenantId)
  console.log("Access Mode:", ctx.accessMode) // 'tenant' | 'platform' | 'platform_impersonation'
}
```

### Code snippet: Ví dụ truy vấn dữ liệu theo Tenant

Nhờ vào kiến trúc bảo mật cấp CSDL (PostgreSQL RLS), nhà phát triển không cần phải tự lọc `tenant_id`. Các truy vấn sử dụng API cốt lõi sẽ mặc định chỉ trả về dữ liệu của Tenant hiện tại.

```typescript
// Trong một API route hoặc Service
const query = req.scope.resolve("query")

// Truy vấn này sẽ bị giới hạn bởi RLS Hook. 
// Chỉ các 'sales_channel' thuộc về 'tenantId' trong Context mới được trả về.
const { data: allowedChannels } = await query.graph({
  entity: "sales_channel",
  fields: ["id", "name"]
})

console.log("Sales Channels (Isolated by DB RLS):", allowedChannels)
```

---

## Luồng quản lý Tenant (Tenant Management Flows)

Việc khởi tạo và cấu hình các Tenant được quản lý bằng bộ API dành riêng cho Platform Admin cùng với sự hỗ trợ của hệ thống Workflows.

### API Endpoints

- **`POST /admin/platform/tenants`**: API tạo Tenant mới. Yêu cầu `actor_id` gửi yêu cầu phải có quyền của Platform Admin.
- **`GET /admin/platform/tenants`**: Trả về danh sách toàn bộ các Tenant có trong hệ thống cùng các quan hệ (`memberships`, `store_locators`).
- **`GET /admin/tenant/current`**: Trả về thông tin Tenant hiện tại mà người dùng đang truy cập, đi kèm với quyền `access_mode`.

### Workflows

- **`createTenantWorkflow`**: Chịu trách nhiệm thực hiện tuần tự các tác vụ tạo Tenant:
  1. `verifyPlatformAdminStep`: Xác thực quyền quản trị nền tảng (Platform Admin) của người thực hiện (`authenticated_actor_id`).
  2. `validateCreateTenantInputStep`: Kiểm tra dữ liệu hợp lệ (`name`, `handle`, v.v.).
  3. `createTenantStep`: Ghi nhận dữ liệu thực thể Tenant mới.
  4. `createTenantMembershipStep`: Cấp quyền tự động (`admin`) cho người dùng sở hữu Tenant đầu tiên.

---

## Quản lý User & Tenant (User-Tenant Management)

### Mô hình Dữ liệu (Data Models)

- **`Tenant`**: Chứa thông tin cơ bản về Tenant (`id`, `name`, `handle`, `status`). 
- **`TenantMembership`**: Đóng vai trò là bảng trung gian liên kết giữa một Người dùng (`actor_id`) và một `Tenant`. Nó định nghĩa cấp bậc quyền hạn trong Tenant thông qua cột `role` (`owner`, `admin`, `member`) và trạng thái `is_active`.

### Luồng ủy quyền và xác thực (Authorization / Authentication Flow)

1. **Platform Admin**: Module xác thực cung cấp hàm `validatePlatformAdmin`. Các request tới `/admin/platform/*` bắt buộc `actor_id` phải tồn tại trong danh sách membership của hệ thống gốc (Platform Memberships).
2. **Tenant User**:
   - Khi truy cập `/admin/*` (không phải nền tảng), Middleware sẽ truy vấn `TenantMembership` dựa trên `actorId` hiện tại.
   - Nếu `actor_id` nằm trong nhiều Tenant, User sẽ phải chủ động cung cấp Header `x-tenant-id` để Middleware phân giải đúng Context (nếu không sẽ văng lỗi `TENANT_SELECTION_REQUIRED`).
   - Nếu không có quyền đối với `tenant_id` được yêu cầu, API trả về `401 Unauthorized` hoặc `403 Not Allowed`.
   - Tính năng **Platform Impersonation**: Nếu một Platform Admin cung cấp `x-tenant-id` của một Tenant khác, hệ thống sẽ gán `accessMode = "platform_impersonation"` và lưu lại log kiểm toán (Audit Log) về hành động đóng giả (impersonation) này.

### API Quản lý Người dùng

- **`POST /admin/platform/users`**: API gọi workflow `createTenantUserWorkflow` để tạo một tài khoản User mới và tự động gán vào một `tenant_id` với vai trò (`role`) nhất định.
- **`GET /admin/platform/users`**: API trả về danh sách User trên toàn hệ thống kèm theo thông tin của Tenant mà User đang được gắn (`tenant_name`, `tenant_role`). Nếu một User không có Membership ở Tenant nào, User đó được coi là thuộc Platform (`is_platform: true`).
