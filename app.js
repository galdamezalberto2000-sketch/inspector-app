

// Obtener elementos del DOM
const CORREO_DESTINO = 'galdamezalberto2000@gmail.com';

// Columnas supervisor — declaradas al inicio para evitar problemas de inicialización
var CAMPOS_LABEL = {
    'Inspector':'Inspector', 'Usuario':'Usuario', 'Fecha':'Fecha',
    'Clave':'Clave', 'N° Medidor':'N° Medidor', 'Observaciones':'Observaciones',
    'Latitud':'Latitud', 'Longitud':'Longitud', 'Google Maps':'Google Maps',
    'Km Inicial':'Km inicial', 'Km Final':'Km final', 'Km Recorridos':'Km recorridos',
    'Tipo Gasto':'Tipo de gasto', 'Descripción':'Descripción', 'Valor':'Valor',
    'Identidad':'Identidad', 'Lectura Correcta':'Lectura correcta',
    'Lectura Incorrecta':'Lectura incorrecta', 'Contiguo':'Contiguo',
    'Cantidad Fotos':'Cantidad de fotos',
};
var CAMPOS_FULL = ['Observaciones', 'Google Maps'];
var _todosLosReportes = [];

// URL del Google Apps Script — fija en el código
const GAS_URL_FIJA = 'https://script.google.com/macros/s/AKfycbxrNXkFEwmGaLtMYsb_dhrDNH3yZ1ZvDORwcFCz6FlAS7c2ETFRH0ay2YeddDxW7pqj1Q/exec';

function getScriptURL() {
  // Llamada directa al Google Apps Script (sin proxy)
  return GAS_URL_FIJA;
}

async function enviarPorCorreo(tipo, campos) {
  const url = GAS_URL_FIJA;

  const camposTexto = {};
  const camposFotos = {};

  for (const [k, v] of Object.entries(campos)) {
    // Detectar fotos por contenido base64
    if (v && typeof v === 'string' && v.startsWith('data:image')) {
      camposFotos[k] = v;
    } else {
      camposTexto[k] = v;
    }
  }

  for (const k of Object.keys(camposFotos)) {
    camposFotos[k] = await comprimirImagen(camposFotos[k], 200, 0.3);
  }

  try {
    const payload = { tipo, ...camposTexto, ...camposFotos };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data.success === true;
    } catch {
      return res.ok;
    }
  } catch (e) {
    console.error('Error envío:', e);
    return false;
  }
}

// Envía en segundo plano sin bloquear la UI
// Si falla, guarda en cola y reintenta cuando haya conexión
function enviarEnSegundoPlano(tipo, campos) {
  enviarPorCorreo(tipo, campos).then(ok => {
    if (!ok) guardarEnCola(tipo, campos);
  });
}

// Cola de pendientes en localStorage
function guardarEnCola(tipo, campos) {
  const cola = JSON.parse(localStorage.getItem('cola_pendientes') || '[]');
  cola.push({ tipo, campos, ts: Date.now() });
  localStorage.setItem('cola_pendientes', JSON.stringify(cola));
  console.log('Guardado en cola. Pendientes:', cola.length);
}

async function procesarCola() {
  const cola = JSON.parse(localStorage.getItem('cola_pendientes') || '[]');
  if (cola.length === 0) return;
  console.log('Procesando cola:', cola.length, 'pendientes');
  const restantes = [];
  for (const item of cola) {
    const ok = await enviarPorCorreo(item.tipo, item.campos);
    if (!ok) restantes.push(item);
  }
  localStorage.setItem('cola_pendientes', JSON.stringify(restantes));
  if (restantes.length < cola.length) {
    console.log('Enviados:', cola.length - restantes.length, '| Pendientes:', restantes.length);
  }
}

// Procesar cola automáticamente cuando regresa la conexión
window.addEventListener('online', () => {
  console.log('Conexión restaurada — procesando cola...');
  procesarCola();
});

// Comprime una imagen base64 al ancho y calidad indicados
function comprimirImagen(base64, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64); // si falla, usar original
    img.src = base64;
  });
}

// ==================== ALMACENAMIENTO DE REPORTES ====================

const REPORTES_KEY = 'reportes_app';

function guardarReporte(modulo, datos) {
    const reportes = JSON.parse(localStorage.getItem(REPORTES_KEY)) || [];
    reportes.unshift({
        id: Date.now(),
        modulo,
        fechaRegistro: new Date().toLocaleString('es-ES'),
        usuario: localStorage.getItem('currentUser') || '',
        ...datos
    });
    // Limitar a 500 reportes para no saturar localStorage
    if (reportes.length > 500) reportes.splice(500);
    localStorage.setItem(REPORTES_KEY, JSON.stringify(reportes));
}

function getReportes() {
    return JSON.parse(localStorage.getItem(REPORTES_KEY)) || [];
}


const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const mainScreen = document.getElementById('mainScreen');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');

const currentUserSpan = document.getElementById('currentUser');

// Obtener usuarios del localStorage
let users = JSON.parse(localStorage.getItem('users')) || [];

// Crear usuarios por defecto si no existen
if (users.length === 0) {
    users.push({ username: 'admin', password: '1234', rol: 'inspector' });
    users.push({ username: 'supervisor', password: 'super1234', rol: 'supervisor' });
    localStorage.setItem('users', JSON.stringify(users));
}
// Migrar usuarios viejos sin rol
users = users.map(u => ({ ...u, rol: u.rol || 'inspector' }));
// Asegurar que supervisor exista
if (!users.find(u => u.username === 'supervisor')) {
    users.push({ username: 'supervisor', password: 'super1234', rol: 'supervisor' });
    localStorage.setItem('users', JSON.stringify(users));
}

let currentUser = localStorage.getItem('currentUser');

// Verificar si hay sesión activa
if (currentUser) {
    const rol = localStorage.getItem('currentRol') || 'inspector';
    if (rol === 'supervisor') {
        showSupervisorScreen();
    } else {
        showMainScreen();
    }
}

// Cambiar entre pantallas de login y registro
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginScreen.classList.remove('active');
    registerScreen.classList.add('active');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerScreen.classList.remove('active');
    loginScreen.classList.add('active');
});

// Registro de usuario
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    // Validaciones
    if (password !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    if (users.find(user => user.username === username)) {
        alert('El usuario ya existe');
        return;
    }
    
    // Crear nuevo usuario
    users.push({ username, password });
    localStorage.setItem('users', JSON.stringify(users));
    
    alert('¡Cuenta creada exitosamente!');
    registerForm.reset();
    registerScreen.classList.remove('active');
    loginScreen.classList.add('active');
});

// Inicio de sesión
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        localStorage.setItem('currentUser', username);
        localStorage.setItem('currentRol', user.rol || 'inspector');
        currentUser = username;
        if (user.rol === 'supervisor') {
            showSupervisorScreen();
        } else {
            showMainScreen();
        }
        loginForm.reset();
    } else {
        alert('Usuario o contraseña incorrectos');
    }
});

// Cerrar sesión
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    currentUser = null;
    mainScreen.classList.remove('active');
    loginScreen.classList.add('active');
});

// Mostrar pantalla principal
function showMainScreen() {
    currentUserSpan.textContent = currentUser;
    loginScreen.classList.remove('active');
    registerScreen.classList.remove('active');
    mainScreen.classList.add('active');
    // Actualizar avatar con inicial del usuario
    const avatar = document.getElementById('headerAvatar');
    if (avatar) avatar.textContent = currentUser.charAt(0).toUpperCase();
}

// Manejar opciones del menú
function openOption(option) {
    if (option === 'inspector') {
        mainScreen.classList.remove('active');
        inspectorScreen.classList.add('active');
        setFechaGeneracion();
        renderInformes();
    } else if (option === 'medidores') {
        mainScreen.classList.remove('active');
        document.getElementById('medidoresScreen').classList.add('active');
        renderMedidores();
    } else if (option === 'errores') {
        mainScreen.classList.remove('active');
        document.getElementById('erroresScreen').classList.add('active');
        document.getElementById('errorFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        renderErrores();
    } else if (option === 'consumo') {
        mainScreen.classList.remove('active');
        document.getElementById('consumoScreen').classList.add('active');
        document.getElementById('consumoFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        renderConsumo();
    } else if (option === 'reubicacion') {
        mainScreen.classList.remove('active');
        document.getElementById('reubicacionScreen').classList.add('active');
        document.getElementById('reubicacionFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        renderReubicacion();
    } else if (option === 'postes') {
        mainScreen.classList.remove('active');
        document.getElementById('postesScreen').classList.add('active');
        document.getElementById('postesFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        postesFotos = [];
        actualizarGaleriaPostes();
        renderPostes();
    } else if (option === 'facturas') {
        mainScreen.classList.remove('active');
        document.getElementById('facturasScreen').classList.add('active');
        facturasFotos = [];
        actualizarGaleriaFacturas();
        // fecha de hoy por defecto
        document.getElementById('facturasFecha').value = new Date().toISOString().split('T')[0];
    } else if (option === 'moto') {
        mainScreen.classList.remove('active');
        document.getElementById('motoScreen').classList.add('active');
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('viajeFecha').value = hoy;
        document.getElementById('inspeccionFecha').value = hoy;
        document.getElementById('gastosFecha').value = hoy;
        mostrarTabMoto('viaje');
        verificarViajeEnCurso();
    } else {
        const options = {
            'consumo': 'Reporte de bajo consumo',
            'reubicacion': 'Reubicación',
            'postes': 'Postes derribados'
        };
        alert(`Has seleccionado: ${options[option]}\n\nEsta funcionalidad se implementará próximamente.`);
    }
}

function volverMenu(screenId) {
    document.getElementById(screenId).classList.remove('active');
    mainScreen.classList.add('active');
}

// Variables para informe inspector
const inspectorScreen = document.getElementById('inspectorScreen');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const inspectorForm = document.getElementById('inspectorForm');
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');

let informes = JSON.parse(localStorage.getItem('informes')) || [];
let currentPhotoType = null;
let cameraStream = null;
let facturaPhoto = null;
let motoPhoto = null;

// Usaremos FormSubmit.co que es gratis y permite adjuntos

// Volver al menú
backToMenuBtn.addEventListener('click', () => {
    inspectorScreen.classList.remove('active');
    mainScreen.classList.add('active');
});

// Establecer fecha de generación automática
function setFechaGeneracion() {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const hora = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('fechaGeneracion').value = `${fecha} ${hora}`;
}

// Abrir cámara
let camaraActual = 'environment'; // 'environment' = trasera, 'user' = frontal

function openCamera(type) {
    currentPhotoType = type;
    camaraActual = 'environment'; // siempre inicia con cámara trasera
    cameraModal.style.display = 'block';
    iniciarCamara();
}

function iniciarCamara() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    // Intentar con facingMode exact, si falla usar sin restricción
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: camaraActual } } })
        .then(stream => {
            cameraStream = stream;
            cameraVideo.srcObject = stream;
        })
        .catch(() => {
            // Fallback: sin exact (algunos móviles no soportan exact)
            navigator.mediaDevices.getUserMedia({ video: { facingMode: camaraActual } })
                .then(stream => {
                    cameraStream = stream;
                    cameraVideo.srcObject = stream;
                })
                .catch(error => {
                    alert('No se pudo acceder a la cámara: ' + error.message);
                    closeCamera();
                });
        });
}

function voltearCamara() {
    camaraActual = camaraActual === 'environment' ? 'user' : 'environment';
    iniciarCamara();
}

// Cerrar cámara
function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraModal.style.display = 'none';
    cameraVideo.srcObject = null;
}

// Capturar foto
function capturePhoto() {
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    const context = cameraCanvas.getContext('2d');
    context.drawImage(cameraVideo, 0, 0);
    
    const photoData = cameraCanvas.toDataURL('image/jpeg');
    
    if (currentPhotoType === 'factura') {
        facturaPhoto = photoData;
        document.getElementById('facturaPreview').innerHTML = `<img src="${photoData}" alt="Factura">`;
    } else if (currentPhotoType === 'moto') {
        motoPhoto = photoData;
        document.getElementById('motoPreview').innerHTML = `<img src="${photoData}" alt="Moto">`;
    } else if (currentPhotoType === 'medidor') {
        medidorFoto = photoData;
        document.getElementById('medidorFotoPreview').innerHTML = `<img src="${photoData}" alt="Medidor">`;
    } else if (currentPhotoType === 'errorMedidor') {
        errorFoto = photoData;
        document.getElementById('errorFotoPreview').innerHTML = `<img src="${photoData}" alt="Medidor">`;
    } else if (currentPhotoType === 'postes') {
        postesFotos.push(photoData);
        actualizarGaleriaPostes();
    } else if (currentPhotoType === 'facturas') {
        facturasFotos.push(photoData);
        actualizarGaleriaFacturas();
    } else if (currentPhotoType === 'consumoFachada') {
        consumoFachadaFoto = photoData;
        document.getElementById('consumoFachadaPreview').innerHTML = `<img src="${photoData}" alt="Fachada">`;
    } else if (currentPhotoType === 'consumoMedidor') {
        consumoMedidorFoto = photoData;
        document.getElementById('consumoMedidorPreview').innerHTML = `<img src="${photoData}" alt="Medidor">`;
    } else if (currentPhotoType === 'reubicacionFachada') {
        reubicacionFachadaFoto = photoData;
        document.getElementById('reubicacionFachadaPreview').innerHTML = `<img src="${photoData}" alt="Fachada">`;
    } else if (currentPhotoType === 'reubicacionMedidor') {
        reubicacionMedidorFoto = photoData;
        document.getElementById('reubicacionMedidorPreview').innerHTML = `<img src="${photoData}" alt="Medidor">`;
    } else if (currentPhotoType === 'viajeTablero') {
        viajeTableroFoto = photoData;
        document.getElementById('viajeTableroPreview').innerHTML = `<img src="${photoData}" alt="Tablero">`;
    } else if (currentPhotoType === 'viajeKmInicial') {
        viajeKmInicialFoto = photoData;
        document.getElementById('viajeKmInicialPreview').innerHTML = `<img src="${photoData}" alt="Km Inicial">`;
    } else if (currentPhotoType === 'viajeKmFinal') {
        viajeKmFinalFoto = photoData;
        document.getElementById('viajeKmFinalPreview').innerHTML = `<img src="${photoData}" alt="Km Final">`;
    } else if (currentPhotoType === 'viajeKmFinalTarde') {
        viajeKmFinalTardeFoto = photoData;
        document.getElementById('viajeKmFinalTardePreview').innerHTML = `<img src="${photoData}" alt="Km Final">`;
    } else if (currentPhotoType === 'viajeTableroTarde') {
        viajeTableroTardeFoto = photoData;
        document.getElementById('viajeTableroTardePreview').innerHTML = `<img src="${photoData}" alt="Tablero">`;
    } else if (currentPhotoType === 'inspeccionMoto') {
        inspeccionMotoFoto = photoData;
        document.getElementById('inspeccionMotoPreview').innerHTML = `<img src="${photoData}" alt="Moto">`;
    } else if (currentPhotoType === 'inspeccionRetro') {
        inspeccionRetroFoto = photoData;
        document.getElementById('inspeccionRetroPreview').innerHTML = `<img src="${photoData}" alt="Retrovisores">`;
    } else if (currentPhotoType === 'inspeccionLlantas') {
        inspeccionLlantasFoto = photoData;
        document.getElementById('inspeccionLlantasPreview').innerHTML = `<img src="${photoData}" alt="Llantas">`;
    } else if (currentPhotoType === 'inspeccionLucesDB') {
        inspeccionLucesDBFoto = photoData;
        document.getElementById('inspeccionLucesDBPreview').innerHTML = `<img src="${photoData}" alt="Luces DB">`;
    } else if (currentPhotoType === 'inspeccionLucesDA') {
        inspeccionLucesDAFoto = photoData;
        document.getElementById('inspeccionLucesDAPreview').innerHTML = `<img src="${photoData}" alt="Luces DA">`;
    } else if (currentPhotoType === 'inspeccionLucesTF') {
        inspeccionLucesTFFoto = photoData;
        document.getElementById('inspeccionLucesTFPreview').innerHTML = `<img src="${photoData}" alt="Luces TF">`;
    } else if (currentPhotoType === 'inspeccionLucesTP') {
        inspeccionLucesTPFoto = photoData;
        document.getElementById('inspeccionLucesTPPreview').innerHTML = `<img src="${photoData}" alt="Luces TP">`;
    } else if (currentPhotoType === 'gastosFactura') {
        gastosFacturaFoto = photoData;
        document.getElementById('gastosFacturaPreview').innerHTML = `<img src="${photoData}" alt="Factura">`;
    } else if (currentPhotoType === 'cascoCasco') {
        cascoCascoFoto = photoData;
        document.getElementById('cascoCascoPreview').innerHTML = `<img src="${photoData}" alt="Casco">`;
    } else if (currentPhotoType === 'cascoVisera') {
        cascoViseraFoto = photoData;
        document.getElementById('cascoViseraPreview').innerHTML = `<img src="${photoData}" alt="Visera">`;
    } else if (currentPhotoType === 'cascoSeguro') {
        cascoSeguroFoto = photoData;
        document.getElementById('cascoSeguroPreview').innerHTML = `<img src="${photoData}" alt="Seguro">`;
    }
    
    closeCamera();
}

