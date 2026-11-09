const { validateTask } = require('../src/validation');

describe('Validación de una tarea', () => {
  test('U1. Normaliza un título válido y asigna el estado inicial', () => {
    const result = validateTask({ title: '  Preparar práctica  ' });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      title: 'Preparar práctica',
      description: '',
      status: 'Pendiente' 
    });
  });

  test('U2. Rechaza un título vacío', () => {
    const result = validateTask({ title: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('U3. Rechaza un título numérico', () => {
    const result = validateTask({ title: 42 });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('U4. Rechaza un título formado solo por espacios', () => {
    const result = validateTask({ title: '     ' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('El título es obligatorio y no puede estar vacío.');
  });

  test('U5. Respeta límite de caracteres: acepta 80, rechaza 81', () => {
    // Comprobación de límite válido (80)
    const title80 = 'a'.repeat(80);
    const resultValid = validateTask({ title: title80 });
    expect(resultValid.ok).toBe(true);
    expect(resultValid.value.title.length).toBe(80);

    // Comprobación de límite excedido (81)
    const title81 = 'a'.repeat(81);
    const resultInvalid = validateTask({ title: title81 });
    expect(resultInvalid.ok).toBe(false);
    expect(resultInvalid.errors).toContain('El título no puede exceder los 80 caracteres.');
  });

  test('U6. Rechaza un estado no permitido en el sistema', () => {
    const result = validateTask({ title: 'Aprobar asignatura', status: 'Archivada' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Estado no válido. Debe ser Pendiente, En progreso o Completada.');
  });
});