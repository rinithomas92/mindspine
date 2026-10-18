"use client";
import {useMemo, useState} from 'react';
import {ArrowLeft, FileText, Download, Search, ChevronRight} from 'lucide-react';
import type {Appointment,User} from '@/lib/types';
import {evaluationGroups,standardGroups,formTitle,type Assessment} from '@/lib/assessment';
import {date, Avatar} from './ui';

const required = <span className="required-mark" aria-hidden="true">*</span>;
const patientCode = (p: User) => '#P-' + (p.id.replace(/\D/g, '').slice(-3).padStart(3, '0') || p.id.toUpperCase().slice(0, 3));

const progressDetailFields: [string, string][] = [['subjective','Subjective (Patient Report)'],['objective','Objective (Findings)'],['treatmentProvided','Treatment Provided'],['patientResponse','Patient Response'],['planNextVisit','Plan for Next Visit']];
function ProgressEntryDetails({row}:{row:Assessment['progress'][number]}) {
 const r = row as unknown as Record<string,string|undefined>;
 const values = progressDetailFields.filter(([key]) => r[key]);
 if (!values.length) return null;
 return <dl className="progress-entry-preview-details">{values.map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{r[key]}</dd></div>)}</dl>;
}

function FieldLabel({children, required: isRequired=false}:{children:React.ReactNode; required?:boolean}) {
 return <span className="field-label-text">{children}{isRequired && required}</span>;
}

function FormPanel({number,title,id,children,className='',open=true}:{number:number;title:string;id:string;children:React.ReactNode;className?:string;open?:boolean}) {
 return <details id={id} className={"evaluation-section " + className} open={open}>
  <summary aria-controls={id + '-body'}><span><b>{number}.</b> {title}</span></summary>
  <div id={id + '-body'} className="evaluation-section-body">{children}</div>
 </details>;
}

const PField = ({label, children}:{label:string; children:React.ReactNode}) => <div className="clinical-detail-field"><dt>{label}</dt><dd className={!children ? 'muted' : ''}>{children || 'Not recorded'}</dd></div>;
const PSection = ({title, children, className=''}:{title:string; children:React.ReactNode; className?:string}) => <section className={'clinical-detail-card ' + className}><h3>{title}</h3>{children}</section>;
const PAccordion = ({title, children}:{title:string; children:React.ReactNode}) => <details className="clinical-accordion" open><summary>{title}<span className="clinical-accordion-chevron">›</span></summary><div className="clinical-accordion-body">{children}</div></details>;

