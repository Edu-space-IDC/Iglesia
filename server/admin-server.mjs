import { createServer } from 'node:http';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';

const ROOT_DIR = process.cwd();
const DEFAULT_SPREADSHEET_ID = '1JyNI-QU_7AXiU5M0I0RECfPZz1b4B-ELAlGCDcH0m9Y';
const DEFAULT_RESPONSES_SHEET_NAME = 'Formulario Web - la barca';
const ADMIN_USERS_SHEET_NAME = 'Admin Usuarios';
const ADMIN_STATUSES_SHEET_NAME = 'Admin Estados';
const STATUS_HEADERS = ['Key', 'Nombre', 'Color', 'Orden', 'Activo'];
const USER_HEADERS = ['Username', 'Display Name', 'Email', 'Password Hash', 'Aliases', 'Updated At'];
const RESPONSE_HEADERS = [
  'Nombre',
  'Apellidos',
  'Telefono',
  'Correo',
  'Peticion de oracion',
  'Origen',
  'Fecha y hora',
  'Estado',
];
const EXPORT_HEADERS = [
  'Nombre',
  'Apellidos',
  'Telefono',
  'Correo',
  'Peticion de oracion',
  'Origen',
  'Fecha y hora',
  'Estado',
];
const DEFAULT_STATUSES = [
  { key: 'nuevo', label: 'Nuevo', color: '#06b6d4', order: 0, active: true },
  { key: 'contactado', label: 'Contactado', color: '#f59e0b', order: 1, active: true },
  { key: 'seguimiento', label: 'En seguimiento', color: '#2563eb', order: 2, active: true },
  { key: 'orando', label: 'Orando', color: '#10b981', order: 3, active: true },
  { key: 'cerrado', label: 'Cerrado', color: '#64748b', order: 4, active: true },
];
const DEFAULT_ADMIN_ACCOUNT = {
  username: 'admin',
  displayName: 'Administrador',
  email: '',
  aliases: ['administrador'],
  password: '1234',
};
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const API_PREFIX = '/api/admin';
const sessions = new Map();
let runtimePromise = null;
let spreadsheetSetupPromise = null;

loadEnvironmentFile('.env.admin');

const config = {
  host: process.env.ADMIN_SERVER_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.ADMIN_SERVER_PORT || '8787', 10),
  allowedOrigins: (process.env.ADMIN_ALLOWED_ORIGINS ||
    'http://127.0.0.1:5173,http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
  responsesSheetName:
    process.env.GOOGLE_SHEETS_RESPONSES_SHEET_NAME || DEFAULT_RESPONSES_SHEET_NAME,
  googleServiceAccountFile:
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'server/credentials/google-service-account.json',
  googleServiceAccountEmail: getConfiguredServiceAccountEmail(),
};

