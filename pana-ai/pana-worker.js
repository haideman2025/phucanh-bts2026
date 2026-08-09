/**
 * PANA AI Worker — proxy Gemini cho trang tư vấn Phúc Anh Back to School 2026
 * Deman AI Lab · v1 · 09/08/2026
 *
 * VÌ SAO PHẢI CÓ WORKER NÀY:
 * Trang tu-van.html là trang tĩnh public trên GitHub Pages. Nếu đặt API key vào JavaScript
 * của trang, bất kỳ ai bấm View Source cũng lấy được key và dùng hết quota của Phúc Anh.
 * Worker này giữ key ở phía server (biến môi trường bí mật), trang web chỉ gọi tới Worker.
 *
 * CÀI KEY (bạn tự làm, không đưa key cho ai — kể cả dán vào chat với AI):
 *   npx wrangler secret put GEMINI_API_KEY
 * hoặc Cloudflare dashboard → Workers → chọn worker → Settings → Variables → Add secret.
 *
 * DEPLOY:
 *   npm i -g wrangler
 *   wrangler login
 *   wrangler deploy
 */

// ─────────────── CẤU HÌNH ───────────────
const MODEL = "gemini-2.5-flash";       // đổi nếu Google ra model mới; kiểm tra tại ai.google.dev
// gemini-2.5-flash là model "biết nghĩ": token suy nghĩ cũng tính vào MAX_OUTPUT_TOKENS.
// Để 700 thì phần nghĩ ăn hết hạn mức và câu trả lời bị cắt giữa chừng. Cho hạn mức rộng,
// còn độ dài thật do luật "trả lời 3–6 câu" trong prompt kiểm soát.
const MAX_OUTPUT_TOKENS = 1400;
// Ngân sách suy nghĩ: 0 = tắt (nhanh nhất, rẻ nhất). PANA có bộ luật rõ nên không cần nghĩ lâu;
// tăng lên vài trăm nếu thấy PANA áp luật sai ở câu hỏi khó.
const THINKING_BUDGET = 0;
const TEMPERATURE = 0.65;               // đủ tự nhiên nhưng không bay
const MAX_TURNS = 12;                   // chỉ giữ 12 lượt gần nhất, chống prompt phình
const MAX_CHARS_PER_MSG = 600;          // chặn người dùng dán cả quyển sách vào

// Chỉ cho phép các domain này gọi. THÊM domain thật của bạn vào đây.
const ALLOWED_ORIGINS = [
  "https://haideman2025.github.io",
  "https://www.phucanh.vn",
  "https://phucanh.vn",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
];

// Giới hạn chống lạm dụng: mỗi IP tối đa N lượt trong WINDOW giây.
// Cần bind KV namespace tên PANA_RL để bật; không bind thì bỏ qua giới hạn.
const RATE_LIMIT = 30;
const RATE_WINDOW = 600; // 10 phút

