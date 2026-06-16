ALTER TABLE "competition_rooms"
ADD COLUMN "tournament_id" TEXT;

CREATE UNIQUE INDEX "competition_rooms_tournament_id_key" ON "competition_rooms"("tournament_id");

ALTER TABLE "competition_rooms"
ADD CONSTRAINT "competition_rooms_tournament_id_fkey"
FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
