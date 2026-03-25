// ============================================================
// BACKEND - Google Apps Script para Boda Edgardo & Kiara
// ============================================================
// 
// INSTRUCCIONES DE INSTALACIÓN:
// 1. Ve a https://sheets.google.com → Crear nueva hoja de cálculo
// 2. Nombra la hoja: "Boda Edgardo & Kiara - Base de Datos"
// 3. Crea 2 hojas (pestañas) con estos nombres exactos:
//    - "Invitados" (columnas: Código | Nombre | MaxAcompañantes | Estado | FechaRegistro)
//    - "RSVP"      (columnas: Código | Nombre | Asistirá | Acompañantes | Restricción | Mensaje | FechaConfirmación)
// 4. Ve a Extensiones → Apps Script
// 5. Borra todo el código que aparece y pega ESTE archivo completo
// 6. Click en "Implementar" → "Nueva implementación"
//    - Tipo: "Aplicación web"
//    - Ejecutar como: "Yo" (tu cuenta)
//    - Quién tiene acceso: "Cualquier persona"
// 7. Click en "Implementar" → Copia la URL que te da
// 8. Pega esa URL en tus archivos HTML (boda-edgardo.html y admin-boda.html)
//
// ¡IMPORTANTE! Cada vez que modifiques este código, debes hacer una
// NUEVA implementación (no "editar" la existente) para que los cambios se reflejen.
// ============================================================

// === CONFIGURACIÓN ===
const SHEET_INVITADOS = 'Invitados';
const SHEET_RSVP = 'RSVP';

// === HELPERS ===
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Normaliza un código: elimina espacios y convierte a mayúsculas
function normalizeCode(code) {
  return code.toString().trim().toUpperCase();
}

// === MAIN HANDLERS ===

