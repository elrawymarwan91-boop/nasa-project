-- CreateTable
CREATE TABLE "MissionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "planet" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "durationSols" INTEGER NOT NULL,
    "configJson" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "guestTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentSol" INTEGER NOT NULL,
    "totalSols" INTEGER NOT NULL,
    "randomSeed" INTEGER NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "currentStateJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameSession_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "MissionTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "sol" INTEGER NOT NULL,
    "stateJson" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "sol" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "sol" INTEGER NOT NULL,
    "eventCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "sourceSnapshotId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "citationText" TEXT NOT NULL,
    "usageNotes" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NasaDataSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "observedAt" DATETIME,
    "retrievedAt" DATETIME NOT NULL,
    "datasetVersion" TEXT,
    "unit" TEXT,
    "dataJson" TEXT NOT NULL,
    "qualityFlags" TEXT NOT NULL,
    CONSTRAINT "NasaDataSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionTemplate_slug_key" ON "MissionTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_guestTokenHash_key" ON "GameSession"("guestTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "GameSnapshot_gameId_sol_key" ON "GameSnapshot"("gameId", "sol");

-- CreateIndex
CREATE INDEX "PlayerAction_gameId_sol_idx" ON "PlayerAction"("gameId", "sol");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAction_gameId_idempotencyKey_key" ON "PlayerAction"("gameId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_sol_idx" ON "GameEvent"("gameId", "sol");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_slug_key" ON "DataSource"("slug");

-- CreateIndex
CREATE INDEX "NasaDataSnapshot_sourceId_observedAt_idx" ON "NasaDataSnapshot"("sourceId", "observedAt");