// Abrir galería
function openGallery(type) {
    currentPhotoType = type;
    if (type === 'factura') {
        document.getElementById('facturaGallery').click();
    } else if (type === 'moto') {
        document.getElementById('motoGallery').click();
    } else if (type === 'medidor') {
        document.getElementById('medidorGallery').click();
    } else if (type === 'errorMedidor') {
        document.getElementById('errorMedidorGallery').click();
    } else if (type === 'postes') {
        document.getElementById('postesGallery').click();
    } else if (type === 'facturas') {
        document.getElementById('facturasGallery').click();
    } else if (type === 'consumoFachada') {
        document.getElementById('consumoFachadaGallery').click();
    } else if (type === 'consumoMedidor') {
        document.getElementById('consumoMedidorGallery').click();
    } else if (type === 'reubicacionFachada') {
        document.getElementById('reubicacionFachadaGallery').click();
    } else if (type === 'reubicacionMedidor') {
        document.getElementById('reubicacionMedidorGallery').click();
    } else if (type === 'viajeTablero') {
        document.getElementById('viajeTableroGallery').click();
    } else if (type === 'viajeKmInicial') {
        document.getElementById('viajeKmInicialGallery').click();
    } else if (type === 'viajeKmFinal') {
        document.getElementById('viajeKmFinalGallery').click();
    } else if (type === 'viajeKmFinalTarde') {
        document.getElementById('viajeKmFinalTardeGallery').click();
    } else if (type === 'viajeTableroTarde') {
        document.getElementById('viajeTableroTardeGallery').click();
    } else if (type === 'inspeccionMoto') {
        document.getElementById('inspeccionMotoGallery').click();
    } else if (type === 'inspeccionRetro') {
        document.getElementById('inspeccionRetroGallery').click();
    } else if (type === 'inspeccionLlantas') {
        document.getElementById('inspeccionLlantasGallery').click();
    } else if (type === 'inspeccionLucesDB') {
        document.getElementById('inspeccionLucesDBGallery').click();
    } else if (type === 'inspeccionLucesDA') {
        document.getElementById('inspeccionLucesDAGallery').click();
    } else if (type === 'inspeccionLucesTF') {
        document.getElementById('inspeccionLucesTFGallery').click();
    } else if (type === 'inspeccionLucesTP') {
        document.getElementById('inspeccionLucesTPGallery').click();
    } else if (type === 'gastosFactura') {
        document.getElementById('gastosFacturaGallery').click();
    } else if (type === 'cascoCasco') {
        document.getElementById('cascoCascoGallery').click();
    } else if (type === 'cascoVisera') {
        document.getElementById('cascoViseraGallery').click();
    } else if (type === 'cascoSeguro') {
        document.getElementById('cascoSeguroGallery').click();
    }
}

// Manejar selección de galería - Factura
document.getElementById('facturaGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            facturaPhoto = event.target.result;
            document.getElementById('facturaPreview').innerHTML = `<img src="${facturaPhoto}" alt="Factura">`;
        };
        reader.readAsDataURL(file);
    }
});

// Manejar selección de galería - Moto
document.getElementById('motoGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            motoPhoto = event.target.result;
            document.getElementById('motoPreview').innerHTML = `<img src="${motoPhoto}" alt="Moto">`;
        };
        reader.readAsDataURL(file);
    }
});

// Guardar informe
inspectorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fechaGeneracion = document.getElementById('fechaGeneracion').value;
    const fechaFactura = document.getElementById('fechaFactura').value;

    if (!facturaPhoto || !motoPhoto) {
        alert('Por favor, agrega ambas fotos antes de enviar');
        return;
    }

    const btn = inspectorForm.querySelector('.btn-save');
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    guardarReporte('Inspector', {
        inspector: currentUser, fechaGeneracion, fechaFactura,
        fotoFactura: facturaPhoto, fotoMoto: motoPhoto
    });

    enviarEnSegundoPlano('Informe de Inspector - ' + currentUser, {
        'Usuario':          currentUser,
        'Fecha_Generacion': fechaGeneracion,
        'Fecha_Factura':    fechaFactura,
        'Modulo':           'Informe de Inspector',
        'Foto_Factura':     facturaPhoto,
        'Foto_Moto':        motoPhoto
    });

    inspectorForm.reset();
    facturaPhoto = null;
    motoPhoto = null;
    document.getElementById('facturaPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('motoPreview').innerHTML = '<p>No hay foto</p>';
    btn.textContent = 'Enviar Informe';
    btn.disabled = false;
    alert('Informe guardado. Correo enviándose en segundo plano.');
});

// Función para generar PDF y enviar por correo usando FormSubmit
async function generarYEnviarPDF(informe) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Configuración de colores
    const colorPrimario = [102, 126, 234];
    
    // Encabezado
    pdf.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORME DE INSPECTOR', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Informe #${informe.id}`, 105, 30, { align: 'center' });
    
    // Información del informe
    let yPos = 55;
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN GENERAL', 20, yPos);
    
    yPos += 10;
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    
    pdf.setFont(undefined, 'bold');
    pdf.text('Usuario:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.usuario, 60, yPos);
    
    yPos += 8;
    pdf.setFont(undefined, 'bold');
    pdf.text('Fecha de Generación:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.fechaGeneracion, 60, yPos);
    
    yPos += 8;
    pdf.setFont(undefined, 'bold');
    pdf.text('Fecha de Factura:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.fechaFactura, 60, yPos);
    
    yPos += 8;
    pdf.setFont(undefined, 'bold');
    pdf.text('Fecha de Creación:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.fechaCreacion, 60, yPos);
    
    // Línea separadora
    yPos += 10;
    pdf.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, yPos, 190, yPos);
    
    // Foto de Factura
    yPos += 10;
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.text('FOTO DE FACTURA', 20, yPos);
    
    yPos += 5;
    try {
        pdf.addImage(informe.facturaPhoto || informe.fotoFactura, 'JPEG', 20, yPos, 80, 80);
    } catch (error) {
        console.error('Error al agregar foto de factura:', error);
    }
    
    // Foto de Moto
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('FOTO DE MOTO EN TALLER', 110, yPos - 5);
    
    try {
        pdf.addImage(informe.motoPhoto || informe.fotoMoto, 'JPEG', 110, yPos, 80, 80);
    } catch (error) {
        console.error('Error al agregar foto de moto:', error);
    }
    
    // Pie de página
    yPos = 280;
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, yPos, { align: 'center' });
    pdf.text(`Fecha: ${new Date().toLocaleString('es')}`, 105, yPos + 5, { align: 'center' });
    
    // Descargar PDF localmente
    pdf.save(`Informe_${informe.id}_${informe.usuario}.pdf`);

    // Mostrar opciones para compartir el PDF descargado
    mostrarOpcionesCompartir(informe);
}

function mostrarOpcionesCompartir(informe) {
    const texto = `*Informe de Inspector #${informe.id}*\n\nUsuario: ${informe.usuario}\nFecha: ${informe.fechaGeneracion}\nFactura: ${informe.fechaFactura}\n\nEl PDF fue descargado en el dispositivo.`;
    const textoWA = encodeURIComponent(texto);
    const asunto = encodeURIComponent(`Informe Inspector #${informe.id}`);
    const cuerpoEmail = encodeURIComponent(`Informe de Inspector\n\nUsuario: ${informe.usuario}\nFecha: ${informe.fechaGeneracion}\nFactura: ${informe.fechaFactura}\n\nEl PDF adjunto fue descargado en el dispositivo.`);

    let modal = document.getElementById('compartirModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'compartirModal';
        modal.style.cssText = `
            position:fixed; inset:0; z-index:2000;
            background:rgba(15,23,42,0.75); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center; padding:20px;
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background:white; border-radius:16px; padding:28px; max-width:400px; width:100%; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
            <h2 style="font-size:18px; font-weight:700; margin-bottom:6px; color:#1e293b;">PDF descargado</h2>
            <p style="color:#64748b; font-size:13px; margin-bottom:20px;">El PDF está en tu carpeta de descargas. Ahora puedes compartirlo:</p>

            <a href="https://wa.me/?text=${textoWA}" target="_blank"
                style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#dcfce7; border:2px solid #16a34a;
                border-radius:10px; text-decoration:none; color:#15803d; font-weight:600; font-size:15px; margin-bottom:10px;">
                <span style="font-size:24px;"></span>
                <span>Compartir por WhatsApp</span>
            </a>

            <a href="mailto:galdamezalberto2000@gmail.com?subject=${asunto}&body=${cuerpoEmail}"
                style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#eff6ff; border:2px solid #2563eb;
                border-radius:10px; text-decoration:none; color:#1d4ed8; font-weight:600; font-size:15px; margin-bottom:10px;">
                <span style="font-size:24px;"></span>
                <span>Enviar por correo</span>
            </a>

            <p style="color:#94a3b8; font-size:12px; text-align:center; margin:12px 0;">
                Adjunta el PDF manualmente desde tu carpeta de descargas
            </p>

            <button onclick="document.getElementById('compartirModal').style.display='none'"
                style="width:100%; padding:13px; background:linear-gradient(135deg,#2563eb,#7c3aed);
                color:white; border:none; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer;">
                Cerrar
            </button>
        </div>
    `;
}

// Función para generar PDF sin enviar (para botón de descarga)
function generarPDF(informe) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Configuración de colores
    const colorPrimario = [102, 126, 234];
    const colorSecundario = [118, 75, 162];
    
    // Encabezado
    pdf.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORME DE INSPECTOR', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Informe #${informe.id}`, 105, 30, { align: 'center' });
    
    // Información del informe
    let yPos = 55;
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN GENERAL', 20, yPos);
    
    yPos += 10;
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    
    pdf.setFont(undefined, 'bold');
    pdf.text('Usuario:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.usuario, 60, yPos);
    
    yPos += 8;
    pdf.setFont(undefined, 'bold');
    pdf.text('Fecha de Generación:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.fechaGeneracion, 60, yPos);
    
    yPos += 8;
    pdf.setFont(undefined, 'bold');
    pdf.text('Fecha de Factura:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.fechaFactura, 60, yPos);
    
    yPos += 8;
    pdf.setFont(undefined, 'bold');
    pdf.text('Fecha de Creación:', 20, yPos);
    pdf.setFont(undefined, 'normal');
    pdf.text(informe.fechaCreacion, 60, yPos);
    
    // Línea separadora
    yPos += 10;
    pdf.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, yPos, 190, yPos);
    
    // Foto de Factura
    yPos += 10;
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.text('FOTO DE FACTURA', 20, yPos);
    
    yPos += 5;
    try {
        pdf.addImage(informe.facturaPhoto || informe.fotoFactura, 'JPEG', 20, yPos, 80, 80);
    } catch (error) {
        console.error('Error al agregar foto de factura:', error);
    }
    
    // Foto de Moto (al lado de la factura)
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('FOTO DE MOTO EN TALLER', 110, yPos - 5);
    
    try {
        pdf.addImage(informe.motoPhoto || informe.fotoMoto, 'JPEG', 110, yPos, 80, 80);
    } catch (error) {
        console.error('Error al agregar foto de moto:', error);
    }
    
    // Pie de página
    yPos = 280;
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, yPos, { align: 'center' });
    pdf.text(`Fecha: ${new Date().toLocaleString('es')}`, 105, yPos + 5, { align: 'center' });
    
    // Guardar PDF
    pdf.save(`Informe_${informe.id}_${informe.usuario}.pdf`);
}

// Renderizar informes
function renderInformes() {
    const informesList = document.getElementById('informesList');
    
    if (informes.length === 0) {
        informesList.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No hay informes guardados</p></div>';
        return;
    }
    
    informesList.innerHTML = '';
    
    informes.forEach(informe => {
        const card = document.createElement('div');
        card.className = 'informe-card';
        card.innerHTML = `
            <h3>Informe #${informe.id}</h3>
            <p><strong>Usuario:</strong> ${informe.usuario}</p>
            <p><strong>Correo:</strong> ${informe.emailDestino}</p>
            <p><strong>Fecha Generación:</strong> ${informe.fechaGeneracion}</p>
            <p><strong>Fecha Factura:</strong> ${informe.fechaFactura}</p>
            <p><strong>Creado:</strong> ${informe.fechaCreacion}</p>
            <div class="informe-photos">
                <div>
                    <p><strong>Foto Factura:</strong></p>
                    <img src="${informe.facturaPhoto}" alt="Factura">
                </div>
                <div>
                    <p><strong>Foto Moto:</strong></p>
                    <img src="${informe.motoPhoto}" alt="Moto">
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-download" onclick="generarPDF(informes.find(i => i.id === ${informe.id}))">Descargar PDF</button>
                <button class="btn-delete" onclick="deleteInforme(${informe.id})">Eliminar</button>
            </div>
        `;
        informesList.appendChild(card);
    });
}

// Eliminar informe
function deleteInforme(id) {
    if (confirm('¿Estás seguro de eliminar este informe?')) {
        informes = informes.filter(i => i.id !== id);
        localStorage.setItem('informes', JSON.stringify(informes));
        renderInformes();
    }
}

// ==================== MEDIDORES FUERA DE LÍNEA ====================

let medidores = JSON.parse(localStorage.getItem('medidores')) || [];
let medidorFoto = null;

// Galería medidor
document.getElementById('medidorGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            medidorFoto = event.target.result;
            document.getElementById('medidorFotoPreview').innerHTML = `<img src="${medidorFoto}" alt="Medidor">`;
        };
        reader.readAsDataURL(file);
    }
});