function ClinicalPreview({patientName,patientMeta,fields,summary,type,progress,clinicianName,specialty,isPhysio,isEdit,noteId,onClose}:{
 patientName:string;
 patientMeta:string;
 fields:Record<string,string>;
 summary:{diagnosis:string;notes:string;plan:string};
 type:Assessment['type'];
 progress:Assessment['progress'];
 clinicianName:string;
 specialty?:string;
 isPhysio:boolean;
 isEdit:boolean;
 noteId?:string;
 onClose:()=>void;
}) {
 const groups = type==='chiropractic'?evaluationGroups:standardGroups;
 const byTitle = Object.fromEntries(groups.map(g=>[g.title,g]));
 const v = (key:string) => fields[key] || '';
 return <div className="clinical-note-detail-view clinical-note-preview-view">
  <div className="clinical-detail-title"><button className="icon-button clinical-back-icon" type="button" aria-label="Close preview" onClick={onClose}><ArrowLeft size={18}/></button><div><h3>Clinical Note Preview</h3><p>Review the clinical note before publishing or sharing.</p></div><div className="clinical-detail-actions">{isEdit && noteId && <a className="button secondary" href={'/api/reports?id=' + noteId + '&type=note'} target="_blank" rel="noreferrer"><Download size={16}/>Download PDF</a>}<button type="button" className="button primary" onClick={onClose}>Close Preview</button></div></div>
  <section className="clinical-patient-summary"><div className="person detail-person"><Avatar name={patientName || 'Patient'} size="large"/><div><h3>{patientName || 'Patient not selected'}</h3><p>{patientMeta}</p></div></div><div className="clinical-summary-strip"><span><small>Evaluation Date</small><strong>{fields.evaluationDate ? date(fields.evaluationDate) : 'Not set'}</strong></span><span><small>Form Type</small><strong>{formTitle(type)}</strong></span><span><small>Clinician</small><strong>{clinicianName}</strong></span><span><small>Specialty</small><strong>{specialty === 'physiotherapist' ? 'Physiotherapist' : specialty || 'Not recorded'}</strong></span><span><small>Status</small><strong>{isEdit ? 'Draft' : 'New'}</strong></span></div></section>

  <div className="clinical-desktop-only">
   <div className="clinical-overview-grid">
    {isPhysio && <PSection title="Patient Details"><dl><PField label="Age">{v('age')}</PField><PField label="Gender">{v('gender')}</PField><PField label="Contact">{v('contact')}</PField><PField label="Address">{v('address')}</PField><PField label="Profession">{v('profession')}</PField></dl></PSection>}
    <PSection title="Chief Complaint (C/C)" className="history-detail"><dl><PField label="Chief Complaint">{summary.notes}</PField>{isPhysio && <PField label="History of Present Illness (HOPI)">{v('hopi')}</PField>}</dl></PSection>
    {isPhysio && <PSection title="Medical History"><dl><PField label="Medical History">{v('medicalHistory')}</PField></dl></PSection>}
    {isPhysio && <PSection title="Surgical History"><dl><PField label="Surgical History">{v('surgicalHistory')}</PField></dl></PSection>}
    {isPhysio && <PSection title="Family History"><dl><PField label="Family History">{v('familyHistory')}</PField></dl></PSection>}
    {isPhysio && <PSection title="Examination"><dl className="clinical-detail-grid-list"><PField label="Blood Pressure (BP)">{v('bp')}</PField><PField label="Heart Rate (HR)">{v('hr')}</PField><PField label="Weight">{v('weight')}</PField><PField label="Height">{v('height')}</PField></dl></PSection>}
    {isPhysio && <PSection title="On Observation"><dl>{(byTitle['On Observation']?.fields||[]).map(([key,label])=><PField key={key} label={label}>{v(key)}</PField>)}</dl></PSection>}
    {isPhysio && <PSection title="On Palpation"><dl>{(byTitle['On Palpation']?.fields||[]).map(([key,label])=><PField key={key} label={label}>{v(key)}</PField>)}</dl></PSection>}
    {isPhysio && <PSection title="MMT"><dl>{(byTitle['MMT']?.fields||[]).map(([key,label])=><PField key={key} label={label}>{v(key)}</PField>)}</dl></PSection>}
    <PSection title="Clinical Summary" className="clinical-summary-detail"><dl><PField label="Diagnosis / Clinical Summary">{summary.diagnosis}</PField><PField label="Treatment Plan">{summary.plan}</PField></dl></PSection>
    {isPhysio && <PSection title="Progress Sheet">{progress.length ? <ol className="progress-timeline">{progress.map((row,i)=><li key={i}><strong>{row.date ? date(row.date) : 'No date'}</strong>{row.entryType && <small> · {row.entryType}</small>}<span>{row.treatment}</span><ProgressEntryDetails row={row}/></li>)}</ol> : <p className="muted">No progress entries yet.</p>}</PSection>}
   </div>
  </div>

  <div className="clinical-compact-only">
   <div className="clinical-accordion-stack">
    {isPhysio && <PAccordion title="Patient Details"><dl><PField label="Age">{v('age')}</PField><PField label="Gender">{v('gender')}</PField><PField label="Contact">{v('contact')}</PField><PField label="Address">{v('address')}</PField><PField label="Profession">{v('profession')}</PField></dl></PAccordion>}
    <PAccordion title="Chief Complaint &amp; History"><dl><PField label="Chief Complaint (C/C)">{summary.notes}</PField>{isPhysio && <PField label="History of Present Illness (HOPI)">{v('hopi')}</PField>}{isPhysio && <PField label="Medical History">{v('medicalHistory')}</PField>}{isPhysio && <PField label="Surgical History">{v('surgicalHistory')}</PField>}{isPhysio && <PField label="Family History">{v('familyHistory')}</PField>}</dl></PAccordion>
    {isPhysio && <PAccordion title="Examination"><dl className="clinical-detail-grid-list"><PField label="Blood Pressure (BP)">{v('bp')}</PField><PField label="Heart Rate (HR)">{v('hr')}</PField><PField label="Weight">{v('weight')}</PField><PField label="Height">{v('height')}</PField></dl></PAccordion>}
    {isPhysio && <PAccordion title="On Observation"><dl>{(byTitle['On Observation']?.fields||[]).map(([key,label])=><PField key={key} label={label}>{v(key)}</PField>)}</dl></PAccordion>}
    {isPhysio && <PAccordion title="On Palpation"><dl>{(byTitle['On Palpation']?.fields||[]).map(([key,label])=><PField key={key} label={label}>{v(key)}</PField>)}</dl></PAccordion>}
    {isPhysio && <PAccordion title="MMT"><dl>{(byTitle['MMT']?.fields||[]).map(([key,label])=><PField key={key} label={label}>{v(key)}</PField>)}</dl></PAccordion>}
    <PAccordion title="Clinical Summary"><dl><PField label="Diagnosis / Clinical Summary">{summary.diagnosis}</PField><PField label="Treatment Plan">{summary.plan}</PField></dl></PAccordion>
    {isPhysio && <PAccordion title="Progress Sheet">{progress.length ? <ol className="progress-timeline">{progress.map((row,i)=><li key={i}><strong>{row.date ? date(row.date) : 'No date'}</strong>{row.entryType && <small> · {row.entryType}</small>}<span>{row.treatment}</span><ProgressEntryDetails row={row}/></li>)}</ol> : <p className="muted">No progress entries yet.</p>}</PAccordion>}
   </div>
  </div>

  <div className="clinical-detail-bottom-actions clinical-compact-only">{isEdit && noteId && <a className="button secondary" href={'/api/reports?id=' + noteId + '&type=note'} target="_blank" rel="noreferrer"><Download size={16}/>Download PDF</a>}<button type="button" className="button primary wide" onClick={onClose}>Close Preview</button></div>
 </div>;
}

