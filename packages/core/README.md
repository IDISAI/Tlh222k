# @workspace/core

Domain logic dùng chung, tổ chức **feature-first**. Apps import từ đây; `core` không bao giờ import ngược lên `apps/*`.

## Cấu trúc

```
src/<feature>/            roadmap/ (submodule), navigation/
  <sub-feature>/          roadmap/graph
```

Mỗi feature/sub-feature cùng một khuôn:

| File/thư mục | Vai trò |
|--------------|---------|
| `types.ts` | Kiểu dữ liệu |
| `<slug>.service.ts` | Logic gọi API/nghiệp vụ |
| `hooks/` | React hooks (`use-*`) |
| `components/` | UI (`*View.tsx`) |
| `utils/` | Hàm thuần |
| `index.ts` | Barrel — re-export tất cả; feature cha re-export sub-feature lên `src/index.ts` |

## Lưu ý kỹ thuật

- Dùng `moduleResolution: Bundler` → barrel `export *` không cần đuôi file.
- `src/roadmap` là **git submodule** (`IDISAI/roadmap`) — xem [../../docs/onboarding/submodules.md](../../docs/onboarding/submodules.md).

## Import từ app

```ts
import { RoadmapService, type Roadmap } from "@workspace/core"
```
