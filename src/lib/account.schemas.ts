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
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
