import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://hnwduoyealnceyhmmskl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x3wHQJFGHMQ9com5A0J9jA_4YhCzikX";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const style = document.createElement("style");
style.textContent = `
.auth-trigger{margin-left:10px}.auth-dialog{max-width:440px}.auth-dialog form{display:grid;gap:12px}.auth-dialog label{font-weight:650;font-size:14px}.auth-dialog input{width:100%;padding:12px;border:1px solid var(--line);border-radius:9px;font:inherit;margin-top:6px}.auth-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}.auth-message{padding:10px 12px;border-radius:9px;background:#edf7f1;color:#176044;font-size:14px;line-height:1.45}.auth-message.error{background:#fff0ef;color:#a12b23}.auth-muted{font-size:13px;color:var(--muted);line-height:1.5}.auth-link{border:0;background:none;color:var(--teal);font:inherit;font-weight:700;cursor:pointer;padding:8px 0}
`;
document.head.append(style);

const dialog = document.createElement("dialog");
dialog.id = "studentAuthDialog";
dialog.className = "auth-dialog";
dialog.innerHTML = `
  <button class="close" type="button" id="authClose">Close</button>
  <div class="eyebrow">Student account</div><h2 id="authHeading">Student login</h2>
  <p class="auth-muted" id="authIntro">Sign in to access premium learning.</p>
  <div id="authNotice" aria-live="polite"></div>
  <form id="authForm">
    <label id="authNameWrap" hidden>Full name<input id="authName" autocomplete="name" maxlength="100"></label>
    <label>Email address<input id="authEmail" type="email" autocomplete="email" required></label>
    <label>Password<input id="authPassword" type="password" autocomplete="current-password" minlength="8" required></label>
    <div class="auth-actions"><button class="btn" id="authSubmit" type="submit">Login</button><button class="btn secondary" id="authMode" type="button">Create account</button></div>
  </form>
  <button class="auth-link" id="authForgot" type="button">Forgot password?</button><button class="auth-link" id="authBack" type="button" hidden>Back to login</button>
`;
document.body.append(dialog);

const nav = document.querySelector(".navlinks");
const authButton = document.createElement("button");
authButton.className = "btn secondary auth-trigger";
authButton.type = "button";authButton.id = "studentAuthButton";authButton.textContent = "Student Login";
nav?.append(authButton);
const profileButton = document.createElement("button");
profileButton.className = "btn secondary auth-trigger";
profileButton.type = "button";
profileButton.id = "studentProfileButton";
profileButton.textContent = "My Profile";
profileButton.hidden = true;
nav?.append(profileButton);

const profileDialog = document.createElement("dialog");
profileDialog.id = "studentProfileDialog";
profileDialog.className = "auth-dialog";
profileDialog.innerHTML = `
  <button class="close" type="button" id="profileClose">Close</button>
  <div class="eyebrow">Student account</div>
  <h2>My Profile</h2>
  <p class="auth-muted">Your student details are stored securely in your account.</p>
  <div id="profileNotice" aria-live="polite"></div>
  <form id="profileForm">
    <label>Full name<input id="profileName" autocomplete="name" maxlength="100" required></label>
    <label>Email address<input id="profileEmail" type="email" disabled></label>
    <button class="btn" id="profileSave" type="submit">Save profile</button>
  </form>
`;
document.body.append(profileDialog);


const $ = id => document.getElementById(id);

const premiumHoverStyle=document.createElement("style");
premiumHoverStyle.textContent=`
#studentPaymentDialog .premium-choice-btn{position:relative;transition:transform .18s ease,box-shadow .18s ease,background-color .18s ease,border-color .18s ease;transform-origin:center;will-change:transform}
#studentPaymentDialog .premium-choice-btn:hover{transform:translateY(-3px) scale(1.015);box-shadow:0 10px 22px rgba(8,79,86,.22);z-index:1}
#studentPaymentDialog #buyModuleAccess:hover{background:#084f56;border-color:#084f56}
#studentPaymentDialog #buyCourseAccess:hover{background:#e8f4f4;border-color:#0b6b73;color:#084f56}
#studentPaymentDialog .premium-choice-btn:active{transform:translateY(0) scale(.99);box-shadow:0 3px 8px rgba(8,79,86,.16)}
#studentPaymentDialog .premium-choice-btn:focus-visible{outline:3px solid #f0b429;outline-offset:3px}
@media(prefers-reduced-motion:reduce){#studentPaymentDialog .premium-choice-btn{transition:none}#studentPaymentDialog .premium-choice-btn:hover{transform:none}}
`;
document.head.append(premiumHoverStyle);