const server = createServer(async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const baseUrl = `http://${request.headers.host || `${config.host}:${config.port}`}`;
  const url = new URL(request.url || '/', baseUrl);
  const pathname = normalizePathname(url.pathname);

  if (!pathname.startsWith(API_PREFIX)) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        ok: false,
        message: 'Ruta no encontrada.',
      }),
    );
    return;
  }

  try {
    if (pathname === `${API_PREFIX}/public-config` && request.method === 'GET') {
      const readiness = await getSetupReadiness();
      return sendJson(response, 200, {
        ok: true,
        ready: readiness.ready,
        missing: readiness.missing,
        spreadsheetId: config.spreadsheetId,
        responsesSheetName: config.responsesSheetName,
        serviceAccountFile: config.googleServiceAccountFile,
        defaultCredentials: {
          username: DEFAULT_ADMIN_ACCOUNT.username,
          alias: DEFAULT_ADMIN_ACCOUNT.aliases[0],
          password: DEFAULT_ADMIN_ACCOUNT.password,
        },
      });
    }

    if (pathname === `${API_PREFIX}/login` && request.method === 'POST') {
      const runtime = await getRuntime();
      const body = await readJsonBody(request);
      const account = await readAdminAccount(runtime);
      const username = normalizeString(body.username).toLowerCase();
      const password = normalizeString(body.password);

      if (!username || !password) {
        return sendJson(response, 400, {
          ok: false,
          message: 'Ingresa tu usuario y contrasena.',
        });
      }

      const validNames = new Set(
        [account.username, ...(account.aliases || [])]
          .map((value) => normalizeString(value).toLowerCase())
          .filter(Boolean),
      );
      const isUsernameValid = validNames.has(username);
      const isPasswordValid = verifyPassword(password, account.passwordHash);

      if (!isUsernameValid || !isPasswordValid) {
        return sendJson(response, 401, {
          ok: false,
          message: 'Usuario o contrasena incorrectos.',
        });
      }

      const token = createSessionToken(account);
      return sendJson(response, 200, {
        ok: true,
        token,
        profile: toProfile(account),
      });
    }

    if (pathname === `${API_PREFIX}/logout` && request.method === 'POST') {
      const session = getSessionFromRequest(request);
      if (session) {
        sessions.delete(session.token);
      }

      return sendJson(response, 200, {
        ok: true,
      });
    }

    const runtime = await getRuntime();
    const session = requireSession(request);

    if (pathname === `${API_PREFIX}/session` && request.method === 'GET') {
      const account = await readAdminAccount(runtime);
      return sendJson(response, 200, {
        ok: true,
        profile: toProfile(account),
      });
    }

    if (pathname === `${API_PREFIX}/bootstrap` && request.method === 'GET') {
      const data = await loadBootstrapData(runtime);
      return sendJson(response, 200, {
        ok: true,
        ...data,
      });
    }

    if (pathname === `${API_PREFIX}/records` && request.method === 'GET') {
      const data = await loadBootstrapData(runtime);
      return sendJson(response, 200, {
        ok: true,
        records: data.records,
        statuses: data.statuses,
      });
    }

    if (pathname === `${API_PREFIX}/records/export` && request.method === 'GET') {
      const exportResult = await buildRecordsWorkbook(runtime);
      response.writeHead(200, {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-store',
      });
      response.end(exportResult.buffer);
      return;
    }

    if (pathname === `${API_PREFIX}/records` && request.method === 'POST') {
      const body = await readJsonBody(request);
      const record = await createRecord(runtime, body);
      return sendJson(response, 201, {
        ok: true,
        record,
      });
    }

    if (pathname === `${API_PREFIX}/statuses` && request.method === 'PUT') {
      const body = await readJsonBody(request);
      const statuses = await saveStatuses(runtime, body.statuses || []);
      return sendJson(response, 200, {
        ok: true,
        statuses,
      });
    }

    if (pathname === `${API_PREFIX}/account` && request.method === 'PUT') {
      const body = await readJsonBody(request);
      const updatedAccount = await updateAdminAccount(runtime, body);
      session.username = normalizeString(updatedAccount.username).toLowerCase();
      return sendJson(response, 200, {
        ok: true,
        profile: toProfile(updatedAccount),
      });
    }

    const recordMatch = pathname.match(/^\/api\/admin\/records\/(\d+)$/);
    if (recordMatch && request.method === 'PUT') {
      const body = await readJsonBody(request);
      const sheetRow = Number.parseInt(recordMatch[1], 10);
      const record = await updateRecord(runtime, sheetRow, body);
      return sendJson(response, 200, {
        ok: true,
        record,
      });
    }

    if (recordMatch && request.method === 'DELETE') {
      const sheetRow = Number.parseInt(recordMatch[1], 10);
      await deleteRecord(runtime, sheetRow);
      return sendJson(response, 200, {
        ok: true,
      });
    }

    return sendJson(response, 404, {
      ok: false,
      message: 'Ruta no encontrada.',
    });
  } catch (error) {
    return handleServerError(response, error);
  }
});

server.listen(config.port, config.host, () => {
  console.log(
    `[admin-server] escuchando en http://${config.host}:${config.port}${API_PREFIX}/public-config`,
  );
});

