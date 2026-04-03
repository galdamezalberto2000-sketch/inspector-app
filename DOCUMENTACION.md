# Documentación Técnica - Inspector App ENEE

## 1. ARCHIVOS DEL PROYECTO

```
inspector-app/
├── index.html              → Toda la interfaz visual
├── app.js                  → Toda la lógica (~4200 líneas)
├── styles.css              → Diseño y tema oscuro
├── sw.js                   → Service Worker - offline
├── manifest.json           → Configuración PWA
├── docs/
│   └── DOCUMENTACION.md    → Este archivo
└── server/
    └── google-apps-script.js → Código del servidor Google
```

| Archivo | Función |
|---|---|
| `index.html` | Toda la interfaz visual |
| `app.js` | Toda la lógica (~4200 líneas) |
| `styles.css` | Diseño y tema oscuro |
| `sw.js` | Service Worker - offline |
| `manifest.json` | Configuración PWA |
| `server/google-apps-script.js` | Código que vive en script.google.com |

---

## 2. LIBRERÍAS

### jsPDF
Genera PDFs en el navegador sin servidor.
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```
```javascript
const { jsPDF } = window.jspdf;
const pdf = new jsPDF();
pdf.text('Hola', 20, 20);   // x=20mm, y=20mm
pdf.save('archivo.pdf');     // Descarga en el celular
```

### Lucide Icons
Iconos SVG profesionales.
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<i data-lucide="camera"></i>   <!-- En HTML -->
lucide.createIcons();           <!-- En JS para activarlos -->
```

---

## 3. VARIABLES GLOBALES IMPORTANTES

```javascript
const GAS_URL_FIJA = 'https://script.google.com/...';
// URL del servidor. Todos los reportes se envían aquí.

var _todosLosReportes = [];
// Cache de reportes cargados del servidor.
// Se filtra en memoria sin volver a consultar.

let currentPhotoType = null;
// Indica qué campo de foto se está capturando.
// Ejemplo: 'inspeccionMoto', 'viajeKmInicial'
// Cuando se toma la foto, se asigna a la variable correcta.

let cameraStream = null;
// Referencia al video de la cámara.
// Se necesita para detenerla al cerrar el modal.
```

---

## 4. ENVÍO DE REPORTES

### enviarPorCorreo()
```javascript
async function enviarPorCorreo(tipo, campos) {
  // Separa fotos de texto
  for (const [k, v] of Object.entries(campos)) {
    if (v && typeof v === 'string' && v.startsWith('data:image')) {
      camposFotos[k] = v;   // Es foto base64
    } else {
      camposTexto[k] = v;   // Es texto
    }
  }
  // Comprime fotos a 200px / 30% calidad
  for (const k of Object.keys(camposFotos)) {
    camposFotos[k] = await comprimirImagen(camposFotos[k], 200, 0.3);
  }
  // Timeout de 15 segundos
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15000);
  // Envía al GAS
  const res = await fetch(GAS_URL_FIJA, { method: 'POST', ... });
}
```

### enviarEnSegundoPlano()
```javascript
function enviarEnSegundoPlano(tipo, campos) {
  enviarPorCorreo(tipo, campos).then(ok => {
    if (!ok) guardarEnCola(tipo, campos); // Si falla, guarda en cola
  });
  // No espera respuesta → no bloquea la UI
}
```

### Cola de pendientes
```javascript
// Si no hay internet, guarda el reporte
function guardarEnCola(tipo, campos) {
  const cola = JSON.parse(localStorage.getItem('cola_pendientes') || '[]');
  cola.push({ tipo, campos, ts: Date.now() });
  localStorage.setItem('cola_pendientes', JSON.stringify(cola));
}
// Cuando regresa internet, reenvía automáticamente
window.addEventListener('online', () => procesarCola());
```

---

## 5. COMPRESIÓN DE IMÁGENES

```javascript
function comprimirImagen(base64, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Calcula nuevo tamaño manteniendo proporción
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
      // quality=0.3 = 30% calidad → foto de 3MB queda en ~50KB
    };
    img.src = base64;
  });
}
```
**Por qué:** Las fotos originales pesan 3-5MB. Comprimidas pesan ~50KB, permitiendo enviarlas por correo.

---

## 6. CÁMARA

