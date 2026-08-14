const userFindFirst = jest.fn();
const purchaseCreate = jest.fn();
const purchaseFindUnique = jest.fn();
const purchaseUpdateMany = jest.fn();
const walletFindUnique = jest.fn();
const txPurchaseUpdateMany = jest.fn();
const txPurchaseFindUniqueOrThrow = jest.fn();
const txWalletUpsert = jest.fn();
const txLedgerCreate = jest.fn();
const txWithdrawalFindUnique = jest.fn();
const txWithdrawalUpdateMany = jest.fn();

const tx = {
  koinPurchase: { updateMany: txPurchaseUpdateMany, findUniqueOrThrow: txPurchaseFindUniqueOrThrow },
  koinWallet: { upsert: txWalletUpsert, findUnique: walletFindUnique },
  koinLedgerEntry: { create: txLedgerCreate },
  koinWithdrawal: { findUnique: txWithdrawalFindUnique, updateMany: txWithdrawalUpdateMany },
};

jest.mock('../src/config/env', () => ({
  config: {
    koinPurchasesEnabled: true,
    koraSecretKey: 'sk_test_secret',
    koraPublicKey: 'pk_test_public',
    publicApiUrl: 'https://api.akademi.test',
  },
}));

jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    user: { findFirst: userFindFirst },
    koinPurchase: { create: purchaseCreate, findUnique: purchaseFindUnique, updateMany: purchaseUpdateMany },
    koinWallet: { findUnique: walletFindUnique },
    $transaction: jest.fn((callback: any) => callback(tx)),
  },
}));

import { koinService } from '../src/modules/koin/koin.service';

describe('Korapay Koin purchases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userFindFirst.mockResolvedValue({ id: 'user-1', email: 'student@example.com', name: 'Student' });
    purchaseCreate.mockResolvedValue({});
    purchaseUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('creates a server-owned purchase and initializes the exact Kora checkout amount', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { checkout_url: 'https://checkout.korapay.com/test/pay' } }),
    }) as any;

    const checkout = await koinService.initiatePurchase('user-1', 500);
    expect(checkout).toMatchObject({ paymentUrl: 'https://checkout.korapay.com/test/pay', koinAmount: 500, amount: 500, currency: 'NGN' });
    expect(purchaseCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ user_id: 'user-1', koin_amount: 500, naira_amount_kobo: 50_000 }),
    }));
    const request = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(request).toMatchObject({ amount: 500, currency: 'NGN', notification_url: 'https://api.akademi.test/feature-access/kora/webhook' });
  });

  it('uses the Kora public key for the miscellaneous bank API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: [{ name: 'Test Bank', code: '044', slug: 'test-bank' }] }),
    }) as any;
    await expect(koinService.listBanks()).resolves.toEqual([{ name: 'Test Bank', code: '044', slug: 'test-bank' }]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/misc/banks?countryCode=NG'),
      expect.objectContaining({ headers: { Authorization: 'Bearer pk_test_public' } }),
    );
  });

  it('retries account resolution with NGN when Kora rejects the NG currency code', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ status: false, message: 'One or more fields are invalid' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: true, data: { bank_name: 'Test Bank', bank_code: '044', account_number: '0123456789', account_name: 'TEST STUDENT' } }) }) as any;
    await expect(koinService.resolveBankAccount('044', '0123456789')).resolves.toMatchObject({ accountName: 'TEST STUDENT' });
    const firstBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const secondBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(firstBody.currency).toBe('NG');
    expect(secondBody.currency).toBe('NGN');
  });

  it('credits a verified purchase exactly once through an atomic claim', async () => {
    const purchase = {
      id: 'purchase-1', user_id: 'user-1', koin_amount: 500, naira_amount_kobo: 50_000,
      status: 'PENDING', reference: 'KOIN_reference', user: { email: 'student@example.com' },
    };
    purchaseFindUnique.mockResolvedValue(purchase);
    txPurchaseUpdateMany.mockResolvedValue({ count: 1 });
    txWalletUpsert.mockResolvedValue({ balance: 700 });
    txLedgerCreate.mockResolvedValue({});
    txPurchaseFindUniqueOrThrow.mockResolvedValue({ ...purchase, status: 'PAID' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: { status: 'success', currency: 'NGN', amount_paid: 500, customer: { email: 'student@example.com' }, transaction_reference: 'KPY-1' },
      }),
    }) as any;

    const result = await koinService.verifyAndCreditPurchase('KOIN_reference', 'user-1');
    expect(result).toMatchObject({ paid: true, credited: true, balance: 700 });
    expect(txPurchaseUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'purchase-1', status: { in: ['PENDING', 'FAILED'] } }),
    }));
    expect(txWalletUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { user_id: 'user-1', balance: 500 },
      update: { balance: { increment: 500 } },
    }));
    expect(txLedgerCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a verified charge whose paid amount does not match the package', async () => {
    purchaseFindUnique.mockResolvedValue({
      id: 'purchase-1', user_id: 'user-1', koin_amount: 500, naira_amount_kobo: 50_000,
      status: 'PENDING', reference: 'KOIN_reference', user: { email: 'student@example.com' },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { status: 'success', currency: 'NGN', amount_paid: 100 } }),
    }) as any;

    await expect(koinService.verifyAndCreditPurchase('KOIN_reference', 'user-1')).rejects.toThrow('does not match');
    expect(txLedgerCreate).not.toHaveBeenCalled();
  });

  it('refunds reserved Koin exactly once when a payout fails', async () => {
    txWithdrawalFindUnique
      .mockResolvedValueOnce({ id: 'withdrawal-1', user_id: 'user-1', koin_amount: 1250, status: 'PROCESSING', reference: 'withdrawal_ref' })
      .mockResolvedValueOnce({ id: 'withdrawal-1', status: 'FAILED' });
    txWithdrawalUpdateMany.mockResolvedValue({ count: 1 });
    txWalletUpsert.mockResolvedValue({ balance: 1250 });
    txLedgerCreate.mockResolvedValue({});

    await koinService.failAndRefundWithdrawal('withdrawal_ref', 'Bank rejected payout');
    expect(txWalletUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { balance: { increment: 1250 } },
    }));
    expect(txLedgerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'WITHDRAWAL_REFUND', amount: 1250, reference: 'withdrawal_ref_refund' }),
    }));
  });
});
