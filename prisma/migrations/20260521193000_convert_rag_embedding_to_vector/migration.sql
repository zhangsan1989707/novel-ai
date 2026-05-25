DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;

        IF to_regclass('public.rag_documents') IS NOT NULL THEN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'rag_documents'
                  AND column_name = 'embedding'
                  AND data_type = 'jsonb'
            ) THEN
                EXECUTE 'DROP INDEX IF EXISTS "rag_documents_embedding_idx"';

                EXECUTE '
                    ALTER TABLE "rag_documents"
                    ALTER COLUMN "embedding" TYPE vector(256)
                    USING (
                        COALESCE(
                            NULLIF("embedding"::text, ''[]''),
                            ''['' || repeat(''0,'', 255) || ''0]''
                        )::vector(256)
                    )
                ';

                EXECUTE '
                    CREATE INDEX "rag_documents_embedding_idx"
                    ON "rag_documents"
                    USING ivfflat ("embedding" vector_cosine_ops)
                    WITH (lists = 100)
                ';
            END IF;
        END IF;
    END IF;
END $$;
