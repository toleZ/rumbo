/*
  Delete all existing labels (and their task associations) before adding the
  required boardId column. Per the migration strategy agreed with the developer:
  labels are being scoped to boards, existing global labels are discarded.
*/

-- Delete task-label associations first (FK constraint)
DELETE FROM "TaskLabel";

-- Delete all existing labels
DELETE FROM "Label";

-- AlterTable
ALTER TABLE "Label" ADD COLUMN "boardId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Label_boardId_idx" ON "Label"("boardId");

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
