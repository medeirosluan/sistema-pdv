-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Tenant" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "gatewayCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "gatewaySubscriptionId" TEXT;
