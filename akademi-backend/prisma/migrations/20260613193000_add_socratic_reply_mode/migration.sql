DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'SOCRATIC'
      AND enumtypid = '"ReplyMode"'::regtype
  ) THEN
    ALTER TYPE "ReplyMode" ADD VALUE 'SOCRATIC';
  END IF;
END $$;
