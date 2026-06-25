-- Before/after scope photos so contractors see planned work visually.
ALTER TABLE "jobs" ADD COLUMN "photo_comparisons" JSONB NOT NULL DEFAULT '[]';
