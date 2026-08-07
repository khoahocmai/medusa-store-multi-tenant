# Tài liệu Kỹ thuật Kiến trúc Multi-Tenant

Tài liệu này mô tả **kiến trúc, cơ chế cô lập dữ liệu, authorization, API/workflow và quy tắc dành cho developer** của hệ thống MedusaJS Multi-Tenant.

Các bước cài đặt môi trường, tạo database roles, chạy migration, bootstrap Platform Admin và onboarding vận hành được đặt trong [`GETTING_STARTED.md`](./GETTING_STARTED.md).

---

## 1. Tổng quan kiến trúc

Kiến trúc Multi-Tenant được xây dựng dựa trên sự kết hợp của:

1. Request interception bằng middleware.
2. Tenant Context trong Node.js bằng `AsyncLocalStorage`.
3. PostgreSQL Row Level Security (RLS).
4. PG hook để truyền Tenant Context xuống database.

Mục tiêu là để code nghiệp vụ sử dụng API/Service của Medusa theo cách bình thường, trong khi việc giới hạn dữ liệu theo Tenant được xử lý tập trung bởi middleware và database.

---

## 2. Cơ chế cốt lõi

### 2.1. `tenantResolutionMiddleware`

Middleware này xác định Tenant Context cho request hiện tại.

Nguồn phân giải có thể bao gồm:

- Header `x-tenant-id`.
- Domain truy cập thông qua `StoreLocator` đối với các route `/store` hoặc `/tenant`.
- Quyền của `actor_id` đã đăng nhập.

Kết quả phân giải được đưa vào `tenantContext`.

### 2.2. `tenantContext` — AsyncLocalStorage

Tenant Context lưu thông tin của request hiện tại, bao gồm:

- `tenantId`
- `actorId`
- `accessMode`

Các giá trị `accessMode` được sử dụng trong tài liệu hiện tại gồm:

```text
tenant
platform
platform_impersonation
```

Ví dụ lấy Tenant Context trong API route, service hoặc subscriber:

```typescript
import { tenantContext } from "../../utils/tenant-context"

const ctx = tenantContext.getStore()

if (ctx && ctx.tenantId) {
  console.log("Current Tenant ID:", ctx.tenantId)
  console.log("Access Mode:", ctx.accessMode)
}
```

### 2.3. `tenantResourceIsolationMiddleware`

Middleware này bảo vệ các tài nguyên dùng chung hoặc chưa có cơ chế cách ly phù hợp.

Theo thiết kế hiện tại, nó có thể chặn các mutation như:

```text
POST
PUT
DELETE
```

đối với các tài nguyên không cho phép Tenant ghi trực tiếp, trong khi vẫn cho phép các thao tác đọc phù hợp.

### 2.4. `rls-pg-hook.ts`

PG hook can thiệp vào `pg.Client.prototype.query` để đưa Tenant Context xuống PostgreSQL trước khi thực hiện truy vấn nghiệp vụ.

Tenant ID hiện hành được đưa vào PostgreSQL transaction thông qua setting:

```text
app.current_tenant_id
```

Khi kết hợp với RLS policies, PostgreSQL tự giới hạn dữ liệu theo Tenant hiện tại mà application không cần thêm `WHERE tenant_id = ...` vào từng query.

---

## 3. Quy tắc quan trọng khi query dữ liệu

### 3.1. Không hardcode `tenant_id` vào query nghiệp vụ

Không viết:

```typescript
// ❌ Không nên
productService.list({
  tenant_id: req.tenant_id,
  title: "Shirt",
})
```

Thay vào đó, sử dụng API/Service bình thường:

```typescript
// ✅ Tenant isolation do Context + RLS xử lý
productService.list({
  title: "Shirt",
})
```

Ví dụ với Query API:

```typescript
const query = req.scope.resolve("query")

const { data: allowedChannels } = await query.graph({
  entity: "sales_channel",
  fields: ["id", "name"],
})

console.log("Sales Channels (Isolated by DB RLS):", allowedChannels)
```

Query trên chỉ nên nhìn thấy dữ liệu được RLS cho phép trong Tenant Context hiện tại.

---

## 4. Database roles và nguyên tắc RLS

PostgreSQL superuser có thể bypass RLS. Vì vậy application runtime và database administration/migration phải dùng các tài khoản khác nhau.

Cấu hình runtime điển hình:

```env
# Application runtime — non-superuser
DATABASE_URL=postgres://runtime_role:runtime_password@localhost:6543/medusa_multi_tenant

# Migration / database administration
DATABASE_SUPER_URL=postgres://postgres:postgres@localhost:6543/medusa_multi_tenant
```

Nguyên tắc bắt buộc:

- Application server chạy bằng `DATABASE_URL`.
- Migration hoặc database administration task cần DDL mới dùng `DATABASE_SUPER_URL`.
- Không khởi động backend bằng PostgreSQL superuser.

Các lệnh setup cụ thể được đặt trong [`GETTING_STARTED.md`](./GETTING_STARTED.md).

---

## 5. Mô hình dữ liệu User–Tenant

