import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1";
const MATTHEW_USER_ID = "4a066397-68cf-47ee-86d7-436cd07ec6ce";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("SMARTLEAD_API_KEY");
    if (!apiKey) {
      throw new Error("SMARTLEAD_API_KEY not configured");
    }

    // Step 1: Get all campaigns
    const campaignsRes = await fetch(
      `${SMARTLEAD_BASE}/campaigns?api_key=${apiKey}`
    );
    if (!campaignsRes.ok) {
      throw new Error(`Failed to fetch campaigns: ${campaignsRes.status}`);
    }
    const campaigns = await campaignsRes.json();

    let totalImported = 0;
    const errors: string[] = [];

    // Step 2: For each campaign, get leads and filter for sent/completed
    for (const campaign of campaigns) {
      try {
        // Fetch leads with offset pagination
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const leadsRes = await fetch(
            `${SMARTLEAD_BASE}/campaigns/${campaign.id}/leads?api_key=${apiKey}&offset=${offset}&limit=${limit}`
          );

          if (!leadsRes.ok) {
            errors.push(
              `Campaign ${campaign.id}: HTTP ${leadsRes.status}`
            );
            break;
          }

          const leads = await leadsRes.json();
          if (!Array.isArray(leads) || leads.length === 0) {
            hasMore = false;
            break;
          }

          // Filter for leads where lead_status indicates sequence completed / sent
          const sentLeads = leads.filter((lead: any) => {
            const status = (lead.lead_status || lead.status || "").toLowerCase();
            return (
              status === "completed" ||
              status === "sent" ||
              status === "email_sent" ||
              status === "sequence_completed"
            );
          });

          // Upsert into partners
          for (const lead of sentLeads) {
            const email = lead.email || lead.lead_email || "";
            if (!email) continue;

            const name =
              [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
              lead.name ||
              "";

            const { error: upsertError } = await supabase
              .from("partners")
              .upsert(
                {
                  email,
                  name,
                  status: "sent_contract",
                  created_by: MATTHEW_USER_ID,
                },
                { onConflict: "email" }
              );

            if (upsertError) {
              errors.push(`Upsert ${email}: ${upsertError.message}`);
            } else {
              totalImported++;
            }
          }

          if (leads.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }
      } catch (e) {
        errors.push(`Campaign ${campaign.id}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: totalImported,
        campaigns_checked: campaigns.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
