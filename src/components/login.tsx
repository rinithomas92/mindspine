"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  HeartPulse,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  UserRound,
  LoaderCircle,
  CircleHelp,
  AlertCircle,
  Brain,
  Stethoscope,
  Settings2,
  ClipboardList,
  FileText,
  SlidersHorizontal,
  MessageCircle,
  BarChart3,
  MonitorPlay,
  Camera,
  type LucideIcon,
} from "lucide-react";
import { authenticate } from "@/app/actions";
import { authInput } from "@/lib/auth-input";
import Brand from "./brand";

type Workspace = "patient" | "psychologist" | "physiotherapist" | "admin";

const portals = [
  { id: "patient", label: "Patient", icon: UserRound },
  { id: "psychologist", label: "Psychologist", icon: Brain },
  { id: "physiotherapist", label: "Physiotherapist", icon: Stethoscope },
  { id: "admin", label: "Administrator", icon: Settings2 },
] as const satisfies readonly { id: Workspace; label: string; icon: LucideIcon }[];

const workspaceConfig = {
  patient: {
    signInTitle: "Patient Sign In",
    signInDescription: "Manage your care and stay connected with your care team.",
    eyebrow: "PATIENT CARE",
    title: "Connected care,\nmade calmer.",
    description: "One thoughtful workspace for patients,\npractitioners and care teams.",
    background: "/images/login/patient.webp",
    objectPosition: "55% center",
    features: [
      { label: "Coordination", icon: ClipboardList },
      { label: "Records", icon: FileText },
      { label: "Workflow", icon: SlidersHorizontal },
    ],
  },
  psychologist: {
    signInTitle: "Psychologist Sign In",
    signInDescription: "Sign in to continue supporting your clients and managing their care.",
    eyebrow: "PSYCHOLOGICAL CARE",
    title: "A calmer space\nfor connected care.",
    description: "Support your clients through\nmeaningful conversations,\ncontinuity, and coordinated care.",
    background: "/images/login/psychologist.webp",
    objectPosition: "34% center",
    features: [
      { label: "Meaningful\nconversations", icon: MessageCircle },
      { label: "Records", icon: FileText },
      { label: "Continuity of care", icon: Settings2 },
    ],
  },
  physiotherapist: {
    signInTitle: "Physiotherapist Sign In",
    signInDescription: "Sign in to continue managing patient care and recovery.",
    eyebrow: "PHYSIOTHERAPY",
    title: "Support that\nmoves with you.",
    description: "Deliver guided care, track recovery,\nand help patients make meaningful\nprogress.",
    background: "/images/login/physiotherapist.webp",
    objectPosition: "60% center",
    features: [
      { label: "Guided care", icon: MessageCircle },
      { label: "Progress tracking", icon: BarChart3 },
      { label: "Better outcomes", icon: Settings2 },
    ],
  },
  admin: {
    signInTitle: "Administrator Sign In",
    signInDescription: "Use the email and password assigned to your clinic account.",
    eyebrow: "CLINIC OPERATIONS",
    title: "Care, organized\nbeautifully.",
    description: "Manage records, clinic workflows,\nand keep care teams aligned.",
    background: "/images/login/administrator.webp",
    objectPosition: "46% center",
    features: [
      { label: "Coordination", icon: ClipboardList },
      { label: "Records", icon: FileText },
      { label: "Workflow", icon: Settings2 },
    ],
  },
} as const;

