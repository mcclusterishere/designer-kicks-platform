-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "invitedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'HOUSE',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitBattle" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "league" TEXT NOT NULL DEFAULT 'HOUSE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "outfitAId" TEXT NOT NULL,
    "outfitBId" TEXT NOT NULL,
    "winnerId" TEXT,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutfitBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitVote" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutfitVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutfitItem_outfitId_submissionId_key" ON "OutfitItem"("outfitId", "submissionId");

-- CreateIndex
CREATE INDEX "OutfitVote_battleId_outfitId_idx" ON "OutfitVote"("battleId", "outfitId");

-- CreateIndex
CREATE UNIQUE INDEX "OutfitVote_battleId_userId_key" ON "OutfitVote"("battleId", "userId");

-- AddForeignKey
ALTER TABLE "Outfit" ADD CONSTRAINT "Outfit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitBattle" ADD CONSTRAINT "OutfitBattle_outfitAId_fkey" FOREIGN KEY ("outfitAId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitBattle" ADD CONSTRAINT "OutfitBattle_outfitBId_fkey" FOREIGN KEY ("outfitBId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitBattle" ADD CONSTRAINT "OutfitBattle_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Outfit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitVote" ADD CONSTRAINT "OutfitVote_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "OutfitBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitVote" ADD CONSTRAINT "OutfitVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

