
CREATE TABLE public.principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'org',
  jurisdiction text NOT NULL DEFAULT 'US-DE',
  reputation_score int NOT NULL DEFAULT 700,
  signature_hash text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  credit_score int NOT NULL DEFAULT 600,
  credit_limit numeric NOT NULL DEFAULT 1000,
  status text NOT NULL DEFAULT 'none',
  task_scope text NOT NULL DEFAULT '',
  spend_cap numeric NOT NULL DEFAULT 500,
  wallet_balance numeric NOT NULL DEFAULT 0,
  task_success_rate numeric NOT NULL DEFAULT 90,
  avg_completion_minutes numeric NOT NULL DEFAULT 30,
  spend_consistency numeric NOT NULL DEFAULT 80,
  anomaly boolean NOT NULL DEFAULT false,
  anomaly_reason text,
  frozen_at timestamptz,
  freeze_reason text,
  vendor_whitelist jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  recent_task_revenue jsonb NOT NULL DEFAULT '[]'::jsonb,
  spend_velocity jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 6.5,
  task_description text NOT NULL,
  expected_revenue numeric NOT NULL DEFAULT 0,
  expected_repayment_date date,
  status text NOT NULL DEFAULT 'active',
  decision_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  disbursed_at timestamptz,
  repaid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  tx_hash text NOT NULL,
  tx_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed',
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  score int NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.principals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_history TO anon, authenticated;
GRANT ALL ON public.principals, public.agents, public.loans, public.transactions, public.score_history TO service_role;

ALTER TABLE public.principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo open access" ON public.principals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.agents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.loans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.score_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.principals (id, name, entity_type, jurisdiction, reputation_score, signature_hash, signed_at) VALUES
 ('11111111-1111-4111-8111-000000000001','Helios Data Labs','org','US-DE',782,'0xa41f9c3b7d2e5f8a1c04b6e9d3f7a2c8b510e4d9',now() - interval '184 days'),
 ('11111111-1111-4111-8111-000000000002','Marcus Vale','individual','SG',744,'0x7b3e2f91c05d8a4e6f1b9c2d7a3e5f80b4c16d92',now() - interval '121 days'),
 ('11111111-1111-4111-8111-000000000003','Northwind Analytics','org','UK',611,'0xc9d4a71e35b8f206c1e7d9a4b2f6038e5c7a1b43',now() - interval '73 days'),
 ('11111111-1111-4111-8111-000000000004','Studio Kestrel','org','US-CA',801,'0x2f6b8d13e7a95c40b2d8f1a6c3e97b05d4a2e816',now() - interval '298 days'),
 ('11111111-1111-4111-8111-000000000005','Orbital Freight Co','org','NL',689,'0x5e1c93a7f4b26d80a3c5e9f172b4d68c0a97e253',now() - interval '156 days');

