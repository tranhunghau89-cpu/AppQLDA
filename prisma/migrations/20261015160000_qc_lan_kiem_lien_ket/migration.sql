-- Bằng chứng dạng liên kết cho một lần kiểm QC (trang trong app hoặc link ngoài).
ALTER TABLE "QcLanKiem" ADD COLUMN "lienKet" TEXT;
ALTER TABLE "QcLanKiem" ADD COLUMN "lienKetTen" TEXT;