// Aplicar coordenadas ingresadas manualmente
function aplicarCoordsManuales(modulo) {
    const prefijos = {
        'medidor':    { input: 'medidorCoordManual',    hidLat: 'medidorLat',    hidLng: 'medidorLng',    box: 'coordsBox' },
        'error':      { input: 'errorCoordManual',      hidLat: 'errorLat',      hidLng: 'errorLng',      box: 'errorCoordsBox' },
        'consumo':    { input: 'consumoCoordManual',     hidLat: 'consumoLat',    hidLng: 'consumoLng',    box: 'consumoCoordsBox' },
        'reubicacion':{ input: 'reubicacionCoordManual', hidLat: 'reubicacionLat',hidLng: 'reubicacionLng',box: 'reubicacionCoordsBox' },
        'postes':     { input: 'postesCoordManual',      hidLat: 'postesLat',     hidLng: 'postesLng',     box: 'postesCoordsBox' },
    };
    const cfg = prefijos[modulo];
    if (!cfg) return;

    const raw = document.getElementById(cfg.input).value.trim();
    // Acepta formatos: "14.0839, -89.2182" o "14.0839 -89.2182"
    const parts = raw.split(/[\s,]+/).filter(p => p);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
        alert('Formato inválido. Usa: 14.0839, -89.2182');
        return;
    }
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    document.getElementById(cfg.hidLat).value = lat;
    document.getElementById(cfg.hidLng).value = lng;
    document.getElementById(cfg.box).innerHTML = `
        <p><strong>Coordenadas manuales</strong></p>
        <p>Lat: ${lat} | Lng: ${lng}</p>
        <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">Ver en Google Maps</a>`;
    document.getElementById(cfg.box).classList.add('active');
}

// Obtener coordenadas GPS
function obtenerCoordenadas() {
    const btn = document.querySelector('.btn-coords');
    const coordsBox = document.getElementById('coordsBox');
    const coordsText = document.getElementById('coordsText');

    if (!navigator.geolocation) {
        alert('Tu dispositivo no soporta geolocalización');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Obteniendo ubicación...';
    coordsText.textContent = 'Buscando señal GPS...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const accuracy = Math.round(position.coords.accuracy);

            document.getElementById('medidorLat').value = lat;
            document.getElementById('medidorLng').value = lng;

            coordsBox.classList.add('active');
            coordsBox.innerHTML = `
                <div>
                    <p>Lat: <strong>${lat}</strong> | Lng: <strong>${lng}</strong></p>
                    <p style="font-size:12px; color:#888;">Precisión: ±${accuracy} metros</p>
                    <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">
                        Ver en Google Maps
                    </a>
                </div>
            `;

            btn.disabled = false;
            btn.textContent = 'Ubicación obtenida - Actualizar';
        },
        (error) => {
            let msg = 'Error al obtener ubicación';
            if (error.code === 1) msg = 'Permiso de ubicación denegado. Actívalo en tu navegador.';
            if (error.code === 2) msg = 'Ubicación no disponible. Verifica tu GPS.';
            if (error.code === 3) msg = 'Tiempo de espera agotado. Intenta de nuevo.';

            coordsText.textContent = msg;
            btn.disabled = false;
            btn.textContent = 'Obtener Ubicación';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// Guardar reporte de medidor
document.getElementById('medidorForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const numMedidor = document.getElementById('numMedidor').value.trim();
    const lat = document.getElementById('medidorLat').value;
    const lng = document.getElementById('medidorLng').value;
    const observaciones = document.getElementById('medidorObservaciones').value.trim();

    if (!medidorFoto) { alert('Por favor, agrega una foto del medidor'); return; }

    const reporte = { id: Date.now(), numMedidor, foto: medidorFoto, lat: lat||null, lng: lng||null, observaciones, usuario: currentUser, fecha: new Date().toLocaleString('es') };

    const btn = document.querySelector('#medidoresScreen .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('Medidor', {
        inspector: currentUser,
        numMedidor, lat: lat||null, lng: lng||null, observaciones,
        foto: medidorFoto
    });

    enviarEnSegundoPlano('Medidor fuera de línea - ' + currentUser, {
        'Usuario': currentUser, 'Fecha': reporte.fecha,
        'Numero_Medidor': numMedidor,
        'Latitud': lat || 'No registrada', 'Longitud': lng || 'No registrada',
        'Google_Maps': lat ? `https://www.google.com/maps?q=${lat},${lng}` : 'No registrado',
        'Observaciones': observaciones || 'Ninguna',
        'Foto_Medidor': medidorFoto
    });

    document.getElementById('medidorForm').reset();
    medidorFoto = null;
    document.getElementById('medidorFotoPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('coordsBox').classList.remove('active');
    document.getElementById('coordsBox').innerHTML = '<p id="coordsText">Sin coordenadas</p>';
    document.querySelector('#medidoresScreen .btn-coords').textContent = 'Obtener Ubicación';
    btn.textContent = 'Enviar Reporte'; btn.disabled = false;
    generarPDFMedidor(reporte);
    alert('Reporte enviado al correo correctamente.');
});

// Generar PDF medidor
function generarPDFMedidor(reporte) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const colorPrimario = [102, 126, 234];

    // Encabezado
    pdf.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont(undefined, 'bold');
    pdf.text('MEDIDOR FUERA DE LINEA', 105, 20, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text('Reporte #' + reporte.id, 105, 30, { align: 'center' });
    // Datos
    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN DEL REPORTE', 20, y); y += 10;

    pdf.setFontSize(11);
    const campos = [
        ['Usuario', reporte.usuario],
        ['Número de Medidor', reporte.numMedidor],
        ['Fecha', reporte.fecha],
        ['Latitud', reporte.lat || 'No registrada'],
        ['Longitud', reporte.lng || 'No registrada'],
    ];

    campos.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 70, y);
        y += 8;
    });

    if (reporte.observaciones) {
        y += 4;
        pdf.setFont(undefined, 'bold');
        pdf.text('Observaciones:', 20, y); y += 7;
        pdf.setFont(undefined, 'normal');
        const lines = pdf.splitTextToSize(reporte.observaciones, 170);
        pdf.text(lines, 20, y);
        y += lines.length * 7;
    }

    // Línea separadora
    y += 5;
    pdf.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    // Foto
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    pdf.text('FOTO DEL MEDIDOR', 20, y); y += 5;
    try {
        pdf.addImage(reporte.foto, 'JPEG', 20, y, 100, 100);
    } catch (err) { console.error(err); }

    // Enlace Google Maps
    if (reporte.lat && reporte.lng) {
        y += 110;
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 255);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Ver en Google Maps: https://www.google.com/maps?q=${reporte.lat},${reporte.lng}`, 20, y);
    }

    // Pie de página
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, 285, { align: 'center' });

    pdf.save(`Medidor_${reporte.numMedidor}_${reporte.id}.pdf`);
    alert('¡Reporte guardado y PDF generado!');
}

// Renderizar medidores
function renderMedidores() {
    const lista = document.getElementById('medidoresList');
    if (medidores.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No hay reportes guardados</p></div>';
        return;
    }
    lista.innerHTML = '';
    medidores.forEach(r => {
        const card = document.createElement('div');
        card.className = 'informe-card';
        card.innerHTML = `
            <h3>Medidor: ${r.numMedidor}</h3>
            <p><strong>Usuario:</strong> ${r.usuario}</p>
            <p><strong>Fecha:</strong> ${r.fecha}</p>
            <p><strong>Coordenadas:</strong> ${r.lat ? `${r.lat}, ${r.lng}` : 'No registradas'}</p>
            ${r.lat ? `<a class="map-link" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank">Ver en Google Maps</a>` : ''}
            ${r.observaciones ? `<p><strong>Observaciones:</strong> ${r.observaciones}</p>` : ''}
            <div class="informe-photos"><div><img src="${r.foto}" alt="Medidor"></div></div>
            <div class="card-actions">
                <button class="btn-download" onclick="generarPDFMedidor(medidores.find(m => m.id === ${r.id}))">Descargar PDF</button>
                <button class="btn-delete" onclick="deleteMedidor(${r.id})">Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

function deleteMedidor(id) {
    if (confirm('¿Eliminar este reporte?')) {
        medidores = medidores.filter(m => m.id !== id);
        localStorage.setItem('medidores', JSON.stringify(medidores));
        renderMedidores();
    }
}

// ==================== REPORTE DE ERRORES EN CAMPO ====================

let errores = JSON.parse(localStorage.getItem('errores')) || [];
let errorFoto = null;

// Galería error medidor
document.getElementById('errorMedidorGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            errorFoto = event.target.result;
            document.getElementById('errorFotoPreview').innerHTML = `<img src="${errorFoto}" alt="Medidor">`;
        };
        reader.readAsDataURL(file);
    }
});

// Obtener coordenadas para errores
function obtenerCoordenadasError() {
    const btn = document.querySelector('#erroresScreen .btn-coords');
    const coordsBox = document.getElementById('errorCoordsBox');

    if (!navigator.geolocation) {
        alert('Tu dispositivo no soporta geolocalización');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Obteniendo ubicación...';
    coordsBox.innerHTML = '<p>Buscando señal GPS...</p>';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const accuracy = Math.round(position.coords.accuracy);

            document.getElementById('errorLat').value = lat;
            document.getElementById('errorLng').value = lng;

            coordsBox.classList.add('active');
            coordsBox.innerHTML = `
                <div>
                    <p>Lat: <strong>${lat}</strong> | Lng: <strong>${lng}</strong></p>
                    <p style="font-size:12px; color:#888;">Precisión: ±${accuracy} metros</p>
                    <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">Ver en Google Maps</a>
                </div>
            `;
            btn.disabled = false;
            btn.textContent = 'Ubicación obtenida - Actualizar';
        },
        (error) => {
            let msg = 'Error al obtener ubicación';
            if (error.code === 1) msg = 'Permiso denegado. Actívalo en tu navegador.';
            if (error.code === 2) msg = 'Ubicación no disponible.';
            if (error.code === 3) msg = 'Tiempo agotado. Intenta de nuevo.';
            coordsBox.innerHTML = `<p>${msg}</p>`;
            btn.disabled = false;
            btn.textContent = 'Obtener Ubicación';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// Guardar reporte de error
document.getElementById('erroresForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!errorFoto) { alert('Por favor, agrega una foto del medidor'); return; }

    const r = {
        id: Date.now(),
        fecha: document.getElementById('errorFecha').value,
        inspector: document.getElementById('errorInspector').value.trim(),
        clave: document.getElementById('errorClave').value.trim(),
        numMedidor: document.getElementById('errorNumMedidor').value.trim(),
        lecturaCorrecta: document.getElementById('errorLecturaCorrecta').value,
        lecturaIncorrecta: document.getElementById('errorLecturaIncorrecta').value,
        foto: errorFoto,
        lat: document.getElementById('errorLat').value || null,
        lng: document.getElementById('errorLng').value || null,
        usuario: currentUser
    };

    const btn = document.querySelector('#erroresScreen .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('Error', {
        inspector: r.inspector, fecha: r.fecha, clave: r.clave,
        numMedidor: r.numMedidor, lecturaCorrecta: r.lecturaCorrecta,
        lecturaIncorrecta: r.lecturaIncorrecta, lat: r.lat, lng: r.lng,
        foto: r.foto
    });

    enviarEnSegundoPlano('Advertencia: Error en campo - ' + r.inspector, {
        'Usuario': currentUser, 'Fecha': r.fecha, 'Inspector': r.inspector,
        'Clave': r.clave, 'Numero_Medidor': r.numMedidor,
        'Lectura_Correcta': r.lecturaCorrecta, 'Lectura_Incorrecta': r.lecturaIncorrecta,
        'Latitud': r.lat || 'No registrada', 'Longitud': r.lng || 'No registrada',
        'Google_Maps': r.lat ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : 'No registrado',
        'Foto_Error': errorFoto
    });

    generarPDFError(r);

    document.getElementById('erroresForm').reset();
    errorFoto = null;
    document.getElementById('errorFotoPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('errorCoordsBox').classList.remove('active');
    document.getElementById('errorCoordsBox').innerHTML = '<p id="errorCoordsText">Sin coordenadas</p>';
    document.querySelector('#erroresScreen .btn-coords').textContent = 'Obtener Ubicación';
    document.getElementById('errorFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    btn.textContent = 'Enviar Reporte'; btn.disabled = false;
    alert('Reporte enviado al correo correctamente.');
});

// Generar PDF error
function generarPDFError(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [102, 126, 234];

    // Encabezado
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('REPORTE DE ERROR EN CAMPO', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Reporte #${r.id}`, 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN DEL REPORTE', 20, y); y += 10;

    const campos = [
        ['Fecha', r.fecha],
        ['Inspector', r.inspector],
        ['Clave', r.clave],
        ['Número de Medidor', r.numMedidor],
        ['Lectura Correcta', r.lecturaCorrecta],
        ['Lectura Incorrecta', r.lecturaIncorrecta],
        ['Latitud', r.lat || 'No registrada'],
        ['Longitud', r.lng || 'No registrada'],
        ['Usuario', r.usuario],
    ];

    pdf.setFontSize(11);
    campos.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 75, y);
        y += 8;
    });

    // Línea
    y += 3;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    // Foto
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.text('FOTO DEL MEDIDOR', 20, y); y += 5;
    try {
        pdf.addImage(r.foto, 'JPEG', 20, y, 100, 100);
    } catch (err) { console.error(err); }

    // Mapa
    if (r.lat && r.lng) {
        y += 110;
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 255);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Ver en Google Maps: https://www.google.com/maps?q=${r.lat},${r.lng}`, 20, y);
    }

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, 285, { align: 'center' });

    pdf.save(`Error_${r.clave}_${r.id}.pdf`);
    alert('¡Reporte guardado y PDF generado!');
}

