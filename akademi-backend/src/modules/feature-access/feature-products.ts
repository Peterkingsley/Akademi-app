import { AccessType, Feature } from '@prisma/client';

export type FeatureScopeType = 'MATERIAL' | 'COURSE' | 'GLOBAL';

export interface FeatureProduct {
  code: string;
  name: string;
  description: string;
  feature: Feature;
  access_type: AccessType;
  amount: number;
  currency: 'NGN';
  durationHours?: number;
  uses?: number;
  scope_type: FeatureScopeType;
}

export const FEATURE_PRODUCTS: Record<string, FeatureProduct> = {
  MATERIAL_CBT_DAY_PASS: {
    code: 'MATERIAL_CBT_DAY_PASS',
    name: 'Material CBT Day Pass',
    description: 'Generate and practice unlimited CBT tests for one material for 24 hours.',
    feature: Feature.EXAM_PREP,
    access_type: AccessType.TIME_WINDOW,
    amount: 100,
    currency: 'NGN',
    durationHours: 24,
    scope_type: 'MATERIAL',
  },
};

export function getFeatureProduct(productCode: string) {
  return FEATURE_PRODUCTS[productCode];
}
