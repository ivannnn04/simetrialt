-- Sections inside a customer's collection (rooms, floors…) with notes, and a general note on the collection.
-- Additive only: existing collections get no sections and an empty note; existing items stay unsorted.
ALTER TABLE "Collection" ADD COLUMN "note" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Collection" ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CollectionItem" ADD COLUMN "sectionId" TEXT;
