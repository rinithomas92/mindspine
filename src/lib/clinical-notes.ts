import {z} from 'zod';
import {assessmentSchema,readAssessment} from './assessment';
import {authorize,appointmentFor,canAccessPatient,createManagedUser} from './domain';
import {one,run,transaction,id,audit,notify} from './db';
import type {User} from './types';

const input=z.object({
  noteId:z.string().optional(),
  patientId:z.string().default(''),
  appointmentId:z.string().default(''),
  newPatient:z.object({name:z.string().trim().min(1,'Enter the patient’s name.').max(200),email:z.email().max(200).transform(s=>s.toLowerCase()),phone:z.string().trim().max(30).default(''),password:z.string().min(8).max(15, 'Password must be 15 characters or fewer.').regex(/^(?=.*[A-Za-z])(?=.*\d)/)}).optional(),
  diagnosis:z.string().trim().min(1,'Enter a diagnosis or clinical summary before saving.').max(200),notes:z.string().trim().min(1,'Enter a chief complaint or clinical notes before saving.').max(10000),plan:z.string().trim().min(1,'Enter a treatment plan before saving.').max(10000),published:z.boolean(),assessment:assessmentSchema.optional(),
});
export async function saveClinicalNote(user:User,payload:unknown) {
  authorize(user.role==='practitioner');
  const d=input.parse(payload);
  if(d.assessment)authorize(user.specialty==='physiotherapist','These evaluation forms require physiotherapist access.');
  return transaction(async()=>{
    if(d.noteId){
      const existing=await one<{patient_id:string;practitioner_id:string}>('SELECT * FROM notes WHERE id=?',d.noteId);
      authorize(existing,'Clinical note not found.');
      authorize(existing.practitioner_id===user.id,'You can only edit your own clinical notes.');
      await run('UPDATE notes SET diagnosis=?,notes=?,plan=?,published=?,assessment_json=?,appointment_id=? WHERE id=?',d.diagnosis,d.notes,d.plan,Number(d.published),d.assessment?JSON.stringify(d.assessment):'',d.appointmentId||null,d.noteId);
      await audit(user.id,'clinical.note_updated',d.noteId);
      if(d.published)await notify(existing.patient_id,'Your care report is ready','A report has been released. View it securely in your care records.');
      return {noteId:d.noteId,patientId:existing.patient_id};
    }
    authorize(!d.newPatient || (!d.patientId&&!d.appointmentId),'Choose an existing patient or a new patient, not both.');
    let patientId=d.patientId;
    if(d.appointmentId){
      const visit=await appointmentFor(user,d.appointmentId);
      authorize(visit.status!=='cancelled','Cannot document a cancelled appointment.');
      authorize(!patientId||patientId===visit.patient_id,'The selected visit belongs to another patient.');
      patientId=visit.patient_id;
    }
    if(d.newPatient)patientId=await createManagedUser(user,{...d.newPatient,role:'patient'});
    authorize(patientId && await canAccessPatient(user,patientId),'Select a patient in your care.');
    authorize(await one("SELECT id FROM users WHERE id=? AND role='patient' AND active=1",patientId),'Patient is inactive or unavailable.');
    const noteId=id('REC');
    await run('INSERT INTO notes(id,patient_id,practitioner_id,appointment_id,diagnosis,notes,plan,published,assessment_json) VALUES (?,?,?,?,?,?,?,?,?)',noteId,patientId,user.id,d.appointmentId||null,d.diagnosis,d.notes,d.plan,Number(d.published),d.assessment?JSON.stringify(d.assessment):'');
    await audit(user.id,'clinical.note_created',noteId);
    if(d.published)await notify(patientId,'Your care report is ready','A new report has been released. View it securely in your care records.');
    return {noteId,patientId};
  });
}

