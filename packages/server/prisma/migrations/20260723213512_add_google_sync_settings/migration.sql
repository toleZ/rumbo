-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "googleAutoSync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleCalendarEventUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleAutoSyncMode" TEXT NOT NULL DEFAULT 'off',
ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleSyncBoardIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
