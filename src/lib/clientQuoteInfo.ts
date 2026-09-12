/**
 * Các ô IN RA bản báo giá gửi khách nhưng trước đây không để lại dấu vết nào trên màn
 * hình: SĐT khách, địa điểm…
 *
 * Để trống thì bản in vẫn ra, chỉ thiếu chỗ đó — và người lập biết được sau khi khách
 * đã cầm tờ giấy. Nên dải nhập ở đầu mỗi bản báo giá bày chúng ra thành bảng và đếm số
 * ô còn trống ngay trong lúc gõ.
 *
 * Dải này chỉ còn những ô VỀ KHÁCH, tức thứ chỉ người lập mới biết. Người phụ trách,
 * ngày báo giá và hiệu lực đã lùi vào "Mục khác…" vì chúng tự điền đúng ở gần như mọi
 * bản — đếm chúng là làm huy hiệu kêu vì những thứ không ai cần sửa.
 */

/**
 * Số ô còn trống.
 *
 * Gõ nhầm một dấu cách rồi lưu thì trên giấy vẫn là chỗ trống, nên chuỗi toàn khoảng
 * trắng tính là chưa điền. Ngược lại, số 0 ở ô hiệu lực là giá trị thật.
 */
export function demOTrong(giaTri: string[]): number {
  return giaTri.filter((v) => !v.trim()).length;
}
