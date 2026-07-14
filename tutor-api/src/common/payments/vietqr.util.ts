// Sinh VietQR (chuẩn NAPAS 247) — miễn phí, không phụ thuộc bên thứ ba.
// Dùng ảnh QR của img.vietqr.io: render tại client từ URL trả về.
// Xem ai-docs/07-payments-and-monetization.md.

export interface VietQrParams {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: bigint | number;
  addInfo: string; // nội dung chuyển khoản (mã đơn / mô tả)
  template?: string; // compact | compact2 | qr_only | print
}

export function vietQrImageUrl(p: VietQrParams): string {
  const template = p.template ?? 'compact2';
  const base = `https://img.vietqr.io/image/${encodeURIComponent(
    p.bankCode,
  )}-${encodeURIComponent(p.accountNumber)}-${template}.png`;
  const qs = new URLSearchParams({
    amount: p.amount.toString(),
    addInfo: p.addInfo,
    accountName: p.accountName,
  });
  return `${base}?${qs.toString()}`;
}

// Nội dung chuyển khoản duy nhất cho một Payment (map vào provider_reference).
// Webhook ngân hàng đối chiếu chuỗi này để biết đơn nào đã trả.
export function providerReference(paymentId: string): string {
  return `KTT${paymentId.slice(-12).toUpperCase()}`;
}

// Trích provider_reference (KTT+12) từ nội dung chuyển khoản webhook gửi lên.
export function extractProviderReference(content: string): string | null {
  const m = content.toUpperCase().match(/KTT[0-9A-Z]{12}/);
  return m ? m[0] : null;
}
