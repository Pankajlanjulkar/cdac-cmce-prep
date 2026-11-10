import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    if (!supabaseUrl || !anonKey || !serviceKey || !razorpayKeyId || !razorpaySecret) {
      return json({ error: "Payment server is not configured yet." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Your session is invalid. Please log in again." }, 401);

    const body = await req.json();
    const courseCode = String(body.course_code || "").trim();
    const accessType = body.access_type;
    const moduleIndex = body.module_index === null || body.module_index === undefined ? null : Number(body.module_index);
    if (!/^[A-Z0-9_-]{2,40}$/.test(courseCode)) return json({ error: "Invalid course selection." }, 400);
    if (accessType !== "course" && accessType !== "module") return json({ error: "Invalid purchase type." }, 400);
    if (accessType === "module" && (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex > 30)) {
      return json({ error: "Invalid module selection." }, 400);
    }
    if (accessType === "course" && moduleIndex !== null) return json({ error: "Course purchases cannot include a module index." }, 400);

    const amountInr = accessType === "course" ? 40 : 10;
    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: existing } = await serviceClient.from("student_purchases").select("id")
      .eq("student_id", user.id).eq("course_code", courseCode).eq("access_type", accessType)
      .eq("module_index", moduleIndex).eq("status", "active").limit(1);
    if (existing?.length) return json({ error: "You already have access to this selection." }, 409);

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(razorpayKeyId + ":" + razorpaySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInr * 100,
        currency: "INR",
        receipt: crypto.randomUUID(),
        notes: { student_id: user.id, course_code: courseCode, access_type: accessType, module_index: moduleIndex === null ? "" : String(moduleIndex) },
      }),
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) return json({ error: order.error?.description || "Could not create payment order." }, 502);

    const { error: insertError } = await serviceClient.from("student_purchases").insert({
      student_id: user.id, course_code: courseCode, module_index: moduleIndex,
      access_type: accessType, amount_inr: amountInr, status: "pending",
      provider: "razorpay", provider_reference: order.id,
    });
    if (insertError) return json({ error: "Could not save payment order." }, 500);

    return json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: razorpayKeyId,
      name: "CDAC CMCE Prep", description: accessType === "course" ? "Complete course access" : "Individual module access",
      prefill: { email: user.email || "" } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected payment error." }, 500);
  }
});