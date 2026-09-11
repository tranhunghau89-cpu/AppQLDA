/**
 * Chín ô IN RA bản báo giá gửi khách nhưng trước đây không để lại dấu vết nào trên
 * màn hình: SĐT khách, địa điểm, họ tên / SĐT / email người phụ trách…
 *
 * Để trống thì bản in vẫn ra, chỉ thiếu chỗ đó — và người lập biết được sau khi khách
 * đã cầm tờ giấy. Nên dải nhập ở đầu mỗi bản báo giá bày cả chín ô ra thành bảng và
 * đếm số ô còn trống ngay trong lúc gõ.
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
