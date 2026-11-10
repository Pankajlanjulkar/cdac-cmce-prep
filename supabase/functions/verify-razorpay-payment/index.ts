import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Please log in first." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    if (!supabaseUrl || !anonKey || !serviceKey || !razorpayKeyId || !razorpaySecret) return json({ error: "Payment server is not configured yet." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Your session is invalid. Please log in again." }, 401);

    const requestBody = await req.json();

    // Recover earlier successful payments for this signed-in student. This
    // uses Razorpay's server-to-server order payments API, so no client-supplied
    // payment ID or signature is trusted for recovery.
    if (requestBody?.action === "recover_pending") {
      const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: pending, error: pendingError } = await serviceClient.from("student_purchases")
        .select("id,provider_reference,amount_inr")
        .eq("provider", "razorpay").eq("student_id", user.id).eq("status", "pending");
      if (pendingError) return json({ error: "Could not check pending purchases: " + pendingError.message }, 500);

      let recovered = 0;
      for (const purchase of pending || []) {
        if (!purchase.provider_reference) continue;
        const paymentsResponse = await fetch("https://api.razorpay.com/v1/orders/" +
          encodeURIComponent(purchase.provider_reference) + "/payments", {
            headers: { "Authorization": "Basic " + btoa(razorpayKeyId + ":" + razorpaySecret) },
          });
        const paymentsData = await paymentsResponse.json();
        if (!paymentsResponse.ok) continue;

        for (let payment of paymentsData.items || []) {
          if (payment.order_id !== purchase.provider_reference ||
              payment.amount !== purchase.amount_inr * 100 || payment.currency !== "INR") continue;

          if (payment.status === "authorized") {
            const captureResponse = await fetch("https://api.razorpay.com/v1/payments/" +
              encodeURIComponent(payment.id) + "/capture", {
                method: "POST",
                headers: {
                  "Authorization": "Basic " + btoa(razorpayKeyId + ":" + razorpaySecret),
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ amount: purchase.amount_inr * 100, currency: "INR" }),
              });
            payment = await captureResponse.json();
            if (!captureResponse.ok) continue;
          }

          if (payment.status !== "captured") continue;
          const { data: activated, error: activationError } = await serviceClient.from("student_purchases")
            .update({ status: "active" }).eq("id", purchase.id).eq("student_id", user.id)
            .eq("status", "pending").select("id").maybeSingle();
          if (!activationError && activated) recovered++;
          break;
        }
      }
      return json({ success: true, recovered, message: recovered
        ? recovered + " previous successful purchase(s) restored."
        : "No captured pending payments were found for this account." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = requestBody;
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((v) => typeof v === "string" && v.length > 0)) {
      return json({ error: "Missing payment verification details." }, 400);
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: purchase, error: purchaseError } = await serviceClient.from("student_purchases")
      .select("*").eq("provider", "razorpay").eq("provider_reference", razorpay_order_id)
      .eq("student_id", user.id).maybeSingle();
    if (purchaseError || !purchase) return json({ error: "Payment order was not found for this account." }, 404);
    if (purchase.status === "active") return json({ success: true, message: "Access is already active." });

    const expected = await hmacHex(razorpaySecret, razorpay_order_id + "|" + razorpay_payment_id);
    if (!safeEqual(expected, razorpay_signature)) return json({ error: "Payment signature verification failed." }, 400);

    const paymentResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(razorpay_payment_id), {
      headers: { "Authorization": "Basic " + btoa(razorpayKeyId + ":" + razorpaySecret) },
    });
    let payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== razorpay_order_id ||
        payment.amount !== purchase.amount_inr * 100 || payment.currency !== "INR") {
      return json({ error: "Payment details do not match this order. Access has not been granted." }, 400);
    }

    // Some Razorpay accounts leave successful payments in "authorized" until
    // capture. Capture only after signature, order, amount and currency checks.
    if (payment.status === "authorized") {
      const captureResponse = await fetch("https://api.razorpay.com/v1/payments/" +
        encodeURIComponent(razorpay_payment_id) + "/capture", {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(razorpayKeyId + ":" + razorpaySecret),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount: purchase.amount_inr * 100, currency: "INR" }),
        });
      payment = await captureResponse.json();
      if (!captureResponse.ok) {
        return json({ error: payment.error?.description || "Payment was authorized but could not be captured. Please contact support before retrying." }, 502);
      }
    }

    if (payment.status !== "captured") {
      return json({ error: "Payment is not captured (current status: " + String(payment.status || "unknown") + "). Access has not been granted." }, 400);
    }

    // Keep activation independent of the optional audit column migration.
    // The payment ID is already verified with Razorpay above; the purchase
    // record only needs its status changed to grant the entitlement.
    const { data: activated, error: updateError } = await serviceClient.from("student_purchases").update({
      status: "active",
    }).eq("id", purchase.id).eq("student_id", user.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError) return json({ error: "Payment captured, but access activation failed: " + updateError.message }, 500);
    if (!activated) {
      const { data: refreshed, error: refreshError } = await serviceClient.from("student_purchases")
        .select("status").eq("id", purchase.id).eq("student_id", user.id).maybeSingle();
      if (refreshError || refreshed?.status !== "active") {
        return json({ error: "Payment captured, but the premium access record was not activated. Please contact support with your order ID." }, 500);
      }
    }
    return json({ success: true, message: "Payment verified and captured. Premium access is active." });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected verification error." }, 500);
  }
});