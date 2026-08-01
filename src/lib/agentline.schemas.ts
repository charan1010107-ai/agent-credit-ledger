import { z } from "zod";

export const disburseSchema = z.object({
  agentId: z.string().uuid(),
  amount: z.number().finite().int().min(1000).max(100_000_000),
  expectedRevenue: z.number().finite().int().min(0).max(1_000_000_000),
  taskDescription: z.string().trim().min(3).max(240),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const agentIdSchema = z.object({ agentId: z.string().uuid() });

export const settleSchema = z.object({ loanId: z.string().uuid() });