// Renderizar errores
function renderErrores() {
    const lista = document.getElementById('erroresList');
    if (errores.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No hay reportes guardados</p></div>';
        return;
    }
    lista.innerHTML = '';
    errores.forEach(r => {
        const card = document.createElement('div');
        card.className = 'informe-card';
        card.innerHTML = `
            <h3>Clave: ${r.clave}</h3>
            <p><strong>Inspector:</strong> ${r.inspector}</p>
            <p><strong>Fecha:</strong> ${r.fecha}</p>
            <p><strong>Medidor:</strong> ${r.numMedidor}</p>
            <p><strong>Lectura Correcta:</strong> ${r.lecturaCorrecta}</p>
            <p><strong>Lectura Incorrecta:</strong> ${r.lecturaIncorrecta}</p>
            ${r.lat ? `<a class="map-link" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank">Ver en Google Maps</a>` : '<p><strong>Coordenadas:</strong> No registradas</p>'}
            <div class="informe-photos"><div><img src="${r.foto}" alt="Medidor"></div></div>
            <div class="card-actions">
                <button class="btn-download" onclick="generarPDFError(errores.find(e => e.id === ${r.id}))">Descargar PDF</button>
                <button class="btn-delete" onclick="deleteError(${r.id})">Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

function deleteError(id) {
    if (confirm('¿Eliminar este reporte?')) {
        errores = errores.filter(e => e.id !== id);
        localStorage.setItem('errores', JSON.stringify(errores));
        renderErrores();
    }
}

// ==================== REPORTE DE BAJO CONSUMO ====================

let consumos = JSON.parse(localStorage.getItem('consumos')) || [];
let consumoFachadaFoto = null;
let consumoMedidorFoto = null;

// Galería fachada consumo
document.getElementById('consumoFachadaGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            consumoFachadaFoto = ev.target.result;
            document.getElementById('consumoFachadaPreview').innerHTML = `<img src="${consumoFachadaFoto}" alt="Fachada">`;
        };
        reader.readAsDataURL(file);
    }
});

// Galería medidor consumo
document.getElementById('consumoMedidorGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            consumoMedidorFoto = ev.target.result;
            document.getElementById('consumoMedidorPreview').innerHTML = `<img src="${consumoMedidorFoto}" alt="Medidor">`;
        };
        reader.readAsDataURL(file);
    }
});

// Obtener coordenadas consumo
function obtenerCoordenadasConsumo() {
    const btn = document.querySelector('#consumoScreen .btn-coords');
    const coordsBox = document.getElementById('consumoCoordsBox');

    if (!navigator.geolocation) {
        alert('Tu dispositivo no soporta geolocalización');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Obteniendo ubicación...';
    coordsBox.innerHTML = '<p>Buscando señal GPS...</p>';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const accuracy = Math.round(position.coords.accuracy);

            document.getElementById('consumoLat').value = lat;
            document.getElementById('consumoLng').value = lng;

            coordsBox.classList.add('active');
            coordsBox.innerHTML = `
                <div>
                    <p>Lat: <strong>${lat}</strong> | Lng: <strong>${lng}</strong></p>
                    <p style="font-size:12px; color:#888;">Precisión: ±${accuracy} metros</p>
                    <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">Ver en Google Maps</a>
                </div>
            `;
            btn.disabled = false;
            btn.textContent = 'Ubicación obtenida - Actualizar';
        },
        (error) => {
            let msg = 'Error al obtener ubicación';
            if (error.code === 1) msg = 'Permiso denegado. Actívalo en tu navegador.';
            if (error.code === 2) msg = 'Ubicación no disponible.';
            if (error.code === 3) msg = 'Tiempo agotado. Intenta de nuevo.';
            coordsBox.innerHTML = `<p>${msg}</p>`;
            btn.disabled = false;
            btn.textContent = 'Obtener Ubicación';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// Guardar reporte de consumo
document.getElementById('consumoForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const r = {
        id: Date.now(),
        fecha: document.getElementById('consumoFecha').value,
        clave: document.getElementById('consumoClave').value.trim(),
        numMedidor: document.getElementById('consumoNumMedidor').value.trim(),
        observaciones: document.getElementById('consumoObservaciones').value.trim(),
        fachadaFoto: consumoFachadaFoto,
        medidorFoto: consumoMedidorFoto,
        lat: document.getElementById('consumoLat').value || null,
        lng: document.getElementById('consumoLng').value || null,
        usuario: currentUser
    };

    const btn = document.querySelector('#consumoScreen .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('Consumo', {
        inspector: currentUser, fecha: r.fecha, clave: r.clave,
        numMedidor: r.numMedidor, observaciones: r.observaciones,
        lat: r.lat, lng: r.lng,
        fotoFachada: consumoFachadaFoto, fotoMedidor: consumoMedidorFoto
    });

    enviarEnSegundoPlano('Bajo consumo - Clave ' + r.clave, {
        'Usuario': currentUser, 'Fecha': r.fecha, 'Clave': r.clave,
        'Numero_Medidor': r.numMedidor, 'Observaciones': r.observaciones || 'Ninguna',
        'Latitud': r.lat || 'No registrada', 'Longitud': r.lng || 'No registrada',
        'Google_Maps': r.lat ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : 'No registrado',
        ...(consumoFachadaFoto ? { 'Foto_Fachada': consumoFachadaFoto } : {}),
        ...(consumoMedidorFoto ? { 'Foto_Medidor': consumoMedidorFoto } : {}),
    });

    document.getElementById('consumoForm').reset();
    consumoFachadaFoto = null; consumoMedidorFoto = null;
    document.getElementById('consumoFachadaPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('consumoMedidorPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('consumoCoordsBox').classList.remove('active');
    document.getElementById('consumoCoordsBox').innerHTML = '<p>Sin coordenadas</p>';
    document.querySelector('#consumoScreen .btn-coords').textContent = 'Obtener Ubicación';
    document.getElementById('consumoFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    btn.textContent = 'Enviar Reporte'; btn.disabled = false;
    generarPDFConsumo(r);
    alert('Reporte enviado al correo correctamente.');
});

// Generar PDF consumo
function generarPDFConsumo(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [102, 126, 234];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('REPORTE DE BAJO CONSUMO', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Reporte #${r.id}`, 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN DEL REPORTE', 20, y); y += 10;

    const campos = [
        ['Fecha', r.fecha],
        ['Usuario', r.usuario],
        ['Clave', r.clave],
        ['Número de Medidor', r.numMedidor],
        ['Latitud', r.lat || 'No registrada'],
        ['Longitud', r.lng || 'No registrada'],
    ];

    pdf.setFontSize(11);
    campos.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 75, y);
        y += 8;
    });

    if (r.observaciones) {
        y += 4;
        pdf.setFont(undefined, 'bold');
        pdf.text('Observaciones:', 20, y); y += 7;
        pdf.setFont(undefined, 'normal');
        const lines = pdf.splitTextToSize(r.observaciones, 170);
        pdf.text(lines, 20, y);
        y += lines.length * 7;
    }

    if (r.lat && r.lng) {
        y += 5;
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 255);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Ver en Google Maps: https://www.google.com/maps?q=${r.lat},${r.lng}`, 20, y);
        y += 10;
    }

    // Fotos
    if (r.fachadaFoto || r.medidorFoto) {
        y += 5;
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.line(20, y, 190, y); y += 10;

        pdf.setFontSize(13);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);

        if (r.fachadaFoto) {
            pdf.text('FOTO DE FACHADA', 20, y); y += 5;
            try { pdf.addImage(r.fachadaFoto, 'JPEG', 20, y, 80, 75); } catch(e) {}
        }
        if (r.medidorFoto) {
            pdf.text('FOTO DE MEDIDOR', 110, y - 5);
            try { pdf.addImage(r.medidorFoto, 'JPEG', 110, y, 80, 75); } catch(e) {}
        }
    }

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, 285, { align: 'center' });

    pdf.save(`BajoConsumo_${r.clave}_${r.id}.pdf`);
    alert('¡Reporte guardado y PDF generado!');
}

// Renderizar consumos
function renderConsumo() {
    const lista = document.getElementById('consumoList');
    if (consumos.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No hay reportes guardados</p></div>';
        return;
    }
    lista.innerHTML = '';
    consumos.forEach(r => {
        const card = document.createElement('div');
        card.className = 'informe-card';
        card.innerHTML = `
            <h3>Clave: ${r.clave}</h3>
            <p><strong>Fecha:</strong> ${r.fecha}</p>
            <p><strong>Medidor:</strong> ${r.numMedidor}</p>
            <p><strong>Usuario:</strong> ${r.usuario}</p>
            ${r.observaciones ? `<p><strong>Observaciones:</strong> ${r.observaciones}</p>` : ''}
            ${r.lat ? `<a class="map-link" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank">Ver en Google Maps</a>` : '<p><strong>Coordenadas:</strong> No registradas</p>'}
            ${(r.fachadaFoto || r.medidorFoto) ? `
            <div class="informe-photos">
                ${r.fachadaFoto ? `<div><p><strong>Fachada:</strong></p><img src="${r.fachadaFoto}" alt="Fachada"></div>` : ''}
                ${r.medidorFoto ? `<div><p><strong>Medidor:</strong></p><img src="${r.medidorFoto}" alt="Medidor"></div>` : ''}
            </div>` : ''}
            <div class="card-actions">
                <button class="btn-download" onclick="generarPDFConsumo(consumos.find(c => c.id === ${r.id}))">Descargar PDF</button>
                <button class="btn-delete" onclick="deleteConsumo(${r.id})">Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

function deleteConsumo(id) {
    if (confirm('¿Eliminar este reporte?')) {
        consumos = consumos.filter(c => c.id !== id);
        localStorage.setItem('consumos', JSON.stringify(consumos));
        renderConsumo();
    }
}

// ==================== REUBICACIÓN ====================

let reubicaciones = JSON.parse(localStorage.getItem('reubicaciones')) || [];
let reubicacionFachadaFoto = null;
let reubicacionMedidorFoto = null;

// Galería fachada reubicación
document.getElementById('reubicacionFachadaGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            reubicacionFachadaFoto = ev.target.result;
            document.getElementById('reubicacionFachadaPreview').innerHTML = `<img src="${reubicacionFachadaFoto}" alt="Fachada">`;
        };
        reader.readAsDataURL(file);
    }
});

// Galería medidor reubicación
document.getElementById('reubicacionMedidorGallery').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            reubicacionMedidorFoto = ev.target.result;
            document.getElementById('reubicacionMedidorPreview').innerHTML = `<img src="${reubicacionMedidorFoto}" alt="Medidor">`;
        };
        reader.readAsDataURL(file);
    }
});

function obtenerCoordenadasReubicacion() {
    const btn = document.querySelector('#reubicacionScreen .btn-coords');
    const coordsBox = document.getElementById('reubicacionCoordsBox');

    if (!navigator.geolocation) { alert('Tu dispositivo no soporta geolocalización'); return; }

    btn.disabled = true;
    btn.textContent = 'Obteniendo ubicación...';
    coordsBox.innerHTML = '<p>Buscando señal GPS...</p>';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const accuracy = Math.round(position.coords.accuracy);

            document.getElementById('reubicacionLat').value = lat;
            document.getElementById('reubicacionLng').value = lng;

            coordsBox.classList.add('active');
            coordsBox.innerHTML = `
                <div>
                    <p>Lat: <strong>${lat}</strong> | Lng: <strong>${lng}</strong></p>
                    <p style="font-size:12px; color:#888;">Precisión: ±${accuracy} metros</p>
                    <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">Ver en Google Maps</a>
                </div>`;
            btn.disabled = false;
            btn.textContent = 'Ubicación obtenida - Actualizar';
        },
        (error) => {
            let msg = 'Error al obtener ubicación';
            if (error.code === 1) msg = 'Permiso denegado. Actívalo en tu navegador.';
            if (error.code === 2) msg = 'Ubicación no disponible.';
            if (error.code === 3) msg = 'Tiempo agotado. Intenta de nuevo.';
            coordsBox.innerHTML = `<p>${msg}</p>`;
            btn.disabled = false;
            btn.textContent = 'Obtener Ubicación';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

document.getElementById('reubicacionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const r = {
        id: Date.now(),
        fecha: document.getElementById('reubicacionFecha').value,
        clave: document.getElementById('reubicacionClave').value.trim(),
        numMedidor: document.getElementById('reubicacionNumMedidor').value.trim(),
        observaciones: document.getElementById('reubicacionObservaciones').value.trim(),
        fachadaFoto: reubicacionFachadaFoto,
        medidorFoto: reubicacionMedidorFoto,
        lat: document.getElementById('reubicacionLat').value || null,
        lng: document.getElementById('reubicacionLng').value || null,
        usuario: currentUser
    };

    const btn = document.querySelector('#reubicacionScreen .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('Reubicacion', {
        inspector: currentUser, fecha: r.fecha, clave: r.clave,
        numMedidor: r.numMedidor, observaciones: r.observaciones,
        lat: r.lat, lng: r.lng,
        fotoFachada: reubicacionFachadaFoto, fotoMedidor: reubicacionMedidorFoto
    });

    enviarEnSegundoPlano('Reubicación - Clave ' + r.clave, {
        'Usuario': currentUser, 'Fecha': r.fecha, 'Clave': r.clave,
        'Numero_Medidor': r.numMedidor, 'Observaciones': r.observaciones || 'Ninguna',
        'Latitud': r.lat || 'No registrada', 'Longitud': r.lng || 'No registrada',
        'Google_Maps': r.lat ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : 'No registrado',
        ...(reubicacionFachadaFoto ? { 'Foto_Fachada': reubicacionFachadaFoto } : {}),
        ...(reubicacionMedidorFoto ? { 'Foto_Medidor': reubicacionMedidorFoto } : {}),
    });

    document.getElementById('reubicacionForm').reset();
    reubicacionFachadaFoto = null; reubicacionMedidorFoto = null;
    document.getElementById('reubicacionFachadaPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('reubicacionMedidorPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('reubicacionCoordsBox').classList.remove('active');
    document.getElementById('reubicacionCoordsBox').innerHTML = '<p>Sin coordenadas</p>';
    document.querySelector('#reubicacionScreen .btn-coords').textContent = 'Obtener Ubicación';
    document.getElementById('reubicacionFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    btn.textContent = 'Enviar Reporte'; btn.disabled = false;
    generarPDFReubicacion(r);
    alert('Reporte enviado al correo correctamente.');
});

