-- CreateIndex
CREATE INDEX "Band_city_state_idx" ON "Band"("city", "state");

-- CreateIndex
CREATE INDEX "Show_city_state_date_idx" ON "Show"("city", "state", "date");

-- CreateIndex
CREATE INDEX "ShowBand_showId_idx" ON "ShowBand"("showId");

-- CreateIndex
CREATE INDEX "User_city_state_idx" ON "User"("city", "state");

-- CreateIndex
CREATE INDEX "Venue_city_state_idx" ON "Venue"("city", "state");