function normalizePathname(pathname) {
  if (!pathname) {
    return '/';
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function loadEnvironmentFile(relativeFilePath) {
  const absoluteFilePath = path.resolve(ROOT_DIR, relativeFilePath);

  try {
    const fileContents = readFileSync(absoluteFilePath, 'utf8');
    fileContents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .forEach((line) => {
        const separatorIndex = line.indexOf('=');
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const cleanedValue = rawValue.replace(/^"(.*)"$/u, '$1').replace(/^'(.*)'$/u, '$1');

        if (!process.env[key]) {
          process.env[key] = cleanedValue;
        }
      });
  } catch {
    return;
  }
}

async function getSetupReadiness() {
  const missing = [];
  const filePath = path.resolve(ROOT_DIR, config.googleServiceAccountFile);
  const hasEnvCredentials =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const hasServiceAccountFile = await fileExists(filePath);

  if (!config.spreadsheetId) {
    missing.push(
      'Configura GOOGLE_SHEETS_SPREADSHEET_ID en .env.admin con el ID de tu hoja principal.',
    );
  }

  if (!hasEnvCredentials && !hasServiceAccountFile) {
    missing.push(
      `Crea ${config.googleServiceAccountFile} con la llave del service account o define GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.`,
    );
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

async function getRuntime() {
  const readiness = await getSetupReadiness();
  if (!readiness.ready) {
    throw createSetupError(readiness.missing);
  }

  if (!runtimePromise) {
    runtimePromise = createSheetsClient()
      .then((sheets) => ({ sheets }))
      .catch((error) => {
        runtimePromise = null;
        throw error;
      });
  }

  const runtime = await runtimePromise;

  if (!spreadsheetSetupPromise) {
    spreadsheetSetupPromise = ensureSpreadsheetStructure(runtime.sheets).catch((error) => {
      spreadsheetSetupPromise = null;
      throw error;
    });
  }

  await spreadsheetSetupPromise;
  return runtime;
}

async function createSheetsClient() {
  const serviceAccountFile = path.resolve(ROOT_DIR, config.googleServiceAccountFile);
  const hasServiceAccountFile = await fileExists(serviceAccountFile);

  const auth = hasServiceAccountFile
    ? new google.auth.GoogleAuth({
        keyFile: serviceAccountFile,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })
    : new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(
            /\\n/g,
            '\n',
          ),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

  return google.sheets({
    version: 'v4',
    auth,
  });
}

async function ensureSpreadsheetStructure(sheets) {
  const metadata = await getSpreadsheetMetadata(sheets);

  await ensureSheetWithHeaders(sheets, metadata, config.responsesSheetName, RESPONSE_HEADERS);
  await ensureSheetWithHeaders(sheets, metadata, ADMIN_USERS_SHEET_NAME, USER_HEADERS);
  await ensureSheetWithHeaders(sheets, metadata, ADMIN_STATUSES_SHEET_NAME, STATUS_HEADERS);

  await ensureDefaultAdminAccount(sheets);
  await ensureDefaultStatuses(sheets);
}

async function getSpreadsheetMetadata(sheets) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
    includeGridData: false,
  });

  return response.data;
}

async function ensureSheetWithHeaders(sheets, metadata, title, headers) {
  let sheet = findSheetByTitle(metadata, title);

  if (!sheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title },
            },
          },
        ],
      },
    });

    const freshMetadata = await getSpreadsheetMetadata(sheets);
    sheet = findSheetByTitle(freshMetadata, title);
  }

  if (!sheet?.properties?.sheetId) {
    throw new Error(`No pudimos preparar la hoja "${title}".`);
  }

  const currentValues = await getRangeValues(sheets, `${escapeSheetTitle(title)}!A1:Z1`);
  const currentHeaders = (currentValues[0] || []).map((value) => String(value || ''));
  const headersAreDifferent = headers.some(
    (header, index) => normalizeString(currentHeaders[index]) !== header,
  );

  if (currentValues.length === 0 || headersAreDifferent) {
    await updateRangeValues(sheets, `${escapeSheetTitle(title)}!A1`, [headers]);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheet.properties.sheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  });
}

function findSheetByTitle(metadata, title) {
  return (metadata.sheets || []).find(
    (sheet) => normalizeString(sheet.properties?.title) === normalizeString(title),
  );
}

