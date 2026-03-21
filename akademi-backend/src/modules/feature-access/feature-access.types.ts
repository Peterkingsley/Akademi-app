import { Feature, AccessType } from '@prisma/client';

export interface PurchaseRequest {
  feature: Feature;
  access_type: AccessType;
  amount: number;
}

export interface PurchaseResponse {
  paymentUrl: string;
  reference: string;
}

export interface FeatureAccessCheckResponse {
  hasAccess: boolean;
  expiresAt?: Date | null;
  usesRemaining?: number | null;
}
