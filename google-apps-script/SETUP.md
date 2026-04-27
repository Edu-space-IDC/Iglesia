# Conectar el formulario con Google Sheets

## 1. Crear la hoja en Google Drive

1. Entra a Google Drive.
2. Crea un archivo de Google Sheets.
3. Ponle un nombre, por ejemplo: `Formulario Nuevos - La Barca`.
4. Copia el ID del archivo desde la URL.

Ejemplo:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0
```

El ID es:

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

## 2. Crear el Apps Script

1. Ve a https://script.google.com/
2. Crea un proyecto nuevo.
3. Borra el contenido del archivo `Code.gs`.
4. Copia y pega el contenido de [NewHereForm.gs](./NewHereForm.gs).
5. Reemplaza esta constante:

```javascript
const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_SPREADSHEET';
```

por el ID real de tu hoja.

## 3. Probar que escriba en la hoja

1. En Apps Script, abre la función `testWriteSampleRow`.
2. Haz clic en `Run`.
3. Autoriza el proyecto cuando Google te lo pida.
4. Vuelve a tu Google Sheet y confirma que apareció una fila de prueba.

La hoja se creará sola con el nombre:

```javascript
const SHEET_NAME = 'Formulario Web';
```

si todavía no existe.

La columna principal de fecha quedará guardada como:

```text
Fecha y hora Colombia
```

y siempre se escribe usando la zona horaria:

```text
America/Bogota
```

No se crea la columna `Timestamp ISO`.

## 4. Desplegar como Web App

Google indica que una web app de Apps Script debe exponer `doGet(e)` o `doPost(e)` y luego desplegarse desde `Deploy` como Web App:
- Web apps: https://developers.google.com/apps-script/guides/web
- `Sheet.appendRow(...)`: https://developers.google.com/apps-script/reference/spreadsheet/sheet
- `ContentService.createTextOutput(...)`: https://developers.google.com/apps-script/reference/content/content-service

Haz esto:

1. En Apps Script, clic en `Deploy`.
2. Selecciona `New deployment`.
3. En tipo, elige `Web app`.
4. En `Execute as`, elige `Me`.
5. En `Who has access`, elige `Anyone`.
6. Despliega.
7. Copia la URL final que termina en `/exec`.

Usa la URL `/exec`, no la `/dev`.

## 5. Pegar la URL en tu proyecto

Abre [src/app/newHereConfig.ts](../src/app/newHereConfig.ts) y pega la URL en:

```ts
export const NEW_HERE_FORM_SUBMIT_URL = '';
```

Debe quedar así:

```ts
export const NEW_HERE_FORM_SUBMIT_URL =
  'https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec';
```

## 6. Publicar tu web otra vez

Después de guardar la URL:

1. vuelve a desplegar tu sitio web,
2. abre el formulario,
3. envía una prueba,
4. revisa que la fila aparezca en Google Sheets.

## 7. Campos que ya envía tu formulario

Tu frontend ya está mandando estos nombres:

- `firstName`
- `lastName`
- `phone`
- `email`
- `prayerRequest`
- `source`

La fecha la genera directamente Apps Script en horario de Colombia, así no depende de la zona horaria del navegador ni del servidor.

Si más adelante agregas preguntas nuevas en `NEW_HERE_FORM_QUESTIONS`, podemos actualizar también este script para que guarde esas nuevas columnas.

## Nota importante

Tu frontend usa `fetch(..., { mode: 'no-cors' })` para compatibilidad con Apps Script. Eso significa que el navegador no puede leer la respuesta real del servidor.

En la práctica:

- el formulario sí se puede enviar,
- pero la confirmación visual del frontend es optimista,
- la verificación real siempre debes hacerla mirando la hoja.

Si luego quieres una confirmación 100% confiable en pantalla, el siguiente paso sería poner un backend intermedio con CORS controlado.
