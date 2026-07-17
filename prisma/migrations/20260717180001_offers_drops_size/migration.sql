-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "dropAt" TIMESTAMP(3),
ADD COLUMN     "raffleUrl" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "size" TEXT;

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_submissionId_status_idx" ON "Offer"("submissionId", "status");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

