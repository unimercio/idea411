
ALTER TABLE public.feedback_items
  ADD COLUMN IF NOT EXISTS github_issue_number integer,
  ADD COLUMN IF NOT EXISTS github_issue_url text,
  ADD COLUMN IF NOT EXISTS github_state text;

CREATE UNIQUE INDEX IF NOT EXISTS feedback_items_github_issue_number_key
  ON public.feedback_items(github_issue_number)
  WHERE github_issue_number IS NOT NULL;
