import {z} from 'zod';
import {assessmentSchema} from './assessment';
import {authorize,appointmentFor,canAccessPatient,createManagedUser} from './domain';
import {one,run,transaction,id,audit,notify} from './db';
import type {User} from './types';

const input=z.object({
  patientId:z.string().default(''),
  appointmentId:z.string().default(''),
  newPatient:z.object({name:z.string().trim().min(1).max(200),email:z.email().max(200).transform(s=>s.toLowerCase()),phone:z.string().trim().max(30).default(''),password:z.string().min(12).max(128)}).optional(),
  diagnosis:z.string().trim().min(1).max(200),notes:z.string().trim().min(1).max(10000),plan:z.string().trim().min(1).max(10000),published:z.boolean(),assessment:assessmentSchema.optional(),
});
export async function saveClinicalNote(user:User,payload:unknown) {
  authorize(user.role==='practitioner');
  const d=input.parse(payload);
  if(d.assessment)authorize(user.specialty==='physiotherapist','These evaluation forms require physiotherapist access.');
  return transaction(async()=>{
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