```javascript
function iniciarCamara() {
  // Intento 1: cámara trasera exacta
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } } })
  .catch(() => {
    // Intento 2: sin "exact" (más compatible con Safari)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .catch(() => {
      // Intento 3: cualquier cámara
      navigator.mediaDevices.getUserMedia({ video: true })
    });
  });
}
// 3 intentos porque Safari/iPhone no soporta "exact"
```

```javascript
function capturePhoto() {
  // Captura un frame del video
  canvas.getContext('2d').drawImage(cameraVideo, 0, 0);
  const photoData = canvas.toDataURL('image/jpeg', 0.8);
  // Asigna la foto según currentPhotoType
  if (currentPhotoType === 'inspeccionMoto') inspeccionMotoFoto = photoData;
  // etc.
}
```

---

## 7. AUTENTICACIÓN

```javascript
// Usuarios guardados en localStorage
let users = JSON.parse(localStorage.getItem('users')) || [];

// Usuarios por defecto
users.push({ username: 'admin', password: '1234', rol: 'inspector' });
users.push({ username: 'supervisor', password: 'super1234', rol: 'supervisor' });

// Login
loginForm.addEventListener('submit', (e) => {
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem('currentUser', user.username);
    localStorage.setItem('currentRol', user.rol);
    if (user.rol === 'supervisor') mostrarPanelSupervisor();
    else showMainScreen();
  }
});
```
**Nota:** Contraseñas en texto plano. Aceptable para app interna.

---

## 8. GUARDAR REPORTE (localStorage)

```javascript
function guardarReporte(modulo, datos) {
  const reportes = JSON.parse(localStorage.getItem(REPORTES_KEY)) || [];
  
  // Excluye fotos para no saturar localStorage (límite ~5MB)
  const datosSinFotos = {};
  for (const [k, v] of Object.entries(datos)) {
    if (typeof v === 'string' && v.startsWith('data:image')) continue;
    datosSinFotos[k] = v;
  }
  
  reportes.unshift({ id: Date.now(), modulo, ...datosSinFotos });
  // Date.now() = ID único basado en timestamp en milisegundos
  // unshift = agrega al inicio (más reciente primero)
  
  if (reportes.length > 200) reportes.splice(200); // Máximo 200
  localStorage.setItem(REPORTES_KEY, JSON.stringify(reportes));
}
```

---

## 9. GENERACIÓN DE PDF

```javascript
function generarPDFReubicacion(r) {
  const pdf = new jsPDF(); // A4 = 210x297mm

  // Encabezado con color
  pdf.setFillColor(102, 126, 234); // RGB azul
  pdf.rect(0, 0, 210, 40, 'F');   // x, y, ancho, alto, 'F'=relleno

  let y = 55; // Posición vertical actual

  // Campos de texto
  campos.forEach(([label, value]) => {
    pdf.text(`${label}:`, 20, y);  // Etiqueta en x=20
    pdf.text(String(value), 75, y); // Valor en x=75
    y += 8; // Baja 8mm
  });

  // Fotos lado a lado
  pdf.addImage(r.fachadaFoto, 'JPEG', 20, y, 80, 75);  // izquierda
  pdf.addImage(r.medidorFoto, 'JPEG', 110, y, 80, 75); // derecha

  pdf.save(`Reubicacion_${r.clave}.pdf`); // Descarga
}
```

---

## 10. SERVICE WORKER (sw.js)

```javascript
// Estrategia Network-First para archivos propios
self.addEventListener('fetch', e => {
  if (isOwn) {
    e.respondWith(
      fetch(e.request)           // 1. Intenta red
        .then(res => {
          cache.put(e.request, res.clone()); // Actualiza cache
          return res;
        })
        .catch(() => caches.match(e.request)) // 2. Si falla: usa cache
    );
  }
});
// Resultado: siempre versión nueva cuando hay internet
//            funciona offline con la última versión descargada
```

---

## 11. GOOGLE APPS SCRIPT

