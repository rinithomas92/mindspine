import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { evaluationGroups, readAssessment, type Assessment } from './assessment';
import { physioInput, physioTitle, type PhysioRecord } from './physio';
import type { ClinicalNote, Invoice } from './types';

type Field = { label: string; value: string };
type Section = { title: string; fields: Field[]; columns: number };
export type CareReport = {
  title: string;
  patient: string;
  released: boolean;
  metadata: Field[];
  summaries: Field[];
  sections: Section[];
  progress: Assessment['progress'];
};

export function reportDate(value: string, withTime = false): string {
  if (!value) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const instant = new Date(dateOnly ? `${value}T00:00:00+05:30` : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(instant.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime && !dateOnly ? { hour: '2-digit', minute: '2-digit', hour12: true } as const : {}),
  }).format(instant);
}

function populated(fields: Field[]) { return fields.filter(f => f.value.trim()); }
function measuredValue(key: string, value: string) {
  if (!value) return '';
  if (key === 'evaluationDate' || key === 'date' || key === 'reviewDate') return reportDate(value);
  const unit = ({ bp: 'mmHg', hr: 'bpm', weight: 'kg', height: 'cm' } as Record<string, string>)[key];
  // Preserve entered units and narrative values; only annotate bare measurements.
  return unit && /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(value) ? `${value} ${unit}` : value;
}

export function noteCareReport(note: ClinicalNote): CareReport {
  const assessment = readAssessment(note.assessment_json);
  const title = assessment?.type === 'chiropractic' ? 'Chiropractic Evaluation'
    : assessment?.type === 'physiotherapy' ? 'Standard Physiotherapy Evaluation' : 'Clinical Care Report';
  const summaries = populated([
    { label: 'Clinical Summary', value: note.diagnosis },
    { label: 'Visit Notes', value: note.notes },
    { label: 'Treatment Plan', value: note.plan },
  ]);
  const sections: Section[] = assessment ? evaluationGroups.map(group => ({
    title: group.title,
    columns: group.title === 'Chief Complaint & History' ? 1 : 2,
    fields: populated([
      ...(group.title === 'Chief Complaint & History' ? [{ label: 'Chief Complaint (C/C)', value: note.notes }] : []),
      ...group.fields.map(([key, label]) => ({ label, value: measuredValue(key, assessment.fields[key] || '') })),
    ]),
  })).filter(section => section.fields.length) : [];
  return {
    title, patient: note.patient, released: !!note.published,
    metadata: populated([
      { label: 'Patient', value: note.patient }, { label: 'Clinician', value: note.practitioner },
      { label: 'Record ID', value: note.id }, { label: 'Date', value: reportDate(note.created_at, true) },
      { label: 'Patient ID', value: note.patient_id },
      ...(assessment ? [{ label: 'Form Type', value: title }] : []),
      { label: 'Linked Visit', value: note.appointment_id || '' },
    ]),
    summaries, sections, progress: assessment?.progress || [],
  };
}

export function physioCareReport(record: PhysioRecord): CareReport {
  const data = physioInput.parse(JSON.parse(record.payload));
  const labels: [keyof typeof data, string][] = [
    ['date', 'Record date'], ['goals', 'Goals'], ['interventions', 'Treatment / interventions'],
    ['exercises', 'Home exercises'], ['frequency', 'Frequency / duration'], ['precautions', 'Precautions'],
    ['milestones', 'Milestones / outcomes'], ['response', 'Treatment response / discharge outcome'],
    ['pain', 'Pain score (0-10)'], ['function', 'Functional progress'], ['nextActions', 'Next actions / advice'],
    ['reviewDate', 'Review / follow-up date'],
  ];
  return {
    title: physioTitle(record.kind), patient: record.patient, released: !!record.published,
    metadata: [
      { label: 'Patient', value: record.patient }, { label: 'Physiotherapist', value: record.practitioner },
      { label: 'Record ID', value: record.id }, { label: 'Created', value: reportDate(record.created_at, true) },
      { label: 'Patient ID', value: record.patient_id }, { label: 'Related Evaluation', value: record.assessment_id },
    ],
    summaries: [],
    sections: [{ title: physioTitle(record.kind), columns: 1, fields: populated(labels.map(([key, label]) => ({ label, value: measuredValue(key, String(data[key] ?? '')) }))) }],
    progress: [],
  };
}