export default function ClinicalForm({appointments,patients,specialty,pending,onSave,onCancel,clinicianName='Current clinician',editNote}:{appointments:Appointment[];patients:User[];specialty?:string;pending:boolean;onSave:(data:unknown)=>void;onCancel?:()=>void;clinicianName?:string;editNote?:{id:string;patientId:string;appointmentId:string;diagnosis:string;notes:string;plan:string;published:boolean;assessment?:Assessment}}) {
 const isPhysio=specialty==='physiotherapist';
 const [type,setType]=useState<Assessment['type']>(editNote?.assessment?.type||'physiotherapy');
 const [visit,setVisit]=useState(editNote?.appointmentId||'');
 const [patientMode,setPatientMode]=useState('existing');
 const [patientId,setPatientId]=useState(editNote?.patientId||'');
 const [newPatient,setNewPatient]=useState({name:'',email:'',phone:'',password:''});
 const [fields,setFields]=useState<Record<string,string>>({evaluationDate:new Date(Date.now() + 330 * 60000).toISOString().slice(0,10),...(editNote?.assessment?.fields||{})});
 const [progress,setProgress]=useState<Assessment['progress']>(editNote?.assessment?.progress||[]);
 const [summary,setSummary]=useState({diagnosis:editNote?.diagnosis||'',notes:editNote?.notes||'',plan:editNote?.plan||''});
 const [published,setPublished]=useState(editNote?.published||false);
 const [preview,setPreview]=useState(false);
 const groups=type==='chiropractic'?evaluationGroups:standardGroups;
 const patientDetailGroup=groups[0];
 const groupByTitle=useMemo(()=>Object.fromEntries(groups.map(group=>[group.title,group])),[groups]);
 const selectedPatient=patients.find(p=>p.id===patientId);
 const [patientQuery,setPatientQuery]=useState(selectedPatient?selectedPatient.name:'');
 const patientMatches=useMemo(()=>{
  const q=patientQuery.trim().toLowerCase();
  if(!q)return [];
  return patients.filter(p=>p.active&&`${p.name} ${p.email} ${p.phone} ${p.id} ${patientCode(p)}`.toLowerCase().includes(q)).slice(0,8);
 },[patientQuery,patients]);
 const patientVisits=appointments.filter(a=>a.patient_id===patientId&&a.status!=='cancelled');
 function setField(key:string,value:string){setFields(old=>({...old,[key]:value}));}
 function selectPatient(patient:User){
  setPatientId(patient.id);
  setPatientQuery(patient.name);
  setVisit('');
  const age=patient.date_of_birth?String(new Date().getFullYear()-new Date(patient.date_of_birth).getFullYear()):'';
  setFields(old=>({...old,contact:patient.phone||'',gender:patient.gender||'',...(age?{age}:{})}));
 }
 function submit(nextPublished=published){
   const keys=groups.flatMap(g=>g.fields.map(f=>f[0] as string));
   onSave({...summary,...(editNote?{noteId:editNote.id}:{}),...(patientMode==='new'?{newPatient}:{patientId,appointmentId:visit}),published:nextPublished,...(isPhysio?{assessment:{type,fields:Object.fromEntries(Object.entries(fields).filter(([k])=>keys.includes(k))),progress}}:{})});
 }
 function renderField(key:string,label:string,kind:'input'|'textarea'|'number'='textarea',placeholder?:string){
   return <label><FieldLabel>{label}</FieldLabel>{kind==='textarea'?<textarea rows={2} maxLength={2000} placeholder={placeholder||'Enter details...'} value={fields[key]||''} onChange={e=>setField(key,e.target.value)}/>:<input type={kind==='number'?'number':'text'} min={kind==='number'?0:undefined} max={kind==='number'?130:undefined} placeholder={placeholder||''} value={fields[key]||''} onChange={e=>setField(key,e.target.value)}/>}</label>;
 }
 if (preview) {
   const patientName = patientMode==='existing' ? (selectedPatient?.name||'') : newPatient.name;
   const age = fields.age ? fields.age + ' years' : '';
   const gender = fields.gender || (patientMode==='existing' ? selectedPatient?.gender : '') || '';
   const patientMeta = [age,gender].filter(Boolean).join(' · ') || (selectedPatient ? selectedPatient.email : '');
   return <ClinicalPreview patientName={patientName} patientMeta={patientMeta} fields={fields} summary={summary} type={type} progress={progress} clinicianName={clinicianName} specialty={specialty} isPhysio={isPhysio} isEdit={!!editNote} noteId={editNote?.id} onClose={()=>setPreview(false)}/>;
 }
 return <form className="evaluation-form clinical-note-form" onSubmit={e=>{e.preventDefault();submit(published);}}><fieldset disabled={pending}>
  <div className="clinical-form-actions"><button type="button" className="button secondary" disabled={pending} onClick={()=>submit(false)}>Save Draft</button><button type="button" className="button secondary" onClick={()=>setPreview(!preview)}>Preview</button><button type="button" className="button primary" disabled={pending} onClick={()=>submit(published)}>{pending?'Saving...':editNote?'Update Clinical Note':published?'Save & Release to Patient':'Save Clinical Record'}</button></div>
  <div className="evaluation-grid clinical-note-grid">
   <FormPanel number={1} title="Patient & Visit" id="patient-visit" className="patient-visit-panel" open>
    <div className="evaluation-fields patient-visit-fields">
     {isPhysio && <label><FieldLabel required>Form Type</FieldLabel><select aria-label="Form type" value={type} onChange={e=>setType(e.target.value as Assessment['type'])}><option value="physiotherapy">Standard physiotherapy</option><option value="chiropractic">Chiropractic evaluation</option></select></label>}
     <label><FieldLabel required>Patient Source</FieldLabel><select aria-label="Patient Source" disabled={!!editNote} value={patientMode} onChange={e=>{setPatientMode(e.target.value);setVisit('');setPatientId('');setField('contact',e.target.value==='new'?newPatient.phone:'');}}><option value="existing">Existing Patient</option><option value="new">Add New Patient</option></select></label>
     {patientMode==='existing'?<label className="clinical-patient-search"><FieldLabel required>Select Patient</FieldLabel><div className="patient-search-wrap"><Search size={16}/><input type="search" required={!patientId} value={patientQuery} disabled={!!editNote} autoComplete="off" placeholder="Search patient by name, ID or phone..." aria-label="Select Patient" role="combobox" aria-expanded={!!patientQuery.trim()&&!patientId} onChange={e=>{setPatientQuery(e.target.value);if(patientId){setPatientId('');setVisit('');}}}/></div>{patientQuery.trim()&&!patientId&&!editNote&&<div className="patient-options" role="listbox">{patientMatches.map(p=><button key={p.id} type="button" role="option" onClick={()=>selectPatient(p)}><Avatar name={p.name}/><span><strong>{p.name}</strong><small>{p.email}{p.phone?' · '+p.phone:''}</small></span><ChevronRight size={16}/></button>)}{!patientMatches.length&&<p>No matching patients found.</p>}</div>}</label>:<><label><FieldLabel required>Full Name</FieldLabel><input aria-label="New patient full name" required maxLength={200} autoComplete="off" value={newPatient.name} onChange={e=>setNewPatient({...newPatient,name:e.target.value})}/></label><label><FieldLabel required>Email</FieldLabel><input aria-label="New patient email" type="email" required maxLength={200} autoComplete="off" value={newPatient.email} onChange={e=>setNewPatient({...newPatient,email:e.target.value})}/></label></>}
     <label><FieldLabel>Linked Visit</FieldLabel><select aria-label="Patient Visit" name="appointmentId" value={visit} disabled={patientMode==='existing'&&!patientId} onChange={e=>setVisit(e.target.value)}><option value="">No linked appointment</option>{patientVisits.map(a=><option key={a.id} value={a.id}>{date(a.starts_at)} · {a.service}</option>)}</select></label>
     <label><FieldLabel required>Evaluation Date</FieldLabel><input type="date" required value={fields.evaluationDate||''} onChange={e=>setField('evaluationDate',e.target.value)}/></label>
     <label><FieldLabel required>Clinician</FieldLabel><input value={clinicianName} readOnly aria-readonly="true"/></label>
     {patientMode==='new' && <><label><FieldLabel>Phone</FieldLabel><input aria-label="New patient phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} value={newPatient.phone} onChange={e=>{const digits=e.target.value.replace(/\D/g,'');setNewPatient({...newPatient,phone:digits});setField('contact',digits);}}/></label><label><FieldLabel required>Initial Password</FieldLabel><input aria-label="New patient initial password" type="password" minLength={8} maxLength={15} required autoComplete="new-password" value={newPatient.password} onChange={e=>setNewPatient({...newPatient,password:e.target.value})}/></label></>}
    </div>
    <p className="form-note">You can document care without an appointment. Linking a visit does not create a booking or invoice.</p>
   </FormPanel>
   {isPhysio && <FormPanel number={2} title="Patient Details" id="patient-details" className="patient-details-panel"><div className="evaluation-fields patient-details-fields"><label><FieldLabel>Name</FieldLabel><input value={patientMode==='existing'?(selectedPatient?.name||''):newPatient.name} placeholder="Enter name" readOnly={patientMode==='existing'} onChange={e=>setNewPatient({...newPatient,name:e.target.value})}/></label>{renderField('age','Age','number','Enter age')}<label><FieldLabel>Gender</FieldLabel><select value={fields.gender||''} onChange={e=>setField('gender',e.target.value)}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option></select></label><label><FieldLabel>Contact</FieldLabel><input type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={10} placeholder="Enter contact" value={fields.contact||''} onChange={e=>setField('contact',e.target.value.replace(/\D/g,''))}/></label>{renderField('address','Address','textarea','Enter address')}{renderField('profession','Profession','textarea','Enter profession')}</div></FormPanel>}
   {isPhysio && <FormPanel number={3} title="Chief Complaint & History" id="history" className="history-panel"><div className="evaluation-fields history-fields"><label><FieldLabel required>Chief Complaint (C/C)</FieldLabel><textarea name="notes" rows={2} required maxLength={10000} placeholder="Enter chief complaint..." value={summary.notes} onChange={e=>setSummary({...summary,notes:e.target.value})}/></label>{renderField('hopi','History of Present Illness (HOPI)','textarea','Enter history of present illness...')}{renderField('medicalHistory','Medical History','textarea','Enter medical history...')}{renderField('surgicalHistory','Surgical History','textarea','Enter surgical history...')}{renderField('familyHistory','Family History','textarea','Enter family history...')}</div></FormPanel>}
   {isPhysio && <FormPanel number={4} title="Examination" id="examination" className="examination-panel"><div className="evaluation-fields examination-fields">{renderField('bp','Blood Pressure (BP)','input','120/80')}{renderField('hr','Heart Rate (HR)','input','Enter HR')}{renderField('weight','Weight','input','Enter weight')}{renderField('height','Height','input','Enter height')}</div></FormPanel>}
   {isPhysio && <FormPanel number={5} title="On Observation" id="observation" className="observation-panel"><div className="evaluation-fields compact-clinical-fields">{(groupByTitle['On Observation']?.fields||[]).map(([key,label])=><div key={key}>{renderField(key,label)}</div>)}</div></FormPanel>}
   {isPhysio && <FormPanel number={6} title="On Palpation" id="palpation" className="palpation-panel"><div className="evaluation-fields compact-clinical-fields">{(groupByTitle['On Palpation']?.fields||[]).map(([key,label])=><div key={key}>{renderField(key,label)}</div>)}</div></FormPanel>}
   {isPhysio && <FormPanel number={7} title="MMT" id="mmt" className="mmt-panel"><div className="evaluation-fields mmt-fields">{(groupByTitle['MMT']?.fields||[]).map(([key,label])=><div key={key}>{renderField(key,label)}</div>)}</div></FormPanel>}
   <FormPanel number={8} title="Clinical Summary" id="summary" className="summary-panel"><div className="evaluation-fields summary-fields">{!isPhysio && <label><FieldLabel required>Clinical Notes</FieldLabel><textarea name="notes" rows={3} required maxLength={10000} value={summary.notes} onChange={e=>setSummary({...summary,notes:e.target.value})}/></label>}<label><FieldLabel required>Diagnosis / Clinical Summary</FieldLabel><textarea name="diagnosis" rows={2} required maxLength={200} placeholder="Enter diagnosis or clinical summary..." value={summary.diagnosis} onChange={e=>setSummary({...summary,diagnosis:e.target.value})}/></label><label><FieldLabel required>Treatment Plan</FieldLabel><textarea name="plan" rows={2} required maxLength={10000} placeholder="Enter treatment plan..." value={summary.plan} onChange={e=>setSummary({...summary,plan:e.target.value})}/></label></div></FormPanel>
  </div>
  <div className="evaluation-footer"><label className="checkbox-label"><input type="checkbox" name="published" checked={published} onChange={e=>setPublished(e.target.checked)}/>Release this report to the patient</label><div className="clinical-footer-actions">{onCancel && <button type="button" className="button secondary clinical-back-button" onClick={onCancel} disabled={pending}><ArrowLeft size={16}/>Back to Care Records</button>}<button type="button" className="button secondary" disabled={pending} onClick={()=>submit(false)}>Save Draft</button><button type="button" className="button secondary" onClick={()=>setPreview(!preview)}>Preview</button><button className="button primary full" disabled={pending}>{pending?'Saving...':editNote?'Update Clinical Note':'Save Clinical Record'}</button></div></div>
 </fieldset></form>;
}
