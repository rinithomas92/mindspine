"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, CalendarDays, HeartPulse, Check, Eye, EyeOff, Mail, LockKeyhole, UserRound, LoaderCircle, CircleHelp, AlertCircle, Brain, Stethoscope, Settings2 } from "lucide-react";
import { authenticate } from "@/app/actions";
import { authInput } from "@/lib/auth-input";
import Brand from "./brand";
const portals = [
  {id:'patient',label:'Patient',icon:UserRound},
  {id:'psychologist',label:'Psychologist',icon:Brain},
  {id:'physiotherapist',label:'Physiotherapist',icon:Stethoscope},
  {id:'admin',label:'Administrator',icon:Settings2},
] as const;
export default function Login() {
  const [portal,setPortal] = useState<(typeof portals)[number]['id']>();
  const portalLabel=portals.find(p=>p.id===portal)?.label;
  const staffPortal=portal && portal!=='patient';
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("" );
  const [name, setName] = useState("" );
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [help, setHelp] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  function submit() {
    setError("");
    const input = authInput.safeParse({ email, password, name, register, portal });
    if (!input.success) {
      setError(input.error.issues[0]?.message || "Check your details.");
      return;
    }
    start(async () => {
      try {
        const result = await authenticate(input.data);
        if (result.ok) router.refresh(); else setError(result.message);
      } catch { setError("We couldn’t connect. Please check your connection and try again."); }
    });
  }
  function switchMode() {
    setPortal("patient"); setRegister(!register); setError(""); setPassword("");  setVisible(false); setHelp(false);
  }
  return <main className="ms-login">
    <section className="ms-story" aria-label="Welcome to MindSpine">
      <Brand />
      <div className="ms-story-content">
        <p className="ms-kicker"><span /> CONNECTED CARE. EVERY DAY.</p>
        <h1>A little more care.<br /><em>A lot more you.</em></h1>
        <p className="ms-story-intro">From your first appointment to your next milestone. A calmer, simpler way to stay connected to your care.</p>
        <div className="ms-care-art" aria-hidden="true">
          <div className="ms-art-ring ring-one" /><div className="ms-art-ring ring-two" />
          <svg className="ms-art-line" viewBox="0 0 300 270" fill="none"><path d="M156 24c-72 49 71 71 1 128s-62 77-18 97" stroke="currentColor" strokeWidth="35" strokeLinecap="round" />{Array.from({length:12},(_,i)=><path key={i} d={`M${126+Math.sin(i*.7)*20} ${35+i*18}l48 8`} stroke="#133f39" strokeWidth="5" strokeLinecap="round" />)}</svg>
          <div className="ms-art-card ms-art-appointment"><span className="ms-art-icon"><CalendarDays size={21} /></span><div><small>A LITTLE TIME FOR YOU</small><strong>Your next chapter starts here</strong><span>Book a visit. Feel supported.</span></div><span className="ms-art-check"><Check size={14} /></span></div>
          <div className="ms-art-card ms-art-progress"><HeartPulse size={22} /><span>Small steps.<br /><strong>Meaningful progress.</strong></span><svg width="77" height="30" viewBox="0 0 77 30"><path d="M2 25 17 20 28 23 43 12 54 15 75 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div>
        </div>
        <div className="ms-story-features"><span><Check size={15} /> Easy appointments</span><span><Check size={15} /> Connected care records</span></div>
      </div>
      <div className="ms-story-footer"><span>ALIGN · HEAL · MOVE FORWARD</span><span>MindSpine Wellness</span></div>
    </section>
    <section className="ms-access" aria-labelledby="sign-in-title">
      <div className="ms-access-top"><span><ShieldCheck size={15} /> Your personal care workspace</span><span className="ms-top-dot" /></div>
      <div className="ms-form-shell">
        <div className="ms-welcome-icon"><HeartPulse size={25} strokeWidth={1.5} /></div>
        <p className="ms-form-eyebrow">{register ? "LET’S GET YOU STARTED" : "WELCOME BACK"}</p>
        <h2 id="sign-in-title">{register ? "Your care starts here." : portalLabel ? `${portalLabel} sign in` : "Good to see you again."}</h2>
        <p className="ms-form-intro">{register ? "Create a patient account. Already registered? Use your existing password and we’ll sign you in." : staffPortal ? "Use the email and password assigned to your clinic account." : "Sign in to pick up where you left off."}</p>
        {!register && <fieldset className="login-portals" disabled={pending}><legend>Choose your workspace</legend><div>{portals.map(({id,label,icon:Icon})=><button key={id} type="button" aria-pressed={portal===id} onClick={()=>{setPortal(id);setError('');setPassword('');setVisible(false);setHelp(false);}}><Icon size={18}/><span>{label}</span>{portal===id && <Check size={14}/>}</button>)}</div></fieldset>}
        <form onSubmit={event => { event.preventDefault(); submit(); }} className="ms-auth-form" aria-busy={pending}>
          <fieldset disabled={pending}>
            {register && <div className="ms-field"><label htmlFor="auth-name">Full name</label><div className="ms-input-wrap"><UserRound size={18} /><input id="auth-name" name="name" autoComplete="name" placeholder="Your full name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div></div>}
            <div className="ms-field"><label htmlFor="auth-email">Email address</label><div className="ms-input-wrap"><Mail size={18} /><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={200} value={email} onChange={e=>{setEmail(e.target.value);setError("");}} /></div></div>
            <div className="ms-field">
              <div className="ms-label-row"><label htmlFor="auth-password">Password</label>{!register && <button type="button" className="ms-text-button" aria-expanded={help} aria-controls="account-help" onClick={()=>setHelp(!help)}>Need help signing in?</button>}</div>
              <div className="ms-input-wrap"><LockKeyhole size={18} /><input id="auth-password" name="password" type={visible ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Create a password" : "Enter your password"} required minLength={register ? 12 : 1} maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyUp={e=>setCapsLock(e.getModifierState("CapsLock"))} onBlur={()=>setCapsLock(false)} aria-describedby={register ? "password-guidance" : undefined} /><button type="button" className="ms-password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              {register && <p className="ms-field-hint" id="password-guidance">Use at least 12 characters. A few memorable words work well.</p>}
              {capsLock && <p className="ms-field-hint" role="status">Caps Lock is on.</p>}
            </div>
            {help && <div className="ms-help-box" id="account-help"><CircleHelp size={18} /><p>Forgot your password? Contact your clinic administrator to reset it. Use the email address registered with your clinic.</p></div>}
            {error && <div className="ms-auth-error" role="alert"><AlertCircle size={18} /><div><span>{error}</span>{register && <button type="button" className="ms-error-signin" onClick={switchMode}>Go to sign in <ArrowRight size={14} /></button>}</div></div>}
            <button className="ms-sign-in" disabled={pending}>{pending ? <><LoaderCircle size={18} className="ms-spinner" />{register ? "Creating your account…" : "Signing you in…"}</> : <>{register ? "Create account" : "Sign in"}<ArrowRight size={18} /></>}</button>
          </fieldset>
        </form>
        {!register && <div className="physio-demo-access"><button type="button" disabled={pending} onClick={()=>{setPortal("physiotherapist");setEmail("physio@mindspine.local");setPassword("PhysioDemo!2026");setVisible(false);setError("");setHelp(false);}}><Stethoscope size={18}/>Try physiotherapist demo<ArrowRight size={16}/></button><p>Fills the demo credentials. Select Sign in to continue. Use fictional information only in this shared account.</p></div>}
        {staffPortal ? <p className="ms-switch">Need a staff account? Ask your clinic administrator to add you with the correct specialty.</p> : <p className="ms-switch">{register ? "Already part of MindSpine?" : "New to MindSpine?"} <button type="button" onClick={switchMode} disabled={pending}>{register ? "Sign in" : "Create an account"}<ArrowRight size={13} /></button></p>}
      </div>
      <footer className="ms-access-footer"><ShieldCheck size={14} /> Care for your wellbeing. Respect for your privacy.</footer>
    </section>
  </main>;
}

