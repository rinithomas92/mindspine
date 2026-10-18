"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, ClipboardList, CreditCard, BarChart3, Settings, Bell, Search, Plus, ArrowUpRight, ArrowRight, ArrowLeft, Clock3, ChevronRight, ChevronLeft, Download, FileText, LogOut, HeartPulse, Check, Menu, X, ShieldCheck, MapPin, CalendarCheck, TrendingUp, SlidersHorizontal, Mail, ExternalLink, Upload, Paperclip, Trash2, Pencil, Folder, MoreVertical, Camera, Eye, EyeOff, MessageCircle, } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppData, Appointment, ClinicalNote, FileRecord, User } from "@/lib/types";
import { logout, mutate } from "@/app/actions";
import Brand from "./brand";
import PhysioWorkflow from "./physio-workflow";
import ClinicalForm from "./clinical-form";
import ProgressEntryForm from "./progress-entry-form";
import UploadDocumentForm from "./upload-document-form";
import {readAssessment} from "@/lib/assessment";
import { clinicianLabel } from "@/lib/clinician";
import { Modal, Badge, Avatar, Empty, SectionHead, money, date, time, dayKey, } from "./ui";
type Tab = "physio" | "overview" | "appointments" | "patients" | "records" | "billing" | "reports" | "team" | "notifications" | "settings";
type Dialog = {
    kind: "book";
    appointment?: Appointment;
} | {
    kind: "note";
    note?: ClinicalNote;
} | {
    kind: "patient";
    patient: User;
} | {
    kind: "clinicalRecord";
    note: ClinicalNote;
} | {
    kind: "documentsLibrary";
} | {
    kind: "progressEntry";
    note: ClinicalNote;
    index?: number;
} | {
    kind: "editPatient";
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
} | {
    kind: "appointment";
    appointment: Appointment;
} | {
    kind: "shareRecord";
    recordType: "note" | "physio" | "invoice";
    channel: "email" | "whatsapp";
    id: string;
    patientName: string;
    email: string;
    phone: string;
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
        label: "Care Records",
        icon: ClipboardList,
        roles: ["patient", "practitioner"],
    },
    {
        id: "billing",
        label: "Billing & Payments",
        icon: CreditCard,
        roles: ["patient", "admin", "practitioner"],
    },
    {
        id: "reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["patient", "practitioner", "admin"],
    },
    { id: "physio", label: "Physiotherapy Journey", icon: HeartPulse, roles: ["patient", "practitioner"] },
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
    const [bookReturnPatient, setBookReturnPatient] = useState<User | undefined>(undefined);
    const [billingStatusFilter, setBillingStatusFilter] = useState("all"), [billingServiceFilter, setBillingServiceFilter] = useState("all");
    const [notificationCategory, setNotificationCategory] = useState("all"), [notificationTimeFilter, setNotificationTimeFilter] = useState("all");
    const [patientQuery, setPatientQuery] = useState(""), [selectedPatientId, setSelectedPatientId] = useState(""), [selectedSlotId, setSelectedSlotId] = useState("");
    const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [deletePatientTarget, setDeletePatientTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleteSlotTarget, setDeleteSlotTarget] = useState<{ id: string; label: string } | null>(null);
    const [slotsShown, setSlotsShown] = useState(10);
    const [openPatientMenu, setOpenPatientMenu] = useState<string | null>(null);
    const [patientMenuPos, setPatientMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [openApptMenu, setOpenApptMenu] = useState<string | null>(null);
    const [apptMenuPos, setApptMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [deleteApptTarget, setDeleteApptTarget] = useState<{ id: string; label: string } | null>(null);
    const [editApptTarget, setEditApptTarget] = useState<Appointment | null>(null);
    const [signingOut, startSignOut] = useTransition();
    const [clinicalDetailTab, setClinicalDetailTab] = useState<"overview" | "patientDetails" | "history" | "examination" | "observation" | "palpation" | "mmt" | "clinicalSummary" | "progress" | "documents">("overview");
    const [clinicalCompactTab, setClinicalCompactTab] = useState<"details" | "progress" | "documents">("details");
    const [docsSearch, setDocsSearch] = useState("");
    const [docsTypeFilter, setDocsTypeFilter] = useState("all");
    const [docsSort, setDocsSort] = useState<"newest" | "oldest" | "name" | "size">("newest");
    const [passwordVisible, setPasswordVisible] = useState({ current: false, next: false, confirm: false });
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const [scheduleDate, setScheduleDate] = useState(todayIST);
    const [careRecordsClinicianFilter, setCareRecordsClinicianFilter] = useState("all");
    const nowISTHour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
    const availableHours = Array.from({ length: 10 }, (_, i) => i + 9).filter((h) => scheduleDate !== todayIST || h > nowISTHour);
    const [avatarPending, setAvatarPending] = useState(false);
    const [avatarError, setAvatarError] = useState("");
    async function uploadAvatar(file: File) {
        setAvatarError("");
        setAvatarPending(true);
        try {
            const form = new FormData();
            form.set("file", file);
            const result = await fetch("/api/avatar", { method: "POST", body: form });
            const body = await result.json();
            if (!result.ok) { setAvatarError(body.error || "Unable to upload this image."); return; }
            router.refresh();
        } catch {
            setAvatarError("Unable to upload this image. Check your connection and try again.");
        } finally {
            setAvatarPending(false);
        }
    }
    async function removeAvatar() {
        setAvatarError("");
        setAvatarPending(true);
        try {
            const result = await fetch("/api/avatar", { method: "DELETE" });
            if (!result.ok) { setAvatarError("Unable to remove this image."); return; }
            router.refresh();
        } catch {
            setAvatarError("Unable to remove this image. Check your connection and try again.");
        } finally {
            setAvatarPending(false);
        }
    }
    const [docsPage, setDocsPage] = useState(1);
    const [showUploadPanel, setShowUploadPanel] = useState(false);
    const [uploadDefaultPatientId, setUploadDefaultPatientId] = useState<string | undefined>(undefined);
    const [trendMonths, setTrendMonths] = useState(6);
    useEffect(() => {
        if (!toast)
            return;
        const timer = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(timer);
    }, [toast]);
    const router = useRouter(), u = data.user, isPatient = u.role === "patient", isAdmin = u.role === "admin", isDoctor = u.role === "practitioner";
    const now = new Date(data.generatedAt);
    const localDateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const today = dayKey(now.toISOString()), todayKey = localDateKey(now);
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
    const matches = (value: string) => value.toLowerCase().includes(search.trim().toLowerCase());
    const isOverdue = (appointment: Appointment) => appointment.status === "confirmed" && new Date(appointment.starts_at) <= now;
    const appointmentStatusLabel = (appointment: Appointment) => isOverdue(appointment) ? "Overdue" : appointment.status === "confirmed" ? "Upcoming" : appointment.status;
    const patientCode = (patient: User) => "#P-" + (patient.id.replace(/\D/g, "").slice(-3).padStart(3, "0") || patient.id.toUpperCase().slice(0, 3));
    const appts = data.appointments.filter((a) => matches(`${a.patient} ${a.practitioner} ${a.service} ${a.status} ${appointmentStatusLabel(a)} ${(() => { const p = data.patients.find((p) => p.id === a.patient_id); return p ? `${p.email} ${patientCode(p)}` : ""; })()} ${date(a.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`) &&
        (filter === "all" ||
            (filter === "upcoming"
                ? a.status === "confirmed" && new Date(a.starts_at) > now
                : filter === "overdue"
                    ? isOverdue(a)
                    : a.status === filter)));
    function navigate(next: Tab) {
        setTab(next);
        setSearch("");
        setFilter("all");
        setMobile(false);
    }
    function openBook(appointment?: Appointment, patient?: User) {
        setChosenDay("");
        setChosenPractitioner(appointment?.practitioner_id || (isDoctor ? u.id : ""));
        setChosenDay("");
        setSelectedSlotId("");
        setPatientQuery(patient?.name || "");
        setSelectedPatientId(patient?.id || "");
        setCalendarMonthOffset(0);
        setBookReturnPatient(!appointment ? patient : undefined);
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
    function formAction(type: string, transform?: (f: FormData) => unknown, close = true) {
        return (f: FormData) => action(type, transform ? transform(f) : Object.fromEntries(f), close);
    }
    // Uses onSubmit instead of the native form `action` prop so a failed submission does not
    // trigger React's automatic reset of uncontrolled fields — keeps whatever the user typed.
    function retainOnError(type: string, transform?: (f: FormData) => unknown, close = true) {
        return (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action(type, transform ? transform(f) : Object.fromEntries(f), close);
        };
    }
    const roleLabel = isDoctor
        ? clinicianLabel(u.specialty)
        : isAdmin
            ? "Administrator"
            : "Patient";
    const title = tab === "overview"
        ? `${roleLabel} Workspace`
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
    const selectedSlotStillValid = validSlots.some((slot) => slot.id === selectedSlotId);
    const availableDaySet = new Set(days);
    const patientMatches = data.patients.filter((patient) => `${patient.name} ${patient.email} ${patient.phone} ${patientCode(patient)}`.toLowerCase().includes(patientQuery.trim().toLowerCase())).slice(0, 5);
    const selectedPatient = data.patients.find((patient) => patient.id === selectedPatientId);
    const filteredNotes = data.notes.filter((n) => matches(n.patient + " " + n.practitioner + " " + n.diagnosis + " " + n.notes + " " + n.plan));
    const filteredFiles = data.files.filter((f) => { const patient = data.patients.find((p) => p.id === f.patient_id); return matches(f.name + " " + (patient?.name || "") + " " + f.mime); });
    const filteredPatients = data.patients.filter((p) => p.active !== 0 && matches(p.name + " " + p.email + " " + p.phone + " " + p.id + " " + patientCode(p)));
    const patientAppointments = (patientId: string) => data.appointments.filter((appointment) => appointment.patient_id === patientId).sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
    const patientCompletedVisits = (patientId: string) => patientAppointments(patientId).filter((appointment) => appointment.status === "completed").length;
    const patientNextAppointment = (patientId: string) => patientAppointments(patientId).filter((appointment) => appointment.status === "confirmed" && new Date(appointment.starts_at) >= now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
    const patientLastVisit = (patientId: string) => patientAppointments(patientId).find((appointment) => appointment.status === "completed");
    const appointmentEnd = (appointment: Appointment) => new Date(new Date(appointment.starts_at).getTime() + 60 * 60 * 1000).toISOString();
    const appointmentCode = (appointment: Appointment) => "APT-" + appointment.id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-9);
    type CareDashboardRecord = {
        id: string;
        source: "note" | "document";
        patientId: string;
        patient: string;
        patientCode: string;
        createdAt: string;
        title: string;
        summary: string;
        recordType: "Clinical Note" | "Progress Sheet" | "Document";
        status: "Published" | "Draft" | "Available";
        clinician: string;
        specialty: string;
        linkedVisit: string;
        note?: ClinicalNote;
        file?: FileRecord;
    };
    const patientById = (patientId: string) => data.patients.find((patient) => patient.id === patientId);
    const careRecords: CareDashboardRecord[] = [
        ...data.notes.map((n) => { const patient = patientById(n.patient_id); const appointment = n.appointment_id ? data.appointments.find((a) => a.id === n.appointment_id) : undefined; return { id: "note-" + n.id, source: "note" as const, patientId: n.patient_id, patient: n.patient, patientCode: patient ? patientCode(patient) : n.patient_id, createdAt: appointment?.starts_at || n.created_at, title: n.diagnosis || (n.assessment_json ? "Clinical note" : "Progress note"), summary: n.notes || n.plan || "Clinical record", recordType: n.assessment_json ? "Clinical Note" as const : "Progress Sheet" as const, status: n.published ? "Published" as const : "Draft" as const, clinician: n.practitioner, specialty: clinicianLabel(data.practitioners.find((p) => p.id === n.practitioner_id)?.specialty), linkedVisit: appointment ? date(appointment.starts_at) + " · " + time(appointment.starts_at) : "—", note: n }; }),
        ...data.files.map((f) => { const patient = patientById(f.patient_id); const appointment = f.appointment_id ? data.appointments.find((a) => a.id === f.appointment_id) : undefined; return { id: "file-" + f.id, source: "document" as const, patientId: f.patient_id, patient: patient?.name || "Patient", patientCode: patient ? patientCode(patient) : f.patient_id, createdAt: f.created_at, title: f.name, summary: f.document_type || f.description || (f.mime.includes("pdf") ? "PDF document" : "Patient document"), recordType: "Document" as const, status: "Available" as const, clinician: "—", specialty: "", linkedVisit: appointment ? date(appointment.starts_at) + " · " + time(appointment.starts_at) : "—", file: f }; }),
    ].filter((record) => {
        const recordFilter = ["clinical", "progress", "documents", "draft", "published"].includes(filter) ? filter : "all";
        const textMatch = (record.patient + " " + record.patientCode + " " + record.title + " " + record.summary + " " + record.recordType + " " + record.clinician).toLowerCase().includes(search.toLowerCase());
        const typeMatch = recordFilter === "all" || (recordFilter === "clinical" && record.recordType === "Clinical Note") || (recordFilter === "progress" && record.recordType === "Progress Sheet") || (recordFilter === "documents" && record.recordType === "Document") || (recordFilter === "draft" && record.status === "Draft") || (recordFilter === "published" && record.status === "Published");
        const clinicianMatch = careRecordsClinicianFilter === "all" || record.clinician === careRecordsClinicianFilter;
        return textMatch && typeMatch && clinicianMatch;
    }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const allCareRecords = data.notes.length + data.files.length;
    const careCounts = { draft: data.notes.filter((n) => !n.published).length, published: data.notes.filter((n) => n.published).length, clinical: data.notes.filter((n) => n.assessment_json).length, progress: data.notes.filter((n) => !n.assessment_json).length, documents: data.files.length };
    const recordFilter = ["clinical", "progress", "documents", "draft", "published"].includes(filter) ? filter : "all";
    const recentDocuments = [...data.files].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 4);
    const calendarStart = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
    const calendarLead = calendarStart.getDay();
    const calendarCells = Array.from({ length: 42 }, (_, i) => new Date(calendarStart.getFullYear(), calendarStart.getMonth(), i - calendarLead + 1));
    const chosenDayLabel = chosenDay ? date(`${chosenDay}T09:00:00`, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
    useEffect(() => {
        if (dialog?.kind !== "book" || chosenDay || !chosenPractitioner || !days.length)
            return;
        const nextDay = days.find((day) => day >= todayKey) ?? days[0];
        if (nextDay) {
            setChosenDay(nextDay);
            const nextDate = new Date(`${nextDay}T09:00:00`);
            setCalendarMonthOffset((nextDate.getFullYear() - now.getFullYear()) * 12 + nextDate.getMonth() - now.getMonth());
        }
    }, [dialog, chosenDay, chosenPractitioner, days, now, todayKey]);
    function renderAppointmentCards(items: Appointment[]) {
        return items.length ? (<div className="compact-list appointment-compact-list">
          {items.map((a) => {
            const patient = patientById(a.patient_id);
            return <article className="compact-row appointment-compact-card" key={a.id}>
              <div className="compact-date-tile"><strong>{date(a.starts_at, { day: "2-digit" })}</strong><span>{date(a.starts_at, { month: "short", year: "numeric" })}</span><small>{date(a.starts_at, { weekday: "short" })}</small></div>
              <Avatar name={isPatient ? a.practitioner : a.patient}/>
              <div className="compact-main"><strong>{isPatient ? a.practitioner : a.patient}</strong><small>{isPatient ? clinicianLabel(data.practitioners.find(p => p.id === a.practitioner_id)?.specialty) : patient?.email || "No email recorded"}</small><small>{a.service} · 60 min</small><small>{money(a.amount)}</small></div>
              <div className="compact-meta"><strong>{time(a.starts_at)} - {time(appointmentEnd(a))}</strong><small><Users size={13}/>{a.practitioner}</small><small>{clinicianLabel(data.practitioners.find(p => p.id === a.practitioner_id)?.specialty)}</small></div>
              <Badge tone={isOverdue(a) ? "overdue" : a.status}>{appointmentStatusLabel(a)}</Badge>
              <button className="view-row-button" type="button" onClick={() => setDialog({ kind: "appointment", appointment: a })}><FileText size={15}/>View</button>
            </article>;
          })}
        </div>) : (<div className="compact-list appointment-compact-list"><Empty title="A little breathing room" description="No appointments match this view. Book a visit or adjust your filters."/></div>);
    }
    function renderAppointmentList({ items, compact = false, }: {
        items: Appointment[];
        compact?: boolean;
    }) {
        return items.length ? (<div className="table-scroll refined-table-scroll desktop-list">
        <table className={"data-table appointment-table " + (compact ? "compact" : "") }>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>{isPatient ? "Clinician" : "Patient"}</th>
              <th>Appointment Type</th>
              <th>Clinician</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const patient = patientById(a.patient_id);
              return <tr key={a.id}>
                <td><strong>{date(a.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</strong><small>{time(a.starts_at)} - {time(appointmentEnd(a))}</small></td>
                <td><div className="person table-person"><Avatar name={isPatient ? a.practitioner : a.patient}/><div><strong>{isPatient ? a.practitioner : a.patient}</strong><small>{isPatient ? clinicianLabel(data.practitioners.find(p => p.id === a.practitioner_id)?.specialty) : (patient?.email || "No email recorded") + " · " + (patient ? patientCode(patient) : a.id.toUpperCase().slice(0, 8))}</small></div></div></td>
                <td><span className="service-cell"><ClipboardList size={18}/><span><strong>{a.service}</strong><small>{money(a.amount)} · 60 min</small></span></span></td>
                <td><div className="person clinician-cell"><Avatar name={a.practitioner}/><div><strong>{a.practitioner}</strong><small>{clinicianLabel(data.practitioners.find(p => p.id === a.practitioner_id)?.specialty)}</small></div></div></td>
                <td><Badge tone={isOverdue(a) ? "overdue" : a.status}>{appointmentStatusLabel(a)}</Badge></td>
                <td><div className="row-actions detail-actions"><button className="view-row-button" type="button" onClick={() => setDialog({ kind: "appointment", appointment: a })}><FileText size={16}/>View</button>{a.status !== "completed" && <div className="appt-row-menu"><button className="kebab-button" type="button" aria-haspopup="menu" aria-expanded={openApptMenu === a.id} aria-label={"More actions for appointment with " + a.patient} onClick={(e) => { if (openApptMenu === a.id) { setOpenApptMenu(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setApptMenuPos({ top: rect.bottom + 6, left: rect.right - 200 }); setOpenApptMenu(a.id); }}>⋮</button>{openApptMenu === a.id && apptMenuPos && <><div className="row-menu-backdrop" onClick={() => setOpenApptMenu(null)}/><div className="row-menu-dropdown" role="menu" style={{ top: apptMenuPos.top, left: apptMenuPos.left }}>
                  <button type="button" role="menuitem" onClick={() => { setOpenApptMenu(null); openBook(a); }}><CalendarDays size={15}/>Reschedule</button>
                  {!isPatient && a.status === "confirmed" && <button type="button" role="menuitem" onClick={() => { setOpenApptMenu(null); setEditApptTarget(a); }}><Pencil size={15}/>Edit Entry</button>}
                  {a.status === "confirmed" && isOverdue(a) && !isPatient && <button type="button" role="menuitem" onClick={() => { setOpenApptMenu(null); action("appointment", { id: a.id, action: "complete" }); }}><Check size={15}/>Mark Completed</button>}
                  {a.status === "confirmed" && <button type="button" role="menuitem" onClick={() => { setOpenApptMenu(null); setDialog({ kind: "cancel", appointment: a }); }}><X size={15}/>Cancel Appointment</button>}
                  {!isPatient && <button type="button" role="menuitem" className="danger" onClick={() => { setOpenApptMenu(null); setDeleteApptTarget({ id: a.id, label: a.service + " · " + a.patient }); }}><Trash2 size={15}/>Delete Entry</button>}
                </div></>}</div>}</div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>) : (<div className="table-scroll refined-table-scroll desktop-list"><Empty title="A little breathing room" description="No appointments match this view. Book a visit or adjust your filters."/></div>);
    }
    function renderPatientCards(items: User[]) {
        return items.length ? (<div className="compact-list patient-compact-list">
          {items.map((p) => {
            const next = patientNextAppointment(p.id);
            const completedCount = patientCompletedVisits(p.id);
            return <article className="compact-row patient-compact-card" key={p.id}>
              <Avatar name={p.name}/>
              <div className="compact-main"><strong>{p.name}</strong><small>{patientCode(p)}</small><small>{p.email}</small><small>{p.phone || "No phone number recorded"}</small></div>
              <div className="compact-meta"><strong><FileText size={13}/>{completedCount} completed {completedCount === 1 ? "visit" : "visits"}</strong><small>{next ? "Next visit scheduled" : "No upcoming visit"}</small></div>
              <div className="compact-meta"><strong>{next ? date(next.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "-"}</strong><small>{next ? time(next.starts_at) : "No upcoming visit"}</small></div>
              <button className="view-row-button" type="button" onClick={() => setDialog({ kind: "patient", patient: p })}><FileText size={15}/>View</button>
            </article>;
          })}
        </div>) : (<Empty title="No patients found" description="Patients appear here when they are registered or assigned to your appointments."/>);
    }
    function recordTypeTone(record: CareDashboardRecord) {
        return record.recordType === "Clinical Note" ? "completed" : record.recordType === "Progress Sheet" ? "info" : "unpaid";
    }
    function statusTone(record: CareDashboardRecord) {
        return record.status === "Draft" ? "unpaid" : "completed";
    }
    function renderRecordAction(record: CareDashboardRecord) {
        if (!record.note)
            return <a className="view-row-button" href={"/api/files?id=" + record.file!.id} target="_blank" rel="noreferrer"><FileText size={15}/>View</a>;
        const recordPatient = patientById(record.patientId);
        return <div className="care-record-action-group">
            <button className="view-row-button" type="button" onClick={() => setDialog({ kind: "clinicalRecord", note: record.note! })}><FileText size={15}/>View</button>
            <button className="email-row-button" type="button" title="Email this care record to the patient" onClick={() => setDialog({ kind: "shareRecord", recordType: "note", channel: "email", id: record.note!.id, patientName: record.patient, email: recordPatient?.email || "", phone: recordPatient?.phone || "" })}><Mail size={15}/>Email</button>
            <button className="whatsapp-row-button" type="button" title="Share this care record via WhatsApp" onClick={() => setDialog({ kind: "shareRecord", recordType: "note", channel: "whatsapp", id: record.note!.id, patientName: record.patient, email: recordPatient?.email || "", phone: recordPatient?.phone || "" })}><MessageCircle size={15}/>WhatsApp</button>
        </div>;
    }
    function renderCareRecordsTable() {
        if (!careRecords.length) {
            const filtered = allCareRecords > 0;
            return <div className="care-record-empty"><Empty icon={filtered ? Search : FileText} title={filtered ? "No Records Match Your Filters" : "No Clinical Notes Yet"} description={filtered ? "We couldn’t find any records matching your current search or filter criteria." : isDoctor ? "Start documenting your patient’s care journey. Add clinical notes to capture assessments, observations and important updates." : "Your released care reports will appear here."} action={filtered ? <button className="button secondary" type="button" onClick={() => { setSearch(""); setFilter("all"); setCareRecordsClinicianFilter("all"); }}>Clear Filters</button> : isDoctor ? <button className="button primary" type="button" onClick={() => setDialog({ kind: "note" })}><Plus size={17}/>Add Clinical Note</button> : undefined}/></div>;
        }
        return (<div className="care-records-table-wrap desktop-care-records"><table className="data-table care-records-table"><thead><tr><th scope="col">Date</th><th scope="col">Patient</th><th scope="col">Record Type</th><th scope="col">Title / Summary</th><th scope="col">Clinician</th><th scope="col">Linked Visit</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{careRecords.map((record) => <tr key={record.id}><td><strong>{date(record.createdAt)}</strong><small>{time(record.createdAt)}</small></td><td><div className="person table-person"><Avatar name={record.patient}/><div><strong>{record.patient}</strong><small>{record.patientCode}</small></div></div></td><td><Badge tone={recordTypeTone(record)}>{record.recordType}</Badge></td><td><strong>{record.title}</strong><small>{record.summary}</small></td><td><strong>{record.clinician}</strong>{record.specialty && <small>{record.specialty}</small>}</td><td><small>{record.linkedVisit}</small></td><td><Badge tone={statusTone(record)}>{record.status}</Badge></td><td><div className="row-actions detail-actions">{renderRecordAction(record)}</div></td></tr>)}</tbody></table></div>);
    }
    function renderCareRecordCards() {
        return careRecords.length ? (<div className="care-record-cards compact-care-records">{careRecords.map((record) => <article className="care-record-card" key={record.id}><div className="care-record-card-main"><Avatar name={record.patient}/><div><strong>{record.patient}</strong><small>{record.patientCode}</small></div></div><div className="care-record-card-title"><strong>{record.title}</strong><small>{date(record.createdAt)} · {time(record.createdAt)}</small></div><div className="care-record-card-tags"><Badge tone={recordTypeTone(record)}>{record.recordType}</Badge><Badge tone={statusTone(record)}>{record.status}</Badge></div><div className="care-record-card-actions">{renderRecordAction(record)}</div></article>)}</div>) : null;
    }
    const chartDays = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * 86400000));
    const chartScheduled = chartDays.map((day) => data.appointments.filter((a) => dayKey(a.starts_at) === dayKey(day.toISOString()) &&
        a.status !== "cancelled").length);
    const chartCompleted = chartDays.map((day) => data.appointments.filter((a) => dayKey(a.starts_at) === dayKey(day.toISOString()) &&
        a.status === "completed").length);
    const chartMax = Math.max(4, ...chartScheduled, ...chartCompleted);
    const chartTotal = chartScheduled.reduce((a, b) => a + b, 0);
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
            .filter((n) => n.roles.includes(u.role) && (n.id !== "physio" || isPatient || u.specialty === "physiotherapist") && (n.id !== "billing" || !isDoctor || u.specialty === "physiotherapist"))
            .map((n) => (<button key={n.id} className={tab === n.id ? "active" : ""} onClick={() => navigate(n.id)}>
                <n.icon size={19}/>
                {n.label}
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
            <Avatar name={u.name} avatar={u.avatar}/>
            <div>
              <strong>{u.name}</strong>
              <small>{roleLabel}</small>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (<button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobile(false)}/>)}
      <div className="main-shell">
        <header className={"topbar " + (tab === "overview" ? "overview-topbar" : "")}>
          <div className="breadcrumb">
            <button className="icon-button mobile-menu" onClick={() => setMobile(true)} aria-label="Open navigation">
              <Menu size={22}/>
            </button>
            <span>Workspace</span>
            <ChevronRight size={14}/>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
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
            <Avatar name={u.name} size="small" avatar={u.avatar}/>
            <button className="workspace-logout" disabled={signingOut} onClick={() => setConfirmLogout(true)}>
              <LogOut size={16} aria-hidden="true" />
              <span>{signingOut ? "Logging out…" : "Log out"}</span>
            </button>
          </div>
        </header>
        <main className={"main-content " + (tab === "overview" ? "overview-content" : tab === "records" ? "care-records-content" : "")}>
          {tab !== "records" && <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "overview"
            ? "A NEW DAY. A LITTLE MORE PROGRESS."
            : "MINDSPINE / " + roleLabel.toUpperCase()}
              </div>
              <h1>
                {tab === "overview"
            ? `Good ${now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening"}, ${isDoctor ? "Dr. " : ""}${name}`
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
                    : tab === "billing"
                            ? "Clear invoices and a complete payment history."
                            : tab === "reports"
                                ? "Your care and clinic insights, ready when you need them."
                                : tab === "team"
                                    ? "The right people, with the right access."
                                    : tab === "notifications"
                                        ? "Your appointments, reports, and clinic updates."
                                        : tab === "physio"
                                            ? "Track progress, plan rehabilitation, and manage follow-ups."
                                            : "Make your workspace work for you."}
              </p>
            </div>
            <div className="heading-actions">
              {!isPatient && (tab === "overview" || tab === "patients") && <button className="button primary" onClick={() => setDialog({kind:"user",role:"patient"})}><Plus size={17}/>Add Patient</button>}
              {isAdmin && tab === "team" ? (<button className="button primary" onClick={() => setDialog({ kind: "user" })}>
                  <Plus size={17}/>
                  Add User
                </button>) : tab === "patients" ? (isDoctor && (<a className="button secondary" href="/api/export">
                    <Download size={17}/>
                    Export Excel
                  </a>)) : (["overview", "appointments"].includes(tab) && (<>
                    <button className="button secondary" onClick={() => isPatient
                ? navigate("records")
                : (setSlotsShown(10), setDialog({ kind: "schedule" }))}>
                      <CalendarDays size={16}/>
                      {isPatient ? "My Care Records" : "Manage Availability"}
                    </button>
                    <button className="button primary" onClick={() => openBook()}>
                      <Plus size={18}/>
                      {isPatient ? "Book a Visit" : "New Appointment"}
                    </button>
                  </>))}
            </div>
          </div>}
          {toast && !dialog && (<div role={toast.ok ? "status" : "alert"} className={"toast " + (toast.ok ? "success" : "error")}>
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
                <div className="panel people-shortcut"><span className="icon-tile"><Users size={23}/></span><div><h2>Patients</h2><p>{data.patients.length} registered · Keep your patient directory up to date.</p><button className="text-button" onClick={() => navigate("patients")}>View Patients <ArrowRight size={14}/></button></div><button className="button primary" onClick={() => setDialog({kind:"user",role:"patient"})}><Plus size={16}/>Register Patient</button></div>
                <div className="panel people-shortcut"><span className="icon-tile"><HeartPulse size={23}/></span><div><h2>Clinical team</h2><p>{data.users.filter(person => person.role === "practitioner").length} registered · Grow your clinic’s care team.</p><button className="text-button" onClick={() => navigate("team")}>View Team <ArrowRight size={14}/></button></div><button className="button primary" onClick={() => setDialog({kind:"user",role:"practitioner"})}><Plus size={16}/>Add Clinician</button></div>
              </section>}
              <div className="stats-grid">
                {[
                {
                    label: isPatient
                        ? "Upcoming Visits"
                        : "Today’s Appointments",
                    value: isPatient
                        ? upcoming.length
                        : todayAppointments.length,
                    sub: isPatient
                        ? "Your time to focus on you"
                        : todayAppointments.length ? `${todayAppointments.filter((a) => a.status === "completed").length} completed today` : "No appointments today",
                    icon: CalendarDays,
                    color: "mint",
                },
                {
                    label: isPatient
                        ? "Completed Visits"
                        : "Patients in Your Care",
                    value: isPatient ? completed.length : data.patients.length,
                    sub: isPatient
                        ? "Every visit is progress"
                        : "Connected through MindSpine",
                    icon: Users,
                    color: "blue",
                },
                {
                    label: isAdmin
                        ? "Payments Received"
                        : isPatient
                            ? "Care Reports"
                            : "Clinical Records",
                    value: isAdmin ? money(collected) : isPatient ? data.notes.length : allCareRecords,
                    sub: isAdmin
                        ? "Recorded payments · all time"
                        : isPatient
                            ? "Your care, clearly documented"
                            : `${data.notes.filter((n) => n.published).length} of ${data.notes.length} notes released to patients`,
                    icon: isAdmin ? CreditCard : ClipboardList,
                    color: "peach",
                },
                {
                    label: isDoctor
                        ? "Upcoming Appointments"
                        : "Outstanding Balance",
                    value: isDoctor ? upcoming.length : money(outstanding),
                    sub: isDoctor
                        ? "Planned visits ahead"
                        : "Pay directly at the clinic",
                    icon: isDoctor ? CalendarCheck : CreditCard,
                    color: "lavender",
                },
            ].map((stat) => (<article className={"stat-card " + stat.color} key={stat.label}>
                    <div className="stat-top">
                      <span className={"stat-icon " + stat.color}>
                        <stat.icon size={19}/>
                      </span>
                      <span>{stat.label}</span>
                      <button type="button" className="stat-arrow" aria-label={stat.label + " details"} onClick={() => { if (stat.label.toLowerCase().includes("appointment") || stat.label.toLowerCase().includes("visit")) { navigate("appointments"); if (stat.label.toLowerCase().includes("upcoming")) setFilter("upcoming"); } else if (stat.label.includes("Patient")) { navigate("patients"); } else { navigate("records"); } }}>
                        <ArrowRight size={15}/>
                      </button>
                    </div>
                    <strong className="stat-number">{stat.value}</strong>
                    <small>{stat.sub}</small>
                    <svg className="stat-sparkline" viewBox="0 0 96 42" aria-hidden="true" focusable="false">
                      <path d="M4 31 C16 28 19 17 31 18 C43 19 43 35 56 35 C70 35 69 7 82 7 C91 7 91 23 94 25" />
                    </svg>
                  </article>))}
              </div>
              <div className="overview-grid">
                <div className="overview-primary">
                  <section className="welcome-banner">
                    <div>
                      <span className="eyebrow">
                        {isPatient
                ? "YOUR WELL-BEING, AT THE CENTER"
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
                ? "Find Your Next Appointment"
                : "Explore Your Patients"}
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
                ? "Your Upcoming Visits"
                : "Today’s Appointments"} description={isPatient
                ? "A little time, just for your well-being."
                : `${todayAppointments.length} visits on the calendar · All times in IST`} action="View All" onClick={() => { navigate("appointments"); if (isPatient) setFilter("upcoming"); }}/>
                    {(isPatient ? upcoming : todayAppointments).slice(0, 5).length ? <>{renderAppointmentList({
                items: (isPatient ? upcoming : todayAppointments).slice(0, 5),
                compact: true,
            })}{renderAppointmentCards((isPatient ? upcoming : todayAppointments).slice(0, 5))}</> : (<div className="schedule-empty-state">
                      <CalendarCheck size={34}/>
                      <h3>A little breathing room</h3>
                      <p>No appointments match this view. Book a visit or adjust your filters.</p>
                      <button className="button primary" onClick={() => openBook()}>Book an Appointment <Plus size={14}/></button>
                    </div>)}
                    <div className="panel-foot">
                      <span>
                        <span className="live-dot"/> Your schedule is up to
                        date
                      </span>
                      <button className="text-button" onClick={() => openBook()}>
                        Book an Appointment <Plus size={14}/>
                      </button>
                    </div>
                  </section>
                  <section className="panel">
                    <SectionHead title={isPatient ? "Your Care Journey" : "Appointment Activity"} description="A look at the last seven days"/>
                    <div className="activity-chart">
                      {chartTotal === 0 ? (<div className="activity-empty-state">
                        <BarChart3 size={34}/>
                        <strong>No activity yet</strong>
                        <p>When you have appointments, we'll show your scheduled and completed visits here.</p>
                      </div>) : (<>
                        <div className="chart-bars">
                          {chartDays.map((d, i) => (<div className="bar-column" key={i}>
                              <div className="bar-pair">
                                <div className="bar-values" aria-label={`Scheduled: ${chartScheduled[i]}, completed: ${chartCompleted[i]}`}>
                                  <span>{chartScheduled[i]}</span>
                                  <span>{chartCompleted[i]}</span>
                                </div>

                                <div className={"bar scheduled " + (i === 6 ? "current" : "")} style={{
                        height: Math.max(3, (chartScheduled[i] / chartMax) * 100) + "%",
                    }}/>
                                <div className="bar completed" style={{
                        height: Math.max(3, (chartCompleted[i] / chartMax) * 100) + "%",
                    }}/>
                              </div>
                              <small>
                                {date(d.toISOString(), { weekday: "short" })}
                              </small>
                            </div>))}
                        </div>
                        <div className="chart-caption">
                          <span>
                            <i /> Scheduled visits <em /> Completed Visits
                          </span>
                          <strong>
                            {chartTotal}{" "}
                            <small>scheduled this week</small>
                          </strong>
                        </div>
                      </>)}
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
                    <SectionHead title="Quick Actions"/>
                    {[
                {
                    label: "Book an Appointment",
                    sub: "Make time for better health",
                    icon: CalendarDays,
                    fn: () => openBook(),
                },
                {
                    label: isDoctor
                        ? "Add a Clinical Record"
                        : "View Your Reports",
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
                        ? "Manage Your Team"
                        : isDoctor
                            ? "Export Patient Data"
                            : "View Billing",
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
          {tab === "appointments" && (<section className="refined-screen appointments-screen">
              <div className="refined-list-tools"><div className="tabs refined-tabs">{[["all", "All (" + data.appointments.length + ")"], ["upcoming", "Upcoming (" + data.appointments.filter((a) => a.status === "confirmed" && new Date(a.starts_at) > now).length + ")"], ["overdue", "Overdue (" + data.appointments.filter(isOverdue).length + ")"], ["completed", "Completed (" + data.appointments.filter((a) => a.status === "completed").length + ")"], ["cancelled", "Cancelled (" + data.appointments.filter((a) => a.status === "cancelled").length + ")"]].map(([value, label]) => (<button className={filter === value ? "selected" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>))}</div><div className="search-filter-group"><SearchInput value={search} onChange={setSearch} placeholder="Search by patient, email, clinician, service or date…"/></div></div>
              {renderAppointmentCards(appts)}
              {renderAppointmentList({ items: appts })}
            </section>)}
          {tab === "patients" && (<section className="refined-screen patients-screen">
              <div className="patients-search-row"><SearchInput value={search} onChange={setSearch} placeholder="Search patients by name, email or phone number..."/></div>
              {renderPatientCards(filteredPatients)}
              {filteredPatients.length ? (<div className="table-scroll refined-table-scroll desktop-list"><table className="data-table patients-table"><thead><tr><th>Patient</th><th>Contact</th><th>Visit Summary</th><th>Next Appointment</th><th>Actions</th></tr></thead><tbody>{filteredPatients.map((p) => { const next = patientNextAppointment(p.id); const completedCount = patientCompletedVisits(p.id); return <tr key={p.id}><td><div className="person table-person"><Avatar name={p.name}/><div><strong>{p.name}</strong><small>{patientCode(p)}</small></div></div></td><td><strong>{p.email}</strong><small>{p.phone || "No phone number recorded"}</small></td><td><span className="service-cell"><CalendarDays size={18}/><span><strong>{completedCount} completed {completedCount === 1 ? "visit" : "visits"}</strong><small>{next ? "Next visit scheduled" : "No upcoming visit"}</small></span></span></td><td><strong>{next ? date(next.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "-"}</strong><small>{next ? time(next.starts_at) : "No upcoming visit"}</small></td><td><div className="row-actions detail-actions patient-row-menu"><button className="view-row-button" type="button" onClick={() => setDialog({ kind: "patient", patient: p })}><FileText size={16}/>View patient</button><button className="kebab-button" type="button" aria-haspopup="menu" aria-expanded={openPatientMenu === p.id} onClick={(e) => { if (openPatientMenu === p.id) { setOpenPatientMenu(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setPatientMenuPos({ top: rect.bottom + 6, left: rect.right - 180 }); setOpenPatientMenu(p.id); }}>⋮</button>{openPatientMenu === p.id && patientMenuPos && <><div className="row-menu-backdrop" onClick={() => setOpenPatientMenu(null)}/><div className="row-menu-dropdown" role="menu" style={{ top: patientMenuPos.top, left: patientMenuPos.left }}><button type="button" role="menuitem" onClick={() => { setOpenPatientMenu(null); setDialog({ kind: "patient", patient: p }); }}><FileText size={15}/>View Patient</button><button type="button" role="menuitem" className="danger" onClick={() => { setOpenPatientMenu(null); setDeletePatientTarget({ id: p.id, name: p.name }); }}><Trash2 size={15}/>Delete Patient</button></div></>}</div></td></tr>; })}</tbody></table></div>) : null}
            </section>)}
          {tab === "physio" && <PhysioWorkflow data={data} pending={pending} onSave={payload => { setToast(null); return new Promise<boolean>(resolve => { start(async () => { const result = await mutate("physio", payload); setToast(result); if (result.ok) router.refresh(); resolve(result.ok); }); }); }} onDeleteRecord={id=>action("deletePhysioRecord",{id},false)} onEvaluation={()=>setDialog({kind:"note"})} onHistory={patient=>setDialog({kind:"patient",patient})} onBook={()=>openBook()} onBilling={()=>navigate("billing")}/>}
          {tab === "records" && (<section className="care-records-screen redesigned-care-records">
              <div className="care-records-hero"><div><span className="screen-eyebrow">MindSpine / {roleLabel}</span><h2>Care Records</h2><p>Thoughtful documentation. Better continuity of care.</p></div><div className="screen-actions">{isDoctor && <button className="button primary" type="button" onClick={() => setDialog({ kind: "note" })}><Plus size={17}/>Add Clinical Note</button>}{isDoctor && <button className="button secondary" type="button" onClick={() => { setUploadDefaultPatientId(undefined); setShowUploadPanel(true); }}><Upload size={17}/>Upload Document</button>}</div></div>
              <div className="tabs refined-tabs care-record-tabs">{[["all", "All Records (" + allCareRecords + ")"], ["documents", "Documents (" + careCounts.documents + ")"]].map(([value, label]) => <button key={value} type="button" className={recordFilter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
              <div className="care-records-filterbar"><SearchInput value={search} onChange={setSearch} placeholder="Search patients, records, or keywords..."/><select aria-label="Record Type" value={recordFilter} onChange={(e) => setFilter(e.target.value)}><option value="all">Record Type</option><option value="clinical">Clinical Notes</option><option value="progress">Progress Sheets</option><option value="draft">Draft Notes</option><option value="published">Published Notes</option><option value="documents">Documents</option></select><select aria-label="Clinician" value={careRecordsClinicianFilter} onChange={(e) => setCareRecordsClinicianFilter(e.target.value)}><option value="all">Clinician</option>{data.practitioners.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
              <div className="care-summary-grid">{[{label:"Draft Notes",value:careCounts.draft,icon:FileText,filter:"draft"},{label:"Published Notes",value:careCounts.published,icon:Check,filter:"published"},{label:"Clinical Notes",value:careCounts.clinical,icon:ClipboardList,filter:"clinical"},{label:"Patient Documents",value:careCounts.documents,icon:Paperclip,filter:"documents"}].map((card) => <button className="care-summary-card" type="button" key={card.label} onClick={() => setFilter(card.filter)}><span className="summary-icon"><card.icon size={22}/></span><span><small>{card.label}</small><strong>{card.value}</strong></span><ChevronRight size={18}/></button>)}</div>
              <section className="panel care-records-panel"><div className="care-panel-head"><h3>Care Records</h3><small>{careRecords.length} shown</small></div>{renderCareRecordCards()}{renderCareRecordsTable()}</section>
              <div className="care-records-bottom"><section className="panel recent-documents-card"><SectionHead title="Recent Patient Documents" action="View All" onClick={() => setDialog({ kind: "documentsLibrary" })}/>{recentDocuments.length ? <div className="recent-document-grid">{recentDocuments.map((f) => { const patient = patientById(f.patient_id); return <a className="recent-document-row" key={f.id} href={"/api/files?id=" + f.id + "&download=1"}><FileText size={20}/><span><strong>{f.name}</strong><small>{patient?.name || "Patient"} · {date(f.created_at)} · {Math.max(1, Math.round(f.size / 1024))} KB</small></span><Download size={16}/></a>; })}</div> : <Empty title="No patient documents yet" description="Uploaded reports, scans and supporting files will appear here."/>}</section><aside className="care-promo-card" aria-hidden="true"><h3>Care starts with<br/>a conversation</h3><p>Add a Clinical Note after a consultation to build the patient’s care history.</p></aside></div>
            </section>)}
          {tab === "billing" && (() => {
              const billingInvoices = data.invoices.filter((invoice) => matches(`${invoice.id} ${invoice.patient} ${invoice.service}`) && (billingStatusFilter === "all" || invoice.status === billingStatusFilter) && (billingServiceFilter === "all" || invoice.service === billingServiceFilter));
              const billingServices = Array.from(new Set(data.invoices.map((invoice) => invoice.service))).sort();
              const unpaidCount = data.invoices.filter((invoice) => invoice.status === "unpaid").length;
              const paidCount = data.invoices.filter((invoice) => invoice.status === "paid").length;
              const refundedCount = data.invoices.filter((invoice) => invoice.status === "refunded").length;
              const recordedPaymentsCount = data.invoices.filter((invoice) => invoice.status === "paid" && invoice.payment_reference).length;
              return <section className="billing-screen refined-screen">
                <div className="billing-metrics">
                  <article><span><FileText size={22}/></span><small>OUTSTANDING</small><strong>{money(outstanding)}</strong><p>{unpaidCount} unpaid invoices</p></article>
                  <article><span><Check size={22}/></span><small>TOTAL PAID</small><strong>{money(collected)}</strong><p>{paidCount} invoices paid</p></article>
                  <article><span><ClipboardList size={22}/></span><small>REFUNDED</small><strong>{refundedCount}</strong><p>Invoices refunded</p></article>
                  <article><span><CreditCard size={22}/></span><small>OFFLINE PAYMENTS RECORDED</small><strong>{recordedPaymentsCount}</strong><p>Total payments in clinic</p></article>
                </div>
                <article className="billing-mobile-notice">
                  <ShieldCheck size={24}/>
                  <div><strong>Pay at your next visit</strong><p>Online payments are not connected. Your clinic can record payments made in person.</p></div>
                </article>
                <section className="billing-invoices-panel">
                  <div className="billing-panel-head">
                    <div><h3>Invoices</h3><p>All amounts in Indian rupees</p></div>
                    <div className="billing-filterbar">
                      <label className="billing-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by patient name..."/></label>
                      <select aria-label="Filter by status" value={billingStatusFilter} onChange={(event) => setBillingStatusFilter(event.target.value)}><option value="all">All Status</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="void">Void</option><option value="refunded">Refunded</option></select>
                      <select aria-label="Filter by service" value={billingServiceFilter} onChange={(event) => setBillingServiceFilter(event.target.value)}><option value="all">All Services</option>{billingServices.map((service) => <option key={service} value={service}>{service}</option>)}</select>
                      <button type="button" className="button secondary" onClick={() => { setSearch(""); setBillingStatusFilter("all"); setBillingServiceFilter("all"); }}><SlidersHorizontal size={17}/>Clear</button>
                    </div>
                  </div>
                  <div className="billing-table-wrap desktop-list">
                    <table className="billing-table">
                      <thead><tr><th>Invoice No.</th>{!isPatient && <th>Patient</th>}<th>Visit / Service</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {billingInvoices.map((invoice) => (<tr key={invoice.id} className={invoice.status === "unpaid" ? "needs-payment" : ""}>
                          <td><strong>{invoice.id.toUpperCase()}</strong><small>{date(invoice.created_at, { day: "numeric", month: "short", year: "numeric" })}</small></td>
                          {!isPatient && <td>{invoice.patient}</td>}
                          <td>{invoice.service}</td>
                          <td>{date(invoice.created_at, { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="amount">{money(invoice.amount)}</td>
                          <td><Badge tone={invoice.status}>{invoice.status}</Badge></td>
                          <td><div className="billing-row-actions">
                            {invoice.status === "paid" ? <span className="paid-reference"><CreditCard size={15}/>{invoice.payment_reference || "Paid in clinic"}</span> : (!isPatient && invoice.status === "unpaid") ? <button type="button" className="mark-paid-button" onClick={() => setDialog({ kind: "invoice", id: invoice.id, refund: false })}><CreditCard size={15}/>Mark as Paid</button> : <span className="mark-paid-button disabled"><CreditCard size={15}/>Mark as Paid</span>}
                            <a className="icon-button" title="Download invoice PDF" href={"/api/reports?id=" + invoice.id + "&type=invoice"} target="_blank" rel="noreferrer"><Download size={16}/><span className="sr-only">Download invoice {invoice.id}</span></a>
                            <button type="button" className="icon-button" title="Email this invoice to the patient" onClick={() => setDialog({ kind: "shareRecord", recordType: "invoice", channel: "email", id: invoice.id, patientName: invoice.patient, email: patientById(invoice.patient_id)?.email || "", phone: patientById(invoice.patient_id)?.phone || "" })}><Mail size={16}/><span className="sr-only">Email invoice {invoice.id}</span></button>
                            <button type="button" className="icon-button" title="Share this invoice via WhatsApp" onClick={() => setDialog({ kind: "shareRecord", recordType: "invoice", channel: "whatsapp", id: invoice.id, patientName: invoice.patient, email: patientById(invoice.patient_id)?.email || "", phone: patientById(invoice.patient_id)?.phone || "" })}><MessageCircle size={16}/><span className="sr-only">Share invoice {invoice.id} via WhatsApp</span></button>
                          </div></td>
                        </tr>))}
                      </tbody>
                    </table>
                  </div>
                  <div className="billing-card-list compact-list">
                    {billingInvoices.map((invoice) => (<article className="billing-card" key={invoice.id}>
                      <div><strong>{invoice.id.toUpperCase()}</strong><small>{invoice.patient}</small><small>{invoice.service}</small></div>
                      <span className="billing-card-date">{date(invoice.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
                      <strong className="billing-card-amount">{money(invoice.amount)}</strong>
                      <Badge tone={invoice.status}>{invoice.status}</Badge>
                      <a className="billing-card-download" title="Download invoice PDF" href={"/api/reports?id=" + invoice.id + "&type=invoice"} target="_blank" rel="noreferrer"><Download size={15}/>Download<span className="sr-only"> invoice {invoice.id}</span></a>
                      <button type="button" className="billing-card-email" title="Email this invoice to the patient" onClick={() => setDialog({ kind: "shareRecord", recordType: "invoice", channel: "email", id: invoice.id, patientName: invoice.patient, email: patientById(invoice.patient_id)?.email || "", phone: patientById(invoice.patient_id)?.phone || "" })}><Mail size={15}/>Email</button>
                      <button type="button" className="billing-card-whatsapp" title="Share this invoice via WhatsApp" onClick={() => setDialog({ kind: "shareRecord", recordType: "invoice", channel: "whatsapp", id: invoice.id, patientName: invoice.patient, email: patientById(invoice.patient_id)?.email || "", phone: patientById(invoice.patient_id)?.phone || "" })}><MessageCircle size={15}/>WhatsApp</button>
                      {!isPatient && invoice.status === "unpaid" && <button type="button" className="compact-paid-action" onClick={() => setDialog({ kind: "invoice", id: invoice.id, refund: false })}><CreditCard size={15}/>Mark as Paid</button>}
                    </article>))}
                  </div>
                  {!billingInvoices.length && (data.invoices.length ? <Empty icon={Search} title="No Invoices Match Your Filters" description="We couldn't find any invoices matching your current search or filter criteria." action={<button className="button secondary" type="button" onClick={() => { setSearch(""); setBillingStatusFilter("all"); setBillingServiceFilter("all"); }}>Clear Filters</button>}/> : <Empty title="All clear" description="Your invoices will appear here after you book a visit."/>)}
                </section>
              </section>;
            })()}
          {tab === "reports" && (() => {
              const cancelledCount = data.appointments.filter((appointment) => appointment.status === "cancelled").length;
              const overdueCount = data.appointments.filter(isOverdue).length;
              const totalVisitCount = completed.length + upcoming.length + overdueCount + cancelledCount;
              const monthBuckets = Array.from({ length: trendMonths }, (_, index) => {
                const month = new Date(now.getFullYear(), now.getMonth() - (trendMonths - 1) + index, 1);
                const count = data.appointments.filter((appointment) => {
                  const visitDate = new Date(appointment.starts_at);
                  return appointment.status === "completed" && visitDate.getFullYear() === month.getFullYear() && visitDate.getMonth() === month.getMonth();
                }).length;
                const spansYearBoundary = month.getFullYear() !== now.getFullYear();
                const label = new Intl.DateTimeFormat("en-IN", spansYearBoundary ? { month: "short", year: "2-digit" } : { month: "short" }).format(month);
                return { label, count };
              });
              const maxTrend = Math.max(1, ...monthBuckets.map((bucket) => bucket.count));
              const recentReports = [
                ...data.notes.map((note) => ({ id: "note-" + note.id, name: "Clinical Summary - " + note.patient, type: "Clinical Report", createdAt: note.created_at, by: note.practitioner, href: "/api/reports?id=" + note.id + "&type=note", note })),
                ...data.invoices.map((invoice) => ({ id: "invoice-" + invoice.id, name: "Billing Summary - " + invoice.patient, type: "Invoice PDF", createdAt: invoice.created_at, by: isPatient ? invoice.patient : (data.appointments.find((a) => a.id === invoice.appointment_id)?.practitioner || "Clinic staff"), href: "/api/reports?id=" + invoice.id + "&type=invoice", note: undefined as ClinicalNote | undefined })),
              ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);
              const statusItems = [
                { label: "Completed", count: completed.length, color: "#007a5d", filter: "completed" },
                { label: "Upcoming", count: upcoming.length, color: "#ffc247", filter: "upcoming" },
                { label: "Overdue", count: overdueCount, color: "#d9534f", filter: "overdue" },
                { label: "Cancelled", count: cancelledCount, color: "#ff8a73", filter: "cancelled" },
              ];
              const completedPct = totalVisitCount ? Math.round(completed.length / totalVisitCount * 100) : 0;
              const upcomingPct = totalVisitCount ? Math.round(upcoming.length / totalVisitCount * 100) : 0;
              const overduePct = totalVisitCount ? Math.round(overdueCount / totalVisitCount * 100) : 0;
              const cancelledPct = totalVisitCount ? Math.max(0, 100 - completedPct - upcomingPct - overduePct) : 0;
              const ReportActions = ({ report }: { report: typeof recentReports[number] }) => <div className="report-row-menu">{report.note && <button type="button" className="icon-button" aria-label={"View " + report.name} onClick={() => setDialog({ kind: "clinicalRecord", note: report.note! })}><FileText size={17}/></button>}<a href={report.href} target="_blank" rel="noreferrer" aria-label={"Download " + report.name}><Download size={17}/></a></div>;
              return <section className="reports-screen refined-screen">
                <div className="reports-hero-leaves" aria-hidden="true" />
                <div className="reports-top-grid">
                  <article className="report-feature-card"><span className="report-feature-icon mint"><FileText size={26}/></span><div><h3>Clinical reports</h3><p>Download printable PDF summaries of clinical records and treatment plans.</p></div><button className="button primary" onClick={() => navigate("records")}>View reports <ArrowRight size={16}/></button></article>
                  {!isPatient && <article className="report-feature-card"><span className="report-feature-icon blue"><Download size={26}/></span><div><h3>Excel export</h3><p>Download your customised patient list, appointments and clinical records.</p></div><a className="button secondary" href="/api/export">Download workbook <Download size={16}/></a></article>}
                  <article className="report-feature-card care-glance-card"><span className="report-feature-icon peach"><TrendingUp size={26}/></span><div><h3>Care at a glance</h3></div>{statusItems.map((item) => <button type="button" className="glance-row" key={item.label} onClick={() => { navigate("appointments"); setFilter(item.filter); }}><span>{item.label} visits</span><strong>{item.count}</strong><ChevronRight size={17}/></button>)}</article>
                </div>
                <div className="reports-chart-grid">
                  <section className="reports-panel trend-panel"><div className="reports-panel-head"><div><h3>Visits Trend</h3><p>Total completed visits over the last {trendMonths} months.</p></div><select aria-label="Trend range" value={trendMonths} onChange={(e) => setTrendMonths(Number(e.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div><div className="trend-chart">{monthBuckets.map((bucket, i) => <div className="trend-column" key={bucket.label + i}><div className="trend-bar-wrap" style={{ height: Math.max(10, bucket.count / maxTrend * 100) + "%" }}><strong className="trend-value">{bucket.count}</strong><span className="trend-bar"/></div><small>{bucket.label}</small></div>)}</div></section>
                  <section className="reports-panel distribution-panel"><div className="reports-panel-head"><div><h3>Visit Status Distribution</h3><p>Overview of all scheduled visits.</p></div></div><div className="distribution-content"><div className="donut-chart" style={{ background: totalVisitCount ? "conic-gradient(#007a5d 0 " + completedPct + "%, #ffc247 " + completedPct + "% " + (completedPct + upcomingPct) + "%, #d9534f " + (completedPct + upcomingPct) + "% " + (completedPct + upcomingPct + overduePct) + "%, #ff8a73 " + (completedPct + upcomingPct + overduePct) + "% 100%)" : "#e3e8e3" }}><span><strong>{totalVisitCount}</strong><small>Total Visits</small></span></div><div className="distribution-legend">{statusItems.map((item, index) => { const pct = [completedPct, upcomingPct, overduePct, cancelledPct][index]; return <div key={item.label}><i style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{item.count}</strong><small>{pct}%</small></div>; })}</div></div></section>
                </div>
                <section className="reports-panel recent-reports-panel"><div className="reports-panel-head"><div><h3>Recent Reports</h3><p>Your recently generated and downloaded reports.</p></div><button type="button" className="button secondary" onClick={() => navigate("records")}>View All Reports <ArrowRight size={16}/></button></div>{recentReports.length ? <><div className="recent-reports-table desktop-list"><table><thead><tr><th>Report Name</th><th>Type</th><th>Date Generated</th><th>Generated By</th><th>Actions</th></tr></thead><tbody>{recentReports.map((report) => <tr key={report.id}><td><FileText size={16}/><span>{report.name}</span></td><td><Badge tone={report.type.includes("Clinical") ? "confirmed" : "paid"}>{report.type}</Badge></td><td>{date(report.createdAt, { day: "numeric", month: "short", year: "numeric" })}, {time(report.createdAt)}</td><td>{report.by}</td><td><ReportActions report={report}/></td></tr>)}</tbody></table></div><div className="recent-report-cards compact-list">{recentReports.map((report) => <div className="recent-report-card" key={report.id}><FileText size={20}/><span><strong>{report.name}</strong><small>{report.type} · {date(report.createdAt, { day: "numeric", month: "short", year: "numeric" })}</small></span><ReportActions report={report}/></div>)}</div></> : <Empty icon={FileText} title="No Reports Yet" description="Clinical summaries and billing exports will appear here once generated."/>}</section>
              </section>;
            })()}
          {tab === "team" && (<section className="panel">
              <SectionHead title="People & permissions" description="Administrators have operational access. Clinical Records stay with the care team."/>
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
          {tab === "notifications" && (() => {
              const notificationKind = (item: typeof data.notifications[number]) => {
                const text = (item.title + " " + item.message).toLowerCase();
                if (text.includes("appointment") || text.includes("schedule") || text.includes("visit")) return "appointments";
                if (text.includes("report") || text.includes("clinical") || text.includes("care record")) return "reports";
                return "system";
              };
              const filteredNotifications = data.notifications.filter((item) => (notificationCategory === "all" || notificationKind(item) === notificationCategory) && (notificationTimeFilter === "all" || (notificationTimeFilter === "unread" ? !item.is_read : item.is_read)));
              const notificationTabs = [["all", "All"], ["appointments", "Appointments"], ["reports", "Reports"], ["system", "System Updates"]];
              return <section className="notifications-screen refined-screen"><div className="settings-leaf-accent" aria-hidden="true" /><div className="notifications-toolbar"><div className="notification-tabs">{notificationTabs.map(([value, label]) => <button type="button" key={value} className={notificationCategory === value ? "selected" : ""} onClick={() => setNotificationCategory(value)}>{label}</button>)}</div><div className="notification-tools"><select value={notificationTimeFilter} onChange={(event) => setNotificationTimeFilter(event.target.value)} aria-label="Notification read filter"><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select><button className="text-button" disabled={pending} onClick={() => action("read", { id: "" }, false)}><Check size={16}/>Mark all as read</button></div></div><section className="notifications-list-card">{filteredNotifications.length ? filteredNotifications.map((item) => { const kind = notificationKind(item); const Icon = kind === "reports" ? FileText : kind === "system" ? Settings : CalendarDays; return <article className={"notification-item " + (!item.is_read ? "unread" : "")} key={item.id} role={!item.is_read ? "button" : undefined} tabIndex={!item.is_read ? 0 : undefined} onClick={() => !item.is_read && action("read", { id: item.id }, false)} onKeyDown={(e) => { if (!item.is_read && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); action("read", { id: item.id }, false); } }}><span className={"notification-kind-icon " + kind}><Icon size={20}/></span><div><h3>{item.title}</h3><p>{item.message}</p><small>{date(item.created_at, { day: "numeric", month: "short", year: "numeric" })}, {time(item.created_at)}</small></div>{!item.is_read && <button type="button" className="icon-button" aria-label="Mark as read" onClick={(e) => { e.stopPropagation(); action("read", { id: item.id }, false); }}><ChevronRight size={18}/></button>}</article>; }) : <Empty title="You are all caught up" description="Your clinic updates will appear here."/>}</section></section>;
            })()}
          {tab === "settings" && (<section className="settings-screen refined-screen"><div className="settings-leaf-accent" aria-hidden="true" /><section className="settings-card personal-details-card"><div className="settings-card-head">{isPatient ? <span className="settings-card-icon mint"><Users size={26}/></span> : <div className="settings-avatar-control"><label className="settings-avatar-button" htmlFor="settings-avatar-input" title={u.avatar ? "Change profile picture" : "Add profile picture"}><Avatar name={u.name} avatar={u.avatar} size="large"/><span className="settings-avatar-edit-badge" aria-hidden="true"><Camera size={12}/></span></label><input id="settings-avatar-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarPending} onChange={e => { const file = e.target.files?.[0]; if (file) uploadAvatar(file); e.target.value = ""; }}/>{u.avatar && <button type="button" className="settings-avatar-remove-btn" aria-label="Remove profile picture" title="Remove profile picture" disabled={avatarPending} onClick={removeAvatar}><X size={11}/></button>}</div>}<div><h3>Personal details</h3><p>Keep your contact details up to date. This information is used across your account.</p>{!isPatient && avatarError && <small className="form-error">{avatarError}</small>}</div></div><form action={formAction("profile")}><label>Full name<input name="name" defaultValue={u.name} required maxLength={200}/></label><label>Email address<input value={u.email} disabled readOnly/><small className="muted">Contact your clinic administrator to change your email address.</small></label><label>Phone number<input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" defaultValue={u.phone} onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10); }}/></label>{isPatient ? <label>Medical history<textarea name="history" defaultValue={u.history} rows={4} maxLength={5000}/></label> : <input name="history" type="hidden" value={u.history}/>}<button className="button primary full" disabled={pending}>Save profile</button></form></section><section className="settings-card password-security-card"><div className="settings-card-head"><span className="settings-card-icon blue"><ShieldCheck size={26}/></span><div><h3>Password & security</h3><p>Change your password to keep your account secure.</p></div></div><form onSubmit={retainOnError("password")}><label>Current password<span className="password-field-wrap"><input type={passwordVisible.current ? "text" : "password"} name="current" autoComplete="current-password" placeholder="Enter your current password" required/><button type="button" className="password-toggle-btn" aria-label={passwordVisible.current ? "Hide password" : "Show password"} onClick={() => setPasswordVisible(v => ({ ...v, current: !v.current }))}>{passwordVisible.current ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label><label>New password<span className="password-field-wrap"><input type={passwordVisible.next ? "text" : "password"} name="next" autoComplete="new-password" minLength={8} maxLength={15} placeholder="Enter a new password" required onChange={e => { const confirmEl = e.currentTarget.form?.elements.namedItem("confirm") as HTMLInputElement | null; if (confirmEl && confirmEl.value) confirmEl.setCustomValidity(confirmEl.value === e.currentTarget.value ? "" : "Passwords do not match."); }}/><button type="button" className="password-toggle-btn" aria-label={passwordVisible.next ? "Hide password" : "Show password"} onClick={() => setPasswordVisible(v => ({ ...v, next: !v.next }))}>{passwordVisible.next ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label><small className="muted">Use at least 8 characters, including letters and numbers.</small><label>Confirm new password<span className="password-field-wrap"><input type={passwordVisible.confirm ? "text" : "password"} name="confirm" autoComplete="new-password" minLength={8} maxLength={15} placeholder="Confirm your new password" required onChange={e => { const nextEl = e.currentTarget.form?.elements.namedItem("next") as HTMLInputElement | null; e.currentTarget.setCustomValidity(nextEl && nextEl.value === e.currentTarget.value ? "" : "Passwords do not match."); }}/><button type="button" className="password-toggle-btn" aria-label={passwordVisible.confirm ? "Hide password" : "Show password"} onClick={() => setPasswordVisible(v => ({ ...v, confirm: !v.confirm }))}>{passwordVisible.confirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label><button className="button secondary full" disabled={pending}>Update password</button></form></section>{isAdmin && <section className="settings-card admin-settings-card"><SectionHead title="Clinic settings"/><form action={formAction("settings")}><label>Clinic name<input name="clinicName" defaultValue={data.settings.clinicName} required/></label><label>Address<input name="address" defaultValue={data.settings.address} required/></label><label>Patient cancellation notice in hours<input name="cancellationHours" type="number" min={0} max={168} defaultValue={data.settings.cancellationHours} required/></label><button className="button primary full" disabled={pending}>Save clinic settings</button></form></section>}</section>)}
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
      {dialog && (<Modal className={dialog.kind === "user" && dialog.role === "patient" ? "care-modal patient-create-modal" : dialog.kind === "book" ? "care-modal appointment-modal" : dialog.kind === "schedule" ? "care-modal availability-modal" : dialog.kind === "patient" || dialog.kind === "appointment" ? "care-modal detail-modal" : dialog.kind === "editPatient" ? "care-modal patient-edit-modal" : dialog.kind === "clinicalRecord" || dialog.kind === "documentsLibrary" || dialog.kind === "note" || dialog.kind === "progressEntry" ? "care-modal care-record-modal" : ""} title={dialog.kind === "book"
                ? dialog.appointment
                    ? "Reschedule your visit"
                    : "Book An Appointment"
                : dialog.kind === "note"
                    ? (dialog.note ? <>Edit Clinical Note <Badge tone={dialog.note.published ? "completed" : "unpaid"}>{dialog.note.published ? "Published" : "Draft"}</Badge></> : "Add a Clinical Note")
                    : dialog.kind === "clinicalRecord"
                        ? "Clinical Note"
                        : dialog.kind === "documentsLibrary"
                            ? "Patient Documents"
                    : dialog.kind === "progressEntry"
                        ? (dialog.index !== undefined ? "Edit Progress Entry" : "Add Progress Entry")
                    : dialog.kind === "patient"
                        ? "Patient Details"
                        : dialog.kind === "editPatient"
                            ? "Edit Patient"
                            : dialog.kind === "appointment"
                            ? "Appointment Details"
                            : dialog.kind === "invoice"
                            ? dialog.refund
                                ? "Record an offline refund"
                                : "Record an offline payment"
                            : dialog.kind === "user"
                                ? dialog.role === "patient" ? "Add a Patient" : dialog.role === "practitioner" ? "Add a Clinician" : "Add a Workspace User"
                                : dialog.kind === "cancel"
                                    ? "Cancel this appointment?"
                                    : dialog.kind === "reset"
                                        ? "Reset account password"
                                        : dialog.kind === "shareRecord"
                                            ? (dialog.channel === "email"
                                                ? (dialog.recordType === "invoice" ? "Email Invoice" : "Email Care Record")
                                                : (dialog.recordType === "invoice" ? "Share Invoice via WhatsApp" : "Share Care Record via WhatsApp"))
                                            : "Manage Availability"} subtitle={dialog.kind === "book"
                ? (dialog.appointment ? "Choose a new available date and time for this visit." : "Select a patient, choose an available date and time, and confirm your appointment.")
                : dialog.kind === "user" && dialog.role === "patient"
                    ? "Create a new patient profile to start their care journey."
                    : dialog.kind === "schedule"
                        ? "Set your available slots so patients can book appointments."
                        : dialog.kind === "note" && dialog.note
                            ? "Make changes to this clinical note and save."
                        : undefined} onClose={() => {
                if (!pending)
                    setDialog(null);
            }}>
          {toast && (<p className={toast.ok ? "form-success" : "form-error"} role={toast.ok ? "status" : "alert"}>
              {toast.message}
            </p>)}
          {dialog.kind === "book" && (<><form className="care-form appointment-form" action={(f) => {
                    const slotId = String(f.get("slotId") || selectedSlotId);
                    if (dialog.appointment)
                        action("appointment", {
                            id: dialog.appointment.id,
                            action: "reschedule",
                            slotId,
                        });
                    else if (bookReturnPatient) {
                        setToast(null);
                        start(async () => {
                            const result = await mutate("book", {
                                slotId,
                                patientId: String(f.get("patientId") || u.id),
                                service: String(f.get("service")),
                                reason: String(f.get("reason") || ""),
                            });
                            setToast(result);
                            if (result.ok) {
                                router.refresh();
                                setDialog({ kind: "patient", patient: bookReturnPatient });
                            }
                        });
                    }
                    else
                        action("book", {
                            slotId,
                            patientId: String(f.get("patientId") || u.id),
                            service: String(f.get("service")),
                            reason: String(f.get("reason") || ""),
                        });
                }}>
              {!dialog.appointment && !isPatient && (<div className="patient-combobox">
                  <label htmlFor="appointment-patient-search">Patient <span aria-hidden="true">*</span></label>
                  <div className="patient-search-wrap" role="combobox" aria-expanded="true" aria-controls="appointment-patient-options">
                    <Search size={18}/>
                    <input id="appointment-patient-search" type="search" value={patientQuery} onChange={(event) => { setPatientQuery(event.target.value); if (selectedPatient && event.target.value !== selectedPatient.name) setSelectedPatientId(""); }} placeholder="Search and select a patient..." autoComplete="off" />
                  </div>
                  <input type="hidden" name="patientId" value={selectedPatientId} required/>
                  <div className="patient-options" id="appointment-patient-options" role="listbox">
                    {(patientQuery || selectedPatientId ? (selectedPatient ? [selectedPatient, ...patientMatches.filter((patient) => patient.id !== selectedPatientId)] : patientMatches) : []).map((patient) => {
                      const selected = selectedPatientId === patient.id;
                      return <button key={patient.id} type="button" role="option" aria-selected={selected} className={selected ? "selected" : ""} onClick={() => { setSelectedPatientId(patient.id); setPatientQuery(patient.name); }}>
                        <Avatar name={patient.name}/>
                        <span><strong>{patient.name}</strong><small>{patient.email || patient.phone || patient.id}</small></span>
                        {selected && <Check size={18}/>}
                      </button>;
                    })}
                    {patientQuery && patientMatches.length === 0 && <p>No matching patients found.</p>}
                  </div>
                </div>)}
              <label>
                Clinician
                <select aria-label="Clinician" value={chosenPractitioner} onChange={(e) => {
                    setChosenPractitioner(e.target.value);
                    setChosenDay("");
                    setSelectedSlotId("");
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
                    <option value="Physiotherapy session">Physiotherapy session · Rs 1,000</option>
                    <option value="Initial consultation">
                      Initial consultation · Rs 1,500
                    </option>
                    <option value="Chiropractic adjustment">
                      Chiropractic adjustment · Rs 1,000
                    </option>
                    <option value="Progress review">
                      Progress review · Rs 800
                    </option>
                  </select>
                </label>)}
              <div className="care-field calendar-field">
                <span className="care-label">Date <span aria-hidden="true">*</span></span>
                <div className="availability-calendar" role="group" aria-label="Available appointment dates">
                  <div className="availability-calendar-head">
                    <strong>{date(calendarStart.toISOString(), { month: "long", year: "numeric" })}</strong>
                    <span className="calendar-nav" aria-label="Calendar month controls">
                      <button type="button" onClick={() => setCalendarMonthOffset((month) => Math.max(0, month - 1))} disabled={calendarMonthOffset === 0} aria-label="Previous month"><ChevronLeft size={17}/></button>
                      <button type="button" onClick={() => setCalendarMonthOffset((month) => month + 1)} aria-label="Next month"><ChevronRight size={17}/></button>
                    </span>
                  </div>
                  <div className="availability-weekdays" aria-hidden="true">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={day + index}>{day}</span>)}
                  </div>
                  <div className="availability-days">
                    {calendarCells.map((day) => {
                      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                      const inMonth = day.getMonth() === calendarStart.getMonth();
                      const past = key < todayKey;
                      const available = inMonth && availableDaySet.has(key);
                      const selected = chosenDay === key;
                      const isToday = key === todayKey;
                      return <button key={key} type="button" disabled={!available || past || !chosenPractitioner} className={(selected ? "selected " : "") + (available ? "available " : "unavailable ") + (past ? "past " : "") + (isToday ? "today " : "") + (!inMonth ? "outside" : "")} onClick={() => { setChosenDay(key); setSelectedSlotId(""); }} aria-pressed={selected}>
                        {day.getDate()}
                      </button>;
                    })}
                  </div>
                  <div className="availability-legend" aria-hidden="true">
                    <span><i className="available"/>Available</span>
                    <span><i className="selected"/>Selected</span>
                    <span><i className="unavailable"/>Unavailable</span>
                    <span><i className="past"/>Past date</span>
                  </div>
                </div>
              </div>
              <div className="time-slot-field">
                <div className="time-slot-head"><strong>Available Time Slots{chosenDayLabel ? ` · ${chosenDayLabel}` : ""}</strong>{chosenDay && <span>{validSlots.length} slots available</span>}</div>
                <input type="hidden" name="slotId" value={selectedSlotStillValid ? selectedSlotId : ""} required/>
                <div className="time-slot-grid" role="group" aria-label="Available time slots">
                  {chosenDay ? validSlots.length ? validSlots.map((slot) => (<button key={slot.id} type="button" className={selectedSlotId === slot.id ? "selected" : ""} onClick={() => setSelectedSlotId(slot.id)} aria-pressed={selectedSlotId === slot.id}>{time(slot.starts_at)}</button>)) : <p>No available time slots for this date.</p> : <p>Select an available date to see time slots.</p>}
                </div>
                <p className="availability-helper">Availability is based on Manage Availability settings.</p>
              </div>
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
              {!pending && (!dialog.appointment && !isPatient && !selectedPatientId
                  ? <p className="form-note">Select a patient to continue.</p>
                  : !chosenPractitioner
                      ? <p className="form-note">Select a clinician to continue.</p>
                      : !chosenDay || !selectedSlotStillValid
                          ? <p className="form-note">Select an available date and time to continue.</p>
                          : null)}
              <div className="care-modal-actions">
                <button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={pending}>Cancel</button>
                <button className="button primary" disabled={pending || !chosenDay || !chosenPractitioner || !selectedSlotStillValid || (!dialog.appointment && !isPatient && !selectedPatientId)}>
                  {pending
                      ? "Saving…"
                      : dialog.appointment
                          ? "Confirm New Time"
                          : "Confirm Appointment"}
                  <ArrowRight size={16}/>
                </button>
              </div>
            </form></>)}
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
          {dialog.kind === "shareRecord" && (<form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const contact = String(f.get("contact") || "").trim();
              if (dialog.channel === "whatsapp") {
                  if (!/^[+]?[0-9 ]{7,20}$/.test(contact)) { setToast({ ok: false, message: "Enter a valid WhatsApp number." }); return; }
                  if (!window.confirm(`Confirm the patient's WhatsApp number before sending:\n\n${contact}\n\nA PDF copy of this ${dialog.recordType === "invoice" ? "invoice" : "care record"} will be sent to this number via WhatsApp.`))
                      return;
              }
              else if (!window.confirm(`Confirm the patient's email address before sending:\n\n${contact}\n\nA PDF copy of this ${dialog.recordType === "invoice" ? "invoice" : "care record"} will be emailed to this address.`))
                  return;
              action("shareRecord", { recordType: dialog.recordType, channel: dialog.channel, id: dialog.id, contact });
          }}>
              <p>Send a PDF copy of this {dialog.recordType === "invoice" ? "invoice" : "care record"} to <strong>{dialog.patientName}</strong> via {dialog.channel === "email" ? "email" : "WhatsApp"}.</p>
              <label>
                {dialog.channel === "email" ? "Patient's email address" : "Patient's WhatsApp number"}
                {dialog.channel === "email"
                  ? <input type="email" name="contact" required maxLength={200} defaultValue={dialog.email} placeholder="patient@example.com"/>
                  : <input type="tel" name="contact" required maxLength={20} pattern="[+]?[0-9 ]{7,20}" title="Enter a valid WhatsApp number." defaultValue={dialog.phone} placeholder="+91 98765 43210"/>}
              </label>
              <p className="form-note">{dialog.channel === "email" ? "Confirm the address above before sending. A PDF copy will be emailed to the patient." : "You'll be asked to confirm this number before the PDF is sent."}</p>
              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={pending}>
                  {dialog.channel === "email" ? <Mail size={16}/> : <MessageCircle size={16}/>}{pending ? "Sending…" : "Confirm & Send"}
                </button>
              </div>
            </form>)}
          {dialog.kind === "note" && <ClinicalForm appointments={data.appointments} patients={data.patients} specialty={u.specialty} clinicianName={u.name} pending={pending} onSave={payload => action("note",payload)} onCancel={() => { setDialog(null); navigate("records"); }} editNote={dialog.note ? { id: dialog.note.id, patientId: dialog.note.patient_id, appointmentId: dialog.note.appointment_id || "", diagnosis: dialog.note.diagnosis, notes: dialog.note.notes, plan: dialog.note.plan, published: !!dialog.note.published, assessment: readAssessment(dialog.note.assessment_json) || undefined } : undefined} />}
          {dialog.kind === "progressEntry" && <ProgressEntryForm note={dialog.note} editIndex={dialog.index} patient={patientById(dialog.note.patient_id)} appointments={data.appointments} clinicianName={dialog.note.practitioner} specialty={data.practitioners.find((p) => p.id === dialog.note.practitioner_id)?.specialty} pending={pending} onCancel={() => setDialog({ kind: "clinicalRecord", note: dialog.note })} onSave={payload => { setToast(null); start(async () => { const result = await mutate("progressEntry", payload); setToast(result); if (result.ok) { router.refresh(); setClinicalDetailTab("progress"); setClinicalCompactTab("progress"); setDialog({ kind: "clinicalRecord", note: dialog.note }); } }); }} />}
          {dialog.kind === "clinicalRecord" && (() => {
            const n = data.notes.find((x) => x.id === dialog.note.id) || dialog.note;
            const patient = patientById(n.patient_id);
            const appointment = n.appointment_id ? data.appointments.find((a) => a.id === n.appointment_id) : undefined;
            const assessment = readAssessment(n.assessment_json);
            const values = assessment?.fields || {};
            const progress = assessment?.progress || [];
            const allDocs = data.files.filter((f) => f.patient_id === n.patient_id);
            const docs = allDocs.slice(0, 3);
            const progressPreview = progress.slice(0, 3);
            const value = (key: string) => values[key] || "Not recorded";
            const Info = ({label, children}:{label:string; children:React.ReactNode}) => <span><small>{label}</small><strong>{children}</strong></span>;
            const Field = ({label, children}:{label:string; children:React.ReactNode}) => <div className="clinical-detail-field"><dt>{label}</dt><dd className={children === "Not recorded" ? "muted" : ""}>{children}</dd></div>;
            const Section = ({title, children, className = "", action}:{title:string; children:React.ReactNode; className?:string; action?:React.ReactNode}) => <section className={"clinical-detail-card " + className}><h3>{title}{action}</h3>{children}</section>;
            const status = n.published ? "Published" : "Draft";
            const ProgressList = ({rows, empty}:{rows:typeof progress; empty:React.ReactNode}) => rows.length ? <ol className="progress-timeline">{rows.map((row, i) => <li key={i}><strong>{date(row.date)}</strong><span>{row.treatment}</span></li>)}</ol> : <>{empty}</>;
            const canEditProgress = n.practitioner_id === u.id;
            const progressDetailFields: Array<[keyof typeof progress[number], string]> = [["subjective", "Subjective (Patient Report)"], ["objective", "Objective (Findings)"], ["treatmentProvided", "Treatment Provided"], ["patientResponse", "Patient Response"], ["planNextVisit", "Plan for Next Visit"]];
            const ProgressFullList = ({rows, empty}:{rows:typeof progress; empty:React.ReactNode}) => rows.length ? <div className="progress-entry-list">{rows.map((row, i) => <details className="progress-entry-card" key={i}>
              <summary><span><strong>{date(row.date)}</strong>{row.entryType && <Badge tone="info">{row.entryType}</Badge>}</span><span className="progress-entry-summary">{row.treatment}</span>{canEditProgress && <button type="button" className="button secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDialog({ kind: "progressEntry", note: n, index: i }); }}><Pencil size={14}/>Edit</button>}{canEditProgress && <button type="button" className="button danger" disabled={pending} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (window.confirm("Delete this progress entry? This cannot be undone.")) action("deleteProgressEntry", { noteId: n.id, index: i }, false); }}><Trash2 size={14}/>Delete</button>}</summary>
              <div className="progress-entry-card-body">{progressDetailFields.map(([key, label]) => row[key] ? <div key={key} className="clinical-detail-field"><dt>{label}</dt><dd>{row[key] as string}</dd></div> : null)}{!progressDetailFields.some(([key]) => row[key]) && <p className="muted">No additional details recorded for this entry.</p>}</div>
            </details>)}</div> : <>{empty}</>;
            const DocumentList = ({rows, empty}:{rows:typeof allDocs; empty:React.ReactNode}) => rows.length ? <div className="attached-document-list">{rows.map((f) => <a href={"/api/files?id=" + f.id + "&download=1"} key={f.id}><FileText size={17}/><span><strong>{f.name}</strong><small>{date(f.created_at)} · {Math.max(1, Math.round(f.size / 1024))} KB</small></span><Download size={15}/></a>)}</div> : <>{empty}</>;
            const smallEmpty = (text: string) => <p className="muted">{text}</p>;
            const HistorySection = () => <Section title="Chief Complaint &amp; History" className="history-detail"><dl><Field label="Chief Complaint (C/C)">{n.notes || "Not recorded"}</Field><Field label="History of Present Illness (HOPI)">{value("hopi")}</Field><Field label="Medical History">{value("medicalHistory")}</Field><Field label="Surgical History">{value("surgicalHistory")}</Field><Field label="Family History">{value("familyHistory")}</Field></dl></Section>;
            const ExaminationSection = () => <Section title="Examination"><dl className="clinical-detail-grid-list"><Field label="Blood Pressure (BP)">{value("bp")}</Field><Field label="Heart Rate (HR)">{value("hr")}</Field><Field label="Weight">{value("weight")}</Field><Field label="Height">{value("height")}</Field></dl></Section>;
            const ObservationSection = () => <Section title="On Observation"><dl>{["scar","posture","gait","deformity","edema"].map((key) => <Field key={key} label={key === "scar" ? "Scar (if any)" : key[0].toUpperCase() + key.slice(1)}>{value(key)}</Field>)}</dl></Section>;
            const PalpationSection = () => <Section title="On Palpation"><dl>{[["tenderness","Tenderness"],["scarMobility","Scar Mobility"],["tone","Tone"],["spasm","Spasm"],["triggerPoints","Trigger Points"]].map(([key,label]) => <Field key={key} label={label}>{value(key)}</Field>)}</dl></Section>;
            const MmtSection = () => <Section title="MMT"><dl>{["SIC","WIC","TL","Facilitated","Inhibited"].map((label) => { const key = label === "SIC" ? "sic" : label === "WIC" ? "wic" : label === "TL" ? "tl" : label.toLowerCase(); return <Field key={key} label={label}>{value(key)}</Field>; })}</dl></Section>;
            const ClinicalSummarySection = () => <Section title="Clinical Summary" className="clinical-summary-detail"><dl><Field label="Diagnosis / Clinical Summary">{n.diagnosis || "Not recorded"}</Field><Field label="Treatment Plan">{n.plan || "Not recorded"}</Field></dl></Section>;
            const Accordion = ({title, children}:{title:string; children:React.ReactNode}) => <details className="clinical-accordion" open><summary>{title}<ChevronRight size={16} className="clinical-accordion-chevron"/></summary><div className="clinical-accordion-body">{children}</div></details>;
            const detailTabs: Array<[typeof clinicalDetailTab, string]> = [["overview","Overview"],["patientDetails","Patient Details"],["history","History"],["examination","Examination"],["observation","Observation"],["palpation","Palpation"],["mmt","MMT"],["clinicalSummary","Clinical Summary"],["progress","Progress (" + progress.length + ")"],["documents","Documents (" + allDocs.length + ")"]];
            return <div className="clinical-note-detail-view">
              <div className="clinical-detail-breadcrumb"><button type="button" className="link-button" onClick={() => { setDialog(null); navigate("records"); }}>Care Records</button><ChevronRight size={13}/><span>Clinical Note</span></div>
              <div className="clinical-detail-title"><button className="icon-button clinical-back-icon" type="button" aria-label="Back to Care Records" onClick={() => { setDialog(null); navigate("records"); }}><ArrowLeft size={18}/></button><div><h3>Clinical Note <Badge tone={n.published ? "completed" : "unpaid"}>{status}</Badge></h3><p>{assessment ? "Standard physiotherapy evaluation" : "Progress note"}</p></div><div className="clinical-detail-actions">{n.practitioner_id === u.id && <button className="button secondary" type="button" onClick={() => setDialog({ kind: "note", note: n })}><Pencil size={16}/>Edit</button>}<a className="button secondary" href={"/api/reports?id=" + n.id + "&type=note"} target="_blank" rel="noreferrer"><Download size={16}/>Export PDF</a>{!n.published && n.practitioner_id === u.id ? <button className="button primary" disabled={pending} onClick={() => action("publish", { id: n.id }, false)}><Upload size={16}/>Release to Patient</button> : <span className="released-pill">Released to Patient</span>}{n.practitioner_id === u.id && <button className="button danger" type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this clinical note? This cannot be undone.")) action("deleteNote", { id: n.id }); }}><Trash2 size={16}/>Delete</button>}</div></div>
              <section className="clinical-patient-summary"><div className="person detail-person"><Avatar name={n.patient} size="large"/><div><h3>{n.patient}</h3><p>{patient ? patientCode(patient) : n.patient_id}</p></div></div><div className="clinical-summary-strip"><Info label="Age">{value("age")}</Info><Info label="Gender">{patient?.gender || value("gender")}</Info><Info label="Contact">{patient?.phone || value("contact")}</Info><Info label="Address">{value("address")}</Info><Info label="Profession">{value("profession")}</Info></div></section>
              <section className="clinical-visit-summary"><h3>Visit Details</h3><Info label="Date">{appointment ? date(appointment.starts_at) : date(n.created_at)}</Info><Info label="Time">{appointment ? time(appointment.starts_at) : time(n.created_at)}</Info><Info label="Clinician">{n.practitioner}</Info><Info label="Specialty">{clinicianLabel(data.practitioners.find((p) => p.id === n.practitioner_id)?.specialty)}</Info><Info label="Linked Visit">{appointment ? appointmentCode(appointment) : "No linked appointment"}</Info></section>
              <div className="clinical-detail-tabs clinical-desktop-only" role="tablist" aria-label="Clinical note detail sections">{detailTabs.map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={clinicalDetailTab === key} className={clinicalDetailTab === key ? "selected" : ""} onClick={() => setClinicalDetailTab(key)}>{label}</button>)}</div>
              <div className="clinical-detail-tabs clinical-compact-only" role="tablist" aria-label="Clinical note detail sections">{[["details","Details"],["progress","Progress (" + progress.length + ")"],["documents","Documents (" + allDocs.length + ")"]].map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={clinicalCompactTab === key} className={clinicalCompactTab === key ? "selected" : ""} onClick={() => setClinicalCompactTab(key as "details" | "progress" | "documents")}>{label}</button>)}</div>
              <div className="clinical-desktop-only">
                {clinicalDetailTab === "overview" && <div className="clinical-overview-grid">
                  <HistorySection/><Section title="Medical History"><dl><Field label="Medical History">{value("medicalHistory")}</Field></dl></Section><Section title="Surgical History"><dl><Field label="Surgical History">{value("surgicalHistory")}</Field></dl></Section><Section title="Family History"><dl><Field label="Family History">{value("familyHistory")}</Field></dl></Section><ExaminationSection/>
                  <ObservationSection/><PalpationSection/><MmtSection/>
                  <ClinicalSummarySection/>
                  <Section title="Progress Sheet" action={<button type="button" className="link-button card-action" onClick={() => setClinicalDetailTab("progress")}>View All</button>}><ProgressList rows={progressPreview} empty={smallEmpty("No progress entries yet.")}/></Section>
                  <Section title="Attached Documents" action={<button type="button" className="link-button card-action" onClick={() => setClinicalDetailTab("documents")}>View All</button>}><DocumentList rows={docs} empty={smallEmpty("No attached documents yet.")}/></Section>
                </div>}
                {clinicalDetailTab === "patientDetails" && <div className="clinical-tab-panel"><Section title="Patient Details"><dl><Field label="Age">{value("age")}</Field><Field label="Gender">{patient?.gender || value("gender")}</Field><Field label="Contact">{patient?.phone || value("contact")}</Field><Field label="Address">{value("address")}</Field><Field label="Profession">{value("profession")}</Field></dl></Section></div>}
                {clinicalDetailTab === "history" && <div className="clinical-tab-panel"><HistorySection/></div>}
                {clinicalDetailTab === "examination" && <div className="clinical-tab-panel"><ExaminationSection/></div>}
                {clinicalDetailTab === "observation" && <div className="clinical-tab-panel"><ObservationSection/></div>}
                {clinicalDetailTab === "palpation" && <div className="clinical-tab-panel"><PalpationSection/></div>}
                {clinicalDetailTab === "mmt" && <div className="clinical-tab-panel"><MmtSection/></div>}
                {clinicalDetailTab === "clinicalSummary" && <div className="clinical-tab-panel"><ClinicalSummarySection/></div>}
                {clinicalDetailTab === "progress" && <div className="clinical-tab-panel"><Section title="Progress Sheet" action={n.practitioner_id === u.id && <button type="button" className="button secondary card-add-button" onClick={() => setDialog({ kind: "progressEntry", note: n })}><Plus size={15}/>Add Progress Entry</button>}><ProgressFullList rows={progress} empty={<Empty icon={ClipboardList} title="No Progress Entries Yet" description="Track your patient’s progress over time. Add a progress entry to document treatment and improvement." action={n.practitioner_id === u.id ? <button className="button primary" type="button" onClick={() => setDialog({ kind: "progressEntry", note: n })}><Plus size={16}/>Add Progress Entry</button> : undefined}/>}/></Section></div>}
                {clinicalDetailTab === "documents" && <div className="clinical-tab-panel"><Section title="Attached Documents"><DocumentList rows={allDocs} empty={<Empty icon={Folder} title="No Patient Documents Yet" description="Uploaded reports, scans, prescriptions and supporting files will appear here." action={isDoctor ? <button className="button primary" type="button" onClick={() => { setShowUploadPanel(true); setDialog({ kind: "documentsLibrary" }); }}><Upload size={16}/>Upload Document</button> : undefined}/>}/></Section></div>}
              </div>
              <div className="clinical-compact-only">
                {clinicalCompactTab === "details" && <div className="clinical-accordion-stack">
                  <Accordion title="Patient Details"><dl><Field label="Age">{value("age")}</Field><Field label="Gender">{patient?.gender || value("gender")}</Field><Field label="Contact">{patient?.phone || value("contact")}</Field><Field label="Address">{value("address")}</Field><Field label="Profession">{value("profession")}</Field></dl></Accordion>
                  <Accordion title="Chief Complaint &amp; History"><dl><Field label="Chief Complaint (C/C)">{n.notes || "Not recorded"}</Field><Field label="History of Present Illness (HOPI)">{value("hopi")}</Field><Field label="Medical History">{value("medicalHistory")}</Field><Field label="Surgical History">{value("surgicalHistory")}</Field><Field label="Family History">{value("familyHistory")}</Field></dl></Accordion>
                  <Accordion title="Examination"><dl className="clinical-detail-grid-list"><Field label="Blood Pressure (BP)">{value("bp")}</Field><Field label="Heart Rate (HR)">{value("hr")}</Field><Field label="Weight">{value("weight")}</Field><Field label="Height">{value("height")}</Field></dl></Accordion>
                  <Accordion title="On Observation"><dl>{["scar","posture","gait","deformity","edema"].map((key) => <Field key={key} label={key === "scar" ? "Scar (if any)" : key[0].toUpperCase() + key.slice(1)}>{value(key)}</Field>)}</dl></Accordion>
                  <Accordion title="On Palpation"><dl>{[["tenderness","Tenderness"],["scarMobility","Scar Mobility"],["tone","Tone"],["spasm","Spasm"],["triggerPoints","Trigger Points"]].map(([key,label]) => <Field key={key} label={label}>{value(key)}</Field>)}</dl></Accordion>
                  <Accordion title="MMT"><dl>{["SIC","WIC","TL","Facilitated","Inhibited"].map((label) => { const key = label === "SIC" ? "sic" : label === "WIC" ? "wic" : label === "TL" ? "tl" : label.toLowerCase(); return <Field key={key} label={label}>{value(key)}</Field>; })}</dl></Accordion>
                  <Accordion title="Clinical Summary"><dl><Field label="Diagnosis / Clinical Summary">{n.diagnosis || "Not recorded"}</Field><Field label="Treatment Plan">{n.plan || "Not recorded"}</Field></dl></Accordion>
                </div>}
                {clinicalCompactTab === "progress" && <div className="clinical-tab-panel"><Section title="Progress Sheet" action={n.practitioner_id === u.id && <button type="button" className="button secondary card-add-button" onClick={() => setDialog({ kind: "progressEntry", note: n })}><Plus size={15}/>Add Progress Entry</button>}><ProgressFullList rows={progress} empty={<Empty icon={ClipboardList} title="No Progress Entries Yet" description="Track your patient’s progress over time. Add a progress entry to document treatment and improvement." action={n.practitioner_id === u.id ? <button className="button primary" type="button" onClick={() => setDialog({ kind: "progressEntry", note: n })}><Plus size={16}/>Add Progress Entry</button> : undefined}/>}/></Section></div>}
                {clinicalCompactTab === "documents" && <div className="clinical-tab-panel"><Section title="Attached Documents"><DocumentList rows={allDocs} empty={<Empty icon={Folder} title="No Patient Documents Yet" description="Uploaded reports, scans, prescriptions and supporting files will appear here." action={isDoctor ? <button className="button primary" type="button" onClick={() => { setShowUploadPanel(true); setDialog({ kind: "documentsLibrary" }); }}><Upload size={16}/>Upload Document</button> : undefined}/>}/></Section></div>}
              </div>
              <div className="clinical-detail-bottom-actions clinical-compact-only">{n.practitioner_id === u.id && <button className="button secondary" type="button" onClick={() => setDialog({ kind: "note", note: n })}><Pencil size={16}/>Edit</button>}<a className="button secondary" href={"/api/reports?id=" + n.id + "&type=note"} target="_blank" rel="noreferrer"><Download size={16}/>Export PDF</a>{!n.published && n.practitioner_id === u.id && <button className="button primary wide" disabled={pending} onClick={() => action("publish", { id: n.id }, false)}>Release to Patient</button>}{n.practitioner_id === u.id && <button className="button danger wide" type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this clinical note? This cannot be undone.")) action("deleteNote", { id: n.id }); }}><Trash2 size={16}/>Delete</button>}</div>
            </div>;
          })()}
          {dialog.kind === "documentsLibrary" && (() => {
            const docType = (f: FileRecord) => f.mime.includes("pdf") ? "PDF" : f.mime.includes("image") ? "Image" : "File";
            const q = docsSearch.trim().toLowerCase();
            let docs = data.files.filter((f) => {
              const patient = patientById(f.patient_id);
              if (docsTypeFilter !== "all" && docType(f) !== docsTypeFilter) return false;
              if (!q) return true;
              return (f.name + " " + (patient?.name || "") + " " + (patient ? patientCode(patient) : "") + " " + docType(f)).toLowerCase().includes(q);
            });
            docs = docs.slice().sort((a, b) => docsSort === "newest" ? b.created_at.localeCompare(a.created_at) : docsSort === "oldest" ? a.created_at.localeCompare(b.created_at) : docsSort === "name" ? a.name.localeCompare(b.name) : b.size - a.size);
            const hasAnyDocs = data.files.length > 0;
            const filtersActive = !!(docsSearch || docsTypeFilter !== "all");
            const pageSize = 10;
            const pageCount = Math.max(1, Math.ceil(docs.length / pageSize));
            const page = Math.min(docsPage, pageCount);
            const pageDocs = docs.slice((page - 1) * pageSize, page * pageSize);
            const clearFilters = () => { setDocsSearch(""); setDocsTypeFilter("all"); setDocsPage(1); };
            const TypeBadge = ({ f }: { f: FileRecord }) => <Badge tone={docType(f) === "PDF" ? "unpaid" : "info"}>{docType(f)}</Badge>;
            const DocActions = ({ f }: { f: FileRecord }) => <div className="row-actions detail-actions"><a className="icon-button" href={"/api/files?id=" + f.id + "&download=1"} aria-label={"Download " + f.name}><Download size={16}/></a></div>;
            return <div className="patient-documents-view">
              <div className="clinical-detail-breadcrumb"><button type="button" className="link-button" onClick={() => setDialog(null)}>Care Records</button><ChevronRight size={13}/><span>Patient Documents</span></div>
              <div className="clinical-detail-title"><button className="icon-button clinical-back-icon" type="button" aria-label="Back to Care Records" onClick={() => setDialog(null)}><ArrowLeft size={18}/></button><div><h3>Patient Documents</h3><p>All uploaded files organized by patient, visit and document type.</p></div><div className="clinical-detail-actions">{isDoctor && <button className="button primary" type="button" onClick={() => setShowUploadPanel(true)}><Upload size={16}/>Upload Document</button>}</div></div>
              <div className="documents-filterbar"><SearchInput value={docsSearch} onChange={(v) => { setDocsSearch(v); setDocsPage(1); }} placeholder="Search documents, patients, or keywords..."/>
                <select aria-label="Document Type" value={docsTypeFilter} onChange={(e) => { setDocsTypeFilter(e.target.value); setDocsPage(1); }}><option value="all">All Document Types</option><option value="PDF">PDF</option><option value="Image">Image</option></select>
                <select aria-label="Sort" value={docsSort} onChange={(e) => setDocsSort(e.target.value as typeof docsSort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name (A–Z)</option><option value="size">Largest first</option></select>
              </div>
              {!docs.length ? <Empty icon={hasAnyDocs ? Search : Folder} title={hasAnyDocs ? "No Records Match Your Filters" : "No Patient Documents Yet"} description={hasAnyDocs ? "We couldn’t find any records matching your current search or filter criteria." : "Uploaded reports, scans, prescriptions and supporting files will appear here."} action={hasAnyDocs ? (filtersActive ? <button className="button secondary" type="button" onClick={clearFilters}>Clear Filters</button> : undefined) : (isDoctor ? <button className="button primary" type="button" onClick={() => setShowUploadPanel(true)}><Upload size={16}/>Upload Document</button> : undefined)}/> : <>
                <div className="documents-table-wrap clinical-desktop-only"><table className="data-table documents-table"><thead><tr><th>File Name</th><th>Type / Category</th><th>Patient</th><th>Uploaded By</th><th>Date</th><th>Size</th><th>Actions</th></tr></thead><tbody>{pageDocs.map((f) => { const patient = patientById(f.patient_id); return <tr key={f.id}><td><span className="service-cell"><FileText size={18}/><span><strong>{f.name}</strong></span></span></td><td><TypeBadge f={f}/></td><td><div className="person table-person"><Avatar name={patient?.name || f.patient_id}/><div><strong>{patient?.name || f.patient_id}</strong>{patient && <small>{patientCode(patient)}</small>}</div></div></td><td>{f.uploaded_by}</td><td>{date(f.created_at)}</td><td>{Math.max(1, Math.round(f.size / 1024))} KB</td><td><DocActions f={f}/></td></tr>; })}</tbody></table></div>
                <div className="document-cards clinical-compact-only">{pageDocs.map((f) => { const patient = patientById(f.patient_id); return <article className="document-card" key={f.id}><FileText size={22}/><div className="document-card-body"><strong>{f.name}</strong><small>{patient?.name || f.patient_id}{patient && " · " + patientCode(patient)}</small><small>{date(f.created_at)} · {Math.max(1, Math.round(f.size / 1024))} KB</small><TypeBadge f={f}/></div><DocActions f={f}/></article>; })}</div>
                {pageCount > 1 && <div className="documents-pagination"><span>{docs.length} document{docs.length === 1 ? "" : "s"} · Page {page} of {pageCount}</span><div className="documents-pagination-controls"><button type="button" className="button secondary" disabled={page <= 1} onClick={() => setDocsPage(page - 1)}><ChevronLeft size={15}/>Previous</button><button type="button" className="button secondary" disabled={page >= pageCount} onClick={() => setDocsPage(page + 1)}>Next<ChevronRight size={15}/></button></div></div>}
              </>}
            </div>;
          })()}
          {dialog.kind === "appointment" && (() => { const appointmentPatient = patientById(dialog.appointment.patient_id); const appointmentNotes = data.notes.filter((note) => note.appointment_id === dialog.appointment.id || note.patient_id === dialog.appointment.patient_id); const invoice = data.invoices.find((item) => item.appointment_id === dialog.appointment.id); return <div className="appointment-detail-view"><div className="detail-hero appointment-detail-hero"><div className="person detail-person"><Avatar name={dialog.appointment.patient} size="large"/><div><h3>{dialog.appointment.patient}</h3><p>{appointmentPatient ? patientCode(appointmentPatient) : dialog.appointment.patient_id}</p><small>{appointmentPatient?.email || "No email recorded"}</small><small>{appointmentPatient?.phone || "No phone number recorded"}</small></div></div><div className="appointment-summary-grid"><span><CalendarDays size={19}/><small>Appointment ID</small><strong>{appointmentCode(dialog.appointment)}</strong></span><span><ClipboardList size={19}/><small>Appointment Type</small><strong>{dialog.appointment.service}</strong></span><span><Users size={19}/><small>Clinician</small><strong>{dialog.appointment.practitioner}</strong></span><span><CalendarCheck size={19}/><small>Date</small><strong>{date(dialog.appointment.starts_at, { day: "2-digit", month: "short", year: "numeric" })}</strong></span><span><Clock3 size={19}/><small>Time</small><strong>{time(dialog.appointment.starts_at)} - {time(appointmentEnd(dialog.appointment))}</strong></span></div><Badge tone={isOverdue(dialog.appointment) ? "overdue" : dialog.appointment.status}>{isOverdue(dialog.appointment) ? "Overdue" : dialog.appointment.status === "confirmed" ? "Confirmed" : dialog.appointment.status}</Badge></div><div className="detail-grid appointment-detail-grid"><section className="detail-card"><div className="detail-card-head"><Users size={19}/><h3>Patient Snapshot</h3></div><dl><dt>Full Name</dt><dd>{dialog.appointment.patient}</dd><dt>Patient ID</dt><dd>{appointmentPatient ? patientCode(appointmentPatient) : dialog.appointment.patient_id}</dd><dt>Email</dt><dd>{appointmentPatient?.email || "Not provided"}</dd><dt>Phone</dt><dd>{appointmentPatient?.phone || "Not provided"}</dd><dt>Date of Birth</dt><dd>{appointmentPatient?.date_of_birth ? date(appointmentPatient.date_of_birth, { day: "2-digit", month: "short", year: "numeric" }) : "Not provided"}</dd><dt>Gender</dt><dd>{appointmentPatient?.gender || "Not provided"}</dd></dl></section><section className="detail-card"><div className="detail-card-head"><FileText size={19}/><h3>Reason for Visit</h3></div><p className="soft-note">{dialog.appointment.reason || "No reason recorded for this visit."}</p></section><section className="detail-card"><div className="detail-card-head"><ClipboardList size={19}/><h3>Notes / Clinical Context</h3></div><p className="soft-note">{appointmentNotes[0]?.notes || "No clinical context recorded yet."}</p></section><section className="detail-card"><div className="detail-card-head"><Clock3 size={19}/><h3>Appointment Timeline</h3></div><div className="timeline-list"><span><Check size={16}/><strong>Booked</strong><small>{date(dialog.appointment.created_at)} · {time(dialog.appointment.created_at)}</small></span><span><Check size={16}/><strong>{dialog.appointment.status === "cancelled" ? "Cancelled" : "Confirmed"}</strong><small>{dialog.appointment.status === "completed" ? "Visit completed" : "Current status"}</small></span></div></section><section className="detail-card"><div className="detail-card-head"><CreditCard size={19}/><h3>Payment / Fee</h3></div><dl><dt>Consultation Fee</dt><dd>{money(dialog.appointment.amount)}</dd><dt>Payment Status</dt><dd><Badge tone={invoice?.status || "unpaid"}>{invoice?.status || "Pending"}</Badge></dd><dt>Payment Method</dt><dd>{invoice?.payment_reference || "Offline / Clinic"}</dd></dl></section><section className="detail-card"><div className="detail-card-head"><FileText size={19}/><h3>Additional Information</h3></div><dl><dt>Created By</dt><dd>Clinic Reception</dd><dt>Source</dt><dd>MindSpine Booking</dd><dt>Last Updated</dt><dd>{toDMY(dialog.appointment.updated_at)}</dd></dl></section></div><div className="detail-actions-bar">{dialog.appointment.status === "confirmed" && new Date(dialog.appointment.starts_at) <= now && !isPatient && <button className="button secondary" disabled={pending} onClick={() => action("appointment", { id: dialog.appointment.id, action: "complete" })}><Check size={16}/>Mark Completed</button>}{!isPatient && dialog.appointment.status === "confirmed" && <button className="button secondary" onClick={() => { const a = dialog.appointment; setDialog(null); setEditApptTarget(a); }}><Pencil size={16}/>Edit Entry</button>}{dialog.appointment.status !== "completed" && <button className="button primary" onClick={() => openBook(dialog.appointment)}><CalendarDays size={16}/>Reschedule</button>}{dialog.appointment.status === "confirmed" && <button className="button danger" onClick={() => setDialog({ kind: "cancel", appointment: dialog.appointment })}><X size={16}/>Cancel Appointment</button>}{!isPatient && dialog.appointment.status !== "completed" && <button className="button danger" onClick={() => { const a = dialog.appointment; setDialog(null); setDeleteApptTarget({ id: a.id, label: a.service + " · " + a.patient }); }}><Trash2 size={16}/>Delete Entry</button>}</div></div>; })()}
          {dialog.kind === "invoice" && (() => {
              const invoice = data.invoices.find((item) => item.id === dialog.id);
              if (!invoice) return null;
              return <form className="offline-payment-form" action={formAction("invoice", (f) => ({
                    id: dialog.id,
                    action: dialog.refund ? "refunded" : "paid",
                    reference: [String(f.get("method") || "Cash"), String(f.get("date") || ""), String(f.get("reference") || "Clinic payment"), String(f.get("notes") || "")].filter(Boolean).join(" - "),
                }))}>
                <div className="offline-payment-title"><span><CreditCard size={24}/></span><div><h3>{dialog.refund ? "Record Offline Refund" : "Record Offline Payment"}</h3><p>Record the payment received at your clinic for this invoice.</p></div></div>
                <article className="offline-invoice-summary"><FileText size={26}/><div><strong>{invoice.id.toUpperCase()}</strong><small>{invoice.patient}</small><small>{invoice.service}</small><b>{money(invoice.amount)}</b></div><Badge tone={invoice.status}>{invoice.status}</Badge></article>
                <div className="offline-payment-grid">
                  <div className="offline-static-field"><span className="field-label-text">Patient</span><strong>{invoice.patient}</strong></div>
                  <label>Payment Method<select name="method" defaultValue="Cash"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Other</option></select></label>
                  <div className="offline-static-field"><span className="field-label-text">Invoice Number</span><strong>{invoice.id.toUpperCase()}</strong></div>
                  <label>Payment Date<input name="date" type="date" max={todayIST} defaultValue={new Date(data.generatedAt).toISOString().slice(0, 10)} required/></label>
                  <div className="offline-static-field"><span className="field-label-text">Amount (₹)</span><strong>{money(invoice.amount)}</strong></div>
                  <label>Invoice Reference <span className="muted">(Optional)</span><input name="reference" placeholder="e.g. Receipt number" maxLength={120}/></label>
                  <label className="offline-notes-field">Notes <span className="muted">(Optional)</span><textarea name="notes" rows={3} maxLength={200} placeholder="Paid at clinic reception."/></label>
                </div>
                <div className="offline-payment-actions"><button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={pending}>Cancel</button><button className="button primary" disabled={pending}><Check size={16}/>{pending ? "Recording..." : dialog.refund ? "Record Refund" : "Record Payment"}</button></div>
              </form>;
            })()}
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
                <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={15} required/>
              </label>
              <small className="muted">Use at least 8 characters, including letters and numbers.</small>
              <p className="form-note">
                Share the new password through your approved secure channel.
                Email password recovery is not connected.
              </p>
              <button className="button primary full" disabled={pending}>
                Reset password and sign out sessions
              </button>
            </form>)}
          {dialog.kind === "user" && (dialog.role === "patient" ? (<form className="care-form patient-create-form" onSubmit={retainOnError("user")}>
              <section className="care-form-card">
                <div className="care-form-card-head">
                  <span className="care-form-icon"><Users size={25}/></span>
                  <div>
                    <h3>Personal Information</h3>
                    <p>Basic details about the patient.</p>
                  </div>
                </div>
                <div className="care-field-grid two-columns">
                  <label>
                    Full Name <span aria-hidden="true">*</span>
                    <input name="name" placeholder="Enter full name" maxLength={200} required/>
                  </label>
                  <label>
                    Email <span aria-hidden="true">*</span>
                    <input name="email" type="email" placeholder="Enter email address" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Enter a valid email address." maxLength={200} required/>
                  </label>
                  <label>
                    Phone <span className="muted">(Optional)</span>
                    <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="tel" placeholder="Enter phone number" onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10); }}/>
                  </label>
                  <label>
                    Date of Birth <span className="muted">(Optional)</span>
                    <input name="date_of_birth" type="date" max={todayIST} aria-label="Date of Birth" />
                  </label>
                  <label>
                    Gender <span className="muted">(Optional)</span>
                    <select name="gender" aria-label="Gender">
                      <option value="">Select gender</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Non-binary</option>
                      <option>Prefer not to say</option>
                    </select>
                  </label>
                  <label>
                    References <span className="muted">(Optional)</span>
                    <select name="referral_source" aria-label="References">
                      <option value="">How did they hear about us?</option>
                      <option>Doctor referral</option>
                      <option>Friend or family</option>
                      <option>Search engine</option>
                      <option>Social media</option>
                    </select>
                  </label>
                </div>
                <input type="hidden" name="role" value="patient"/>
              </section>
              <section className="care-form-card">
                <div className="care-form-card-head">
                  <span className="care-form-icon"><ShieldCheck size={25}/></span>
                  <div>
                    <h3>Account Access</h3>
                    <p>Set a temporary password for the patient portal.</p>
                  </div>
                </div>
                <label>
                  Initial Password <span aria-hidden="true">*</span>
                  <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={15} placeholder="Create an initial password" required/>
                </label>
                <p className="form-note care-security-note">
                  <strong>Use at least 8 characters, including letters and numbers.</strong>
                  <span>Share these credentials through your approved secure process. The user can change the password in Settings.</span>
                </p>
              </section>
              <div className="care-modal-actions">
                <button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={pending}>Cancel</button>
                <button className="button primary" disabled={pending}>{pending ? "Creating…" : "Create Patient"}</button>
              </div>
            </form>) : (<form action={formAction("user")}>
              <label>
                Full Name
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
                <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="tel" onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10); }}/>
              </label>
              <label>
                Initial password
                <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={15} required/>
              </label>
              <p className="form-note">
                Use at least 8 characters, including letters and numbers. Share credentials through your approved secure process. The user
                can change the password in Settings.
              </p>
              <button className="button primary full" disabled={pending}>
                Create user
              </button>
            </form>))}
          {dialog.kind === "editPatient" && (<form className="care-form patient-edit-form" onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const payload = {
                        id: dialog.patient.id,
                        name: String(f.get("name") || ""),
                        phone: String(f.get("phone") || ""),
                        date_of_birth: String(f.get("date_of_birth") || ""),
                        gender: String(f.get("gender") || ""),
                        history: String(f.get("history") || ""),
                        referral_source: String(f.get("referral_source") || ""),
                    };
                    setToast(null);
                    start(async () => {
                        const result = await mutate("patientProfile", payload);
                        setToast(result);
                        if (result.ok) {
                            router.refresh();
                            setDialog({ kind: "patient", patient: { ...dialog.patient, ...payload } });
                        }
                    });
                }}>
              <section className="care-form-card">
                <div className="care-form-card-head"><span className="care-form-icon"><Users size={24}/></span><div><h3>Patient Information</h3><p>Update the patient profile used across appointments and records.</p></div></div>
                <div className="care-field-grid two-columns">
                  <label>Full Name <span aria-hidden="true">*</span><input name="name" defaultValue={dialog.patient.name} maxLength={200} required/></label>
                  <label>Email<input value={dialog.patient.email} disabled readOnly/></label>
                  <label>Phone <span className="muted">(Optional)</span><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" defaultValue={dialog.patient.phone} onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10); }}/></label>
                  <label>Date of Birth <span className="muted">(Optional)</span><input name="date_of_birth" type="date" max={todayIST} defaultValue={dialog.patient.date_of_birth}/></label>
                  <label>Gender <span className="muted">(Optional)</span><select name="gender" defaultValue={dialog.patient.gender}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label>
                  <label>References <span className="muted">(Optional)</span><input name="referral_source" maxLength={100} defaultValue={dialog.patient.referral_source}/></label>
                </div>
                <label>Medical History <span className="muted">(Optional)</span><textarea name="history" rows={4} maxLength={5000} defaultValue={dialog.patient.history} placeholder="Add relevant medical history, injuries, conditions or other clinical information."/></label>
              </section>
              <div className="care-modal-actions"><button type="button" className="button secondary" onClick={() => setDialog({ kind: "patient", patient: dialog.patient })} disabled={pending}>Cancel</button><button className="button primary" disabled={pending}>{pending ? "Saving…" : "Save Patient"}</button></div>
            </form>)}
          {dialog.kind === "schedule" && (<>
              <form className="care-form availability-form" onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const hour = String(f.get("hour") || "");
                    if (!hour) { setToast({ ok: false, message: "No times left on this date. Choose a later date." }); return; }
                    action("slot", {
                        practitionerId: f.get("practitionerId"),
                        startsAt: new Date(String(f.get("date")) + "T" + hour + ":00+05:30").toISOString(),
                    }, false);
                }}>
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
                    <input name="date" type="date" min={todayIST} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} required/>
                  </label>
                  <label>
                    Time in IST
                    <select aria-label="Time in IST" name="hour">
                      {availableHours.length ? availableHours.map((h) => (<option key={h} value={String(h).padStart(2, "0") + ":00"}>
                          {h > 12 ? h - 12 : h}:00 {h >= 12 ? "PM" : "AM"}
                        </option>)) : <option value="" disabled>No times left today</option>}
                    </select>
                  </label>
                </div>
                <div className="availability-add-panel">
                  <span className="care-form-icon"><Clock3 size={25}/></span>
                  <div>
                    <h3>Add Available Slot</h3>
                    <p>Add a 60-minute slot to your availability.</p>
                  </div>
                  <button className="button primary" disabled={pending || !availableHours.length}>
                    Add 60-Minute Slot
                  </button>
                </div>
              </form>
              {(() => { const openSlots = data.slots.filter((s) => !s.booked && new Date(s.starts_at).getTime() > Date.now()); return (<>
                <div className="availability-list-head"><h3 className="spaced">Upcoming Availability</h3><p>Manage or remove your upcoming available slots.</p></div>
                <div className="slot-list">
                  {openSlots.length ? openSlots.slice(0, slotsShown).map((s) => (<div className="slot-row" key={s.id}>
                      <span>
                        <strong>
                          {date(s.starts_at)} · {time(s.starts_at)}
                        </strong>
                        <small>{s.practitioner}</small>
                      </span>
                      <button className="icon-button danger-outline" disabled={pending} onClick={() => setDeleteSlotTarget({ id: s.id, label: `${date(s.starts_at)} · ${time(s.starts_at)}` })}>
                        <span className="sr-only">Remove</span><Trash2 size={16}/>
                      </button>
                    </div>)) : <p className="empty-detail-copy">No available slots yet. Add one above.</p>}
                </div>
                {openSlots.length > slotsShown && <button type="button" className="button secondary full" onClick={() => setSlotsShown(slotsShown + 10)}>Show 10 more ({openSlots.length - slotsShown} remaining)</button>}
              </>); })()}
              <div className="care-modal-actions">
                <button type="button" className="button secondary" onClick={() => setDialog(null)} disabled={pending}>Cancel</button>
                <button type="button" className="button primary" onClick={() => setDialog(null)} disabled={pending}>Done</button>
              </div>
              {deleteSlotTarget && (<div className="in-modal-confirm-backdrop" role="presentation" onKeyDown={(event) => {
                  if (event.key === "Escape") setDeleteSlotTarget(null);
                }}>
                  <div className="logout-confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-slot-title" aria-describedby="delete-slot-description">
                    <button type="button" className="logout-close" aria-label="Cancel" onClick={() => setDeleteSlotTarget(null)} disabled={pending}>
                      <X size={17}/>
                    </button>
                    <div className="logout-confirmation-icon" aria-hidden="true">
                      <Trash2 size={30}/>
                    </div>
                    <h2 id="delete-slot-title">Remove this slot?</h2>
                    <p id="delete-slot-description">{deleteSlotTarget.label} will no longer be available for patients to book.</p>
                    <div className="logout-confirmation-actions">
                      <button type="button" className="logout-cancel" autoFocus onClick={() => setDeleteSlotTarget(null)} disabled={pending}>Cancel</button>
                      <button type="button" className="logout-confirm" disabled={pending} onClick={() => { const target = deleteSlotTarget; action("deleteSlot", { id: target.id }, false); setDeleteSlotTarget(null); }}>{pending ? "Removing…" : "Remove Slot"}</button>
                    </div>
                  </div>
                </div>)}
            </>)}
          {dialog.kind === "patient" && (() => { const patientVisits = patientAppointments(dialog.patient.id); const completedCount = patientCompletedVisits(dialog.patient.id); const next = patientNextAppointment(dialog.patient.id); const lastVisit = patientLastVisit(dialog.patient.id); const files = data.files.filter((f) => f.patient_id === dialog.patient.id); const patientNotes = data.notes.filter((n) => n.patient_id === dialog.patient.id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); return <div className="patient-detail-view"><div className="detail-hero patient-detail-hero"><div className="person detail-person"><Avatar name={dialog.patient.name} size="large"/><div><h3>{dialog.patient.name}</h3><p>{patientCode(dialog.patient)}</p></div></div><div className="detail-contact-list"><span><Mail size={17}/>{dialog.patient.email}</span><span><Clock3 size={17}/>{dialog.patient.phone || "No phone number recorded"}</span><span><CalendarDays size={17}/>{dialog.patient.date_of_birth ? date(dialog.patient.date_of_birth, { day: "2-digit", month: "short", year: "numeric" }) : "Date of birth not recorded"}</span><span><Users size={17}/>{dialog.patient.gender || "Gender not recorded"}</span>{dialog.patient.referral_source && <span><ExternalLink size={17}/>Referred via {dialog.patient.referral_source}</span>}</div><div className="patient-stat-strip"><span><strong>{completedCount}</strong><small>Completed visits</small></span><span><strong>{next ? date(next.starts_at, { day: "2-digit", month: "short", year: "numeric" }) : "--"}</strong><small>Next appointment</small></span><span><strong>{lastVisit ? date(lastVisit.starts_at, { day: "2-digit", month: "short", year: "numeric" }) : "--"}</strong><small>Last visit</small></span><span><strong>{files.length}</strong><small>Documents</small></span></div></div><div className="detail-grid patient-detail-grid"><section className="detail-card"><div className="detail-card-head"><CalendarDays size={19}/><h3>Medical History</h3></div><p className="empty-detail-copy">{dialog.patient.history || "No medical history recorded yet. Add relevant medical history, past injuries, conditions or other clinical information."}</p></section><section className="detail-card"><div className="detail-card-head"><FileText size={19}/><h3>Current Concerns / Notes</h3></div>{patientNotes.length ? <><p className="empty-detail-copy">{patientNotes[0].notes}</p><small className="muted">{date(patientNotes[0].created_at, { day: "numeric", month: "short", year: "numeric" })} · {patientNotes[0].practitioner}{patientNotes.length > 1 ? ` · ${patientNotes.length} notes on file` : ""}</small></> : <p className="empty-detail-copy">No current concerns recorded yet. Document the patient's current concerns, goals and any other important notes.</p>}</section><section className="detail-card"><div className="detail-card-head"><FileText size={19}/><h3>Clinical Documents</h3></div>{files.length ? files.map((f) => <a className="file-row" key={f.id} href={'/api/files?id=' + f.id + '&download=1'}><Paperclip size={15}/>{f.name}<Download size={15}/></a>) : <p className="empty-detail-copy">No documents uploaded yet. Upload reports, prescriptions, assessment notes or other relevant files.</p>}{isDoctor && <button type="button" className="button secondary" onClick={() => { setUploadDefaultPatientId(dialog.patient.id); setDialog(null); setShowUploadPanel(true); }}><Upload size={15}/>Upload document</button>}</section><section className="detail-card"><div className="detail-card-head"><Clock3 size={19}/><h3>Visit History</h3></div>{patientVisits.length ? patientVisits.map((a) => <div className="visit-row" key={a.id}><span><strong>{date(a.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</strong><small>{time(a.starts_at)} - {time(appointmentEnd(a))}</small></span><span><strong>{a.service}</strong><small>{a.practitioner}</small></span><Badge tone={isOverdue(a) ? "overdue" : a.status}>{appointmentStatusLabel(a)}</Badge></div>) : <p className="empty-detail-copy">No visit history recorded yet.</p>}</section></div><div className="detail-actions-bar"><button type="button" className="button secondary" onClick={() => setDialog({ kind: "editPatient", patient: dialog.patient })}><FileText size={16}/>Edit Patient</button><button className="button primary" onClick={() => openBook(undefined, dialog.patient)}><CalendarDays size={16}/>Book Appointment</button><button type="button" className="button danger" onClick={() => { const target = dialog.patient; setDialog(null); setDeletePatientTarget({ id: target.id, name: target.name }); }}><Trash2 size={16}/>Delete Patient</button></div></div>; })()}
        </Modal>)}
      {showUploadPanel && isDoctor && (<Modal className="care-modal upload-document-modal" title="Upload Document" subtitle="Upload clinical documents, reports, scans or forms for the patient." onClose={() => { setShowUploadPanel(false); setUploadDefaultPatientId(undefined); }}>
          <UploadDocumentForm patients={data.patients} appointments={data.appointments} patientCode={patientCode} defaultPatientId={uploadDefaultPatientId} onCancel={() => { setShowUploadPanel(false); setUploadDefaultPatientId(undefined); }} onDone={() => { setShowUploadPanel(false); setUploadDefaultPatientId(undefined); setToast({ ok: true, message: "Document uploaded successfully." }); router.refresh(); }}/>
        </Modal>)}
      {confirmLogout && (<div className="logout-modal-backdrop" role="presentation" onKeyDown={(event) => {
          if (event.key === "Escape") setConfirmLogout(false);
        }}>
          <div className="logout-confirmation" role="dialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description">
            <button type="button" className="logout-close" aria-label="Cancel log out" onClick={() => setConfirmLogout(false)} disabled={signingOut}>
              <X size={17}/>
            </button>
            <div className="logout-confirmation-icon" aria-hidden="true">
              <LogOut size={30}/>
            </div>
            <h2 id="logout-title">Log out?</h2>
            <p id="logout-description">Are you sure you want to log out of your MindSpine account?</p>
            <div className="logout-confirmation-actions">
              <button type="button" className="logout-cancel" autoFocus onClick={() => setConfirmLogout(false)} disabled={signingOut}>Cancel</button>
              <button type="button" className="logout-confirm" disabled={signingOut} onClick={() => startSignOut(async () => {
                  try {
                    await logout();
                    router.refresh();
                  } catch {
                    setConfirmLogout(false);
                    setToast({ ok: false, message: "Unable to log out. Please try again." });
                  }
                })}>{signingOut ? "Logging out…" : "Log out"}</button>
            </div>
          </div>
        </div>)}
      {deletePatientTarget && (<div className="logout-modal-backdrop" role="presentation" onKeyDown={(event) => {
          if (event.key === "Escape") setDeletePatientTarget(null);
        }}>
          <div className="logout-confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-patient-title" aria-describedby="delete-patient-description">
            <button type="button" className="logout-close" aria-label="Cancel" onClick={() => setDeletePatientTarget(null)} disabled={pending}>
              <X size={17}/>
            </button>
            <div className="logout-confirmation-icon" aria-hidden="true">
              <Trash2 size={30}/>
            </div>
            <h2 id="delete-patient-title">Delete {deletePatientTarget.name}?</h2>
            <p id="delete-patient-description">This deactivates the patient&apos;s account and removes them from your Patients list. Their appointments and clinical records are kept for your audit history.</p>
            <div className="logout-confirmation-actions">
              <button type="button" className="logout-cancel" autoFocus onClick={() => setDeletePatientTarget(null)} disabled={pending}>Cancel</button>
              <button type="button" className="logout-confirm" disabled={pending} onClick={() => { const target = deletePatientTarget; action("deletePatient", { id: target.id }, false); setDeletePatientTarget(null); }}>{pending ? "Deleting…" : "Delete Patient"}</button>
            </div>
          </div>
        </div>)}
      {deleteApptTarget && (<div className="logout-modal-backdrop" role="presentation" onKeyDown={(event) => {
          if (event.key === "Escape") setDeleteApptTarget(null);
        }}>
          <div className="logout-confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-appt-title" aria-describedby="delete-appt-description">
            <button type="button" className="logout-close" aria-label="Cancel" onClick={() => setDeleteApptTarget(null)} disabled={pending}>
              <X size={17}/>
            </button>
            <div className="logout-confirmation-icon" aria-hidden="true">
              <Trash2 size={30}/>
            </div>
            <h2 id="delete-appt-title">Delete this appointment?</h2>
            <p id="delete-appt-description">{deleteApptTarget.label} will be permanently removed. This cannot be undone.</p>
            <div className="logout-confirmation-actions">
              <button type="button" className="logout-cancel" autoFocus onClick={() => setDeleteApptTarget(null)} disabled={pending}>Cancel</button>
              <button type="button" className="logout-confirm" disabled={pending} onClick={() => { const target = deleteApptTarget; action("deleteAppointment", { id: target.id }, false); setDeleteApptTarget(null); }}>{pending ? "Deleting…" : "Delete Entry"}</button>
            </div>
          </div>
        </div>)}
      {editApptTarget && (<Modal className="care-modal edit-appointment-modal" title="Edit Appointment Details" subtitle="Update the appointment type or reason for this visit." onClose={() => setEditApptTarget(null)}>
          <form className="care-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); action("editAppointment", { id: editApptTarget.id, service: String(f.get("service")), reason: String(f.get("reason") || "") }, false); setEditApptTarget(null); }}>
            <label>Appointment type<select name="service" defaultValue={editApptTarget.service} required><option value="Physiotherapy session">Physiotherapy session · Rs 1,000</option><option value="Initial consultation">Initial consultation · Rs 1,500</option><option value="Chiropractic adjustment">Chiropractic adjustment · Rs 1,000</option><option value="Progress review">Progress review · Rs 800</option></select></label>
            <label>Reason for visit<textarea name="reason" rows={3} defaultValue={editApptTarget.reason} placeholder="Enter reason for visit..."/></label>
            <div className="logout-confirmation-actions edit-appt-actions">
              <button type="button" className="logout-cancel" onClick={() => setEditApptTarget(null)} disabled={pending}>Cancel</button>
              <button type="submit" className="button primary" disabled={pending}>{pending ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </Modal>)}
    </div>);
}
function toDMY(value: string | null | undefined) {
    if (!value) return "—";
    const parsed = new Date(value.endsWith("Z") || value.includes("+") ? value : value.replace(" ", "T") + "Z");
    if (Number.isNaN(parsed.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed).replace(/\//g, "-");
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
