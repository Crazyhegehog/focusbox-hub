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
    const allSessions: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params = new URLSearchParams({
        limit: "100",
        status: "complete",
      });
      if (startingAfter) params.set("starting_after", startingAfter);

      const res = await fetch(
        `https://api.stripe.com/v1/checkout/sessions?${params.toString()}`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Stripe API error");

      for (const session of data.data) {
        // Get line items for product info
        let productName = "";
        let phoneModel = "";
        try {
          const liRes = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?expand[]=data.price.product&limit=10`,
            { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
          );
          const liData = await liRes.json();
          const items = liData.data || [];
          productName = items.map((i: any) => {
            const p = typeof i.price?.product === "object" ? i.price.product : null;
            return p?.name || i.description || "";
          }).filter(Boolean).join(", ");

          // Try to detect phone model from product names/metadata
          const searchText = items.map((i: any) => {
            const p = typeof i.price?.product === "object" ? i.price.product : null;
            return [p?.name, p?.description, i.description, JSON.stringify(p?.metadata || {})].join(" ");
          }).join(" ");
          
          const phoneMatch = searchText.match(/iphone\s*\d+\s*(pro\s*max|pro|plus|mini)?/i);
          if (phoneMatch) phoneModel = phoneMatch[0].trim();
        } catch (_) { /* ignore */ }

        const shipping = session.shipping_details;
        const cd = session.customer_details;
        const addr = shipping?.address || cd?.address;
        const totalQty = 1; // Default

        allSessions.push({
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
          customer_name: shipping?.name || cd?.name || "",
          customer_email: session.customer_email || cd?.email || "",
          phone_model: phoneModel,
          quantity: totalQty,
          amount_total: session.amount_total || 0,
          currency: session.currency || "chf",
          delivery_method: addr ? "shipping" : "pickup",
          shipping_name: shipping?.name || cd?.name || "",
          shipping_address_line1: addr?.line1 || "",
          shipping_address_line2: addr?.line2 || "",
          shipping_city: addr?.city || "",
          shipping_postal_code: addr?.postal_code || "",
          shipping_country: addr?.country || "",
          order_status: "paid",
          created_at: new Date(session.created * 1000).toISOString(),
          product_name: productName,
        });
      }

      hasMore = data.has_more;
      if (data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    return new Response(JSON.stringify({ sessions: allSessions }), {
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