let mode = "login", busy = false, currentSession = null;
function notice(message, error = false) {
  const box = document.createElement("div");box.className = "auth-message" + (error ? " error" : "");box.textContent = message || "";
  $("authNotice").replaceChildren(...(message ? [box] : []));
}
function setMode(next) {
  mode = next;$("authNotice").replaceChildren();
  $("authHeading").textContent = mode === "signup" ? "Create student account" : mode === "reset" ? "Reset password" : "Student login";
  $("authIntro").textContent = mode === "signup" ? "Register with your name and email. Verify your email to activate your account." : mode === "reset" ? "Enter your registered email to receive a password reset link." : "Sign in to access premium learning and mock tests.";
  $("authNameWrap").hidden = mode !== "signup";$("authPassword").hidden = mode === "reset";$("authPassword").required = mode !== "reset";
  $("authSubmit").textContent = mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Login";
  $("authMode").hidden = mode === "reset";$("authMode").textContent = mode === "login" ? "Create account" : "I already have an account";
  $("authForgot").hidden = mode !== "login";$("authBack").hidden = mode !== "reset";
}
function openAuth(next = "login") { setMode(next);if(!dialog.open) dialog.showModal(); }

authButton.addEventListener("click", async () => {
  if (currentSession?.user) {
    const {error} = await supabase.auth.signOut();
    if (error) {openAuth("login");notice(error.message,true);}
    else {openAuth("login");notice("You have been logged out.");}
  } else openAuth("login");
});
$("authClose").addEventListener("click",()=>dialog.close());
$("authMode").addEventListener("click",()=>setMode(mode === "login" ? "signup" : "login"));
$("authForgot").addEventListener("click",()=>setMode("reset"));
$("authBack").addEventListener("click",()=>setMode("login"));

$("authForm").addEventListener("submit",async event=>{
  event.preventDefault();if(busy)return;busy=true;$("authSubmit").disabled=true;notice("");
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  try {
    if(mode==="signup") {
      const fullName=$("authName").value.trim();if(!fullName)throw new Error("Please enter your full name.");
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName}}});
      if(error)throw error;
      if(data.session){dialog.close();}else notice("Registration successful. Check your email and verify your account before logging in.");
    } else if(mode==="reset") {
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
      if(error)throw error;notice("If an account exists for this email, a password reset link has been sent.");
    } else {
      const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;dialog.close();
    }
  } catch(error){notice(error.message||"Something went wrong. Please try again.",true);}
  finally{busy=false;$("authSubmit").disabled=false;}
});



// One active device per student account. A newer login replaces the previous device.
const DEVICE_STORAGE_KEY = "cdac_cmce_device_id";
let thisDeviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
if (!thisDeviceId) {
  thisDeviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_STORAGE_KEY, thisDeviceId);
}
let deviceCheckTimer = null;
let deviceSessionBlocked = false;

async function claimThisDevice(session) {
  if (!session?.user || deviceSessionBlocked) return;
  const { data, error } = await supabase.rpc("claim_student_device", { p_device_id: thisDeviceId });
  if (error) {
    // Keep sign-in available while the database setup is pending; do not lock out students.
    console.error("Device-session setup is not ready:", error.message);
    notice("Device limit setup is pending. Please try again shortly.", true);
    return;
  }
  if (data !== true) {
    deviceSessionBlocked = true;
    await supabase.auth.signOut({ scope: "local" });
    openAuth("login");
    notice("This account could not claim this device.", true);
    return;
  }
  startDeviceSessionChecks();
}

function startDeviceSessionChecks() {
  if (deviceCheckTimer) clearInterval(deviceCheckTimer);
  deviceCheckTimer = setInterval(async () => {
    if (!currentSession?.user || deviceSessionBlocked) return;
    const { data, error } = await supabase.rpc("check_student_device", { p_device_id: thisDeviceId });
    if (error) { console.warn("Device session check failed:", error.message); return; }
    if (data !== true) {
      deviceSessionBlocked = true;
      clearInterval(deviceCheckTimer);
      deviceCheckTimer = null;
      await supabase.auth.signOut({ scope: "local" });
      openAuth("login");
      notice("You were logged out because this account was signed in on another device.", true);
    }
  }, 15000);
}

function syncAuthUI(session) {
  currentSession=session||null;authButton.textContent=currentSession?.user?"Logout":"Student Login";
  authButton.title=currentSession?.user?.email||"Student account";
  document.documentElement.dataset.studentSignedIn=currentSession?.user?"true":"false";
  profileButton.hidden = !currentSession?.user;
}

