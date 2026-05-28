ALTER TABLE "characters" ADD COLUMN "speechStyle" TEXT;
ALTER TABLE "characters" ADD COLUMN "vocabularyLevel" TEXT;
ALTER TABLE "characters" ADD COLUMN "sentencePattern" TEXT;
ALTER TABLE "characters" ADD COLUMN "catchphraseStyle" TEXT;
ALTER TABLE "characters" ADD COLUMN "dialogueExamples" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "characters" ADD COLUMN "voiceNotes" TEXT;
