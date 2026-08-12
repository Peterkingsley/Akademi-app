CREATE TYPE "KoinLedgerType" AS ENUM ('PURCHASE', 'REWARD_SENT', 'REWARD_RECEIVED', 'STAKE', 'POOL_CONTRIBUTION', 'PRIZE_WIN', 'POOL_REFUND', 'WITHDRAWAL', 'WITHDRAWAL_REFUND', 'ADMIN_ADJUSTMENT');
CREATE TYPE "KoinPoolStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "KoinWithdrawalStatus" AS ENUM ('PENDING_VERIFICATION', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'CANCELLED');
CREATE TYPE "KoinPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

ALTER TABLE "users" ADD COLUMN "date_of_birth" TIMESTAMP(3);

CREATE TABLE "koin_wallets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "koin_wallets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_wallets_balance_nonnegative" CHECK ("balance" >= 0)
);
CREATE UNIQUE INDEX "koin_wallets_user_id_key" ON "koin_wallets"("user_id");

CREATE TABLE "koin_ledger_entries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "KoinLedgerType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "related_user_id" TEXT,
  "competition_id" TEXT,
  "tournament_id" TEXT,
  "pool_id" TEXT,
  "purchase_id" TEXT,
  "withdrawal_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "koin_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_ledger_balance_nonnegative" CHECK ("balance_after" >= 0),
  CONSTRAINT "koin_ledger_amount_nonzero" CHECK ("amount" <> 0)
);
CREATE UNIQUE INDEX "koin_ledger_entries_reference_key" ON "koin_ledger_entries"("reference");
CREATE INDEX "koin_ledger_entries_user_id_created_at_idx" ON "koin_ledger_entries"("user_id", "created_at");
CREATE INDEX "koin_ledger_entries_pool_id_idx" ON "koin_ledger_entries"("pool_id");
CREATE INDEX "koin_ledger_entries_competition_id_idx" ON "koin_ledger_entries"("competition_id");
CREATE INDEX "koin_ledger_entries_tournament_id_idx" ON "koin_ledger_entries"("tournament_id");

CREATE TABLE "koin_rewards" (
  "id" TEXT NOT NULL,
  "sender_user_id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "message" TEXT,
  "reference" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "koin_rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_rewards_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "koin_rewards_not_self" CHECK ("sender_user_id" <> "recipient_user_id")
);
CREATE UNIQUE INDEX "koin_rewards_reference_key" ON "koin_rewards"("reference");
CREATE INDEX "koin_rewards_sender_user_id_created_at_idx" ON "koin_rewards"("sender_user_id", "created_at");
CREATE INDEX "koin_rewards_recipient_user_id_created_at_idx" ON "koin_rewards"("recipient_user_id", "created_at");

CREATE TABLE "koin_pools" (
  "id" TEXT NOT NULL,
  "competition_id" TEXT,
  "tournament_id" TEXT,
  "status" "KoinPoolStatus" NOT NULL DEFAULT 'OPEN',
  "total_koin" INTEGER NOT NULL DEFAULT 0,
  "winner_share_koin" INTEGER NOT NULL DEFAULT 0,
  "platform_share_koin" INTEGER NOT NULL DEFAULT 0,
  "winner_user_id" TEXT,
  "contributions_close_at" TIMESTAMP(3),
  "settled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "koin_pools_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_pool_exactly_one_owner" CHECK (("competition_id" IS NOT NULL) <> ("tournament_id" IS NOT NULL)),
  CONSTRAINT "koin_pool_amounts_nonnegative" CHECK ("total_koin" >= 0 AND "winner_share_koin" >= 0 AND "platform_share_koin" >= 0)
);
CREATE UNIQUE INDEX "koin_pools_competition_id_key" ON "koin_pools"("competition_id");
CREATE UNIQUE INDEX "koin_pools_tournament_id_key" ON "koin_pools"("tournament_id");
CREATE INDEX "koin_pools_status_idx" ON "koin_pools"("status");

CREATE TABLE "koin_pool_contributions" (
  "id" TEXT NOT NULL,
  "pool_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "is_stake" BOOLEAN NOT NULL DEFAULT false,
  "refunded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "koin_pool_contributions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_pool_contribution_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "koin_pool_contributions_reference_key" ON "koin_pool_contributions"("reference");
CREATE INDEX "koin_pool_contributions_pool_id_created_at_idx" ON "koin_pool_contributions"("pool_id", "created_at");
CREATE INDEX "koin_pool_contributions_user_id_created_at_idx" ON "koin_pool_contributions"("user_id", "created_at");

CREATE TABLE "koin_withdrawals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "koin_amount" INTEGER NOT NULL,
  "naira_amount_kobo" INTEGER NOT NULL,
  "status" "KoinWithdrawalStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "reference" TEXT NOT NULL,
  "payout_provider" TEXT,
  "payout_recipient" TEXT,
  "provider_reference" TEXT,
  "failure_reason" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "koin_withdrawals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_withdrawal_minimum" CHECK ("koin_amount" >= 1250),
  CONSTRAINT "koin_withdrawal_naira_positive" CHECK ("naira_amount_kobo" > 0)
);
CREATE UNIQUE INDEX "koin_withdrawals_reference_key" ON "koin_withdrawals"("reference");
CREATE INDEX "koin_withdrawals_user_id_requested_at_idx" ON "koin_withdrawals"("user_id", "requested_at");
CREATE INDEX "koin_withdrawals_status_idx" ON "koin_withdrawals"("status");

CREATE TABLE "koin_purchases" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "koin_amount" INTEGER NOT NULL,
  "naira_amount_kobo" INTEGER NOT NULL,
  "status" "KoinPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "reference" TEXT NOT NULL,
  "provider_reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "koin_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "koin_purchase_amounts_positive" CHECK ("koin_amount" > 0 AND "naira_amount_kobo" > 0)
);
CREATE UNIQUE INDEX "koin_purchases_reference_key" ON "koin_purchases"("reference");
CREATE INDEX "koin_purchases_user_id_created_at_idx" ON "koin_purchases"("user_id", "created_at");
CREATE INDEX "koin_purchases_status_idx" ON "koin_purchases"("status");

ALTER TABLE "koin_wallets" ADD CONSTRAINT "koin_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "koin_ledger_entries" ADD CONSTRAINT "koin_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "koin_rewards" ADD CONSTRAINT "koin_rewards_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "koin_rewards" ADD CONSTRAINT "koin_rewards_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "koin_pools" ADD CONSTRAINT "koin_pools_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competition_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "koin_pools" ADD CONSTRAINT "koin_pools_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "koin_pool_contributions" ADD CONSTRAINT "koin_pool_contributions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "koin_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "koin_pool_contributions" ADD CONSTRAINT "koin_pool_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "koin_withdrawals" ADD CONSTRAINT "koin_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "koin_purchases" ADD CONSTRAINT "koin_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
