const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Usando bcryptjs según el profesor
const User = require('../src/models/User');

async function seed() {
  if (!process.env.MONGO_URI || !process.env.ALICE_PASSWORD || !process.env.BOB_PASSWORD) {
    throw new Error('Faltan variables para inicializar usuarios');
  }

  await mongoose.connect(process.env.MONGO_URI);

  if (mongoose.connection.name !== 'pps14') {
    throw new Error('La inicialización solo se permite en pps14');
  }

  for (const [username, password] of [
    ['alice', process.env.ALICE_PASSWORD],
    ['bob', process.env.BOB_PASSWORD]
  ]) {
    if (password.length < 12) {
      throw new Error('La contraseña debe tener al menos 12 caracteres');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await User.findOneAndUpdate(
      { username },
      { $set: { passwordHash } },
      { upsert: true, runValidators: true }
    );
  }
  console.log('Usuarios ficticios alice y bob preparados.');
}

seed()
  .catch(() => {
    console.error('No se pudo inicializar: revisa .env y el modelo User.');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());