function generarPDFReubicacion(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [102, 126, 234];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont(undefined, 'bold');
    pdf.text('REPORTE DE REUBICACIÓN', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Reporte #${r.id}`, 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN DEL REPORTE', 20, y); y += 10;

    const campos = [
        ['Fecha', r.fecha],
        ['Usuario', r.usuario],
        ['Clave', r.clave],
        ['Número de Medidor', r.numMedidor],
        ['Latitud', r.lat || 'No registrada'],
        ['Longitud', r.lng || 'No registrada'],
    ];

    pdf.setFontSize(11);
    campos.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 75, y);
        y += 8;
    });

    if (r.observaciones) {
        y += 4;
        pdf.setFont(undefined, 'bold');
        pdf.text('Observaciones:', 20, y); y += 7;
        pdf.setFont(undefined, 'normal');
        const lines = pdf.splitTextToSize(r.observaciones, 170);
        pdf.text(lines, 20, y);
        y += lines.length * 7;
    }

    if (r.lat && r.lng) {
        y += 5;
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 255);
        pdf.text(`Ver en Google Maps: https://www.google.com/maps?q=${r.lat},${r.lng}`, 20, y);
        y += 10;
    }

    // Fotos
    if (r.fachadaFoto || r.medidorFoto) {
        y += 5;
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.line(20, y, 190, y); y += 10;

        pdf.setFontSize(13);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);

        if (r.fachadaFoto) {
            pdf.text('FOTO DE FACHADA', 20, y); y += 5;
            try { pdf.addImage(r.fachadaFoto, 'JPEG', 20, y, 80, 75); } catch(e) {}
        }
        if (r.medidorFoto) {
            pdf.text('FOTO DE MEDIDOR', 110, y - 5);
            try { pdf.addImage(r.medidorFoto, 'JPEG', 110, y, 80, 75); } catch(e) {}
        }
    }

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, 285, { align: 'center' });

    pdf.save(`Reubicacion_${r.clave}_${r.id}.pdf`);
    alert('¡Reporte guardado y PDF generado!');
}

function renderReubicacion() {
    const lista = document.getElementById('reubicacionList');
    if (reubicaciones.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No hay reportes guardados</p></div>';
        return;
    }
    lista.innerHTML = '';
    reubicaciones.forEach(r => {
        const card = document.createElement('div');
        card.className = 'informe-card';
        card.innerHTML = `
            <h3>Clave: ${r.clave}</h3>
            <p><strong>Fecha:</strong> ${r.fecha}</p>
            <p><strong>Medidor:</strong> ${r.numMedidor}</p>
            <p><strong>Usuario:</strong> ${r.usuario}</p>
            ${r.observaciones ? `<p><strong>Observaciones:</strong> ${r.observaciones}</p>` : ''}
            ${r.lat ? `<a class="map-link" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank">Ver en Google Maps</a>` : '<p><strong>Coordenadas:</strong> No registradas</p>'}
            ${(r.fachadaFoto || r.medidorFoto) ? `
            <div class="informe-photos">
                ${r.fachadaFoto ? `<div><p><strong>Fachada:</strong></p><img src="${r.fachadaFoto}" alt="Fachada"></div>` : ''}
                ${r.medidorFoto ? `<div><p><strong>Medidor:</strong></p><img src="${r.medidorFoto}" alt="Medidor"></div>` : ''}
            </div>` : ''}
            <div class="card-actions">
                <button class="btn-download" onclick="generarPDFReubicacion(reubicaciones.find(r => r.id === ${r.id}))">Descargar PDF</button>
                <button class="btn-delete" onclick="deleteReubicacion(${r.id})">Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

function deleteReubicacion(id) {
    if (confirm('¿Eliminar este reporte?')) {
        reubicaciones = reubicaciones.filter(r => r.id !== id);
        localStorage.setItem('reubicaciones', JSON.stringify(reubicaciones));
        renderReubicacion();
    }
}

// ==================== POSTES DERRIBADOS ====================

let postes = JSON.parse(localStorage.getItem('postes')) || [];
let postesFotos = [];

// Galería múltiple postes
document.getElementById('postesGallery').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                postesFotos.push(event.target.result);
                actualizarGaleriaPostes();
            };
            reader.readAsDataURL(file);
        }
    });
    e.target.value = '';
});

function actualizarGaleriaPostes() {
    const galeria = document.getElementById('postesGaleria');
    const contador = document.getElementById('postesContadorFotos');
    galeria.innerHTML = '';

    postesFotos.forEach((foto, index) => {
        const div = document.createElement('div');
        div.className = 'foto-item';
        div.innerHTML = `
            <img src="${foto}" alt="Foto ${index + 1}">
            <button type="button" class="btn-remove" onclick="eliminarFotoPoste(${index})">×</button>
        `;
        galeria.appendChild(div);
    });

    contador.textContent = `${postesFotos.length} foto${postesFotos.length !== 1 ? 's' : ''} agregada${postesFotos.length !== 1 ? 's' : ''}`;
}

function eliminarFotoPoste(index) {
    postesFotos.splice(index, 1);
    actualizarGaleriaPostes();
}

// Coordenadas postes
function obtenerCoordenadasPostes() {
    const btn = document.querySelector('#postesScreen .btn-coords');
    const coordsBox = document.getElementById('postesCoordsBox');

    if (!navigator.geolocation) { alert('Tu dispositivo no soporta geolocalización'); return; }

    btn.disabled = true;
    btn.textContent = 'Obteniendo ubicación...';
    coordsBox.innerHTML = '<p>Buscando señal GPS...</p>';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const accuracy = Math.round(position.coords.accuracy);

            document.getElementById('postesLat').value = lat;
            document.getElementById('postesLng').value = lng;

            coordsBox.classList.add('active');
            coordsBox.innerHTML = `
                <div>
                    <p>Lat: <strong>${lat}</strong> | Lng: <strong>${lng}</strong></p>
                    <p style="font-size:12px; color:#888;">Precisión: ±${accuracy} metros</p>
                    <a class="map-link" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">Ver en Google Maps</a>
                </div>`;
            btn.disabled = false;
            btn.textContent = 'Ubicación obtenida - Actualizar';
        },
        (error) => {
            let msg = 'Error al obtener ubicación';
            if (error.code === 1) msg = 'Permiso denegado. Actívalo en tu navegador.';
            if (error.code === 2) msg = 'Ubicación no disponible.';
            if (error.code === 3) msg = 'Tiempo agotado. Intenta de nuevo.';
            coordsBox.innerHTML = `<p>${msg}</p>`;
            btn.disabled = false;
            btn.textContent = 'Obtener Ubicación';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// Guardar reporte postes
document.getElementById('postesForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (postesFotos.length === 0) { alert('Por favor, agrega al menos una foto del poste'); return; }

    const r = {
        id: Date.now(),
        fecha: document.getElementById('postesFecha').value,
        clave: document.getElementById('postesClave').value.trim(),
        contiguo: document.getElementById('postesContiguo').value.trim(),
        fotos: [...postesFotos],
        observaciones: document.getElementById('postesObservaciones').value.trim(),
        lat: document.getElementById('postesLat').value || null,
        lng: document.getElementById('postesLng').value || null,
        usuario: currentUser
    };

    const btn = document.querySelector('#postesScreen .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('Postes', {
        inspector: currentUser, fecha: r.fecha, clave: r.clave,
        contiguo: r.contiguo, observaciones: r.observaciones,
        lat: r.lat, lng: r.lng, fotos: r.fotos
    });

    enviarEnSegundoPlano('Postes derribados - Clave ' + r.clave, {
        'Usuario': currentUser, 'Fecha': r.fecha, 'Clave': r.clave,
        'Contiguo': r.contiguo, 'Cantidad_Fotos': r.fotos.length,
        'Observaciones': r.observaciones || 'Ninguna',
        'Latitud': r.lat || 'No registrada', 'Longitud': r.lng || 'No registrada',
        'Google_Maps': r.lat ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : 'No registrado',
        'Foto_Medidor': r.fotos[0] || null
    });

    document.getElementById('postesForm').reset();
    postesFotos = [];
    actualizarGaleriaPostes();
    document.getElementById('postesCoordsBox').classList.remove('active');
    document.getElementById('postesCoordsBox').innerHTML = '<p>Sin coordenadas</p>';
    document.querySelector('#postesScreen .btn-coords').textContent = 'Obtener Ubicación';
    document.getElementById('postesFecha').value = new Date().toLocaleString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    btn.textContent = 'Enviar Reporte'; btn.disabled = false;
    generarPDFPostes(r);
    alert('Reporte enviado al correo correctamente.');
});

// Generar PDF postes
function generarPDFPostes(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [102, 126, 234];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont(undefined, 'bold');
    pdf.text('REPORTE DE POSTES DERRIBADOS', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Reporte #${r.id}`, 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN DEL REPORTE', 20, y); y += 10;

    const campos = [
        ['Fecha', r.fecha],
        ['Usuario', r.usuario],
        ['Clave', r.clave],
        ['Contiguo', r.contiguo],
        ['Latitud', r.lat || 'No registrada'],
        ['Longitud', r.lng || 'No registrada'],
    ];

    pdf.setFontSize(11);
    campos.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 75, y);
        y += 8;
    });

    if (r.observaciones) {
        y += 4;
        pdf.setFont(undefined, 'bold');
        pdf.text('Observaciones:', 20, y); y += 7;
        pdf.setFont(undefined, 'normal');
        const lines = pdf.splitTextToSize(r.observaciones, 170);
        pdf.text(lines, 20, y);
        y += lines.length * 7;
    }

    // Línea separadora
    y += 5;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    // Fotos en grid (2 por fila)
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.text(`FOTOS DEL POSTE (${r.fotos.length})`, 20, y); y += 8;

    r.fotos.forEach((foto, index) => {
        if (y > 230) { pdf.addPage(); y = 20; }
        const col = index % 2 === 0 ? 20 : 110;
        if (index % 2 === 0 && index > 0) y += 75;
        try {
            pdf.addImage(foto, 'JPEG', col, y, 80, 70);
        } catch (err) { console.error(err); }
        if (index % 2 === 1) y += 75;
    });

    if (r.lat && r.lng) {
        if (y > 260) { pdf.addPage(); y = 20; }
        y += 10;
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 255);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Ver en Google Maps: https://www.google.com/maps?q=${r.lat},${r.lng}`, 20, y);
    }

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente', 105, 285, { align: 'center' });

    pdf.save(`Postes_${r.clave}_${r.id}.pdf`);
    alert('¡Reporte guardado y PDF generado!');
}

// Renderizar postes
function renderPostes() {
    const lista = document.getElementById('postesList');
    if (postes.length === 0) {
        lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🪵</div><p>No hay reportes guardados</p></div>';
        return;
    }
    lista.innerHTML = '';
    postes.forEach(r => {
        const fotosHTML = r.fotos.map((f, i) => `
            <div><img src="${f}" alt="Foto ${i+1}"></div>
        `).join('');

        const card = document.createElement('div');
        card.className = 'informe-card';
        card.innerHTML = `
            <h3>Clave: ${r.clave}</h3>
            <p><strong>Fecha:</strong> ${r.fecha}</p>
            <p><strong>Contiguo:</strong> ${r.contiguo}</p>
            <p><strong>Usuario:</strong> ${r.usuario}</p>
            ${r.observaciones ? `<p><strong>Observaciones:</strong> ${r.observaciones}</p>` : ''}
            ${r.lat ? `<a class="map-link" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank">Ver en Google Maps</a>` : '<p><strong>Coordenadas:</strong> No registradas</p>'}
            <div class="informe-photos">${fotosHTML}</div>
            <div class="card-actions">
                <button class="btn-download" onclick="generarPDFPostes(postes.find(p => p.id === ${r.id}))">Descargar PDF</button>
                <button class="btn-delete" onclick="deletePoste(${r.id})">Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

function deletePoste(id) {
    if (confirm('¿Eliminar este reporte?')) {
        postes = postes.filter(p => p.id !== id);
        localStorage.setItem('postes', JSON.stringify(postes));
        renderPostes();
    }
}

// ==================== CONFIGURACIÓN EMAILJS ====================

function abrirConfigEmail() {
    // Cargar valores guardados
    document.getElementById('cfgServiceId').value  = localStorage.getItem('ejs_service')  || '';
    document.getElementById('cfgTemplateId').value = localStorage.getItem('ejs_template') || '';
    document.getElementById('cfgPublicKey').value  = localStorage.getItem('ejs_pubkey')   || '';
    document.getElementById('emailConfigModal').style.display = 'block';
}

function guardarConfigEmail() {
    const service  = document.getElementById('cfgServiceId').value.trim();
    const template = document.getElementById('cfgTemplateId').value.trim();
    const pubkey   = document.getElementById('cfgPublicKey').value.trim();

    if (!service || !template || !pubkey) {
        alert('Por favor completa todos los campos');
        return;
    }

    localStorage.setItem('ejs_service',  service);
    localStorage.setItem('ejs_template', template);
    localStorage.setItem('ejs_pubkey',   pubkey);

    document.getElementById('emailConfigModal').style.display = 'none';
    alert('Configuración guardada. Ahora los PDFs se enviarán a tu correo.');
}


// ==================== CONFIGURACIÓN GOOGLE APPS SCRIPT ====================

function abrirConfigScript() {
    document.getElementById('cfgScriptUrl').value = localStorage.getItem('gas_url') || '';
    document.getElementById('scriptConfigModal').style.display = 'block';
}

function guardarConfigScript() {
    const url = document.getElementById('cfgScriptUrl').value.trim();
    if (!url) { alert('Por favor ingresa la URL'); return; }
    localStorage.setItem('gas_url', url);
    document.getElementById('scriptConfigModal').style.display = 'none';
    alert('URL guardada correctamente.');
}


// ==================== FACTURAS ====================

let facturasFotos = [];

document.getElementById('facturasGallery').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                facturasFotos.push(ev.target.result);
                actualizarGaleriaFacturas();
            };
            reader.readAsDataURL(file);
        }
    });
    e.target.value = '';
});