### `Tenant`

Chứa thông tin cơ bản của Tenant, ví dụ:

- `id`
- `name`
- `handle`
- `status`

### `TenantMembership`

Liên kết một user (`actor_id`) với một Tenant.

Membership định nghĩa role của user trong Tenant, ví dụ:

```text
owner
admin
member
```

và trạng thái `is_active`.

---

## 6. Authorization và Tenant resolution

### 6.1. Platform Admin

Các request tới namespace:

```text
/admin/platform/*
```

phải được kiểm tra quyền Platform Admin thông qua cơ chế xác thực/authorization của hệ thống.

### 6.2. Tenant User

Khi user truy cập `/admin/*` ngoài namespace platform:

1. Middleware xác định `actorId` hiện tại.
2. Hệ thống tìm `TenantMembership` tương ứng.
3. Tenant Context được thiết lập dựa trên membership và request.

Nếu một `actor_id` thuộc nhiều Tenant, client phải cung cấp:

```http
x-tenant-id: <tenant-id>
```

Nếu thiếu Tenant selection trong trường hợp cần thiết, hệ thống có thể trả lỗi:

```text
TENANT_SELECTION_REQUIRED
```

Nếu user không có quyền với Tenant được yêu cầu, request có thể bị từ chối bằng `401 Unauthorized` hoặc `403 Not Allowed`.

### 6.3. Platform Impersonation

Khi Platform Admin truy cập trong context của một Tenant khác thông qua `x-tenant-id`, hệ thống sử dụng:

```text
accessMode = "platform_impersonation"
```

Theo thiết kế hiện tại, hành động impersonation được ghi Audit Log.

---

## 7. Tenant Management APIs

### `POST /admin/platform/tenants`

Tạo Tenant mới. Request phải được thực hiện bởi Platform Admin hợp lệ.

### `GET /admin/platform/tenants`

Trả về danh sách Tenant cùng các quan hệ cần thiết như:

- memberships
- store locators

### `GET /admin/tenant/current`

Trả về Tenant Context hiện tại và `access_mode` liên quan.

---

## 8. `createTenantWorkflow`

Workflow tạo Tenant thực hiện tuần tự các bước:

1. `verifyPlatformAdminStep`
   - Xác minh `authenticated_actor_id` có quyền Platform Admin.
2. `validateCreateTenantInputStep`
   - Kiểm tra các input như `name`, `handle`, ...
3. `createTenantStep`
   - Tạo thực thể Tenant.
4. `createTenantMembershipStep`
   - Gán membership cho user sở hữu Tenant đầu tiên với role phù hợp theo workflow hiện tại.

---

## 9. API quản lý User

### `POST /admin/platform/users`

Gọi `createTenantUserWorkflow` để tạo user và gán user vào một `tenant_id` với role tương ứng.

### `GET /admin/platform/users`

Trả về danh sách user cùng thông tin Tenant liên quan, ví dụ:

- `tenant_name`
- `tenant_role`

Theo tài liệu hiện tại, user không có Tenant Membership được xem là user thuộc Platform (`is_platform: true`).

---

## 10. Tenant-owned resources

Một số resource được thiết kế thuộc riêng từng Tenant, bao gồm:

- `sales_channel`
- `stock_location`

Do đó Tenant Admin cần tạo Sales Channel và Stock Location riêng trong quá trình onboarding trước khi cấu hình inventory/sales hoàn chỉnh.

Các bước thao tác dành cho người vận hành nằm trong [`GETTING_STARTED.md`](./GETTING_STARTED.md).

---

## 11. Developer checklist

Trước khi merge một thay đổi liên quan Multi-Tenant, kiểm tra:

- [ ] Không hardcode `tenant_id` vào các query nghiệp vụ nếu RLS đã chịu trách nhiệm isolation.
- [ ] Request đã đi qua Tenant resolution phù hợp.
- [ ] Code cần Tenant Context lấy từ `tenantContext` thay vì tự suy diễn Tenant.
- [ ] Tenant-owned resource không bị truy cập chéo Tenant.
- [ ] Application runtime không dùng PostgreSQL superuser.
- [ ] Các platform-only API có kiểm tra Platform Admin.
- [ ] Trường hợp user thuộc nhiều Tenant xử lý đúng `x-tenant-id`.
- [ ] Platform impersonation giữ đúng `accessMode` và audit behavior.
- [ ] Mutation trên shared/unisolated resource được bảo vệ bởi isolation middleware tương ứng.

---

## 12. Phân chia trách nhiệm giữa hai tài liệu

### `GETTING_STARTED.md`

Dành cho setup và vận hành:

- Docker
- Dependencies
- `.env`
- PostgreSQL roles
- Migrations
- Platform Admin bootstrap
- UAT seed
- Platform/Tenant onboarding

### `MULTI_TENANT_DOCS.md`

Dành cho developer và kiến trúc:

- Tenant resolution
- AsyncLocalStorage context
- Resource isolation middleware
- PG hook + PostgreSQL RLS
- Database role separation
- Data model
- Authorization
- APIs
- Workflows
- Developer rules/checklist
