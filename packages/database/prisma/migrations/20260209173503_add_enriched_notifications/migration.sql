-- CreateTable
CREATE TABLE "enriched_notifications" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" VARCHAR(100) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "image_url" TEXT,
    "priority" VARCHAR(20) NOT NULL,
    "related_items" JSONB NOT NULL DEFAULT '[]',
    "suggested_actions" JSONB NOT NULL DEFAULT '[]',
    "enriched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enriched_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enriched_notifications_notification_id_key" ON "enriched_notifications"("notification_id");

-- CreateIndex
CREATE INDEX "enriched_notifications_user_id_enriched_at_idx" ON "enriched_notifications"("user_id", "enriched_at");

-- AddForeignKey
ALTER TABLE "enriched_notifications" ADD CONSTRAINT "enriched_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "in_app_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enriched_notifications" ADD CONSTRAINT "enriched_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
