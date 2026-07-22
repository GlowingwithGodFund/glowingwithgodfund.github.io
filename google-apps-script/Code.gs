const SPREADSHEET_ID = '1KpaJbwJswzd8QXtNfFT9poxR_G-nvLtcuBF22iyImAY';
const SHEET_NAME = 'Applications';
const HEADERS = [
  'Submitted At',
  'Submission ID',
  'Full Name',
  'Date of Birth',
  'Phone',
  'Email',
  'Address',
  'City',
  'State',
  'Zip',
  'Referral Sources',
  'Specific Reference',
  'Hair Loss Conditions',
  'Condition Details',
  'Estimated Start',
  'Impact',
  'Financial Hardship',
  'Financial Explanation',
  'Supporting Documents',
  'Supporting Documents List',
  'Initials',
  'Signature',
  'Signature Date',
  'Uploads',
  'Raw Payload',
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    const row = [
      payload.submitted_at || new Date().toISOString(),
      payload.submission_id || '',
      value_(payload, 'applicant.full_name'),
      value_(payload, 'applicant.date_of_birth'),
      value_(payload, 'applicant.phone'),
      value_(payload, 'applicant.email'),
      value_(payload, 'applicant.address'),
      value_(payload, 'applicant.city'),
      value_(payload, 'applicant.state'),
      value_(payload, 'applicant.zip'),
      list_(payload.referral && payload.referral.sources),
      value_(payload, 'referral.specific_reference'),
      list_(payload.hair_loss && payload.hair_loss.conditions),
      value_(payload, 'hair_loss.details'),
      value_(payload, 'hair_loss.estimated_start'),
      value_(payload, 'hair_loss.impact'),
      value_(payload, 'financial.hardship'),
      value_(payload, 'financial.explanation'),
      list_(payload.financial && payload.financial.supporting_documents),
      value_(payload, 'financial.supporting_documents_list'),
      value_(payload, 'acknowledgments.initials'),
      value_(payload, 'acknowledgments.signature'),
      value_(payload, 'acknowledgments.signature_date'),
      uploadLinks_(payload.uploads),
      JSON.stringify(payload),
    ];
    sheet.appendRow(row);
    const appendedRow = sheet.getLastRow();

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        spreadsheet_id: sheet.getParent().getId(),
        spreadsheet_url: sheet.getParent().getUrl(),
        sheet_name: sheet.getName(),
        appended_row: appendedRow,
        last_full_name: value_(payload, 'applicant.full_name'),
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  try {
    const sheet = getSheet_();
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        spreadsheet_id: sheet.getParent().getId(),
        spreadsheet_url: sheet.getParent().getUrl(),
        sheet_name: sheet.getName(),
        last_row: sheet.getLastRow(),
        headers: sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0],
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupHeaders() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const firstRowValues = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headerMatches = HEADERS.every((header, index) => firstRowValues[index] === header);
  const firstRowIsBlank = firstRowValues.every((value) => value === '');

  if (!headerMatches) {
    if (!firstRowIsBlank) {
      sheet.insertRowBefore(1);
    }
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function value_(payload, path) {
  return path.split('.').reduce((current, key) => current && current[key], payload) || '';
}

function list_(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function uploadLinks_(uploads) {
  if (!Array.isArray(uploads)) return '';
  return uploads
    .map((upload) => `${upload.field_name || 'file'}: ${upload.object_url || upload.object_key || ''}`)
    .join('\n');
}
