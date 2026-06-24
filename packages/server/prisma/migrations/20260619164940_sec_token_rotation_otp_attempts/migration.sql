-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "rememberMe" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VerificationCode" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;
