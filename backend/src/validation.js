// Documentación: Valida tipos, longitudes, enum y rechaza campos no admitidos.
function validateTask(body, isUpdate = false) {
  const errors = [];
  const value = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['El cuerpo debe ser un objeto JSON.'], value: null };
  }

  // Rechazamos campos desconocidos (como 'owner' u otros inyectados)
  const allowedFields = ['title', 'description', 'status'];
  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }

  // Validación de Título
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      errors.push('El título debe ser texto.');
    } else {
      const trimmedTitle = body.title.trim(); // Normaliza espacios exteriores
      if (trimmedTitle.length === 0) {
        errors.push('El título es obligatorio y no puede estar vacío.');
      } else if (trimmedTitle.length > 80) {
        errors.push('El título no puede exceder los 80 caracteres.');
      } else {
        value.title = trimmedTitle;
      }
    }
  } else if (!isUpdate) {
    errors.push('El título es obligatorio.');
  }

  // Validación de Descripción
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('La descripción debe ser texto.');
    } else {
      const trimmedDesc = body.description.trim();
      if (trimmedDesc.length > 500) {
        errors.push('La descripción no puede exceder los 500 caracteres.');
      } else {
        value.description = trimmedDesc;
      }
    }
  } else if (!isUpdate) {
    value.description = ''; // Default en creación
  }

  // Validación de Estado
  const validStatuses = ['Pendiente', 'En progreso', 'Completada', 'pendiente', 'en progreso', 'completada'];
  if (body.status !== undefined) {
    if (typeof body.status !== 'string') {
      errors.push('El estado debe ser texto.');
    } else if (!validStatuses.includes(body.status)) {
      errors.push('Estado no válido. Debe ser Pendiente, En progreso o Completada.');
    } else {
      const statusMap = { 'pendiente': 'Pendiente', 'en progreso': 'En progreso', 'completada': 'Completada' };
      value.status = statusMap[body.status.toLowerCase()] || body.status;
    }
  } else if (!isUpdate) {
    value.status = 'Pendiente'; // Default en creación
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    value: ok ? value : null
  };
}

module.exports = { validateTask };