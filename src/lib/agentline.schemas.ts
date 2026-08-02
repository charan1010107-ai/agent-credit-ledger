import { z } from "zod";

export const disburseSchema = z.object({
  agentId: z.string().uuid(),
  amount: z.number().finite().int().min(1000).max(100_000_000),
  expectedRevenue: z.number().finite().int().min(0).max(1_000_000_000),
  taskDescription: z.string().trim().min(3).max(240),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  custom: z
    .object({
      name: z.string().trim().min(2).max(60),
      vendors: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
      timeframeDays: z.number().finite().min(0.1).max(365),
    })
    .optional(),
});


export const agentIdSchema = z.object({ agentId: z.string().uuid() });

export const escalateSchema = z.object({
  agentId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export const settleSchema = z.object({ loanId: z.string().uuid() });
