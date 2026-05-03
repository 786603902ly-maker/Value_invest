-- Add frequency, notifyVia, lastNotifiedAt to Alert
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "notifyVia" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "lastNotifiedAt" TIMESTAMP(3);

-- Create AlertNotification table
CREATE TABLE IF NOT EXISTS "AlertNotification" (
    "id"           TEXT NOT NULL,
    "alertId"      TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "ticker"       TEXT NOT NULL,
    "metric"       TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "threshold"    DOUBLE PRECISION NOT NULL,
    "condition"    TEXT NOT NULL,
    "read"         BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "AlertNotification"
    ADD CONSTRAINT IF NOT EXISTS "AlertNotification_alertId_fkey"
    FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlertNotification"
    ADD CONSTRAINT IF NOT EXISTS "AlertNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
