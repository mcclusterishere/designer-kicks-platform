-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "outreachNotes" TEXT,
ADD COLUMN     "outreachStage" TEXT NOT NULL DEFAULT 'NEW';