function profileNotice(message, error = false) {
  const box = document.createElement("div");
  box.className = "auth-message" + (error ? " error" : "");
  box.textContent = message;
  $("profileNotice").replaceChildren(box);
}
async function openStudentProfile() {
  if (!currentSession?.user) { openAuth("login"); return; }
  $("profileNotice").replaceChildren();
  $("profileName").value = currentSession.user.user_metadata?.full_name || "";
  $("profileEmail").value = currentSession.user.email || "";
  if (!profileDialog.open) profileDialog.showModal();
  const { data, error } = await supabase.from("student_profiles")
    .select("full_name,email").eq("id", currentSession.user.id).maybeSingle();
  if (error) {
    profileNotice("Profile storage is not set up yet. Run the supplied Supabase SQL setup first.", true);
    return;
  }
  if (data) $("profileName").value = data.full_name || $("profileName").value;
}
profileButton.addEventListener("click", openStudentProfile);
$("profileClose").addEventListener("click", () => profileDialog.close());
$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentSession?.user) { profileDialog.close(); openAuth("login"); return; }
  const fullName = $("profileName").value.trim();
  if (!fullName) { profileNotice("Please enter your full name.", true); return; }
  $("profileSave").disabled = true;
  try {
    const { error } = await supabase.from("student_profiles").upsert({
      id: currentSession.user.id,
      full_name: fullName,
      email: currentSession.user.email,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (error) throw error;
    const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (metaError) throw metaError;
    profileNotice("Your profile has been updated.");
  } catch (error) {
    profileNotice(error.message || "Could not update profile.", true);
  } finally {
    $("profileSave").disabled = false;
  }
});


