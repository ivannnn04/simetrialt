-- Furniture available from stock: shown on the website ("In stock") and filterable.
ALTER TABLE "Product" ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "stockQty" INTEGER;
CREATE INDEX "Product_inStock_idx" ON "Product"("inStock");
