import {one,run,transaction,id,audit,notify} from './db';
import {authorize,canAccessPatient} from './domain';
import {physioInput} from './physio';
import {readAssessment} from './assessment';
import type {User,ClinicalNote} from './types';

export async function savePhysioRecord(user:User,payload:unknown) {
  authorize(user.role==='practitioner'&&user.specialty==='physiotherapist');
  const d=physioInput.parse(payload);
  return transaction(async()=>{
    const assessment=await one<ClinicalNote>('SELECT * FROM notes WHERE id=?',d.assessmentId);
    authorize(assessment && await canAccessPatient(user,assessment.patient_id),'Choose an evaluation for a patient in your care.');
    authorize(readAssessment(assessment.assessment_json),'A standard or chiropractic evaluation is required first.');
    authorize(!d.published||assessment.published,'Release the evaluation before sharing its rehabilitation records.');
    const recordId=id('PHY');
    await run('INSERT INTO physio_records(id,patient_id,practitioner_id,assessment_id,kind,payload,published) VALUES (?,?,?,?,?,?,?)',recordId,assessment.patient_id,user.id,assessment.id,d.kind,JSON.stringify(d),Number(d.published));
    await audit(user.id,`physio.${d.kind}_created`,recordId);
    if(d.published)await notify(assessment.patient_id,'Your physiotherapy care has been updated','A new care plan, progress record or discharge summary is available in your physiotherapy journey.');
    if(d.reviewDate)await notify(user.id,'You planned a follow-up review',`You scheduled a review for ${d.reviewDate}. Book an available appointment to confirm the next visit.`);
    return recordId;
  });
}

export async function deletePhysioRecord(user:User,recordId:string) {
  authorize(user.role==='practitioner'&&user.specialty==='physiotherapist');
  return transaction(async()=>{
    const existing=await one<{practitioner_id:string;payload:string}>('SELECT * FROM physio_records WHERE id=?',recordId);
    authorize(existing,'Record not found.');
    authorize(existing.practitioner_id===user.id,'You can only delete your own records.');
    await run('DELETE FROM physio_records WHERE id=?',recordId);
    try {
      const reviewDate=(JSON.parse(existing.payload) as {reviewDate?:string}).reviewDate;
      if(reviewDate)await run("DELETE FROM notifications WHERE user_id=? AND title IN ('You planned a follow-up review','Follow-up planned') AND message LIKE ?",user.id,`%${reviewDate}%`);
    } catch { /* payload not parseable, nothing to clean up */ }
    await audit(user.id,'physio.record_deleted',recordId);
  });
}
