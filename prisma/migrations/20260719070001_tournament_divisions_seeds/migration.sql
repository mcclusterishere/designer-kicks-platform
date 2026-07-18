-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "division" TEXT NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "TournamentMatch" ADD COLUMN     "seedA" INTEGER,
ADD COLUMN     "seedB" INTEGER;

