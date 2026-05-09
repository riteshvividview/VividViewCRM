"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async (result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const user = result.data.user;
      if (!user) { setLoading(false); return; }
      const res = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      setProfile(res.data ? { ...res.data, email: user.email ?? "" } : null);
      setLoading(false);
    });
  }, []);

  return { profile, loading };
}
