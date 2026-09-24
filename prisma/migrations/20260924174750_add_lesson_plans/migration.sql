-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannedLesson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "planId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "groupId" INTEGER NOT NULL,
    "groupName" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "subjectName" TEXT NOT NULL,
    "lessonName" TEXT NOT NULL,
    "lessonTemplateId" INTEGER,
    "launchUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedLesson_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LessonPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlan_userId_key" ON "LessonPlan"("userId");

-- CreateIndex
CREATE INDEX "PlannedLesson_planId_startAt_idx" ON "PlannedLesson"("planId", "startAt");

-- CreateIndex
CREATE INDEX "PlannedLesson_status_idx" ON "PlannedLesson"("status");
