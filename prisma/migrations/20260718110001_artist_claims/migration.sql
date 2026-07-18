-- CreateTable
CREATE TABLE "ArtistClaim" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "socialProof" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistClaim_artistId_status_idx" ON "ArtistClaim"("artistId", "status");

-- AddForeignKey
ALTER TABLE "ArtistClaim" ADD CONSTRAINT "ArtistClaim_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "ArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