const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
export const reportTheme = {
  ivory: color('#FBF9F2'), forest: color('#16483F'), green: color('#007B62'),
  ink: color('#233B37'), muted: color('#526A62'), line: color('#DCE6DE'), white: color('#FFFFFF'),
  sage: color('#EAF4EB'), blue: color('#EDF5FB'), peach: color('#FFF1E7'),
};
const W = 595.28, H = 841.89, M = 42, CW = W - M * 2, BOTTOM = H - 62;
const BODY = 10, LEADING = 14, PAD = 12;

// Measured wrapping preserves paragraph breaks and splits unbroken IDs/URLs safely.
export function wrapReportText(value: string, font: PDFFont, size: number, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')) {
    let line = '';
    for (const token of paragraph.split(/(\s+)/).filter(Boolean)) {
      if (!line && /^\s+$/.test(token)) continue;
      if (font.widthOfTextAtSize(line + token, size) <= width) { line += token; continue; }
      if (line.trimEnd()) result.push(line.trimEnd());
      line = '';
      if (/^\s+$/.test(token)) continue;
      for (const char of Array.from(token)) {
        if (font.widthOfTextAtSize(line + char, size) > width && line) { result.push(line); line = ''; }
        line += char;
      }
    }
    result.push(line.trimEnd());
  }
  return result;
}

