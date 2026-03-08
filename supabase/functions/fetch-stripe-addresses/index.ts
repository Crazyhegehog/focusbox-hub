import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { session_ids } = await req.json();
    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return new Response(JSON.stringify({ error: "session_ids array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};

    for (const sessionId of session_ids) {
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=customer_details`,
          { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        const session = await res.json();
        if (!res.ok) {
          results[sessionId] = { error: session.error?.message || "Failed" };
          continue;
        }

        const shipping = session.shipping_details;
        const customerDetails = session.customer_details;
        const address = shipping?.address || customerDetails?.address;

        results[sessionId] = {
          shipping_name: shipping?.name || customerDetails?.name || "",
          shipping_address_line1: address?.line1 || "",
          shipping_address_line2: address?.line2 || "",
          shipping_city: address?.city || "",
          shipping_postal_code: address?.postal_code || "",
          shipping_country: address?.country || "",
          customer_name: shipping?.name || customerDetails?.name || "",
          customer_email: session.customer_email || customerDetails?.email || "",
          customer_phone: customerDetails?.phone || "",
        };
      } catch (e) {
        results[sessionId] = { error: e instanceof Error ? e.message : "Unknown error" };
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
