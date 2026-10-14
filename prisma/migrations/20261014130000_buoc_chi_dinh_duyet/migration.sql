-- Chỉ định phòng / người duyệt cho từng bước quy trình. Trống = Ban giám đốc duyệt như cũ.
ALTER TABLE "BuocQuyTrinh" ADD COLUMN "duyetBoPhan" TEXT;
ALTER TABLE "BuocQuyTrinh" ADD COLUMN "duyetNguoiId" TEXT;