const premiumEntrySelectors=["#openPremiumBankSection","#openPremiumMocksSection","#openCppPremium","#startPremiumMock"].join(",");
let paymentBusy=false,replayPremiumClick=false,courseDialogSuspendedForCheckout=false;
function ensureRazorpayScript(){
  if(window.Razorpay)return Promise.resolve();
  return new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://checkout.razorpay.com/v1/checkout.js";script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error("Could not load Razorpay Checkout."));document.head.append(script);});
}
function ensurePaymentDialog(){
  let d=$("studentPaymentDialog");if(d)return d;
  d=document.createElement("dialog");d.id="studentPaymentDialog";d.className="auth-dialog";
  d.innerHTML='<button class="close" type="button" id="paymentClose">Close</button><div class="eyebrow">Unlock premium access</div><h2>Choose your access</h2><p class="auth-muted" id="paymentSelectionText"></p><div id="paymentNotice" aria-live="polite"></div><div class="auth-actions" style="display:grid"><button class="btn premium-choice-btn" type="button" id="buyModuleAccess">Unlock this module · ₹10</button><button class="btn secondary premium-choice-btn" type="button" id="buyCourseAccess">Unlock complete course · ₹40</button></div><p class="auth-muted">Secure checkout powered by Razorpay. Access is activated only after payment verification.</p>';
  document.body.append(d);
  $("paymentClose").addEventListener("click",()=>d.close());
  $("buyModuleAccess").addEventListener("click",()=>{window.__premiumPurchaseChoiceStarted=true;startRazorpayPurchase("module");});
  $("buyCourseAccess").addEventListener("click",()=>{window.__premiumPurchaseChoiceStarted=true;startRazorpayPurchase("course");});
  return d;
}
function paymentNotice(message,error=false){const n=$("paymentNotice");if(!n)return;const box=document.createElement("div");box.className="auth-message"+(error?" error":"");box.textContent=message;n.replaceChildren(box);}
async function hasPremiumAccess(selection){
  const {data,error}=await supabase.from("student_purchases").select("id,access_type,module_index").eq("student_id",currentSession.user.id).eq("course_code",selection.course_code).eq("status","active");
  if(error)throw error;return (data||[]).some(p=>p.access_type==="course"||(p.access_type==="module"&&Number(p.module_index)===Number(selection.module_index)));
}
function suspendCourseDialogForCheckout(){
  const d=$("courseDialog");
  if(d?.open){d.close();courseDialogSuspendedForCheckout=true;}
}
function restoreCourseDialogAfterCheckout(){
  if(!courseDialogSuspendedForCheckout)return;
  const d=$("courseDialog");
  if(d&&!d.open)d.showModal();
  courseDialogSuspendedForCheckout=false;
}
function restorePaymentDialog(message,error=false){
  restoreCourseDialogAfterCheckout();
  const d=$("studentPaymentDialog");
  if(d&&!d.open)d.showModal();
  paymentNotice(message,error);
}
async function startRazorpayPurchase(accessType){
  if(paymentBusy)return;const selection=window.getCMCESelection?.();if(!selection||!currentSession?.user){openAuth("login");return;}
  paymentBusy=true;$("buyModuleAccess").disabled=true;$("buyCourseAccess").disabled=true;paymentNotice("Creating secure payment order…");
  try{
    await ensureRazorpayScript();
    const {data:orderData,error:orderError}=await supabase.functions.invoke("create-razorpay-order",{body:{course_code:selection.course_code,access_type:accessType,module_index:accessType==="module"?selection.module_index:null}});
    if(orderError)throw new Error(orderError.message||"Could not create payment order.");if(!orderData?.order_id||!orderData?.key_id)throw new Error(orderData?.error||"Payment order response is incomplete.");
    const checkout=new window.Razorpay({key:orderData.key_id,amount:orderData.amount,currency:orderData.currency,order_id:orderData.order_id,name:orderData.name||"CDAC CMCE Prep",description:orderData.description||"Premium access",prefill:orderData.prefill||{email:currentSession.user.email||""},theme:{color:"#126b61"},modal:{ondismiss:()=>restorePaymentDialog("Checkout closed. No premium access has been activated.",true)},handler:async response=>{
      restorePaymentDialog("Payment received. Verifying securely…");
      try{
        const {data:verification,error}=await supabase.functions.invoke("verify-razorpay-payment",{body:{razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
        if(error)throw new Error(error.message||"Payment verification failed.");if(!verification?.success)throw new Error(verification?.error||"Payment could not be verified.");
        $("studentPaymentDialog").close();restoreCourseDialogAfterCheckout();alert("Payment verified. Your premium access is now active.");
        const pending=window.__pendingPremiumAction;window.__pendingPremiumAction=null;if(pending?.isConnected){replayPremiumClick=true;pending.click();}
      }catch(err){restorePaymentDialog(err.message||"Verification failed. Contact support if money was deducted.",true);}
    }});
    checkout.on("payment.failed",response=>restorePaymentDialog(response.error?.description||"Payment failed. You can try again.",true));
    const paymentDialog=$("studentPaymentDialog");
    if(paymentDialog?.open)paymentDialog.close();
    suspendCourseDialogForCheckout();
    checkout.open();
  }catch(error){
    restorePaymentDialog(error.message||"Could not start checkout.",true);
  }finally{
    paymentBusy=false;
    if($("buyModuleAccess"))$("buyModuleAccess").disabled=false;
    if($("buyCourseAccess"))$("buyCourseAccess").disabled=false;
  }
}
let pendingPlansPurchase=null;
function showPlansPurchaseMessage(message){
  let box=$("plansPurchaseNotice");
  if(!box){
    box=document.createElement("div");
    box.id="plansPurchaseNotice";
    box.className="notice";
    box.style.marginTop="16px";
    $("plans")?.append(box);
  }
  box.textContent=message;
}
async function startPurchaseFromPlans(accessType){
  pendingPlansPurchase=accessType;
  if(!currentSession?.user){
    showPlansPurchaseMessage("Please sign in using Student Login. Your purchase choice will be kept, and checkout will continue after login.");
    openAuth("login");
    return;
  }
  const selection=window.getCMCESelection?.();
  if(!selection){
    // Keep the requested purchase type, but let the student choose any programme.
    // The existing course cards and module picker remain the source of truth.
    window.__pendingPlansPurchaseAfterSelection=accessType;
    showPlansPurchaseMessage(accessType==="course"
      ? "Choose the programme you want to unlock below, then select any module in that programme to confirm your choice. The ₹40 course purchase will unlock the whole programme."
      : "Choose a programme below, then select the exact module you want to unlock for ₹10.");
    const courseSection=$("courses");
    courseSection?.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  const d=ensurePaymentDialog();
  $("paymentSelectionText").textContent=selection.course_name+" · "+selection.module_name+". "+(accessType==="course"?"Unlock every module in this course.":"Unlock this module only.");
  paymentNotice("Starting secure checkout…");
  if(!d.open)d.showModal();
  pendingPlansPurchase=null;
  await startRazorpayPurchase(accessType);
}
// Resume a purchase after the student selects a module in the existing course picker.
const purchaseSelectionObserver=new MutationObserver(()=>{
  const accessType=window.__pendingPlansPurchaseAfterSelection;
  const selection=window.getCMCESelection?.();
  if(accessType&&selection&&currentSession?.user){
    window.__pendingPlansPurchaseAfterSelection=null;
    startPurchaseFromPlans(accessType);
  }
});
const selectedTitle=document.getElementById("selectedModuleTitle");
if(selectedTitle)purchaseSelectionObserver.observe(selectedTitle,{childList:true,characterData:true,subtree:true});
function beginFreshPlansPurchase(accessType){
  // A pricing-page purchase must never inherit the last module opened in the dashboard.
  window.__pendingPlansPurchaseAfterSelection=null;
  window.clearCMCESelection?.();
  startPurchaseFromPlans(accessType);
}
$("buyCourseFromPlans")?.addEventListener("click",()=>beginFreshPlansPurchase("course"));
$("buyModuleFromPlans")?.addEventListener("click",()=>beginFreshPlansPurchase("module"));

document.addEventListener("click",async event=>{
  const target=event.target instanceof Element?event.target.closest(premiumEntrySelectors):null;if(!target)return;
  if(replayPremiumClick){replayPremiumClick=false;return;}
  event.preventDefault();event.stopImmediatePropagation();
  if(!currentSession?.user){openAuth("login");return;}
  const selection=window.getCMCESelection?.();if(!selection){alert("Please select a course module first.");return;}
  try{
    const openPremiumTarget=()=>{
      const hub=$("premiumHub");
      if(target.id==="openPremiumBankSection"){
        if(hub)hub.hidden=true;
        $("premiumBankSection").hidden=false;
        $("premiumMockTests").hidden=true;
        $("premiumPracticePanel").hidden=true;
        $("premiumUnavailable").hidden=true;
      }else if(target.id==="openPremiumMocksSection"){
        if(hub)hub.hidden=true;
        $("premiumBankSection").hidden=true;
        $("premiumMockTests").hidden=false;
        $("premiumMockPanel").hidden=true;
        $("premiumMockResult").hidden=true;
      }else{
        replayPremiumClick=true;
        target.click();
      }
    };

    // Show the access dialog immediately so a slow network check never
    // leaves the student wondering whether the button worked.
    const accessDialog=ensurePaymentDialog();
    $("paymentSelectionText").textContent=selection.course_name+" · "+selection.module_name+". Choose module-only access or unlock every module in this course.";
    paymentNotice("Checking your existing premium access…");
    // Keep both purchase choices clickable while checking existing access.
    // If the student starts checkout, the background entitlement check must not
    // close the dialog or overwrite the checkout state.
    window.__premiumPurchaseChoiceStarted=false;
    if(!accessDialog.open)accessDialog.showModal();

    // Check active entitlement, then attempt recovery only when necessary.
    if(await hasPremiumAccess(selection)){
      if(window.__premiumPurchaseChoiceStarted)return;
      if(accessDialog.open)accessDialog.close();
      openPremiumTarget();
      return;
    }

    if(window.__premiumPurchaseChoiceStarted)return;
    const {data:recovery,error:recoveryError}=await supabase.functions.invoke("verify-razorpay-payment",{body:{action:"recover_pending"}});
    if(recoveryError)console.warn("Could not recover pending premium purchases:",recoveryError.message);
    else if(recovery?.recovered>0)console.info(recovery.message);

    if(window.__premiumPurchaseChoiceStarted)return;
    if(await hasPremiumAccess(selection)){
      if(window.__premiumPurchaseChoiceStarted)return;
      if(accessDialog.open)accessDialog.close();
      openPremiumTarget();
      return;
    }

    if(window.__premiumPurchaseChoiceStarted)return;
    paymentNotice("Premium access is required to continue.");
    $("buyModuleAccess").disabled=false;
    $("buyCourseAccess").disabled=false;
    window.__pendingPremiumAction=target;const d=ensurePaymentDialog();
    $("paymentSelectionText").textContent=selection.course_name+" · "+selection.module_name+". Choose module-only access or unlock every module in this course.";
    paymentNotice("Premium access is required to continue.");if(!d.open)d.showModal();
  }catch(error){alert("Could not check premium access: "+(error.message||"Please try again."));}
},true);
supabase.auth.onAuthStateChange(async (event,session)=>{
  syncAuthUI(session);
  if(event==="SIGNED_IN" && session?.user) await claimThisDevice(session);
  if(event==="SIGNED_OUT") { if(deviceCheckTimer)clearInterval(deviceCheckTimer); deviceCheckTimer=null; deviceSessionBlocked=false; }
  if(session?.user&&pendingPlansPurchase){
    const requested=pendingPlansPurchase;
    setTimeout(()=>startPurchaseFromPlans(requested),0);
  }
});
const {data:{session}}=await supabase.auth.getSession();syncAuthUI(session);if(session?.user)await claimThisDevice(session);
