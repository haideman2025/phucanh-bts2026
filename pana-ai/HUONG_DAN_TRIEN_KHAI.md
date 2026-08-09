# Nâng PANA lên Gemini — hướng dẫn triển khai
**Deman AI Lab · 09/08/2026**

---

## ⚡ TRẠNG THÁI HIỆN TẠI — CHỈ CÒN ĐÚNG MỘT VIỆC PHẢI LÀM

| Việc | Trạng thái |
|---|---|
| Worker đã deploy | ✅ `https://pana-ai.hai-cbe.workers.dev` (tài khoản hai@deman.vn) |
| KV chống lạm dụng | ✅ đã tạo và bind — 30 lượt/IP/10 phút |
| Domain được phép gọi | ✅ đã khai `haideman2025.github.io`, `phucanh.vn`, `www.phucanh.vn` |
| URL Worker điền vào trang | ✅ đã điền trong `tu-van.html` |
| Trang tự lùi về bộ luật khi lỗi | ✅ đã có |
| Cài GEMINI_API_KEY | ✅ đã cài, `keyInstalled: true` |
| Relay vượt chặn vùng của Google | ✅ Durable Object ghim ở Bắc Mỹ |
| **PANA trả lời bằng Gemini** | ✅ **ĐANG CHẠY — đã qua 7 phép thử thương hiệu** |

Kiểm tra bất cứ lúc nào:

```bash
curl "https://pana-ai.hai-cbe.workers.dev/?health=1"
```

Phải thấy `"keyInstalled":true`. Mở trang `tu-van.html`, chỗ tên PANA sẽ hiện nhãn **✦ Gemini**.

> **Vì sao Deman không giữ key:** API key là chìa khoá tính tiền vào tài khoản Google của Phúc Anh.
> Đừng dán key vào chat với bất kỳ AI nào, đừng commit lên GitHub, đừng để trong `wrangler.toml`.
> Chỉ nhập bằng `wrangler secret put` hoặc gõ thẳng trong dashboard Cloudflare.

---

## 🔧 BA SỰ CỐ ĐÃ GẶP KHI TRIỂN KHAI — VÀ CÁCH XỬ

Ghi lại để lần sau không mất thời gian chẩn đoán lại.

### 1. Wrangler báo "Success" nhưng key chỉ lưu được 1 ký tự

**Triệu chứng:** log Worker báo `Gemini error 403 ... unregistered callers`, mà `?health=1` vẫn nói
`keyInstalled: true`.

**Nguyên nhân:** PowerShell trong VS Code nuốt thao tác dán vào ô nhập ẩn của `wrangler secret put`,
chỉ ăn được ký tự đầu. Wrangler vẫn báo thành công vì nó có nhận được *một cái gì đó*.

**Cách xử:** cài key qua **dashboard Cloudflare** thay vì terminal — Workers & Pages → `pana-ai` →
Settings → Variables and Secrets → Edit → dán → Save and deploy. Worker có sẵn log độ dài key
(không log nội dung) để kiểm chứng: key đúng phải dài **39 ký tự**, dạng `AIza…`.

### 2. Google chặn theo vị trí: "User location is not supported for the API use"

**Nguyên nhân:** Cloudflare chạy Worker ở PoP gần người dùng nhất. Người dùng Việt Nam thường rơi vào
PoP **Hong Kong**, mà Google không cho gọi Gemini từ Hong Kong (Việt Nam thì được). Không có cách chọn
PoP trực tiếp.

**Cách xử:** class `GeminiRelay` trong `pana-worker.js` là một Durable Object được tạo với
`locationHint: "enam"` (Đông Bắc Mỹ). Toàn bộ request sang Google đi qua nó, nên luôn xuất phát từ
vùng hợp lệ. Key vẫn nằm trong `env`, không đi qua mạng.

Muốn xem Worker đang chạy ở đâu: `curl "https://pana-ai.hai-cbe.workers.dev/?health=1&where=1"` →
trường `runColo`.

### 3. Câu trả lời bị cắt giữa chừng

**Nguyên nhân:** `gemini-2.5-flash` là model "biết nghĩ", token suy nghĩ cũng tính vào
`maxOutputTokens`. Để 700 thì phần nghĩ ăn hết hạn mức, câu trả lời đứt ngang.

**Cách xử:** `MAX_OUTPUT_TOKENS = 1400` và `THINKING_BUDGET = 0`. Độ dài thật do luật "tối đa 6 câu"
trong prompt kiểm soát, không phải do hạn mức token. Nếu thấy PANA áp luật sai ở câu hỏi khó thì nâng
`THINKING_BUDGET` lên vài trăm — đổi lại chậm hơn và tốn hơn.

---

## 0. Đọc mục này trước, đừng bỏ qua

