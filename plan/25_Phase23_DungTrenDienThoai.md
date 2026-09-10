# Phase 23 — Dùng được trên điện thoại

> Ngày 2026-09-10. Theo `plan/23_RaSoat_KeHoachNangCap.md` mục Phase 23.
> Trạng thái: **code hoàn tất, chưa commit**; đã qua typecheck / lint / test / build.
> Chưa xác minh trực quan các trang sau đăng nhập.

Bối cảnh: rà soát tháng 9 đếm được **37 breakpoint** trên ~60 file TSX — app thực tế
chỉ dùng được trên máy bàn. Với app quản lý thi công kết cấu thép, việc chỉ huy công
trường không mở được trên điện thoại là hạn chế nghiệp vụ lớn nhất còn lại.

Sau Phase 23: **111 breakpoint**.

---

## 23.1 Khung ứng dụng đáp ứng

**`src/components/layout/AppShell.tsx`** (mới) giữ trạng thái ngăn kéo, bọc luôn
`ToastProvider` + `ConfirmProvider`.

| | `< lg` | `≥ lg` |
|---|---|---|
| Sidebar | ngăn kéo trượt từ trái, `w-64`, nền mờ bấm để đóng | cột cố định `w-60`, `sticky top-0 h-dvh` |
| Mở/đóng | nút ☰ ở Topbar · Esc · bấm nền mờ · chuyển trang | luôn hiện |
| Cuộn trang | tự nhiên (`min-h-dvh`) | như cũ |

Chi tiết đáng lưu ý:

- **Không dùng `useEffect` + `setState` để đóng ngăn kéo khi chuyển trang.** Lưu
  `openedAt = pathname` lúc mở, rồi `open = openedAt === pathname`. Chuyển trang là
  `open` tự thành `false`. Cách cũ vi phạm `react-hooks/set-state-in-effect` của React 19
  (render dây chuyền).
- Bỏ `h-screen overflow-hidden` cứng ở `(app)/layout.tsx` — nó khóa chiều cao và làm
  thanh địa chỉ của trình duyệt điện thoại che mất nội dung.
- Khóa cuộn `document.body` khi ngăn kéo mở, trả lại giá trị cũ khi đóng.

**Thang z-index chuẩn hóa** (trước đây ngăn kéo và nút Nhập nhanh cùng `z-40`, đè nhau):

```
Topbar 20  <  nút Nhập nhanh 30  <  nền mờ 40  <  ngăn kéo 50  <  modal 60  <  toast 70
```

## 23.2 Bảng dùng được trên màn hẹp

Thêm prop `hideBelow` vào `Th`/`Td` trong `src/components/ui/table.tsx`:

```tsx
<Th hideBelow="lg">CĐT</Th>
<Td hideBelow="lg">{p.customerName}</Td>
```

Chọn cách này thay vì viết lại từng bảng thành thẻ (card): ít rủi ro hơn nhiều, giữ
nguyên trải nghiệm desktop, và bảng vẫn cuộn ngang được như cũ. Cuộn 8–10 cột trên
màn 375px mới là thứ không dùng nổi.

**46 cột** được ẩn có kiểm soát trên 6 bảng: Dự án · Đơn hàng · Hợp đồng · Tổng hợp
chi phí · Dự toán · Báo giá.

> Rủi ro của cách này là ẩn lệch `Th` với `Td` → vỡ toàn bộ căn cột. Đã viết script
> đối chiếu thứ tự breakpoint của `Th` và `Td` từng bảng; cả 6 khớp 100%.
> Nên chạy lại kiểm tra đó mỗi khi thêm/bớt cột.

**`ProgressBoard`** (`/weekly` — màn hình chính của chỉ huy công trường) là bảng thô,
0 breakpoint. Nay ẩn 3 cột (Trạng thái / Mốc công việc / Ghi chú mới nhất) và **gộp
trạng thái + số mốc vào ngay dưới tên dự án** trên màn hẹp, để không mất thông tin.

**35 lưới** `grid-cols-2|3|4` cố định → `grid-cols-1 sm:grid-cols-N` (với 4+ thì
`grid-cols-2 sm:grid-cols-N`). Chủ yếu là form trong modal — trước đây vỡ trên điện thoại.

## 23.3 Trạng thái tải & lỗi

Trước đây `src/app` có **0** file `loading` / `error` / `not-found`.

- `(app)/loading.tsx` — skeleton (tiêu đề, 4 thẻ số, 6 dòng bảng), `aria-busy`.
- `(app)/error.tsx` — thay màn hình lỗi trắng của Next: thông điệp tiếng Việt, mã
  `digest`, nút **Thử lại** (`reset()`) và **Về Tổng quan**.
