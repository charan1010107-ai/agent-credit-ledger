ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS risk_stage text NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS risk_reason text,
  ADD COLUMN IF NOT EXISTS risk_stage_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS risk_signals integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baseline_credit_limit numeric;

UPDATE public.agents SET baseline_credit_limit = credit_limit WHERE baseline_credit_limit IS NULL;
UPDATE public.agents SET risk_stage = 'frozen', risk_stage_at = COALESCE(frozen_at, now()), risk_reason = freeze_reason, risk_signals = 3 WHERE status = 'frozen';