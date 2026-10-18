import { z } from 'zod';
export const evaluationGroups = [
  { title: 'Patient Details', fields: [['evaluationDate','Evaluation Date','date'],['age','Age','number'],['gender','Gender'],['contact','Contact'],['address','Address'],['profession','Profession']] },
  { title: 'Chief Complaint & History', fields: [['hopi','History of Present Illness (HOPI)'],['medicalHistory','Medical History'],['surgicalHistory','Surgical History'],['familyHistory','Family History']] },
  { title: 'Examination', fields: [['bp','Blood Pressure (BP)'],['hr','Heart Rate (HR)'],['weight','Weight'],['height','Height']] },
  { title: 'On Observation', fields: [['scar','Scar (if any)'],['posture','Posture'],['gait','Gait'],['deformity','Deformity'],['edema','Edema']] },
  { title: 'On Palpation', fields: [['tenderness','Tenderness'],['scarMobility','Scar Mobility'],['tone','Tone'],['spasm','Spasm'],['triggerPoints','Trigger Points']] },
  { title: 'MMT', fields: [['sic','SIC'],['wic','WIC'],['tl','TL'],['facilitated','Facilitated'],['inhibited','Inhibited']] },
] as const;
export const standardGroups = evaluationGroups;
export const formTitle = (type?: string) => type === 'chiropractic' ? 'Chiropractic evaluation' : type === 'physiotherapy' ? 'Standard physiotherapy' : 'Clinical note';
const fieldKeys = [...new Set([...evaluationGroups,...standardGroups].flatMap(g=>g.fields.map(f=>f[0])))];
export const assessmentSchema = z.object({
  type:z.enum(['physiotherapy','chiropractic']),
  fields:z.record(z.string(),z.string().trim().max(2000)).refine(v=>Object.keys(v).every(k=>fieldKeys.includes(k as typeof fieldKeys[number])), 'Unknown assessment field.'),
  progress:z.array(z.object({
    date:z.iso.date(),
    treatment:z.string().trim().min(1,'Enter a treatment and progress note before saving.').max(3000),
    sessionVisit:z.string().trim().max(200).optional(),
    entryType:z.string().trim().max(60).optional(),
    subjective:z.string().trim().max(3000).optional(),
    objective:z.string().trim().max(3000).optional(),
    treatmentProvided:z.string().trim().max(3000).optional(),
    patientResponse:z.string().trim().max(3000).optional(),
    planNextVisit:z.string().trim().max(3000).optional(),
    visibleToPatient:z.boolean().optional(),
  })),
}).superRefine((a,ctx)=>{
  if(!z.iso.date().safeParse(a.fields.evaluationDate).success)ctx.addIssue({code:'custom',message:'Enter a valid evaluation date.'});
  if(a.fields.age && (!/^\d{1,3}$/.test(a.fields.age)||Number(a.fields.age)>130))ctx.addIssue({code:'custom',message:'Enter an age between 0 and 130.'});
  const allowed=(a.type==='chiropractic'?evaluationGroups:standardGroups).flatMap(g=>g.fields.map(f=>f[0] as string));
  if(Object.keys(a.fields).some(k=>!allowed.includes(k)))ctx.addIssue({code:'custom',message:'Field does not belong to this form.'});
});
export type Assessment = z.infer<typeof assessmentSchema>;
export function readAssessment(json?:string):Assessment|null {
  if(!json)return null;
  try {const r=assessmentSchema.safeParse(JSON.parse(json));return r.success?r.data:null;}catch{return null;}
}
export function assessmentLines(json?:string) {
  const a=readAssessment(json);if(!a)return [];
  const lines=[formTitle(a.type)];
  for(const group of a.type==='chiropractic'?evaluationGroups:standardGroups){
    const values=group.fields.filter(([key])=>a.fields[key]).map(([key,label])=>`${label}: ${a.fields[key]}`);
    if(values.length)lines.push('',group.title.toUpperCase(),...values);
  }
  if(a.progress.length){
    lines.push('','PROGRESS SHEET');
    const detailFields: [keyof typeof a.progress[number],string][] = [['subjective','Subjective (Patient Report)'],['objective','Objective (Findings)'],['treatmentProvided','Treatment Provided'],['patientResponse','Patient Response'],['planNextVisit','Plan for Next Visit']];
    a.progress.forEach((r,i)=>{
      lines.push(`${i+1}. ${r.date} | ${r.treatment}`);
      for(const [key,label] of detailFields) if(r[key]) lines.push(`   ${label}: ${r[key]}`);
    });
  }
  return lines;
}
