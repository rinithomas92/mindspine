"use client";
import {useMemo, useState, useEffect} from 'react';
import {Search, ChevronRight, ExternalLink, FileText, ClipboardList, CalendarDays, CreditCard, Paperclip} from 'lucide-react';
import type {AppData, User, Appointment, ClinicalNote} from '@/lib/types';
import {readAssessment, formTitle} from '@/lib/assessment';
import {physioTitle, type PhysioInput, type PhysioRecord} from '@/lib/physio';
import {date, time, Avatar, Badge, Empty} from './ui';


const patientCode = (p: User) => '#P-' + (p.id.replace(/\D/g, '').slice(-3).padStart(3, '0') || p.id.toUpperCase().slice(0, 3));

type TimelineItem = {
 id: string;
 isoDate: string;
 kind: 'evaluation' | 'appointment' | 'plan' | 'session' | 'discharge';
 title: string;
 summary: string;
 clinician: string;
 shared?: boolean;
 printHref?: string;
 recordId?: string;
};

export default function PhysioWorkflow({data, pending, onSave, onDeleteRecord, onEvaluation, onHistory, onBook, onBilling}: {data: AppData; pending: boolean; onSave: (payload: unknown) => Promise<boolean>; onDeleteRecord: (id: string) => void; onEvaluation: () => void; onHistory: (patient: User) => void; onBook: () => void; onBilling: () => void}) {
 const patientView = data.user.role === 'patient';
 const [patientId, setPatientId] = useState(patientView ? data.user.id : '');
 useEffect(() => {
  if (patientView) return;
  try {
   const saved = sessionStorage.getItem('ms-journey-patient');
   if (saved && data.patients.some(p => p.id === saved)) setPatientId(saved);
  } catch { /* sessionStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);
 const [query, setQuery] = useState('');
 const [kind, setKind] = useState<PhysioInput['kind']>('plan');
 const [assessmentId, setAssessmentId] = useState('');
 const [timelineFilter, setTimelineFilter] = useState<'all' | 'evaluation' | 'appointment' | 'plan' | 'session' | 'discharge'>('all');

 const patient = data.patients.find(p => p.id === patientId);
 const evaluations = data.notes.filter(n => n.patient_id === patientId && readAssessment(n.assessment_json));
 const records = data.physioRecords.filter(r => r.patient_id === patientId);
 const visits = data.appointments.filter(a => a.patient_id === patientId);
 const latestVisit = visits.filter(a => new Date(a.starts_at).getTime() <= Date.now()).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
 const patientDocs = data.files.filter(f => f.patient_id === patientId);
 const editable = data.user.role === 'practitioner' && data.user.specialty === 'physiotherapist';

 const matches = useMemo(() => {
  const q = query.trim().toLowerCase();
  const pool = patientView ? [] : data.patients.filter(p => p.active);
  const filtered = q ? pool.filter(p => `${p.name} ${p.phone} ${patientCode(p)} ${p.id}`.toLowerCase().includes(q)) : pool;
  return filtered.slice(0, 8);
 }, [query, data.patients, patientView]);

 const timeline: TimelineItem[] = useMemo(() => {
  const items: TimelineItem[] = [
   ...evaluations.map((n: ClinicalNote): TimelineItem => ({
    id: 'eval-' + n.id,
    isoDate: n.created_at,
    kind: 'evaluation',
    title: formTitle(readAssessment(n.assessment_json)?.type),
    summary: n.diagnosis || n.notes || 'Evaluation completed.',
    clinician: n.practitioner,
    shared: !!n.published,
    printHref: `/api/reports?type=note&id=${n.id}`,
   })),
   ...visits.map((a: Appointment): TimelineItem => ({
    id: 'apt-' + a.id,
    isoDate: a.starts_at,
    kind: 'appointment',
    title: 'Appointment',
    summary: a.service + (a.status === 'completed' ? ' · Completed' : a.status === 'cancelled' ? ' · Cancelled' : new Date(a.starts_at) <= new Date() ? ' · Overdue' : ' · Upcoming'),
    clinician: a.practitioner,
   })),
   ...records.map((r: PhysioRecord): TimelineItem => {
    const payload = JSON.parse(r.payload);
    const summaryField = r.kind === 'plan' ? payload.goals : payload.response;
    return {
     id: 'phy-' + r.id,
     isoDate: payload.date || r.created_at,
     kind: r.kind,
     title: physioTitle(r.kind),
     summary: summaryField || 'Record saved.',
     clinician: r.practitioner,
     shared: !!r.published,
     printHref: `/api/reports?type=physio&id=${r.id}`,
     recordId: r.id,
    };
   }),
  ];
  return items.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
 }, [evaluations, visits, records]);

 const filteredTimeline = timelineFilter === 'all' ? timeline : timeline.filter(t => t.kind === timelineFilter || (timelineFilter === 'evaluation' && t.kind === 'evaluation'));

 const timelineBadgeTone = (k: TimelineItem['kind']) => k === 'evaluation' ? 'confirmed' : k === 'appointment' ? 'paid' : k === 'plan' ? 'info' : k === 'session' ? 'unpaid' : 'completed';

 function selectPatient(id: string) {
  setPatientId(id);
  setAssessmentId('');
  setQuery('');
  if (!patientView) {
   try { sessionStorage.setItem('ms-journey-patient', id); } catch { /* sessionStorage unavailable */ }
  }
 }

 const patientSearch = <div className="journey-search-field">
  <span className="field-label-text">Search patient</span>
  <div className="patient-search-wrap">
   <Search size={18} />
   <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by patient name, phone number or ID..." autoComplete="off" aria-label="Search patient" role="combobox" aria-expanded={!!query} aria-controls="journey-patient-results" />
   {query && <button type="button" className="journey-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}
  </div>
  {query.trim() && !patientView && <div className="patient-options" id="journey-patient-results" role="listbox">
   {matches.map(p => <button key={p.id} type="button" role="option" aria-selected={p.id === patientId} className={p.id === patientId ? 'selected' : ''} onClick={() => selectPatient(p.id)}>
    <Avatar name={p.name} />
    <span><strong>{p.name}</strong><small>{patientCode(p)}{p.phone ? ' · ' + p.phone : ''}{p.date_of_birth ? ' · ' + (new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()) + ' yrs' : ''}</small></span>
    <ChevronRight size={18} />
   </button>)}
   {!matches.length && <p>No matching patients found.</p>}
  </div>}
 </div>;

 if (!patient) {
  return <section className="physio-flow journey-screen">
   <div className="panel physio-intro journey-intro-panel">
    {!patientView && patientSearch}
   </div>
   <Empty title="Choose a patient to begin" description="Search and select a patient to view their physiotherapy journey, record sessions and plan follow-ups." />
  </section>;
 }

 const age = patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : undefined;

 const planRecords = records.filter(r => r.kind === 'plan');
 const MetricCards = () => <div className="journey-metric-grid">
  <article className="report-feature-card journey-metric-card"><span className="report-feature-icon mint"><CalendarDays size={22} /></span><div><strong className="journey-metric-value" aria-label={`${visits.length} visits`}>{visits.length}</strong><p>Visits</p></div><small>{latestVisit ? 'Last visit ' + date(latestVisit.starts_at, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No visits yet'}</small></article>
  <article className="report-feature-card journey-metric-card"><span className="report-feature-icon blue"><ClipboardList size={22} /></span><div><strong className="journey-metric-value" aria-label={`${evaluations.length} evaluations`}>{evaluations.length}</strong><p>Evaluations</p></div>{evaluations.length ? <button type="button" className="link-button" onClick={() => setTimelineFilter('evaluation')}>View latest <ChevronRight size={14} /></button> : (editable ? <button type="button" className="link-button" onClick={onEvaluation}>New evaluation <ChevronRight size={14} /></button> : <small>No evaluations yet</small>)}</article>
  <article className="report-feature-card journey-metric-card"><span className="report-feature-icon peach"><FileText size={22} /></span><div><strong className="journey-metric-value" aria-label={`${planRecords.length} rehabilitation plans`}>{planRecords.length}</strong><p>Rehabilitation plans</p></div>{planRecords.length ? <button type="button" className="link-button" onClick={() => setTimelineFilter('plan')}>View latest <ChevronRight size={14} /></button> : (editable && evaluations.length ? <button type="button" className="link-button" onClick={() => document.getElementById('record-next-step')?.scrollIntoView({ behavior: 'smooth' })}>Add plan <ChevronRight size={14} /></button> : <small>No plans yet</small>)}</article>
  <article className="report-feature-card journey-metric-card"><span className="report-feature-icon lavender"><Paperclip size={22} /></span><div><strong className="journey-metric-value" aria-label={`${patientDocs.length} documents`}>{patientDocs.length}</strong><p>Documents</p></div><button type="button" className="link-button" onClick={() => onHistory(patient)}>{patientDocs.length ? 'View documents' : 'Upload document'} <ChevronRight size={14} /></button></article>
 </div>;

 return <section className="physio-flow journey-screen">
  <div className="panel physio-intro journey-intro-panel">
   {!patientView && patientSearch}
  </div>

  <section className="panel journey-patient-card">
   <div className="person detail-person"><Avatar name={patient.name} size="large" /><div><h3>{patient.name}</h3><p>{patientCode(patient)}{patient.gender ? ' · ' + patient.gender : ''}{age ? ' · ' + age + ' yrs' : ''}{patient.phone ? ' · ' + patient.phone : ''}</p></div></div>
   <button type="button" className="button secondary" onClick={() => onHistory(patient)}>View patient profile <ExternalLink size={15} /></button>
  </section>

  <MetricCards />

  <div className="journey-actions">
   {editable && <button className="button primary" type="button" onClick={() => onHistory(patient)}><FileText size={16} />Review history &amp; documents</button>}
   {editable && <button className="button secondary" type="button" onClick={onEvaluation}><ClipboardList size={16} />New evaluation</button>}
   <button className="button secondary" type="button" onClick={onBook}><CalendarDays size={16} />Book next visit</button>
   <button className="button secondary" type="button" onClick={onBilling}><CreditCard size={16} />Bills &amp; invoices</button>
  </div>

  <section className="panel journey-section">
   <h3>Evaluations</h3>
   <p className="journey-section-note">Standard physiotherapy and chiropractic evaluations retain their existing fields and progress sheets.</p>
   {evaluations.length ? <div className="journey-evaluation-list">{evaluations.map(n => <div className="slot-row journey-evaluation-row" key={n.id}>
     <span><strong>{formTitle(readAssessment(n.assessment_json)?.type)}</strong><small>{date(n.created_at)} · {n.practitioner} · {n.published ? 'Shared' : 'Draft'}</small></span>
     <a target="_blank" rel="noreferrer" href={`/api/reports?type=note&id=${n.id}`} className="link-button">Print / PDF</a>
    </div>)}</div> : <Empty title="No evaluations yet" description="Book a visit, then complete either evaluation form." action={editable ? <button className="button primary" type="button" onClick={onEvaluation}>New evaluation</button> : undefined} />}
  </section>

  {editable && evaluations.length > 0 && <details className="clinical-accordion journey-record-accordion" id="record-next-step" open>
   <summary><span>Record the next step</span><span className="clinical-accordion-chevron">›</span></summary>
   <div className="clinical-accordion-body">
    <p className="journey-section-note">Each save adds a dated record. Earlier plans and progress remain available.</p>
    <form key={patientId} onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const ok = await onSave({ ...Object.fromEntries(f), assessmentId, kind, published: f.get('published') === 'on' }); if (ok) form.reset(); }}>
     <fieldset disabled={pending} className="journey-record-fieldset">
      <div className="journey-record-top">
       <label><span className="field-label-text">Record type</span><select value={kind} onChange={e => setKind(e.target.value as PhysioInput['kind'])}><option value="plan">Rehabilitation plan</option><option value="session">Session progress</option><option value="discharge">Discharge summary</option></select></label>
       <label><span className="field-label-text">Related evaluation</span><select required value={assessmentId} onChange={e => setAssessmentId(e.target.value)}><option value="">Choose an evaluation</option>{evaluations.map(n => <option key={n.id} value={n.id}>{formTitle(readAssessment(n.assessment_json)?.type)} · {date(n.created_at)} · {n.diagnosis}</option>)}</select></label>
       <label><span className="field-label-text">Record date</span><input name="date" type="date" defaultValue={new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)} required /></label>
      </div>

      {kind === 'plan' ? <>
       <div className="journey-record-pair">
        <label><span className="field-label-text">Goals</span><textarea name="goals" rows={3} required maxLength={5000} placeholder="e.g. Improve mobility, reduce pain..." /></label>
        <label><span className="field-label-text">Interventions</span><textarea name="interventions" rows={3} required maxLength={5000} placeholder="e.g. Manual therapy, exercises..." /></label>
       </div>
       <div className="journey-record-pair">
        <label><span className="field-label-text">Home exercises</span><textarea name="exercises" rows={3} maxLength={5000} placeholder="e.g. 3 sets of 10..." /></label>
        <label><span className="field-label-text">Frequency and duration</span><input name="frequency" required maxLength={200} placeholder="e.g. 3 times a week for 4 weeks" /></label>
       </div>
       <div className="journey-record-pair">
        <label><span className="field-label-text">Precautions</span><textarea name="precautions" rows={3} maxLength={5000} placeholder="e.g. Avoid high impact activities..." /></label>
        <label><span className="field-label-text">Milestones and outcome measures</span><textarea name="milestones" rows={3} maxLength={5000} placeholder="e.g. Pain scale, range of motion..." /></label>
       </div>
      </> : <>
       <div className="journey-record-pair">
        <label><span className="field-label-text">{kind === 'session' ? 'Treatment delivered' : 'Treatment summary'}</span><textarea name="interventions" rows={3} maxLength={5000} /></label>
        <label><span className="field-label-text">{kind === 'session' ? 'Patient response' : 'Discharge outcome'}</span><textarea name="response" rows={3} required maxLength={5000} /></label>
       </div>
       <div className="journey-record-pair">
        <label><span className="field-label-text">Pain score (0-10)</span><input name="pain" type="number" min="0" max="10" step="0.1" /></label>
        <label><span className="field-label-text">Functional progress</span><textarea name="function" rows={3} maxLength={5000} /></label>
       </div>
       <div className="journey-record-pair">
        <label><span className="field-label-text">Milestones and outcome measures</span><textarea name="milestones" rows={3} maxLength={5000} /></label>
        <label><span className="field-label-text">Review / follow-up date</span><input name="reviewDate" type="date" /></label>
       </div>
      </>}

      {kind === 'plan' ? <div className="journey-record-pair">
       <label><span className="field-label-text">Next actions</span><textarea name="nextActions" rows={3} maxLength={5000} placeholder="e.g. Review in 2 weeks" /></label>
       <label><span className="field-label-text">Review / follow-up date</span><input name="reviewDate" type="date" /></label>
      </div> : <label className="journey-review-date"><span className="field-label-text">{kind === 'discharge' ? 'Discharge advice and next actions' : 'Next actions'}</span><textarea name="nextActions" rows={3} required maxLength={5000} /></label>}

      <label className="checkbox-label"><input name="published" type="checkbox" />Share this record with the patient</label>
      <p className="form-note">Sharing requires the related evaluation to be released. A follow-up date records the plan; use Book next visit to reserve a slot.</p>
      <button className="button primary" disabled={pending}>{pending ? 'Saving…' : `Save ${physioTitle(kind).toLowerCase()}`}</button>
     </fieldset>
    </form>
   </div>
  </details>}

  <section className="panel journey-section">
   <div className="journey-timeline-head">
    <h3>Care timeline</h3>
    <select aria-label="Filter timeline" value={timelineFilter} onChange={e => setTimelineFilter(e.target.value as typeof timelineFilter)} className="journey-timeline-filter">
     <option value="all">All records</option>
     <option value="evaluation">Evaluations</option>
     <option value="appointment">Appointments</option>
     <option value="plan">Rehabilitation plans</option>
     <option value="session">Session progress</option>
     <option value="discharge">Discharge summaries</option>
    </select>
   </div>
   {filteredTimeline.length ? <ol className="journey-timeline">{filteredTimeline.map(item => <li key={item.id} className="journey-timeline-item">
     <div className="journey-timeline-date"><strong>{date(item.isoDate, { day: 'numeric', month: 'short' })}</strong><small>{date(item.isoDate, { year: 'numeric' })}</small></div>
     <div className="journey-timeline-body">
      <div className="journey-timeline-title-row"><strong>{item.title}</strong><Badge tone={timelineBadgeTone(item.kind)}>{item.kind === 'evaluation' ? 'Evaluation' : item.kind === 'appointment' ? 'Visit' : physioTitle(item.kind)}</Badge></div>
      <p>{item.summary}</p>
      <small>{item.clinician}{item.shared !== undefined ? (item.shared ? ' · Shared with patient' : ' · Clinical draft') : ''}</small>
      {item.printHref && <a href={item.printHref} target="_blank" rel="noreferrer" className="link-button">Print / PDF</a>}
      {editable && item.recordId && <button type="button" className="link-button journey-timeline-delete" disabled={pending} onClick={() => { if (window.confirm('Delete this record? This cannot be undone.')) onDeleteRecord(item.recordId!); }}>Delete</button>}
     </div>
    </li>)}</ol> : <Empty title="No timeline records yet" description="Evaluations, visits and rehabilitation records will appear here as they are added." />}
   <button type="button" className="button secondary journey-view-all" onClick={() => onHistory(patient)}>View all records <ChevronRight size={15} /></button>
  </section>
 </section>;
}
