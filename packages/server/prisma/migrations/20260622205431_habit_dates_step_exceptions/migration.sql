-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "endDate" TEXT,
ADD COLUMN     "startDate" TEXT,
ADD COLUMN     "step" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "HabitException" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "HabitException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HabitException_habitId_idx" ON "HabitException"("habitId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitException_habitId_date_key" ON "HabitException"("habitId", "date");

-- AddForeignKey
ALTER TABLE "HabitException" ADD CONSTRAINT "HabitException_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
