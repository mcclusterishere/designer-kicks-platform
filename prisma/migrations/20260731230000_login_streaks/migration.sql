-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSeenDay" TEXT,
ADD COLUMN     "longestStreak" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoginDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 1,
    "entries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginDay_userId_day_idx" ON "LoginDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "LoginDay_userId_day_key" ON "LoginDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "LoginDay" ADD CONSTRAINT "LoginDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

