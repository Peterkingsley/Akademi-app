import { Feature, AccessType } from '@prisma/client';

export interface PurchaseRequest {
  feature?: Feature;
  access_type?: AccessType;
  amount?: number;
  productCode?: string;
  scopeType?: string;
  scopeId?: string;
}

export interface PurchaseResponse {
  paymentUrl: string;
  reference: string;
  productCode?: string;
  amount?: number;
  currency?: string;
  betaUnlocked?: boolean;
  message?: string;
}

export interface FeatureAccessCheckResponse {
  hasAccess: boolean;
  expiresAt?: Date | null;
  usesRemaining?: number | null;
  scopeType?: string | null;
  scopeId?: string | null;
  productCode?: string | null;
}