function actualizarGaleriaFacturas() {
    const galeria = document.getElementById('facturasGaleria');
    const contador = document.getElementById('facturasContadorFotos');
    galeria.innerHTML = '';
    facturasFotos.forEach((foto, index) => {
        const div = document.createElement('div');
        div.className = 'foto-item';
        div.innerHTML = `
            <img src="${foto}" alt="Foto ${index + 1}">
            <button type="button" class="btn-remove" onclick="eliminarFotoFactura(${index})">×</button>
        `;
        galeria.appendChild(div);
    });
    contador.textContent = `${facturasFotos.length} foto${facturasFotos.length !== 1 ? 's' : ''} agregada${facturasFotos.length !== 1 ? 's' : ''}`;
}

function eliminarFotoFactura(index) {
    facturasFotos.splice(index, 1);
    actualizarGaleriaFacturas();
}

function mostrarCamposFactura() {
    // reservado para lógica futura por tipo
}

document.getElementById('facturasForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const inspector = document.getElementById('facturasInspector').value.trim();
    const identidad = document.getElementById('facturasIdentidad').value.trim();
    const tipo = document.getElementById('facturasTipo').value;
    const fecha = document.getElementById('facturasFecha').value;
    const valor = document.getElementById('facturasValor').value;

    if (facturasFotos.length === 0) {
        alert('Por favor agrega al menos una foto de la factura');
        return;
    }

    const btn = document.querySelector('#facturasScreen .btn-save');
    btn.textContent = '⏳ Procesando...';
    btn.disabled = true;

    guardarReporte('Factura', {
        inspector, identidad, tipo, fecha,
        valor: `L. ${parseFloat(valor).toFixed(2)}`,
        fotos: [...facturasFotos]
    });

    // Generar PDF local para descarga
    generarPDFFactura({ inspector, identidad, tipo, fecha, valor, fotos: [...facturasFotos] });

    // Enviar al correo — incluir todas las fotos
    const camposCorreo = {
        'Inspector': inspector,
        'Identidad': identidad,
        'Tipo_Gasto': tipo,
        'Fecha': fecha,
        'Valor': `L. ${parseFloat(valor).toFixed(2)}`,
    };
    // Agregar cada foto con nombre único
    facturasFotos.forEach((foto, i) => {
        const nombres = ['Foto_Factura', 'Foto_Moto', 'Foto_Medidor', 'Foto_Fachada', 'Foto_Error'];
        const key = nombres[i] || `Foto_Factura`;
        camposCorreo[key] = foto;
    });

    enviarEnSegundoPlano(`Factura ${tipo} - ${inspector}`, camposCorreo);

    document.getElementById('facturasForm').reset();
    facturasFotos = [];
    actualizarGaleriaFacturas();
    document.getElementById('facturasFecha').value = new Date().toISOString().split('T')[0];
    btn.textContent = 'Enviar y Descargar PDF';
    btn.disabled = false;
    alert('PDF descargado y reporte enviado al correo.');
});

