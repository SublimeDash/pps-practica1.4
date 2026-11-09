const express = require('express');
const session = require('express-session');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const User = require('./models/User');
const Task = require('./models/Task');
const { validateTask } = require('./validation');

function createApp({ sessionStore, sessionSecret, cookieSecure = false, allowedOrigin, publicDir }) {
  const app = express();

  // 1. Configuración Helmet HTTP local (Mantiene CSP, evita forzar HTTPS)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: { upgradeInsecureRequests: null }
    },
    strictTransportSecurity: false
  }));

  // 2. CORS
  app.use(cors({ origin: allowedOrigin, credentials: true }));

  // 3. Parser JSON con límite estricto de 16kb (Devuelve 413 si se excede)
  app.use(express.json({ limit: '16kb' }));

  // 4. Configuración de Sesiones
  app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false, // Ahora es false según requisitos
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      sameSite: 'strict', // Modificado a strict
      maxAge: 1000 * 60 * 60 * 2 // Duración limitada (ej. 2 horas)
    }
  }));

  // 5. Rate Limiter para el Login (60 intentos por minuto e IP)
  const loginLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 60,
    message: { error: 'Demasiados intentos de inicio de sesión.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // --- MIDDLEWARES DE PROTECCIÓN ---
  const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'No autenticado.' });
    next();
  };

  const requireCsrf = (req, res, next) => {
    const token = req.get('X-CSRF-Token');
    if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Token CSRF inválido o faltante.' });
    }
    // Comprueba Origin cuando esté presente en peticiones mutables
    const origin = req.get('Origin');
    if (origin && allowedOrigin && origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
    next();
  };

  // --- RUTAS PÚBLICAS ---
  app.get('/api/health', (req, res) => res.status(200).json({ ok: true }));

  // --- RUTAS DE AUTENTICACIÓN ---
  app.get('/api/auth/csrf', (req, res) => {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    // Guardar sesión ANTES de responder (requisito)
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Error interno' });
      res.status(200).json({ csrfToken: req.session.csrfToken });
    });
  });

  app.post('/api/auth/login', loginLimiter, requireCsrf, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });

      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
      }

      // REGENERACIÓN DE SESIÓN (Requisito estricto)
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Error al iniciar sesión' });
        
        req.session.userId = user._id.toString();
        req.session.csrfToken = crypto.randomBytes(32).toString('hex'); // Nuevo token CSRF
        
        req.session.save((err2) => {
          if (err2) return res.status(500).json({ error: 'Error al guardar sesión' });
          res.status(200).json({ user: user.toJSON() });
        });
      });
    } catch (error) {
      res.status(500).json({ error: 'Error interno.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.session.userId);
      if (!user) return res.status(401).json({ error: 'Sesión inválida.' });
      res.status(200).json({ user: user.toJSON() });
    } catch (error) {
      res.status(500).json({ error: 'Error interno.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, requireCsrf, (req, res) => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: 'Error al cerrar sesión.' });
      res.clearCookie('connect.sid'); 
      res.status(204).end();
    });
  });

  // --- RUTAS DE TAREAS ---
  app.use('/api/tasks', requireAuth);

  app.get('/api/tasks', async (req, res) => {
    try {
      const { status } = req.query;
      const filter = { owner: req.session.userId };
      if (status) {
        const statusMap = { 'pendiente': 'Pendiente', 'en progreso': 'En progreso', 'completada': 'Completada' };
        filter.status = statusMap[status.toLowerCase()] || status;
      }
      const tasks = await Task.find(filter).sort({ createdAt: -1 });
      res.status(200).json({ tasks: tasks.map(t => t.toJSON()) });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener tareas.' });
    }
  });

  app.post('/api/tasks', requireCsrf, async (req, res) => {
    try {
      const { ok, errors, value } = validateTask(req.body, false); // false = es Creación
      if (!ok) return res.status(400).json({ errors });

      // Solo construimos con campos seleccionados (value), owner lo pone el servidor
      const task = new Task({
        ...value,
        owner: req.session.userId
      });

      await task.save();
      res.status(201).json({ task: task.toJSON() });
    } catch (error) {
      res.status(500).json({ error: 'Error al crear tarea.' });
    }
  });

  app.patch('/api/tasks/:id', requireCsrf, async (req, res) => {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({ error: 'ID inválido.' });

      const task = await Task.findOne({ _id: req.params.id, owner: req.session.userId });
      if (!task) return res.status(404).json({ error: 'Tarea no encontrada o ajena.' });

      const { ok, errors, value } = validateTask(req.body, true); // true = es Update (PATCH)
      if (!ok) return res.status(400).json({ errors });

      // Actualizamos solo con los campos permitidos y normalizados
      if (value.title !== undefined) task.title = value.title;
      if (value.description !== undefined) task.description = value.description;
      if (value.status !== undefined) task.status = value.status;

      await task.save();
      res.status(200).json({ task: task.toJSON() });
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar tarea.' });
    }
  });

  app.delete('/api/tasks/:id', requireCsrf, async (req, res) => {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({ error: 'ID inválido.' });
      
      const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.session.userId });
      if (!task) return res.status(404).json({ error: 'Tarea no encontrada o ajena.' });
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar tarea.' });
    }
  });
  
// --- SERVIR FRONTEND ESTÁTICO (Producción Docker) ---
  if (publicDir) {
    app.use(express.static(publicDir));
  }
  // MANEJO DE ERRORES GLOBALES (Captura el 413 del límite de 16kb y JSON malformado)
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo de la petición excede el límite de 16kb.' });
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'JSON mal formado.' });
    }
    next(err);
  });

  return app;
}

module.exports = { createApp };