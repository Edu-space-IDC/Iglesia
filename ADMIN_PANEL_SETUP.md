# Panel Admin de Encuestas

Este proyecto ahora tiene un panel administrativo separado del sitio publico.

## Que hace

- abre en otra URL: `admin.html`
- usa la misma hoja principal de Google Sheets
- permite ver, crear, editar y borrar encuestas
- permite cambiar estados, colores y nombres de estados
- permite cambiar el usuario admin y la contrasena

## 1. Preparar el service account

1. En Google Cloud crea un `Service Account`.
2. Genera una llave JSON.
3. Guarda ese archivo como:

```text
server/credentials/google-service-account.json
```

Puedes usar como base el archivo:

```text
server/credentials/google-service-account.example.json
```

## 2. Habilitar Google Sheets API

En el mismo proyecto de Google Cloud del service account:

1. Abre `APIs & Services`.
2. Entra a `Library`.
3. Busca `Google Sheets API`.
4. Pulsa `Enable`.

Si esta API esta apagada, el panel admin mostrara un error de acceso aunque el JSON y el ID de la hoja sean correctos.

## 3. Compartir la hoja

Comparte tu Google Sheet con el correo del service account, por ejemplo:

```text
tu-service-account@tu-proyecto.iam.gserviceaccount.com
```

Debe quedar con permiso de editor.

## 4. Crear el archivo de entorno local

Crea un archivo `.env.admin` en la raiz del proyecto.

Si ya vas a usar la hoja actual, normalmente solo necesitas revisar estos valores:

```text
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_RESPONSES_SHEET_NAME=Formulario Web - la barca
GOOGLE_SERVICE_ACCOUNT_FILE=server/credentials/google-service-account.json
ADMIN_SERVER_PORT=8787
```

## 5. Levantar en local

Abre dos terminales en la raiz del proyecto.

Terminal 1:

```bash
npm run dev:admin-server
```

Terminal 2:

```bash
npm run dev
```

## 6. URLs locales

Sitio publico:

```text
http://127.0.0.1:5173/
```

Panel admin:

```text
http://127.0.0.1:5173/admin.html
```

API local:

```text
http://127.0.0.1:<ADMIN_SERVER_PORT>/api/admin/public-config
```

## 7. Primer acceso

Usuario inicial:

```text
admin
```

Alias inicial tambien aceptado:

```text
administrador
```

Contrasena inicial:

```text
1234
```

Luego puedes cambiar todo desde la pestana `Cuenta`.

## 8. Como funcionan los estados

Los estados se guardan en una pestana aparte de la misma hoja llamada:

```text
Admin Estados
```

Desde el panel puedes:

- renombrarlos
- cambiar el color
- anadir nuevos
- eliminar estados

Cuando renombras o eliminas un estado y guardas:

- el panel actualiza la configuracion
- los registros existentes se sincronizan
- todo sigue respaldado en Google Sheets

## 9. Cuenta admin

La cuenta se guarda en otra pestana de la misma hoja:

```text
Admin Usuarios
```

La contrasena no se guarda en texto plano. Se guarda con hash.

## 10. Apps Script publico

La web publica puede seguir enviando respuestas por Apps Script como hasta ahora.

La plantilla `google-apps-script/NewHereForm.gs` ya fue ajustada para que la hoja incluya la columna:

```text
Estado
```

Las respuestas publicas entran con ese campo vacio y el panel admin lo normaliza usando el primer estado activo.