export default function Login() {
  const [portal, setPortal] = useState<Workspace>("patient");
  const portalLabel = portals.find((p) => p.id === portal)?.label ?? "Patient";
  const staffPortal = portal !== "patient";
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [help, setHelp] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const workspace = workspaceConfig[portal];

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
        if (result.ok) {
          if (profileFile) {
            const form = new FormData();
            form.set("file", profileFile);
            await fetch("/api/avatar", { method: "POST", body: form }).catch(() => {});
          }
          router.refresh();
        }
        else setError(result.message);
      } catch {
        setError("We couldn’t connect. Please check your connection and try again.");
      }
    });
  }

  function switchMode() {
    setPortal("patient");
    setRegister(!register);
    setError("");
    setPassword("");
    setVisible(false);
    setHelp(false);
  }

  function selectPortal(id: Workspace) {
    setPortal(id);
    setError("");
    setPassword("");
    setVisible(false);
    setHelp(false);
  }

  function fillDemo() {
    setPortal("physiotherapist");
    setEmail("physio@mindspine.local");
    setPassword("PhysioDemo!2026");
    setVisible(false);
    setError("");
    setHelp(false);
  }

  return (
    <main className={register ? "ms-login ms-register" : "ms-login"}>
      <section className="ms-story" aria-label={`${portalLabel} workspace welcome`}>
        <Image
          key={workspace.background}
          src={workspace.background}
          alt=""
          fill
          priority
          sizes="(max-width: 760px) 100vw, 50vw"
          style={{ objectFit: "cover", objectPosition: workspace.objectPosition }}
          className="ms-story-image"
        />
        <div className="ms-story-wash" aria-hidden="true" />
        <svg className="ms-story-curves" viewBox="0 0 620 760" aria-hidden="true">
          <path d="M530 0C420 145 442 261 564 362c92 76 64 234-120 398" />
          <path d="M617 88C490 190 490 305 617 426" />
        </svg>
        <div className="ms-story-inner">
          <Brand />
          <div className="ms-story-content">
            <p className="ms-story-eyebrow">{workspace.eyebrow}</p>
            <h1>{workspace.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
            <p className="ms-story-intro">{workspace.description}</p>
            <div className="ms-story-features" aria-label={`${portalLabel} workspace highlights`}>
              {workspace.features.map(({ label, icon: Icon }) => (
                <span key={label}>
                  <Icon size={23} strokeWidth={1.8} />
                  <small>{label}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ms-access" aria-labelledby="sign-in-title">
        <div className="ms-access-top">
          {register ? (
            <button type="button" className="ms-back-signin" onClick={switchMode} disabled={pending}><ArrowRight size={17} /> Back to Sign In</button>
          ) : (
            <span><ShieldCheck size={15} /> Your Personal Care Workspace</span>
          )}
        </div>
        <div className="ms-form-shell">
          <div className="ms-welcome-icon"><HeartPulse size={25} strokeWidth={1.7} /></div>
          <p className="ms-form-eyebrow">{register ? "LET’S GET YOU STARTED" : "WELCOME BACK"}</p>
          <h2 id="sign-in-title">{register ? "Your Care Starts Here." : workspace.signInTitle}</h2>
          <p className="ms-form-intro">{register ? "Create a patient account. Already registered? Use your existing password, and we’ll sign you in." : workspace.signInDescription}</p>

          {!register && (
            <fieldset className="login-portals" disabled={pending} role="radiogroup" aria-label="Choose Your Workspace">
              <legend>Choose Your Workspace</legend>
              <div>
                {portals.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={portal === id}
                    onClick={() => selectPortal(id)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="ms-auth-form" aria-busy={pending}>
            <fieldset disabled={pending}>
              {register && (
                <>
                  <div className="ms-profile-picture">
                    <label className="ms-profile-picture-control" htmlFor="auth-profile-picture">
                      {profilePicture ? <img src={profilePicture} alt="Selected profile preview" /> : <span className="ms-profile-picture-placeholder"><UserRound size={26} /></span>}
                      <span className="ms-profile-picture-edit" aria-hidden="true"><Camera size={14} /></span>
                    </label>
                    <input id="auth-profile-picture" name="profilePicture" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) { setProfilePicture(URL.createObjectURL(file)); setProfileFile(file); }
                    }} />
                    <div>
                      <strong>Profile picture</strong>
                      <small>Optional - JPG, PNG or WEBP</small>
                    </div>
                  </div>
                  <div className="ms-field">
                    <label htmlFor="auth-name">Full Name</label>
                    <div className="ms-input-wrap"><UserRound size={18} /><input id="auth-name" name="name" autoComplete="name" placeholder="Your full name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
                  </div>
                </>
              )}
              <div className="ms-field">
                <label htmlFor="auth-email">Email Address</label>
                <div className="ms-input-wrap"><Mail size={18} /><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={200} value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} /></div>
              </div>
              <div className="ms-field">
                <div className="ms-label-row"><label htmlFor="auth-password">Password</label>{!register && <button type="button" className="ms-text-button" aria-expanded={help} aria-controls="account-help" onClick={() => setHelp(!help)}>Need Help Signing In?</button>}</div>
                <div className="ms-input-wrap"><LockKeyhole size={18} /><input id="auth-password" name="password" type={visible ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Create a password" : "Enter your password"} required minLength={register ? 8 : 1} maxLength={15} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} aria-describedby={register ? "password-guidance" : undefined} /><button type="button" className="ms-password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                {register && <p className="ms-field-hint" id="password-guidance">Use at least 8 characters, including letters and numbers.</p>}
                {capsLock && <p className="ms-field-hint" role="status">Caps Lock is on.</p>}
              </div>
              {help && <div className="ms-help-box" id="account-help"><CircleHelp size={18} /><p>Forgot your password? Contact your clinic administrator to reset it. Use the email address registered with your clinic.</p></div>}
              {error && <div className="ms-auth-error" role="alert"><AlertCircle size={18} /><div><span>{error}</span></div></div>}
              <button className="ms-sign-in" disabled={pending}>{pending ? <><LoaderCircle size={18} className="ms-spinner" />{register ? "Creating your account…" : "Signing you in…"}</> : <>{register ? "Create Account" : "Sign In"}<ArrowRight size={18} /></>}</button>
            </fieldset>
          </form>

          {!register && (
            <button type="button" className="physio-demo-access" disabled={pending} onClick={fillDemo}>
              <MonitorPlay size={20} className="demo-card-icon" aria-hidden="true" />
              <span className="demo-card-copy">
                <span className="demo-card-title">Try Physiotherapist Demo <ArrowRight size={16} aria-hidden="true" /></span>
                <span className="demo-card-description">Fills the demo credentials. Select Sign In to continue.</span>
              </span>
            </button>
          )}

          {register && <div className="ms-register-divider"><span />OR<span /></div>}
          {staffPortal ? (
            <p className="ms-switch">Need a staff account? Ask your clinic administrator to add you<br />with the correct specialty.</p>
          ) : (
            <p className="ms-switch">{register ? "Already part of MindSpine?" : "New to MindSpine?"} <button type="button" onClick={switchMode} disabled={pending}>{register ? "Sign In" : "Create an Account"}<ArrowRight size={13} /></button></p>
          )}
        </div>
        <footer className="ms-access-footer"><ShieldCheck size={14} /> Care for your well-being. Respect for your privacy.</footer>
      </section>
    </main>
  );
}