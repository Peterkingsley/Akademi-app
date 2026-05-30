DO $$
DECLARE
  question_table text;
BEGIN
  IF to_regclass('"questions"') IS NOT NULL THEN
    question_table := '"questions"';
  ELSIF to_regclass('"Question"') IS NOT NULL THEN
    question_table := '"Question"';
  ELSE
    RAISE EXCEPTION 'Question table not found';
  END IF;

  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "options" JSONB NOT NULL DEFAULT ''[]''', question_table);
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "correct_answer" TEXT', question_table);
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "explanation" TEXT', question_table);
END $$;
