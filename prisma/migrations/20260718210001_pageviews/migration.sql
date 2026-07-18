-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "medium" TEXT,
    "campaign" TEXT,
    "referrerHost" TEXT,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_source_createdAt_idx" ON "PageView"("source", "createdAt");

-- CreateIndex
CREATE INDEX "PageView_visitorHash_createdAt_idx" ON "PageView"("visitorHash", "createdAt");

