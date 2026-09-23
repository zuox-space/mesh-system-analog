/*
  Warnings:

  - A unique constraint covering the columns `[extensionToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "extensionToken" TEXT;
ALTER TABLE "User" ADD COLUMN "pairCode" TEXT;
ALTER TABLE "User" ADD COLUMN "pairCodeExpires" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "User_extensionToken_key" ON "User"("extensionToken");