// Maneja peticiones GET (validar código, obtener invitados, obtener RSVPs)
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {

      case 'validate':
        return validateCode(e.parameter.code);

      case 'getGuests':
        return getGuests(e.parameter.adminKey);

      case 'getRSVPs':
        return getRSVPs(e.parameter.adminKey);

      case 'getStats':
        return getStats(e.parameter.adminKey);

      default:
        return jsonResponse({ success: false, error: 'Acción no válida' });
    }
  } catch (err) {
    Logger.log('Error en doGet: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// Maneja peticiones POST (guardar RSVP, agregar invitado, eliminar invitado)
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    Logger.log('Error parseando datos POST: ' + err.message);
    return jsonResponse({ success: false, error: 'Datos inválidos' });
  }

  try {
    switch (data.action) {

      case 'submitRSVP':
        return submitRSVP(data);

      case 'addGuest':
        return addGuest(data);

      case 'addGuestsBulk':
        return addGuestsBulk(data);

      case 'removeGuest':
        return removeGuest(data);

      case 'clearAll':
        return clearAllGuests(data);

      default:
        return jsonResponse({ success: false, error: 'Acción no válida' });
    }
  } catch (err) {
    Logger.log('Error en doPost (action=' + data.action + '): ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}


// ============================================================
// FUNCIONES PÚBLICAS (Invitados)
// ============================================================

// Valida si un código de invitación existe
function validateCode(code) {
  if (!code) return jsonResponse({ success: false, error: 'Código requerido' });

  const normalizedCode = normalizeCode(code);
  const sheet = getSheet(SHEET_INVITADOS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalizeCode(data[i][0]) === normalizedCode) {
      // Verificar si ya confirmó RSVP
      const rsvpSheet = getSheet(SHEET_RSVP);
      const rsvpData = rsvpSheet.getDataRange().getValues();
      let alreadyConfirmed = false;

      for (let j = 1; j < rsvpData.length; j++) {
        if (normalizeCode(rsvpData[j][0]) === normalizedCode) {
          alreadyConfirmed = true;
          break;
        }
      }

      return jsonResponse({
        success: true,
        guest: {
          code: data[i][0],
          name: data[i][1],
          maxCompanions: data[i][2] || 3,
          alreadyConfirmed: alreadyConfirmed
        }
      });
    }
  }

  return jsonResponse({ success: false, error: 'Código no encontrado' });
}

// Guarda una confirmación RSVP
function submitRSVP(data) {
  const { code, name, attending, companions, restriction, message } = data;

  if (!code || !name) {
    return jsonResponse({ success: false, error: 'Datos incompletos' });
  }

  // Validar que el código existe
  const invSheet = getSheet(SHEET_INVITADOS);
  const invData = invSheet.getDataRange().getValues();
  let validGuest = null;
  const normalizedCode = normalizeCode(code);

  for (let i = 1; i < invData.length; i++) {
    if (normalizeCode(invData[i][0]) === normalizedCode) {
      validGuest = { row: i + 1, name: invData[i][1], maxCompanions: invData[i][2] || 3 };
      break;
    }
  }

  if (!validGuest) {
    return jsonResponse({ success: false, error: 'Código inválido' });
  }

  // Validar máximo de acompañantes
  const numCompanions = parseInt(companions) || 0;
  if (numCompanions > validGuest.maxCompanions) {
    return jsonResponse({
      success: false,
      error: `Máximo ${validGuest.maxCompanions} acompañantes permitidos para esta invitación`
    });
  }

  const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  const rsvpSheet = getSheet(SHEET_RSVP);
  const rsvpData = rsvpSheet.getDataRange().getValues();

  // Actualizar RSVP si ya existe
  for (let j = 1; j < rsvpData.length; j++) {
    if (normalizeCode(rsvpData[j][0]) === normalizedCode) {
      rsvpSheet.getRange(j + 1, 1, 1, 7).setValues([[
        normalizedCode,
        name,
        attending,
        numCompanions,
        restriction || 'Ninguna',
        message || '',
        timestamp
      ]]);
      invSheet.getRange(validGuest.row, 4).setValue(attending === 'si' ? 'Confirmado' : 'No asistirá');
      return jsonResponse({ success: true, message: 'RSVP actualizado correctamente', updated: true });
    }
  }

  // Nuevo RSVP
  rsvpSheet.appendRow([
    normalizedCode,
    name,
    attending,
    numCompanions,
    restriction || 'Ninguna',
    message || '',
    timestamp
  ]);
  invSheet.getRange(validGuest.row, 4).setValue(attending === 'si' ? 'Confirmado' : 'No asistirá');

  return jsonResponse({ success: true, message: '¡RSVP registrado exitosamente!' });
}


// ============================================================
// FUNCIONES ADMIN (requieren adminKey)
// ============================================================

const ADMIN_KEY = 'EdgardoKiara2026Admin'; // ← Cambia esta clave

function verifyAdmin(key) {
  if (key !== ADMIN_KEY) {
    throw new Error('Acceso no autorizado');
  }
}

// Obtener lista completa de invitados
function getGuests(adminKey) {
  verifyAdmin(adminKey);

  const sheet = getSheet(SHEET_INVITADOS);
  const data = sheet.getDataRange().getValues();
  const guests = [];

  for (let i = 1; i < data.length; i++) {
    guests.push({
      code: data[i][0],
      name: data[i][1],
      maxCompanions: data[i][2] || 3,
      status: data[i][3] || 'Pendiente',
      addedAt: data[i][4] || ''
    });
  }

  return jsonResponse({ success: true, guests });
}

// Obtener todas las confirmaciones RSVP
function getRSVPs(adminKey) {
  verifyAdmin(adminKey);

  const sheet = getSheet(SHEET_RSVP);
  const data = sheet.getDataRange().getValues();
  const rsvps = [];

  for (let i = 1; i < data.length; i++) {
    rsvps.push({
      code: data[i][0],
      name: data[i][1],
      attending: data[i][2],
      companions: data[i][3],
      restriction: data[i][4],
      message: data[i][5],
      confirmedAt: data[i][6]
    });
  }

  return jsonResponse({ success: true, rsvps });
}

// Obtener estadísticas
function getStats(adminKey) {
  verifyAdmin(adminKey);

  const invSheet = getSheet(SHEET_INVITADOS);
  const rsvpSheet = getSheet(SHEET_RSVP);
  const invData = invSheet.getDataRange().getValues();
  const rsvpData = rsvpSheet.getDataRange().getValues();

  const totalInvitados = invData.length - 1;
  let confirmados = 0;
  let noAsistiran = 0;
  let totalPersonas = 0;

  for (let i = 1; i < rsvpData.length; i++) {
    if (rsvpData[i][2] === 'si') {
      confirmados++;
      totalPersonas += 1 + (parseInt(rsvpData[i][3]) || 0);
    } else {
      noAsistiran++;
    }
  }

  return jsonResponse({
    success: true,
    stats: {
      totalInvitados,
      confirmados,
      noAsistiran,
      pendientes: totalInvitados - confirmados - noAsistiran,
      totalPersonas
    }
  });
}

// Agregar un invitado
function addGuest(data) {
  verifyAdmin(data.adminKey);

  const { name, maxCompanions } = data;
  if (!name) return jsonResponse({ success: false, error: 'Nombre requerido' });

  const code = generateUniqueCode();
  const sheet = getSheet(SHEET_INVITADOS);

  sheet.appendRow([
    code,
    name.trim(),
    maxCompanions || 3,
    'Pendiente',
    new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
  ]);

  return jsonResponse({ success: true, guest: { code, name: name.trim(), maxCompanions: maxCompanions || 3 } });
}

// Agregar invitados masivamente — escritura en batch para mayor velocidad
function addGuestsBulk(data) {
  verifyAdmin(data.adminKey);

  const { names, maxCompanions } = data;
  if (!names || !Array.isArray(names) || names.length === 0) {
    return jsonResponse({ success: false, error: 'Lista de nombres vacía' });
  }

  const sheet = getSheet(SHEET_INVITADOS);
  const existing = sheet.getDataRange().getValues().map(r => r[1].toString().toLowerCase());
  const added = [];
  const duplicates = [];
  const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  const rowsToAdd = [];

  names.forEach(name => {
    name = name.trim();
    if (!name) return;

    if (existing.includes(name.toLowerCase())) {
      duplicates.push(name);
      return;
    }

    const code = generateUniqueCode();
    rowsToAdd.push([code, name, maxCompanions || 3, 'Pendiente', now]);
    added.push({ code, name });
    existing.push(name.toLowerCase());
  });

  // Escritura en batch: una sola operación en lugar de N appendRow()
  if (rowsToAdd.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 5).setValues(rowsToAdd);
  }

  return jsonResponse({
    success: true,
    added: added.length,
    duplicates: duplicates.length,
    guests: added
  });
}

// Eliminar un invitado
function removeGuest(data) {
  verifyAdmin(data.adminKey);

  const { code } = data;
  if (!code) return jsonResponse({ success: false, error: 'Código requerido' });

  const normalizedCode = normalizeCode(code);
  const sheet = getSheet(SHEET_INVITADOS);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (normalizeCode(values[i][0]) === normalizedCode) {
      sheet.deleteRow(i + 1);

      // Eliminar RSVP asociado si existe
      const rsvpSheet = getSheet(SHEET_RSVP);
      const rsvpValues = rsvpSheet.getDataRange().getValues();
      for (let j = 1; j < rsvpValues.length; j++) {
        if (normalizeCode(rsvpValues[j][0]) === normalizedCode) {
          rsvpSheet.deleteRow(j + 1);
          break;
        }
      }

      return jsonResponse({ success: true, message: 'Invitado eliminado' });
    }
  }

  return jsonResponse({ success: false, error: 'Invitado no encontrado' });
}

