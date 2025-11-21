-- CreateTable
CREATE TABLE "graph_subscriptions" (
    "id" TEXT NOT NULL,
    "subscription_id" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(500) NOT NULL,
    "change_types" VARCHAR(255) NOT NULL,
    "notification_url" TEXT NOT NULL,
    "client_state" VARCHAR(255),
    "expiration_datetime" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_renewed_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "graph_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graph_subscriptions_subscription_id_key" ON "graph_subscriptions"("subscription_id");

-- CreateIndex
CREATE INDEX "graph_subscriptions_expiration_datetime_idx" ON "graph_subscriptions"("expiration_datetime");

-- CreateIndex
CREATE INDEX "graph_subscriptions_is_active_idx" ON "graph_subscriptions"("is_active");