function generarPDFFactura(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [37, 99, 235];
    const colorOsc = [30, 58, 138];

    // Encabezado
    pdf.setFillColor(colorOsc[0], colorOsc[1], colorOsc[2]);
    pdf.rect(0, 0, 210, 42, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text(`FACTURA DE ${r.tipo.toUpperCase()}`, 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Inspector App — ${new Date().toLocaleDateString('es-ES')}`, 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('INFORMACIÓN DEL GASTO', 20, y); y += 10;

    const campos = [
        ['Inspector', r.inspector],
        ['Identidad', r.identidad],
        ['Tipo de Gasto', r.tipo],
        ['Fecha', r.fecha],
        ['Valor', `L. ${parseFloat(r.valor).toFixed(2)}`],
    ];

    pdf.setFontSize(11);
    campos.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 75, y);
        y += 9;
    });

    // Línea separadora
    y += 4;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    // Fotos
    if (r.fotos.length > 0) {
        pdf.setFontSize(13);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(colorOsc[0], colorOsc[1], colorOsc[2]);
        pdf.text('FOTOGRAFÍAS DE FACTURA', 20, y); y += 6;

        let x = 20;
        r.fotos.forEach((foto, i) => {
            try {
                if (y + 75 > 270) { pdf.addPage(); y = 20; x = 20; }
                pdf.addImage(foto, 'JPEG', x, y, 80, 70);
                x += 90;
                if (x > 110) { x = 20; y += 78; }
            } catch(err) {}
        });
    }

    // Pie
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente por Inspector App', 105, 287, { align: 'center' });

    pdf.save(`Factura_${r.tipo}_${r.inspector}_${r.fecha}.pdf`);
}


// ==================== INSPECCIÓN DE MOTO ====================

// Variables de fotos moto
let viajeTableroFoto = null;
let viajeKmInicialFoto = null;
let viajeKmFinalFoto = null;
let viajeKmFinalTardeFoto = null;
let viajeTableroTardeFoto = null;
let inspeccionMotoFoto = null;
let inspeccionRetroFoto = null;
let inspeccionLlantasFoto = null;
let inspeccionLucesDBFoto = null;
let inspeccionLucesDAFoto = null;
let inspeccionLucesTFFoto = null;
let inspeccionLucesTPFoto = null;
let gastosFacturaFoto = null;
let cascoCascoFoto = null;
let cascoViseraFoto = null;
let cascoSeguroFoto = null;

// Abrir pantalla moto — manejado directamente en openOption

// Cambiar tabs moto
function mostrarTabMoto(tab) {
    document.querySelectorAll('.moto-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.moto-tab').forEach(el => el.classList.remove('active'));

    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = 'block';

    const tabs = document.querySelectorAll('.moto-tab');
    const idx = ['viaje', 'inspeccion', 'gastos', 'casco'].indexOf(tab);
    if (tabs[idx]) tabs[idx].classList.add('active');
}

// Patch openOption para incluir moto — ya integrado directamente en openOption arriba

// Captura de fotos moto y galería — ya integrados directamente en capturePhoto y openGallery arriba

// Event listeners galería moto
[
    ['viajeTableroGallery',    'viajeTableroPreview',    (d) => { viajeTableroFoto = d; }],
    ['viajeKmInicialGallery',  'viajeKmInicialPreview',  (d) => { viajeKmInicialFoto = d; }],
    ['viajeKmFinalGallery',    'viajeKmFinalPreview',    (d) => { viajeKmFinalFoto = d; }],
    ['viajeKmFinalTardeGallery','viajeKmFinalTardePreview',(d) => { viajeKmFinalTardeFoto = d; }],
    ['viajeTableroTardeGallery','viajeTableroTardePreview',(d) => { viajeTableroTardeFoto = d; }],
    ['inspeccionMotoGallery',  'inspeccionMotoPreview',  (d) => { inspeccionMotoFoto = d; }],
    ['inspeccionRetroGallery', 'inspeccionRetroPreview', (d) => { inspeccionRetroFoto = d; }],
    ['inspeccionLlantasGallery', 'inspeccionLlantasPreview', (d) => { inspeccionLlantasFoto = d; }],
    ['inspeccionLucesDBGallery', 'inspeccionLucesDBPreview', (d) => { inspeccionLucesDBFoto = d; }],
    ['inspeccionLucesDAGallery', 'inspeccionLucesDAPreview', (d) => { inspeccionLucesDAFoto = d; }],
    ['inspeccionLucesTFGallery', 'inspeccionLucesTFPreview', (d) => { inspeccionLucesTFFoto = d; }],
    ['inspeccionLucesTPGallery', 'inspeccionLucesTPPreview', (d) => { inspeccionLucesTPFoto = d; }],
    ['gastosFacturaGallery',   'gastosFacturaPreview',   (d) => { gastosFacturaFoto = d; }],
    ['cascoCascoGallery',      'cascoCascoPreview',      (d) => { cascoCascoFoto = d; }],
    ['cascoViseraGallery',     'cascoViseraPreview',     (d) => { cascoViseraFoto = d; }],
    ['cascoSeguroGallery',     'cascoSeguroPreview',     (d) => { cascoSeguroFoto = d; }],
].forEach(([galleryId, previewId, setter]) => {
    document.getElementById(galleryId).addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setter(ev.target.result);
                document.getElementById(previewId).innerHTML = `<img src="${ev.target.result}" alt="Foto">`;
            };
            reader.readAsDataURL(file);
        }
    });
});

// ---- Submit: Registro de Viaje (Km Inicial - Mañana) ----
// ---- Registro de Viaje (Km Inicial) ----
function guardarKmInicial() {
    const inspector = document.getElementById('viajeInspector').value.trim();
    const fecha = document.getElementById('viajeFecha').value;
    const kmInicial = document.getElementById('viajeKmInicial').value;

    if (!inspector || !fecha || !kmInicial) { alert('Completa todos los campos'); return; }

    const viajeEnCurso = {
        inspector, fecha, kmInicial,
        fotoKmInicial: viajeKmInicialFoto,
        timestamp: Date.now()
    };
    localStorage.setItem('viaje_en_curso', JSON.stringify(viajeEnCurso));

    document.getElementById('motoViajeForm').reset();
    viajeKmInicialFoto = null;
    document.getElementById('viajeKmInicialPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('viajeFecha').value = new Date().toISOString().split('T')[0];

    verificarViajeEnCurso();
    alert('Kilometraje inicial guardado. Completa el registro con el kilometraje final.');
}

document.getElementById('motoViajeForm').addEventListener('submit', (e) => { e.preventDefault(); return false; });

// Verificar si hay viaje en curso al abrir el tab
function verificarViajeEnCurso() {
    const viaje = JSON.parse(localStorage.getItem('viaje_en_curso') || 'null');
    const box = document.getElementById('viajeEnCursoBox');
    const nuevoBox = document.getElementById('viajeNuevoBox');
    if (viaje) {
        document.getElementById('viajeEnCursoInfo').innerHTML = `
            <p><strong>Inspector:</strong> ${viaje.inspector}</p>
            <p><strong>Fecha:</strong> ${viaje.fecha}</p>
            <p><strong>Km Inicial:</strong> ${viaje.kmInicial}</p>
            ${viaje.fotoKmInicial ? `<img src="${viaje.fotoKmInicial}" style="max-width:120px;border-radius:8px;margin-top:8px;">` : ''}
        `;
        box.style.display = 'block';
        nuevoBox.style.display = 'none';
    } else {
        box.style.display = 'none';
        nuevoBox.style.display = 'block';
        // Re-inicializar select si aún no fue procesado
        const sel = document.getElementById('viajeInspector');
        if (sel && !document.getElementById('viajeInspector_sede')) {
            inicializarSelectsInspector();
        }
    }
}

async function completarViaje() {
    const viaje = JSON.parse(localStorage.getItem('viaje_en_curso') || 'null');
    if (!viaje) return;

    const kmFinal = document.getElementById('viajeKmFinalTarde').value;
    if (!kmFinal) { alert('Ingresa el Km final'); return; }

    const kmRecorridos = parseFloat(kmFinal) - parseFloat(viaje.kmInicial);
    if (kmRecorridos < 0) { alert('El Km final debe ser mayor al inicial'); return; }

    const btn = document.querySelector('#viajeEnCursoBox .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('MotoViaje', {
        inspector: viaje.inspector, fecha: viaje.fecha,
        kmInicial: viaje.kmInicial, kmFinal, kmRecorridos,
        fotoKmInicial: viaje.fotoKmInicial,
        fotoKmFinal: viajeKmFinalTardeFoto,
        fotoTablero: viajeTableroTardeFoto
    });

    enviarEnSegundoPlano('Registro de Viaje - ' + viaje.inspector, {
        'Inspector': viaje.inspector, 'Fecha': viaje.fecha,
        'Km_Inicial': viaje.kmInicial, 'Km_Final': kmFinal,
        'Km_Recorridos': kmRecorridos,
        'Modulo': 'Inspección de Moto - Viaje',
        ...(viaje.fotoKmInicial   ? { 'Foto_Km_Inicial': viaje.fotoKmInicial }   : {}),
        ...(viajeKmFinalTardeFoto ? { 'Foto_Km_Final':   viajeKmFinalTardeFoto } : {}),
        ...(viajeTableroTardeFoto ? { 'Foto_Tablero':    viajeTableroTardeFoto } : {}),
    });

    generarPDFMotoViaje({
        inspector: viaje.inspector, fecha: viaje.fecha,
        kmInicial: viaje.kmInicial, kmFinal, kmRecorridos,
        foto: viajeTableroTardeFoto,
        fotoKmInicial: viaje.fotoKmInicial,
        fotoKmFinal: viajeKmFinalTardeFoto
    });

    localStorage.removeItem('viaje_en_curso');
    viajeKmFinalTardeFoto = null;
    viajeTableroTardeFoto = null;
    document.getElementById('viajeKmFinalTarde').value = '';
    document.getElementById('viajeKmFinalTardePreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('viajeTableroTardePreview').innerHTML = '<p>No hay foto</p>';
    btn.textContent = 'Guardar Kilometraje Final'; btn.disabled = false;

    verificarViajeEnCurso();
    alert('Registro completo. PDF descargado y correo enviándose.');
}

function cancelarViaje() {
    if (confirm('¿Cancelar el registro? Se perderá el kilometraje inicial guardado.')) {
        localStorage.removeItem('viaje_en_curso');
        verificarViajeEnCurso();
    }
}

// ---- Inspección Técnica ----
async function enviarInspeccionMoto() {
    const inspector = document.getElementById('inspeccionInspector').value.trim();
    const fecha = document.getElementById('inspeccionFecha').value;
    const observaciones = document.getElementById('inspeccionObservaciones').value.trim();

    if (!inspector || !fecha) { alert('Completa inspector y fecha'); return; }

    const btn = document.querySelector('#motoInspeccionForm .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    const fotos = {
        moto: inspeccionMotoFoto, retro: inspeccionRetroFoto,
        llantas: inspeccionLlantasFoto, lucesDB: inspeccionLucesDBFoto,
        lucesDA: inspeccionLucesDAFoto, lucesTF: inspeccionLucesTFFoto,
        lucesTP: inspeccionLucesTPFoto,
    };

    guardarReporte('MotoInspeccion', { inspector, fecha, observaciones, fotos });
    enviarEnSegundoPlano('Inspección Moto - ' + inspector, {
        'Inspector': inspector, 'Fecha': fecha,
        'Observaciones': observaciones || 'Ninguna',
        'Modulo': 'Inspección de Moto - Técnica',
        ...(fotos.moto    ? { 'Foto_Moto_Completa': fotos.moto }    : {}),
        ...(fotos.retro   ? { 'Foto_Retrovisores':  fotos.retro }   : {}),
        ...(fotos.llantas ? { 'Foto_Llantas':       fotos.llantas } : {}),
        ...(fotos.lucesDB ? { 'Foto_Luces_DB':      fotos.lucesDB } : {}),
        ...(fotos.lucesDA ? { 'Foto_Luces_DA':      fotos.lucesDA } : {}),
        ...(fotos.lucesTF ? { 'Foto_Luces_TF':      fotos.lucesTF } : {}),
        ...(fotos.lucesTP ? { 'Foto_Luces_TP':      fotos.lucesTP } : {}),
    });
    generarPDFMotoInspeccion({ inspector, fecha, observaciones, fotos });

    document.getElementById('motoInspeccionForm').reset();
    ['inspeccionMotoFoto','inspeccionRetroFoto','inspeccionLlantasFoto',
     'inspeccionLucesDBFoto','inspeccionLucesDAFoto','inspeccionLucesTFFoto','inspeccionLucesTPFoto'].forEach(v => window[v] = null);
    ['inspeccionMotoPreview','inspeccionRetroPreview','inspeccionLlantasPreview',
     'inspeccionLucesDBPreview','inspeccionLucesDAPreview','inspeccionLucesTFPreview','inspeccionLucesTPPreview']
        .forEach(id => document.getElementById(id).innerHTML = '<p>No hay foto</p>');
    document.getElementById('inspeccionFecha').value = new Date().toISOString().split('T')[0];
    btn.textContent = 'Enviar Inspección'; btn.disabled = false;
    alert('Inspección guardada y PDF descargado. Correo enviándose en segundo plano.');
}
document.getElementById('motoInspeccionForm').addEventListener('submit', (e) => e.preventDefault());

// ---- Submit: Gastos ----
// ---- Gastos ----
async function enviarGastoMoto() {
    const inspector = document.getElementById('gastosInspector').value.trim();
    const fecha = document.getElementById('gastosFecha').value;
    const tipo = document.getElementById('gastosTipo').value;
    const descripcion = document.getElementById('gastosDescripcion').value.trim();
    const valor = document.getElementById('gastosValor').value;

    if (!inspector || !fecha || !tipo || !valor) { alert('Completa todos los campos'); return; }

    const btn = document.querySelector('#motoGastosForm .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('MotoGastos', {
        inspector, fecha, tipo, descripcion,
        valor: `L. ${parseFloat(valor).toFixed(2)}`,
        fotoFactura: gastosFacturaFoto
    });
    enviarEnSegundoPlano('Gasto Moto - ' + inspector, {
        'Inspector': inspector, 'Fecha': fecha,
        'Tipo_Gasto': tipo, 'Descripcion': descripcion,
        'Valor': `L. ${parseFloat(valor).toFixed(2)}`,
        'Modulo': 'Inspección de Moto - Gastos',
        ...(gastosFacturaFoto ? { 'Foto_Factura': gastosFacturaFoto } : {}),
    });
    generarPDFMotoGastos({ inspector, fecha, tipo, descripcion, valor, foto: gastosFacturaFoto });

    document.getElementById('motoGastosForm').reset();
    gastosFacturaFoto = null;
    document.getElementById('gastosFacturaPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('gastosFecha').value = new Date().toISOString().split('T')[0];
    btn.textContent = 'Enviar Gasto'; btn.disabled = false;
    alert('Gasto guardado y PDF descargado. Correo enviándose en segundo plano.');
}
document.getElementById('motoGastosForm').addEventListener('submit', (e) => e.preventDefault());

// ---- PDF: Viaje ----
function generarPDFMotoViaje(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [37, 99, 235];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 42, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('REGISTRO DE VIAJE - MOTO', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(new Date().toLocaleDateString('es-ES'), 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('DATOS DEL VIAJE', 20, y); y += 10;

    [
        ['Inspector', r.inspector],
        ['Fecha', r.fecha],
        ['Km Inicial', r.kmInicial],
        ['Km Final', r.kmFinal],
        ['Km Recorridos', r.kmRecorridos],
    ].forEach(([label, value]) => {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), 75, y);
        y += 9;
    });

    y += 5;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    // Fotos km inicial y final lado a lado
    if (r.fotoKmInicial || r.fotoKmFinal) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);
        if (r.fotoKmInicial) {
            pdf.text('FOTO KM INICIAL', 20, y);
            try { pdf.addImage(r.fotoKmInicial, 'JPEG', 20, y + 4, 80, 70); } catch(e) {}
        }
        if (r.fotoKmFinal) {
            pdf.text('FOTO KM FINAL', 110, y);
            try { pdf.addImage(r.fotoKmFinal, 'JPEG', 110, y + 4, 80, 70); } catch(e) {}
        }
        y += 82;
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.line(20, y, 190, y); y += 10;
    }

    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.text('FOTO DEL TABLERO / ODÓMETRO', 20, y); y += 6;
    try { pdf.addImage(r.foto, 'JPEG', 20, y, 100, 90); } catch(e) {}

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente por Inspector App', 105, 287, { align: 'center' });

    pdf.save(`Viaje_${r.inspector}_${r.fecha}.pdf`);
}

// ---- PDF: Inspección ----
function generarPDFMotoInspeccion(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [37, 99, 235];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 42, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('INSPECCIÓN TÉCNICA - MOTO', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(new Date().toLocaleDateString('es-ES'), 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('DATOS DE INSPECCIÓN', 20, y); y += 10;

    pdf.setFontSize(11);
    [['Inspector', r.inspector], ['Fecha', r.fecha]].forEach(([l, v]) => {
        pdf.setFont(undefined, 'bold'); pdf.text(`${l}:`, 20, y);
        pdf.setFont(undefined, 'normal'); pdf.text(String(v), 75, y); y += 9;
    });

    if (r.observaciones) {
        pdf.setFont(undefined, 'bold'); pdf.text('Observaciones:', 20, y); y += 7;
        pdf.setFont(undefined, 'normal');
        const lines = pdf.splitTextToSize(r.observaciones, 170);
        pdf.text(lines, 20, y); y += lines.length * 7;
    }

    y += 5;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    const fotoLabels = [
        [r.fotos.moto,    'MOTO COMPLETA'],
        [r.fotos.retro,   'RETROVISORES'],
        [r.fotos.llantas, 'LLANTAS'],
        [r.fotos.lucesDB, 'LUCES DELANTERAS BAJAS'],
        [r.fotos.lucesDA, 'LUCES DELANTERAS ALTAS'],
        [r.fotos.lucesTF, 'LUCES TRASERAS FRENO'],
        [r.fotos.lucesTP, 'LUCES TRASERAS POSICIÓN'],
    ].filter(([foto]) => foto);

    let col = 0;
    fotoLabels.forEach(([foto, label], i) => {
        if (y + 75 > 270) { pdf.addPage(); y = 20; col = 0; }
        const x = col === 0 ? 20 : 110;
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(label, x, y); 
        try { pdf.addImage(foto, 'JPEG', x, y + 3, 80, 68); } catch(e) {}
        col++;
        if (col === 2) { col = 0; y += 78; }
    });

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente por Inspector App', 105, 287, { align: 'center' });

    pdf.save(`Inspeccion_${r.inspector}_${r.fecha}.pdf`);
}

// ---- PDF: Gastos ----
function generarPDFMotoGastos(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [37, 99, 235];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 42, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('GASTO DE MOTO', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(new Date().toLocaleDateString('es-ES'), 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('DETALLE DEL GASTO', 20, y); y += 10;

    [
        ['Inspector', r.inspector],
        ['Fecha', r.fecha],
        ['Tipo', r.tipo],
        ['Descripción', r.descripcion],
        ['Valor', `L. ${parseFloat(r.valor).toFixed(2)}`],
    ].forEach(([l, v]) => {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold'); pdf.text(`${l}:`, 20, y);
        pdf.setFont(undefined, 'normal'); pdf.text(String(v), 75, y); y += 9;
    });

    if (r.foto) {
        y += 5;
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.5);
        pdf.line(20, y, 190, y); y += 10;
        pdf.setFontSize(13);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text('FOTO DE FACTURA', 20, y); y += 6;
        try { pdf.addImage(r.foto, 'JPEG', 20, y, 100, 90); } catch(e) {}
    }

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente por Inspector App', 105, 287, { align: 'center' });

    pdf.save(`Gasto_${r.tipo}_${r.inspector}_${r.fecha}.pdf`);
}

// ==================== CASCO ====================

// ==================== CASCO ====================

async function enviarCascoMoto() {
    const inspector = document.getElementById('cascoInspector').value;
    const fecha = document.getElementById('cascoFecha').value;
    const observaciones = document.getElementById('cascoObservaciones').value.trim();

    if (!inspector || !fecha) { alert('Completa inspector y fecha'); return; }
    if (!cascoCascoFoto && !cascoViseraFoto && !cascoSeguroFoto) {
        alert('Por favor agrega al menos una foto'); return;
    }

    const btn = document.querySelector('#motoCascoForm .btn-save');
    btn.textContent = 'Enviando...'; btn.disabled = true;

    guardarReporte('MotoCasco', { inspector, fecha, observaciones,
        fotoCasco: cascoCascoFoto, fotoVisera: cascoViseraFoto, fotoSeguro: cascoSeguroFoto });
    enviarEnSegundoPlano('Inspección Casco - ' + inspector, {
        'Inspector': inspector, 'Fecha': fecha,
        'Observaciones': observaciones || 'Ninguna',
        'Modulo': 'Inspección de Moto - Casco',
        ...(cascoCascoFoto  ? { 'Foto_Casco':  cascoCascoFoto }  : {}),
        ...(cascoViseraFoto ? { 'Foto_Visera': cascoViseraFoto } : {}),
        ...(cascoSeguroFoto ? { 'Foto_Seguro': cascoSeguroFoto } : {}),
    });
    generarPDFMotoCasco({ inspector, fecha, observaciones,
        fotoCasco: cascoCascoFoto, fotoVisera: cascoViseraFoto, fotoSeguro: cascoSeguroFoto });

    document.getElementById('motoCascoForm').reset();
    cascoCascoFoto = null; cascoViseraFoto = null; cascoSeguroFoto = null;
    document.getElementById('cascoCascoPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('cascoViseraPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('cascoSeguroPreview').innerHTML = '<p>No hay foto</p>';
    document.getElementById('cascoFecha').value = new Date().toISOString().split('T')[0];
    btn.textContent = 'Enviar Inspección de Casco'; btn.disabled = false;
    alert('Inspección de casco guardada y PDF descargado. Correo enviándose en segundo plano.');
}
document.getElementById('motoCascoForm').addEventListener('submit', (e) => e.preventDefault());

function generarPDFMotoCasco(r) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const color = [37, 99, 235];

    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(0, 0, 210, 42, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('INSPECCIÓN DE CASCO', 105, 18, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.text(new Date().toLocaleDateString('es-ES'), 105, 30, { align: 'center' });

    let y = 55;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text('DATOS DE INSPECCIÓN', 20, y); y += 10;

    pdf.setFontSize(11);
    [['Inspector', r.inspector], ['Fecha', r.fecha]].forEach(([l, v]) => {
        pdf.setFont(undefined, 'bold'); pdf.text(`${l}:`, 20, y);
        pdf.setFont(undefined, 'normal'); pdf.text(String(v), 75, y); y += 9;
    });

    if (r.observaciones) {
        pdf.setFont(undefined, 'bold'); pdf.text('Observaciones:', 20, y); y += 7;
        pdf.setFont(undefined, 'normal');
        const lines = pdf.splitTextToSize(r.observaciones, 170);
        pdf.text(lines, 20, y); y += lines.length * 7;
    }

    y += 5;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y); y += 10;

    const fotos = [
        [r.fotoCasco,  'FOTO DEL CASCO'],
        [r.fotoVisera, 'FOTO VISERA LEVANTADA'],
        [r.fotoSeguro, 'FOTO SEGURO DEL CASCO PUESTO'],
    ].filter(([foto]) => foto);

    let col = 0;
    fotos.forEach(([foto, label]) => {
        if (y + 75 > 270) { pdf.addPage(); y = 20; col = 0; }
        const x = col === 0 ? 20 : 110;
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(label, x, y);
        try { pdf.addImage(foto, 'JPEG', x, y + 3, 80, 68); } catch(e) {}
        col++;
        if (col === 2) { col = 0; y += 78; }
    });

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(undefined, 'italic');
    pdf.text('Documento generado automáticamente por Inspector App', 105, 287, { align: 'center' });

    pdf.save(`Casco_${r.inspector}_${r.fecha}.pdf`);
}


// ==================== GESTIÓN DE INSPECTORES ====================

const SUBSEDES_DEFAULT = {
    'Sub-Sede La Entrada Copán': [
        'Axel Rosendo',
        'Cristian Balderramos',
        'Cristian Sarmiento',
        'Denis Bueso',
        'Joaquin Rodriguez',
        'Marvin Bojorge',
        'Mario Polanco',
        'Victor Santos',
    ],
    'Sub-Sede Copán Ruinas': [
        'Denilson Pineda',
        'Erlin Lara',
        'Luis Arita',
        'Luis Vega',
        'Orlin Rosales',
    ],
};

const SUBSEDES_KEY = 'subsedes_inspectores';

// IDs de todos los selects de inspector (cada uno tiene un select de sede y uno de nombre)
const INSPECTOR_SELECT_IDS = [
    'errorInspector',
    'facturasInspector',
    'cascoInspector',
];

function getSubsedes() {
    const guardado = localStorage.getItem(SUBSEDES_KEY);
    return guardado ? JSON.parse(guardado) : JSON.parse(JSON.stringify(SUBSEDES_DEFAULT));
}

function saveSubsedes(data) {
    localStorage.setItem(SUBSEDES_KEY, JSON.stringify(data));
}

// Construye el HTML de sede+inspector para un campo dado
function buildInspectorField(selectId) {
    const sedeId = selectId + '_sede';
    const subsedes = getSubsedes();
    const sedeOpts = Object.keys(subsedes).map(s =>
        `<option value="${s}">${s}</option>`
    ).join('');

    return `
        <div style="display:flex;flex-direction:column;gap:8px;">
            <select id="${sedeId}" onchange="onSedeChange('${selectId}')"
                style="width:100%;padding:12px 16px;border:2px solid var(--gray-200);border-radius:8px;font-size:15px;color:var(--gray-800);background:white;">
                <option value="">-- Selecciona sub-sede --</option>
                ${sedeOpts}
            </select>
            <select id="${selectId}" required
                style="width:100%;padding:12px 16px;border:2px solid var(--gray-200);border-radius:8px;font-size:15px;color:var(--gray-800);background:white;">
                <option value="">-- Selecciona inspector --</option>
            </select>
        </div>
    `;
}

// Cuando cambia la sede, actualiza el select de inspector
function onSedeChange(inspectorSelectId) {
    const sedeId = inspectorSelectId + '_sede';
    const sede = document.getElementById(sedeId).value;
    const sel = document.getElementById(inspectorSelectId);
    while (sel.options.length > 1) sel.remove(1);
    if (!sede) return;
    const subsedes = getSubsedes();
    (subsedes[sede] || []).forEach(nombre => {
        const opt = document.createElement('option');
        opt.value = nombre;
        opt.textContent = nombre;
        sel.appendChild(opt);
    });
}

// Reemplaza cada select simple por el par sede+inspector en el DOM
function inicializarSelectsInspector() {
    INSPECTOR_SELECT_IDS.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        // Evitar doble inicialización
        if (document.getElementById(id + '_sede')) return;
        const wrapper = sel.parentElement;
        // Insertar el select de sede antes del select de inspector
        const sedeDiv = document.createElement('div');
        sedeDiv.innerHTML = buildInspectorField(id);
        // Reemplazar el select original con el nuevo par
        wrapper.replaceChild(sedeDiv.firstElementChild, sel);
    });
}

// Modal gestión de inspectores
function abrirGestionInspectores() {
    renderModalInspectores();
    document.getElementById('inspectoresModal').style.display = 'block';
}

function renderModalInspectores() {
    const subsedes = getSubsedes();
    const container = document.getElementById('inspectoresList');
    container.innerHTML = Object.entries(subsedes).map(([sede, nombres]) => `
        <div style="margin-bottom:16px;">
            <div style="font-weight:700;color:var(--primary);font-size:14px;padding:8px 12px;
                background:var(--primary-light);border-radius:8px;margin-bottom:8px;">
                ${sede}
            </div>
            ${nombres.map((n, i) => `
                <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:9px 12px;background:var(--gray-50);border:1px solid var(--gray-200);
                    border-radius:8px;margin-bottom:6px;">
                    <span style="font-weight:600;color:var(--gray-700);">${n}</span>
                    <button onclick="eliminarInspectorSede('${sede.replace(/'/g,"\\'")}',${i})"
                        style="background:#fef2f2;color:var(--danger);border:1px solid var(--danger);
                        border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px;font-weight:600;">
                        ✕
                    </button>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function agregarInspector() {
    const nombre = document.getElementById('nuevoInspectorInput').value.trim();
    const sede = document.getElementById('nuevoInspectorSede').value;
    if (!nombre) { alert('Ingresa un nombre'); return; }
    if (!sede) { alert('Selecciona una sub-sede'); return; }

    const subsedes = getSubsedes();
    if (!subsedes[sede]) subsedes[sede] = [];
    if (subsedes[sede].includes(nombre)) { alert('Ese inspector ya existe en esa sede'); return; }

    subsedes[sede].push(nombre);
    saveSubsedes(subsedes);
    document.getElementById('nuevoInspectorInput').value = '';
    renderModalInspectores();
    // Refrescar selects abiertos
    INSPECTOR_SELECT_IDS.forEach(id => {
        const sedeEl = document.getElementById(id + '_sede');
        if (sedeEl && sedeEl.value === sede) onSedeChange(id);
    });
}

function eliminarInspectorSede(sede, index) {
    const subsedes = getSubsedes();
    const nombre = subsedes[sede][index];
    if (!confirm(`¿Eliminar a "${nombre}" de ${sede}?`)) return;
    subsedes[sede].splice(index, 1);
    saveSubsedes(subsedes);
    renderModalInspectores();
    INSPECTOR_SELECT_IDS.forEach(id => {
        const sedeEl = document.getElementById(id + '_sede');
        if (sedeEl && sedeEl.value === sede) onSedeChange(id);
    });
}

document.getElementById('nuevoInspectorInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); agregarInspector(); }
});

// Inicializar al cargar
inicializarSelectsInspector();


// ==================== PANEL SUPERVISOR ====================

function showSupervisorScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('supervisorScreen').classList.add('active');
    cargarReportesSupervisor();
}

function cerrarSesionSupervisor() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentRol');
    currentUser = null;
    document.getElementById('supervisorScreen').classList.remove('active');
    loginScreen.classList.add('active');
}

function limpiarFiltros() {
    document.getElementById('filtroModulo').value = '';
    document.getElementById('filtroInspector').value = '';
    document.getElementById('filtroFecha').value = '';
    document.getElementById('filtroTexto').value = '';
    aplicarFiltros();
}

// Cache de todos los reportes cargados — declarado al inicio del archivo

// Carga reportes desde Google Sheets via GAS
async function cargarReportesSupervisor() {
    const lista    = document.getElementById('supervisorLista');
    const contador = document.getElementById('supervisorContador');
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Cargando reportes...</p></div>';
    contador.textContent = '';

    try {
        const payload = { accion: 'obtenerReportes' };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(GAS_URL_FIJA, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch(e) { throw new Error('Respuesta inválida del servidor'); }

        if (!data.success) throw new Error(data.error || 'Error desconocido');

        _todosLosReportes = data.reportes || [];
        poblarFiltroInspectores(_todosLosReportes);
        actualizarStats(_todosLosReportes);
        try {
            aplicarFiltros();
        } catch(renderErr) {
            console.error('Error en renderizado:', renderErr);
            lista.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><p>Error al mostrar reportes.<br><small>${renderErr.message}</small></p></div>`;
        }

    } catch(err) {
        lista.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><p>No se pudo conectar al servidor.<br><small>${err.message}</small></p></div>`;
        contador.textContent = '';
    }
}

function aplicarFiltros() {
    const modulo    = document.getElementById('filtroModulo').value.toLowerCase();
    const inspector = document.getElementById('filtroInspector').value.toLowerCase();
    const fecha     = document.getElementById('filtroFecha').value;
    const texto     = (document.getElementById('filtroTexto').value || '').toLowerCase();

    let filtrados = _todosLosReportes.filter(r => {
        const mod  = (r['Módulo'] || r['Modulo'] || '').toLowerCase();
        const insp = (r['Inspector'] || r['Usuario'] || '').toLowerCase();
        const fech = (r['Fecha'] || '').toString();
        const todo = JSON.stringify(r).toLowerCase();

        if (modulo    && !mod.includes(modulo))       return false;
        if (inspector && !insp.includes(inspector))   return false;
        if (fecha     && !fech.includes(fecha))        return false;
        if (texto     && !todo.includes(texto))        return false;
        return true;
    });

    renderDashboard(filtrados);
}

function poblarFiltroInspectores(reportes) {
    if (!reportes) return;
    const inspectores = [...new Set(reportes.map(r => r['Inspector']).filter(Boolean))].sort();
    const sel = document.getElementById('filtroInspector');
    const actual = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    inspectores.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        sel.appendChild(opt);
    });
    if (actual) sel.value = actual;
}

function actualizarStats(reportes) {
    if (!reportes) return;
    document.getElementById('statTotal').textContent = reportes.length;
    const hoy = new Date().toLocaleDateString('es-HN');
    const hoyCount = reportes.filter(r => {
        const f = (r['Fecha Registro'] || '').toString();
        return f.includes(new Date().toLocaleDateString('es-HN').split('/').reverse().join('-')) ||
               f.includes(new Date().toISOString().split('T')[0]);
    }).length;
    document.getElementById('statHoy').textContent = hoyCount;
    const inspUnicos = new Set(reportes.map(r => r['Inspector']).filter(Boolean)).size;
    document.getElementById('statInspectores').textContent = inspUnicos;
}

// Mapa de colores por módulo
function getBadgeClass(modulo) {
    const m = (modulo || '').toLowerCase();
    if (m.includes('medidor'))    return 'badge-medidor';
    if (m.includes('error'))      return 'badge-error';
    if (m.includes('consumo'))    return 'badge-consumo';
    if (m.includes('reubicacion'))return 'badge-reubicacion';
    if (m.includes('poste'))      return 'badge-postes';
    if (m.includes('inspector'))  return 'badge-inspector';
    if (m.includes('factura'))    return 'badge-factura';
    if (m.includes('moto'))       return 'badge-moto';
    return 'badge-default';
}

function renderDashboard(reportes) {
    const contador = document.getElementById('supervisorContador');
    const lista    = document.getElementById('supervisorLista');

    contador.textContent = `${reportes.length} reporte${reportes.length !== 1 ? 's' : ''} encontrado${reportes.length !== 1 ? 's' : ''}`;

    if (reportes.length === 0) {
        lista.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><p>No hay reportes que coincidan</p></div>`;
        return;
    }

    lista.innerHTML = reportes.map((r, idx) => {
        try {
        const modulo    = r['Módulo'] || r['Modulo'] || 'Reporte';
        const inspector = r['Inspector'] || r['Usuario'] || '—';
        const fecha     = r['Fecha'] || '';
        const fechaReg  = r['Fecha Registro'] || '';
        const id        = r['ID'] || idx;
        const badgeClass = getBadgeClass(modulo);

        const campos = buildCamposReporte(r);
        const fotos  = buildFotosReporte(r);
        const pdf    = r['PDF']
            ? `<a href="${r['PDF']}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:10px 18px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,0.3);">Ver PDF</a>`
            : '';

        return `
        <div class="reporte-card">
            <div class="reporte-card-header" onclick="toggleReporte('r${id}')">
                <div class="reporte-card-header-info">
                    <div class="reporte-card-header-top">
                        <span class="reporte-badge ${badgeClass}">${modulo}</span>
                    </div>
                    <div class="reporte-card-header-sub">${inspector} · ${fecha || fechaReg}</div>
                </div>
                <span class="reporte-arrow" id="arrow_r${id}">▼</span>
            </div>
            <div class="reporte-card-body" id="body_r${id}">
                <div class="reporte-campos-grid">${campos}</div>
                ${fotos}
                ${pdf}
                ${fechaReg ? `<div style="margin-top:10px;font-size:11px;color:var(--gray-400);">Registrado: ${fechaReg}</div>` : ''}
                <button onclick="eliminarReporte(${idx})" style="margin-top:12px;padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;"><i data-lucide="trash-2" style="width:15px;height:15px;stroke:white;fill:none;stroke-width:2;"></i> Eliminar reporte</button>
            </div>
        </div>`;
        } catch(e) { return `<div class="reporte-card"><p style="padding:12px;color:red;">Error en reporte ${idx}: ${e.message}</p></div>`; }
    }).join('');
    // Re-inicializar iconos Lucide en contenido dinámico
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleReporte(id) {
    const body  = document.getElementById('body_' + id);
    const arrow = document.getElementById('arrow_' + id);
    if (!body) return;
    const open = body.classList.toggle('open');
    if (arrow) arrow.classList.toggle('open', open);
}

function eliminarReporte(idx) {
    if (!confirm('¿Eliminar este reporte de la vista?')) return;
    _todosLosReportes.splice(idx, 1);
    aplicarFiltros();
}

function eliminarTodosReportes() {
    if (!confirm('¿Eliminar todos los reportes de la vista?')) return;
    _todosLosReportes = [];
    aplicarFiltros();
}

// Columnas supervisor — declaradas al inicio del archivo

function buildCamposReporte(r) {
    if (!r || typeof r !== 'object') return '';
    return Object.entries(CAMPOS_LABEL)
        .filter(([k]) => r[k] !== undefined && r[k] !== null && r[k] !== '')
        .map(([k, label]) => {
            const v = r[k];
            const display = k === 'Google Maps' && v
                ? `<a href="${v}" target="_blank" style="color:var(--primary);font-weight:600;">Ver en mapa</a>`
                : v;
            const fullClass = CAMPOS_FULL.includes(k) ? ' reporte-campo-full' : '';
            return `<div class="reporte-campo${fullClass}"><strong>${label}</strong><span>${display}</span></div>`;
        }).join('');
}

function buildFotosReporte(r) {
    const fotos = [];
    for (let i = 1; i <= 7; i++) {
        const url = r[`Foto ${i}`];
        if (url && url.startsWith('http')) fotos.push(url);
    }
    if (fotos.length === 0) return '';

    // Convertir URL de Drive a thumbnail si no lo es ya
    const toThumb = (url) => {
        const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600`;
        return url;
    };

    return `
    <div style="margin-top:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Fotografías</div>
        <div class="reporte-fotos">
            ${fotos.map((url, i) => {
                const thumb = toThumb(url);
                return `<div class="reporte-foto-item" onclick="verFotoGrande('${thumb}')">
                    <img src="${thumb}" alt="Foto ${i+1}" onerror="this.parentElement.innerHTML='<span style=font-size:11px;color:#999>Sin vista previa</span>'">
                    <div class="reporte-foto-overlay"><i data-lucide="zoom-in" style="width:16px;height:16px;stroke:white;fill:none;stroke-width:2;"></i></div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function verFotoGrande(src) {
    let modal = document.getElementById('fotoGrandeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fotoGrandeModal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <span class="foto-modal-close" onclick="document.getElementById('fotoGrandeModal').style.display='none'">✕</span>
        <img src="${src}" alt="Foto">
        <a href="${src}" target="_blank" style="color:white;font-size:13px;opacity:0.7;text-decoration:underline;">Abrir en Drive</a>
    `;
    modal.style.display = 'flex';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}
