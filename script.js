
let API_BASE_URL = localStorage.getItem('api_url') || 'http://localhost:3000';

// ====================================================================
// 2. REFERENCIAS AL DOM
// ====================================================================
const elements = {
  // Configuración de API
  apiUrlInput: document.getElementById('apiUrlInput'),
  btnGuardarApi: document.getElementById('btnGuardarApi'),
  apiStatusText: document.getElementById('apiStatusText'),

  // Tarjetas de Resumen
  kpiTotalSolicitudes: document.getElementById('kpiTotalSolicitudes'),
  kpiTotalServidores: document.getElementById('kpiTotalServidores'),
  kpiServidoresActivos: document.getElementById('kpiServidoresActivos'),
  kpiServidoresInactivos: document.getElementById('kpiServidoresInactivos'),

  // Botones de acción
  btnEnviarSolicitud: document.getElementById('btnEnviarSolicitud'),
  btnEnviar5Solicitudes: document.getElementById('btnEnviar5Solicitudes'),
  btnActualizarServidores: document.getElementById('btnActualizarServidores'),
  btnActualizarEstadisticas: document.getElementById('btnActualizarEstadisticas'),
  btnLimpiarMensajes: document.getElementById('btnLimpiarMensajes'),

  // Detalle de solicitud procesada
  solicitudTimestamp: document.getElementById('solicitudTimestamp'),
  respServidor: document.getElementById('respServidor'),
  respPuerto: document.getElementById('respPuerto'),
  respMensaje: document.getElementById('respMensaje'),

  // Tabla y Estadísticas
  tablaServidoresBody: document.getElementById('tablaServidoresBody'),
  estadisticasContenedor: document.getElementById('estadisticasContenedor'),
  mensajesConsola: document.getElementById('mensajesConsola'),
};

// ====================================================================
// 3. REGISTRO DE MENSAJES Y EVENTOS DEL SISTEMA
// ====================================================================
function agregarMensaje(texto, tipo = 'info') {
  if (!elements.mensajesConsola) return;

  const item = document.createElement('div');
  item.className = `log-entry ${tipo}`;

  const hora = new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const tag = tipo === 'success' ? 'OK' : tipo.toUpperCase();

  item.innerHTML = `
    <span class="log-time">[${hora}]</span>
    <span class="log-tag">${tag}</span>
    <span class="log-msg">${escapeHTML(texto)}</span>
  `;

  // Insertar al inicio
  elements.mensajesConsola.insertBefore(item, elements.mensajesConsola.firstChild);

  // Mantener máximo 50 mensajes
  while (elements.mensajesConsola.children.length > 50) {
    elements.mensajesConsola.removeChild(elements.mensajesConsola.lastChild);
  }
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g, t => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[t] || t));
}

// ====================================================================
// 4. CLIENTE HTTP (FETCH)
// ====================================================================
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { rawText: await response.text() };
    }

    if (!response.ok) {
      const errorMsg = data?.error || data?.mensaje || data?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    actualizarEstadoConexion(true);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    actualizarEstadoConexion(false);

    if (error.name === 'AbortError') {
      throw new Error(`La API no responde a tiempo (Timeout en ${endpoint})`);
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(`Sin conexión con la API en ${API_BASE_URL}. Asegúrate de que el servidor esté activo.`);
    }

    throw error;
  }
}

function actualizarEstadoConexion(online) {
  if (!elements.apiStatusText) return;
  if (online) {
    elements.apiStatusText.textContent = 'Conectado';
    elements.apiStatusText.className = 'connection-pill online';
  } else {
    elements.apiStatusText.textContent = 'Desconectado';
    elements.apiStatusText.className = 'connection-pill offline';
  }
}