async function ensureDefaultAdminAccount(sheets) {
  const rows = await getRangeValues(sheets, `${escapeSheetTitle(ADMIN_USERS_SHEET_NAME)}!A2:F`);
  if (rows.length > 0) {
    return;
  }

  const now = formatBogotaDate();
  const passwordHash = hashPassword(DEFAULT_ADMIN_ACCOUNT.password);

  await updateRangeValues(sheets, `${escapeSheetTitle(ADMIN_USERS_SHEET_NAME)}!A2`, [
    [
      DEFAULT_ADMIN_ACCOUNT.username,
      DEFAULT_ADMIN_ACCOUNT.displayName,
      DEFAULT_ADMIN_ACCOUNT.email,
      passwordHash,
      DEFAULT_ADMIN_ACCOUNT.aliases.join(','),
      now,
    ],
  ]);
}

async function ensureDefaultStatuses(sheets) {
  const rows = await getRangeValues(sheets, `${escapeSheetTitle(ADMIN_STATUSES_SHEET_NAME)}!A2:E`);
  if (rows.length > 0) {
    return;
  }

  await updateRangeValues(
    sheets,
    `${escapeSheetTitle(ADMIN_STATUSES_SHEET_NAME)}!A2`,
    DEFAULT_STATUSES.map((status) => [
      status.key,
      status.label,
      status.color,
      String(status.order),
      status.active ? 'TRUE' : 'FALSE',
    ]),
  );
}

async function readAdminAccount(runtime) {
  const rows = await getRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(ADMIN_USERS_SHEET_NAME)}!A2:F`,
  );

  if (rows.length === 0) {
    await ensureDefaultAdminAccount(runtime.sheets);
    return readAdminAccount(runtime);
  }

  const [row] = rows;
  return {
    username: normalizeString(row[0]) || DEFAULT_ADMIN_ACCOUNT.username,
    displayName: normalizeString(row[1]) || DEFAULT_ADMIN_ACCOUNT.displayName,
    email: normalizeString(row[2]),
    passwordHash: normalizeString(row[3]),
    aliases: normalizeAliases(row[4]),
    updatedAt: normalizeString(row[5]),
  };
}

async function loadStatuses(runtime) {
  const rows = await getRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(ADMIN_STATUSES_SHEET_NAME)}!A2:E`,
  );

  const statuses = rows
    .map((row, index) => ({
      key: slugify(normalizeString(row[0])) || `estado-${index + 1}`,
      label: normalizeString(row[1]) || `Estado ${index + 1}`,
      color: normalizeHexColor(row[2]) || DEFAULT_STATUSES[0].color,
      order: Number.parseInt(normalizeString(row[3]) || String(index), 10),
      active: normalizeBoolean(row[4]),
    }))
    .filter((status) => status.active !== false)
    .sort((left, right) => left.order - right.order);

  if (statuses.length > 0) {
    return statuses;
  }

  await ensureDefaultStatuses(runtime.sheets);
  return loadStatuses(runtime);
}

async function loadBootstrapData(runtime) {
  const profile = toProfile(await readAdminAccount(runtime));
  const statuses = await loadStatuses(runtime);
  await normalizeRecordStatuses(runtime, statuses);
  const records = await loadRecords(runtime, statuses);

  return {
    profile,
    statuses,
    records,
  };
}

async function buildRecordsWorkbook(runtime) {
  const statuses = await loadStatuses(runtime);
  await normalizeRecordStatuses(runtime, statuses);
  const records = await loadRecords(runtime, statuses);
  const worksheetRows = [
    EXPORT_HEADERS,
    ...records.map((record) => [
      record.firstName,
      record.lastName,
      record.phone,
      record.email,
      record.prayerRequest,
      record.source,
      record.submittedAt,
      record.status,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 40 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Encuestas');

  return {
    filename: buildRecordsExportFilename(),
    buffer: XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    }),
  };
}

async function loadRecords(runtime, statuses) {
  const rows = await getRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(config.responsesSheetName)}!A2:H`,
  );
  const fallbackStatus = statuses[0]?.label || DEFAULT_STATUSES[0].label;

  return rows
    .map((row, index) => {
      const sheetRow = index + 2;
      const rawValues = [
        normalizeString(row[0]),
        normalizeString(row[1]),
        normalizeString(row[2]),
        normalizeString(row[3]),
        normalizeString(row[4]),
        normalizeString(row[5]),
        normalizeString(row[6]),
        normalizeString(row[7]),
      ];

      if (!rawValues.some(Boolean)) {
        return null;
      }

      return {
        sheetRow,
        firstName: rawValues[0],
        lastName: rawValues[1],
        phone: rawValues[2],
        email: rawValues[3],
        prayerRequest: rawValues[4],
        source: rawValues[5],
        submittedAt: rawValues[6],
        status: rawValues[7] || fallbackStatus,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

async function createRecord(runtime, input) {
  const statuses = await loadStatuses(runtime);
  const fallbackStatus = statuses[0]?.label || DEFAULT_STATUSES[0].label;
  const record = normalizeRecordInput(input, fallbackStatus, statuses);

  const appendResult = await appendRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(config.responsesSheetName)}!A2`,
    recordToRow(record),
  );
  const sheetRow = extractSheetRowFromAppendResult(appendResult);

  return {
    sheetRow,
    ...record,
  };
}

