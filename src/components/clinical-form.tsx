"use client";
import {useState} from 'react';
import type {Appointment,User} from '@/lib/types';
import {evaluationGroups,standardGroups,formTitle,type Assessment} from '@/lib/assessment';
import {date} from './ui';
export default function ClinicalForm({appointments,patients,specialty,pending,onSave}:{appointments:Appointment[];patients:User[];specialty?:string;pending:boolean;onSave:(data:unknown)=>void}) {
 const isPhysio=specialty==='physiotherapist';
 const [type,setType]=useState<Assessment['type']>('physiotherapy');
 const [visit,setVisit]=useState('');
 const [fields,setFields]=useState<Record<string,string>>({evaluationDate:new Date(Date.now() + 330 * 60000).toISOString().slice(0,10)});
 const [progress,setProgress]=useState<{date:string;treatment:string}[]>([]);
 const [summary,setSummary]=useState({diagnosis:'',notes:'',plan:''});
 const [published,setPublished]=useState(false);
 const groups=type==='chiropractic'?evaluationGroups:standardGroups;
 const chosen=appointments.find(a=>a.id===visit);
 function submit(){
   const keys=groups.flatMap(g=>g.fields.map(f=>f[0] as string));
   onSave({...summary,appointmentId:visit,published,...(isPhysio?{assessment:{type,fields:Object.fromEntries(Object.entries(fields).filter(([k])=>keys.includes(k))),progress}}:{})});
 }
 return <form action={submit} className="evaluation-form"><fieldset disabled={pending}>
  {isPhysio && <label>Form type<select aria-label="Form type" value={type} onChange={e=>setType(e.target.value as Assessment['type'])}><option value="physiotherapy">Standard physiotherapy</option><option value="chiropractic">Chiropractic evaluation</option></select></label>}
  <label>Patient visit<select aria-label="Patient visit" name="appointmentId" required value={visit} onChange={e=>{setVisit(e.target.value);const a=appointments.find(a=>a.id===e.target.value);const p=patients.find(p=>p.id===a?.patient_id);setFields(old=>({...old,contact:p?.phone||''}));}}><option value="">Choose a visit</option>{appointments.filter(a=>a.status!=='cancelled').map(a=><option key={a.id} value={a.id}>{a.patient} · {date(a.starts_at)} · {a.service}</option>)}</select></label>
  {chosen && <p className="form-note">Patient: <strong>{chosen.patient}</strong></p>}
  {isPhysio && <><h3>{formTitle(type)}</h3><p className="form-note">Record the findings observed for this visit. Leave fields blank when not assessed.</p>{groups.map(group=><section className="evaluation-section" key={group.title}><h4>{group.title}</h4><div className="evaluation-fields">{group.fields.map(field=>{const [key,label]=field;const inputType=field.length>2?field[2]:'text';return <label key={key}>{label}{inputType==='date'||inputType==='number'?<input type={inputType} required={key==='evaluationDate'} min={inputType==='number'?0:undefined} max={inputType==='number'?130:undefined} value={fields[key]||''} onChange={e=>setFields({...fields,[key]:e.target.value})}/>:<textarea rows={2} maxLength={2000} value={fields[key]||''} onChange={e=>setFields({...fields,[key]:e.target.value})}/>}</label>;})}</div></section>)}</>}
  <label>{isPhysio?'Chief complaint (C/C)':'Clinical notes'}<textarea name="notes" rows={3} required maxLength={10000} value={summary.notes} onChange={e=>setSummary({...summary,notes:e.target.value})}/></label>
  <label>Diagnosis or clinical summary<input name="diagnosis" required maxLength={200} value={summary.diagnosis} onChange={e=>setSummary({...summary,diagnosis:e.target.value})}/></label>
  <label>Treatment plan<textarea name="plan" rows={3} required maxLength={10000} value={summary.plan} onChange={e=>setSummary({...summary,plan:e.target.value})}/></label>
  {isPhysio && <section className="evaluation-section"><h4>Progress sheet</h4><p className="form-note">Add dated treatment and progress entries for this assessment.</p>{progress.map((row,i)=><div className="progress-entry" key={i}><strong>Entry {i+1}</strong><label>Date<input aria-label={`Progress date ${i+1}`} type="date" required value={row.date} onChange={e=>setProgress(progress.map((r,n)=>n===i?{...r,date:e.target.value}:r))}/></label><label>Treatment & progress<textarea aria-label={`Treatment and progress ${i+1}`} required maxLength={3000} value={row.treatment} onChange={e=>setProgress(progress.map((r,n)=>n===i?{...r,treatment:e.target.value}:r))}/></label><button type="button" className="text-button" onClick={()=>setProgress(progress.filter((_,n)=>n!==i))}>Remove entry {i+1}</button></div>)}<button type="button" className="button secondary" disabled={progress.length>=40} onClick={()=>setProgress([...progress,{date:fields.evaluationDate||'',treatment:''}])}>Add progress entry</button></section>}
  <label className="checkbox-label"><input type="checkbox" name="published" checked={published} onChange={e=>setPublished(e.target.checked)}/>Release this report to the patient</label>
  <p className="form-note">Saved as a new record. For later progress or corrections, create a new assessment to preserve the original.</p>
  <button className="button primary full" disabled={pending}>{pending?'Saving…':'Save clinical note'}</button>
 </fieldset></form>;
}