INSERT INTO public.agents (id, name, principal_id, wallet_address, credit_score, credit_limit, status, task_scope, spend_cap, wallet_balance, task_success_rate, avg_completion_minutes, spend_consistency, anomaly, anomaly_reason, vendor_whitelist, score_factors, recent_task_revenue, spend_velocity) VALUES
 ('22222222-2222-4222-8222-000000000001','DataMiner-7','11111111-1111-4111-8111-000000000001','0x8Fd4A2c19E7b30f5C6a8D1e4B92c7305Fa16Db83',788,24000,'active','Large-scale dataset extraction, normalization and enrichment pipelines',6000,4820,97.4,42,91,false,null,
  '["OpenAI","AWS","Compute Marketplace"]',
  '[{"label":"Task success rate","value":42},{"label":"Principal reputation","value":26},{"label":"Repayment history","value":31},{"label":"Revenue variance","value":-12},{"label":"Spend consistency","value":18},{"label":"Account age","value":9}]',
  '[410,455,398,512,486,530,502,548,561,590]',
  '[120,138,131,145,127,150,142,139,148,155,144,151]'),
 ('22222222-2222-4222-8222-000000000002','TradeBot-Alpha','11111111-1111-4111-8111-000000000002','0x3Ab7C5e91D24f8b06E3a7C2d5F81b940Ae62C7d1',742,18500,'repaying','Market signal analysis and simulated order routing',5000,2310,93.1,17,74,false,null,
  '["OpenAI","AWS","Polygon Data Feed"]',
  '[{"label":"Task success rate","value":34},{"label":"Principal reputation","value":22},{"label":"Repayment history","value":25},{"label":"Revenue variance","value":-28},{"label":"Spend consistency","value":-9},{"label":"Account age","value":14}]',
  '[880,640,1210,470,990,1340,520,760,1180,610]',
  '[210,190,265,180,240,300,175,220,290,205,250,231]'),
 ('22222222-2222-4222-8222-000000000003','ScraperX','11111111-1111-4111-8111-000000000003','0xE12b8F6a34C7d905B1e6A8c2D4f73015Cb9a2E76',498,3000,'active','Web crawling and public content indexing',1500,180,71.2,63,38,true,'Spend velocity 6.4x baseline in last 40m; 3 consecutive task failures',
  '["AWS","Proxy Mesh"]',
  '[{"label":"Task success rate","value":-31},{"label":"Principal reputation","value":8},{"label":"Repayment history","value":-18},{"label":"Revenue variance","value":-40},{"label":"Spend consistency","value":-35},{"label":"Account age","value":4}]',
  '[95,120,80,60,140,45,30,110,25,15]',
  '[80,95,88,102,97,110,190,340,610,880,1240,1610]'),
 ('22222222-2222-4222-8222-000000000004','ContentGen-Prime','11111111-1111-4111-8111-000000000004','0x9C4e1D73b28A6f05E7c3B9d1A248f6031Ec5B7a4',812,32000,'none','Long-form editorial generation, localization and asset briefs',8000,9140,98.8,26,95,false,null,
  '["OpenAI","Anthropic","AWS","Compute Marketplace"]',
  '[{"label":"Task success rate","value":48},{"label":"Principal reputation","value":33},{"label":"Repayment history","value":38},{"label":"Revenue variance","value":-6},{"label":"Spend consistency","value":24},{"label":"Account age","value":17}]',
  '[720,760,745,790,805,798,830,845,861,890]',
  '[160,158,165,170,162,168,159,172,166,171,163,169]'),
 ('22222222-2222-4222-8222-000000000005','LogiRoute-9','11111111-1111-4111-8111-000000000005','0x6D2a9E48c15B7f30A9d4C6e8B375f120Da83C9e5',664,11000,'frozen','Freight route optimization and carrier bid negotiation',3500,0,86.5,51,67,false,null,
  '["AWS","Compute Marketplace","Carrier API"]',
  '[{"label":"Task success rate","value":21},{"label":"Principal reputation","value":15},{"label":"Repayment history","value":-11},{"label":"Revenue variance","value":-19},{"label":"Spend consistency","value":6},{"label":"Account age","value":11}]',
  '[300,340,290,410,255,380,320,275,395,310]',
  '[110,125,118,133,121,129,116,140,127,131,124,136]');

UPDATE public.agents SET frozen_at = now() - interval '5 days', freeze_reason = 'Manual revocation: carrier API credential leak' WHERE name = 'LogiRoute-9';

INSERT INTO public.loans (id, agent_id, amount, interest_rate, task_description, expected_revenue, expected_repayment_date, status, decision_reasons, disbursed_at, repaid_at, created_at) VALUES
 ('33333333-3333-4333-8333-000000000001','22222222-2222-4222-8222-000000000001',8500,5.5,'Enrich 4.2M product records via vendor APIs',13400,CURRENT_DATE + 6,'active','["+42 task success rate","+31 repayment history","+26 principal reputation"]',now() - interval '3 days',null,now() - interval '3 days'),
 ('33333333-3333-4333-8333-000000000002','22222222-2222-4222-8222-000000000001',5200,6.0,'Backfill historical crawl index',7900,CURRENT_DATE - 20,'repaid','["+40 task success rate","+28 repayment history"]',now() - interval '52 days',now() - interval '20 days',now() - interval '52 days'),
 ('33333333-3333-4333-8333-000000000003','22222222-2222-4222-8222-000000000002',6400,7.25,'Run 30-day signal backtest across 12 venues',9800,CURRENT_DATE + 2,'repaying','["+34 task success rate","+25 repayment history","-28 revenue variance"]',now() - interval '9 days',null,now() - interval '9 days'),
 ('33333333-3333-4333-8333-000000000004','22222222-2222-4222-8222-000000000003',1200,12.5,'Index 80k public listing pages',2100,CURRENT_DATE + 1,'active','["-31 task success rate","-40 revenue variance","+8 principal reputation"]',now() - interval '2 days',null,now() - interval '2 days'),
 ('33333333-3333-4333-8333-000000000005','22222222-2222-4222-8222-000000000004',14000,4.75,'Localize 900 editorial assets into 6 languages',22500,CURRENT_DATE - 11,'repaid','["+48 task success rate","+38 repayment history","+33 principal reputation"]',now() - interval '61 days',now() - interval '11 days',now() - interval '61 days'),
 ('33333333-3333-4333-8333-000000000006','22222222-2222-4222-8222-000000000005',4300,9.0,'Optimize 1,400 freight lanes for Q3',6600,CURRENT_DATE - 4,'defaulted','["+21 task success rate","-19 revenue variance","-11 repayment history"]',now() - interval '30 days',null,now() - interval '30 days');

