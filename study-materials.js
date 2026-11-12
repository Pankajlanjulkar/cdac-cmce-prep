// Premium Study Materials — only lists materials covered by an active course/module purchase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const STUDY_SUPABASE_URL = "https://hnwduoyealnceyhmmskl.supabase.co";
const STUDY_SUPABASE_KEY = "sb_publishable_x3wHQJFGHMQ9com5A0J9jA_4YhCzikX";
const studySupabase = createClient(STUDY_SUPABASE_URL, STUDY_SUPABASE_KEY);
const studyStyle = document.createElement("style");
studyStyle.textContent = `
#premiumStudyMaterials{display:none;margin:20px auto 0;max-width:1180px;padding:0 22px}
.study-banner{background:#fff;border:1px solid #c9dfe0;border-left:5px solid #0b6b73;border-radius:14px;padding:18px 20px}
.study-banner-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.study-banner h2{font-size:20px;margin:0}.study-banner p{color:#60717c;margin:7px 0 0;font-size:14px}
.study-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:15px}
.study-item{border:1px solid #d8e1e5;border-radius:11px;padding:14px;background:#f9fbfc}
.study-item strong{display:block;line-height:1.4}.study-item small{display:block;color:#60717c;margin:5px 0 12px}
.study-item button{border:0;border-radius:8px;background:#0b6b73;color:#fff;padding:9px 13px;font-weight:700;cursor:pointer}
.study-viewer{position:fixed;inset:0;z-index:10000;background:#10232cdd;display:none;align-items:center;justify-content:center;padding:18px}
.study-viewer.open{display:flex}.study-viewer-panel{background:#fff;border-radius:14px;width:min(1100px,100%);height:min(92vh,900px);display:flex;flex-direction:column;overflow:hidden}
.study-viewer-head{padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #d8e1e5}
.study-viewer-head strong{font-size:14px}.study-viewer-head button{border:0;background:#eef3f5;padding:8px 12px;border-radius:8px;cursor:pointer}
.study-viewer-frame{border:0;flex:1;width:100%;background:#eef3f5}.study-empty{color:#60717c;font-size:14px;margin-top:12px}
@media(max-width:540px){#premiumStudyMaterials{padding:0 16px}.study-viewer{padding:0}.study-viewer-panel{height:100vh;border-radius:0}}
`;
document.head.append(studyStyle);
const studySection=document.createElement("section");
studySection.id="premiumStudyMaterials";
studySection.innerHTML=`<div class="study-banner"><div class="study-banner-head"><div><div class="eyebrow">Premium library</div><h2>New Study Materials Available</h2><p>Read all notes and PDFs included in your purchased course or module.</p></div><span class="tag">PREMIUM ACCESS</span></div><div id="studyMaterialItems" class="study-items"></div><p id="studyMaterialsEmpty" class="study-empty" hidden>No study materials have been published for your purchases yet.</p></div>`;
document.querySelector("main")?.prepend(studySection);
const studyViewer=document.createElement("div");
studyViewer.className="study-viewer";
studyViewer.innerHTML=`<div class="study-viewer-panel"><div class="study-viewer-head"><strong id="studyViewerTitle">Study material</strong><button type="button" id="studyViewerClose">Close</button></div><iframe class="study-viewer-frame" id="studyViewerFrame" title="Study material viewer" referrerpolicy="no-referrer"></iframe></div>`;
document.body.append(studyViewer);
const closeStudyViewer=()=>{studyViewer.classList.remove("open");const frame=document.getElementById("studyViewerFrame");if(frame.src.startsWith("blob:"))URL.revokeObjectURL(frame.src);frame.removeAttribute("src");};
document.getElementById("studyViewerClose").addEventListener("click",closeStudyViewer);
studyViewer.addEventListener("click",e=>{if(e.target===studyViewer)closeStudyViewer();});
document.addEventListener("contextmenu",e=>{if(studyViewer.classList.contains("open"))e.preventDefault();});
async function refreshStudyMaterials(session){
  if(!session?.user){studySection.style.display="none";return;}
  const {data:purchases,error:pError}=await studySupabase.from("student_purchases").select("course_code,module_index,access_type").eq("student_id",session.user.id).eq("status","active");
  if(pError||!purchases?.length){studySection.style.display="none";return;}
  const {data:materials,error}=await studySupabase.from("study_materials").select("id,course_code,course_name,module_index,module_name,title").eq("is_published",true).order("display_order");
  if(error){console.error("Study materials could not be loaded:",error.message);studySection.style.display="none";return;}
  const eligible=(materials||[]).filter(m=>purchases.some(p=>p.course_code===m.course_code&&(p.access_type==="course"||(p.access_type==="module"&&Number(p.module_index)===Number(m.module_index)))));
  studySection.style.display="block";
  const container=document.getElementById("studyMaterialItems");container.replaceChildren();
  document.getElementById("studyMaterialsEmpty").hidden=eligible.length>0;
  eligible.forEach(m=>{
    const card=document.createElement("article");card.className="study-item";
    const title=document.createElement("strong");title.textContent=m.title;
    const module=document.createElement("small");module.textContent=m.course_name+" · "+m.module_name;
    const button=document.createElement("button");button.type="button";button.textContent="Read online";
    button.addEventListener("click",()=>openStudyMaterial(m,session));
    card.append(title,module,button);container.append(card);
  });
}
async function openStudyMaterial(material,session){
  const button=[...document.querySelectorAll(".study-item button")].find(b=>b.closest(".study-item")?.querySelector("strong")?.textContent===material.title);
  if(button){button.disabled=true;button.textContent="Loading…";}
  try{
    const {data:{session:liveSession}}=await studySupabase.auth.getSession();
    if(!liveSession?.access_token)throw new Error("Please sign in again.");
    const response=await fetch(STUDY_SUPABASE_URL+"/functions/v1/view-study-material",{
      method:"POST",headers:{"Authorization":"Bearer "+liveSession.access_token,"apikey":STUDY_SUPABASE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({material_id:material.id})
    });
    if(!response.ok){const problem=await response.json().catch(()=>({}));throw new Error(problem.error||"Could not open this material.");}
    const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);
    document.getElementById("studyViewerTitle").textContent=material.module_name+" — "+material.title;
    document.getElementById("studyViewerFrame").src=objectUrl+"#toolbar=0&navpanes=0";
    studyViewer.classList.add("open");
  }catch(error){alert(error.message||"Could not open study material.");}
  finally{if(button){button.disabled=false;button.textContent="Read online";}}
}
studySupabase.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>refreshStudyMaterials(session),0);});
studySupabase.auth.getSession().then(({data})=>refreshStudyMaterials(data.session));
