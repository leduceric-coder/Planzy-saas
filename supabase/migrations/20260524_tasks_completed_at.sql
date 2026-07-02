-- LOT 4.1 — completed_at pour tâches terminées persistantes côté mobile
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
  ON public.tasks(completed_at)
  WHERE completed_at IS NOT NULL;
