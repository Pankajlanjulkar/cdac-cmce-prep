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
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in to access PYQ papers." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !anon || !service) return json({ error: "PYQ service is not configured." }, 500);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session is invalid. Please log in again." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    // PYQ entitlement is global: any active complete-course purchase unlocks the catalogue,
    // including purchases made before this feature was introduced.
    const { data: purchases, error: purchaseError } = await admin.from("student_purchases")
      .select("id").eq("student_id", user.id).eq("access_type", "course").eq("status", "active").limit(1);
    if (purchaseError) return json({ error: "Could not verify course purchase." }, 500);
    if (!purchases?.length) return json({ error: "Purchase any complete course and access PYQ. Existing complete-course purchases are eligible." }, 403);
    const body = await req.json().catch(() => ({}));
    if (body?.action === "list") {
      const { data, error } = await admin.from("pyq_papers")
        .select("id,title,programme,subject,paper_year").eq("is_published", true)
        .order("paper_year", { ascending: false });
      if (error) return json({ error: "PYQ catalogue is not ready. Apply the supplied database setup." }, 500);
      return json({ success: true, papers: data || [] });
    }
    if (body?.action === "view" && typeof body.paper_id === "string") {
      const { data: paper, error } = await admin.from("pyq_papers")
        .select("title,storage_path").eq("id", body.paper_id).eq("is_published", true).maybeSingle();
      if (error || !paper) return json({ error: "Paper not found or not published." }, 404);
      // Return a short-lived signed HTTPS URL instead of streaming a Blob.
      // Mobile Safari/Chrome can hand this URL to their native PDF viewer, avoiding
      // unreliable blob: URLs embedded in iframes.
      const { data: signed, error: signedError } = await admin.storage
        .from("study-materials")
        .createSignedUrl(paper.storage_path, 600);
      if (signedError || !signed?.signedUrl) return json({ error: "Paper file is temporarily unavailable." }, 404);
      return json({ success: true, signed_url: signed.signedUrl, expires_in: 600 });
    }
    return json({ error: "Choose a valid PYQ action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected PYQ error." }, 500);
  }
});