// ====================================================================
// 4.1 ENDPOINT: GET /servidores
// ====================================================================
async function consultarServidores() {
  try {
    const data = await fetchAPI('/servidores');
    
    let servidores = [];
    if (Array.isArray(data)) {
      servidores = data;
    } else if (data && Array.isArray(data.servidores)) {
      servidores = data.servidores;
    } else if (data && Array.isArray(data.data)) {
      servidores = data.data;
    }

    renderizarServidores(servidores);
    agregarMensaje(`Nodos actualizados: ${servidores.length} servidores registrados.`, 'info');
    return servidores;
  } catch (error) {
    elements.tablaServidoresBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-notice" style="color: var(--color-offline);">
          <strong>Fallo al consultar servidores:</strong> ${escapeHTML(error.message)}
        </td>
      </tr>
    `;
    elements.kpiTotalServidores.textContent = '0';
    elements.kpiServidoresActivos.textContent = '0';
    elements.kpiServidoresInactivos.textContent = '0';

    agregarMensaje(`Error en /servidores: ${error.message}`, 'error');
  }
}

function renderizarServidores(servidores) {
  if (!servidores || servidores.length === 0) {
    elements.tablaServidoresBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-notice">
          No hay servidores configurados en la API.
        </td>
      </tr>
    `;
    elements.kpiTotalServidores.textContent = '0';
    elements.kpiServidoresActivos.textContent = '0';
    elements.kpiServidoresInactivos.textContent = '0';
    return;
  }

  let activos = 0;
  let inactivos = 0;

  const filas = servidores.map(s => {
    const nombre = s.nombre || s.name || s.servidor || 'Servidor';
    const puerto = s.puerto || s.port || 'N/A';
    
    const rawEstado = (s.estado !== undefined ? s.estado : s.status);
    let esActivo = false;

    if (typeof rawEstado === 'boolean') {
      esActivo = rawEstado;
    } else if (typeof rawEstado === 'string') {
      const e = rawEstado.trim().toLowerCase();
      esActivo = (e === 'activo' || e === 'online' || e === 'up');
    }

    if (esActivo) activos++; else inactivos++;

    const estadoTxt = esActivo ? 'ACTIVO' : 'INACTIVO';
    const clase = esActivo ? 'activo' : 'inactivo';

    return `
      <tr>
        <td><strong>${escapeHTML(nombre)}</strong></td>
        <td><code>${escapeHTML(String(puerto))}</code></td>
        <td>
          <span class="badge-status ${clase}">${estadoTxt}</span>
        </td>
        <td class="th-center">
          <span class="indicator-dot ${clase}" title="${estadoTxt}"></span>
        </td>
      </tr>
    `;
  }).join('');

  elements.tablaServidoresBody.innerHTML = filas;
  elements.kpiTotalServidores.textContent = servidores.length;
  elements.kpiServidoresActivos.textContent = activos;
  elements.kpiServidoresInactivos.textContent = inactivos;
}

// ====================================================================
// 4.2 ENDPOINT: GET /solicitar
// ====================================================================
async function enviarSolicitud() {
  const hora = new Date().toLocaleTimeString('es-CO');
  elements.btnEnviarSolicitud.disabled = true;
  elements.btnEnviarSolicitud.textContent = 'Enviando...';

  try {
    const data = await fetchAPI('/solicitar');

    const servidor = data.servidor || data.server || (data.data && data.data.servidor) || 'Desconocido';
    const puerto = data.puerto || data.port || (data.data && data.data.puerto) || 'N/A';
    const mensaje = data.mensaje || data.message || data.resultado || JSON.stringify(data);

    elements.solicitudTimestamp.textContent = hora;
    elements.respServidor.textContent = servidor;
    elements.respPuerto.textContent = puerto !== 'N/A' ? `Puerto ${puerto}` : 'N/A';
    elements.respMensaje.textContent = typeof mensaje === 'object' ? JSON.stringify(mensaje) : mensaje;

    agregarMensaje(`Solicitud atendida por [${servidor}] (${puerto}): ${mensaje}`, 'success');

    // Actualizar estadísticas inmediatamente
    await consultarEstadisticas();
    await consultarServidores();

    return data;
  } catch (error) {
    elements.solicitudTimestamp.textContent = hora;
    elements.respServidor.textContent = 'ERROR';
    elements.respPuerto.textContent = '--';
    elements.respMensaje.textContent = `No se pudo procesar: ${error.message}`;

    agregarMensaje(`Error en /solicitar: ${error.message}`, 'error');
  } finally {
    elements.btnEnviarSolicitud.disabled = false;
    elements.btnEnviarSolicitud.innerHTML = '<strong>&gt; Enviar solicitud</strong>';
  }
}

async function enviar5Solicitudes() {
  elements.btnEnviar5Solicitudes.disabled = true;
  elements.btnEnviarSolicitud.disabled = true;

  agregarMensaje('Iniciando prueba: envío de 5 solicitudes consecutivas...', 'info');

  for (let i = 1; i <= 5; i++) {
    elements.btnEnviar5Solicitudes.textContent = `Enviando ${i}/5...`;
    await enviarSolicitud();
    await new Promise(r => setTimeout(r, 300));
  }

  elements.btnEnviar5Solicitudes.disabled = false;
  elements.btnEnviarSolicitud.disabled = false;
  elements.btnEnviar5Solicitudes.textContent = 'Ráfaga de prueba (x5)';
  agregarMensaje('Prueba de ráfaga finalizada con éxito.', 'info');
}

