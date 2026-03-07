import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEAM_MEMBERS = [
  { email: "ella.brunner@stift.ch", password: "Ella#Lock2026", fullName: "Ella Brunner", role: "member" },
  { email: "allegra.schober@stift.ch", password: "Allegra#Lock2026", fullName: "Allegra Schober", role: "member" },
  { email: "paul.vogt@stift.ch", password: "Paul#Lock2026", fullName: "Paul Vogt", role: "member" },
  { email: "viviana.lindemann@stift.ch", password: "Viviana#Lock2026", fullName: "Viviana Lindemann", role: "member" },
  { email: "elis.schoenbaechler@stift.ch", password: "Elis#Lock2026", fullName: "Elis Schönbächler", role: "admin" },
  { email: "matthew.edelman@stift.ch", password: "Matthew#Lock2026", fullName: "Matthew Edelman", role: "admin" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results = [];

  for (const member of TEAM_MEMBERS) {
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === member.email);

    if (existing) {
      // Ensure role is set
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("*")
        .eq("user_id", existing.id)
        .eq("role", member.role)
        .maybeSingle();

      if (!roleData && member.role !== "member") {
        // Update role from member to admin
        await supabaseAdmin.from("user_roles").upsert({
          user_id: existing.id,
          role: member.role,
        }, { onConflict: "user_id,role" });
      }

      results.push({ email: member.email, status: "exists", role: member.role });
      continue;
    }

    // Create user
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: member.password,
      email_confirm: true,
      user_metadata: { full_name: member.fullName },
    });

    if (error) {
      results.push({ email: member.email, status: "error", error: error.message });
      continue;
    }

    // Set role (trigger creates 'member' by default, upgrade if needed)
    if (member.role !== "member" && newUser.user) {
      await supabaseAdmin.from("user_roles").upsert({
        user_id: newUser.user.id,
        role: member.role,
      }, { onConflict: "user_id,role" });
    }

    results.push({ email: member.email, status: "created", role: member.role });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