async function updateRecord(runtime, sheetRow, input) {
  assertValidSheetRow(sheetRow);
  const statuses = await loadStatuses(runtime);
  const fallbackStatus = statuses[0]?.label || DEFAULT_STATUSES[0].label;
  const record = normalizeRecordInput(input, fallbackStatus, statuses);

  await updateRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(config.responsesSheetName)}!A${sheetRow}:H${sheetRow}`,
    [recordToRow(record)],
  );

  return {
    sheetRow,
    ...record,
  };
}

async function deleteRecord(runtime, sheetRow) {
  assertValidSheetRow(sheetRow);
  const metadata = await getSpreadsheetMetadata(runtime.sheets);
  const sheet = findSheetByTitle(metadata, config.responsesSheetName);
  const sheetId = sheet?.properties?.sheetId;

  if (typeof sheetId !== 'number') {
    throw new Error('No encontramos la hoja principal de encuestas.');
  }

  await runtime.sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow - 1,
              endIndex: sheetRow,
            },
          },
        },
      ],
    },
  });
}

async function saveStatuses(runtime, incomingStatuses) {
  const previousStatuses = await loadStatuses(runtime);
  const normalizedStatuses = normalizeStatusesInput(incomingStatuses, previousStatuses);

  await clearRange(runtime.sheets, `${escapeSheetTitle(ADMIN_STATUSES_SHEET_NAME)}!A2:E`);
  await updateRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(ADMIN_STATUSES_SHEET_NAME)}!A2`,
    normalizedStatuses.map((status) => [
      status.key,
      status.label,
      status.color,
      String(status.order),
      status.active ? 'TRUE' : 'FALSE',
    ]),
  );

  await normalizeRecordStatuses(runtime, normalizedStatuses, previousStatuses);
  return normalizedStatuses;
}

async function updateAdminAccount(runtime, input) {
  const account = await readAdminAccount(runtime);
  const username = normalizeString(input.username) || account.username;
  const displayName = normalizeString(input.displayName) || username;
  const email = normalizeString(input.email);
  const currentPassword = normalizeString(input.currentPassword);
  const newPassword = normalizeString(input.newPassword);
  const confirmPassword = normalizeString(input.confirmPassword);

  if (username.length < 3) {
    throw createHttpError(400, 'El usuario debe tener al menos 3 caracteres.');
  }

  if (displayName.length < 3) {
    throw createHttpError(400, 'El nombre visible debe tener al menos 3 caracteres.');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw createHttpError(400, 'El correo no tiene un formato valido.');
  }

  let passwordHash = account.passwordHash;
  if (newPassword || confirmPassword) {
    if (!currentPassword) {
      throw createHttpError(400, 'Ingresa tu contrasena actual para cambiarla.');
    }

    if (!verifyPassword(currentPassword, account.passwordHash)) {
      throw createHttpError(401, 'La contrasena actual no coincide.');
    }

    if (newPassword.length < 4) {
      throw createHttpError(400, 'La nueva contrasena debe tener al menos 4 caracteres.');
    }

    if (newPassword !== confirmPassword) {
      throw createHttpError(400, 'La confirmacion de la contrasena no coincide.');
    }

    passwordHash = hashPassword(newPassword);
  }

  const updatedAccount = {
    username,
    displayName,
    email,
    passwordHash,
    aliases: [],
    updatedAt: formatBogotaDate(),
  };

  await updateRangeValues(runtime.sheets, `${escapeSheetTitle(ADMIN_USERS_SHEET_NAME)}!A2`, [
    [
      updatedAccount.username,
      updatedAccount.displayName,
      updatedAccount.email,
      updatedAccount.passwordHash,
      '',
      updatedAccount.updatedAt,
    ],
  ]);

  return updatedAccount;
}