export type ReportTextBox = { page: number; text: string; x: number; top: number; width: number; height: number; zone: 'header' | 'body' | 'footer' };
export async function renderCareReport(report: CareReport, clinic: { address?: string; clinicName?: string }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [logoBytes, regularBytes, boldBytes] = await Promise.all([
    readFile(join(process.cwd(), 'public/reports/mindspine-logo.png')),
    readFile(join(process.cwd(), 'public/reports/dm-sans-regular.woff')),
    readFile(join(process.cwd(), 'public/reports/dm-sans-bold.woff')),
  ]);
  const logo = await pdf.embedPng(logoBytes);
  const font = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const display = await pdf.embedFont(StandardFonts.TimesRomanBold);
  pdf.setTitle(report.title);
  pdf.setAuthor(clinic.clinicName || 'MindSpine');
  pdf.setSubject('Clinical care summary and treatment record');
  pdf.setCreator('MindSpine');
  const boxes: ReportTextBox[] = [];
  let page: PDFPage, y = 0;

  function text(value: string, x: number, top: number, size = BODY, face = font, fill = reportTheme.ink, zone: ReportTextBox['zone'] = 'body') {
    if (!value) return;
    page.drawText(value, { x, y: H - top - size, size, font: face, color: fill });
    boxes.push({ page: pdf.getPageCount(), text: value, x, top, width: face.widthOfTextAtSize(value, size), height: size * 1.25, zone });
  }
  function lines(values: string[], x: number, top: number, size = BODY, face = font, fill = reportTheme.ink, leading = LEADING) {
    values.forEach((value, index) => text(value, x, top + index * leading, size, face, fill));
  }
  function rect(x: number, top: number, width: number, height: number, fill = reportTheme.white) {
    page.drawRectangle({ x, y: H - top - height, width, height, color: fill, borderColor: reportTheme.line, borderWidth: .5 });
  }
  function newPage() {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: reportTheme.ivory });
    const first = pdf.getPageCount() === 1;
    const logoWidth = first ? 148 : 105;
    const logoHeight = logo.height * logoWidth / logo.width;
    page.drawImage(logo, { x: M, y: H - 22 - logoHeight, width: logoWidth, height: logoHeight });
    const label = 'CARE REPORT';
    text(label, W - M - bold.widthOfTextAtSize(label, 8), 29, 8, bold, reportTheme.muted, 'header');
    // Only the full first-page header carries decoration, outside the text region.
    if (first) {
      page.drawLine({ start: { x: W - M - 30, y: H - 77 }, end: { x: W - M - 3, y: H - 46 }, color: reportTheme.line, thickness: .8 });
      for (let i = 0; i < 3; i++) page.drawEllipse({ x: W - M - 22 + i * 8, y: H - 67 + i * 9, xScale: 7, yScale: 3, borderColor: reportTheme.line, borderWidth: .6 });
      y = 92;
    } else {
      const headerLines = wrapReportText(`Patient: ${report.patient}\nReport: ${report.title}`, font, 8, CW - 130);
      headerLines.forEach((line, i) => text(line, M + 130, 46 + i * 11, 8, font, reportTheme.muted, 'header'));
      y = Math.max(85, 60 + headerLines.length * 11);
    }
    page.drawLine({ start: { x: M, y: H - y + 8 }, end: { x: W - M, y: H - y + 8 }, thickness: .7, color: reportTheme.line });
  }
  function ensure(height: number) { if (y + height > BOTTOM) newPage(); }
  function heading(title: string, minimum = 70) {
    ensure(minimum);
    text(title, M, y, 12, bold, reportTheme.forest);
    y += 24;
  }

  // A row can split across pages. Each continuation repeats its field labels.
  function fieldRows(fields: Field[], columns = 2, fill = reportTheme.white, continuationTitle?: string, inline = false) {
    const cellWidth = CW / columns;
    for (let index = 0; index < fields.length; index += columns) {
      const row = fields.slice(index, index + columns);
      if (inline && row.some(field => wrapReportText(field.value, font, BODY, cellWidth * .59 - PAD * 2).length > 8)) {
        fieldRows(row, 1, fill, continuationTitle);
        continue;
      }
      const cells = row.map(field => ({
        ...field, labelLines: wrapReportText(field.label, bold, 8, inline ? cellWidth * .41 - PAD : cellWidth - PAD * 2),
        valueLines: wrapReportText(field.value, font, BODY, inline ? cellWidth * .59 - PAD * 2 : cellWidth - PAD * 2), offset: 0,
      }));
      while (cells.some(c => c.offset < c.valueLines.length)) {
        const labelHeight = Math.max(...cells.map(c => c.labelLines.length)) * 11;
        const overhead = inline ? PAD * 2 : PAD * 2 + labelHeight + 4;
        if (y + overhead + LEADING > BOTTOM) { newPage(); if (continuationTitle) heading(`${continuationTitle} (continued)`); }
        const capacity = Math.max(1, Math.floor((BOTTOM - y - overhead) / LEADING));
        const count = Math.min(capacity, Math.max(...cells.map(c => c.valueLines.length - c.offset)));
        const height = overhead + Math.max(count * LEADING, inline ? labelHeight : 0);
        cells.forEach((cell, column) => {
          const x = M + column * cellWidth;
          rect(x, y, cellWidth, height, fill);
          lines(cell.labelLines, x + PAD, y + PAD, 8, bold, reportTheme.green, 11);
          lines(cell.valueLines.slice(cell.offset, cell.offset + count), inline ? x + cellWidth * .41 + PAD : x + PAD, inline ? y + PAD : y + PAD + labelHeight + 4);
          cell.offset += count;
        });
        y += height;
      }
    }
    y += 20;
  }

  function summaryCards() {
    if (!report.summaries.length) return;
    const gap = 8, width = (CW - gap * (report.summaries.length - 1)) / report.summaries.length;
    const values = report.summaries.map(f => wrapReportText(f.value, font, BODY, width - PAD * 2));
    // Long narratives use full-width sections, never tiny type or truncation.
    if (values.some(value => value.length > 7)) {
      for (const field of report.summaries) {
        heading(field.label);
        fieldRows([field], 1, reportTheme.white, field.label);
      }
      return;
    }
    const height = 42 + Math.max(...values.map(v => v.length)) * LEADING;
    ensure(height + 16);
    report.summaries.forEach((field, i) => {
      const x = M + i * (width + gap);
      const fill = field.label === 'Visit Notes' ? reportTheme.blue : field.label === 'Treatment Plan' ? reportTheme.peach : reportTheme.sage;
      rect(x, y, width, height, fill);
      text(field.label.toUpperCase(), x + PAD, y + PAD, 8, bold, reportTheme.green);
      lines(values[i], x + PAD, y + 30);
    });
    y += height + 22;
  }

  function progressTable() {
    if (!report.progress.length) return;
    const dateWidth = 92, contentWidth = CW - dateWidth - PAD * 2;
    function tableHeading(continued = false) {
      heading(`Progress Sheet${continued ? ' (continued)' : ''}`, 24 + 27 + PAD * 2 + LEADING * 3);
      rect(M, y, CW, 27, reportTheme.sage);
      text('DATE', M + PAD, y + 8, 8, bold, reportTheme.green);
      text('PROGRESS ENTRY', M + dateWidth + PAD, y + 8, 8, bold, reportTheme.green);
      y += 27;
    }
    tableHeading();
    const details: [keyof Assessment['progress'][number], string][] = [
      ['sessionVisit', 'Session / Visit'], ['entryType', 'Entry Type'], ['subjective', 'Subjective (Patient Report)'],
      ['objective', 'Objective (Findings)'], ['treatmentProvided', 'Treatment Provided'],
      ['patientResponse', 'Patient Response'], ['planNextVisit', 'Plan for Next Visit'],
    ];
    for (const row of [...report.progress].sort((a, b) => a.date.localeCompare(b.date))) {
      const body: { value: string; label: boolean }[] = wrapReportText(row.treatment, font, BODY, contentWidth).map(value => ({ value, label: false }));
      for (const [key, label] of details) {
        if (!row[key]) continue;
        body.push({ value: label, label: true });
        body.push(...wrapReportText(String(row[key]), font, BODY, contentWidth).map(value => ({ value, label: false })));
      }
      if (row.visibleToPatient !== undefined) body.push({ value: '', label: false }, { value: row.visibleToPatient ? 'Shared with patient' : 'Clinical entry', label: true });
      let offset = 0;
      while (offset < body.length) {
        if (y + PAD * 2 + LEADING * 3 > BOTTOM) { newPage(); tableHeading(true); }
        let count = Math.min(body.length - offset, Math.floor((BOTTOM - y - PAD * 2) / LEADING));
        // Keep each detail label with at least one line of its value.
        if (offset + count < body.length && body[offset + count - 1]?.label && count > 1) count--;
        while (count > 1 && !body[offset + count - 1].value) count--;
        const height = Math.max(50, count * LEADING + PAD * 2);
        rect(M, y, CW, height);
        page.drawLine({ start: { x: M + dateWidth, y: H - y }, end: { x: M + dateWidth, y: H - y - height }, thickness: .5, color: reportTheme.line });
        text(reportDate(row.date), M + PAD, y + PAD, 9, bold, reportTheme.forest);
        if (offset) text('(continued)', M + PAD, y + PAD + LEADING, 8, font, reportTheme.muted);
        body.slice(offset, offset + count).forEach((line, i) => text(line.value, M + dateWidth + PAD, y + PAD + i * LEADING, line.label ? 9 : BODY, line.label ? bold : font, line.label ? reportTheme.green : reportTheme.ink));
        offset += count;
        while (offset < body.length && !body[offset].value) offset++;
        y += height;
      }
    }
    y += 20;
  }

  newPage();
  const titleLines = wrapReportText(report.title, display, 25, CW);
  lines(titleLines, M, y, 25, display, reportTheme.forest, 29);
  y += titleLines.length * 29 + 5;
  text('Clinical care summary and treatment record', M, y, 10, font, reportTheme.muted);
  y += 26;
  const status = report.released ? 'Released to patient' : 'Draft - clinical use only';
  const statusWidth = bold.widthOfTextAtSize(status, 9) + 24;
  const location = wrapReportText(clinic.address || clinic.clinicName || '', font, 9, CW - statusWidth - 20);
  lines(location, M, y + 7, 9, font, reportTheme.muted);
  rect(W - M - statusWidth, y, statusWidth, 27, report.released ? reportTheme.sage : reportTheme.peach);
  text(status, W - M - statusWidth + 12, y + 7, 9, bold, reportTheme.forest);
  y += Math.max(27, location.length * LEADING + 7) + 14;
  fieldRows(report.metadata);
  summaryCards();
  for (const section of report.sections) {
    if (!section.fields.length) continue;
    heading(section.title);
    fieldRows(section.fields, section.columns, section.title === 'Examination' ? reportTheme.blue : reportTheme.white, section.title, section.columns > 1);
  }
  progressTable();
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, index) => {
    page = p;
    page.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: .6, color: reportTheme.line });
    const center = `Page ${index + 1} of ${total}`, right = 'Confidential clinical document';
    const drawFooter = (value: string, x: number) => {
      const before = boxes.length;
      text(value, x, H - 32, 8, font, reportTheme.muted, 'footer');
      boxes[before].page = index + 1;
    };
    drawFooter('MindSpine', M);
    drawFooter(center, (W - font.widthOfTextAtSize(center, 8)) / 2);
    drawFooter(right, W - M - font.widthOfTextAtSize(right, 8));
  });
  return { bytes: await pdf.save(), pageCount: total, textBoxes: boxes };
}