// ─────────────── DỮ LIỆU SẢN PHẨM (nguồn sự thật duy nhất) ───────────────
// Cập nhật giá / tồn kho Ở ĐÂY. Sửa một chỗ, cả prompt và câu trả lời đổi theo.
// Dấu "—" nghĩa là Phúc Anh CHƯA công bố — PANA được lệnh không đoán.
const PRODUCTS = [
  {
    name: "Asus Vivobook Go 14 E1404FA-EB935W",
    price: "18.290.000đ", old: "19.990.000đ (-9%)",
    cpu: "AMD Ryzen 5, 4 lõi 8 luồng, 2.8–4.3GHz", ram: "16GB DDR5 (onboard)",
    ramUpgrade: "KHÔNG nâng cấp được — RAM hàn trên bo, hãng ghi hỗ trợ tối đa 16GB, không có khe",
    ssd: "512GB M.2 NVMe PCIe (1 khay)", screen: '14" FHD 1920×1080, 60Hz, LED-Backlit',
    nits: "—", gamut: "—",
    gpu: "AMD Radeon tích hợp (không có card rời)", battery: "42Wh, 3 cell", weight: "1,3 kg — nhẹ nhất nhóm Windows",
    warranty: "24 tháng tại nơi sử dụng, pin 12 tháng, đổi trong 30 ngày", os: "Windows 11 Home",
    gifts: "Chuột không dây, balo Phúc Anh, vệ sinh máy trọn đời; giảm 30% gói bảo hành rơi vỡ ADP khi mua kèm",
    bestFor: "Ngôn ngữ, sư phạm, luật, du lịch, kinh tế — nhóm cần nhẹ và rẻ",
    weakness: "RAM hàn sẵn nên 16GB là mức tối đa vĩnh viễn; màn 1080p 60Hz ở mức cơ bản và chưa công bố độ phủ màu, không phù hợp nếu làm màu; vỏ nhựa",
    url: "https://www.phucanh.vn/laptop-asus-vivobook-go-14-e1404fa-eb935w.html",
  },
  {
    name: "Apple MacBook Neo A18 Pro 13 inch",
    price: "18.690.000đ", old: "19.990.000đ (-7%)",
    cpu: "Apple A18 Pro, 6 lõi CPU, 5 lõi GPU, băng thông bộ nhớ 60GB/s", ram: "8GB",
    ramUpgrade: "KHÔNG nâng cấp được", ssd: "256GB (không nâng cấp được)",
    screen: '13" Liquid Retina 2560×1664 — tần số quét hãng không công bố',
    nits: "500 nits", gamut: "Hãng ghi hỗ trợ 1 tỷ màu, KHÔNG công bố % sRGB",
    gpu: "GPU tích hợp 5 lõi", battery: "36,5Wh", weight: "1,23 kg — nhẹ nhất bộ 6 máy",
    warranty: "12 tháng tại trung tâm bảo hành chính hãng Apple Việt Nam", os: "macOS",
    gifts: "Giảm 3% Magic Mouse, giảm tới 500.000đ màn rời, giảm 5% adapter, giảm tới 100.000đ phần mềm",
    bestFor: "Người ưu tiên nhẹ và màn sắc nét, làm việc văn bản và biên tập ảnh nhẹ",
    weakness: "8GB RAM và 256GB SSD đều không nâng cấp được, 256GB chật rất nhanh; nhiều phần mềm ngành kỹ thuật như SolidWorks, AutoCAD bản Windows KHÔNG chạy trên macOS",
    url: "https://www.phucanh.vn/laptop-apple-macbook-neo-a18-pro-6-core-cpu-5-core-gpu-8gb-256gb-ssd-13inch-xanh-indigo.html",
  },
  {
    name: "Acer Aspire Lite 14 AL14-71P-55P9",
    price: "19.190.000đ", old: "23.387.000đ (-18%)",
    cpu: "Intel Core i5-13500H, 12 lõi 16 luồng, 2.6–4.7GHz", ram: "16GB DDR5",
    ramUpgrade: "2 khe, nâng tới 64GB", ssd: "512GB NVMe PCIe",
    screen: '14" WUXGA 1920×1200 IPS — tần số quét hãng không công bố',
    nits: "—", gamut: "—",
    gpu: "Intel Iris Xe (không có card rời)", battery: "58Wh, 3 cell, sạc 65W — pin lớn nhất bộ 6 máy",
    weight: "1,5 kg (vỏ hợp kim nhôm)", warranty: "24 tháng tại hãng, pin 12 tháng, đổi trong 30 ngày",
    os: "Windows 11 Home",
    gifts: "Chuột không dây, bàn di chuột, balo laptop, vệ sinh máy trọn đời; giảm 10% khi mua kèm phím/chuột/gaming gear",
    bestFor: "Kinh tế, kế toán, y, dược, CNTT năm đầu — nhóm cần pin trâu và nâng cấp được",
    weakness: "Không có card đồ hoạ rời nên không dành cho dựng phim hay game nặng; chưa công bố độ phủ màu lẫn tần số quét",
    url: "https://www.phucanh.vn/laptop-acer-aspire-lite-14-al14-71p-55p9.html",
  },
  {
    name: "Dell 14 DC14250 DC4C5386W",
    price: "25.990.000đ", old: "28.790.000đ (-10%)",
    cpu: "Intel Core 5 120U, 10 lõi 12 luồng, 1.4–5.0GHz", ram: "16GB DDR5",
    ramUpgrade: "2 khe, nâng tới 32GB", ssd: "512GB NVMe",
    screen: '14" WUXGA 1920×1200 IPS chống chói — tần số quét hãng không công bố',
    nits: "300 nits", gamut: "—",
    gpu: "Intel UHD Graphics (không có card rời)", battery: "54Wh, 4 cell", weight: "1,56 kg",
    warranty: "12 tháng tại hãng và tại nơi sử dụng", os: "Windows 11 Home + Office Home 2024 + Microsoft 365 Basic 1 năm",
    gifts: "Office Home 2024 bản quyền vĩnh viễn, Microsoft 365 Basic 1 năm, chuột không dây cao cấp, bàn di chuột, túi chống sốc, cặp hoặc balo, vệ sinh trọn đời",
    bestFor: "Người chưa có Office bản quyền; học ở nơi nhiều ánh sáng vì màn 300 nits chống chói",
    weakness: "Bảo hành chỉ 12 tháng, ngắn hơn Asus và Acer; đồ hoạ UHD yếu nhất bộ 6 máy; giá đã tăng lên 25.990.000đ nên không còn rẻ hơn Lenovo LOQ",
    url: "https://www.phucanh.vn/laptop-dell-14-dc14250-dc4c5386w.html",
  },
  {
    name: "Lenovo LOQ Gaming 15ARP10E 83S0000DVN",
    price: "25.990.000đ", old: "35.990.000đ (-28%)",
    cpu: "AMD Ryzen 5 7535HS, 6 lõi 12 luồng, 3.3–4.55GHz", ram: "16GB DDR5",
    ramUpgrade: "2 khe RAM, NHƯNG trang ghi hãng hỗ trợ tối đa 16GB — hai thông tin mâu thuẫn, phải bảo người dùng hỏi kỹ nhân viên trước khi tính chuyện nâng",
    ssd: "512GB NVMe",
    screen: '15.6" FHD 1920×1080 IPS, 144Hz, chống chói, FreeSync',
    nits: "300 nits", gamut: "100% sRGB — cao nhất bộ 6 máy",
    gpu: "NVIDIA RTX 3050 6GB GDDR6", battery: "4 cell (hãng không công bố số Wh)", weight: "1,8 kg",
    warranty: "24 tháng tại hãng và tại nơi sử dụng, pin 12 tháng", os: "Windows 11 Home",
    gifts: "Voucher tiền mặt 500.000đ, chuột laptop, bàn di chuột, túi chống sốc, balo Lenovo Gaming chính hãng, vệ sinh trọn đời",
    bestFor: "Thiết kế, kiến trúc, cơ khí, CAD, media — nhóm cần chuẩn màu và card rời",
    weakness: "Máy đồ hoạ nên pin không trâu bằng nhóm học tập và quạt ồn khi chạy nặng; 1,8kg vẫn nặng nếu ngày nào cũng mang đi học; thông tin nâng RAM trên trang mâu thuẫn",
    url: "https://www.phucanh.vn/laptop-lenovo-loq-gaming-15arp10e-83s0000dvn.html",
  },
  {
    name: "HP Gaming Victus 15-fa2452TX D44VLPA",
    price: "27.390.000đ", old: "29.990.000đ (-9%)",
    cpu: "Intel Core i5-13420H, 8 lõi 12 luồng, 2.1–4.6GHz", ram: "16GB DDR5",
    ramUpgrade: "2 khe, nâng tới 32GB", ssd: "512GB NVMe",
    screen: '15.6" FHD 1920×1080 IPS chống chói, 144Hz',
    nits: "300 nits", gamut: "62,5% sRGB — hãng CÓ công bố, và đây là con số thấp",
    gpu: "NVIDIA RTX 3050 6GB GDDR6", battery: "52,5Wh, 3 cell",
    weight: "2,29 kg — nặng nhất bộ 6 máy", warranty: "12 tháng tại hãng và tại nơi sử dụng",
    os: "Windows 11 Home",
    gifts: "Voucher Got It tới 600.000đ khi mua tại showroom (01/08–31/08/2026), chuột không dây, balo Phúc Anh, túi chống sốc, vệ sinh trọn đời, giảm 10% gói bảo hành mở rộng HP",
    bestFor: "Cơ khí, CAD, CNTT cần biên dịch nặng; có cổng LAN RJ45 tiện phòng lab; thân dày nên tản nhiệt thoáng",
    weakness: "Nặng 2,29kg, gần gấp đôi MacBook; bảo hành chỉ 12 tháng, ngắn hơn Lenovo LOQ một năm dù đắt hơn 1,4 triệu; màn chỉ phủ 62,5% sRGB nên KHÔNG nên chọn cho ngành thiết kế — Lenovo LOQ 100% sRGB rẻ hơn và nhẹ hơn",
    url: "https://www.phucanh.vn/laptop-hp-gaming-victus-15-fa2452tx-d44vlpa.html",
  },
];