const progressEntryInput=z.object({
  noteId:z.string(),
  index:z.number().int().min(0).optional(),
  date:z.iso.date(),
  sessionVisit:z.string().trim().max(200).optional(),
  entryType:z.string().trim().max(60).optional(),
  subjective:z.string().trim().max(3000).optional(),
  objective:z.string().trim().max(3000).optional(),
  treatmentProvided:z.string().trim().max(3000).optional(),
  patientResponse:z.string().trim().max(3000).optional(),
  planNextVisit:z.string().trim().max(3000).optional(),
  visibleToPatient:z.boolean().optional(),
});
export async function deleteClinicalNote(user:User,noteId:string) {
  authorize(user.role==='practitioner','Only clinicians can delete clinical notes.');
  return transaction(async()=>{
    const existing=await one<{patient_id:string;practitioner_id:string}>('SELECT * FROM notes WHERE id=?',noteId);
    authorize(existing,'Clinical note not found.');
    authorize(existing.practitioner_id===user.id,'You can only delete your own clinical notes.');
    authorize(!await one('SELECT id FROM physio_records WHERE assessment_id=?',noteId),'This evaluation has rehabilitation records linked to it and cannot be deleted.');
    await run('DELETE FROM notes WHERE id=?',noteId);
    await audit(user.id,'clinical.note_deleted',noteId);
  });
}

export async function deleteProgressEntry(user:User,noteId:string,index:number) {
  authorize(user.role==='practitioner' && user.specialty==='physiotherapist','These evaluation forms require physiotherapist access.');
  return transaction(async()=>{
    const existing=await one<{patient_id:string;practitioner_id:string;assessment_json:string}>('SELECT * FROM notes WHERE id=?',noteId);
    authorize(existing,'Clinical note not found.');
    authorize(existing.practitioner_id===user.id,'You can only delete progress entries from your own clinical notes.');
    const current=readAssessment(existing.assessment_json);
    authorize(current && index>=0 && index<current.progress.length,'Progress entry not found.');
    const nextProgress=current!.progress.filter((_,i)=>i!==index);
    const next=assessmentSchema.parse({...current,progress:nextProgress});
    await run('UPDATE notes SET assessment_json=? WHERE id=?',JSON.stringify(next),noteId);
    await audit(user.id,'clinical.progress_deleted',noteId);
  });
}

export async function addProgressEntry(user:User,payload:unknown) {
  authorize(user.role==='practitioner' && user.specialty==='physiotherapist','These evaluation forms require physiotherapist access.');
  const d=progressEntryInput.parse(payload);
  const summary=d.treatmentProvided||d.subjective||d.objective||d.patientResponse||d.planNextVisit;
  authorize(summary,'Add at least one clinical detail for this progress entry.');
  return transaction(async()=>{
    const existing=await one<{patient_id:string;practitioner_id:string;assessment_json:string}>('SELECT * FROM notes WHERE id=?',d.noteId);
    authorize(existing,'Clinical note not found.');
    authorize(existing.practitioner_id===user.id,'You can only add progress entries to your own clinical notes.');
    const current=readAssessment(existing.assessment_json)||{type:'physiotherapy' as const,fields:{evaluationDate:d.date},progress:[]};
    const entry={date:d.date,treatment:summary,sessionVisit:d.sessionVisit,entryType:d.entryType,subjective:d.subjective,objective:d.objective,treatmentProvided:d.treatmentProvided,patientResponse:d.patientResponse,planNextVisit:d.planNextVisit,visibleToPatient:d.visibleToPatient};
    let nextProgress;
    if(d.index!==undefined){
      authorize(d.index>=0 && d.index<current.progress.length,'Progress entry not found.');
      nextProgress=current.progress.map((row,i)=>i===d.index?entry:row);
    } else {
      nextProgress=[...current.progress,entry];
    }
    const next=assessmentSchema.parse({...current,progress:nextProgress});
    await run('UPDATE notes SET assessment_json=? WHERE id=?',JSON.stringify(next),d.noteId);
    await audit(user.id,d.index!==undefined?'clinical.progress_edited':'clinical.progress_added',d.noteId);
    if(d.visibleToPatient)await notify(existing.patient_id,d.index!==undefined?'A progress update was changed':'A new progress update is available',d.index!==undefined?'A progress entry on your care record has been updated.':'A progress entry has been added to your care record.');
    return {noteId:d.noteId};
  });
}
