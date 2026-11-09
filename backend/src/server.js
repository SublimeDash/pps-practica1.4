const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const { createApp } = require('./app');

async function main() {
  const { MONGO_URI, SESSION_SECRET, APP_ORIGIN } = process.env;
  
  if (!MONGO_URI || !APP_ORIGIN || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error('Revisa MONGO_URI, APP_ORIGIN y SESSION_SECRET');
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000
  });

  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: 'pps14',
    collectionName: 'sessions'
  });

  const app = createApp({
    sessionStore,
    sessionSecret: SESSION_SECRET,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    allowedOrigin: APP_ORIGIN,
    publicDir: process.env.PUBLIC_DIR
  });

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log('Aplicación disponible en el puerto ' + port);
  });

  async function stop() {
    server.close(async () => {
      await sessionStore.close();
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch(async () => {
  console.error('No se pudo iniciar: revisa variables y MongoDB.');
  await mongoose.disconnect();
  process.exit(1);
});