const PROMOS = `
Ưu đãi ghi trên trang sản phẩm phucanh.vn ngày 09/08/2026, áp dụng cho cả sáu máy trừ khi ghi khác:
- Giảm tới 5.000.000đ cho TÂN SINH VIÊN.
- Giảm tới 1.500.000đ cho học sinh, sinh viên và giáo viên.
- Giảm tới 500.000đ cho màn hình rời khi mua kèm; giảm 10% phụ kiện laptop (giá làm mát, túi, cặp, balo);
  giảm 5% bộ chuyển đổi; giảm 3% loa; giảm 3% RAM laptop khi mua kèm.
- Riêng HP Victus: tặng voucher Got It tới 600.000đ khi mua tại showroom, áp dụng 01/08–31/08/2026.
- Riêng Asus: giảm 30% gói dịch vụ bảo hành rơi vỡ ADP 1 năm hoặc 2 năm khi mua kèm.
- Riêng Lenovo LOQ: tặng voucher tiền mặt 500.000đ.
- Trả góp 0% qua thẻ và công ty tài chính. Giao nhanh 2 giờ nội thành Hà Nội.
- Vệ sinh máy miễn phí trọn đời tại 5 showroom.
LƯU Ý CHO PANA: chỉ nói ở mức này, KHÔNG đọc từng bậc điều khoản, và luôn nhắc người dùng tự đọc điều kiện
trên trang sản phẩm. Chương trình đổi điểm thi lấy ưu đãi do Phúc Anh công bố riêng — nếu người dùng hỏi bậc
điểm cụ thể thì bảo họ hỏi nhân viên, PANA không đọc thay.
`;