// ====================================================================
// 4.3 ENDPOINT: GET /estadisticas
// ====================================================================
async function consultarEstadisticas() {
  try {
    const data = await fetchAPI('/estadisticas');
    renderizarEstadisticas(data);
    return data;
  } catch (error) {
    elements.estadisticasContenedor.innerHTML = `
      <div class="empty-notice" style="color: var(--color-offline);">
        <strong>No se pudieron consultar estadísticas:</strong><br>${escapeHTML(error.message)}
      </div>
    `;
    agregarMensaje(`Error en /estadisticas: ${error.message}`, 'error');
  }
}

function renderizarEstadisticas(data) {
  if (!data) return;

  let total = 0;
  if (typeof data.total === 'number') total = data.total;
  else if (typeof data.total_solicitudes === 'number') total = data.total_solicitudes;

  let lista = [];
  const raw = data.servidores || data.porServidor || data.estadisticas;

  if (Array.isArray(raw)) {
    lista = raw.map(i => ({
      nombre: i.nombre || i.servidor || i.name,
      cantidad: Number(i.solicitudes || i.cantidad || 0)
    }));
  } else if (typeof raw === 'object' && raw !== null) {
    lista = Object.entries(raw).map(([k, v]) => ({
      nombre: k,
      cantidad: typeof v === 'object' ? Number(v.solicitudes || v.total || 0) : Number(v)
    }));
  } else {
    Object.entries(data).forEach(([k, v]) => {
      if (k !== 'total' && k !== 'total_solicitudes' && typeof v === 'number') {
        lista.push({ nombre: k, cantidad: v });
      }
    });
  }

  if (total === 0 && lista.length > 0) {
    total = lista.reduce((acc, curr) => acc + curr.cantidad, 0);
  }

  elements.kpiTotalSolicitudes.textContent = total;

  if (lista.length === 0) {
    elements.estadisticasContenedor.innerHTML = `
      <div class="empty-notice">Aún no hay estadísticas acumuladas.</div>
    `;
    return;
  }

  elements.estadisticasContenedor.innerHTML = lista.map(item => {
    const pct = total > 0 ? Math.round((item.cantidad / total) * 100) : 0;
    return `
      <div class="stat-item">
        <div class="stat-info">
          <span class="stat-name">${escapeHTML(item.nombre)}</span>
          <span class="stat-numbers">
            <span class="stat-count">${item.cantidad}</span> peticiones (${pct}%)
          </span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ====================================================================
// 5. EVENTOS E INICIALIZACIÓN
// ====================================================================
elements.btnGuardarApi.addEventListener('click', () => {
  const nueva = elements.apiUrlInput.value.trim();
  if (nueva) {
    API_BASE_URL = nueva;
    localStorage.setItem('api_url', API_BASE_URL);
    agregarMensaje(`URL de API actualizada a: ${API_BASE_URL}`, 'info');
    recargarTodo();
  }
});

elements.btnEnviarSolicitud.addEventListener('click', enviarSolicitud);
elements.btnEnviar5Solicitudes.addEventListener('click', enviar5Solicitudes);

elements.btnActualizarServidores.addEventListener('click', async () => {
  elements.btnActualizarServidores.disabled = true;
  await consultarServidores();
  elements.btnActualizarServidores.disabled = false;
});

elements.btnActualizarEstadisticas.addEventListener('click', async () => {
  elements.btnActualizarEstadisticas.disabled = true;
  await consultarEstadisticas();
  elements.btnActualizarEstadisticas.disabled = false;
});

elements.btnLimpiarMensajes.addEventListener('click', () => {
  elements.mensajesConsola.innerHTML = `
    <div class="log-entry info">
      <span class="log-time">[Limpio]</span>
      <span class="log-tag">INFO</span>
      <span class="log-msg">Registro de eventos reiniciado.</span>
    </div>
  `;
});

async function recargarTodo() {
  await Promise.allSettled([
    consultarServidores(),
    consultarEstadisticas()
  ]);
}

window.addEventListener('DOMContentLoaded', () => {
  elements.apiUrlInput.value = API_BASE_URL;
  recargarTodo();
});