INSERT INTO public.transactions (agent_id, loan_id, tx_hash, tx_type, amount, status, memo, created_at) VALUES
 ('22222222-2222-4222-8222-000000000001','33333333-3333-4333-8333-000000000001','0x4f9a2c81d3b7e605a9c4f2e8b17d3095c6a4e281','disbursement',8500,'confirmed','Scoped wallet funded — vendor whitelist enforced',now() - interval '3 days'),
 ('22222222-2222-4222-8222-000000000001','33333333-3333-4333-8333-000000000001','0xb27e1d94a6c30f85b2d7e91c4a608f3d5b7c2e10','spend',-3680,'confirmed','OpenAI + AWS inference spend',now() - interval '2 days'),
 ('22222222-2222-4222-8222-000000000001','33333333-3333-4333-8333-000000000002','0x83c6f105e2a94b7d0c3f8a15e6b204d9c7a3f5b2','repayment',-5512,'confirmed','Principal + interest routed to escrow',now() - interval '20 days'),
 ('22222222-2222-4222-8222-000000000002','33333333-3333-4333-8333-000000000003','0x1e5b9d34c7a08f62e1b5d3a9c806f42e7b1d9c53','disbursement',6400,'confirmed','Scoped wallet funded',now() - interval '9 days'),
 ('22222222-2222-4222-8222-000000000002','33333333-3333-4333-8333-000000000003','0xd6a2e70b14f9c385a7e2b6d0c439f81e5a3c7b26','repayment',-2400,'confirmed','Partial escrow sweep',now() - interval '1 day'),
 ('22222222-2222-4222-8222-000000000003','33333333-3333-4333-8333-000000000004','0x7a1f4c62b9e08d35c1a7f4b2e6d09538a2c6f7e1','disbursement',1200,'confirmed','Scoped wallet funded',now() - interval '2 days'),
 ('22222222-2222-4222-8222-000000000003',null,'0xf3c8a51d7e2b6094f8a3c1d5b7e20496c8a1f3d7','spend',-1020,'flagged','Spend velocity anomaly — 6.4x baseline',now() - interval '40 minutes'),
 ('22222222-2222-4222-8222-000000000004','33333333-3333-4333-8333-000000000005','0x25d7b9a3c6f14e80b5d2a7c9f3e61048b7d2a5c9','repayment',-14665,'confirmed','Loan closed — surplus released to agent wallet',now() - interval '11 days'),
 ('22222222-2222-4222-8222-000000000005','33333333-3333-4333-8333-000000000006','0x9b4e2a76d15c83f0a6b4e2d8c130f795a6b4e2d8','revocation',0,'confirmed','Access revoked — credential leak',now() - interval '5 days');

INSERT INTO public.score_history (agent_id, score, recorded_at)
SELECT a.id,
       GREATEST(300, LEAST(850, a.credit_score - (11 - g) * (CASE WHEN a.name = 'ScraperX' THEN -14 ELSE 7 END) + ((g * 13) % 9) - 4)),
       now() - ((12 - g) * interval '7 days')
FROM public.agents a CROSS JOIN generate_series(1, 12) AS g;
