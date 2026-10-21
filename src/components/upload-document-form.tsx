"use client";
import {useMemo, useRef, useState} from 'react';
import {Search, Upload, FileText, X as XIcon, ChevronRight} from 'lucide-react';
import {date, time, Avatar} from "./ui";
import type {Appointment, User} from "@/lib/types";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png";
const ACCEPTED_TYPES = new Set(ACCEPT.split(","));

export default function UploadDocumentForm({patients,appointments = [],patientCode,defaultPatientId,onDone,onCancel}:{
 patients: User[];
 appointments?: Appointment[];
 patientCode: (p: User) => string;
 defaultPatientId?: string;
 onDone: () => void;
 onCancel: () => void;
}) {
 const [patientId,setPatientId] = useState(defaultPatientId || "");
 const [patientQuery,setPatientQuery] = useState(() => patients.find(p => p.id === defaultPatientId)?.name || "");
 const patientMatches = useMemo(() => {
  const q = patientQuery.trim().toLowerCase();
  if (!q) return [];
  return patients.filter(p => p.active && `${p.name} ${p.email} ${p.phone} ${p.id} ${patientCode(p)}`.toLowerCase().includes(q)).slice(0, 8);
 }, [patientQuery, patients, patientCode]);
 const [appointmentId,setAppointmentId] = useState("");
 const [documentType,setDocumentType] = useState("Imaging");
 const [otherType,setOtherType] = useState("");
 const [description,setDescription] = useState("");
 const [file,setFile] = useState<File | null>(null);
 const [dragOver,setDragOver] = useState(false);
 const [pending,setPending] = useState(false);
 const [error,setError] = useState('');
 const inputRef = useRef<HTMLInputElement>(null);
 const submittingRef = useRef(false);

 function pickFile(f: File | undefined) {
  if (!f) return;
  setError('');
  if (!ACCEPTED_TYPES.has(f.type)) {
   setFile(null);
   setError('Only PDF, JPG, and PNG files are supported.');
   return;
  }
  if (f.size > MAX_SIZE) {
   setFile(null);
   setError('Choose a file up to 5 MB.');
   return;
  }
  setFile(f);
 }

 const linkedVisits = patientId
  ? appointments.filter((appointment) => appointment.patient_id === patientId).sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
  : [];

 async function submit() {
  if (submittingRef.current) return;
  setError('');
  if (!patientId) { setError('Select a patient.'); return; }
  if (documentType === "Other" && !otherType.trim()) { setError('Enter the document type.'); return; }
  if (!file) { setError('Choose a file to upload.'); return; }
  if (file.size > MAX_SIZE) { setError('Choose a file up to 5 MB.'); return; }
  submittingRef.current = true;
  setPending(true);
  try {
   const form = new FormData();
   form.set("patientId", patientId);
   form.set("file", file);
   form.set("appointmentId", appointmentId);
   form.set("documentType", documentType === "Other" && otherType.trim() ? otherType.trim() : documentType);
   form.set("description", description);
   const result = await fetch('/api/files', { method: 'POST', body: form });
   const body = await result.json();
   if (!result.ok) { setError(body.error || 'Unable to upload this document.'); submittingRef.current = false; setPending(false); return; }
   onDone();
  } catch {
   setError('Unable to upload this document. Check your connection and try again.');
   submittingRef.current = false;
   setPending(false);
  }
 }

 return <form className="upload-document-form" onSubmit={e => { e.preventDefault(); submit(); }}>
  <fieldset disabled={pending}>
   <label className="upload-select-field patient-search-field"><span className="field-label-text">Patient <span className="required-mark" aria-hidden="true">*</span></span>
    <div className="patient-search-wrap"><Search size={16}/><input type="search" value={patientQuery} autoComplete="off" placeholder="Search and select a patient..." aria-label="Patient" role="combobox" aria-expanded={!!patientQuery.trim() && !patientId} onChange={e => { setPatientQuery(e.target.value); if (patientId) { setPatientId(""); setAppointmentId(""); } }}/></div>
    {patientQuery.trim() && !patientId && <div className="patient-options" role="listbox">
     {patientMatches.map(p => <button key={p.id} type="button" role="option" onClick={() => { setPatientId(p.id); setPatientQuery(p.name); setAppointmentId(""); }}><Avatar name={p.name}/><span><strong>{p.name}</strong><small>{patientCode(p)}</small></span><ChevronRight size={16}/></button>)}
     {!patientMatches.length && <p>No matching patients found.</p>}
    </div>}
   </label>

   <label className="upload-select-field"><span className="field-label-text">Linked Visit <span className="muted">(Optional)</span></span>
    <span className="upload-select-wrap no-icon"><select value={appointmentId} onChange={e => setAppointmentId(e.target.value)}>
     <option value="">No linked appointment</option>
     {linkedVisits.map(visit => <option key={visit.id} value={visit.id}>{visit.service} - {date(visit.starts_at, { day: "2-digit", month: "short", year: "numeric" })}, {time(visit.starts_at)}</option>)}
    </select></span>
   </label>

   <label className="upload-select-field"><span className="field-label-text">Document Type <span className="required-mark" aria-hidden="true">*</span></span>
    <span className="upload-select-wrap no-icon"><select required value={documentType} onChange={e => setDocumentType(e.target.value)}>
     <option>Imaging</option>
     <option>Lab Report</option>
     <option>Prescription</option>
     <option>Clinical Note</option>
     <option>Progress Sheet</option>
     <option>Other</option>
    </select></span>
   </label>

   {documentType === "Other" && <label className="upload-select-field"><span className="field-label-text">Specify Document Type <span className="required-mark" aria-hidden="true">*</span></span>
    <input type="text" maxLength={60} className="upload-other-type-input" placeholder="Enter the document type..." value={otherType} onChange={e => setOtherType(e.target.value)}/>
   </label>}

   <label className="upload-file-label"><span className="field-label-text">File Upload <span className="required-mark" aria-hidden="true">*</span></span></label>
   <div
    className={"upload-dropzone" + (dragOver ? " drag-over" : "")}
    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
    onDragLeave={() => setDragOver(false)}
    onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
    onClick={() => inputRef.current?.click()}
    role="button"
    tabIndex={0}
    aria-label="Upload a file"
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
   >
    <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={e => pickFile(e.target.files?.[0])}/>
    <Upload size={26}/>
    <strong>Drag and drop a file here</strong>
    <span>or click to browse</span>
    <small>Supports PDF, JPG, PNG (Max 5 MB)</small>
   </div>

   <label className="upload-description-field"><span className="field-label-text">Description <span className="muted">(Optional)</span></span>
    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Add any additional notes about this document..." />
   </label>


   {file && <div className="upload-selected-file">
    <FileText size={18}/>
    <span><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></span>
    <button type="button" className="icon-button" aria-label="Remove selected file" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}><XIcon size={16}/></button>
   </div>}

   {error && <p className="form-error">{error}</p>}

   <div className="upload-document-actions">
    <button type="button" className="button secondary" onClick={onCancel} disabled={pending}>Cancel</button>
    <button className="button primary" disabled={pending}>{pending ? 'Uploading...' : 'Upload Document'}</button>
   </div>
  </fieldset>
 </form>;
}
