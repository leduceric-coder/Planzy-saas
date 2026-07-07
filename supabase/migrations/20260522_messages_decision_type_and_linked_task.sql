ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'decision';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_linked_task_id ON public.messages(linked_task_id)
  WHERE linked_task_id IS NOT NULL;
