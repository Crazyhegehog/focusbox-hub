import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Received Stripe event: ${event.type}`);

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("Processing checkout session:", session.id);

      // Retrieve line items from Stripe
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
        { expand: ["data.price.product"] }
      );

      // Build product name from line items
      const productNames = lineItems.data
        .map((item) => {
          const product = item.price?.product as Stripe.Product;
          return product?.name || item.description || "Unknown Product";
        })
        .join(", ");

      const totalQuantity = lineItems.data.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0
      );

      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: session.customer_details?.name || session.customer_email || "Stripe Customer",
          customer_email: session.customer_email || "",
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === "string" 
            ? session.payment_intent 
            : session.payment_intent?.id || null,
          amount_total: session.amount_total || 0,
          currency: session.currency || "eur",
          stripe_product_name: productNames,
          quantity: totalQuantity,
          status: "pending",
          phone_size: "", // Default, can be extracted from metadata
        })
        .select()
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        return new Response(
          JSON.stringify({ error: "Failed to create order" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Order created:", order.id);

      // Insert order items and reduce inventory
      for (const item of lineItems.data) {
        const product = item.price?.product as Stripe.Product;
        const productName = product?.name || item.description || "Unknown";
        const qty = item.quantity || 1;

        // Insert order item
        await supabase.from("order_items").insert({
          order_id: order.id,
          product_name: productName,
          quantity: qty,
          unit_price: item.price?.unit_amount || 0,
          stripe_price_id: item.price?.id || null,
          stripe_product_id: product?.id || null,
        });

        // Try to match inventory item by name and reduce stock
        const { data: inventoryItem } = await supabase
          .from("inventory_items")
          .select("id, current_stock, name, reorder_threshold")
          .ilike("name", `%${productName}%`)
          .maybeSingle();

        if (inventoryItem) {
          const newStock = Math.max(0, inventoryItem.current_stock - qty);

          await supabase
            .from("inventory_items")
            .update({ current_stock: newStock })
            .eq("id", inventoryItem.id);

          // Log inventory change
          await supabase.from("inventory_history").insert({
            inventory_item_id: inventoryItem.id,
            change_amount: -qty,
            reason: `Stripe order ${order.id} - ${productName}`,
          });

          // Log low stock warning
          if (newStock <= inventoryItem.reorder_threshold) {
            console.warn(
              `⚠️ LOW STOCK: ${inventoryItem.name} is at ${newStock} units (threshold: ${inventoryItem.reorder_threshold})`
            );

            await supabase.from("activity_log").insert({
              action: "low_stock_warning",
              entity_type: "inventory_item",
              entity_id: inventoryItem.id,
              metadata: {
                item_name: inventoryItem.name,
                current_stock: newStock,
                threshold: inventoryItem.reorder_threshold,
              },
            });
          }
        }
      }

      // Log activity
      await supabase.from("activity_log").insert({
        action: "order_created_via_stripe",
        entity_type: "order",
        entity_id: order.id,
        metadata: {
          stripe_session_id: session.id,
          customer_email: session.customer_email,
          amount: session.amount_total,
          currency: session.currency,
          products: productNames,
        },
      });

      console.log("Order processing complete for session:", session.id);
    }

    // Handle payment_intent.succeeded (optional additional tracking)
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log("Payment succeeded:", paymentIntent.id);

      await supabase.from("activity_log").insert({
        action: "payment_succeeded",
        entity_type: "payment",
        entity_id: paymentIntent.id,
        metadata: {
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
