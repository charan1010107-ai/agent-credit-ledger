import { z } from "zod";

export const createAgentSchema = z.object({
  agentName: z.string().trim().min(2).max(40),
  useCase: z.enum([
    "data_scraping",
    "trading_execution",
    "content_generation",
    "logistics_optimization",
    "api_automation",
  ]),
  frequency: z.enum(["low", "medium", "high"]),
  riskTolerance: z.number().int().min(1).max(5),
  spendIntensity: z.number().int().min(1).max(5),
  /** Optional overrides produced by the CSV "upload task history" path. */
  source: z.enum(["manual", "upload"]).optional(),
  starterTask: z.string().trim().min(3).max(200).optional(),
  vendorWhitelist: z.array(z.string().trim().min(1).max(48)).max(12).optional(),
  derivedStats: z
    .object({
      rows: z.number().int().min(0).max(1000),
      successes: z.number().int().min(0).max(1000),
      failures: z.number().int().min(0).max(1000),
      successRate: z.number().min(0).max(100),
      avgRevenue: z.number().min(0),
      avgCost: z.number().min(0),
      revenueConsistency: z.number().min(0).max(100),
    })
    .optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
