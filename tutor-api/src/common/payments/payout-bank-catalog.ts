/**
 * Danh mục ngân hàng được phép nhận học phí qua VietQR. Danh sách có thể cấu
 * hình theo triển khai bằng `PAYOUT_BANK_CATALOG`; client luôn đọc qua API,
 * không tự nhận mã ngân hàng tùy ý.
 */
export interface PayoutBankCatalogItem {
  bank_code: string;
  name: string;
}

const DEFAULT_PAYOUT_BANK_CATALOG: readonly PayoutBankCatalogItem[] = [
  { bank_code: '970436', name: 'Vietcombank' },
  { bank_code: '970415', name: 'VietinBank' },
  { bank_code: '970418', name: 'BIDV' },
  { bank_code: '970422', name: 'MB Bank' },
  { bank_code: '970407', name: 'Techcombank' },
  { bank_code: '970423', name: 'TPBank' },
  { bank_code: '970432', name: 'VPBank' },
  { bank_code: '970403', name: 'Sacombank' },
  { bank_code: '970405', name: 'Agribank' },
];

/**
 * Cú pháp biến môi trường: `970436|Vietcombank,970415|VietinBank`.
 * Chỉ dùng BIN NAPAS sáu chữ số để URL VietQR ổn định, tránh alias tự do.
 */
export function parsePayoutBankCatalog(raw?: string): PayoutBankCatalogItem[] {
  if (!raw?.trim()) return DEFAULT_PAYOUT_BANK_CATALOG.map((item) => ({ ...item }));

  const seen = new Set<string>();
  return raw.split(',').map((entry) => {
    const [bankCode, name, ...rest] = entry.split('|').map((part) => part.trim());
    if (
      rest.length > 0 ||
      !/^\d{6}$/.test(bankCode ?? '') ||
      !name ||
      name.length > 80 ||
      seen.has(bankCode)
    ) {
      throw new Error(
        'PAYOUT_BANK_CATALOG phải có dạng "970436|Vietcombank,970415|VietinBank" với BIN NAPAS duy nhất',
      );
    }
    seen.add(bankCode);
    return { bank_code: bankCode, name };
  });
}