Trang `tu-van.html` là **trang tĩnh công khai** trên GitHub Pages. Nếu đặt API key của Gemini vào
JavaScript của trang, bất kỳ ai bấm **View Source** cũng đọc được key — rồi dùng quota của Phúc Anh
đến khi hết tiền. Không có cách nào "ẩn" key trong trang tĩnh: minify, mã hoá, đổi tên biến đều vô dụng,
vì trình duyệt phải giải mã ra để dùng.

Nên kiến trúc bắt buộc là:

```
Trình duyệt người dùng  →  Cloudflare Worker (giữ key)  →  Gemini API
     tu-van.html            pana-worker.js                  Google
```

Worker là một hàm nhỏ chạy trên server Cloudflare. Key nằm ở đó dưới dạng **secret**, không ai đọc được,
kể cả người xem trang. Miễn phí tới 100.000 lượt gọi mỗi ngày — dư sức cho một chiến dịch 30 ngày.

**Một quy tắc không được vi phạm:** đừng dán API key vào chat với bất kỳ AI nào (kể cả tôi), đừng commit
key lên GitHub, đừng đặt key trong `wrangler.toml`. Key chỉ được nhập bằng lệnh `wrangler secret put`
hoặc gõ trực tiếp trong dashboard Cloudflare.

---

## 1. Lấy API key Gemini

1. Vào **https://aistudio.google.com/apikey**
2. Bấm **Create API key**, chọn project Google Cloud (hoặc tạo mới)
3. Copy key — dạng `AIza...`. Giữ trong password manager, đừng lưu vào file text.

Gemini có **bậc miễn phí** với giới hạn số lượt mỗi phút. Nếu chiến dịch chạy quảng cáo mạnh thì bật
thanh toán để tránh bị chặn giữa giờ cao điểm.

---

## 2. Deploy Worker (5 lệnh)

Mở terminal trong thư mục `pana-ai`:

```bash
npm install -g wrangler
npx wrangler login
npx wrangler deploy
npx wrangler secret put GEMINI_API_KEY
```

Lệnh cuối sẽ hỏi key — dán vào rồi Enter. Key đi thẳng lên Cloudflare, không lưu ở máy.

Sau `deploy`, Cloudflare in ra URL dạng:

```
https://pana-ai.<ten-tai-khoan>.workers.dev
```

**Copy URL này lại.**

### Bật giới hạn chống lạm dụng (nên làm)

Không có bước này, một người rảnh rỗi có thể gọi Worker hàng nghìn lần và đốt quota Gemini của bạn.

```bash
npx wrangler kv namespace create PANA_RL
```

Lệnh in ra một `id`. Mở `wrangler.toml`, bỏ dấu `#` ở ba dòng `kv_namespaces` và dán `id` vào, rồi
`npx wrangler deploy` lại. Mặc định giới hạn 30 lượt mỗi IP trong 10 phút — sửa `RATE_LIMIT` trong
`pana-worker.js` nếu muốn khác.

---

## 3. Khai báo domain được phép gọi

Mở `pana-worker.js`, tìm `ALLOWED_ORIGINS` ở đầu file, thêm domain thật của trang:

```js
const ALLOWED_ORIGINS = [
  "https://haideman2025.github.io",
  "https://www.phucanh.vn",
  "https://phucanh.vn",
];
```

Bước này chặn website lạ nhúng trợ lý của bạn để dùng ké quota. Sửa xong chạy lại `npx wrangler deploy`.

---

## 4. Bật Gemini trong trang

Mở `tu-van.html`, ngay đầu `<body>` có khối config **đã đánh dấu sẵn** — sửa đúng một dòng:

```html
<script>
  window.PANA_CONFIG = {
    api: "https://pana-ai.ten-cua-ban.workers.dev"
  };
</script>
```

Để rỗng thì PANA chạy bằng bộ luật; điền URL thì PANA dùng Gemini. **Không cần sửa gì khác trong file.**

Commit và push:

```bash
git add -A
git commit -m "Bat PANA Gemini"
git push
```

---

## 5. Kiểm tra sau khi deploy

| Kiểm tra | Kết quả đúng |
|---|---|
| Mở trang, bấm **Hỏi PANA** | Dòng nhỏ dưới tên PANA đổi thành *"Trợ lý chọn máy · Gemini · đang trực"* |
| Hỏi *"mình học kế toán, có 20 triệu"* | Gợi ý máy phù hợp, **có nói nhược điểm**, giọng gọi bạn là "bạn" |
| Hỏi tiếp *"thế còn Dell?"* | Trả lời có nhớ ngữ cảnh câu trước, không hỏi lại ngành |
| Làm quiz rồi mở chat hỏi *"máy đó pin mấy tiếng?"* | PANA biết "máy đó" là máy nào — không hỏi lại |
| Hỏi *"màn Acer phủ bao nhiêu sRGB?"* | Nói **chưa có số liệu** và mách câu nên hỏi tại quầy — **không được đoán một con số** |
| Hỏi *"máy tôi mua tuần trước bị sập nguồn"* | Chuyển hotline 1900 2164, không tự xử lý |
| Tắt wifi rồi hỏi | Vẫn trả lời được (tự động lùi về bộ luật trong trang) |

