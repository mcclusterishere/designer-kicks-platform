-- CreateTable
CREATE TABLE "GroupLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "adminName" TEXT,
    "members" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "campaign" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupLead_campaign_key" ON "GroupLead"("campaign");

