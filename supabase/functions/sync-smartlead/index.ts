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
    console.log("Fetching campaigns...");
    const campaignsRes = await fetch(
      `${SMARTLEAD_BASE}/campaigns?api_key=${apiKey}`
    );
    if (!campaignsRes.ok) {
      const body = await campaignsRes.text();
      throw new Error(`Failed to fetch campaigns: ${campaignsRes.status} - ${body}`);
    }
    const campaigns = await campaignsRes.json();
    console.log(`Found ${campaigns.length} campaigns`);

    let totalImported = 0;
    const errors: string[] = [];

    // Step 2: For each campaign, get ALL leads — they are all "sent" contacts
    for (const campaign of campaigns) {
      try {
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        console.log(`Processing campaign: ${campaign.id} - ${campaign.name}`);

        while (hasMore) {
          const leadsUrl = `${SMARTLEAD_BASE}/campaigns/${campaign.id}/leads?api_key=${apiKey}&offset=${offset}&limit=${limit}`;
          console.log(`Fetching leads offset=${offset}`);
          const leadsRes = await fetch(leadsUrl);

          if (!leadsRes.ok) {
            const body = await leadsRes.text();
            errors.push(`Campaign ${campaign.id}: HTTP ${leadsRes.status} - ${body}`);
            break;
          }

          const leadsData = await leadsRes.json();
          // API may return { data: [...] } or just [...]
          const leads = Array.isArray(leadsData) ? leadsData : (leadsData.data || []);
          
          console.log(`Got ${leads.length} leads at offset ${offset}`);
          
          if (leads.length === 0) {
            hasMore = false;
            break;
          }

          // Log first lead to see structure
          if (offset === 0) {
            console.log("Sample lead:", JSON.stringify(leads[0]));
          }

          // Import ALL leads as sent_contract partners (they are all "sent" contacts)
          for (const lead of leads) {
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
                  name: name || email.split("@")[0],
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

    console.log(`Sync complete: ${totalImported} imported, ${errors.length} errors`);

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
