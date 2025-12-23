-- OPS-120: Notification Engine
-- Adds tables for in-app notifications, push subscriptions, and digest queue

-- CreateTable: in_app_notifications
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "icon" VARCHAR(50),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "action_type" VARCHAR(50),
    "action_data" JSONB,
    "source_event_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: push_subscriptions
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" VARCHAR(255) NOT NULL,
    "auth_key" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: digest_queue
CREATE TABLE "digest_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "event_title" VARCHAR(500),
    "event_data" JSONB,
    "scheduled_for" TIMESTAMPTZ NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: in_app_notifications
CREATE INDEX "in_app_notifications_user_id_read_created_at_idx" ON "in_app_notifications"("user_id", "read", "created_at");
CREATE INDEX "in_app_notifications_user_id_created_at_idx" ON "in_app_notifications"("user_id", "created_at");

-- CreateIndex: push_subscriptions
CREATE INDEX "push_subscriptions_user_id_active_idx" ON "push_subscriptions"("user_id", "active");

-- CreateIndex: digest_queue
CREATE INDEX "digest_queue_user_id_scheduled_for_sent_idx" ON "digest_queue"("user_id", "scheduled_for", "sent");
CREATE INDEX "digest_queue_scheduled_for_sent_idx" ON "digest_queue"("scheduled_for", "sent");

-- AddForeignKey: in_app_notifications
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: push_subscriptions
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
