-- CUSTOM CULTURE vs OG CULTURE
--
-- The arena gains a second format. A battle is now either
-- CUSTOM_VS_CUSTOM (two customizers, the original format, the one
-- tournaments run on) or CUSTOM_VS_OG (a one-of-one against the
-- untouched retail silhouette it was built from).
--
-- Side B therefore stops being "always a Submission": it is either a
-- Submission or a CatalogShoe. And because an OG has no submission row,
-- votes stop pointing only at submissions and start recording a corner.
--
-- Every existing battle is CUSTOM_VS_CUSTOM and every existing vote is
-- backfilled to the corner it actually went to, so nothing already in
-- the ring changes result.

-- ---------- Battle ----------
ALTER TABLE "Battle" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'CUSTOM_VS_CUSTOM';
ALTER TABLE "Battle" ADD COLUMN IF NOT EXISTS "ogShoeId" TEXT;
ALTER TABLE "Battle" ADD COLUMN IF NOT EXISTS "winnerSide" TEXT;

-- side B is only required for the customizer-vs-customizer format
ALTER TABLE "Battle" ALTER COLUMN "subBId" DROP NOT NULL;

ALTER TABLE "Battle"
  ADD CONSTRAINT "Battle_ogShoeId_fkey"
  FOREIGN KEY ("ogShoeId") REFERENCES "CatalogShoe"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Battle_type_status_idx" ON "Battle"("type", "status");

-- carry decided battles over to the corner-based answer
UPDATE "Battle"
   SET "winnerSide" = CASE WHEN "winnerId" = "subAId" THEN 'A' ELSE 'B' END
 WHERE "winnerId" IS NOT NULL AND "winnerSide" IS NULL;

-- ---------- Vote ----------
ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "side" TEXT NOT NULL DEFAULT 'A';
ALTER TABLE "Vote" ALTER COLUMN "submissionId" DROP NOT NULL;

-- every vote already cast keeps counting for the same shoe
UPDATE "Vote" v
   SET "side" = CASE WHEN v."submissionId" = b."subAId" THEN 'A' ELSE 'B' END
  FROM "Battle" b
 WHERE v."battleId" = b."id";

CREATE INDEX IF NOT EXISTS "Vote_battleId_side_idx" ON "Vote"("battleId", "side");
