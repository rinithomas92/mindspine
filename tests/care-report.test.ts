import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { noteCareReport, physioCareReport, renderCareReport, reportDate, wrapReportText } from '../src/lib/care-report';
import { evaluationGroups } from '../src/lib/assessment';
import type { ClinicalNote } from '../src/lib/types';

const note: ClinicalNote = { id: 'REC-TEST', patient_id: 'PATIENT-TEST', practitioner_id: 'CLINICIAN-TEST', appointment_id: null, patient: 'Patient Example', practitioner: 'Clinician Example', diagnosis: 'Summary', notes: 'Complaint\nwith another paragraph', plan: 'First treatment\n\nSecond treatment', published: 0, created_at: '2026-10-15 23:45:00' };

test('report model preserves all populated clinical fields and progress details', () => {
  const fields = Object.fromEntries(evaluationGroups.flatMap(group => group.fields.map(([key]) => [key, key === 'evaluationDate' ? '2026-10-15' : key === 'age' ? '0' : `Value for ${key}`])));
  const progress = [{ date: '2026-10-16', treatment: 'Treatment', sessionVisit: 'Visit 1', entryType: 'Review', subjective: 'Subjective', objective: 'Objective', treatmentProvided: 'Exercise', patientResponse: 'Response', planNextVisit: 'Plan', visibleToPatient: false }];
  const model = noteCareReport({ ...note, assessment_json: JSON.stringify({ type: 'chiropractic', fields, progress }) });
  assert.equal(model.title, 'Chiropractic Evaluation');
  assert.equal(model.released, false);
  assert.equal(model.sections.length, evaluationGroups.length);
  assert.deepEqual(model.progress, progress);
  for (const [key, value] of Object.entries(fields)) assert.ok(model.sections.some(s => s.fields.some(f => f.value === (key === 'evaluationDate' ? '15 Oct 2026' : value))));
  assert.equal(model.summaries.find(f => f.label === 'Treatment Plan')?.value, note.plan);
});

test('optional sections are omitted, recorded zero and N/A are retained, units are not duplicated', () => {
  const model = noteCareReport({ ...note, assessment_json: JSON.stringify({ type: 'physiotherapy', fields: { evaluationDate: '2026-10-15', age: '0', medicalHistory: 'N/A', hr: '72 bpm', height: '165' }, progress: [] }) });
  assert.equal(model.title, 'Standard Physiotherapy Evaluation');
  assert.ok(!model.sections.some(s => ['MMT', 'On Observation', 'On Palpation'].includes(s.title)));
  assert.ok(model.sections.flatMap(s => s.fields).some(f => f.value === '0'));
  assert.ok(model.sections.flatMap(s => s.fields).some(f => f.value === 'N/A'));
  assert.ok(model.sections.flatMap(s => s.fields).some(f => f.value === '72 bpm'));
  assert.ok(model.sections.flatMap(s => s.fields).some(f => f.value === '165 cm'));
  assert.equal(reportDate('2026-10-15 23:45:00', true), '16 Oct 2026, 05:15 am');
  assert.equal(reportDate('2026-10-15'), '15 Oct 2026');
});

test('wraps long tokens without data loss and retains paragraph breaks', async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(20);
  const lines = wrapReportText(`${token}\n\nSecond paragraph`, font, 10, 190);
  assert.ok(lines.every(line => font.widthOfTextAtSize(line, 10) <= 190));
  assert.ok(lines.includes(''));
  assert.equal(lines.join('').replace('Second paragraph', ''), token);
});

test('rehabilitation report retains every populated payload field including zero pain', async () => {
  const payload = { kind: 'session', assessmentId: 'REC-TEST', date: '2026-10-15', interventions: 'Manual therapy', response: 'Comfortable', pain: 0, nextActions: 'Review next week', reviewDate: '2026-10-22', published: false };
  const model = physioCareReport({ id: 'PHYSIO-TEST', patient_id: note.patient_id, practitioner_id: note.practitioner_id, assessment_id: 'REC-TEST', kind: 'session', payload: JSON.stringify(payload), patient: note.patient, practitioner: note.practitioner, published: 0, created_at: note.created_at });
  assert.ok(model.sections[0].fields.some(f => f.label === 'Pain score (0-10)' && f.value === '0'));
  assert.ok(model.sections[0].fields.some(f => f.value === '22 Oct 2026'));
  const result = await renderCareReport(model, { address: 'Pune, Maharashtra' });
  assert.ok(result.pageCount >= 1);
  assert.ok(result.textBoxes.some(b => b.text === 'Draft - clinical use only'));
});

test('progress headers always stay with a row and long values stay within print margins', async () => {
  const model = noteCareReport({ ...note, assessment_json: JSON.stringify({ type: 'physiotherapy', fields: { evaluationDate: '2026-10-15', address: 'LongAddressToken'.repeat(55) }, progress: Array.from({ length: 12 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, treatment: 'Progress narrative. '.repeat(30) })) }) });
  const { textBoxes, pageCount } = await renderCareReport(model, { address: 'Pune, Maharashtra' });
  assert.ok(pageCount > 2);
  for (const box of textBoxes) {
    assert.ok(box.x >= 42 && box.x + box.width <= 554);
    if (box.zone === 'body') assert.ok(box.top + box.height <= 780);
    if (box.text === 'PROGRESS ENTRY') assert.ok(textBoxes.some(other => other.page === box.page && other.zone === 'body' && other.top > box.top && other.text.includes('Progress narrative.')));
  }
});
