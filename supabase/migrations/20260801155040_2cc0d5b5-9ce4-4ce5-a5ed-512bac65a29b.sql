-- Replace the fully-permissive demo policies with read-only public access.
DROP POLICY IF EXISTS "demo open access" ON public.principals;
DROP POLICY IF EXISTS "demo open access" ON public.agents;
DROP POLICY IF EXISTS "demo open access" ON public.loans;
DROP POLICY IF EXISTS "demo open access" ON public.transactions;
DROP POLICY IF EXISTS "demo open access" ON public.score_history;

-- Public demo data stays readable, but nobody can write through the Data API.
CREATE POLICY "public read only" ON public.principals
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read only" ON public.agents
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read only" ON public.loans
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read only" ON public.transactions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read only" ON public.score_history
  FOR SELECT TO anon, authenticated USING (true);

-- Remove write privileges from browser-facing roles; writes go through server functions
-- using the service role only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.principals, public.agents, public.loans, public.transactions, public.score_history
  FROM anon, authenticated;

GRANT SELECT
  ON public.principals, public.agents, public.loans, public.transactions, public.score_history
  TO anon, authenticated;

GRANT ALL
  ON public.principals, public.agents, public.loans, public.transactions, public.score_history
  TO service_role;