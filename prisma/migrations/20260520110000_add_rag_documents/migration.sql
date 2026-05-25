DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;

        IF to_regclass('public.rag_documents') IS NULL THEN
            EXECUTE '
                CREATE TABLE "rag_documents" (
                    "id" TEXT NOT NULL,
                    "project_id" INTEGER NOT NULL,
                    "source_type" TEXT NOT NULL,
                    "source_id" TEXT NOT NULL,
                    "chapter_no" INTEGER NOT NULL DEFAULT 0,
                    "chunk_no" INTEGER NOT NULL DEFAULT 0,
                    "title" TEXT,
                    "content" TEXT NOT NULL,
                    "metadata" JSONB NOT NULL DEFAULT ''{}''::jsonb,
                    "embedding" vector(256) NOT NULL,
                    "embedding_model" TEXT NOT NULL DEFAULT ''local-hash-v1'',
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP(3) NOT NULL,

                    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
                )
            ';

            EXECUTE '
                CREATE UNIQUE INDEX "rag_documents_project_source_unique"
                ON "rag_documents" ("project_id", "source_type", "source_id", "chunk_no")
            ';

            EXECUTE '
                CREATE INDEX "rag_documents_project_source_idx"
                ON "rag_documents" ("project_id", "source_type", "chapter_no")
            ';

            EXECUTE '
                CREATE INDEX "rag_documents_project_chapter_idx"
                ON "rag_documents" ("project_id", "chapter_no")
            ';

            EXECUTE '
                CREATE INDEX "rag_documents_embedding_idx"
                ON "rag_documents"
                USING ivfflat ("embedding" vector_cosine_ops)
                WITH (lists = 100)
            ';

            EXECUTE '
                ALTER TABLE "rag_documents"
                ADD CONSTRAINT "rag_documents_project_id_fkey"
                FOREIGN KEY ("project_id") REFERENCES "novel_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
            ';
        END IF;
    END IF;
END $$;
