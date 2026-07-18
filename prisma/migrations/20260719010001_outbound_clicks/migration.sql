-- CreateTable
CREATE TABLE "OutboundClick" (
    "id" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ref" TEXT,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundClick_createdAt_idx" ON "OutboundClick"("createdAt");

-- CreateIndex
CREATE INDEX "OutboundClick_merchant_createdAt_idx" ON "OutboundClick"("merchant", "createdAt");

