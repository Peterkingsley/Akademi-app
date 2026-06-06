import { Feature } from '@prisma/client';
import prisma from '../../config/db';
import { config } from '../../config/env';

export async function checkFeatureAccess(
  userId: string,
  feature: Feature,
  scopeType?: string,
  scopeId?: string
): Promise<boolean> {
  if (config.unlockAllFeatures) {
    return true;
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

  if (!access) {
    return false;
  }

  // Decrement uses if use-based
  if (access.uses_remaining !== null && access.uses_remaining > 0) {
    await prisma.featureAccess.update({
      where: { id: access.id },
      data: { uses_remaining: { decrement: 1 } },
    });
  }

  return true;
}
