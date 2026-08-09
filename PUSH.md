# Đẩy lên GitHub + bật Pages — 4 bước

Yêu cầu: đã cài `git` và đăng nhập GitHub trên máy.

### 1. Tạo repo trống trên GitHub
Vào https://github.com/new → Repository name: **phucanh-bts2026** → chọn **Public** →
KHÔNG tích "Add a README" → Create repository.

### 2. Mở terminal tại thư mục này rồi chạy

```bash
git init -b main
git add -A
git commit -m "Phuc Anh BTS 2026 landing page"
git remote add origin https://github.com/haideman2025/phucanh-bts2026.git
git push -u origin main
```

(Đổi `haideman2025` nếu bạn push bằng tài khoản khác.)

### 3. Bật GitHub Pages
Repo → **Settings** → **Pages** → Source: **Deploy from a branch** →
Branch: **main**, folder: **/ (root)** → **Save**.

### 4. Đợi 1–2 phút, link sẽ là

```
https://haideman2025.github.io/phucanh-bts2026/
```

---

## Ghi chú

- Tổng dung lượng ~26 MB (6 video đã nén từ 296 MB xuống 24 MB). GitHub Pages phục vụ thoải mái.
- File `.nojekyll` đã có sẵn — bắt buộc để GitHub Pages không xử lý qua Jekyll.
- Muốn gắn tên miền riêng: Settings → Pages → Custom domain, rồi trỏ CNAME về `haideman2025.github.io`.
- Cập nhật nội dung sau này: sửa `index.html`, rồi `git add -A && git commit -m "update" && git push`.
