import { createServerFn } from "@tanstack/react-start";
import { agentIdSchema, disburseSchema, settleSchema } from "./agentline.schemas";

export const disburseLoanFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => disburseSchema.parse(data))
  .handler(async ({ data }) => {
    const { disburseLoan } = await import("./agentline.server");
    return disburseLoan(data);
  });

export const freezeAgentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => agentIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { freezeAgent } = await import("./agentline.server");
    return freezeAgent(data.agentId);
  });

export const unfreezeAgentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => agentIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { unfreezeAgent } = await import("./agentline.server");
    return unfreezeAgent(data.agentId);
  });

export const settleLoanFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => settleSchema.parse(data))
  .handler(async ({ data }) => {
    const { settleLoan } = await import("./agentline.server");
    return settleLoan(data.loanId);
  });
