import React, { useState, useEffect } from 'react';
import api, { fetchCsrfToken } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('Todas');
  
  // Estado del formulario
  const [taskForm, setTaskForm] = useState({ id: null, title: '', description: '', status: 'Pendiente' });
  
  // Mensajería y notificaciones
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'error' | 'success' | 'info'

  useEffect(() => {
    const initApp = async () => {
      await fetchCsrfToken();
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        fetchTasks();
      } catch (err) {
        // No hay sesión activa, el usuario se queda en la pantalla de login
      }
    };
    initApp();
  }, []);

  const fetchTasks = async (statusFilter = 'Todas') => {
    try {
      const url = statusFilter !== 'Todas' ? `/tasks?status=${statusFilter.toLowerCase()}` : '/tasks';
      const { data } = await api.get(url);
      setTasks(data.tasks);
      setFilter(statusFilter);
    } catch (err) {
      showMessage('Error al cargar las tareas', 'error');
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // --- AUTENTICACIÓN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
      const { data } = await api.post('/auth/login', { username, password });
      await fetchCsrfToken();
      setUser(data.user);
      showMessage(`Bienvenido, ${data.user.username}`, 'success');
      fetchTasks();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Credenciales incorrectas.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      setTasks([]);
      showMessage('Sesión cerrada.', 'info');
    } catch (err) {
      showMessage('Error al cerrar sesión', 'error');
    }
  };

  // --- GESTIÓN DE TAREAS ---
  const saveTask = async (e) => {
    e.preventDefault();
    
    // Validación de cliente antes de enviar
    if (!taskForm.title.trim()) {
      return showMessage('Error: El título de la tarea es obligatorio y no puede estar vacío.', 'error');
    }
    if (taskForm.title.length > 80) {
      return showMessage('Error: El título no puede exceder los 80 caracteres.', 'error');
    }
    if (taskForm.description.length > 500) {
      return showMessage('Error: La descripción no puede exceder los 500 caracteres.', 'error');
    }

    const payloadData = {
      title: taskForm.title,
      description: taskForm.description,
      status: taskForm.status
    };
    
    try {
      if (taskForm.id) {
        // Editar: enviamos el ID por la URL, pero al body solo el payloadData
        const { data } = await api.patch(`/tasks/${taskForm.id}`, payloadData);
        setTasks(tasks.map(t => t.id === taskForm.id ? data.task : t));
        showMessage('Tarea actualizada correctamente.', 'success');
      } else {
        // Crear: enviamos solo el payloadData
        const { data } = await api.post('/tasks', payloadData);
        setTasks([data.task, ...tasks]);
        showMessage('Tarea añadida correctamente.', 'success');
      }
      
      setTaskForm({ id: null, title: '', description: '', status: 'Pendiente' });
      
      if (filter !== 'Todas' && taskForm.status !== filter) {
        fetchTasks(filter);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.errors?.join(', ') || err.response?.data?.error || 'Error al guardar';
      showMessage(`Fallo de validación: ${errorMsg}`, 'error');
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(tasks.filter(t => t.id !== id));
      showMessage('Tarea eliminada de forma permanente.', 'info');
    } catch (err) {
      showMessage('Error al eliminar tarea', 'error');
    }
  };

  const editTask = (task) => {
    setTaskForm({ id: task.id, title: task.title, description: task.description, status: task.status });
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Llevar a la zona de edición
  };

  // --- RENDERIZADO CONDICIONAL: LOGIN ---
  if (!user) {
    return (
      <div style={{ padding: '2rem', maxWidth: '400px', margin: 'auto', fontFamily: 'sans-serif' }}>
        <h2>Gestor de Tareas</h2>
        <p>¡Bienvenido! Por favor, identifícate.</p>
        
        {message.text && (
          <div style={{ padding: '10px', marginBottom: '10px', backgroundColor: message.type === 'error' ? '#ffebee' : '#e8f5e9', color: message.type === 'error' ? '#c62828' : '#2e7d32', border: '1px solid currentColor', borderRadius: '4px' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" name="username" placeholder="Usuario" required />
          <input type="password" name="password" placeholder="Contraseña" required />
          <button type="submit">Iniciar Sesión</button>
        </form>
      </div>
    );
  }

  // --- RENDERIZADO CONDICIONAL: PANEL PRINCIPAL ---
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: 'auto', fontFamily: 'sans-serif' }}>
  
      {/* Barra superior con MEJORA: Contador de tareas pendientes */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Gestor de Tareas</h2>
          <small style={{ color: 'green' }}>● Conectado como: {user.username}</small>
          <br />
          <span style={{ backgroundColor: '#ff9800', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8em', fontWeight: 'bold', display: 'inline-block', marginTop: '5px' }}>
            Tareas pendientes: {tasks.filter(t => t.status === 'Pendiente').length}
          </span>
        </div>
        <button onClick={handleLogout}>Cerrar Sesión</button>
      </header>

      {/* Zona de Notificaciones */}
      {message.text && (
        <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: message.type === 'error' ? '#ffebee' : '#e3f2fd', color: message.type === 'error' ? '#c62828' : '#1565c0', border: '1px solid currentColor', borderRadius: '4px', transition: 'all 0.3s' }}>
          {message.text}
        </div>
      )}

      {/* Formulario Crear/Editar */}
      <section style={{ backgroundColor: taskForm.id ? '#fff3e0' : '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: taskForm.id ? '1px solid #ffb74d' : '1px solid #ddd' }}>
        <h3>{taskForm.id ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
        <form onSubmit={saveTask} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Título de la tarea (obligatorio, máx 80)" 
            maxLength={80}
            value={taskForm.title} 
            onChange={e => setTaskForm({...taskForm, title: e.target.value})} 
          />
          <textarea 
            placeholder="Descripción (opcional, máx 500)" 
            maxLength={500}
            rows={3}
            value={taskForm.description} 
            onChange={e => setTaskForm({...taskForm, description: e.target.value})} 
          />
          <select value={taskForm.status} onChange={e => setTaskForm({...taskForm, status: e.target.value})}>
            <option value="Pendiente">Pendiente</option>
            <option value="En progreso">En progreso</option>
            <option value="Completada">Completada</option>
          </select>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ backgroundColor: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Guardar Tarea
            </button>
            {taskForm.id && (
              <button type="button" onClick={() => setTaskForm({ id: null, title: '', description: '', status: 'Pendiente' })}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Filtros */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        {['Todas', 'Pendiente', 'En progreso', 'Completada'].map(f => (
          <button 
            key={f} 
            onClick={() => fetchTasks(f)}
            style={{ fontWeight: filter === f ? 'bold' : 'normal', backgroundColor: filter === f ? '#e0e0e0' : 'white', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Vista general de Tareas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tasks.length === 0 ? <p>No hay tareas que mostrar.</p> : null}
        {tasks.map(task => (
          <div key={task.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', borderLeft: task.status === 'Completada' ? '5px solid #4caf50' : task.status === 'En progreso' ? '5px solid #ff9800' : '5px solid #9e9e9e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0' }}>{task.title}</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.9em', color: '#555' }}>{task.description}</p>
                <small style={{ backgroundColor: '#eee', padding: '2px 6px', borderRadius: '4px' }}>{task.status}</small>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => editTask(task)}>Editar</button>
                <button onClick={() => deleteTask(task.id)} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}