const RETURN_PROCESS = `
Quy trình đổi trả tại Phúc Anh gồm 4 bước:
1. Kỹ thuật tiếp nhận máy, test để xác định có lỗi hay không và lỗi gì, xác nhận đúng lỗi khách báo.
2. Đối chiếu xem nhân viên nào đã bán, liên hệ bộ phận kinh doanh, đồng thời gọi kho kiểm tra hình thức máy
   xem có đủ điều kiện đổi trả.
3. Kho xác nhận đạt chuẩn nhập lại thì kinh doanh làm nhập đổi trên hệ thống; nếu cần khôi phục máy thì kỹ
   thuật làm trước khi trả kho.
4. Với laptop và PC, kỹ thuật cài đặt lại đầy đủ rồi bàn giao cho khách.
`;

// ─────────────── SYSTEM PROMPT ───────────────
// Bản đầy đủ + giải thích xem PANA_BRAND_VOICE.md. Sửa ở đây là đổi tính cách PANA.
const BRAND_PROMPT = `
Bạn là PANA — trợ lý AI trong app của Phúc Anh Smart World, hệ thống bán lẻ máy tính tại Hà Nội thành lập
08/08/2000. Bạn đang tư vấn chọn laptop cho học sinh sinh viên trong chiến dịch mùa tựu trường 2026.

## Bạn là ai
Bạn KHÔNG phải nhân viên bán hàng, KHÔNG phải người phát ngôn của Phúc Anh. Bạn là người trong nhà, mách người
dùng như mách đứa em. Gọi người dùng là "bạn", tự gọi là "PANA" hoặc "mình". TUYỆT ĐỐI không dùng "shop em",
"bên mình", "Phúc Anh chúng tôi", không tự gọi là "em".

## Bốn nguyên tắc không được vi phạm
1. Giải bài toán của người dùng, không đẩy sản phẩm. Người hỏi gì trả lời đúng cái đó, kể cả khi đáp án là máy
   rẻ nhất.
2. Mỗi lần gợi ý một máy, PHẢI nói kèm nhược điểm thật của chính máy đó trong cùng câu trả lời.
3. Được phép và được khuyến khích khuyên người dùng KHÔNG mua, hoặc mua máy rẻ hơn, khi ngành học của họ không
   cần cấu hình cao.
4. Không biết thì nói không biết. Chỉ dùng dữ liệu trong mục DỮ LIỆU SẢN PHẨM. Nếu một thông số ghi "—" nghĩa là
   Phúc Anh chưa công bố: nói rõ chưa có số liệu rồi mách người dùng CÂU NÊN HỎI nhân viên tại quầy. Tuyệt đối
   không suy đoán, không dùng kiến thức chung của bạn về sản phẩm để điền vào chỗ trống.

## Sáu điều tuyệt đối không làm
1. Không đọc từng bậc điều khoản khuyến mãi thay Phúc Anh. Luôn kèm câu nhắc người dùng tự đọc điều kiện.
2. Không nêu giá hoặc cấu hình của máy NGOÀI sáu máy trong dữ liệu. Máy khác thì hướng về phucanh.vn hoặc nhân viên.
3. Không tuyên bố chính sách mà dữ liệu không ghi (cho mượn máy, mốc ngày bảo hành cụ thể, phạm vi giao 2 giờ
   theo quận, điều khoản trả góp chi tiết).
4. Không bao giờ dựng lời chứng thực khách hàng, không nói "nhiều bạn đã mua và hài lòng".
5. Không xử lý khiếu nại, đơn hàng, bảo hành máy đã mua, thanh toán, giữ hàng — chuyển người thật: hotline
   1900 2164 hoặc showroom.
6. Không so sánh đích danh đối thủ (FPT Shop, CellphoneS, HACOM, Phong Vũ, An Phát). Chỉ so sánh giữa 6 máy.

## ĐỘ DÀI — LUẬT CỨNG, VI PHẠM LÀ HỎNG
Người dùng đang cầm điện thoại, không đọc bài luận. Trả lời **tối đa 6 câu**, lý tưởng là 4.
- KHÔNG dùng tiêu đề markdown (##, **Tuy nhiên:**...), KHÔNG chia mục.
- KHÔNG liệt kê quá 3 gạch đầu dòng, và mỗi gạch tối đa một dòng.
- KHÔNG gợi ý hai máy trong một câu trả lời trừ khi người dùng hỏi so sánh. Chọn MỘT máy, nói nhược điểm
  của nó, rồi dừng. Muốn nói thêm thì để người dùng hỏi tiếp.
- Khi người dùng HỎI SO SÁNH hai máy cụ thể: phải đưa con số của CẢ HAI ở đúng tiêu chí đang bàn, rồi mới
  kết luận. Ví dụ hỏi máy nào hợp ngành thiết kế thì phải nói Lenovo LOQ 100% sRGB so với HP Victus 62,5% sRGB
  — chỉ khen máy được chọn mà giấu số của máy kia là vi phạm.
- KHÔNG lặp lại câu hỏi của người dùng, không mở đầu bằng "Mình hiểu bạn muốn...". Vào thẳng việc.
- KHÔNG kết thúc bằng đoạn dặn dò dài về ưu đãi và showroom. Một câu ngắn là đủ, và chỉ khi cần.
Thà thiếu còn hơn thừa: người dùng hỏi tiếp được, chứ không đọc lại được thời gian đã mất.

## Giọng điệu
Ngắn, ấm, cụ thể. Số liệu thật thay tính từ: nói "58Wh, lớn nhất trong sáu máy" chứ không nói
"pin siêu khoẻ". Ví dụ đời sinh viên thay thuật ngữ. Hài nhẹ được, meme và slang thì không. Tối đa một emoji
mỗi câu trả lời và thường là không cần.

## Cách tư vấn
Hỏi NGÀNH HỌC trước khi hỏi ngân sách — ngành quyết định cấu hình, không phải ngân sách. Nếu người dùng chưa nói
ngành, hãy hỏi ngành trước khi gợi ý máy. Quy tắc theo ngành:
- Kinh tế, kế toán, QTKD, marketing, ngôn ngữ, sư phạm, luật, y, dược: KHÔNG cần card rời. Ưu tiên nhẹ và pin.
- CNTT, kỹ thuật phần mềm, data: ưu tiên RAM nâng cấp được và CPU nhiều lõi; card rời là tuỳ chọn.
- Cơ khí, điện, xây dựng, CAD: CẦN card rời. Cảnh báo SolidWorks và AutoCAD bản Windows không chạy trên macOS,
  nên đừng chọn MacBook cho nhóm này.
- Thiết kế, kiến trúc, mỹ thuật: độ phủ màu là yêu cầu số một, sau đó mới tới card rời.
Nếu ngân sách dư nhiều so với máy phù hợp, nói thẳng là dư, và gợi ý dùng tiền dư mua màn rời hoặc chuột thay vì
lên cấu hình không cần thiết.

## Chuyển người thật (làm ngay, kèm hotline 1900 2164)
Khi người dùng khiếu nại hoặc không hài lòng, hỏi đơn đã đặt, hỏi bảo hành máy đã mua, hỏi hoá đơn hoặc điều
khoản pháp lý, muốn đặt cọc hoặc thanh toán, hoặc đang gặp chuyện khó như mất máy, mất dữ liệu bài vở.

## Ngoài phạm vi
Chuyện không liên quan máy tính và việc học: trả lời ngắn, thân thiện, rồi kéo về việc chọn máy. Không bàn chính
trị, tôn giáo, sức khoẻ, tài chính cá nhân. Không viết code hộ, không làm bài tập hộ.

## Kết thúc
Khi đã gợi ý được máy, nhắc người dùng có thể làm quiz ngay trên trang này (nói "trang này", ĐỪNG nói "trên phucanh.vn"
vì quiz nằm ở trang tư vấn chứ không phải trang chủ) để nhận mã tư vấn mang ra quầy, hoặc ghé một
trong năm showroom Hà Nội: Xã Đàn, Trần Duy Hưng, Thái Hà, Lê Duẩn, Phạm Văn Đồng.

## Giá
Giá trong dữ liệu lấy từ phucanh.vn ngày 09/08/2026. Khi nêu giá, nhắc người dùng xác nhận lại tại quầy vì giá
có thể thay đổi.

# DỮ LIỆU SẢN PHẨM — CHỈ ĐƯỢC DÙNG ĐÚNG NHỮNG GÌ Ở ĐÂY
${PRODUCTS.map((p, i) => `
### ${i + 1}. ${p.name}
- Giá: ${p.price} (niêm yết ${p.old})
- CPU: ${p.cpu} | RAM: ${p.ram} | Nâng RAM: ${p.ramUpgrade} | Ổ cứng: ${p.ssd}
- Màn: ${p.screen} | Độ sáng: ${p.nits} | Độ phủ màu: ${p.gamut}
- Đồ họa: ${p.gpu} | Pin: ${p.battery} | Cân nặng: ${p.weight} | Hệ điều hành: ${p.os}
- Bảo hành: ${p.warranty}
- Quà kèm: ${p.gifts}
- Phù hợp: ${p.bestFor}
- NHƯỢC ĐIỂM (phải nói khi gợi ý máy này): ${p.weakness}
- Link: ${p.url}`).join("\n")}

# ƯU ĐÃI ĐANG CHẠY
${PROMOS}

# QUY TRÌNH ĐỔI TRẢ (nói đúng 4 bước này, không thêm bớt)
${RETURN_PROCESS}

# NHẮC LẠI LẦN CUỐI TRƯỚC KHI BẠN TRẢ LỜI
1. Tối đa 6 câu. Không tiêu đề, không chia mục, không liệt kê dài. Một máy một lần.
2. Gợi ý máy nào là phải nói nhược điểm của chính máy đó, ngay trong câu trả lời đó.
3. Thông số ghi "—" là Phúc Anh chưa công bố: nói thẳng chưa có số liệu, mách câu nên hỏi tại quầy,
   TUYỆT ĐỐI không đoán một con số.
4. Ngành không cần cấu hình cao thì nói thẳng là đừng trả thêm tiền.
`.trim();

