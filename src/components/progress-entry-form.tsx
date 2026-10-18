"use client";
import {useState} from 'react';
import type {Appointment,ClinicalNote,User} from '@/lib/types';
import {formTitle,readAssessment} from '@/lib/assessment';
import {date,time,Avatar} from './ui';

const entryTypes = ['Treatment','Assessment','Follow-up','Review','Other'];

function FieldLabel({children, required: isRequired=false}:{children:React.ReactNode; required?:boolean}) {
 return <span className="field-label-text">{children}{isRequired && <span className="required-mark" aria-hidden="true">*</span>}</span>;
}

function Accordion({number,title,children}:{number:number;title:string;children:React.ReactNode}) {
 return <details className="clinical-accordion" open>
  <summary><span><b>{number}.</b> {title}</span><span className="clinical-accordion-chevron">›</span></summary>
  <div className="clinical-accordion-body">{children}</div>
 </details>;
}

export default function ProgressEntryForm({note,patient,appointments,clinicianName='Current clinician',specialty,pending,onSave,onCancel,editIndex}:{
 note: ClinicalNote;
 patient?: User;
 appointments: Appointment[];
 clinicianName?: string;
 specialty?: string;
 pending: boolean;
 onSave: (data: unknown) => void;
 onCancel: () => void;
 editIndex?: number;
}) {
 const assessment = readAssessment(note.assessment_json);
 const existing = editIndex !== undefined ? assessment?.progress[editIndex] : undefined;
 const visits = appointments.filter(a => a.patient_id === note.patient_id && a.status !== 'cancelled');
 const [entryDate,setEntryDate] = useState(existing?.date || new Date(Date.now() + 330 * 60000).toISOString().slice(0,10));
 const [sessionVisit,setSessionVisit] = useState(existing?.sessionVisit || '');
 const [entryType,setEntryType] = useState(existing?.entryType || 'Treatment');
 const [subjective,setSubjective] = useState(existing?.subjective || '');
 const [objective,setObjective] = useState(existing?.objective || '');
 const [treatmentProvided,setTreatmentProvided] = useState(existing?.treatmentProvided || '');
 const [patientResponse,setPatientResponse] = useState(existing?.patientResponse || '');
 const [planNextVisit,setPlanNextVisit] = useState(existing?.planNextVisit || '');
 const [visibleToPatient,setVisibleToPatient] = useState(existing?.visibleToPatient || false);
 const [touched,setTouched] = useState(false);
 const hasDetail = !!(treatmentProvided.trim()||subjective.trim()||objective.trim()||patientResponse.trim()||planNextVisit.trim());

 function submit() {
  setTouched(true);
  if(!entryDate || !hasDetail) return;
  onSave({
   noteId: note.id,
   ...(editIndex !== undefined ? {index: editIndex} : {}),
   date: entryDate,
   sessionVisit: sessionVisit || undefined,
   entryType: entryType || undefined,
   subjective: subjective.trim() || undefined,
   objective: objective.trim() || undefined,
   treatmentProvided: treatmentProvided.trim() || undefined,
   patientResponse: patientResponse.trim() || undefined,
   planNextVisit: planNextVisit.trim() || undefined,
   visibleToPatient,
  });
 }

 const EntryDetailsFields = <div className="progress-entry-fields-grid">
  <label><FieldLabel required>Entry Date</FieldLabel><input type="date" required value={entryDate} onChange={e=>setEntryDate(e.target.value)}/></label>
  <label><FieldLabel>Session / Visit (Optional)</FieldLabel><select value={sessionVisit} onChange={e=>setSessionVisit(e.target.value)}><option value="">No linked visit</option>{visits.map(a=><option key={a.id} value={a.id}>{date(a.starts_at)} · {a.service}</option>)}</select></label>
  <label><FieldLabel>Entry Type</FieldLabel><select value={entryType} onChange={e=>setEntryType(e.target.value)}>{entryTypes.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
 </div>;

 return <form className="progress-entry-form" onSubmit={e=>{e.preventDefault();submit();}}>
  <fieldset disabled={pending}>
   <section className="progress-context-summary">
    <div className="person detail-person"><Avatar name={note.patient} size="large"/><div><h3>{note.patient}</h3><p>{patient ? `${patient.gender||''} ${patient.date_of_birth?('· '+date(patient.date_of_birth, { day: "numeric", month: "short", year: "numeric" })):''}`.trim() : note.patient_id}</p></div></div>
    <div className="progress-context-grid">
     <span><small>Clinical Note</small><strong>{note.diagnosis || formTitle(assessment?.type)}</strong><small>{date(note.created_at)}, {time(note.created_at)}</small></span>
     <span><small>Form Type</small><strong>{formTitle(assessment?.type)}</strong></span>
     <span><small>Clinician</small><strong>{clinicianName}</strong><small>{specialty === 'physiotherapist' ? 'Physiotherapist' : specialty || ''}</small></span>
    </div>
   </section>

   <div className="clinical-desktop-only">
    <section className="clinical-detail-card progress-entry-details-card">
     <h3>Progress Entry Details</h3>
     {EntryDetailsFields}
     <div className="progress-entry-two-col">
      <label><FieldLabel>Subjective (Patient Report)</FieldLabel><textarea rows={3} placeholder="Enter patient's subjective report, e.g. pain level, symptoms, feedback..." value={subjective} onChange={e=>setSubjective(e.target.value)}/></label>
      <label><FieldLabel>Objective (Findings)</FieldLabel><textarea rows={3} placeholder="Enter objective findings, e.g. range of motion, strength, functional status..." value={objective} onChange={e=>setObjective(e.target.value)}/></label>
      <label><FieldLabel>Treatment Provided</FieldLabel><textarea rows={3} placeholder="Enter treatment provided, e.g. manual therapy, exercises, modalities..." value={treatmentProvided} onChange={e=>setTreatmentProvided(e.target.value)}/></label>
      <label><FieldLabel>Patient Response</FieldLabel><textarea rows={3} placeholder="Enter patient response, e.g. tolerated well, pain reduced, improvements..." value={patientResponse} onChange={e=>setPatientResponse(e.target.value)}/></label>
     </div>
     <label className="progress-entry-plan"><FieldLabel>Plan for Next Visit</FieldLabel><textarea rows={3} placeholder="Enter plan for next session, e.g. continue exercises, progress intensity..." value={planNextVisit} onChange={e=>setPlanNextVisit(e.target.value)}/></label>
     {touched && !hasDetail && <p className="form-error">Add at least one clinical detail (Subjective, Objective, Treatment Provided, Patient Response or Plan).</p>}
    </section>
   </div>

   <div className="clinical-compact-only">
    <div className="clinical-accordion-stack">
     <Accordion number={1} title="Entry Details">{EntryDetailsFields}</Accordion>
     <Accordion number={2} title="Subjective (Patient Report)"><textarea rows={3} placeholder="Enter patient's subjective report..." value={subjective} onChange={e=>setSubjective(e.target.value)}/></Accordion>
     <Accordion number={3} title="Objective (Findings)"><textarea rows={3} placeholder="Enter objective findings..." value={objective} onChange={e=>setObjective(e.target.value)}/></Accordion>
     <Accordion number={4} title="Treatment Provided"><textarea rows={3} placeholder="Enter treatment provided..." value={treatmentProvided} onChange={e=>setTreatmentProvided(e.target.value)}/></Accordion>
     <Accordion number={5} title="Patient Response"><textarea rows={3} placeholder="Enter patient response..." value={patientResponse} onChange={e=>setPatientResponse(e.target.value)}/></Accordion>
     <Accordion number={6} title="Plan for Next Visit"><textarea rows={3} placeholder="Enter plan for next session..." value={planNextVisit} onChange={e=>setPlanNextVisit(e.target.value)}/></Accordion>
    </div>
    {touched && !hasDetail && <p className="form-error">Add at least one clinical detail (Subjective, Objective, Treatment Provided, Patient Response or Plan).</p>}
   </div>

   <div className="progress-entry-footer">
    <label className="checkbox-label"><input type="checkbox" checked={visibleToPatient} onChange={e=>setVisibleToPatient(e.target.checked)}/>Visible to the patient</label>
    <div className="progress-entry-footer-actions">
     <button type="button" className="button secondary" onClick={onCancel} disabled={pending}>Cancel</button>
     <button className="button primary" disabled={pending}>{pending?'Saving...':editIndex !== undefined?'Save Changes':'Save Progress Entry'}</button>
    </div>
   </div>
  </fieldset>
 </form>;
}
