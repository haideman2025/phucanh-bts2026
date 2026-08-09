# Phúc Anh Smart World × Deman AI Lab — Back to School 2026

Landing page trình Ban lãnh đạo: chiến lược, kế hoạch thực thi 30 ngày (10/08 – 08/09/2026),
30 kịch bản video và các bản dựng thử.

**Nội dung**

- `index.html` — bản trình bày Ban lãnh đạo (1 file, chart và logo nhúng sẵn)
- `tu-van.html` — **landing page chiến dịch Back to School 2026** + trợ lý PANA chạy được ngay
  (quiz tư vấn 4 câu, chatbot 20+ chủ đề, 6 máy chủ lực, bảng so sánh, mã tư vấn tại quầy).
  Chạy hoàn toàn client-side, không cần máy chủ.
- Mascot PANA trong `tu-van.html` chạy bằng mô hình lò xo, có 9 sprite: ba góc thân
  đổi theo hướng bay (front/turn/side) và sáu tư thế tay (wave/point/cheer/laptop/think/back).
  Ba lớp transform tách riêng — `#mascot` nhận translate từ JS, `.mfig` nhận rotate/scale,
  `.mbob` giữ nhịp thở bằng CSS keyframe. Gộp chung là mascot đứng chết một chỗ.
  Tắt sạch khi người dùng bật `prefers-reduced-motion`.
- `pana-ai/` — Cloudflare Worker nối PANA vào Gemini (giữ API key ở phía máy chủ),
  kèm `PANA_BRAND_VOICE.md` (phong cách giao tiếp chuẩn thương hiệu + system prompt)
  và `HUONG_DAN_TRIEN_KHAI.md` (các bước deploy, cài key, kiểm thử)
- `assets/` — 6 video bản dựng thử đã nén cho web, ảnh tạo hình nhân vật, trang preview comic

**Chạy tại chỗ:** mở `index.html` bằng Chrome. Phần 10C nhúng sẵn `tu-van.html` để bấm thử PANA
ngay trong trang; hoặc mở thẳng `tu-van.html`.

**Deploy GitHub Pages:** Settings → Pages → Source: `Deploy from a branch` → Branch `main` / thư mục `/ (root)`.

Lập ngày 09/08/2026 · Đầu mối Phúc Anh: Nguyễn Ngọc Quyên (Marcom) · Thực hiện: Deman AI Lab.
