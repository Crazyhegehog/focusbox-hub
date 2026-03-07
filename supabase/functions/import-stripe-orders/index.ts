import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify user
  const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
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

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let imported = 0;
    let skipped = 0;
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.Checkout.SessionListParams = {
        limit: 100,
        status: "complete",
        expand: ["data.line_items", "data.line_items.data.price.product"],
      };
      if (startingAfter) params.starting_after = startingAfter;

      const sessions = await stripe.checkout.sessions.list(params);

      for (const session of sessions.data) {
        // Check if already imported
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Get line items (may need separate call if not expanded)
        let lineItems;
        try {
          lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
            expand: ["data.price.product"],
          });
        } catch {
          lineItems = { data: [] };
        }

        const productNames = lineItems.data
          .map((item) => {
            const product = item.price?.product as Stripe.Product;
            return product?.name || item.description || "Unknown";
          })
          .join(", ");

        const totalQuantity = lineItems.data.reduce(
          (sum, item) => sum + (item.quantity || 1),
          0
        );

        // Extract shipping address
        const shipping = session.shipping_details || session.customer_details;
        const address = shipping?.address;

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_name: session.customer_details?.name || session.customer_email || "Stripe Customer",
            customer_email: session.customer_email || "",
            customer_phone: session.customer_details?.phone || "",
            stripe_session_id: session.id,
            stripe_payment_intent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id || null,
            amount_total: session.amount_total || 0,
            currency: session.currency || "eur",
            stripe_product_name: productNames,
            quantity: totalQuantity,
            shipping_address: address?.line1
              ? [address.line1, address.line2].filter(Boolean).join(", ")
              : "",
            shipping_city: address?.city || "",
            shipping_country: address?.country || "",
            shipping_postal_code: address?.postal_code || "",
            shipping_state: address?.state || "",
            status: "pending",
            phone_size: session.metadata?.phone_size || "",
            created_at: new Date(session.created * 1000).toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error importing order:", orderError);
          continue;
        }

        // Insert line items
        for (const item of lineItems.data) {
          const product = item.price?.product as Stripe.Product;
          await supabase.from("order_items").insert({
            order_id: order.id,
            product_name: product?.name || item.description || "Unknown",
            quantity: item.quantity || 1,
            unit_price: item.price?.unit_amount || 0,
            stripe_price_id: item.price?.id || null,
            stripe_product_id: product?.id || null,
          });
        }

        imported++;
      }

      hasMore = sessions.has_more;
      if (sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        message: `Imported ${imported} orders, skipped ${skipped} duplicates`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Import error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
