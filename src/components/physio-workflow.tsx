"use client";
import {useState} from 'react';
import type {AppData,User} from '@/lib/types';
import {readAssessment,formTitle} from '@/lib/assessment';
import {physioLines,physioTitle,type PhysioInput} from '@/lib/physio';
import {date,Empty} from './ui';

export default function PhysioWorkflow({data,pending,onSave,onEvaluation,onHistory,onBook,onBilling}:{data:AppData;pending:boolean;onSave:(payload:unknown)=>void;onEvaluation:()=>void;onHistory:(patient:User)=>void;onBook:()=>void;onBilling:()=>void}) {
  const patientView=data.user.role==='patient';
  const [patientId,setPatientId]=useState(patientView?data.user.id:'');
  const [kind,setKind]=useState<PhysioInput['kind']>('plan');
  const [assessmentId,setAssessmentId]=useState('');
  const patient=data.patients.find(p=>p.id===patientId);
  const evaluations=data.notes.filter(n=>n.patient_id===patientId&&readAssessment(n.assessment_json));
  const records=data.physioRecords.filter(r=>r.patient_id===patientId);
  const visits=data.appointments.filter(a=>a.patient_id===patientId);
  const latest=[...records].sort((a,b)=>JSON.parse(b.payload).date.localeCompare(JSON.parse(a.payload).date));
  const editable=data.user.role==='practitioner'&&data.user.specialty==='physiotherapist';
  return <section className="physio-flow">
    <div className="panel physio-intro"><h2>Physiotherapy journey</h2><p>Review history, evaluate, plan rehabilitation, record each session and arrange follow-up.</p>
      {!patientView && <label>Patient<select value={patientId} onChange={e=>{setPatientId(e.target.value);setAssessmentId('');}}><option value="">Choose a patient</option>{data.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <ol className="physio-steps">{['Patient & history','Appointment','Evaluation','Rehabilitation plan','Session progress','Report & follow-up'].map(step=><li key={step}>{step}</li>)}</ol>
    </div>
    {!patient ? <Empty title="Choose a patient to begin" description="Add a patient from the page header, or select someone already in your care."/> : <>
      <section className="panel physio-intro"><h3>{patient.name}</h3><p>{visits.length} visits · {evaluations.length} evaluations · {records.length} rehabilitation records</p><div className="physio-actions">
        {editable&&<><button className="button secondary" onClick={()=>onHistory(patient)}>Review history & documents</button><button className="button secondary" onClick={onEvaluation}>New evaluation</button></>}
        <button className="button secondary" onClick={onBook}>Book next visit</button><button className="button secondary" onClick={onBilling}>Bills & invoices</button>
      </div></section>
      <section className="panel physio-intro"><h3>Evaluations</h3><p>Standard physiotherapy and chiropractic evaluation retain their existing fields and progress sheets.</p>
        {evaluations.length?evaluations.map(n=><div className="slot-row" key={n.id}><span><strong>{formTitle(readAssessment(n.assessment_json)?.type)}</strong><small>{date(n.created_at)} · {n.practitioner} · {n.published?'Shared':'Draft'}</small></span><a target="_blank" rel="noreferrer" href={`/api/reports?type=note&id=${n.id}`}>Print / PDF</a></div>):<p>No evaluation yet. Book a visit, then complete either evaluation form.</p>}
      </section>
      {editable&&evaluations.length>0&&<section className="panel physio-intro"><h3>Record the next step</h3><p>Each save adds a dated record. Earlier plans and progress remain available.</p>
        <label>Record type<select value={kind} onChange={e=>setKind(e.target.value as PhysioInput['kind'])}><option value="plan">Rehabilitation plan</option><option value="session">Session progress</option><option value="discharge">Discharge summary</option></select></label>
        <form key={`${patientId}-${kind}`} action={f=>{onSave({...Object.fromEntries(f),assessmentId,kind,published:f.get('published')==='on'});}}><fieldset disabled={pending}>
          <label>Related evaluation<select required value={assessmentId} onChange={e=>setAssessmentId(e.target.value)}><option value="">Choose an evaluation</option>{evaluations.map(n=><option key={n.id} value={n.id}>{formTitle(readAssessment(n.assessment_json)?.type)} · {date(n.created_at)} · {n.diagnosis}</option>)}</select></label>
          <label>Record date<input name="date" type="date" defaultValue={new Date(Date.now()+330*60000).toISOString().slice(0,10)} required/></label>
          {kind==='plan'?<><label>Goals<textarea name="goals" required maxLength={5000}/></label><label>Interventions<textarea name="interventions" required maxLength={5000}/></label><label>Home exercises<textarea name="exercises" maxLength={5000}/></label><label>Frequency and duration<input name="frequency" required maxLength={200}/></label><label>Precautions<textarea name="precautions" maxLength={5000}/></label></>:<><label>{kind==='session'?'Treatment delivered':'Treatment summary'}<textarea name="interventions" maxLength={5000}/></label><label>{kind==='session'?'Patient response':'Discharge outcome'}<textarea name="response" required maxLength={5000}/></label><label>Pain score (0-10)<input name="pain" type="number" min="0" max="10" step="0.1"/></label><label>Functional progress<textarea name="function" maxLength={5000}/></label></>}
          <label>Milestones and outcome measures<textarea name="milestones" maxLength={5000}/></label><label>{kind==='discharge'?'Discharge advice and next actions':'Next actions'}<textarea name="nextActions" required={kind!=='plan'} maxLength={5000}/></label><label>Review / follow-up date<input name="reviewDate" type="date"/></label>
          <label className="checkbox-label"><input name="published" type="checkbox"/>Share this record with the patient</label><p className="form-note">Sharing requires the related evaluation to be released. A follow-up date records the plan; use Book next visit to reserve a slot.</p><button className="button primary" disabled={pending}>{pending?'Saving…':`Save ${physioTitle(kind).toLowerCase()}`}</button>
        </fieldset></form>
      </section>}
      <section className="panel physio-intro"><h3>Care timeline</h3>{latest.length?latest.map(r=><article className="physio-timeline-item" key={r.id}><h4>{physioTitle(r.kind)}</h4><p>{r.practitioner} · {r.published?'Shared with patient':'Clinical draft'}</p>{physioLines(r).slice(1).map((line,i)=><p className="history-text" key={i}>{line}</p>)}<a target="_blank" rel="noreferrer" href={`/api/reports?type=physio&id=${r.id}`}>Print / download PDF</a></article>):<p>No rehabilitation records yet.{patientView?' Shared plans and progress will appear here.':''}</p>}</section>
    </>}
  </section>;
}
