import api from "./api";

export type KoinLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference: string;
  created_at: string;
};

export type KoinWallet = {
  balance: number;
  withdrawableNaira: number;
  pendingWithdrawalKoin: number;
  minimumWithdrawalKoin: number;
  purchaseRate: { koin: number; naira: number };
  withdrawalRate: { koin: number; naira: number };
  ledger: KoinLedgerEntry[];
};

export type KoinPool = {
  id: string;
  status: "OPEN" | "LOCKED" | "SETTLED" | "REFUNDED" | "CANCELLED";
  total_koin: number;
  winner_share_koin: number;
  platform_share_koin: number;
  winner_user_id?: string | null;
};

export type KoinCheckout = {
  paymentUrl: string;
  reference: string;
  koinAmount: number;
  amount: number;
  currency: "NGN";
};

export type NigerianBank = { name: string; code: string; slug: string };
export type ResolvedBankAccount = { bankName: string; bankCode: string; accountNumber: string; accountName: string };

export const koinService = {
  async getWallet() { return (await api.get<KoinWallet>("/koin/wallet")).data; },
  async getPackages() { return (await api.get<Array<{ koin: number; naira: number; enabled: boolean }>>("/koin/packages")).data; },
  async purchase(koinAmount: number) { return (await api.post<KoinCheckout>("/koin/purchases", { koinAmount })).data; },
  async verifyPurchase(reference: string) { return (await api.post(`/koin/purchases/${encodeURIComponent(reference)}/verify`)).data; },
  async getBanks() { return (await api.get<NigerianBank[]>("/koin/banks")).data; },
  async resolveAccount(bankCode: string, accountNumber: string) {
    return (await api.post<ResolvedBankAccount>("/koin/banks/resolve", { bankCode, accountNumber })).data;
  },
  async reward(recipientUserId: string, amount: number, message?: string) {
    return (await api.post("/koin/rewards", { recipientUserId, amount, message })).data;
  },
  async getCompetitionPool(competitionId: string) { return (await api.get<KoinPool>(`/koin/competitions/${competitionId}/pool`)).data; },
  async getTournamentPool(tournamentId: string) { return (await api.get<KoinPool>(`/koin/tournaments/${tournamentId}/pool`)).data; },
  async contribute(poolId: string, amount: number, isStake = false) {
    return (await api.post<KoinPool>(`/koin/pools/${poolId}/contributions`, { amount, isStake })).data;
  },
  async withdraw(koinAmount: number, bankCode: string, accountNumber: string) {
    return (await api.post("/koin/withdrawals", { koinAmount, bankCode, accountNumber })).data;
  },
};
