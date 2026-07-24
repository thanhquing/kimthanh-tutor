-- Prisma schema does not support partial unique indexes. Keep exactly one
-- default payout account per tutor at the database level.
--
-- Repair legacy data first: preserve an existing default where possible;
-- otherwise promote the oldest payout account for that tutor.
WITH ranked_accounts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tutor_profile_id
      ORDER BY is_default DESC, created_at ASC, id ASC
    ) AS default_rank
  FROM tutor_payout_accounts
)
UPDATE tutor_payout_accounts AS account
SET is_default = ranked_accounts.default_rank = 1
FROM ranked_accounts
WHERE account.id = ranked_accounts.id
  AND account.is_default IS DISTINCT FROM (ranked_accounts.default_rank = 1);

CREATE UNIQUE INDEX IF NOT EXISTS tutor_payout_accounts_one_default_per_tutor
  ON tutor_payout_accounts (tutor_profile_id)
  WHERE is_default;
