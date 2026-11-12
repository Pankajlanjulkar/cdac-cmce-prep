import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase=createClient("https://hnwduoyealnceyhmmskl.supabase.co","sb_publishable_x3wHQJFGHMQ9com5A0J9jA_4YhCzikX");
const style=document.createElement("style");
style.textContent=`
#studentReferralButton{margin-left:8px}.referral-dialog{max-width:560px}.referral-card{background:#f4f9f9;border:1px solid #c9dfe0;border-radius:12px;padding:16px;margin:14px 0}.referral-code{font-size:22px;font-weight:850;letter-spacing:2px;color:#0b6b73}.referral-progress{height:10px;background:#e3eaec;border-radius:99px;overflow:hidden;margin:10px 0}.referral-progress>span{display:block;height:100%;background:#0b6b73;width:0}.referral-dialog input{width:100%;padding:11px;border:1px solid var(--line);border-radius:8px;margin:7px 0 12px;font:inherit}.referral-muted{color:var(--muted);font-size:13px;line-height:1.5}
`;
document.head.append(style);
const nav=document.querySelector(".navlinks");
const btn=document.createElement("button");btn.id="studentReferralButton";btn.className="btn secondary";btn.type="button";btn.textContent="Refer & Earn";nav?.append(btn);
const dialog=document.createElement("dialog");dialog.className="auth-dialog referral-dialog";
dialog.innerHTML=`<button class="close" id="referralClose" type="button">Close</button><div class="eyebrow">Student rewards</div><h2>Refer 5 Friends, Get 1 Premium Course FREE</h2><p class="referral-muted">Share your unique link. A referral counts after a new student verifies their account.</p><div class="referral-card"><div class="referral-muted">Your referral code</div><div id="referralCode" class="referral-code">Loading…</div><button class="btn" id="copyReferralLink" type="button">Copy referral link</button><div style="margin-top:16px"><strong><span id="referralCount">0</span> / 5 successful referrals</strong><div class="referral-progress"><span id="referralProgress"></span></div><div id="referralStatus" class="referral-muted"></div></div></div><div id="referralClaimArea" hidden><label for="referralCourseCode"><strong>Course code to unlock</strong></label><input id="referralCourseCode" placeholder="Enter the exact course code shown on the course page"><button class="btn" id="claimReferralReward" type="button">Claim free course</button><p class="referral-muted">One free full-course reward per student. The selected course is unlocked through your account.</p></div><p id="referralMessage" class="referral-muted" aria-live="polite"></p>`;
document.body.append(dialog);
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
