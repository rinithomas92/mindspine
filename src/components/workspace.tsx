"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, ClipboardList, CreditCard, BarChart3, Settings, Bell, Search, Plus, ArrowUpRight, ArrowRight, Clock3, ChevronRight, ChevronLeft, Download, FileText, LogOut, HeartPulse, Check, Menu, X, ShieldCheck, MapPin, CalendarCheck, TrendingUp, SlidersHorizontal, Mail, ExternalLink, Upload, Paperclip, } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppData, Appointment, User } from "@/lib/types";
import { logout, mutate } from "@/app/actions";
import Brand from "./brand";
import ClinicalForm from "./clinical-form";
import {assessmentLines} from "@/lib/assessment";
import { clinicianLabel } from "@/lib/clinician";
import { Modal, Badge, Avatar, Empty, SectionHead, money, date, time, dayKey, } from "./ui";
type Tab = "overview" | "appointments" | "patients" | "records" | "billing" | "reports" | "team" | "notifications" | "settings";
type Dialog = {
    kind: "book";
    appointment?: Appointment;
} | {
    kind: "note";
} | {
    kind: "patient";
    patient: User;
} | {
    kind: "invoice";
    id: string;
    refund: boolean;
} | {
    kind: "user";
    role?: "patient" | "practitioner";
} | {
    kind: "reset";
    user: User;
} | {
    kind: "schedule";
} | {
    kind: "cancel";
    appointment: Appointment;
} | null;
const navItems: {
    id: Tab;
    label: string;
    icon: LucideIcon;
    roles: string[];
}[] = [
    {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        roles: ["patient", "practitioner", "admin"],
    },
    {
        id: "appointments",
        label: "Appointments",
        icon: CalendarDays,
        roles: ["patient", "practitioner", "admin"],
    },
    {
        id: "patients",
        label: "Patients",
        icon: Users,
        roles: ["practitioner", "admin"],
    },
    {
        id: "records",
        label: "Care records",
        icon: ClipboardList,
        roles: ["patient", "practitioner"],
    },
    {
        id: "billing",
        label: "Billing & payments",
        icon: CreditCard,
        roles: ["patient", "admin"],
    },
    {
        id: "reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["patient", "practitioner", "admin"],
    },
    { id: "team", label: "Team & access", icon: ShieldCheck, roles: ["admin"] },
];
export default function Workspace({ data }: {
    data: AppData;
}) {
    const [tab, setTab] = useState<Tab>("overview"), [search, setSearch] = useState(""), [filter, setFilter] = useState("all"), [dialog, setDialog] = useState<Dialog>(null), [toast, setToast] = useState<{
        ok: boolean;
        message: string;
    } | null>(null), [mobile, setMobile] = useState(false), [pending, start] = useTransition();
    const [chosenPractitioner, setChosenPractitioner] = useState(""), [chosenDay, setChosenDay] = useState("");
    const [signingOut, startSignOut] = useTransition();
    const router = useRouter(), u = data.user, isPatient = u.role === "patient", isAdmin = u.role === "admin", isDoctor = u.role === "practitioner";
    const now = new Date(data.generatedAt), today = dayKey(now.toISOString());
    const todayAppointments = data.appointments.filter((a) => dayKey(a.starts_at) === today && a.status !== "cancelled");
    const upcoming = data.appointments.filter((a) => a.status === "confirmed" && new Date(a.starts_at) > now);
    const completed = data.appointments.filter((a) => a.status === "completed");
    const unread = data.notifications.filter((n) => !n.is_read).length;
    const collected = data.invoices
        .filter((i) => i.status === "paid")
        .reduce((n, i) => n + i.amount, 0);
    const outstanding = data.invoices
        .filter((i) => i.status === "unpaid")
        .reduce((n, i) => n + i.amount, 0);
    const name = u.name.replace(/^Dr\. /, "").split(" ")[0];
    const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
    const appts = data.appointments.filter((a) => matches(`${a.patient} ${a.practitioner} ${a.service}`) &&
        (filter === "all" ||
            (filter === "upcoming"
                ? a.status === "confirmed" && new Date(a.starts_at) > now
                : a.status === filter)));
    function navigate(next: Tab) {
        setTab(next);
        setSearch("");
        setFilter("all");
        setMobile(false);
    }
    function openBook(appointment?: Appointment) {
        setChosenDay("");
        setChosenPractitioner(appointment?.practitioner_id || (isDoctor ? u.id : ""));
        setDialog({ kind: "book", appointment });
    }
    function action(type: string, payload: unknown, close = true) {
        setToast(null);
        start(async () => {
            const result = await mutate(type, payload);
            setToast(result);
            if (result.ok) {
                if (close)
                    setDialog(null);
                router.refresh();
            }
        });
    }
    function formAction(type: string, transform?: (f: FormData) => unknown) {
        return (f: FormData) => action(type, transform ? transform(f) : Object.fromEntries(f));
    }
    const title = tab === "overview"
        ? "Your workspace"
        : tab === "settings"
            ? "Settings"
            : tab === "notifications"
                ? "Notifications"
                : navItems.find((n) => n.id === tab)?.label;
    const days = Array.from(new Set(data.slots
        .filter((s) => !s.booked &&
        (!chosenPractitioner || s.practitioner_id === chosenPractitioner))
        .map((s) => s.starts_at.slice(0, 10))));
    const validSlots = (!chosenDay ? [] : data.slots).filter((s) => !s.booked &&
        (!chosenPractitioner || s.practitioner_id === chosenPractitioner) &&
        (!chosenDay || s.starts_at.startsWith(chosenDay)));
    const roleLabel = isDoctor
        ? clinicianLabel(u.specialty)
        : isAdmin
            ? "Administrator"
            : "Patient";
    function renderAppointmentList({ items, compact = false, }: {
        items: Appointment[];
        compact?: boolean;
    }) {
        return items.length ? (<div className="table-scroll">
        <table className={"data-table " + (compact ? "compact" : "")}>
          <thead>
            <tr>
              <th>{isPatient ? "Clinician" : "Patient"}</th>
              <th>Appointment</th>
              <th>Date & time</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (<tr key={a.id}>
                <td>
                  <div className="person">
                    <Avatar name={isPatient ? a.practitioner : a.patient}/>
                    <div>
                      <strong>{isPatient ? a.practitioner : a.patient}</strong>
                      <small>
                        {isPatient
                    ? clinicianLabel(data.practitioners.find(p => p.id === a.practitioner_id)?.specialty)
                    : a.id.toUpperCase().slice(0, 12)}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{a.service}</strong>
                  <small>
                    {compact ? "60 min · In clinic" : a.practitioner}
                  </small>
                </td>
                <td>
                  <strong>{date(a.starts_at)}</strong>
                  <small>{time(a.starts_at)}</small>
                </td>
                <td>
                  <Badge tone={a.status}>{a.status}</Badge>
                </td>
                <td>
                  {a.status === "confirmed" ? (<div className="row-actions">
                      <button title="Reschedule appointment" onClick={() => openBook(a)}>
                        <CalendarDays size={15}/>
                        <span className="sr-only">Reschedule {a.patient}</span>
                      </button>
                      <button title="Cancel appointment" onClick={() => setDialog({ kind: "cancel", appointment: a })}>
                        <X size={15}/>
                        <span className="sr-only">Cancel {a.patient}</span>
                      </button>
                      {!isPatient && new Date(a.starts_at) <= now && (<button title="Mark completed" onClick={() => action("appointment", { id: a.id, action: "complete" }, false)}>
                          <Check size={15}/>
                          <span className="sr-only">Complete {a.patient}</span>
                        </button>)}
                    </div>) : (<ChevronRight size={16} className="muted"/>)}
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>) : (<Empty title="A little breathing room" description="No appointments match this view. Book a visit or adjust your filters."/>);
    }
    function renderNotes() {
        const notes = data.notes.filter((n) => matches(`${n.patient} ${n.diagnosis}`));
        return notes.length ? (<div className="record-grid">
        {notes.map((n) => (<article className="panel record" key={n.id}>
            <div className="record-top">
              <span className="icon-tile">
                <FileText size={21}/>
              </span>
              <Badge tone={n.published ? "completed" : "unpaid"}>
                {n.published ? "Released" : "Draft"}
              </Badge>
            </div>
            <small className="eyebrow">
              {date(n.created_at, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                })}{" "}
              · {isPatient ? n.practitioner : n.patient}
            </small>
            <h3>{n.diagnosis}</h3>
            {n.assessment_json && <details className="assessment-details"><summary>View evaluation & progress sheet</summary><div>{assessmentLines(n.assessment_json).map((line,i)=><p key={i}>{line}</p>)}</div></details>}
            <p>{n.notes}</p>
            <h4>Treatment plan</h4>
            <p>{n.plan}</p>
            <div className="record-footer">
              <a className="text-button" href={`/api/reports?id=${n.id}&type=note`} target="_blank" rel="noreferrer">
                <Download size={15}/> Download PDF
              </a>
              {!n.published && n.practitioner_id === u.id && (<button className="text-button" disabled={pending} onClick={() => action("publish", { id: n.id }, false)}>
                  Release to patient <ArrowUpRight size={15}/>
                </button>)}
            </div>
          </article>))}
      </div>) : (<div className="panel">
        <Empty title="Care starts with a conversation" description={isDoctor
                ? "Add a clinical note after a consultation to build the patient’s care history."
                : "Your practitioner’s released care reports will appear here."}/>
      </div>);
    }
    const chartDays = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * 86400000));
    const chartValues = chartDays.map((day) => data.appointments.filter((a) => dayKey(a.starts_at) === dayKey(day.toISOString()) &&
        a.status !== "cancelled").length);
    const chartMax = Math.max(4, ...chartValues);
    return (<div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Brand />
        <div className="workspace-chip">
          <span className="clinic-monogram">M</span>
          <div>
            <strong>{data.settings.clinicName}</strong>
            <small>{roleLabel} workspace</small>
          </div>
          <ChevronRight size={14}/>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navItems
            .filter((n) => n.roles.includes(u.role))
            .map((n) => (<button key={n.id} className={tab === n.id ? "active" : ""} onClick={() => navigate(n.id)}>
                <n.icon size={19}/>
                {n.label}
                {n.id === "appointments" && upcoming.length > 0 && (<span className="nav-count">{upcoming.length}</span>)}
              </button>))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-note">
            <HeartPulse size={23}/>
            <strong>Care that moves you forward.</strong>
            <p>
              Small steps today.
              <br />A healthier tomorrow.
            </p>
            <span>
              THE MINDSPINE WAY <ArrowUpRight size={13}/>
            </span>
          </div>
          <nav aria-label="Account navigation">
            <button className={tab === "notifications" ? "active" : ""} onClick={() => navigate("notifications")}>
              <Bell size={19}/>
              Notifications
              {unread > 0 && <span className="nav-count">{unread}</span>}
            </button>
            <button className={tab === "settings" ? "active" : ""} onClick={() => navigate("settings")}>
              <Settings size={19}/>
              Settings
            </button>
          </nav>
          <div className="sidebar-profile">
            <Avatar name={u.name}/>
            <div>
              <strong>{u.name}</strong>
              <small>{roleLabel}</small>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (<button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobile(false)}/>)}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button mobile-menu" onClick={() => setMobile(true)} aria-label="Open navigation">
              <Menu size={22}/>
            </button>
            <span>Workspace</span>
            <ChevronRight size={14}/>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            {data.demo && (<span className="demo-label">
                <span /> Demo workspace
              </span>)}
            <span className="topbar-date">
              {date(now.toISOString(), {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        })}
            </span>
            <button className="notification-button" onClick={() => navigate("notifications")} aria-label={`Notifications, ${unread} unread`}>
              <Bell size={20}/>
              {unread > 0 && <i />}
            </button>
            <Avatar name={u.name} size="small"/>
            <button className="workspace-logout" disabled={signingOut} onClick={() => startSignOut(async () => {
              try {
                await logout();
                router.refresh();
              } catch {
                setToast({ ok: false, message: "Unable to log out. Please try again." });
              }
            })}>
              <LogOut size={16} aria-hidden="true" />
              <span>{signingOut ? "Logging out…" : "Log out"}</span>
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "overview"
            ? "A NEW DAY. A LITTLE MORE PROGRESS."
            : "MINDSPINE / " + roleLabel.toUpperCase()}
              </div>
              <h1>
                {tab === "overview"
            ? `Good ${now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, ${isDoctor ? "Dr. " : ""}${name} 👋`
            : title}
              </h1>
              <p>
                {tab === "overview"
            ? isPatient
                ? "Your next step toward feeling better starts here."
                : "Here’s what’s happening at your clinic today."
            : tab === "appointments"
                ? "Every visit is another step forward. Manage yours here."
                : tab === "patients"
                    ? "A complete picture of the people in your care."
                    : tab === "records"
                        ? "Thoughtful documentation. Better continuity of care."
                        : tab === "billing"
                            ? "Clear invoices and a complete payment history."
                            : tab === "reports"
                                ? "Your care and clinic insights, ready when you need them."
                                : tab === "team"
                                    ? "The right people, with the right access."
                                    : tab === "notifications"
                                        ? "Your appointments, reports, and clinic updates."
                                        : "Make your workspace work for you."}
              </p>
            </div>
            <div className="heading-actions">
              {!isPatient && <button className="button primary" onClick={() => setDialog({kind:"user",role:"patient"})}><Plus size={17}/>Add patient</button>}
              {isDoctor && tab === "records" ? (<button className="button primary" onClick={() => setDialog({ kind: "note" })}>
                  <Plus size={17}/>
                  Add clinical note
                </button>) : isAdmin && tab === "team" ? (<button className="button primary" onClick={() => setDialog({ kind: "user" })}>
                  <Plus size={17}/>
                  Add user
                </button>) : (["overview", "appointments"].includes(tab) && (<>
                    <button className="button secondary" onClick={() => isPatient
                ? navigate("records")
                : setDialog({ kind: "schedule" })}>
                      <CalendarDays size={16}/>
                      {isPatient ? "My care records" : "Manage availability"}
                    </button>
                    <button className="button primary" onClick={() => openBook()}>
                      <Plus size={18}/>
                      {isPatient ? "Book a visit" : "New appointment"}
                    </button>
                  </>))}
            </div>
          </div>
          {toast && (<div role={toast.ok ? "status" : "alert"} className={"toast " + (toast.ok ? "success" : "error")}>
              <span>
                {toast.ok ? <Check size={18}/> : <ShieldCheck size={18}/>}{" "}
                {toast.message}
              </span>
              <button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss message">
                <X size={16}/>
              </button>
            </div>)}
          {tab === "overview" && (<>
              {isAdmin && <section className="people-shortcuts" aria-label="Manage doctors and patients">
                <div className="panel people-shortcut"><span className="icon-tile"><Users size={23}/></span><div><h2>Patients</h2><p>{data.patients.length} registered · Keep your patient directory up to date.</p><button className="text-button" onClick={() => navigate("patients")}>View patients <ArrowRight size={14}/></button></div><button className="button primary" onClick={() => setDialog({kind:"user",role:"patient"})}><Plus size={16}/>Register patient</button></div>
                <div className="panel people-shortcut"><span className="icon-tile"><HeartPulse size={23}/></span><div><h2>Clinical team</h2><p>{data.users.filter(person => person.role === "practitioner").length} registered · Grow your clinic’s care team.</p><button className="text-button" onClick={() => navigate("team")}>View team <ArrowRight size={14}/></button></div><button className="button primary" onClick={() => setDialog({kind:"user",role:"practitioner"})}><Plus size={16}/>Add clinician</button></div>
              </section>}
              <div className="stats-grid">
                {[
                {
                    label: isPatient
                        ? "Upcoming visits"
                        : "Today’s appointments",
                    value: isPatient
                        ? upcoming.length
                        : todayAppointments.length,
                    sub: isPatient
                        ? "Your time to focus on you"
                        : `${todayAppointments.filter((a) => a.status === "completed").length} completed today`,
                    icon: CalendarDays,
                    color: "mint",
                },
                {
                    label: isPatient
                        ? "Completed visits"
                        : "Patients in your care",
                    value: isPatient ? completed.length : data.patients.length,
                    sub: isPatient
                        ? "Every visit is progress"
                        : "Connected through MindSpine",
                    icon: Users,
                    color: "blue",
                },
                {
                    label: isAdmin
                        ? "Payments received"
                        : isPatient
                            ? "Care reports"
                            : "Clinical records",
                    value: isAdmin ? money(collected) : data.notes.length,
                    sub: isAdmin
                        ? "Recorded payments · all time"
                        : isPatient
                            ? "Your care, clearly documented"
                            : `${data.notes.filter((n) => n.published).length} released to patients`,
                    icon: isAdmin ? CreditCard : ClipboardList,
                    color: "peach",
                },
                {
                    label: isDoctor
                        ? "Upcoming appointments"
                        : "Outstanding balance",
                    value: isDoctor ? upcoming.length : money(outstanding),
                    sub: isDoctor
                        ? "Planned visits ahead"
                        : "Pay directly at the clinic",
                    icon: isDoctor ? CalendarCheck : CreditCard,
                    color: "lavender",
                },
            ].map((stat) => (<article className="stat-card" key={stat.label}>
                    <div className="stat-top">
                      <span>{stat.label}</span>
                      <span className={"stat-icon " + stat.color}>
                        <stat.icon size={19}/>
                      </span>
                    </div>
                    <strong className="stat-number">{stat.value}</strong>
                    <small>{stat.sub}</small>
                  </article>))}
              </div>
              <div className="overview-grid">
                <div className="overview-primary">
                  <section className="welcome-banner">
                    <div>
                      <span className="eyebrow">
                        {isPatient
                ? "YOUR WELLBEING, AT THE CENTER"
                : "MORE THAN APPOINTMENTS"}
                      </span>
                      <h2>
                        {isPatient
                ? "A little care goes a long way."
                : "A space for better care."}
                      </h2>
                      <p>
                        {isPatient
                ? "Keep your care moving forward. Find a time that works for you, and we’ll take it from there."
                : "Your schedule, your patients, and their progress. Everything you need to make each visit matter."}
                      </p>
                      <button onClick={() => isPatient ? openBook() : navigate("patients")}>
                        {isPatient
                ? "Find your next appointment"
                : "Explore your patients"}
                        <ArrowRight size={16}/>
                      </button>
                    </div>
                    <div className="banner-art" aria-hidden="true">
                      <div className="art-ring"/>
                      <div className="art-ring inner"/>
                      <HeartPulse strokeWidth={1} size={92}/>
                      <span className="art-spark s1">+</span>
                      <span className="art-spark s2">+</span>
                    </div>
                  </section>
                  <section className="panel schedule-panel">
                    <SectionHead title={isPatient
                ? "Your upcoming visits"
                : "Today’s appointments"} description={isPatient
                ? "A little time, just for your wellbeing."
                : `${todayAppointments.length} visits on the calendar · All times in IST`} action="View all" onClick={() => navigate("appointments")}/>
                    {renderAppointmentList({
                items: (isPatient ? upcoming : todayAppointments).slice(0, 5),
                compact: true,
            })}
                    <div className="panel-foot">
                      <span>
                        <span className="live-dot"/> Your schedule is up to
                        date
                      </span>
                      <button className="text-button" onClick={() => openBook()}>
                        Book an appointment <Plus size={14}/>
                      </button>
                    </div>
                  </section>
                  <section className="panel">
                    <SectionHead title={isPatient ? "Your care journey" : "Appointment activity"} description="A look at the last seven days"/>
                    <div className="activity-chart">
                      <div className="chart-bars">
                        {chartDays.map((d, i) => (<div className="bar-column" key={i}>
                            <span>{chartValues[i]}</span>
                            <div className={"bar " + (i === 6 ? "current" : "")} style={{
                    height: Math.max(3, (chartValues[i] / chartMax) * 100) + "%",
                }}/>
                            <small>
                              {date(d.toISOString(), { weekday: "short" })}
                            </small>
                          </div>))}
                      </div>
                      <div className="chart-caption">
                        <span>
                          <i /> Scheduled and completed visits
                        </span>
                        <strong>
                          {chartValues.reduce((a, b) => a + b, 0)}{" "}
                          <small>this week</small>
                        </strong>
                      </div>
                    </div>
                  </section>
                </div>
                <div className="overview-aside">
                  <section className="panel calendar-panel">
                    <div className="mini-calendar-heading">
                      <h3>
                        {date(now.toISOString(), {
                month: "long",
                year: "numeric",
            })}
                      </h3>
                      <CalendarDays size={18}/>
                    </div>
                    <div className="mini-calendar">
                      <CalendarMonth appointments={data.appointments} currentDate={data.generatedAt}/>
                    </div>
                    <div className="calendar-legend">
                      <i /> Appointment day{" "}
                      <span>
                        <i /> Today
                      </span>
                    </div>
                    {upcoming[0] && (<div className="next-visit">
                        <div className="eyebrow">UP NEXT</div>
                        <strong>
                          {isPatient
                    ? upcoming[0].practitioner
                    : upcoming[0].patient}
                        </strong>
                        <span>{upcoming[0].service}</span>
                        <p>
                          <Clock3 size={14}/>
                          {date(upcoming[0].starts_at)} ·{" "}
                          {time(upcoming[0].starts_at)}
                        </p>
                      </div>)}
                  </section>
                  <section className="panel quick-actions">
                    <SectionHead title="Quick actions"/>
                    {[
                {
                    label: "Book an appointment",
                    sub: "Make time for better health",
                    icon: CalendarDays,
                    fn: () => openBook(),
                },
                {
                    label: isDoctor
                        ? "Add a clinical note"
                        : "View your reports",
                    sub: isDoctor
                        ? "Document a moment of care"
                        : "Everything in one place",
                    icon: FileText,
                    fn: () => isDoctor
                        ? setDialog({ kind: "note" })
                        : navigate("reports"),
                },
                {
                    label: isAdmin
                        ? "Manage your team"
                        : isDoctor
                            ? "Export patient data"
                            : "View billing",
                    sub: isDoctor
                        ? "Download an Excel workbook"
                        : "Keep the details organized",
                    icon: isDoctor ? Download : CreditCard,
                    fn: () => isDoctor
                        ? window.location.assign("/api/export")
                        : navigate(isAdmin ? "team" : "billing"),
                },
            ].map((item) => (<button key={item.label} onClick={item.fn}>
                        <span className="quick-icon">
                          <item.icon size={19}/>
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.sub}</small>
                        </span>
                        <ChevronRight size={16}/>
                      </button>))}
                  </section>
                  <section className="wellness-card">
                    <span className="eyebrow">
                      <HeartPulse size={15}/> THE MINDSPINE PROMISE
                    </span>
                    <h3>
                      More than treatment.
                      <br />A healthier you.
                    </h3>
                    <p>
                      Personal care. Meaningful progress.
                      <br />
                      With you, every step of the way.
                    </p>
                  </section>
                </div>
              </div>
            </>)}
          {tab === "appointments" && (<section className="panel">
              <div className="table-toolbar">
                <div className="tabs">
                  {["all", "upcoming", "completed", "cancelled"].map((f) => (<button className={filter === f ? "selected" : ""} onClick={() => setFilter(f)} key={f}>
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>))}
                </div>
                <SearchInput value={search} onChange={setSearch} placeholder="Search appointments…"/>
              </div>
              {renderAppointmentList({ items: appts })}
              <div className="panel-foot">
                <span>{appts.length} appointments · India Standard Time</span>
                <span>
                  Patient changes need {data.settings.cancellationHours} hours
                  notice
                </span>
              </div>
            </section>)}
          {tab === "patients" && (<>
              <div className="content-toolbar">
                <SearchInput value={search} onChange={setSearch} placeholder="Search patients…"/>
                {isDoctor && (<a className="button secondary" href="/api/export">
                    <Download size={16}/>
                    Export Excel
                  </a>)}
              </div>
              <div className="patient-grid">
                {data.patients
                .filter((p) => matches(p.name + " " + p.email))
                .map((p) => (<article className="panel patient-card" key={p.id}>
                      <div className="patient-card-top">
                        <Avatar name={p.name} size="large"/>
                        <Badge tone={p.active ? "completed" : "cancelled"}>
                          {p.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <h3>{p.name}</h3>
                      <p>{p.email}</p>
                      <div className="patient-detail-line">
                        <CalendarDays size={15}/>
                        {data.appointments.filter((a) => a.patient_id === p.id && a.status === "completed").length}{" "}
                        completed visits
                      </div>
                      <div className="patient-detail-line">
                        <Clock3 size={15}/>
                        {data.appointments.find((a) => a.patient_id === p.id && a.status === "confirmed")
                    ? `Next visit ${date(data.appointments.find((a) => a.patient_id === p.id && a.status === "confirmed")!.starts_at)}`
                    : "No upcoming visit"}
                      </div>
                      <button className="text-button" onClick={() => setDialog({ kind: "patient", patient: p })}>
                        View patient <ArrowUpRight size={16}/>
                      </button>
                    </article>))}
              </div>
              {!data.patients.filter((p) => matches(p.name + " " + p.email))
                .length && (<Empty title="No patients found" description="Patients appear here when they are registered or assigned to your appointments."/>)}
            </>)}
          {tab === "records" && (<>
              <div className="content-toolbar">
                <SearchInput value={search} onChange={setSearch} placeholder="Search care records…"/>
                <span className="muted">
                  {data.notes.length} records ·{" "}
                  {isPatient
                ? "Released by your practitioner"
                : "Drafts and published reports"}
                </span>
              </div>
              {renderNotes()}
              {data.files.length > 0 && (<section className="panel files-panel">
                  <SectionHead title="Patient documents"/>
                  {data.files.map((f) => (<a className="file-row" href={`/api/files?id=${f.id}`} key={f.id}>
                      <Paperclip size={17}/>
                      <span>
                        {f.name}
                        <small>
                          {Math.round(f.size / 1024)} KB · {date(f.created_at)}
                        </small>
                      </span>
                      <Download size={17}/>
                    </a>))}
                </section>)}
            </>)}
          {tab === "billing" && (<>
              <div className="billing-summary">
                <article className="panel">
                  <small>OUTSTANDING</small>
                  <h2>{money(outstanding)}</h2>
                  <p>
                    {data.invoices.filter((i) => i.status === "unpaid").length}{" "}
                    unpaid invoices
                  </p>
                </article>
                <article className="panel">
                  <small>PAYMENTS RECEIVED</small>
                  <h2>{money(collected)}</h2>
                  <p>Recorded clinic payments</p>
                </article>
                <article className="billing-notice">
                  <ShieldCheck size={25}/>
                  <div>
                    <strong>Pay at your next visit</strong>
                    <p>
                      Online payments are not connected.{" "}
                      {isAdmin
                ? "Record only payments or refunds already processed outside this application."
                : "Your clinic can record payments made in person."}
                    </p>
                  </div>
                </article>
              </div>
              <section className="panel">
                <SectionHead title="Invoices" description="All amounts in Indian rupees"/>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        {isAdmin && <th>Patient</th>}
                        <th>Service</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((i) => (<tr key={i.id}>
                          <td>
                            <strong>{i.id.toUpperCase().slice(0, 12)}</strong>
                            <small>{date(i.created_at)}</small>
                          </td>
                          {isAdmin && <td>{i.patient}</td>}
                          <td>{i.service}</td>
                          <td className="amount">{money(i.amount)}</td>
                          <td>
                            <Badge tone={i.status}>{i.status}</Badge>
                          </td>
                          <td>
                            <div className="row-actions">
                              <a title="Download invoice PDF" href={`/api/reports?id=${i.id}&type=invoice`} target="_blank" rel="noreferrer">
                                <Download size={16}/>
                                <span className="sr-only">
                                  Download invoice {i.id}
                                </span>
                              </a>
                              {isAdmin &&
                    ["unpaid", "paid"].includes(i.status) && (<button className="text-button" onClick={() => setDialog({
                        kind: "invoice",
                        id: i.id,
                        refund: i.status === "paid",
                    })}>
                                    {i.status === "paid"
                        ? "Record refund"
                        : "Record payment"}
                                  </button>)}
                            </div>
                          </td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>
                {!data.invoices.length && (<Empty title="All clear" description="Your invoices will appear here after you book a visit."/>)}
              </section>
            </>)}
          {tab === "reports" && (<>
              <div className="report-options">
                <article className="panel report-option">
                  <span className="stat-icon blue">
                    <FileText size={23}/>
                  </span>
                  <h3>{isAdmin ? "Billing reports" : "Clinical reports"}</h3>
                  <p>
                    {isAdmin
                ? "Download individual invoices with their recorded payment status."
                : "Download printable PDF summaries of clinical records and treatment plans."}
                  </p>
                  <button className="button secondary" onClick={() => navigate(isAdmin ? "billing" : "records")}>
                    View reports <ArrowUpRight size={15}/>
                  </button>
                </article>
                {!isPatient && (<article className="panel report-option">
                    <span className="stat-icon mint">
                      <Download size={23}/>
                    </span>
                    <h3>Excel export</h3>
                    <p>
                      {isDoctor
                    ? "Your authorized patient list, appointments, and clinical records."
                    : "Operational appointments and billing data. Clinical records are excluded."}
                    </p>
                    <a className="button secondary" href="/api/export">
                      Download workbook <Download size={15}/>
                    </a>
                  </article>)}
                <article className="panel report-option">
                  <span className="stat-icon peach">
                    <TrendingUp size={23}/>
                  </span>
                  <h3>Care at a glance</h3>
                  <div className="report-metric">
                    <span>Completed visits</span>
                    <strong>{completed.length}</strong>
                  </div>
                  <div className="report-metric">
                    <span>Upcoming visits</span>
                    <strong>{upcoming.length}</strong>
                  </div>
                  <div className="report-metric">
                    <span>Cancelled visits</span>
                    <strong>
                      {data.appointments.filter((a) => a.status === "cancelled").length}
                    </strong>
                  </div>
                </article>
              </div>
              {isAdmin && (<section className="panel">
                  <SectionHead title="Audit activity" description="Access, account, booking, and financial events"/>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Record</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.audits.map((a) => (<tr key={a.id}>
                            <td>
                              {date(a.created_at)}
                              <small>{time(a.created_at)}</small>
                            </td>
                            <td>{a.actor}</td>
                            <td>
                              {a.action
                        .replaceAll(".", " · ")
                        .replaceAll("_", " ")}
                            </td>
                            <td>
                              <code>{a.entity}</code>
                            </td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </section>)}
            </>)}
          {tab === "team" && (<section className="panel">
              <SectionHead title="People & permissions" description="Administrators have operational access. Clinical records stay with the care team."/>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((person) => (<tr key={person.id}>
                        <td>
                          <div className="person">
                            <Avatar name={person.name}/>
                            <strong>{person.name}</strong>
                          </div>
                        </td>
                        <td>{person.email}</td>
                        <td>
                          {person.role === "practitioner" ? <select aria-label={"Specialty for " + person.name} value={person.specialty || ""} disabled={pending} onChange={e => action("specialty", {id:person.id, specialty:e.target.value}, false)}><option value="" disabled>Choose specialty</option><option value="psychologist">Psychologist</option><option value="physiotherapist">Physiotherapist</option></select> : <Badge>{person.role}</Badge>}
                        </td>
                        <td>
                          <Badge tone={person.active ? "completed" : "cancelled"}>
                            {person.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <button className="text-button" disabled={person.id === u.id || pending} onClick={() => action("toggleUser", { id: person.id }, false)}>
                            {person.id === u.id
                    ? "Current account"
                    : person.active
                        ? "Deactivate"
                        : "Activate"}
                          </button>
                          {person.id !== u.id && (<button className="text-button reset-button" disabled={pending} onClick={() => setDialog({ kind: "reset", user: person })}>
                              Reset password
                            </button>)}
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </section>)}
          {tab === "notifications" && (<section className="panel">
              <SectionHead title="Your updates" description="In-app notifications. Email, SMS, and push delivery are not connected." action="Mark all read" onClick={() => action("read", { id: "" }, false)}/>
              {data.notifications.length ? (data.notifications.map((n) => (<article className={"notification-row " + (!n.is_read ? "unread" : "")} key={n.id}>
                    <span className="icon-tile">
                      <Bell size={19}/>
                    </span>
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.message}</p>
                      <small>
                        {date(n.created_at)} · {time(n.created_at)}
                      </small>
                    </div>
                    {!n.is_read && (<button className="icon-button" title="Mark as read" onClick={() => action("read", { id: n.id }, false)}>
                        <Check size={17}/>
                      </button>)}
                  </article>))) : (<Empty title="You’re all caught up" description="Your clinic updates will appear here."/>)}
            </section>)}
          {tab === "settings" && (<div className="settings-grid">
              <section className="panel settings-panel">
                <SectionHead title="Personal details" description="Keep your contact details up to date."/>
                <form action={formAction("profile")}>
                  <label>
                    Full name
                    <input name="name" defaultValue={u.name} required maxLength={200}/>
                  </label>
                  <label>
                    Email address
                    <input value={u.email} disabled readOnly/>
                  </label>
                  <label>
                    Phone number
                    <input name="phone" defaultValue={u.phone} maxLength={30}/>
                  </label>
                  {isPatient ? (<label>
                      Medical history
                      <textarea name="history" defaultValue={u.history} rows={4} maxLength={5000}/>
                    </label>) : (<input name="history" type="hidden" value={u.history}/>)}
                  <button className="button primary" disabled={pending}>
                    Save profile
                  </button>
                </form>
              </section>
              <section className="panel settings-panel">
                <SectionHead title="Password & security" description="Changing your password signs out other sessions."/>
                <form action={formAction("password")}>
                  <label>
                    Current password
                    <input type="password" name="current" autoComplete="current-password" required/>
                  </label>
                  <label>
                    New password
                    <input type="password" name="next" autoComplete="new-password" minLength={12} required maxLength={128}/>
                  </label>
                  <small className="muted">Use at least 12 characters.</small>
                  <button className="button secondary" disabled={pending}>
                    Update password
                  </button>
                </form>
              </section>
              {isAdmin && (<>
                  <section className="panel settings-panel">
                    <SectionHead title="Clinic settings"/>
                    <form action={formAction("settings")}>
                      <label>
                        Clinic name
                        <input name="clinicName" defaultValue={data.settings.clinicName} required/>
                      </label>
                      <label>
                        Address
                        <input name="address" defaultValue={data.settings.address} required/>
                      </label>
                      <label>
                        Patient cancellation notice in hours
                        <input name="cancellationHours" type="number" min={0} max={168} defaultValue={data.settings.cancellationHours} required/>
                      </label>
                      <button className="button primary" disabled={pending}>
                        Save clinic settings
                      </button>
                    </form>
                  </section>
                  <section className="panel settings-panel">
                    <SectionHead title="Connections" description="External accounts need to be connected before these services can run."/>
                    {[
                    "Online payments",
                    "Email & SMS",
                    "WhatsApp & push",
                    "Calendar synchronization",
                ].map((v) => (<div className="connection-row" key={v}>
                        <span>{v}</span>
                        <Badge tone="unpaid">Not connected</Badge>
                      </div>))}
                    <p className="muted">
                      Local booking, records, and in-app notifications are
                      available. No payment is collected or external message
                      sent here.
                    </p>
                  </section>
                </>)}
            </div>)}
          <footer className="workspace-footer">
            <span>
              MindSpine <i /> Care, connected.
            </span>
            <span>
              <MapPin size={13}/>
              {data.settings.address} · IST
            </span>
          </footer>
        </main>
      </div>
      {dialog && (<Modal title={dialog.kind === "book"
                ? dialog.appointment
                    ? "Reschedule your visit"
                    : "Make time for better care"
                : dialog.kind === "note"
                    ? "Add a clinical note"
                    : dialog.kind === "patient"
                        ? dialog.patient.name
                        : dialog.kind === "invoice"
                            ? dialog.refund
                                ? "Record an offline refund"
                                : "Record an offline payment"
                            : dialog.kind === "user"
                                ? dialog.role === "patient" ? "Add a patient" : dialog.role === "practitioner" ? "Add a clinician" : "Add a workspace user"
                                : dialog.kind === "cancel"
                                    ? "Cancel this appointment?"
                                    : dialog.kind === "reset"
                                        ? "Reset account password"
                                        : "Manage availability"} subtitle={dialog.kind === "book"
                ? "Appointments are 60 minutes. All times are in India Standard Time."
                : undefined} onClose={() => {
                if (!pending)
                    setDialog(null);
            }}>
          {toast && !toast.ok && (<p className="form-error" role="alert">
              {toast.message}
            </p>)}
          {dialog.kind === "book" && (<form action={(f) => {
                    const slotId = String(f.get("slotId"));
                    if (dialog.appointment)
                        action("appointment", {
                            id: dialog.appointment.id,
                            action: "reschedule",
                            slotId,
                        });
                    else
                        action("book", {
                            slotId,
                            patientId: String(f.get("patientId") || u.id),
                            service: String(f.get("service")),
                            reason: String(f.get("reason") || ""),
                        });
                }}>
              {!dialog.appointment && !isPatient && (<label>
                  Patient
                  <select aria-label="Patient" name="patientId" required>
                    <option value="">Choose a patient</option>
                    {data.patients
                        .filter((p) => p.active)
                        .map((p) => (<option value={p.id} key={p.id}>
                          {p.name}{p.role === "practitioner" ? ` · ${clinicianLabel(p.specialty)}` : ""}
                        </option>))}
                  </select>
                </label>)}
              <label>
                Clinician
                <select aria-label="Clinician" value={chosenPractitioner} onChange={(e) => {
                    setChosenPractitioner(e.target.value);
                    setChosenDay("");
                }} disabled={!!dialog.appointment || isDoctor} required>
                  <option value="">Choose a practitioner</option>
                  {data.practitioners.map((p) => (<option value={p.id} key={p.id}>
                      {p.name}{p.role === "practitioner" ? ` · ${clinicianLabel(p.specialty)}` : ""}
                    </option>))}
                </select>
              </label>
              {!dialog.appointment && (<label>
                  Appointment type
                  <select aria-label="Appointment type" name="service" required>
                    <option value="Initial consultation">
                      Initial consultation · ₹1,500
                    </option>
                    <option value="Chiropractic adjustment">
                      Chiropractic adjustment · ₹1,000
                    </option>
                    <option value="Progress review">
                      Progress review · ₹800
                    </option>
                  </select>
                </label>)}
              <label>
                Date
                <select aria-label="Date" value={chosenDay} onChange={(e) => setChosenDay(e.target.value)} required disabled={!chosenPractitioner}>
                  <option value="">Choose a day</option>
                  {days.map((day) => (<option value={day} key={day}>
                      {date(day + "T10:00:00Z", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                    })}
                    </option>))}
                </select>
              </label>
              <label>
                Available time
                <select aria-label="Available time" name="slotId" required disabled={!chosenDay}>
                  <option value="">Choose a time</option>
                  {validSlots.map((s) => (<option key={s.id} value={s.id}>
                      {time(s.starts_at)}
                    </option>))}
                </select>
              </label>
              {!dialog.appointment && (<label>
                  Reason for visit <span className="muted">(optional)</span>
                  <textarea name="reason" rows={3} maxLength={1000} placeholder="Anything you’d like your practitioner to know?"/>
                </label>)}
              <p className="form-note">
                {dialog.appointment
                    ? "Your original slot will be released when the change is confirmed."
                    : "Payment is due at the clinic. No online payment will be collected."}{" "}
                Patient changes require {data.settings.cancellationHours} hours
                notice.
              </p>
              <button className="button primary full" disabled={pending || !chosenDay || !chosenPractitioner}>
                {pending
                    ? "Saving…"
                    : dialog.appointment
                        ? "Confirm new time"
                        : "Confirm appointment"}
                <ArrowRight size={16}/>
              </button>
            </form>)}
          {dialog.kind === "cancel" && (<div>
              <p>
                Your {dialog.appointment.service.toLowerCase()} on{" "}
                <strong>
                  {date(dialog.appointment.starts_at)} at{" "}
                  {time(dialog.appointment.starts_at)}
                </strong>{" "}
                will be cancelled.
              </p>
              <p className="form-note">
                Unpaid invoices will be voided. Any refund for a paid invoice
                must be handled separately by the clinic.
              </p>
              <div className="modal-actions">
                <button className="button secondary" onClick={() => setDialog(null)}>
                  Keep appointment
                </button>
                <button className="button danger" disabled={pending} onClick={() => action("appointment", {
                    id: dialog.appointment.id,
                    action: "cancel",
                })}>
                  Confirm cancellation
                </button>
              </div>
            </div>)}
          {dialog.kind === "note" && <ClinicalForm appointments={data.appointments} patients={data.patients} specialty={u.specialty} pending={pending} onSave={payload => action("note",payload)} />}
          {dialog.kind === "invoice" && (<form action={formAction("invoice", (f) => ({
                    id: dialog.id,
                    action: dialog.refund ? "refunded" : "paid",
                    reference: String(f.get("reference")),
                }))}>
              <p>
                Only record a {dialog.refund ? "refund" : "payment"} that has
                already been completed outside MindSpine. This action does not
                transfer money.
              </p>
              <label>
                Receipt or transaction reference
                <input name="reference" required minLength={3} maxLength={200}/>
              </label>
              <button className="button primary full" disabled={pending}>
                Record completed {dialog.refund ? "refund" : "payment"}
              </button>
            </form>)}
          {dialog.kind === "reset" && (<form action={formAction("resetPassword", (f) => ({
                    id: dialog.user.id,
                    password: f.get("password"),
                }))}>
              <p>
                Set a new password for <strong>{dialog.user.name}</strong> after
                verifying their identity through your clinic process. All their
                existing sessions will be signed out.
              </p>
              <label>
                New password
                <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>
              </label>
              <p className="form-note">
                Share the new password through your approved secure channel.
                Email password recovery is not connected.
              </p>
              <button className="button primary full" disabled={pending}>
                Reset password and sign out sessions
              </button>
            </form>)}
          {dialog.kind === "user" && (<form action={formAction("user")}>
              <label>
                Full name
                <input name="name" required/>
              </label>
              <label>
                Email
                <input name="email" type="email" required/>
              </label>
              <label>
                Role
                <select aria-label="Role" name="role" defaultValue={dialog.role === "practitioner" ? "psychologist" : "patient"}>
                  <option value="patient">Patient</option>
                  {isAdmin && <><option value="psychologist">Psychologist</option>
                  <option value="physiotherapist">Physiotherapist</option>
                  <option value="admin">Administrator</option></>}
                </select>
              </label>
              <label>
                Phone (optional)
                <input name="phone" type="tel" autoComplete="tel" maxLength={30}/>
              </label>
              <label>
                Initial password
                <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>
              </label>
              <p className="form-note">
                Share credentials through your approved secure process. The user
                can change the password in Settings.
              </p>
              <button className="button primary full" disabled={pending}>
                Create user
              </button>
            </form>)}
          {dialog.kind === "schedule" && (<>
              <form action={formAction("slot", (f) => ({
                    practitionerId: f.get("practitionerId"),
                    startsAt: new Date(String(f.get("date")) +
                        "T" +
                        String(f.get("hour")) +
                        ":00+05:30").toISOString(),
                }))}>
                <label>
                  Clinician
                  <select aria-label="Clinician" name="practitionerId" required>
                    {data.practitioners
                    .filter((p) => isAdmin || p.id === u.id)
                    .map((p) => (<option key={p.id} value={p.id}>
                          {p.name}{p.role === "practitioner" ? ` · ${clinicianLabel(p.specialty)}` : ""}
                        </option>))}
                  </select>
                </label>
                <div className="form-columns">
                  <label>
                    Date
                    <input name="date" type="date" min={new Date().toLocaleDateString("en-CA", {
                    timeZone: "Asia/Kolkata",
                })} required/>
                  </label>
                  <label>
                    Time in IST
                    <select aria-label="Time in IST" name="hour">
                      {Array.from({ length: 10 }, (_, i) => i + 9).map((h) => (<option key={h} value={String(h).padStart(2, "0") + ":00"}>
                          {h > 12 ? h - 12 : h}:00 {h >= 12 ? "PM" : "AM"}
                        </option>))}
                    </select>
                  </label>
                </div>
                <button className="button primary full" disabled={pending}>
                  Add 60-minute slot
                </button>
              </form>
              <h3 className="spaced">Upcoming availability</h3>
              <div className="slot-list">
                {data.slots.slice(0, 40).map((s) => (<div className="slot-row" key={s.id}>
                    <span>
                      <strong>
                        {date(s.starts_at)} · {time(s.starts_at)}
                      </strong>
                      <small>{s.practitioner}</small>
                    </span>
                    {s.booked ? (<Badge tone="confirmed">Booked</Badge>) : (<button className="text-button" disabled={pending} onClick={() => action("deleteSlot", { id: s.id }, false)}>
                        Remove
                      </button>)}
                  </div>))}
              </div>
            </>)}
          {dialog.kind === "patient" && (<>
              <div className="patient-modal-head">
                <Avatar name={dialog.patient.name} size="large"/>
                <div>
                  <strong>{dialog.patient.email}</strong>
                  <p>{dialog.patient.phone || "No phone number recorded"}</p>
                </div>
              </div>
              {isDoctor && (<>
                  <h3>Medical history</h3>
                  <p className="history-text">
                    {dialog.patient.history || "No history recorded."}
                  </p>
                  <h3>Clinical documents</h3>
                  {data.files
                        .filter((f) => f.patient_id === dialog.patient.id)
                        .map((f) => (<a className="file-row" key={f.id} href={`/api/files?id=${f.id}`}>
                        <Paperclip size={15}/>
                        {f.name}
                        <Download size={15}/>
                      </a>))}
                  <form action={async (f) => {
                        setToast(null);
                        const result = await fetch("/api/files", {
                            method: "POST",
                            body: f,
                        });
                        const body = await result.json();
                        setToast({
                            ok: result.ok,
                            message: body.message || body.error,
                        });
                        if (result.ok)
                            router.refresh();
                    }}>
                    <input type="hidden" name="patientId" value={dialog.patient.id}/>
                    <label>
                      Upload a PDF, JPEG, or PNG up to 5 MB
                      <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required/>
                    </label>
                    <button className="button secondary">
                      <Upload size={15}/>
                      Upload document
                    </button>
                  </form>
                </>)}
              <h3 className="spaced">Visit history</h3>
              {data.appointments
                    .filter((a) => a.patient_id === dialog.patient.id)
                    .map((a) => (<div className="slot-row" key={a.id}>
                    <span>
                      <strong>{a.service}</strong>
                      <small>
                        {date(a.starts_at)} · {time(a.starts_at)}
                      </small>
                    </span>
                    <Badge tone={a.status}>{a.status}</Badge>
                  </div>))}
            </>)}
        </Modal>)}
    </div>);
}
function SearchInput({ value, onChange, placeholder, }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (<label className="search-input">
      <Search size={17}/>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder.replace("…", "")}/>
    </label>);
}
function CalendarMonth({ appointments, currentDate }: {
    appointments: Appointment[];
    currentDate: string;
}) {
    const now = new Date(new Date(currentDate).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay(), count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (<>
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (<span className="weekday" key={"w" + i}>
          {d}
        </span>))}
      {Array.from({ length: first }, (_, i) => (<span key={"blank" + i}/>))}
      {Array.from({ length: count }, (_, i) => {
            const day = i + 1;
            const has = appointments.some((a) => {
                const value = new Date(new Date(a.starts_at).toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                }));
                return (value.getDate() === day &&
                    value.getMonth() === now.getMonth() &&
                    value.getFullYear() === now.getFullYear() &&
                    a.status !== "cancelled");
            });
            return (<span className={"calendar-day " +
                    (day === now.getDate() ? "today" : "") +
                    (has ? " has-visit" : "")} key={day}>
            {day}
            {has && <i />}
          </span>);
        })}
    </>);
}
