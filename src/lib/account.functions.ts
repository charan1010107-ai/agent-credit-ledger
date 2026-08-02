import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAgentSchema } from "./account.schemas";

export const createAgentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createAgentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createOwnedAgent } = await import("./account.server");
    return createOwnedAgent(context.userId, data);
  });
