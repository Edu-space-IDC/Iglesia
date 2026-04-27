const COLOMBIA_TIME_ZONE = 'America/Bogota';
const SPREADSHEET_ID = '1JyNI-QU_7AXiU5M0I0RECfPZz1b4B-ELAlGCDcH0m9Y';
const SHEET_NAME = 'Formulario Web - la barca';

const HEADERS = [
  'Nombre',
  'Apellidos',
  'Telefono',
  'Correo',
  'Peticion de oracion',
  'Origen',
  'Fecha y hora',
  'Estado',
];

function doGet() {
  return jsonOutput_({
    ok: true,
    message: 'Web App activa. Usa POST para guardar formularios.',
    sheetName: SHEET_NAME,
  });
}

function doPost(e) {
  try {
    const sheet = getOrCreateSheet_();
    const payload = getPayload_(e);

    validatePayload_(payload);

    const now = new Date();
    const formattedDate = Utilities.formatDate(
      now,
      COLOMBIA_TIME_ZONE,
      'yyyy-MM-dd HH:mm:ss',
    );

    const row = [
      sanitizeCellValue_(payload.firstName),
      sanitizeCellValue_(payload.lastName),
      sanitizeCellValue_(payload.phone),
      sanitizeCellValue_(payload.email),
      sanitizeCellValue_(payload.prayerRequest),
      sanitizeCellValue_(payload.source || 'la-barca-web'),
      formattedDate,
      '',
    ];

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return jsonOutput_({
      ok: true,
      message: 'Formulario guardado correctamente.',
    });
  } catch (error) {
    return jsonOutput_({
      ok: false,
      message: error.message || 'No se pudo guardar el formulario.',
    });
  }
}

function testWriteSampleRow() {
  const sampleEvent = {
    parameter: {
      firstName: 'Prueba',
      lastName: 'Formulario',
      phone: '3000000000',
      email: 'prueba@correo.com',
      prayerRequest: 'Esta es una fila de prueba.',
      source: 'manual-test',
    },
  };

  Logger.log(doPost(sampleEvent).getContent());
}

function getOrCreateSheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_SPREADSHEET') {
    throw new Error('Debes configurar SPREADSHEET_ID antes de desplegar.');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaderRow_(sheet);
  return sheet;
}

function ensureHeaderRow_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const currentHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(String);

  const relevantHeaders = currentHeaders.slice(0, HEADERS.length);
  const headersAreMissing = relevantHeaders.every((value) => value.trim() === '');
  const headersAreDifferent = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (headersAreMissing || headersAreDifferent) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  hideLegacyTimestampColumn_(sheet, currentHeaders);
}

function getPayload_(e) {
  return (e && e.parameter) || {};
}

function validatePayload_(payload) {
  if (!payload.firstName || !payload.firstName.trim()) {
    throw new Error('El nombre es obligatorio.');
  }

  if (!payload.lastName || !payload.lastName.trim()) {
    throw new Error('Los apellidos son obligatorios.');
  }

  if (!payload.phone || !payload.phone.trim()) {
    throw new Error('El telefono es obligatorio.');
  }
}

function sanitizeCellValue_(value) {
  const safeValue = String(value || '').trim();

  if (/^[=+\-@]/.test(safeValue)) {
    return "'" + safeValue;
  }

  return safeValue;
}

function hideLegacyTimestampColumn_(sheet, headers) {
  headers.forEach((header, index) => {
    if (header === 'Timestamp ISO') {
      sheet.hideColumns(index + 1);
    }
  });
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
