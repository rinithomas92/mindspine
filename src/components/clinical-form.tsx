"use client";
import {useState} from 'react';
import type {Appointment,User} from '@/lib/types';
import {evaluationGroups,standardGroups,formTitle,type Assessment} from '@/lib/assessment';
import {date} from './ui';
export default function ClinicalForm({appointments,patients,specialty,pending,onSave}:{appointments:Appointment[];patients:User[];specialty?:string;pending:boolean;onSave:(data:unknown)=>void}) {
 const isPhysio=specialty==='physiotherapist';
 const [type,setType]=useState<Assessment['type']>('physiotherapy');
 const [visit,setVisit]=useState('');
 const [patientMode,setPatientMode]=useState('existing');
 const [patientId,setPatientId]=useState('');
 const [newPatient,setNewPatient]=useState({name:'',email:'',phone:'',password:''});
 const [fields,setFields]=useState<Record<string,string>>({evaluationDate:new Date(Date.now() + 330 * 60000).toISOString().slice(0,10)});
 const [progress,setProgress]=useState<{date:string;treatment:string}[]>([]);
 const [summary,setSummary]=useState({diagnosis:'',notes:'',plan:''});
 const [published,setPublished]=useState(false);
 const groups=type==='chiropractic'?evaluationGroups:standardGroups;
 function submit(){
   const keys=groups.flatMap(g=>g.fields.map(f=>f[0] as string));
   onSave({...summary,...(patientMode==='new'?{newPatient}:{patientId,appointmentId:visit}),published,...(isPhysio?{assessment:{type,fields:Object.fromEntries(Object.entries(fields).filter(([k])=>keys.includes(k))),progress}}:{})});
 }
 return <form action={submit} className="evaluation-form"><fieldset disabled={pending}>
  {isPhysio && <label>Form type<select aria-label="Form type" value={type} onChange={e=>setType(e.target.value as Assessment['type'])}><option value="physiotherapy">Standard physiotherapy</option><option value="chiropractic">Chiropractic evaluation</option></select></label>}
  <section className="evaluation-section"><h4>Patient</h4>
  <label>Patient source<select aria-label="Patient source" value={patientMode} onChange={e=>{setPatientMode(e.target.value);setVisit('');setPatientId('');setFields(old=>({...old,contact:e.target.value==='new'?newPatient.phone:''}));}}><option value="existing">Existing patient</option><option value="new">Add new patient</option></select></label>
  {patientMode==='existing'?<>
    <label>Select patient<select aria-label="Select patient" required value={patientId} onChange={e=>{setPatientId(e.target.value);setVisit('');setFields(old=>({...old,contact:patients.find(p=>p.id===e.target.value)?.phone||''}));}}><option value="">Choose a patient</option>{patients.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}</select></label>
    {!patients.some(p=>p.active)&&<p className="form-note">No active patients yet. Choose Add new patient above to register one with this note.</p>}
    <label>Patient visit (optional)<select aria-label="Patient visit" name="appointmentId" value={visit} disabled={!patientId} onChange={e=>setVisit(e.target.value)}><option value="">No linked appointment</option>{appointments.filter(a=>a.patient_id===patientId&&a.status!=='cancelled').map(a=><option key={a.id} value={a.id}>{date(a.starts_at)} · {a.service}</option>)}</select></label>
  </>:<>
    <label>Full name<input aria-label="New patient full name" required maxLength={200} autoComplete="off" value={newPatient.name} onChange={e=>setNewPatient({...newPatient,name:e.target.value})}/></label>
    <label>Email<input aria-label="New patient email" type="email" required maxLength={200} autoComplete="off" value={newPatient.email} onChange={e=>setNewPatient({...newPatient,email:e.target.value})}/></label>
    <label>Phone (optional)<input aria-label="New patient phone" type="tel" maxLength={30} value={newPatient.phone} onChange={e=>{setNewPatient({...newPatient,phone:e.target.value});setFields(old=>({...old,contact:e.target.value}));}}/></label>
    <label>Initial password<input aria-label="New patient initial password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" value={newPatient.password} onChange={e=>setNewPatient({...newPatient,password:e.target.value})}/></label>
    <p className="form-note">The patient account and clinical note are saved together. Use at least 12 characters for the password and share it through your approved secure process.</p>
  </>}
  <p className="form-note">You can document care without an appointment. Saving a note does not create a booking or invoice.</p></section>
  {isPhysio && <><h3>{formTitle(type)}</h3><p className="form-note">Record the findings observed for this visit. Leave fields blank when not assessed.</p>{groups.map(group=><section className="evaluation-section" key={group.title}><h4>{group.title}</h4><div className="evaluation-fields">{group.fields.map(field=>{const [key,label]=field;const inputType=field.length>2?field[2]:'text';return <label key={key}>{label}{inputType==='date'||inputType==='number'?<input type={inputType} required={key==='evaluationDate'} min={inputType==='number'?0:undefined} max={inputType==='number'?130:undefined} value={fields[key]||''} onChange={e=>setFields({...fields,[key]:e.target.value})}/>:<textarea rows={2} maxLength={2000} value={fields[key]||''} onChange={e=>setFields({...fields,[key]:e.target.value})}/>}</label>;})}</div></section>)}</>}
  <label>{isPhysio?'Chief complaint (C/C)':'Clinical notes'}<textarea name="notes" rows={3} required maxLength={10000} value={summary.notes} onChange={e=>setSummary({...summary,notes:e.target.value})}/></label>
  <label>Diagnosis or clinical summary<input name="diagnosis" required maxLength={200} value={summary.diagnosis} onChange={e=>setSummary({...summary,diagnosis:e.target.value})}/></label>
  <label>Treatment plan<textarea name="plan" rows={3} required maxLength={10000} value={summary.plan} onChange={e=>setSummary({...summary,plan:e.target.value})}/></label>
  {isPhysio && <section className="evaluation-section"><h4>Progress sheet</h4><p className="form-note">Add dated treatment and progress entries for this assessment.</p>{progress.map((row,i)=><div className="progress-entry" key={i}><strong>Entry {i+1}</strong><label>Date<input aria-label={`Progress date ${i+1}`} type="date" required value={row.date} onChange={e=>setProgress(progress.map((r,n)=>n===i?{...r,date:e.target.value}:r))}/></label><label>Treatment & progress<textarea aria-label={`Treatment and progress ${i+1}`} required maxLength={3000} value={row.treatment} onChange={e=>setProgress(progress.map((r,n)=>n===i?{...r,treatment:e.target.value}:r))}/></label><button type="button" className="text-button" onClick={()=>setProgress(progress.filter((_,n)=>n!==i))}>Remove entry {i+1}</button></div>)}<button type="button" className="button secondary" disabled={progress.length>=40} onClick={()=>setProgress([...progress,{date:fields.evaluationDate||'',treatment:''}])}>Add progress entry</button></section>}
  <label className="checkbox-label"><input type="checkbox" name="published" checked={published} onChange={e=>setPublished(e.target.checked)}/>Release this report to the patient</label>
  <p className="form-note">Saved as a new record. For later progress or corrections, create a new assessment to preserve the original.</p>
  <button className="button primary full" disabled={pending}>{pending?'Saving…':patientMode==='new'?'Create patient & save clinical note':'Save clinical note'}</button>
 </fieldset></form>;
}


