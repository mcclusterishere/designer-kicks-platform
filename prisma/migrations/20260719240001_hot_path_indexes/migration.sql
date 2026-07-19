-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_status_dropAt_idx" ON "Article"("status", "dropAt");

-- CreateIndex
CREATE INDEX "Battle_status_endsAt_idx" ON "Battle"("status", "endsAt");

-- CreateIndex
CREATE INDEX "FeedPost_pinned_createdAt_idx" ON "FeedPost"("pinned", "createdAt");

-- CreateIndex
CREATE INDEX "QuizQuestion_active_idx" ON "QuizQuestion"("active");

-- CreateIndex
CREATE INDEX "QuizQuestion_articleId_idx" ON "QuizQuestion"("articleId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Submission_artistId_idx" ON "Submission"("artistId");

-- CreateIndex
CREATE INDEX "Submission_ownerId_idx" ON "Submission"("ownerId");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