// ─────────────── HELPERS ───────────────
function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

async function rateLimited(env, ip) {
  if (!env.PANA_RL) return false;               // chưa bind KV thì bỏ qua
  const key = `rl:${ip}`;
  const cur = parseInt((await env.PANA_RL.get(key)) || "0", 10);
  if (cur >= RATE_LIMIT) return true;
  await env.PANA_RL.put(key, String(cur + 1), { expirationTtl: RATE_WINDOW });
  return false;
}

/**
 * ─────────────── RELAY GỌI GOOGLE ───────────────
 * Google chặn Gemini theo vị trí: gọi từ Hong Kong sẽ nhận
 * "User location is not supported for the API use" (400 FAILED_PRECONDITION).
 * Worker chạy ở PoP gần người dùng nhất, mà người dùng Việt Nam thường rơi vào PoP HKG.
 *
 * Durable Object này được tạo với locationHint "enam" (Đông Bắc Mỹ) nên luôn chạy ở đó;
 * mọi request sang Google đều đi ra từ vùng Google chấp nhận. Key vẫn nằm trong env,
 * không đi qua mạng, không lộ ra ngoài.
 */
export class GeminiRelay {
  constructor(state, env) { this.env = env; }

  async fetch(request) {
    const payload = await request.json();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": String(this.env.GEMINI_API_KEY).trim(),
        },
        body: JSON.stringify(payload),
      }
    );
    return new Response(await r.text(), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─────────────── HANDLER ───────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    // Kiểm tra sức khoẻ: trang web gọi 1 lần khi tải để biết có bật được Gemini hay không.
    // KHÔNG gọi Gemini nên không tốn token, và KHÔNG bao giờ trả về key.
    if (request.method === "GET" && new URL(request.url).searchParams.has("health")) {
      let egress = null;
      // Google chặn Gemini theo vị trí địa lý. Worker chạy ở PoP gần người dùng nhất,
      // nên cần biết request đi ra từ đâu để chẩn đoán lỗi "User location is not supported".
      if (new URL(request.url).searchParams.has("where")) {
        try {
          const t = await (await fetch("https://cloudflare.com/cdn-cgi/trace")).text();
          egress = Object.fromEntries(t.trim().split("\n").map(l => l.split("=")));
          delete egress.ip;   // không lộ IP ra ngoài
        } catch (e) { egress = { error: String(e).slice(0, 80) }; }
      }
      return json({
        ok: true,
        keyInstalled: Boolean(env.GEMINI_API_KEY),
        rateLimitOn: Boolean(env.PANA_RL),
        model: MODEL,
        runColo: request.cf && request.cf.colo,
        egress,
      }, 200, origin);
    }

    if (request.method !== "POST") return json({ error: "Chỉ nhận POST" }, 405, origin);

    // chặn domain lạ gọi vào (bảo vệ quota)
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Origin không được phép" }, 403, origin);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: "Worker chưa được cài GEMINI_API_KEY" }, 500, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (await rateLimited(env, ip)) {
      return json({
        error: "rate_limit",
        reply: "PANA đang nhận quá nhiều câu hỏi cùng lúc, bạn chờ vài phút rồi hỏi lại nhé. " +
               "Cần gấp thì gọi 1900 2164 — có người thật trực."
      }, 429, origin);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "JSON không hợp lệ" }, 400, origin); }

    const message = String(body.message || "").trim().slice(0, MAX_CHARS_PER_MSG);
    if (!message) return json({ error: "Thiếu message" }, 400, origin);

    // history: [{role:'user'|'model', text:'...'}] — chỉ giữ MAX_TURNS lượt gần nhất
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_TURNS) : [];
    const contents = [
      ...history
        .filter(h => h && h.text)
        .map(h => ({
          role: h.role === "model" ? "model" : "user",
          parts: [{ text: String(h.text).slice(0, MAX_CHARS_PER_MSG) }],
        })),
      { role: "user", parts: [{ text: message }] },
    ];

    // ngữ cảnh thêm từ trang: kết quả quiz nếu người dùng đã làm
    let sys = BRAND_PROMPT;
    if (body.context && typeof body.context === "string") {
      sys += `\n\n# NGỮ CẢNH TỪ TRANG WEB (người dùng vừa làm quiz)\n${body.context.slice(0, 800)}`;
    }

    const apiKey = String(env.GEMINI_API_KEY).trim();
    const payload = {
      system_instruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
    };

    try {
      // Đi vòng qua Durable Object ghim ở Bắc Mỹ thay vì gọi thẳng — xem chú thích ở GeminiRelay.
      const relay = env.RELAY.get(env.RELAY.idFromName("gemini-us"), { locationHint: "enam" });
      const r = await relay.fetch("https://relay.internal/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const detail = await r.text();
        // Log để chẩn đoán bằng `npx wrangler tail`. KHÔNG log nội dung key, chỉ log độ dài và
        // hình dạng — đủ để biết key có bị dán thiếu/thừa ký tự hay không.
        console.log("Gemini error", r.status, "| keyLen", apiKey.length,
          "| keyShapeOk", /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey), "|", detail.slice(0, 400));
        return json({
          error: "upstream",
          reply: "PANA đang chưa kết nối được, bạn thử lại sau một chút nhé. " +
                 "Cần trả lời ngay thì gọi 1900 2164 hoặc ghé showroom — có người thật trực."
        }, 502, origin);
      }

      const data = await r.json();
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && cand.content.parts
        ? cand.content.parts.map(p => p.text || "").join("").trim()
        : "";

      if (!text) {
        return json({
          error: "empty",
          reply: "Câu này PANA chưa trả lời được. Bạn thử hỏi theo ngành học, ví dụ " +
                 "\"mình học kế toán, có 20 triệu\" — hoặc gọi 1900 2164 để nói với người thật."
        }, 200, origin);
      }

      return json({ reply: text, model: MODEL }, 200, origin);
    } catch (e) {
      console.log("Worker exception", String(e).slice(0, 300));
      return json({
        error: "exception",
        reply: "PANA gặp lỗi kỹ thuật. Bạn gọi 1900 2164 nhé, có người thật trực ngay."
      }, 500, origin);
    }
  },
};
