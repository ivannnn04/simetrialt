-- AlterTable
ALTER TABLE "Product" ADD COLUMN "scoroId" INTEGER, ADD COLUMN "scoroSyncedAt" TIMESTAMP(3), ADD COLUMN "scoroHash" TEXT;
CREATE UNIQUE INDEX "Product_scoroId_key" ON "Product"("scoroId");

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "productSku" TEXT, ADD COLUMN "scoroContactId" INTEGER, ADD COLUMN "scoroQuoteId" INTEGER;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'website', ADD COLUMN "scoroId" INTEGER, ADD COLUMN "scoroSyncedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Quote_scoroId_key" ON "Quote"("scoroId");

-- CreateTable
CREATE TABLE "ScoroTask" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoroTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScoroTask_kind_ref_key" ON "ScoroTask"("kind", "ref");

-- CreateTable
CREATE TABLE "ScoroLog" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoroLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScoroLog_createdAt_idx" ON "ScoroLog"("createdAt");
