-- CreateTable
CREATE TABLE "DbArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotJson" TEXT NOT NULL,
    "archivedBy" TEXT
);
