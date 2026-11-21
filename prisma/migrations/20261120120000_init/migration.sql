-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('tree', 'engine');

-- CreateEnum
CREATE TYPE "GuessSource" AS ENUM ('tree', 'model', 'gemini');

-- CreateEnum
CREATE TYPE "Answer" AS ENUM ('evet', 'hayir', 'bilmiyorum');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('tree', 'gemini');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "playedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "GameMode" NOT NULL,
    "prediction" TEXT NOT NULL,
    "source" "GuessSource" NOT NULL,
    "isPredictionCorrect" BOOLEAN NOT NULL,
    "userCorrectAnswer" TEXT,
    "entityId" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestion" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" "Answer" NOT NULL,
    "questionIndex" INTEGER NOT NULL,

    CONSTRAINT "GameQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityAnswerStat" (
    "entityId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "yes" INTEGER NOT NULL DEFAULT 0,
    "no" INTEGER NOT NULL DEFAULT 0,
    "unknown" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntityAnswerStat_pkey" PRIMARY KEY ("entityId","questionId")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "ipHash" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("ipHash","windowStart")
);

-- CreateIndex
CREATE INDEX "Game_playedAt_idx" ON "Game"("playedAt");

-- CreateIndex
CREATE INDEX "Game_entityId_idx" ON "Game"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "GameQuestion_gameId_questionIndex_key" ON "GameQuestion"("gameId", "questionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_nameNormalized_key" ON "Entity"("nameNormalized");

-- CreateIndex
CREATE INDEX "Question_approved_idx" ON "Question"("approved");

-- CreateIndex
CREATE INDEX "EntityAnswerStat_questionId_idx" ON "EntityAnswerStat"("questionId");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestion" ADD CONSTRAINT "GameQuestion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAnswerStat" ADD CONSTRAINT "EntityAnswerStat_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAnswerStat" ADD CONSTRAINT "EntityAnswerStat_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
