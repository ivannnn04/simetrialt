-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "variantAttrs" JSONB,
ADD COLUMN     "variantLabel" TEXT;

-- CreateIndex
CREATE INDEX "Product_groupKey_idx" ON "Product"("groupKey");
