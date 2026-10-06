import { z } from 'zod';
export const evaluationGroups = [
  { title: 'Patient details', fields: [['evaluationDate','Evaluation date','date'],['age','Age','number'],['gender','Gender'],['contact','Contact'],['address','Address'],['profession','Profession']] },
  { title: 'History', fields: [['hopi','History of present illness (HOPI)'],['medicalHistory','Medical history'],['surgicalHistory','Surgical history'],['familyHistory','Family history']] },
  { title: 'Examination', fields: [['bp','Blood pressure (BP)'],['hr','Heart rate (HR)'],['weight','Weight'],['height','Height']] },
  { title: 'On observation', fields: [['scar','Scar (if any)'],['posture','Posture'],['gait','Gait'],['deformity','Deformity'],['edema','Edema']] },
  { title: 'On palpation', fields: [['tenderness','Tenderness'],['scarMobility','Scar mobility'],['tone','Tone'],['spasm','Spasm'],['triggerPoints','Trigger points']] },
  { title: 'Manual muscle testing (MMT)', fields: [['sic','SIC'],['wic','WIC'],['tl','TL'],['facilitated','Facilitated'],['inhibited','Inhibited']] },
  { title: 'Assessment', fields: [['specialTests','Special tests'],['rom','Range of motion (ROM)']] },
] as const;
export const standardGroups = [
  evaluationGroups[0], evaluationGroups[1], evaluationGroups[2],
  {title:'Physiotherapy assessment',fields:[['pain','Pain assessment'],['function','Functional limitations'],['posture','Posture'],['gait','Gait'],['rom','Range of motion (ROM)'],['strength','Muscle strength'],['specialTests','Special tests'],['goals','Rehabilitation goals']]},
] as const;
export const formTitle = (type?: string) => type === 'chiropractic' ? 'Chiropractic evaluation' : type === 'physiotherapy' ? 'Standard physiotherapy' : 'Clinical note';
const fieldKeys = [...new Set([...evaluationGroups,...standardGroups].flatMap(g=>g.fields.map(f=>f[0])))];
export const assessmentSchema = z.object({
  type:z.enum(['physiotherapy','chiropractic']),
  fields:z.record(z.string(),z.string().trim().max(2000)).refine(v=>Object.keys(v).every(k=>fieldKeys.includes(k as typeof fieldKeys[number])), 'Unknown assessment field.'),
  progress:z.array(z.object({date:z.iso.date(),treatment:z.string().trim().min(1).max(3000)})).max(40),
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
  if(a.progress.length)lines.push('','PROGRESS SHEET',...a.progress.map((r,i)=>`${i+1}. ${r.date} | ${r.treatment}`));
  return lines;
}
