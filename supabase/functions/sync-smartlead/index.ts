import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1";
const MATTHEW_USER_ID = "4a066397-68cf-47ee-86d7-436cd07ec6ce";
const SENT_STATUSES = new Set(["INPROGRESS", "COMPLETED", "PAUSED", "STOPPED"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
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

    const campaignsRes = await fetch(`${SMARTLEAD_BASE}/campaigns?api_key=${apiKey}`);
    if (!campaignsRes.ok) {
      const body = await campaignsRes.text();
      throw new Error(`Failed to fetch campaigns: ${campaignsRes.status} - ${body}`);
    }

    const campaigns = await campaignsRes.json();
    let imported = 0;
    let matchedSent = 0;
    let skippedNoEmail = 0;
    const statusCounts: Record<string, number> = {};
    const errors: string[] = [];

    for (const campaign of campaigns) {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const leadsRes = await fetch(
          `${SMARTLEAD_BASE}/campaigns/${campaign.id}/leads?api_key=${apiKey}&offset=${offset}&limit=${limit}`
        );

        if (!leadsRes.ok) {
          const body = await leadsRes.text();
          errors.push(`Campaign ${campaign.id}: HTTP ${leadsRes.status} - ${body}`);
          break;
        }

        const leadsData = await leadsRes.json();
        const leads = Array.isArray(leadsData) ? leadsData : (leadsData.data || []);

        if (!leads.length) {
          hasMore = false;
          break;
        }

        for (const row of leads) {
          const status = String(row.status || row.lead_status || row.lead?.status || "UNKNOWN").toUpperCase();
          statusCounts[status] = (statusCounts[status] || 0) + 1;

          if (!SENT_STATUSES.has(status)) continue;
          matchedSent += 1;

          const leadObj = row.lead ?? row;
          const email = (leadObj.email || leadObj.lead_email || "").trim().toLowerCase();
          if (!email) {
            skippedNoEmail += 1;
            continue;
          }

          const name =
            [leadObj.first_name, leadObj.last_name].filter(Boolean).join(" ") ||
            leadObj.name ||
            email.split("@")[0];

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
            continue;
          }

          imported += 1;
        }

        if (leads.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        matched_sent: matchedSent,
        skipped_no_email: skippedNoEmail,
        campaigns_checked: campaigns.length,
        status_counts: statusCounts,
        errors: errors.length ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
