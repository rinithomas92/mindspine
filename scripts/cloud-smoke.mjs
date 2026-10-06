import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
const base = process.env.TEST_URL;
assert(base && process.env.DATABASE_URL, 'Set TEST_URL and DATABASE_URL for the fictional cloud demo.');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'verify-full');
const pool = new Pool({ connectionString: url.toString() });
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Kolkata'});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const query=async(sql,args=[]) => (await pool.query(sql,args)).rows;
const marker=`Deployment verification ${Date.now()}`;
let appointment;
async function login(role){
 await page.goto(base);
 await page.getByLabel('Email address').fill(`${role}@mindspine.local`);
 await page.getByLabel('Password',{exact:true}).fill('MindSpineDemo!2026');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Log out',exact:true}).waitFor();
 console.log(`PASS ${role} sign-in`);
}
async function logout(){await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();}
try {
 await login('patient');
 mkdirSync('qa/cloud',{recursive:true});
 await page.screenshot({path:'qa/cloud/patient.png',fullPage:true});
 await page.getByRole('button',{name:'Book a visit',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Clinician',{exact:true}).selectOption('doctor');
 const dates=await dialog.getByLabel('Date',{exact:true}).locator('option').evaluateAll(opts=>opts.map(o=>o.value).filter(Boolean));
 await dialog.getByLabel('Date',{exact:true}).selectOption(dates[5]);
 await dialog.getByLabel('Available time',{exact:true}).selectOption({index:1});
 await dialog.getByLabel('Reason for visit').fill(marker);
 await dialog.getByRole('button',{name:'Confirm appointment',exact:true}).click();
 await dialog.waitFor({state:'hidden'});
 [appointment]=await query('SELECT * FROM appointments WHERE reason=$1',[marker]);
 assert(appointment?.patient_id==='patient');
 assert.equal((await query('SELECT status FROM invoices WHERE appointment_id=$1',[appointment.id]))[0].status,'unpaid');
 await page.reload();
 await page.getByRole('button',{name:'Log out',exact:true}).waitFor();
 console.log('PASS cloud booking and invoice persisted after reload');
 const [note]=await query("SELECT id FROM notes WHERE patient_id='patient' LIMIT 1");
 const pdf=await context.request.get(`${base}/api/reports?type=note&id=${note.id}`);
 assert.equal(pdf.status(),200);assert((await PDFDocument.load(await pdf.body())).getPageCount()>0);
 const [other]=await query("SELECT id FROM notes WHERE patient_id='patient2' LIMIT 1");
 assert.equal((await context.request.get(`${base}/api/reports?type=note&id=${other.id}`)).status(),404);
 assert.equal((await context.request.get(`${base}/api/export`)).status(),403);
 console.log('PASS PDF report and patient access isolation');
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'qa/cloud/mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await logout();await login('doctor');
 const exportResponse=await context.request.get(`${base}/api/export`);
 assert.equal(exportResponse.status(),200);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await exportResponse.body());assert(workbook.worksheets.length>0);
 console.log('PASS practitioner Excel export');
 await logout();await login('admin');
 await page.screenshot({path:'qa/cloud/admin.png',fullPage:true});
 assert.equal((await context.request.get(`${base}/api/reports?type=note&id=${note.id}`)).status(),404);
 assert.deepEqual(errors,[]);
 console.log('PASS admin clinical restriction, mobile layout, no uncaught browser errors');
}finally{
 // Only remove the test booking identified by our unique marker; retain its audit trail.
 const created=await query('SELECT id FROM appointments WHERE reason=$1',[marker]);
 for(const a of created){await query('DELETE FROM invoices WHERE appointment_id=$1',[a.id]);await query('DELETE FROM appointments WHERE id=$1',[a.id]);}
 await browser.close();await pool.end();
}


