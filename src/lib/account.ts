import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Agent } from "./agentline";

export type Profile = {
  id: string;
  account_type: "individual" | "organization";
  display_name: string;
  org_name: string | null;
  principal_id: string | null;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, ready, user: session?.user ?? null };
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, account_type, display_name, org_name, principal_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

export async function fetchMyAgent(userId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*, principals(*)")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Agent) ?? null;
}

export function principalLabel(profile: Profile | null): string {
  if (!profile) return "—";
  return (
    (profile.account_type === "organization" ? profile.org_name : profile.display_name) ||
    profile.display_name ||
    "—"
  );
}
