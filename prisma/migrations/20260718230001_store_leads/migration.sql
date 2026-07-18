-- CreateTable
CREATE TABLE "StoreLead" (
    "id" TEXT NOT NULL,
    "placeId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "mapsUrl" TEXT,
    "website" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "email" TEXT,
    "instagram" TEXT,
    "specialty" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCOUTED',
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreLead_placeId_key" ON "StoreLead"("placeId");

-- CreateIndex
CREATE INDEX "StoreLead_status_createdAt_idx" ON "StoreLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StoreLead_zip_idx" ON "StoreLead"("zip");

