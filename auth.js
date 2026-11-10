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

const $ = id => document.getElementById(id);
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

function syncAuthUI(session) {
  currentSession=session||null;authButton.textContent=currentSession?.user?"Logout":"Student Login";
  authButton.title=currentSession?.user?.email||"Student account";
  document.documentElement.dataset.studentSignedIn=currentSession?.user?"true":"false";
}
const premiumEntrySelectors=["#goPremium","#openPremiumBankSection","#openPremiumMocksSection","#openCppPremium","#startPremiumMock"].join(",");
document.addEventListener("click",event=>{
  const target=event.target instanceof Element?event.target.closest(premiumEntrySelectors):null;
  if(!target||currentSession?.user)return;
  event.preventDefault();event.stopImmediatePropagation();openAuth("login");
},true);
supabase.auth.onAuthStateChange((_event,session)=>syncAuthUI(session));
const {data:{session}}=await supabase.auth.getSession();syncAuthUI(session);
