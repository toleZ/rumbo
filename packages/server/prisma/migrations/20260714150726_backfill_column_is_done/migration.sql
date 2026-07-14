-- One-time bridge: the isDone field replaces a client-side keyword heuristic
-- that used to guess a column was "done" by matching its title against a
-- fixed list (see the old DONE_KEYWORDS in TodayPage.tsx, now removed).
-- Without this backfill, every pre-existing board's Done-equivalent column
-- would silently lose its done status and its tasks would reappear as
-- active/overdue.
UPDATE "Column"
SET "isDone" = true
WHERE lower(trim("title")) IN (
  'done', 'hecho', 'completed', 'finished', 'cerrado',
  'terminado', 'complete', 'listo', 'desplegado', 'deployed'
);
