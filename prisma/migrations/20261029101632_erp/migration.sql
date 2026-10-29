-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "supplierName" TEXT;

-- CreateTable
CREATE TABLE "ErpContact" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COMPANY',
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "position" TEXT NOT NULL DEFAULT '',
    "regCode" TEXT NOT NULL DEFAULT '',
    "vatCode" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "deliveryAddress" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Klientas',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commissionPct" DOUBLE PRECISION,
    "managerId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "legacyScoroId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpDocument" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "clientId" TEXT,
    "partyId" TEXT,
    "supplierId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'Be architekto',
    "managerId" TEXT,
    "parentId" TEXT,
    "probability" INTEGER,
    "validUntil" TIMESTAMP(3),
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryTerm" TEXT NOT NULL DEFAULT '',
    "contractText" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "meta" JSONB,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "legacyScoroId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'vnt.',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatPct" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "supplierId" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceLineId" TEXT,
    "image" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ErpLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpPayment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Pavedimas',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpWarehouse" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ErpWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ErpStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpStockMove" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT,
    "type" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "documentId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpStockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpCommission" (
    "id" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "pct" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "paidAt" TIMESTAMP(3),
    "method" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpActivity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactId" TEXT,
    "documentId" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LOG',
    "text" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpCounter" (
    "series" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ErpCounter_pkey" PRIMARY KEY ("series")
);

-- CreateIndex
CREATE INDEX "ErpContact_category_idx" ON "ErpContact"("category");

-- CreateIndex
CREATE INDEX "ErpContact_name_idx" ON "ErpContact"("name");

-- CreateIndex
CREATE INDEX "ErpDocument_type_status_idx" ON "ErpDocument"("type", "status");

-- CreateIndex
CREATE INDEX "ErpDocument_clientId_idx" ON "ErpDocument"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpDocument_type_number_key" ON "ErpDocument"("type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ErpWarehouse_code_key" ON "ErpWarehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ErpStock_productId_warehouseId_key" ON "ErpStock"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "ErpStockMove_productId_idx" ON "ErpStockMove"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpCommission_documentId_architectId_key" ON "ErpCommission"("documentId", "architectId");

-- CreateIndex
CREATE INDEX "ErpActivity_start_idx" ON "ErpActivity"("start");

-- AddForeignKey
ALTER TABLE "ErpContact" ADD CONSTRAINT "ErpContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ErpContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpDocument" ADD CONSTRAINT "ErpDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ErpContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpDocument" ADD CONSTRAINT "ErpDocument_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "ErpContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpDocument" ADD CONSTRAINT "ErpDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ErpContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpDocument" ADD CONSTRAINT "ErpDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ErpDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpLine" ADD CONSTRAINT "ErpLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ErpDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpLine" ADD CONSTRAINT "ErpLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpPayment" ADD CONSTRAINT "ErpPayment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ErpDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpStock" ADD CONSTRAINT "ErpStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpStock" ADD CONSTRAINT "ErpStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "ErpWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpCommission" ADD CONSTRAINT "ErpCommission_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "ErpContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpCommission" ADD CONSTRAINT "ErpCommission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ErpDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpActivity" ADD CONSTRAINT "ErpActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ErpContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpActivity" ADD CONSTRAINT "ErpActivity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ErpDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpEvent" ADD CONSTRAINT "ErpEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ErpDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
