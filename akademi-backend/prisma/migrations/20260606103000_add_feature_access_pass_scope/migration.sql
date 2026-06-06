ALTER TABLE "feature_access"
ADD COLUMN "product_code" TEXT,
ADD COLUMN "scope_type" TEXT,
ADD COLUMN "scope_id" TEXT;

CREATE INDEX "feature_access_product_code_idx" ON "feature_access"("product_code");
CREATE INDEX "feature_access_scope_type_scope_id_idx" ON "feature_access"("scope_type", "scope_id");
