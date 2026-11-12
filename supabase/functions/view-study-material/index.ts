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
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session is invalid." }, 401);
    const { material_id } = await req.json();
    if (typeof material_id !== "string") return json({ error: "A valid material ID is required." }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: material, error } = await admin.from("study_materials")
      .select("id,course_code,module_index,title,storage_path,is_published")
      .eq("id", material_id).eq("is_published", true).maybeSingle();
    if (error || !material) return json({ error: "Study material not found." }, 404);

    const { data: allowed, error: accessError } = await userClient.rpc("has_premium_access", {
      requested_course_code: material.course_code,
      requested_module_index: material.module_index,
    });
    if (accessError || allowed !== true) return json({ error: "Purchase this course or module to access this material." }, 403);

    const { data: file, error: fileError } = await admin.storage.from("study-materials").download(material.storage_path);
    if (fileError || !file) return json({ error: "Study material is temporarily unavailable." }, 404);
    const safeName = String(material.title || "study-material").replace(/[^a-z0-9 _.-]/gi, "").slice(0, 100) || "study-material";
    return new Response(file.stream(), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="' + safeName + '.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
