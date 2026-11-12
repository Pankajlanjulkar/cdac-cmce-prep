import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase=createClient("https://hnwduoyealnceyhmmskl.supabase.co","sb_publishable_x3wHQJFGHMQ9com5A0J9jA_4YhCzikX");
const style=document.createElement("style");
style.textContent=`
#studentReferralButton{margin-left:8px}.referral-dialog{max-width:560px}.referral-card{background:#f4f9f9;border:1px solid #c9dfe0;border-radius:12px;padding:16px;margin:14px 0}.referral-code{font-size:22px;font-weight:850;letter-spacing:2px;color:#0b6b73}.referral-progress{height:10px;background:#e3eaec;border-radius:99px;overflow:hidden;margin:10px 0}.referral-progress>span{display:block;height:100%;background:#0b6b73;width:0}.referral-dialog input{width:100%;padding:11px;border:1px solid var(--line);border-radius:8px;margin:7px 0 12px;font:inherit}.referral-muted{color:var(--muted);font-size:13px;line-height:1.5}
`;
document.head.append(style);
style.textContent += `#referralPromo{position:fixed;left:22px;top:22px;z-index:9998;width:min(370px,calc(100vw - 28px));display:flex;align-items:center;gap:13px;padding:15px 16px 15px 14px;background:linear-gradient(125deg,#073f46,#0b777d);color:#fff;border:1px solid #62b7b5;border-radius:16px;box-shadow:0 14px 38px #062f3670;transform:translate3d(0,0,0) scale(.94);opacity:0}#referralPromo.is-visible{animation:referralCornerTravel 2.2s cubic-bezier(.2,.75,.25,1) forwards}@keyframes referralCornerTravel{0%{transform:translate3d(0,0,0) scale(.94);opacity:0}12%{opacity:1}100%{transform:translate3d(calc(100vw - 100% - 44px),calc(100vh - 100% - 44px),0) scale(1);opacity:1}}#referralPromo .promo-gift{width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;border-radius:12px;background:#ffffff20;font-size:24px;animation:referralGiftPulse 2s infinite}#referralPromo .promo-copy{min-width:0;flex:1}#referralPromo strong{display:block;font-size:15px;line-height:1.3}#referralPromo small{display:block;color:#d4eeee;font-size:12px;margin-top:4px;line-height:1.4}#referralPromo .promo-action{margin-top:9px;border:0;border-radius:8px;padding:8px 12px;background:#fff;color:#07545a;font-weight:850;cursor:pointer}#referralPromo .promo-close{position:absolute;right:7px;top:5px;border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;opacity:.8;padding:2px 6px}#referralPromo .promo-close:hover{opacity:1}@keyframes referralGiftPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}@media(max-width:540px){#referralPromo{left:12px;top:12px;width:calc(100vw - 24px);padding:13px}#referralPromo.is-visible{animation-name:referralCornerTravelMobile}#referralPromo strong{font-size:14px}}@keyframes referralCornerTravelMobile{0%{transform:translate3d(0,0,0) scale(.94);opacity:0}12%{opacity:1}100%{transform:translate3d(0,calc(100vh - 100% - 24px),0) scale(1);opacity:1}}@media(prefers-reduced-motion:reduce){#referralPromo,#referralPromo .promo-gift{transition:none;animation:none}}`;
const nav=document.querySelector(".navlinks");
const btn=document.createElement("button");btn.id="studentReferralButton";btn.className="btn secondary";btn.type="button";btn.textContent="Refer & Earn";nav?.append(btn);
const dialog=document.createElement("dialog");dialog.className="auth-dialog referral-dialog";
dialog.innerHTML=`<button class="close" id="referralClose" type="button">Close</button><div class="eyebrow">Student rewards</div><h2>Refer 5 Friends, Get 1 Premium Course FREE</h2><p class="referral-muted">Share your unique link. A referral counts after a new student verifies their account.</p><div class="referral-card"><div class="referral-muted">Your referral code</div><div id="referralCode" class="referral-code">Loading…</div><button class="btn" id="copyReferralLink" type="button">Copy referral link</button><div style="margin-top:16px"><strong><span id="referralCount">0</span> / 5 successful referrals</strong><div class="referral-progress"><span id="referralProgress"></span></div><div id="referralStatus" class="referral-muted"></div></div></div><div id="referralClaimArea" hidden><label for="referralCourseCode"><strong>Course code to unlock</strong></label><input id="referralCourseCode" placeholder="Enter the exact course code shown on the course page"><button class="btn" id="claimReferralReward" type="button">Claim free course</button><p class="referral-muted">One free full-course reward per student. The selected course is unlocked through your account.</p></div><p id="referralMessage" class="referral-muted" aria-live="polite"></p>`;
document.body.append(dialog);
const promo=document.createElement("aside");promo.id="referralPromo";promo.setAttribute("aria-label","Refer friends promotion");
promo.innerHTML=`<button class="promo-close" type="button" aria-label="Dismiss referral offer">×</button><div class="promo-gift" aria-hidden="true">🎁</div><div class="promo-copy"><strong>Refer 5 friends. Get 1 Premium Course FREE!</strong><small>Share your referral link and earn a free course.</small><button class="promo-action" type="button">Refer friends now →</button></div>`;
document.body.append(promo);
const hidePromo=()=>{promo.classList.remove("is-visible");sessionStorage.setItem("cdac_referral_promo_dismissed","1");};
promo.querySelector(".promo-close").addEventListener("click",hidePromo);
promo.querySelector(".promo-action").addEventListener("click",()=>btn.click());
if(!sessionStorage.getItem("cdac_referral_promo_dismissed"))setTimeout(()=>promo.classList.add("is-visible"),1100);
const $=id=>document.getElementById(id);
let referralCode="";
const show=()=>dialog.showModal();
btn.addEventListener("click",async()=>{
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.user){window.openStudentLogin?.();return;}
 show();$("referralMessage").textContent="Loading your referral details…";
 const [{data:code,error:codeError},{data:summary,error:summaryError}]=await Promise.all([
  supabase.rpc("get_or_create_referral_code"),supabase.rpc("get_referral_summary")
 ]);
 if(codeError||summaryError){$("referralMessage").textContent=(codeError||summaryError).message;return;}
 referralCode=code;$("referralCode").textContent=code;
 const count=Number(summary.successful_referrals||0);
 $("referralCount").textContent=count;$("referralProgress").style.width=Math.min(100,count/5*100)+"%";
 $("referralStatus").textContent=summary.reward_claimed?"Your referral reward has already been claimed.":count>=5?"Congratulations! You can claim one free full course.":"Invite "+(5-count)+" more verified student(s) to unlock a free course.";
 $("referralClaimArea").hidden=!summary.eligible;
});
$("referralClose").addEventListener("click",()=>dialog.close());
$("copyReferralLink").addEventListener("click",async()=>{
 const link=location.origin+location.pathname+"?ref="+encodeURIComponent(referralCode);
 try{await navigator.clipboard.writeText(link);$("referralMessage").textContent="Referral link copied. Share it with friends.";}
 catch{$("referralMessage").textContent=link;}
});
$("claimReferralReward").addEventListener("click",async()=>{
 const course=$("referralCourseCode").value.trim();if(!course){$("referralMessage").textContent="Enter the exact course code first.";return;}
 $("claimReferralReward").disabled=true;
 const {data,error}=await supabase.rpc("claim_referral_course_reward",{p_course_code:course});
 $("claimReferralReward").disabled=false;
 $("referralMessage").textContent=error?error.message:"Success! Your free course access is active for "+data.course_code+".";
 if(!error)$("referralClaimArea").hidden=true;
});
async function processReferral(session){
 const code=new URLSearchParams(location.search).get("ref")||sessionStorage.getItem("cdac_referral_code");
 if(code&&session?.user){
  const {data,error}=await supabase.rpc("record_referral_signup",{p_referral_code:code});
  if(error)console.warn("Referral attribution:",error.message);
  else if(data?.recorded)console.info("Referral successfully recorded.");
  sessionStorage.removeItem("cdac_referral_code");
 }
}
const incoming=new URLSearchParams(location.search).get("ref");
if(incoming&&/^[A-Z0-9]{10}$/i.test(incoming))sessionStorage.setItem("cdac_referral_code",incoming.toUpperCase());
supabase.auth.onAuthStateChange((event,session)=>{if(session?.user)setTimeout(()=>processReferral(session),0);});
