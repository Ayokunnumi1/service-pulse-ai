-- Evidence-linked root cause: customer interactions cited by each analysis
-- as supporting, alternative or counter evidence. Stores interaction ids and
-- the model's one-line reason only; message text stays in interactions.
alter table issue_analyses add column if not exists evidence jsonb not null default '[]'::jsonb;
