import { Feature, AccessType } from '@prisma/client';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { v4 as uuidv4 } from 'uuid';
import { FEATURE_PRODUCTS, getFeatureProduct } from './feature-products';

export class FeatureAccessService {
  getProducts() {
    return Object.values(FEATURE_PRODUCTS);
  }

  async getActiveUnlocks(userId: string) {
    if (config.unlockAllFeatures) {
      return Object.values(Feature).map((feature) => ({
        id: 'bypassed',
        user_id: userId,
        feature,
        access_type: AccessType.TIME_WINDOW,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        uses_remaining: null,
        purchased_at: new Date(),
        payment_ref: 'BYPASS',
      }));
    }

    return prisma.featureAccess.findMany({
      where: {
        user_id: userId,
        OR: [
          { expires_at: { gt: new Date() } },
          { uses_remaining: { gt: 0 } },
        ],
      },
    });
  }

  async initiatePurchase(
    userId: string,
    feature: Feature,
    accessType: AccessType,
    amount: number,
    productCode?: string,
    scopeType?: string,
    scopeId?: string
  ) {
    const product = productCode ? getFeatureProduct(productCode) : null;
    if (productCode && !product) {
      throw new Error('Unknown pass product');
    }

    if (product && product.scope_type !== 'GLOBAL' && !scopeId) {
      throw new Error(`${product.scope_type.toLowerCase()} scope is required for this pass`);
    }

    const purchaseFeature = product?.feature || feature;
    const purchaseAccessType = product?.access_type || accessType;
    const purchaseAmount = product?.amount ?? amount;
    const purchaseScopeType = product?.scope_type || scopeType;
    const purchaseScopeId = product?.scope_type === 'GLOBAL' ? null : scopeId;

    if (!purchaseFeature || !purchaseAccessType || typeof purchaseAmount !== 'number') {
      throw new Error('A valid pass product or feature purchase is required');
    }

    if (product?.scope_type === 'MATERIAL' && purchaseScopeId) {
      const material = await prisma.material.findUnique({ where: { id: purchaseScopeId } });
      if (!material) throw new Error('Material not found for this pass');
    }

    if (config.unlockAllFeatures) {
      return {
        paymentUrl: '',
        reference: 'BYPASS',
        productCode: product?.code || productCode,
        amount: purchaseAmount,
        currency: product?.currency || 'NGN',
        betaUnlocked: true,
        message: 'Akademi free beta is active. All MVP features are currently unlocked.',
      };
    }

    const reference = `PAY-${uuidv4()}`;
    await prisma.transaction.create({
      data: {
        user_id: userId,
        feature: purchaseFeature,
        plan: product?.code || `${purchaseFeature}_${purchaseAccessType}`,
        amount: purchaseAmount,
        status: 'PENDING',
        reference,
      },
    });

    // In a real implementation, this would call Paystack API
    // const response = await paystack.transaction.initialize({ ... });
    const metadata = encodeURIComponent(JSON.stringify({
      productCode: product?.code || productCode,
      feature: purchaseFeature,
      accessType: purchaseAccessType,
      scopeType: purchaseScopeType,
      scopeId: purchaseScopeId,
      amount: purchaseAmount,
    }));
    const paymentUrl = `https://checkout.paystack.com/${reference}?metadata=${metadata}`;

    return {
      paymentUrl,
      reference,
      productCode: product?.code || productCode,
      amount: purchaseAmount,
      currency: product?.currency || 'NGN',
    };
  }

  async checkAccess(userId: string, feature: Feature, scopeType?: string, scopeId?: string) {
    if (config.unlockAllFeatures) {
      return {
        hasAccess: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        usesRemaining: null,
      };
    }

    const access = await prisma.featureAccess.findFirst({
      where: {
        user_id: userId,
        feature,
        AND: scopeType && scopeId ? [
          {
            OR: [
              { scope_type: scopeType, scope_id: scopeId },
              { scope_type: null, scope_id: null },
            ],
          },
        ] : undefined,
        OR: [
          { expires_at: { gt: new Date() } },
          { uses_remaining: { gt: 0 } },
        ],
      },
    });

    return {
      hasAccess: !!access,
      expiresAt: access?.expires_at,
      usesRemaining: access?.uses_remaining,
      scopeType: access?.scope_type,
      scopeId: access?.scope_id,
      productCode: access?.product_code,
    };
  }

  async activateAccess(reference: string, email: string, metadata?: any) {
    if (!reference || !email) throw new Error('Missing payment reference or customer email');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('User not found');

    // A valid webhook signature is not enough on its own: require a matching
    // transaction that we created for this exact user. This prevents granting
    // paid access for an arbitrary email even if the signature verifies.
    const transaction = await prisma.transaction.findFirst({ where: { reference } });
    if (!transaction) throw new Error('Transaction not found for reference');
    if (transaction.user_id !== user.id) throw new Error('Transaction does not belong to this user');
    if (transaction.status === 'SUCCESS') return; // already granted; idempotent

    const product = metadata?.productCode ? getFeatureProduct(metadata.productCode) : null;
    const feature = product?.feature || (metadata?.feature as Feature) || Feature.EXAM_PREP;
    const accessType = product?.access_type || (metadata?.accessType as AccessType) || AccessType.TIME_WINDOW;
    const scopeType = product?.scope_type || metadata?.scopeType;
    const scopeId = product?.scope_type === 'GLOBAL' ? null : metadata?.scopeId;
    const expiresAt = product?.durationHours
      ? new Date(Date.now() + product.durationHours * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.featureAccess.create({
      data: {
        user_id: user.id,
        feature,
        access_type: accessType,
        product_code: product?.code || metadata?.productCode,
        scope_type: scopeType,
        scope_id: scopeId,
        expires_at: expiresAt,
        uses_remaining: product?.uses,
        payment_ref: reference,
      },
    });

    await prisma.transaction.updateMany({
      where: { reference },
      data: { status: 'SUCCESS' },
    });
  }
}
