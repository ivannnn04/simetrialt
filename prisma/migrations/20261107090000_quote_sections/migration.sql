-- Sections inside a showroom quote (rooms, floors…) with a long note each; Quote.note stays the general project note.
-- Additive only: existing quotes get no sections and their lines stay unsorted.
ALTER TABLE "Quote" ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "QuoteItem" ADD COLUMN "sectionId" TEXT;
