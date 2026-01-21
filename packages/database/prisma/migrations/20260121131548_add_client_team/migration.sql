-- CreateTable
CREATE TABLE "client_team" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "client_team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_team_client_id_idx" ON "client_team"("client_id");

-- CreateIndex
CREATE INDEX "client_team_user_id_idx" ON "client_team"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_team_client_id_user_id_key" ON "client_team"("client_id", "user_id");

-- AddForeignKey
ALTER TABLE "client_team" ADD CONSTRAINT "client_team_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_team" ADD CONSTRAINT "client_team_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_team" ADD CONSTRAINT "client_team_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