export async function renderInvoiceReport(invoice: Invoice, clinic: { address?: string; clinicName?: string }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [logoBytes, regularBytes, boldBytes] = await Promise.all([
    readFile(join(process.cwd(), 'public/reports/mindspine-logo.png')),
    readFile(join(process.cwd(), 'public/reports/dm-sans-regular.woff')),
    readFile(join(process.cwd(), 'public/reports/dm-sans-bold.woff')),
  ]);
  const logo = await pdf.embedPng(logoBytes);
  const font = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const display = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const amount = `INR ${(invoice.amount / 100).toFixed(2)}`;
  const status = invoice.status === 'paid' ? 'Paid' : invoice.status === 'void' ? 'Void' : invoice.status === 'refunded' ? 'Refunded' : 'Unpaid';
  const statusFill = invoice.status === 'paid' ? reportTheme.sage : invoice.status === 'void' ? reportTheme.peach : reportTheme.blue;
  const fields: Field[] = [
    { label: 'Invoice', value: invoice.id }, { label: 'Patient', value: invoice.patient },
    { label: 'Service', value: invoice.service }, { label: 'Appointment ID', value: invoice.appointment_id },
    { label: 'Created', value: reportDate(invoice.created_at, true) },
    ...(invoice.payment_reference ? [{ label: 'Payment Reference', value: invoice.payment_reference }] : []),
  ];
  const boxes: ReportTextBox[] = [];
  let page: PDFPage, y = 0;
  function text(value: string, x: number, top: number, size = BODY, face = font, fill = reportTheme.ink, zone: ReportTextBox['zone'] = 'body') {
    if (!value) return;
    page.drawText(value, { x, y: H - top - size, size, font: face, color: fill });
    boxes.push({ page: pdf.getPageCount(), text: value, x, top, width: face.widthOfTextAtSize(value, size), height: size * 1.25, zone });
  }
  function lines(values: string[], x: number, top: number, size = BODY, face = font, fill = reportTheme.ink, leading = LEADING) {
    values.forEach((value, index) => text(value, x, top + index * leading, size, face, fill));
  }
  function rect(x: number, top: number, width: number, height: number, fill = reportTheme.white) {
    page.drawRectangle({ x, y: H - top - height, width, height, color: fill, borderColor: reportTheme.line, borderWidth: .5 });
  }
  function newPage() {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: reportTheme.ivory });
    const logoWidth = 148, logoHeight = logo.height * logoWidth / logo.width;
    page.drawImage(logo, { x: M, y: H - 22 - logoHeight, width: logoWidth, height: logoHeight });
    text('INVOICE RECEIPT', W - M - bold.widthOfTextAtSize('INVOICE RECEIPT', 8), 29, 8, bold, reportTheme.muted, 'header');
    page.drawLine({ start: { x: W - M - 30, y: H - 77 }, end: { x: W - M - 3, y: H - 46 }, color: reportTheme.line, thickness: .8 });
    for (let i = 0; i < 3; i++) page.drawEllipse({ x: W - M - 22 + i * 8, y: H - 67 + i * 9, xScale: 7, yScale: 3, borderColor: reportTheme.line, borderWidth: .6 });
    y = 92;
  }
  function fieldGrid() {
    const width = CW / 2, height = 66;
    for (let index = 0; index < fields.length; index += 2) {
      const row = fields.slice(index, index + 2);
      row.forEach((field, column) => {
        const x = M + column * width;
        rect(x, y, width, height);
        text(field.label, x + PAD, y + PAD, 8, bold, reportTheme.green);
        lines(wrapReportText(field.value, font, BODY, width - PAD * 2), x + PAD, y + PAD + 19);
      });
      y += height;
    }
    y += 22;
  }
  newPage();
  lines(['Invoice Receipt'], M, y, 25, display, reportTheme.forest, 29);
  y += 34;
  text('Payment record for clinic services', M, y, 10, font, reportTheme.muted);
  y += 26;
  text(clinic.address || clinic.clinicName || '', M, y + 7, 9, font, reportTheme.muted);
  const statusWidth = bold.widthOfTextAtSize(status, 9) + 24;
  rect(W - M - statusWidth, y, statusWidth, 27, statusFill);
  text(status, W - M - statusWidth + 12, y + 7, 9, bold, reportTheme.forest);
  y += 41;
  fieldGrid();
  const summaryHeight = 96;
  rect(M, y, CW, summaryHeight, reportTheme.sage);
  text('AMOUNT', M + PAD, y + PAD, 8, bold, reportTheme.green);
  text(amount, M + PAD, y + 31, 23, bold, reportTheme.forest);
  text(status === 'Paid' ? 'Payment recorded' : 'Payment status recorded by clinic staff', M + PAD, y + 67, 9, font, reportTheme.muted);
  y += summaryHeight + 28;
  text('Payment Details', M, y, 12, bold, reportTheme.forest);
  y += 24;
  const paymentFields = [{ label: 'Status', value: status }, { label: 'Reference', value: invoice.payment_reference || 'Not recorded' }];
  for (const [index, field] of paymentFields.entries()) {
    const x = M + index * (CW / 2);
    rect(x, y, CW / 2, 58, field.label === 'Status' ? statusFill : reportTheme.white);
    text(field.label, x + PAD, y + PAD, 8, bold, reportTheme.green);
    lines(wrapReportText(field.value, font, BODY, CW / 2 - PAD * 2), x + PAD, y + PAD + 19);
  }
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, index) => {
    page = p;
    page.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: .6, color: reportTheme.line });
    const center = `Page ${index + 1} of ${total}`, right = 'Confidential payment document';
    text('MindSpine', M, H - 32, 8, font, reportTheme.muted, 'footer');
    text(center, (W - font.widthOfTextAtSize(center, 8)) / 2, H - 32, 8, font, reportTheme.muted, 'footer');
    text(right, W - M - font.widthOfTextAtSize(right, 8), H - 32, 8, font, reportTheme.muted, 'footer');
  });
  return { bytes: await pdf.save(), pageCount: total, textBoxes: boxes };
}
