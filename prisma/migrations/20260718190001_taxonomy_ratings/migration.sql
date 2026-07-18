-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "baseColorway" TEXT,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "silhouette" TEXT;

-- CreateTable
CREATE TABLE "DesignRating" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignRating_submissionId_idx" ON "DesignRating"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignRating_submissionId_userId_key" ON "DesignRating"("submissionId", "userId");

-- AddForeignKey
ALTER TABLE "DesignRating" ADD CONSTRAINT "DesignRating_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignRating" ADD CONSTRAINT "DesignRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

