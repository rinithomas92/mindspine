import {z} from 'zod';

const narrative = z.string().trim().max(5000);
export const physioInput = z.object({
  assessmentId: z.string().min(1),
  kind: z.enum(['plan','session','discharge']),
  date: z.iso.date(),
  goals: narrative.default(''),
  interventions: narrative.default(''),
  exercises: narrative.default(''),
  frequency: z.string().trim().max(200).default(''),
  precautions: narrative.default(''),
  milestones: narrative.default(''),
  response: narrative.default(''),
  function: narrative.default(''),
  pain: z.union([z.literal(''),z.coerce.number().min(0).max(10)]).default(''),
  nextActions: narrative.default(''),
  reviewDate: z.union([z.literal(''),z.iso.date()]).default(''),
  published: z.boolean().default(false),
}).superRefine((d,ctx)=>{
  const required = d.kind==='plan' ? ['goals','interventions','frequency'] as const : ['response','nextActions'] as const;
  for(const key of required) if(!d[key]) ctx.addIssue({code:'custom',path:[key],message:`Enter ${key}.`});
  if(d.reviewDate && d.reviewDate<d.date) ctx.addIssue({code:'custom',path:['reviewDate'],message:'Review date must be on or after the record date.'});
});
export type PhysioInput = z.infer<typeof physioInput>;
export type PhysioRecord = {
  id:string; patient_id:string; practitioner_id:string; assessment_id:string;
  kind:PhysioInput['kind']; payload:string; published:number; created_at:string;
  patient:string; practitioner:string;
};
export const physioTitle = (kind:string) => kind==='plan'?'Rehabilitation plan':kind==='session'?'Session progress':'Discharge summary';
export function physioLines(record:PhysioRecord) {
  const d=physioInput.parse(JSON.parse(record.payload));
  const labels: [keyof PhysioInput,string][] = [['date','Record date'],['goals','Goals'],['interventions','Treatment / interventions'],['exercises','Home exercises'],['frequency','Frequency / duration'],['precautions','Precautions'],['milestones','Milestones / outcomes'],['response','Treatment response / discharge outcome'],['pain','Pain score (0-10)'],['function','Functional progress'],['nextActions','Next actions / advice'],['reviewDate','Review / follow-up date']];
  return [physioTitle(record.kind),...labels.filter(([key])=>d[key]!==''&&d[key]!==undefined).map(([key,label])=>`${label}: ${d[key]}`)];
}
