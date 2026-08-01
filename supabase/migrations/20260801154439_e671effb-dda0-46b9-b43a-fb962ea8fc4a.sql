UPDATE public.agents SET
  credit_limit = round(credit_limit * 83),
  spend_cap = round(spend_cap * 83),
  wallet_balance = round(wallet_balance * 83),
  recent_task_revenue = (SELECT coalesce(jsonb_agg(round((v)::numeric * 83)), '[]'::jsonb) FROM jsonb_array_elements_text(recent_task_revenue) AS v),
  spend_velocity = (SELECT coalesce(jsonb_agg(round((v)::numeric * 83)), '[]'::jsonb) FROM jsonb_array_elements_text(spend_velocity) AS v);

UPDATE public.loans SET
  amount = round(amount * 83),
  expected_revenue = round(expected_revenue * 83);

UPDATE public.transactions SET amount = round(amount * 83);