// Solo se ejecuta al inicializar un volumen de datos vacío.
const password = process.env.APP_DB_PASSWORD;
if (!password) throw new Error('Falta APP_DB_PASSWORD');
db = db.getSiblingDB('pps14');
db.createUser({
  user: 'app',
  pwd: password,
  roles: [
    { role: 'readWrite', db: 'pps14' },
    { role: 'readWrite', db: 'pps14_test' }
  ]
});