- `(app)/not-found.tsx` — thông điệp khớp với cơ chế chặn theo phạm vi dự án của
  Phase 21 ("không tồn tại, hoặc không thuộc phạm vi dự án bạn được phân công").

## 23.4 Bỏ hết hộp thoại gốc của trình duyệt

| Trước | Sau | Số lượng |
|---|---|---|
| `alert(res.error)` | `toast.error(res.error)` | 23 |
| `window.confirm(...)` | `await confirm(...)` → modal | 23 |
| `window.prompt(...)` | form trong modal | 3 |

**`src/components/ui/toast.tsx`** — `ToastProvider` + `useToast()`. Vùng thông báo có
`role="status"` + `aria-live="polite"`. Lỗi giữ 8 giây (đủ đọc), thành công 3 giây.
Trên điện thoại trải ngang phía trên; từ `sm` là cột hẹp góc phải.

**`src/components/ui/confirm.tsx`** — `ConfirmProvider` + `useConfirm()` trả về
`Promise<boolean>`, nên thay thế gần như trực tiếp:

```ts
if (!(await confirm(`Xóa CĐT "${c.name}"?`))) return;
```

Hai luồng `prompt` đáng kể được thay bằng form thật:

- **Ghi nhận đã thu / đã trả** (`Payments.tsx`): trước đây hai hộp `prompt` liên tiếp
  hỏi ngày rồi hỏi số tiền — trên điện thoại gần như không nhập nổi ngày. Nay là modal
  có `<input type="date">` và ô số tiền, đều có nhãn và gợi ý "bỏ trống = ...".
- **Duyệt / từ chối đề xuất** (`ProposalBoard.tsx`): modal có `<textarea>`, bắt buộc
  nhập lý do khi từ chối (`required`).

## 23.5 Accessibility

- **16 nút chỉ có icon** được gắn `aria-label` (lấy từ `title` sẵn có).
- **Modal**: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; bẫy focus bằng
  Tab/Shift-Tab; Esc để đóng; focus vào phần tử đầu khi mở và **trả về chỗ cũ khi đóng**;
  khóa cuộn nền. Trên điện thoại modal dán đáy màn hình (`rounded-t-2xl`, `max-h-[92dvh]`,
  thân cuộn được) thay vì hộp giữa bị tràn.
- Sidebar có `aria-label="Điều hướng chính"`; nút ☰ có `aria-controls`.

## 23.6 Ảnh hiện trường — đã có sẵn

Mục này trong kế hoạch hóa ra **không cần làm**: `addProjectNote` đã nhận ảnh (tối đa
5 ảnh, 5MB/ảnh, lưu Supabase Storage), và cả `/weekly` lẫn trang chi tiết dự án đều
đã có ô upload.

Cân nhắc và **cố ý không thêm** `capture="environment"` vào ô chọn file: thuộc tính đó
ép mở thẳng camera và bỏ mất lựa chọn lấy ảnh từ thư viện. `accept="image/*"` hiện tại
đã cho người dùng chọn cả hai trên Android lẫn iOS.

---

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 lỗi, 0 cảnh báo |
| `npm test` | ✅ 129/129 |
| `npm run build` | ✅ compiled successfully |
| Đối chiếu `Th`/`Td` `hideBelow` | ✅ 6/6 bảng khớp |
| Không còn `alert`/`confirm`/`prompt` gốc | ✅ 0 nơi |
| Trang `/login` ở 375px | ✅ |

**Chưa kiểm chứng:** các trang sau đăng nhập ở kích thước điện thoại (ngăn kéo, bảng
đã ẩn cột, toast, modal xác nhận). Cần đăng nhập bằng tài khoản thật.

## Việc còn lại

- Kiểm tra trực quan ở 375px và 768px: `/`, `/projects`, `/projects/[id]`, `/weekly`,
  `/purchases` — mở/đóng ngăn kéo, xóa một bản ghi (modal xác nhận), gây một lỗi để
  thấy toast.
- Cân nhắc cho Phase sau: dạng thẻ (card) thật cho `/purchases` và `/projects` trên
  màn rất hẹp, nếu việc ẩn cột vẫn chưa đủ.
- `PurchaseEditor` (863 dòng) và `QuoteEditor` (820 dòng) có nhiều bảng lồng nhau chưa
  được rà kỹ ở màn hẹp — hai trang này nặng nhất, để riêng một đợt.
