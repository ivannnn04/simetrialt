-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN     "note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
