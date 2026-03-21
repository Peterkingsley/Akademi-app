import { Feature, AccessType } from '@prisma/client';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { v4 as uuidv4 } from 'uuid';

export class FeatureAccessService {
  async getActiveUnlocks(userId: string) {
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

  async initiatePurchase(userId: string, feature: Feature, accessType: AccessType, amount: number) {
    const reference = `PAY-${uuidv4()}`;

    // In a real implementation, this would call Paystack API
    // const response = await paystack.transaction.initialize({ ... });
    const paymentUrl = `https://checkout.paystack.com/${reference}`;

    return { paymentUrl, reference };
  }

  async checkAccess(userId: string, feature: Feature) {
    const access = await prisma.featureAccess.findFirst({
      where: {
        user_id: userId,
        feature,
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
    };
  }

  async activateAccess(reference: string, email: string) {
    // In a real implementation, would fetch metadata from reference or Paystack API
    // Mocking the feature and access type for the demo
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('User not found');

    // This logic would be more complex, mapping reference to actual purchased item
    await prisma.featureAccess.create({
      data: {
        user_id: user.id,
        feature: Feature.EXAM_PREP, // Simplified
        access_type: AccessType.TIME_WINDOW, // Simplified
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        payment_ref: reference,
      },
    });
  }
}