```javascript
function doPost(e) {
  const datos = JSON.parse(e.postData.contents);

  // Router por acción
  if (datos.accion === 'obtenerReportes')   return responderReportes(datos);
  if (datos.accion === 'guardarAsistencia') return guardarEnHojaSimple('Asistencia', ...);
  if (datos.accion === 'guardarDotacion')   return guardarEnHojaSimple('Dotacion', ...);
  if (datos.accion === 'guardarCharla')     // Sube fotos + guarda en Charlas

  // Reporte normal:
  // 1. Detecta fotos (campos que empiezan con 'data:image')
  // 2. Sube fotos a Google Drive
  // 3. Genera PDF (HTML → PDF via Google)
  // 4. Guarda fila en Google Sheets
  // 5. Envía correo con GmailApp.sendEmail()
}
```

**Por qué Content-Type: text/plain:**
GAS tiene restricciones CORS. Con `application/json` el navegador hace una "preflight request" que GAS no maneja. Con `text/plain` se evita ese problema.

---

## 12. PANEL SUPERVISOR

```javascript
async function cargarReportesSupervisor() {
  const res = await fetch(GAS_URL_FIJA, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ accion: 'obtenerReportes' })
  });
  const data = await res.json();
  _todosLosReportes = data.reportes || [];

  // Filtra reportes eliminados (guardados en localStorage)
  const eliminados = new Set(JSON.parse(localStorage.getItem('reportes_eliminados') || '[]'));
  _todosLosReportes = _todosLosReportes.filter(r => !eliminados.has(String(r['ID'])));
}
```

---

## 13. REGISTRO DE VIAJE (2 pasos)

```javascript
// MAÑANA: guarda km inicial en localStorage
function guardarKmInicial() {
  localStorage.setItem('viaje_en_curso', JSON.stringify({
    inspector, fecha, kmInicial, fotoKmInicial: viajeKmInicialFoto
  }));
  verificarViajeEnCurso(); // Muestra panel "Km Inicial Registrado"
}

// TARDE: completa con km final
async function completarViaje() {
  const viaje = JSON.parse(localStorage.getItem('viaje_en_curso'));
  const kmRecorridos = parseFloat(kmFinal) - parseFloat(viaje.kmInicial);
  
  enviarEnSegundoPlano('Registro de Viaje', {
    'Km_Inicial': viaje.kmInicial,
    'Km_Final': kmFinal,
    'Km_Recorridos': kmRecorridos,
    'Foto_Km_Inicial': viaje.fotoKmInicial, // Foto de la mañana
    'Foto_Km_Final': viajeKmFinalTardeFoto, // Foto de la tarde
  });
  
  localStorage.removeItem('viaje_en_curso'); // Limpia
}
```

---

## 14. VARIABLES CSS

```css
:root {
  --primary: #0ea5e9;     /* Azul eléctrico - botones, links */
  --success: #22c55e;     /* Verde - presente, éxito */
  --danger: #ef4444;      /* Rojo - ausente, error, eliminar */
  --gray-100: #0d1424;    /* Fondo de tarjetas */
  --gray-800: #d8e8f5;    /* Texto principal */
}
/* Cambiar --primary cambia el color en toda la app */
```

---

## 15. FLUJO COMPLETO DE UN REPORTE

```
Inspector abre módulo
    → Llena formulario + fotos + coordenadas
    → Da "Enviar"
    → guardarReporte() → localStorage (sin fotos)
    → enviarEnSegundoPlano() → comprime fotos → fetch GAS
    → generarPDF() → descarga en celular
    
GAS recibe:
    → Fotos → Google Drive
    → HTML → PDF en Drive
    → Datos → Google Sheets
    → Correo → galdamezalberto2000@gmail.com

Sin internet:
    → Falla el fetch → guardarEnCola()
    → Regresa internet → window.on('online') → procesarCola()
```

---

## 16. CREDENCIALES

| Dato | Valor |
|---|---|
| Correo destino | galdamezalberto2000@gmail.com |
| Inspector prueba | admin / 1234 |
| Supervisor | supervisor / super1234 |
| App URL | https://toreshn.github.io/inspector-app |
| Google Sheets | "Inspector App - Reportes" en Drive |

---

## 17. LIMITACIONES

| Limitación | Detalle |
|---|---|
| localStorage ~5MB | Por eso las fotos no se guardan localmente |
| GAS 100 correos/día | Con 53 reportes/día hay margen |
| GAS 6 min/ejecución | Cada reporte tarda 5-15 seg |
| Contraseñas texto plano | App interna, aceptable |
| Fotos historial charla | Solo en el dispositivo donde se guardó |
