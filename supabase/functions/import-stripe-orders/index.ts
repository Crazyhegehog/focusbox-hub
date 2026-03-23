import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Phone model patterns to auto-detect phone_size
const PHONE_PATTERNS = [
  /iphone\s*\d+\s*(pro\s*max|pro|plus|mini)?/i,
  /samsung\s*(galaxy\s*)?(s|a|z)\s*\d+\s*(ultra|plus|\+|fe)?/i,
  /pixel\s*\d+\s*(pro|a)?/i,
  /huawei\s*(p|mate)\s*\d+\s*(pro|lite)?/i,
  /oneplus\s*\d+\s*(pro|t)?/i,
  /xiaomi\s*(mi\s*)?\d+\s*(pro|ultra|lite)?/i,
  /redmi\s*(note\s*)?\d+\s*(pro|s)?/i,
  /oppo\s*(find|reno)\s*\d+\s*(pro)?/i,
];

function detectPhoneSize(text: string): string {
  if (!text) return "";
  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return "";
}

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
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

  if (!STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let imported = 0;
    let skipped = 0;
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      // Use raw fetch to avoid Stripe SDK Deno compatibility issues
      const params = new URLSearchParams({
        limit: "100",
        status: "complete",
        "expand[]": "data.customer_details",
      });
      if (startingAfter) params.set("starting_after", startingAfter);

      const sessionsRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
        }
      );
      const sessionsData = await sessionsRes.json();

      if (!sessionsRes.ok) {
        throw new Error(sessionsData.error?.message || "Failed to fetch sessions");
      }

      for (const session of sessionsData.data) {
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

        // Get line items separately
        let lineItemsData: any[] = [];
        try {
          const liRes = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?expand[]=data.price.product&limit=100`,
            { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
          );
          const liJson = await liRes.json();
          lineItemsData = liJson.data || [];
        } catch (e) {
          console.error("Error fetching line items:", e);
        }

        const productNames = lineItemsData
          .map((item: any) => {
            const product = item.price?.product;
            return (typeof product === "object" ? product?.name : null) || item.description || "Unknown";
          })
          .join(", ");

        const totalQuantity = lineItemsData.reduce(
          (sum: number, item: any) => sum + (item.quantity || 1), 0
        ) || 1;

        // Extract ALL shipping and customer details
        const shipping = session.shipping_details;
        const customerDetails = session.customer_details;
        const shippingAddress = shipping?.address || customerDetails?.address;

        const customerName =
          shipping?.name || customerDetails?.name || session.customer_email || "Stripe Customer";
        const customerPhone = customerDetails?.phone || shipping?.phone || "";
        const customerEmail = session.customer_email || customerDetails?.email || "";

        // Collect ALL metadata from every source
        const allMetadata: Record<string, any> = {
          session_metadata: session.metadata || {},
          customer_details: customerDetails || {},
          shipping_details: shipping || {},
          payment_intent: session.payment_intent,
          payment_status: session.payment_status,
          mode: session.mode,
          locale: session.locale,
          custom_fields: session.custom_fields || [],
          line_items: lineItemsData.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            amount_total: item.amount_total,
            product_name: typeof item.price?.product === "object" ? item.price.product.name : null,
            product_description: typeof item.price?.product === "object" ? item.price.product.description : null,
            product_metadata: typeof item.price?.product === "object" ? item.price.product.metadata : null,
          })),
        };

        // Auto-detect phone size from metadata, custom fields, product names, descriptions
        let phoneSize =
          session.metadata?.phone_size ||
          session.metadata?.Phone_Size ||
          session.metadata?.phoneSize ||
          session.metadata?.size ||
          session.metadata?.Size ||
          session.metadata?.phone_model ||
          session.metadata?.Phone_Model ||
          session.metadata?.model ||
          "";

        // Check custom_fields (Stripe Checkout custom fields)
        if (!phoneSize && Array.isArray(session.custom_fields)) {
          for (const field of session.custom_fields) {
            const key = (field.key || field.label?.custom || "").toLowerCase();
            const val = field.text?.value || field.dropdown?.value || field.numeric?.value || "";
            if (val && (key.includes("phone") || key.includes("model") || key.includes("size") || key.includes("handy") || key.includes("gerät") || key.includes("device"))) {
              phoneSize = val;
              break;
            }
            // If no key match, try detecting phone model from the value
            if (val && !phoneSize) {
              const detected = detectPhoneSize(val);
              if (detected) {
                phoneSize = val; // Use full value, not just regex match
                break;
              }
            }
          }
        }

        if (!phoneSize) {
          // Check product metadata
          for (const item of lineItemsData) {
            const product = typeof item.price?.product === "object" ? item.price.product : null;
            if (product?.metadata) {
              phoneSize = product.metadata.phone_size || product.metadata.size || product.metadata.model || "";
              if (phoneSize) break;
            }
          }
        }

        if (!phoneSize) {
          // Auto-detect from product names and descriptions
          const searchTexts = [
            productNames,
            ...lineItemsData.map((i: any) => i.description || ""),
            ...lineItemsData.map((i: any) => {
              const p = typeof i.price?.product === "object" ? i.price.product : null;
              return (p?.name || "") + " " + (p?.description || "");
            }),
            JSON.stringify(session.metadata || {}),
          ].join(" ");

          phoneSize = detectPhoneSize(searchTexts);
        }

        // Last resort: if still empty, use any custom_field value that looks like a phone
        if (!phoneSize && Array.isArray(session.custom_fields)) {
          for (const field of session.custom_fields) {
            const val = field.text?.value || field.dropdown?.value || "";
            if (val) {
              phoneSize = val;
              break;
            }
          }
        }

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            stripe_session_id: session.id,
            stripe_payment_intent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id || null,
            amount_total: session.amount_total || 0,
            currency: session.currency || "eur",
            stripe_product_name: productNames,
            quantity: totalQuantity,
            shipping_address: shippingAddress?.line1
              ? [shippingAddress.line1, shippingAddress.line2].filter(Boolean).join(", ")
              : "",
            shipping_city: shippingAddress?.city || "",
            shipping_country: shippingAddress?.country || "",
            shipping_postal_code: shippingAddress?.postal_code || "",
            shipping_state: shippingAddress?.state || "",
            status: "pending",
            phone_size: phoneSize,
            stripe_metadata: allMetadata,
            created_at: new Date(session.created * 1000).toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error importing order:", orderError);
          continue;
        }

        // Insert line items
        for (const item of lineItemsData) {
          const product = typeof item.price?.product === "object" ? item.price.product : null;
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

      hasMore = sessionsData.has_more;
      if (sessionsData.data.length > 0) {
        startingAfter = sessionsData.data[sessionsData.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Import error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