async function normalizeRecordStatuses(runtime, nextStatuses, previousStatuses = []) {
  const rows = await getRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(config.responsesSheetName)}!A2:H`,
  );

  if (rows.length === 0) {
    return;
  }

  const fallbackLabel = nextStatuses[0]?.label || DEFAULT_STATUSES[0].label;
  const validLabels = new Set(nextStatuses.map((status) => status.label));
  const renameMap = new Map();
  const nextByKey = new Map(nextStatuses.map((status) => [status.key, status]));

  previousStatuses.forEach((status) => {
    const replacement = nextByKey.get(status.key);
    if (replacement && replacement.label !== status.label) {
      renameMap.set(status.label, replacement.label);
    }

    if (!replacement) {
      renameMap.set(status.label, fallbackLabel);
    }
  });

  let hasChanges = false;
  const updatedStatusColumn = rows.map((row) => {
    const rawValues = [
      normalizeString(row[0]),
      normalizeString(row[1]),
      normalizeString(row[2]),
      normalizeString(row[3]),
      normalizeString(row[4]),
      normalizeString(row[5]),
      normalizeString(row[6]),
      normalizeString(row[7]),
    ];

    if (!rawValues.some(Boolean)) {
      return [''];
    }

    const currentStatus = normalizeString(row[7]);

    if (!currentStatus) {
      hasChanges = true;
      return [fallbackLabel];
    }

    if (renameMap.has(currentStatus)) {
      hasChanges = true;
      return [renameMap.get(currentStatus)];
    }

    if (!validLabels.has(currentStatus)) {
      hasChanges = true;
      return [fallbackLabel];
    }

    return [currentStatus];
  });

  if (!hasChanges) {
    return;
  }

  await updateRangeValues(
    runtime.sheets,
    `${escapeSheetTitle(config.responsesSheetName)}!H2`,
    updatedStatusColumn,
  );
}

function normalizeRecordInput(input, fallbackStatus, statuses) {
  const allowedStatuses = new Set(statuses.map((status) => status.label));
  const firstName = requiredField(input.firstName, 'El nombre es obligatorio.');
  const lastName = requiredField(input.lastName, 'Los apellidos son obligatorios.');
  const phone = requiredField(input.phone, 'El telefono es obligatorio.');
  const status = normalizeString(input.status);

  return {
    firstName,
    lastName,
    phone,
    email: normalizeString(input.email),
    prayerRequest: normalizeString(input.prayerRequest),
    source: normalizeString(input.source) || 'panel-admin',
    submittedAt: normalizeString(input.submittedAt) || formatBogotaDate(),
    status: allowedStatuses.has(status) ? status : fallbackStatus,
  };
}

function normalizeStatusesInput(incomingStatuses, previousStatuses) {
  if (!Array.isArray(incomingStatuses) || incomingStatuses.length === 0) {
    throw createHttpError(400, 'Debes dejar al menos un estado disponible.');
  }

  const previousByKey = new Map(previousStatuses.map((status) => [status.key, status]));
  const seenKeys = new Set();
  const seenLabels = new Set();

  const normalizedStatuses = incomingStatuses.map((status, index) => {
    const fallbackPrevious = previousByKey.get(slugify(status.key)) || previousStatuses[index];
    const key = slugify(normalizeString(status.key) || fallbackPrevious?.key || status.label);
    const label = normalizeString(status.label);
    const color = normalizeHexColor(status.color);

    if (!key) {
      throw createHttpError(400, 'Todos los estados deben tener una llave interna valida.');
    }

    if (!label) {
      throw createHttpError(400, 'Todos los estados deben tener nombre.');
    }

    if (seenKeys.has(key)) {
      throw createHttpError(400, 'Cada estado debe tener una llave unica.');
    }

    const normalizedLabelKey = label.toLowerCase();
    if (seenLabels.has(normalizedLabelKey)) {
      throw createHttpError(400, 'No repitas nombres de estado.');
    }

    seenKeys.add(key);
    seenLabels.add(normalizedLabelKey);

    return {
      key,
      label,
      color: color || DEFAULT_STATUSES[0].color,
      order: index,
      active: true,
    };
  });

  return normalizedStatuses;
}

function recordToRow(record) {
  return [
    sanitizeCellValue(record.firstName),
    sanitizeCellValue(record.lastName),
    sanitizeCellValue(record.phone),
    sanitizeCellValue(record.email),
    sanitizeCellValue(record.prayerRequest),
    sanitizeCellValue(record.source),
    sanitizeCellValue(record.submittedAt),
    sanitizeCellValue(record.status),
  ];
}

function toProfile(account) {
  return {
    username: account.username,
    displayName: account.displayName,
    email: account.email,
    updatedAt: account.updatedAt || '',
  };
}

function createSessionToken(account) {
  pruneExpiredSessions();

  const token = randomUUID();
  sessions.set(token, {
    token,
    username: normalizeString(account.username).toLowerCase(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return token;
}

function getSessionFromRequest(request) {
  pruneExpiredSessions();
  const authorizationHeader = request.headers.authorization || '';
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/iu);

  if (!match) {
    return null;
  }

  const token = match[1].trim();
  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function requireSession(request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    throw createHttpError(401, 'Tu sesion expiro. Vuelve a iniciar sesion.');
  }

  return session;
}

function pruneExpiredSessions() {
  const now = Date.now();
  sessions.forEach((session, token) => {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  });
}

function hashPassword(password) {
  const iterations = 120000;
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, iterationText, salt, hash] = normalizeString(storedHash).split('$');
  if (algorithm !== 'pbkdf2' || !iterationText || !salt || !hash) {
    return false;
  }

  const derivedHash = pbkdf2Sync(
    password,
    salt,
    Number.parseInt(iterationText, 10),
    hash.length / 2,
    'sha512',
  );
  const storedBuffer = Buffer.from(hash, 'hex');

  if (derivedHash.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedHash, storedBuffer);
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw createHttpError(400, 'El cuerpo de la peticion no es JSON valido.');
  }
}

async function getRangeValues(sheets, range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });

  return response.data.values || [];
}

async function updateRangeValues(sheets, range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });
}

async function appendRangeValues(sheets, range, row) {
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });

  return response.data;
}

async function clearRange(sheets, range) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: config.spreadsheetId,
    range,
  });
}

function setCorsHeaders(request, response) {
  const requestOrigin = normalizeString(request.headers.origin);
  const allowAllOrigins = config.allowedOrigins.includes('*');
  const allowedOrigin =
    allowAllOrigins || !requestOrigin || config.allowedOrigins.includes(requestOrigin)
      ? requestOrigin || '*'
      : config.allowedOrigins[0] || '*';

  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function handleServerError(response, error) {
  if (error?.code === 'SETUP_REQUIRED') {
    return sendJson(response, 503, {
      ok: false,
      code: error.code,
      message: 'Falta configurar la conexion con Google Sheets.',
      details: error.details || [],
    });
  }

  const googleAccessErrorPayload = getGoogleAccessErrorPayload(error);
  if (googleAccessErrorPayload) {
    return sendJson(response, 503, googleAccessErrorPayload);
  }

  if (isGoogleQuotaError(error)) {
    return sendJson(response, 429, {
      ok: false,
      code: 'GOOGLE_SHEETS_QUOTA_EXCEEDED',
      message:
        'Google Sheets esta recibiendo demasiadas lecturas en este momento. Espera un minuto y vuelve a intentar.',
    });
  }

  if (error?.statusCode) {
    return sendJson(response, error.statusCode, {
      ok: false,
      message: error.message,
    });
  }

  console.error('[admin-server]', error);

  return sendJson(response, 500, {
    ok: false,
    message: 'Ocurrio un error inesperado en el panel admin.',
  });
}

function isGooglePermissionError(error) {
  const status = error?.status || error?.code;
  return status === 403 || status === 404;
}

function isGoogleQuotaError(error) {
  const status = error?.status || error?.code;
  return status === 429;
}

function getGoogleAccessErrorPayload(error) {
  if (!isGooglePermissionError(error)) {
    return null;
  }

  const status = error?.status || error?.code;
  const googleMessage = normalizeString(error?.response?.data?.error?.message || error?.message);
  const googleDetails = Array.isArray(error?.response?.data?.error?.details)
    ? error.response.data.error.details
    : [];
  const serviceDisabledDetail = googleDetails.find(
    (detail) => normalizeString(detail?.reason) === 'SERVICE_DISABLED',
  );
  const activationUrl = normalizeString(
    googleDetails
      .flatMap((detail) => (Array.isArray(detail?.links) ? detail.links : []))
      .map((link) => normalizeString(link?.url))
      .find(Boolean),
  );
  const isServiceDisabled =
    Boolean(serviceDisabledDetail) ||
    /accessnotconfigured|api has not been used|is disabled/iu.test(googleMessage);

  if (isServiceDisabled) {
    const consumerProject = normalizeString(serviceDisabledDetail?.metadata?.consumer);
    return {
      ok: false,
      code: 'GOOGLE_SHEETS_API_DISABLED',
      message:
        'No pudimos acceder a Google Sheets porque la Google Sheets API esta desactivada en el proyecto del service account.',
      details: [
        consumerProject ? `Proyecto afectado: ${consumerProject}.` : '',
        activationUrl
          ? `Activa la API aqui: ${activationUrl}`
          : 'Activa Google Sheets API en Google Cloud Console para el proyecto del service account.',
        'Despues de activarla, espera unos minutos y vuelve a intentar.',
      ].filter(Boolean),
    };
  }

  if (status === 404) {
    return {
      ok: false,
      code: 'GOOGLE_SPREADSHEET_NOT_FOUND',
      message:
        'No encontramos la hoja de Google Sheets configurada. Revisa que el ID del spreadsheet sea correcto.',
      details: config.spreadsheetId
        ? [`Spreadsheet configurado: ${config.spreadsheetId}`]
        : [],
    };
  }

  return {
    ok: false,
    code: 'GOOGLE_ACCESS_ERROR',
    message:
      'No pudimos acceder a Google Sheets. Revisa que la hoja este compartida con el service account y que el ID sea correcto.',
    details: [
      config.googleServiceAccountEmail
        ? `Comparte la hoja con el service account: ${config.googleServiceAccountEmail}`
        : '',
      googleMessage,
    ].filter(Boolean),
  };
}

function createSetupError(details) {
  const error = new Error('SETUP_REQUIRED');
  error.code = 'SETUP_REQUIRED';
  error.details = details;
  return error;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requiredField(value, message) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw createHttpError(400, message);
  }

  return normalized;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeAliases(value) {
  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBoolean(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'yes';
}

function normalizeHexColor(value) {
  const normalized = normalizeString(value);
  if (/^#[0-9a-fA-F]{6}$/u.test(normalized)) {
    return normalized.toLowerCase();
  }

  return '';
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function sanitizeCellValue(value) {
  const safeValue = normalizeString(value);
  if (/^[=+\-@]/u.test(safeValue)) {
    return `'${safeValue}`;
  }

  return safeValue;
}

function formatBogotaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function escapeSheetTitle(title) {
  return `'${String(title || '').replace(/'/gu, "''")}'`;
}

function assertValidSheetRow(sheetRow) {
  if (!Number.isInteger(sheetRow) || sheetRow < 2) {
    throw createHttpError(400, 'La fila indicada no es valida.');
  }
}

function extractSheetRowFromAppendResult(result) {
  const updatedRange = normalizeString(result?.updates?.updatedRange);
  const match = updatedRange.match(/![A-Z]+(\d+):/u);

  if (!match) {
    return 0;
  }

  return Number.parseInt(match[1], 10);
}

function buildRecordsExportFilename() {
  const timestamp = formatBogotaDate().replace(/[:\s]/gu, '-');
  return `encuestas-la-barca-${timestamp}.xlsx`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getConfiguredServiceAccountEmail() {
  const envEmail = normalizeString(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  if (envEmail) {
    return envEmail;
  }

  const serviceAccountFile = path.resolve(
    ROOT_DIR,
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'server/credentials/google-service-account.json',
  );

  try {
    const credentials = JSON.parse(readFileSync(serviceAccountFile, 'utf8'));
    return normalizeString(credentials.client_email);
  } catch {
    return '';
  }
}
