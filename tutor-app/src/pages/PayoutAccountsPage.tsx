import type { TutorPayoutAccount, TutorPayoutBank } from "@kimthanh-tutor/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, LockKeyhole, Plus } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { payoutAccountsApi } from "../lib/api/payout-accounts";
import { ApiClientError } from "../lib/api/errors";
import {
  EMPTY_PAYOUT_ACCOUNT_FORM,
  hasPayoutAccountFormErrors,
  toPayoutAccountPayload,
  type PayoutAccountForm,
  type PayoutAccountFormErrors,
  validatePayoutAccountForm,
} from "../lib/payout-accounts/payout-accounts";

const ACCOUNTS_QUERY_KEY = ["tutor-payout-accounts"] as const;
const BANKS_QUERY_KEY = ["tutor-payout-banks"] as const;
const EMPTY_ACCOUNTS: TutorPayoutAccount[] = [];
const EMPTY_BANKS: TutorPayoutBank[] = [];
type AccountsData = { items: TutorPayoutAccount[] };

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError || error instanceof Error) return error.message;
  return fallback;
}

function AddPayoutAccountDialog({
  banks,
  accountCount,
  submitting,
  onClose,
  onSubmit,
}: {
  banks: TutorPayoutBank[];
  accountCount: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: PayoutAccountForm) => void;
}) {
  const firstAccount = accountCount === 0;
  const [form, setForm] = useState<PayoutAccountForm>({
    ...EMPTY_PAYOUT_ACCOUNT_FORM,
    is_default: firstAccount,
  });
  const [errors, setErrors] = useState<PayoutAccountFormErrors>({});
  const supportedBankCodes = useMemo(() => new Set(banks.map((bank) => bank.bank_code)), [banks]);

  function patch<K extends keyof PayoutAccountForm>(key: K, value: PayoutAccountForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validatePayoutAccountForm(form, supportedBankCodes);
    setErrors(nextErrors);
    if (hasPayoutAccountFormErrors(nextErrors)) return;
    onSubmit(form);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-payout-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2 id="add-payout-title">Thêm tài khoản nhận học phí</h2>
          <button type="button" className="icon-remove" aria-label="Đóng" onClick={onClose} disabled={submitting}>×</button>
        </div>
        <form className="modal-body form-stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="payout-bank-code">Ngân hàng</label>
            <select id="payout-bank-code" value={form.bank_code} onChange={(event) => patch("bank_code", event.target.value)} aria-describedby={errors.bank_code ? "payout-bank-error" : undefined} aria-invalid={!!errors.bank_code}>
              <option value="">Chọn ngân hàng</option>
              {banks.map((bank) => <option key={bank.bank_code} value={bank.bank_code}>{bank.name}</option>)}
            </select>
            {errors.bank_code && <em id="payout-bank-error" className="field-error">{errors.bank_code}</em>}
          </div>
          <div className="field">
            <label htmlFor="payout-account-number">Số tài khoản</label>
            <input
              value={form.account_number}
              id="payout-account-number"
              inputMode="numeric"
              autoComplete="off"
              maxLength={24}
              placeholder="Nhập số tài khoản"
              onChange={(event) => patch("account_number", event.target.value)}
              aria-describedby={errors.account_number ? "payout-account-hint payout-account-number-error" : "payout-account-hint"}
              aria-invalid={!!errors.account_number}
            />
            <em id="payout-account-hint" className="field-hint">Số này chỉ dùng để tạo QR; sau khi lưu, hệ thống chỉ hiển thị số đã che.</em>
            {errors.account_number && <em id="payout-account-number-error" className="field-error">{errors.account_number}</em>}
          </div>
          <div className="field">
            <label htmlFor="payout-account-holder">Tên chủ tài khoản</label>
            <input
              value={form.account_holder}
              id="payout-account-holder"
              autoComplete="off"
              maxLength={120}
              placeholder="Theo thông tin ngân hàng"
              onChange={(event) => patch("account_holder", event.target.value)}
              aria-describedby={errors.account_holder ? "payout-account-holder-error" : undefined}
              aria-invalid={!!errors.account_holder}
            />
            {errors.account_holder && <em id="payout-account-holder-error" className="field-error">{errors.account_holder}</em>}
          </div>
          <label className="payout-default-field" htmlFor="payout-account-default">
            <input id="payout-account-default" type="checkbox" checked={form.is_default} disabled={firstAccount} onChange={(event) => patch("is_default", event.target.checked)} />
            <span>
              Đặt làm tài khoản mặc định
              {firstAccount && <small>Tài khoản đầu tiên luôn là mặc định.</small>}
            </span>
          </label>
          <p className="payout-privacy-note"><LockKeyhole size={16} aria-hidden="true" /> Không chia sẻ số tài khoản đầy đủ qua ảnh chụp hoặc tin nhắn.</p>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>Hủy</button>
            <button type="submit" className="button primary" disabled={submitting}>{submitting ? "Đang lưu…" : "Lưu tài khoản"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function PayoutAccountsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const accountsQuery = useQuery({ queryKey: ACCOUNTS_QUERY_KEY, queryFn: () => payoutAccountsApi.list() });
  const banksQuery = useQuery({ queryKey: BANKS_QUERY_KEY, queryFn: () => payoutAccountsApi.listBanks() });
  const accounts = accountsQuery.data?.items ?? EMPTY_ACCOUNTS;
  const banks = banksQuery.data?.items ?? EMPTY_BANKS;
  const bankNames = useMemo(() => new Map(banks.map((bank) => [bank.bank_code, bank.name])), [banks]);

  const createMutation = useMutation({
    mutationFn: (form: PayoutAccountForm) => payoutAccountsApi.create(toPayoutAccountPayload(form)),
    onSuccess: (created) => {
      queryClient.setQueryData<AccountsData>(ACCOUNTS_QUERY_KEY, (current) => ({
        items: [
          created,
          ...(current?.items ?? []).map((account) => created.is_default ? { ...account, is_default: false } : account),
        ],
      }));
      setDialogOpen(false);
      setBanner({ tone: "ok", text: "Đã lưu tài khoản nhận học phí. Số tài khoản chỉ còn được hiển thị ở dạng che." });
    },
    onError: (error) => setBanner({ tone: "danger", text: errorText(error, "Không lưu được tài khoản nhận học phí.") }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }),
  });
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => payoutAccountsApi.setDefault(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<AccountsData>(ACCOUNTS_QUERY_KEY, (current) => ({
        items: [updated, ...(current?.items ?? []).filter((account) => account.id !== updated.id).map((account) => ({ ...account, is_default: false }))],
      }));
      setBanner({ tone: "ok", text: "Đã đặt tài khoản nhận tiền mặc định." });
    },
    onError: (error) => setBanner({ tone: "danger", text: errorText(error, "Không đổi được tài khoản mặc định.") }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }),
  });

  const canAdd = !accountsQuery.isLoading && !banksQuery.isLoading && !banksQuery.isError && banks.length > 0;

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Thiết lập nhận học phí</p>
          <h1>Tài khoản nhận tiền</h1>
          <p>Chọn tài khoản ngân hàng để dùng khi tạo QR học phí cho phụ huynh.</p>
        </div>
        <button type="button" className="button primary payout-add-button" disabled={!canAdd} onClick={() => { setBanner(null); setDialogOpen(true); }}><Plus size={17} /> Thêm tài khoản</button>
      </header>

      <section className="payout-disclaimer" aria-label="Lưu ý về học phí">
        <Landmark size={20} aria-hidden="true" />
        <div><strong>Nền tảng không thu hộ học phí.</strong><span>Tiền chuyển thẳng vào tài khoản của bạn; bạn tự đối chiếu với ngân hàng trước khi đánh dấu đã thu.</span></div>
      </section>

      {banner && <p className={`profile-banner tone-${banner.tone}`} role={banner.tone === "danger" ? "alert" : "status"}>{banner.text}</p>}

      {accountsQuery.isLoading ? <div className="panel"><LoadingState label="Đang tải tài khoản nhận tiền…" /></div> : accountsQuery.isError ? (
        <div className="panel"><ErrorState title="Không tải được tài khoản" message="Tài khoản nhận học phí tạm thời không tải được." actionLabel="Thử lại" onAction={() => void accountsQuery.refetch()} /></div>
      ) : (
        <section className="panel payout-panel">
          <div className="panel-head"><div><h2>Tài khoản đã lưu</h2><p className="panel-sub">Số tài khoản luôn được che để bảo vệ thông tin của bạn.</p></div></div>
          {accounts.length === 0 ? <EmptyState title="Chưa có tài khoản nhận tiền" message="Thêm tài khoản ngân hàng để sẵn sàng tạo QR học phí." action={<button type="button" className="button primary" disabled={!canAdd} onClick={() => setDialogOpen(true)}>Thêm tài khoản đầu tiên</button>} /> : (
            <ul className="payout-account-list">
              {accounts.map((account) => <li key={account.id} className="payout-account-row">
                <Landmark size={20} aria-hidden="true" />
                <div><strong>{bankNames.get(account.bank_code) ?? `Ngân hàng ${account.bank_code}`}</strong><span>{account.account_number_masked} · {account.account_holder}</span></div>
                {account.is_default && <span className="status-chip">Mặc định</span>}
                {!account.is_default && <button type="button" className="button secondary small" disabled={setDefaultMutation.isPending} onClick={() => { setBanner(null); setDefaultMutation.mutate(account.id); }}>Đặt mặc định</button>}
              </li>)}
            </ul>
          )}
          {banksQuery.isError && <p className="payout-catalog-error" role="alert">Không tải được danh mục ngân hàng nên bạn chưa thể thêm tài khoản. <button type="button" className="text-button" onClick={() => void banksQuery.refetch()}>Thử lại</button></p>}
        </section>
      )}

      {dialogOpen && <AddPayoutAccountDialog banks={banks} accountCount={accounts.length} submitting={createMutation.isPending} onClose={() => { if (!createMutation.isPending) setDialogOpen(false); }} onSubmit={(form) => createMutation.mutate(form)} />}
    </>
  );
}