// Borrar todos los invitados
function clearAllGuests(data) {
  verifyAdmin(data.adminKey);

  const invSheet = getSheet(SHEET_INVITADOS);
  const rsvpSheet = getSheet(SHEET_RSVP);

  // Conservar encabezados, eliminar el resto
  if (invSheet.getLastRow() > 1) {
    invSheet.deleteRows(2, invSheet.getLastRow() - 1);
  }
  if (rsvpSheet.getLastRow() > 1) {
    rsvpSheet.deleteRows(2, rsvpSheet.getLastRow() - 1);
  }

  return jsonResponse({ success: true, message: 'Todos los invitados eliminados' });
}


// ============================================================
// UTILIDADES
// ============================================================

function generateUniqueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const sheet = getSheet(SHEET_INVITADOS);
  const existing = sheet.getDataRange().getValues().map(r => r[0].toString().toUpperCase());

  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existing.includes(code));

  return code;
}


// ============================================================
// FUNCIÓN DE PRUEBA - Ejecuta esto primero para verificar permisos
// ============================================================
function testSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Crear hojas si no existen
  let invSheet = ss.getSheetByName(SHEET_INVITADOS);
  if (!invSheet) {
    invSheet = ss.insertSheet(SHEET_INVITADOS);
    invSheet.appendRow(['Código', 'Nombre', 'MaxAcompañantes', 'Estado', 'FechaRegistro']);
    invSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    invSheet.setColumnWidth(1, 100);
    invSheet.setColumnWidth(2, 250);
    invSheet.setColumnWidth(3, 140);
    invSheet.setColumnWidth(4, 120);
    invSheet.setColumnWidth(5, 160);
  }

  let rsvpSheet = ss.getSheetByName(SHEET_RSVP);
  if (!rsvpSheet) {
    rsvpSheet = ss.insertSheet(SHEET_RSVP);
    rsvpSheet.appendRow(['Código', 'Nombre', 'Asistirá', 'Acompañantes', 'Restricción', 'Mensaje', 'FechaConfirmación']);
    rsvpSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    rsvpSheet.setColumnWidth(1, 100);
    rsvpSheet.setColumnWidth(2, 250);
    rsvpSheet.setColumnWidth(3, 100);
    rsvpSheet.setColumnWidth(4, 120);
    rsvpSheet.setColumnWidth(5, 130);
    rsvpSheet.setColumnWidth(6, 250);
    rsvpSheet.setColumnWidth(7, 160);
  }

  // Agregar invitado de prueba
  invSheet.appendRow(['DEMO01', 'Invitado de Prueba', 3, 'Pendiente', new Date().toLocaleString('es-PE')]);

  Logger.log('✅ Setup completado. Hojas creadas con invitado de prueba.');
  Logger.log('📋 Ahora implementa como Aplicación Web.');
}
