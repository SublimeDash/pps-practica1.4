const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Task = require('../src/models/Task');

const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'ClavePrueba_14!';
const sessionStore = new session.MemoryStore();
let app;
let ana;
let bruno;
let testDatabaseVerified = false;

function clearSessions() {
  return new Promise((resolve, reject) => {
    sessionStore.clear(error => error ? reject(error) : resolve());
  });
}

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI;
  if (!uri) throw new Error('Falta MONGO_TEST_URI en backend/.env.test');

  const parsed = new URL(uri);
  if (parsed.protocol !== 'mongodb:' || parsed.pathname !== '/pps14_test') {
    throw new Error('Las pruebas solo pueden utilizar la base pps14_test');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  if (mongoose.connection.name !== 'pps14_test') {
    throw new Error('La conexión no corresponde a pps14_test');
  }
  
  testDatabaseVerified = true;
  app = createApp({
    sessionStore,
    sessionSecret: 'secreto-exclusivo-de-pruebas-de-al-menos-32-caracteres',
    cookieSecure: false,
    allowedOrigin: ORIGIN
  });
}, 20000);

beforeEach(async () => {
  if (!testDatabaseVerified) throw new Error('Base de pruebas no verificada');
  await Task.deleteMany({});
  await User.deleteMany({});
  await clearSessions();
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  [ana, bruno] = await User.create([
    { username: 'ana', passwordHash },
    { username: 'bruno', passwordHash }
  ]);
});

afterAll(async () => {
  try {
    if (testDatabaseVerified && mongoose.connection.readyState === 1) {
      await Task.deleteMany({});
      await User.deleteMany({});
    }
    await clearSessions();
  } finally {
    await mongoose.disconnect();
  }
});

async function login(username) {
  const client = request.agent(app);
  const initial = await client.get('/api/auth/csrf').expect(200);
  expect(typeof initial.body.csrfToken).toBe('string');

  await client.post('/api/auth/login')
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', initial.body.csrfToken)
    .send({ username, password: PASSWORD })
    .expect(200);

  // El inicio de sesión regenera la sesión y su token CSRF.
  const renewed = await client.get('/api/auth/csrf').expect(200);
  expect(typeof renewed.body.csrfToken).toBe('string');
  return { client, csrfToken: renewed.body.csrfToken };
}

describe('API de tareas con MongoDB real de laboratorio', () => {
  test('I1. Impide consultar tareas sin iniciar sesión', async () => {
    await request(app).get('/api/tasks').expect(401);
  });

  test('I2. Crea, persiste y lista una tarea propia', async () => {
    const { client, csrfToken } = await login('ana');
    const response = await client.post('/api/tasks')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Revisar dependencias', description: 'Ejecutar auditoría' })
      .expect(201);

    const id = response.body.task.id;
    expect(typeof id).toBe('string');
    expect(response.body.task).toMatchObject({
      title: 'Revisar dependencias',
      description: 'Ejecutar auditoría',
      status: 'Pendiente'
    });

    const saved = await Task.findById(id).lean();
    expect(saved).not.toBeNull();
    expect(String(saved.owner)).toBe(String(ana._id));
    expect(saved.title).toBe('Revisar dependencias');
    expect(saved.description).toBe('Ejecutar auditoría');
    expect(saved.status).toBe('Pendiente');

    const list = await client.get('/api/tasks').expect(200);
    expect(list.body.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id, title: 'Revisar dependencias' })
    ]));
  });

  test('I3. Modifica una tarea propia y persiste el cambio', async () => {
    const task = await Task.create({
      title: 'Preparar pruebas', description: '',
      status: 'Pendiente', owner: ana._id
    });
    const { client, csrfToken } = await login('ana');

    const response = await client.patch('/api/tasks/' + task._id)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Preparar pruebas', description: 'Casos revisados',
        status: 'Completada'
      })
      .expect(200);

    expect(response.body.task.status).toBe('Completada');
    const saved = await Task.findById(task._id).lean();
    expect(saved.status).toBe('Completada');
    expect(saved.description).toBe('Casos revisados');
  });

  test('I4. Oculta tareas ajenas y rechaza su modificación', async () => {
    const otherTask = await Task.create({
      title: 'Tarea de Bruno', description: 'Solo para Bruno',
      status: 'Pendiente', owner: bruno._id
    });
    const { client, csrfToken } = await login('ana');

    const list = await client.get('/api/tasks').expect(200);
    expect(list.body.tasks.some(t => t.id === String(otherTask._id))).toBe(false);

    await client.patch('/api/tasks/' + otherTask._id)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Cambio ajeno', description: '', status: 'Completada' })
      .expect(404);

    const unchanged = await Task.findById(otherTask._id).lean();
    expect(unchanged.title).toBe('Tarea de Bruno');
    expect(unchanged.status).toBe('Pendiente');
  });

  test('I5. Eliminar una tarea propia y verificar su ausencia en MongoDB', async () => {
    // 1. Ana crea una tarea en BD
    const task = await Task.create({
      title: 'Tarea para eliminar', description: 'Será borrada',
      status: 'Pendiente', owner: ana._id
    });
    
    // 2. Ana inicia sesión
    const { client, csrfToken } = await login('ana');

    // 3. Petición DELETE a la API
    await client.delete('/api/tasks/' + task._id)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrfToken)
      .expect(204); // Aserción de la respuesta HTTP

    // 4. Aserción de persistencia: la tarea ya no debe existir en MongoDB
    const deletedTask = await Task.findById(task._id).lean();
    expect(deletedTask).toBeNull();
  });
});