Nếu ô nào sai, sửa `BRAND_PROMPT` trong `pana-worker.js` rồi deploy lại — không cần sửa trang web.

---

## 6. Chi phí

Mỗi lượt hỏi tốn khoảng 3.500–4.000 token đầu vào (phần lớn là system prompt và dữ liệu 6 máy) cộng
200–350 token đầu ra. Với `gemini-2.5-flash`, một nghìn cuộc hội thoại 5 lượt rơi vào khoảng
**vài trăm nghìn đồng** — nhỏ so với ngân sách quảng cáo. Kiểm tra giá hiện hành tại
**https://ai.google.dev/pricing** vì Google có điều chỉnh.

Muốn giảm nữa thì dùng **context caching** của Gemini cho phần system prompt (nó không đổi giữa các lượt),
hoặc rút ngắn dữ liệu sản phẩm. Chỉ nên làm khi lượng hỏi lớn — đừng tối ưu sớm.

---

## 7. Vì sao quiz KHÔNG dùng Gemini

Quiz 4 câu vẫn chạy bằng bộ luật, cố ý như vậy. Ba lý do:

1. **Kiểm toán được.** Ban lãnh đạo hỏi "vì sao PANA gợi ý máy này" thì có công thức trả lời rõ ràng, không
   phải "mô hình nghĩ vậy".
2. **Không bao giờ lệch.** Điểm số cho ra kết quả giống nhau mỗi lần với cùng câu trả lời — quan trọng khi
   đây là thứ dẫn tới đơn hàng.
3. **Tức thì và miễn phí.** Người dùng bấm là có kết quả, không chờ mạng.

Gemini gánh phần nó giỏi hơn: hội thoại tự do, câu hỏi lạ, cá nhân hoá theo ngữ cảnh. Đây là cách phân
vai đúng — không phải thoả hiệp.

---

## 8. Bảo trì

- **Giá hoặc tồn kho đổi:** sửa `PRODUCTS` trong `pana-worker.js` rồi `npx wrangler deploy`. Nhớ sửa cả
  hằng `DB` trong `tu-van.html` (khối `const DB = {...}` ở đầu thẻ `<script>` cuối trang) để bảng sản phẩm
  và quiz khớp — hai chỗ này phải đồng bộ, lệch nhau là PANA nói khác trang.
- **Kiểm tra nhanh Worker còn sống:** `curl "https://pana-ai.hai-cbe.workers.dev/?health=1"` — trả về
  `keyInstalled`, `rateLimitOn`, `model`. Endpoint này không gọi Gemini nên không tốn token.
- **Thêm máy mới:** thêm một object vào `PRODUCTS`, bắt buộc điền `weakness`. Không có nhược điểm thì
  PANA vi phạm nguyên tắc 2.
- **Đổi tính cách PANA:** chỉ sửa `BRAND_PROMPT`. Đọc `PANA_BRAND_VOICE.md` trước khi sửa để không phá
  các luật thương hiệu đã chốt.
- **Xem log:** `npx wrangler tail` để đọc lỗi thực tế khi đang chạy.

---

## 9. Nếu không dùng Cloudflare

Vercel cũng làm được, dùng `api/pana.js` với `export default async function handler(req,res)`, đặt key ở
Settings → Environment Variables. Logic bên trong copy nguyên từ `pana-worker.js`. Netlify Functions tương tự,
nhưng tài khoản Netlify hiện đang hết credit nên Cloudflare là đường ngắn nhất.

---

## 10. Prompt ngắn để nhờ Claude Code làm hộ

Đừng attach `tu-van.html` hay bất cứ file lớn nào — sẽ vỡ context. Chỉ mở thư mục `pana-ai` và dán:

```
Trong thư mục này có pana-worker.js và wrangler.toml. Hãy:
1. Chạy: npx wrangler login, rồi npx wrangler deploy
2. In ra URL Worker vừa deploy
3. Chạy npx wrangler kv namespace create PANA_RL, dán id vào wrangler.toml
   (bỏ comment 3 dòng kv_namespaces), deploy lại
4. Nhắc tôi tự chạy: npx wrangler secret put GEMINI_API_KEY

KHÔNG đọc, không mở, không sửa tu-van.html hay index.html.
KHÔNG hỏi tôi API key, không ghi key vào bất kỳ file nào.
```

Sau khi có URL Worker, tự sửa một dòng `api:` trong khối `window.PANA_CONFIG` ở đầu `tu-van.html`
rồi `git push` — việc này bạn làm nhanh hơn nhờ AI.
