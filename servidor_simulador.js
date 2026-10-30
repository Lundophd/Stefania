

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Estado de servidores en memoria
let servidores = [
  { nombre: 'Servidor 1', puerto: 3001, estado: 'activo' },
  { nombre: 'Servidor 2', puerto: 3002, estado: 'activo' },
  { nombre: 'Servidor 3', puerto: 3003, estado: 'activo' }
];

// Contador de estadísticas por servidor
let estadisticas = {
  total: 0,
  servidores: {
    'Servidor 1': 0,
    'Servidor 2': 0,
    'Servidor 3': 0
  }
};

let roundRobinIndex = 0;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // ==========================================
  // SERVIR ARCHIVOS ESTÁTICOS DE LA INTERFAZ
  // ==========================================
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error al cargar index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(content);
    });
    return;
  }

  if (url.pathname === '/estilos.css') {
    const filePath = path.join(__dirname, 'estilos.css');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Archivo no encontrado');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/css; charset=UTF-8' });
      res.end(content);
    });
    return;
  }

  if (url.pathname === '/script.js') {
    const filePath = path.join(__dirname, 'script.js');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Archivo no encontrado');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=UTF-8' });
      res.end(content);
    });
    return;
  }

  // ==========================================
  // ENDPOINTS DE LA API (REQUERIDOS POR EL TALLER)
  // ==========================================

  // 1. GET /servidores
  if (url.pathname === '/servidores' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(servidores));
    return;
  }

  // 2. GET /solicitar
  if (url.pathname === '/solicitar' && req.method === 'GET') {
    const activos = servidores.filter(s => s.estado === 'activo');

    if (activos.length === 0) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'No hay servidores disponibles en este momento.'
      }));
      return;
    }

    const servidorElegido = activos[roundRobinIndex % activos.length];
    roundRobinIndex++;

    estadisticas.total++;
    estadisticas.servidores[servidorElegido.nombre] = (estadisticas.servidores[servidorElegido.nombre] || 0) + 1;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      servidor: servidorElegido.nombre,
      puerto: servidorElegido.puerto,
      mensaje: `Petición procesada exitosamente por ${servidorElegido.nombre}`,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 3. GET /estadisticas
  if (url.pathname === '/estadisticas' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(estadisticas));
    return;
  }

  // Utilidad para pruebas: /toggle?puerto=3002
  if (url.pathname === '/toggle' && req.method === 'GET') {
    const p = parseInt(url.searchParams.get('puerto'));
    const target = servidores.find(s => s.puerto === p);
    if (target) {
      target.estado = target.estado === 'activo' ? 'inactivo' : 'activo';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mensaje: `${target.nombre} ahora está ${target.estado}`, servidor: target }));
      return;
    }
  }

  // Ruta no encontrada
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada en la API' }));
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`[OK] Servidor web y API corriendo en: http://localhost:${PORT}`);
  console.log('Ahora al abrir http://localhost:3000 verás la página web.');
  console.log('Endpoints disponibles:');
  console.log('  -> /servidores');
  console.log('  -> /solicitar');
  console.log('  -> /estadisticas');
  console.log('================================================================');
});
