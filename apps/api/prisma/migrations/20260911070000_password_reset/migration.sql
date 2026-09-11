-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordResetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpires" TIMESTAMP(3);
