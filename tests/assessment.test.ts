import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessmentSchema,assessmentLines} from '../src/lib/assessment';
const assessment={type:'chiropractic',fields:{evaluationDate:'2026-10-04',sic:'Recorded SIC',rom:'Recorded range'},progress:[{date:'2026-10-04',treatment:'First visit progress'}]};
test('chiropractic fields and progress survive serialization',()=>{const parsed=assessmentSchema.parse(assessment);const lines=assessmentLines(JSON.stringify(parsed)).join('\n');assert.match(lines,/SIC: Recorded SIC/);assert.match(lines,/1. 2026-10-04 \| First visit progress/);});
test('reject invalid dates, unknown fields, excessive age and cross-form fields',()=>{
 for(const fields of [{evaluationDate:'2026-02-30'},{evaluationDate:'2026-10-04',unrecognized:'x'},{evaluationDate:'2026-10-04',age:'160'}])assert.equal(assessmentSchema.safeParse({...assessment,fields}).success,false);
 assert.equal(assessmentSchema.safeParse({...assessment,type:'physiotherapy'}).success,false);
});
test('empty progress entry cannot silently save',()=>{assert.equal(assessmentSchema.safeParse({...assessment,progress:[{date:'2026-10-04',treatment:' '}]}).success,false);});
