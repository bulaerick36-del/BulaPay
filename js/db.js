// Módulo de Base de Datos Real de Supabase (BulaPay DB)

const DB_KEYS = {
  CURRENT_USER: 'bulapay_current_user'
};

const SUPABASE_URL = 'https://vxvyiklzyfmfbrgwqgxv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gXixzFlqN8TgbAwq6BsgWQ_LFfhnU4X';

let supabaseInstance = null;

async function initSupabase() {
  if (supabaseInstance) return supabaseInstance;

  // Intentar cargar la configuración dinámica desde el endpoint de Vercel/Local
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      supabaseInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      return supabaseInstance;
    }
  } catch (e) {
    console.warn("Fallo al obtener configuración dinámica de Supabase, usando fallbacks:", e);
  }

  if (window.supabase) {
    supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("La librería de Supabase no está cargada en el objeto window.");
  }
  return supabaseInstance;
}

const db = {
  async init() {
    await initSupabase();
  },

  async reseed() {
    const supabase = await initSupabase();
    
    // Eliminar datos en cascada (siguiendo el orden de relaciones de llaves foráneas)
    await supabase.from('payments').delete().neq('id', '');
    await supabase.from('clients').delete().neq('cedula', '');
    
    // Para eliminar usuarios y rutas, primero desvinculamos routeId en users para evitar FK cycles
    await supabase.from('users').update({ routeId: null }).neq('username', '');
    await supabase.from('routes').delete().neq('id', '');
    await supabase.from('users').delete().neq('username', '');
    
    // Insertar Supervisores y Comercios Semilla
    const { error: usersErr } = await supabase.from('users').insert([
      { username: 'admin', password: '123', name: 'Carlos Mendoza', role: 'Usuario Supervisor', company: 'Logística Mendoza S.A.', city: 'Bogotá', zone: 'Chapinero / Norte', phone: '+57 315 123 4567', email: 'contacto@logisticamendoza.co', supervisor_id: 'admin' },
      { username: 'tienda', password: '123', name: 'Almacén La Esquina', role: 'Comercio Independiente', company: 'Almacén La Esquina', city: 'Bogotá', zone: 'Centro / Santa Fe', phone: '+57 318 987 6543', email: 'laesquina@gmail.com', supervisor_id: 'tienda' },
      { username: 'medellin_sup', password: '123', name: 'Inés Restrepo', role: 'Usuario Supervisor', company: 'Inversiones Antioquia', city: 'Medellín', zone: 'El Poblado / Laureles', phone: '+57 310 444 5566', email: 'contacto@inversionesantioquia.com', supervisor_id: 'medellin_sup' },
      { username: 'cali_sup', password: '123', name: 'Felipe Caicedo', role: 'Usuario Supervisor', company: 'CrediCali S.A.S.', city: 'Cali', zone: 'Oriente / Versalles', phone: '+57 312 888 9900', email: 'felipe.caicedo@credicali.com', supervisor_id: 'cali_sup' }
    ]);
    if (usersErr) console.error("Error al sembrar usuarios semilla:", usersErr);
    
    // Insertar Rutas Semilla
    const { error: routesErr } = await supabase.from('routes').insert([
      { id: 'route_1', name: 'Ruta Centro - Norte', agentUsername: 'agente1', agentName: 'Juan Pérez', capital: 500000, collected: 180000, status: 'En Ruta', date: '2026-06-18', supervisor_id: 'admin', opening_time: '06:00', closing_time: '18:00', has_extension: false },
      { id: 'route_2', name: 'Ruta Zona Sur', agentUsername: 'agente2', agentName: 'María López', capital: 300000, collected: 150000, status: 'Completado', date: '2026-06-18', supervisor_id: 'admin', opening_time: '06:00', closing_time: '18:00', has_extension: false }
    ]);
    if (routesErr) console.error("Error al sembrar rutas semilla:", routesErr);
    
    // Insertar Agentes de Ruta Semilla (que dependen de la ruta creada previamente)
    const { error: agentsErr } = await supabase.from('users').insert([
      { username: 'agente1', password: '123', name: 'Juan Pérez', role: 'Agente de Ruta', supervisor: 'admin', routeId: 'route_1', supervisor_id: 'admin' },
      { username: 'agente2', password: '123', name: 'María López', role: 'Agente de Ruta', supervisor: 'admin', routeId: 'route_2', supervisor_id: 'admin' }
    ]);
    if (agentsErr) console.error("Error al sembrar agentes semilla:", agentsErr);
    
    // Insertar Clientes Semilla
    const { error: clientsErr } = await supabase.from('clients').insert([
      { cedula: '12345', name: 'Roberto Gómez', phone: '3115551234', email: 'roberto.gomez@gmail.com', city: 'Bogotá', zone: 'Centro', risk: 'Verde', totalDebt: 500000, outstanding: 150000, installmentsCount: 5, installmentAmount: 100000, routeId: 'route_1', supervisor_id: 'admin' },
      { cedula: '67890', name: 'Ana María Silva', phone: '3125556789', email: 'ana.silva@outlook.com', city: 'Bogotá', zone: 'Norte', risk: 'Amarillo', totalDebt: 400000, outstanding: 240000, installmentsCount: 5, installmentAmount: 80000, routeId: 'route_1', supervisor_id: 'admin' },
      { cedula: '11223', name: 'Pedro Pablo Restrepo', phone: '3105559988', email: 'pedro.restrepo@yahoo.com', city: 'Medellín', zone: 'Sur', risk: 'Rojo', totalDebt: 600000, outstanding: 450000, installmentsCount: 6, installmentAmount: 100000, routeId: 'route_2', supervisor_id: 'admin' }
    ]);
    if (clientsErr) console.error("Error al sembrar clientes semilla:", clientsErr);
    
    // Insertar Pagos Semilla
    const { error: paymentsErr } = await supabase.from('payments').insert([
      { id: 'pay_1', clientCedula: '12345', installmentNumber: 1, amount: 100000, date: '2026-06-01', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-12345-01', supervisor_id: 'admin' },
      { id: 'pay_2', clientCedula: '12345', installmentNumber: 2, amount: 100000, date: '2026-06-08', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-12345-02', supervisor_id: 'admin' },
      { id: 'pay_3', clientCedula: '12345', installmentNumber: 3, amount: 150000, date: '2026-06-15', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-12345-03', supervisor_id: 'admin' },
      { id: 'pay_4', clientCedula: '67890', installmentNumber: 1, amount: 80000, date: '2026-06-02', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-67890-01', supervisor_id: 'admin' },
      { id: 'pay_5', clientCedula: '67890', installmentNumber: 2, amount: 80000, date: '2026-06-12', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-67890-02', supervisor_id: 'admin' },
      { id: 'pay_6', clientCedula: '11223', installmentNumber: 1, amount: 100000, date: '2026-05-20', agentName: 'María López', status: 'Pagado', signature: 'BulaPay-SIG-11223-01', supervisor_id: 'admin' },
      { id: 'pay_7', clientCedula: '11223', installmentNumber: 2, amount: 50000, date: '2026-05-30', agentName: 'María López', status: 'Abonado', signature: 'BulaPay-SIG-11223-02', supervisor_id: 'admin' }
    ]);
    if (paymentsErr) console.error("Error al sembrar pagos semilla:", paymentsErr);

    localStorage.removeItem(DB_KEYS.CURRENT_USER);
  },

  // USERS
  async getUsers() {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return [];
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`supervisor_id.eq.${supId},username.eq.${supId}`);
    if (error) {
      console.error("Error al obtener usuarios en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async saveUser(user) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (supId && !user.supervisor_id) {
      user.supervisor_id = supId;
    }
    if ((user.role === 'Usuario Supervisor' || 
         user.role === 'Administrador de Rutas' || 
         user.role === 'Otros (Comercios, Compraventas, Mercados)' || 
         user.role === 'Agente Independiente') && !user.supervisor_id) {
      user.supervisor_id = user.username;
    }
    let { data, error } = await supabase
      .from('users')
      .insert([user])
      .select();

    if (error && (error.message.includes('representante_legal') || error.message.includes('cedula_representante') || error.code === '42703')) {
      console.warn("Columnas de representante no encontradas en Supabase, reintentando sin ellas...");
      const fallbackUser = { ...user };
      delete fallbackUser.representante_legal;
      delete fallbackUser.cedula_representante;
      
      const retryResult = await supabase
        .from('users')
        .insert([fallbackUser])
        .select();
      
      if (retryResult.error) {
        console.error("Error al guardar usuario en Supabase (reintento fallido):", retryResult.error);
        throw retryResult.error;
      }
      data = retryResult.data;
      error = null;
    } else if (error) {
      console.error("Error al guardar usuario en Supabase:", error);
      throw error;
    }

    return data ? data[0] : user;
  },

  async getUserByUsername(username) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    if (error) {
      console.error(`Error al buscar usuario "${username}" en Supabase:`, error);
      return null;
    }
    return data;
  },

  async deleteUser(username) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('username', username.toLowerCase());
    if (error) {
      console.error(`Error al eliminar usuario "${username}" en Supabase:`, error);
      throw error;
    }
  },

  // CURRENT SESSION
  getCurrentUser() {
    return JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER)) || null;
  },

  getSupervisorId() {
    const user = this.getCurrentUser();
    if (!user) return null;
    if (user.role === 'Agente de Ruta' || user.role === 'agent') {
      return user.supervisor || null;
    }
    return user.username;
  },

  async getActiveRouteIdForUser(user) {
    if (!user) return null;
    if (user.routeId) return user.routeId;
    
    try {
      const supabase = await initSupabase();
      const supId = this.getSupervisorId();
      let query = supabase.from('routes').select('id, agentUsername, supervisor_id');
      if (supId) {
        query = query.eq('supervisor_id', supId);
      }
      const { data: routes } = await query;
        
      if (routes && routes.length > 0) {
        const username = user.username || user.id;
        const myRoute = routes.find(r => 
          r.agentUsername && r.agentUsername.split(',').map(u => u.trim()).includes(username)
        );
        if (myRoute) {
          user.routeId = myRoute.id;
          this.setCurrentUser(user);
          return myRoute.id;
        }
      }
    } catch (e) {
      console.warn("Fallo al resolver ruta activa para el usuario:", e);
    }
    return null;
  },

  async getSupervisorIdForUser(user) {
    if (!user) return null;
    if (user.role === 'Usuario Supervisor' || user.role === 'supervisor' || user.role === 'Comercio Independiente' || user.role === 'Otros (Comercios, Compraventas, Mercados)') {
      return user.username;
    }
    if (user.supervisor) return user.supervisor;
    
    try {
      const supabase = await initSupabase();
      const { data } = await supabase
        .from('users')
        .select('supervisor, supervisor_id')
        .eq('username', user.username || user.id)
        .maybeSingle();
        
      if (data) {
        const sup = data.supervisor || data.supervisor_id;
        if (sup) {
          user.supervisor = sup;
          this.setCurrentUser(user);
          return sup;
        }
      }
    } catch (e) {
      console.warn("Fallo al resolver supervisor_id para el usuario:", e);
    }
    return this.getSupervisorId();
  },

  setCurrentUser(user) {
    localStorage.setItem(DB_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
  },

  // ROUTES
  async getRoutes() {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return [];
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('supervisor_id', supId);
    if (error) {
      console.error("Error al obtener rutas en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getRouteById(id) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return null;
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .eq('supervisor_id', supId)
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener ruta por ID "${id}":`, error);
      return null;
    }
    return data;
  },

  async saveRoute(route) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (supId) {
      route.supervisor_id = supId;
    }
    
    // Heredar horas de apertura/cierre de rutas existentes del supervisor para mantener consistencia
    try {
      const existingRoutes = await this.getRoutes();
      if (existingRoutes && existingRoutes.length > 0) {
        route.opening_time = existingRoutes[0].opening_time || '06:00';
        route.closing_time = existingRoutes[0].closing_time || '18:00';
      } else {
        route.opening_time = '06:00';
        route.closing_time = '18:00';
      }
    } catch (e) {
      console.warn("Error al heredar horario para nueva ruta:", e);
      route.opening_time = '06:00';
      route.closing_time = '18:00';
    }
    route.has_extension = false;

    const { data, error } = await supabase
      .from('routes')
      .insert([route])
      .select();
    if (error) {
      console.error("Error al crear ruta en Supabase:", error);
      throw error;
    }
    return data ? data[0] : route;
  },

  async updateRouteCapital(routeId, capitalAdd) {
    const supabase = await initSupabase();
    const route = await this.getRouteById(routeId);
    if (route) {
      const capitalActual = parseFloat(route.capital) || 0;
      const montoSeguro = parseFloat(capitalAdd) || 0;
      const newCapital = capitalActual + montoSeguro;
      const { error } = await supabase
        .from('routes')
        .update({ capital: newCapital })
        .eq('id', routeId);
      if (error) {
        console.error(`Error al actualizar capital de ruta "${routeId}":`, error);
        throw error;
      }
    }
  },

  async updateRouteCollected(routeId, collectedAdd) {
    const supabase = await initSupabase();
    const route = await this.getRouteById(routeId);
    if (route) {
      const newCollected = Number(route.collected) + Number(collectedAdd);
      const { error } = await supabase
        .from('routes')
        .update({ collected: newCollected })
        .eq('id', routeId);
      if (error) {
        console.error(`Error al actualizar recaudo de ruta "${routeId}":`, error);
        throw error;
      }
    }
  },

  async deleteRoute(routeId) {
    const supabase = await initSupabase();
    
    // 1. Eliminar agentes asignados a esta ruta
    const { error: userErr } = await supabase
      .from('users')
      .delete()
      .eq('routeId', routeId)
      .eq('role', 'Agente de Ruta');
    if (userErr) console.error("Error al eliminar agentes asociados a la ruta:", userErr);

    // 2. Desvincular clientes asignados a esta ruta
    const { error: clientErr } = await supabase
      .from('clients')
      .update({ routeId: null })
      .eq('routeId', routeId);
    if (clientErr) console.error("Error al desvincular clientes de la ruta:", clientErr);

    // 3. Eliminar la ruta en sí
    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', routeId);
    if (error) {
      console.error(`Error al eliminar ruta "${routeId}" en Supabase:`, error);
      throw error;
    }
  },

  async updateRouteAgents(routeId, agentUsernames, agentNames) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('routes')
      .update({ agentUsername: agentUsernames, agentName: agentNames })
      .eq('id', routeId);
    if (error) {
      console.error(`Error al actualizar agentes de la ruta "${routeId}" en Supabase:`, error);
      throw error;
    }
  },

  async updateRoutesSchedule(openingTime, closingTime, startDay, endDay) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return;

    // Serializar ambos valores como un JSON en la columna 'workingDays'
    const workingDaysJSON = JSON.stringify({ startDay, endDay });

    // Guardar fallback en localStorage
    localStorage.setItem(`workingDays_${supId}`, workingDaysJSON);

    try {
      const { error } = await supabase
        .from('routes')
        .update({ 
          opening_time: openingTime, 
          closing_time: closingTime, 
          workingDays: workingDaysJSON 
        })
        .eq('supervisor_id', supId);

      if (error) {
        console.error("Error al actualizar horario de rutas con workingDays:", error);
        // Si el error indica columna inexistente, reintentar sin ella
        if (error.code === 'PGRST204' || (error.message && (error.message.includes('column') || error.message.includes('does not exist')))) {
          console.warn("La columna 'workingDays' no existe en Supabase. Guardando solo horarios y usando localStorage como fallback.", error);
          const { error: retryError } = await supabase
            .from('routes')
            .update({ opening_time: openingTime, closing_time: closingTime })
            .eq('supervisor_id', supId);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    } catch (e) {
      console.error("Error detallado al actualizar horario de rutas en Supabase:", e);
      // Reintentar sin la columna workingDays en caso de cualquier error
      try {
        const { error: fallbackError } = await supabase
          .from('routes')
          .update({ opening_time: openingTime, closing_time: closingTime })
          .eq('supervisor_id', supId);
        if (fallbackError) throw fallbackError;
      } catch (err2) {
        console.error("Error en el fallback de actualización de horario:", err2);
        throw err2;
      }
    }
  },

  async toggleRouteExtension(routeId, hasExtension) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('routes')
      .update({ has_extension: hasExtension })
      .eq('id', routeId);
    if (error) {
      console.error(`Error al cambiar prórroga de la ruta "${routeId}":`, error);
      throw error;
    }
  },

  async getAgents() {
    const supabase = await initSupabase();
    
    // Intentar consultar la tabla 'agents' primero
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*');
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn("No se pudo consultar la tabla 'agents', usando fallback a 'users':", e);
    }

    // Fallback: Consultar la tabla 'users' filtrando por rol de Agente
    const supId = this.getSupervisorId();
    let query = supabase.from('users').select('*').in('role', ['Agente de Ruta', 'agent', 'Agente Independiente']);
    if (supId) {
      query = query.eq('supervisor_id', supId);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Error al obtener agentes en Supabase:", error);
      return [];
    }
    return data || [];
  },

  // CLIENTS
  async getClients() {
    const supabase = await initSupabase();
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];
    
    let query = supabase.from('clients').select('*');

    if (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente') {
      const supId = await this.getSupervisorIdForUser(currentUser);
      if (supId) {
        query = query.eq('supervisor_id', supId);
      }
      
      let assignedRouteId = currentUser.routeId;
      if (!assignedRouteId) {
        assignedRouteId = await this.getActiveRouteIdForUser(currentUser);
      }

      const agentId = currentUser.id || currentUser.username;
      if (assignedRouteId) {
        query = query.or(`routeId.eq.${assignedRouteId},agent_id.eq.${agentId}`);
      } else {
        query = query.eq('agent_id', agentId);
      }
    } else {
      // Supervisor o Comercio
      const supId = await this.getSupervisorIdForUser(currentUser);
      if (supId) {
        query = query.eq('supervisor_id', supId);
      } else {
        return [];
      }
    }

    const { data, error } = await query;
    console.log('Payload de Supabase en Seguimiento Diario (getClients):', data);
    
    if (error) {
      console.error("Error al obtener clientes en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getClientByCedula(cedula) {
    try {
      // Buscar solo dentro de los clientes que le pertenecen al agente/supervisor actual
      const clients = await this.getClients();
      const client = clients.find(c => String(c.cedula) === String(cedula));
      return client || null;
    } catch (err) {
      console.error(`Excepción en getClientByCedula para cédula "${cedula}":`, err);
      return null;
    }
  },

  async getGlobalClientByCedula(cedula) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('cedula', String(cedula))
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener cliente global por cédula "${cedula}":`, error);
      return null;
    }
    return data;
  },

  async getGlobalRouteById(routeId) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener ruta global "${routeId}":`, error);
      return null;
    }
    return data;
  },

  getClientDuplicationMessage(error) {
    if (!error) return null;
    
    const isUniqueViolation = error.code === '23505' || 
                              (error.message && error.message.includes('23505')) ||
                              (error.details && error.details.includes('already exists'));
                              
    if (isUniqueViolation) {
      // Ignorar restricciones únicas sobre teléfono o zona/dirección
      const isPhoneOrZoneOnly = (error.message && (error.message.includes('phone') || error.message.includes('zone'))) ||
                                (error.details && (error.details.includes('phone') || error.details.includes('zone')));
      if (!isPhoneOrZoneOnly) {
        return 'DUPLICATE_CEDULA';
      }
    }
    
    return null;
  },

  async saveClient(client) {
    console.log('[DEBUG DB] saveClient - Preparando inserción de cliente en Supabase:', client);
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const agentId = currentUser.id || currentUser.username;
      if (!client.agent_id) {
        client.agent_id = agentId;
      }
      if (!client.routeId) {
        client.routeId = await this.getActiveRouteIdForUser(currentUser);
      }
      if (!client.supervisor_id) {
        client.supervisor_id = await this.getSupervisorIdForUser(currentUser);
      }
    }
    try {
      const supabase = await initSupabase();
      
      // Verificación estricta de tipos de datos y redondeo a entero absoluto (Payload)
      client.amount = Math.round(Number(client.amount) || 0);
      client.discount_amount = Math.round(Number(client.discount_amount) || 0);
      client.totalDebt = Math.round(Number(client.totalDebt) || 0);
      client.outstanding = Math.round(Number(client.outstanding) || 0);
      client.installmentsCount = Math.round(Number(client.installmentsCount) || 1);
      client.installmentAmount = Math.round(Number(client.installmentAmount) || 0);
      
      // Limpiar undefined
      Object.keys(client).forEach(key => {
        if (client[key] === undefined) {
          client[key] = null;
        }
      });

      console.log('Paso 3: Iniciando petición a Supabase...', client);
      
      let { data, error } = await supabase
        .from('clients')
        .insert([client])
        .select();

      // Si falla debido a columnas adicionales no existentes en la tabla 'clients', reintentar con esquema esencial
      if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && (error.message.includes('column') || error.message.includes('schema cache'))))) {
        console.warn('Error de columna detectado. Reintentando inserción con payload esencial...', error);
        const essentialPayload = {
          cedula: client.cedula,
          name: client.name,
          phone: client.phone,
          email: client.email,
          city: client.city,
          zone: client.zone,
          risk: client.risk || 'Verde',
          totalDebt: client.totalDebt,
          outstanding: client.outstanding,
          installmentsCount: client.installmentsCount,
          installmentAmount: client.installmentAmount,
          routeId: client.routeId,
          agent_id: client.agent_id,
          supervisor_id: client.supervisor_id
        };
        const retryResult = await supabase
          .from('clients')
          .insert([essentialPayload])
          .select();
        data = retryResult.data;
        error = retryResult.error;
      }

      // Atrape estricto de errores de Supabase
      if (error) {
        console.error('Error de Supabase:', error);
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'Error en la Base de Datos',
            text: error.message + ' | Detalles: ' + JSON.stringify(error.details || 'Revisa la consola'),
            icon: 'error'
          });
        }
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Fallo Silencioso: La base de datos no retornó el cliente guardado. Posible bloqueo por políticas RLS en Supabase.');
      }

      console.log('[DEBUG DB] saveClient - Registro exitoso. Datos devueltos:', data);
      return data[0];
    } catch (err) {
      console.error('Error de ejecución en saveClient:', err);
      throw err;
    }
  },

  async forceUpdateExistingClient(payload) {
    const supabase = await initSupabase();
    try {
      // 1. Recuperar únicamente por cédula
      const { data: existing } = await supabase
        .from('clients')
        .select('cedula')
        .eq('cedula', String(payload.cedula))
        .limit(1);

      if (existing && existing.length > 0) {
        const clienteExistenteId = existing[0].cedula;
        const safeUpdatePayload = {
          name: payload.name,
          phone: payload.phone,
          city: payload.city,
          zone: payload.zone,
          amount: payload.amount,
          discount_amount: payload.discount_amount,
          discount_reason: payload.discount_reason,
          totalDebt: payload.totalDebt,
          outstanding: payload.outstanding,
          installmentsCount: payload.installmentsCount,
          installmentAmount: payload.installmentAmount,
          routeId: payload.routeId,
          agent_id: payload.agent_id,
          supervisor_id: payload.supervisor_id,
          risk: payload.risk,
          email: payload.email
        };

        const { data, error: updateErr } = await supabase
          .from('clients')
          .update(safeUpdatePayload)
          .eq('cedula', clienteExistenteId)
          .select();
        
        if (updateErr) throw updateErr;
        return { ...payload, cedula: clienteExistenteId };
      } else {
        return await this.saveClient(payload);
      }
    } catch (err) {
      console.error("[DEBUG DB ERROR] Fallo en forceUpdateExistingClient:", err);
      throw err;
    }
  },

  async registerCreditToExistingClient(payload) {
    const supabase = await initSupabase();
    
    // 1. Buscar únicamente por Cédula (los datos de contacto se pueden repetir libremente)
    const { data: existing, error: searchErr } = await supabase
      .from('clients')
      .select('cedula, name')
      .eq('cedula', String(payload.cedula))
      .limit(1);

    if (searchErr) console.error("Error buscando por cédula:", searchErr);

    const clientId = (existing && existing.length > 0) ? existing[0].cedula : String(payload.cedula);
    console.log('-> ID/Cédula del cliente recuperado:', clientId);
    console.log('-> Intentando registrar nuevo crédito para el cliente...');
    
    // 2. Registrar crédito secundario en tabla 'credits' si está configurada
    const creditPayload = {
      client_id: clientId,
      amount: payload.amount,
      discount_amount: payload.discount_amount,
      discount_reason: payload.discount_reason,
      totalDebt: payload.totalDebt,
      outstanding: payload.outstanding,
      installmentsCount: payload.installmentsCount,
      installmentAmount: payload.installmentAmount,
      routeId: payload.routeId,
      agent_id: payload.agent_id,
      supervisor_id: payload.supervisor_id,
      created_at: new Date().toISOString()
    };

    try {
      const { error: insertError } = await supabase.from('credits').insert([creditPayload]);
      if (insertError) {
        console.warn("Tabla 'credits' no disponible o no requerida:", insertError.message);
      }
    } catch (e) {
      console.warn("Omitiendo inserción secundaria en 'credits':", e.message);
    }

    // 3. Actualizar la información activa en la tabla 'clients' con el nuevo crédito/cartón
    await supabase.from('clients').update({
      name: payload.name,
      phone: payload.phone,
      city: payload.city,
      zone: payload.zone,
      amount: payload.amount,
      discount_amount: payload.discount_amount,
      discount_reason: payload.discount_reason,
      totalDebt: payload.totalDebt,
      outstanding: payload.outstanding,
      installmentsCount: payload.installmentsCount,
      installmentAmount: payload.installmentAmount,
      routeId: payload.routeId,
      agent_id: payload.agent_id,
      supervisor_id: payload.supervisor_id,
      risk: 'Verde',
      created_at: new Date().toISOString()
    }).eq('cedula', clientId);
    
    return { ...payload, cedula: clientId };
  },

  async getCommerceBuyers() {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('commerce_buyers')
      .select('*');
    if (error) {
      console.error("Error al obtener todos los compradores de comercio:", error);
      return [];
    }
    return data || [];
  },

  async getCommerceBuyerByCedula(cedula) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('commerce_buyers')
      .select('*')
      .eq('cedula', String(cedula))
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener comprador de comercio "${cedula}":`, error);
      return null;
    }
    return data;
  },

  async saveCommerceBuyer(buyer) {
    const supabase = await initSupabase();
    const payload = {
      name: buyer.name,
      cedula: String(buyer.cedula),
      email: buyer.email,
      phone: buyer.phone
    };
    const { data, error } = await supabase
      .from('commerce_buyers')
      .insert([payload])
      .select();
    if (error) {
      console.error("[DEBUG DB ERROR] Error al guardar comprador de comercio:", error);
      throw error;
    }
    return data ? data[0] : payload;
  },

  async updateClient(cedula, payload) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (supId && !payload.supervisor_id) {
      payload.supervisor_id = supId;
    }
    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('cedula', String(cedula))
      .select();
    if (error) {
      console.error("[DEBUG DB ERROR] Error al actualizar cliente:", error);
      throw error;
    }
    return data ? data[0] : payload;
  },

  async updateClientOutstanding(cedula, amountPaid) {
    const supabase = await initSupabase();
    const client = await this.getGlobalClientByCedula(cedula);
    if (client) {
      const currentUser = this.getCurrentUser();
      const newOutstanding = Math.max(0, Math.round(Number(client.outstanding || 0)) - Math.round(Number(amountPaid || 0)));
      
      // Actualizar el semáforo/riesgo del cliente basado en su saldo deudor pendiente
      let newRisk = client.risk;
      if (newOutstanding === 0) {
        newRisk = 'Verde'; // Se pone al día al cancelar crédito
      }

      const { error } = await supabase
        .from('clients')
        .update({ outstanding: newOutstanding, risk: newRisk })
        .eq('cedula', String(cedula));
      if (error) {
        console.error(`Error al actualizar saldo pendiente de cliente "${cedula}":`, error);
        throw error;
      }
    }
  },

  // PAYMENTS
  async getPayments() {
    const supabase = await initSupabase();
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];
    
    const supId = await this.getSupervisorIdForUser(currentUser);
    let query = supabase.from('payments').select('*');
    
    if (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente') {
      const agentId = currentUser.id || currentUser.username;
      const agentName = currentUser.name;
      if (supId) {
        query = query.eq('supervisor_id', supId);
      } else {
        query = query.or(`agent_id.eq.${agentId},agentName.eq.${agentName}`);
      }
    } else if (supId) {
      query = query.eq('supervisor_id', supId);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error("Error al obtener pagos en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getPaymentsByClient(cedula) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    let query = supabase.from('payments').select('*').eq('clientCedula', String(cedula));
    if (supId) {
      query = query.eq('supervisor_id', supId);
    }
    const { data, error } = await query;
    if (error) {
      console.error(`Error al obtener pagos del cliente "${cedula}":`, error);
      return [];
    }
    return data || [];
  },

  async getGlobalPaymentsByClient(cedula) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('clientCedula', String(cedula));
    if (error) {
      console.error(`Error al obtener pagos globales del cliente "${cedula}":`, error);
      return [];
    }
    return data || [];
  },

  async addPayment(payment) {
    const supabase = await initSupabase();
    
    const client = await this.getGlobalClientByCedula(payment.clientCedula);
    if (!client) {
      throw new Error("Cliente no encontrado.");
    }

    const currentUser = this.getCurrentUser();
    // currentUser ya fue declarado arriba
    const isIndependent = currentUser && currentUser.role === 'Agente Independiente';

    if (client.routeId && !isIndependent) {
      const { data: route, error: routeErr } = await supabase
        .from('routes')
        .select('*')
        .eq('id', client.routeId)
        .maybeSingle();

      if (routeErr) {
        console.error("Error al verificar horario de la ruta:", routeErr);
      } else if (route) {
        const now = new Date();
        const isOpen = this.isRouteOpen(route, now);

        if (!isOpen) {
          throw new Error("Ruta Cerrada: No se permiten recaudos fuera del horario establecido.");
        }
      }
    }
    
    // Redondeo estricto a números enteros, sin decimales
    const amountPaid = Math.round(Number(payment.amount) || 0);

    // Obtener total de pagos históricos del cliente para calcular el correlativo de cuota
    const clientPayments = await this.getPaymentsByClient(payment.clientCedula);
    const installmentNumber = payment.installmentNumber || (clientPayments.length + 1);
    
    const signature = `BulaPay-SIG-${payment.clientCedula}-${Date.now().toString().slice(-4)}`;
    const id = 'pay_' + installmentNumber + '_' + Date.now();
    
    const supId = this.getSupervisorId();
    const now = new Date();
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const agentId = payment.agent_id || (currentUser ? (currentUser.id || currentUser.username) : null);
    const agentName = payment.agentName || (currentUser ? (currentUser.name || currentUser.username) : 'Sistema');
    
    const newPayment = {
      id: id,
      clientCedula: String(payment.clientCedula),
      installmentNumber: installmentNumber,
      amount: amountPaid,
      date: payment.date || localDateStr,
      agentName: agentName,
      agent_id: agentId,
      status: payment.status,
      signature: signature,
      supervisor_id: supId
    };

    // 1. Registrar pago
    const { data, error: payError } = await supabase
      .from('payments')
      .insert([newPayment])
      .select();
    if (payError) {
      console.error("Error al registrar pago en Supabase:", payError);
      throw payError;
    }

    // 2. Actualizar saldo pendiente del cliente (Redondeo estricto a números enteros)
    await this.updateClientOutstanding(payment.clientCedula, amountPaid);

    // 3. Registrar abono a la ruta del cliente (Redondeo estricto a números enteros)
    if (client && client.routeId) {
      await this.updateRouteCollected(client.routeId, amountPaid);
    }
    
    // Dispatch custom event to notify supervisor SPA & agent UI in real-time
    window.dispatchEvent(new CustomEvent('bulapay-payment-registered', { detail: newPayment }));

    return newPayment;
  },

  async updateUserProfile(username, updatedData) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('users')
      .update(updatedData)
      .eq('username', username)
      .select();
    if (error) {
      console.error(`Error al actualizar perfil de usuario "${username}":`, error);
      throw error;
    }
    return data && data[0] ? data[0] : null;
  },

  async updateUserPassword(username, newPassword) {
    const supabase = await initSupabase();
    
    // 1. Intentar actualizar en Supabase Auth
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) {
        console.warn("No se pudo actualizar Supabase Auth (probablemente no hay sesión de Auth activa):", authError.message);
        // Si el usuario usa Supabase Auth estrictamente, deberíamos lanzar el error, pero 
        // como BulaPay también tiene una tabla custom, dejamos que continúe a actualizarla.
      }
    } catch (e) {
      console.warn("Fallo al actualizar en Supabase Auth:", e);
    }
    
    // 2. Actualizar en la tabla personalizada 'users' de BulaPay
    const { error: dbError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('username', username.toLowerCase());
      
    if (dbError) {
      console.error(`Error al actualizar contraseña de usuario "${username}":`, dbError);
      throw new Error('No se pudo actualizar la contraseña en la base de datos.');
    }
  },

  async updateUserLocation(username, lat, lng) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('users')
      .update({
        last_lat: Number(lat),
        last_lng: Number(lng),
        last_location_time: new Date().toISOString()
      })
      .eq('username', username.toLowerCase());
    if (error) {
      console.warn(`Error al actualizar ubicación de usuario "${username}":`, error);
      throw error;
    }
  },

  isRouteOpen(route, dateObj = new Date()) {
    if (!route) return false;
    if (route.has_extension) return true; // La prórroga ignora el horario general
    
    // Validar hora
    const openingStr = route.opening_time || '06:00';
    const closingStr = route.closing_time || '18:00';
    
    const [openHrs, openMins] = openingStr.split(':').map(Number);
    const [closeHrs, closeMins] = closingStr.split(':').map(Number);
    
    const openingTime = new Date(dateObj);
    openingTime.setHours(openHrs, openMins, 0, 0);
    
    const closingTime = new Date(dateObj);
    closingTime.setHours(closeHrs, closeMins, 0, 0);
    
    const isTimeOpen = dateObj >= openingTime && dateObj < closingTime;
    if (!isTimeOpen) return false;

    // Validar día de la semana
    let workingDays = route.workingDays || 'Mon-Sat';
    
    const mapDaysToSpanish = {
      'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo',
      'Lunes': 'Lunes', 'Martes': 'Martes', 'Miércoles': 'Miércoles', 'Jueves': 'Jueves', 'Viernes': 'Viernes', 'Sábado': 'Sábado', 'Domingo': 'Domingo'
    };

    let startDay = 'Lunes';
    let endDay = 'Sábado';

    if (workingDays) {
      try {
        const parsed = JSON.parse(workingDays);
        if (parsed && parsed.startDay && parsed.endDay) {
          startDay = parsed.startDay;
          endDay = parsed.endDay;
        }
      } catch (e) {
        let parts = [];
        if (workingDays.includes('-')) {
          parts = workingDays.split('-');
        } else if (workingDays.includes(' a ')) {
          parts = workingDays.split(' a ');
        }
        if (parts.length === 2) {
          const s = parts[0].trim();
          const e = parts[1].trim();
          startDay = mapDaysToSpanish[s] || s;
          endDay = mapDaysToSpanish[e] || e;
        } else {
          const mapped = mapDaysToSpanish[workingDays.trim()];
          if (mapped) {
            startDay = mapped;
            endDay = mapped;
          }
        }
      }
    }

    const getDayIndex = (dayName) => {
      const normalized = dayName ? dayName.trim().toLowerCase() : '';
      const mapping = {
        'domingo': 0, 'sun': 0, 'dom': 0,
        'lunes': 1, 'mon': 1, 'lun': 1,
        'martes': 2, 'tue': 2, 'mar': 2,
        'miércoles': 3, 'miercoles': 3, 'wed': 3, 'mie': 3,
        'jueves': 4, 'thu': 4, 'jue': 4,
        'viernes': 5, 'fri': 5, 'vie': 5,
        'sábado': 6, 'sabado': 6, 'sat': 6, 'sab': 6
      };
      return mapping[normalized] !== undefined ? mapping[normalized] : -1;
    };

    const currentDayIdx = dateObj.getDay();
    const startIdx = getDayIndex(startDay);
    const endIdx = getDayIndex(endDay);

    if (startIdx === -1 || endIdx === -1) return true; // fallback por seguridad si los datos son inválidos

    if (startIdx <= endIdx) {
      return currentDayIdx >= startIdx && currentDayIdx <= endIdx;
    } else {
      // Cruzando fin de semana
      return currentDayIdx >= startIdx || currentDayIdx <= endIdx;
    }
  },

  getDailyPaymentStatus(client, payments) {
    if (!client) return [];
    
    const startDate = new Date(client.created_at || Date.now());
    const todayZero = new Date();
    todayZero.setHours(0,0,0,0);
    
    // Mapear pagos por número de cuota (concordancia exacta con el saldo pendiente)
    const paidInstallments = new Set();
    let maxPaymentDateStr = null;

    const pendingRecordsMap = new Map();

    if (payments) {
      payments.forEach(p => {
        if (p.amount > 0 && p.status !== 'No Pago' && p.status !== 'Pendiente') {
          paidInstallments.add(Number(p.installmentNumber));
          if (p.date) {
            if (!maxPaymentDateStr || p.date > maxPaymentDateStr) {
              maxPaymentDateStr = p.date;
            }
          }
        }
        if (p.status === 'Pendiente') {
          pendingRecordsMap.set(Number(p.installmentNumber), p.date);
        }
      });
    }

    const dailyStatus = [];
    const totalInstallments = client.installmentsCount || 30; // Mostrar todo el cartón
    
    let validDaysCounter = 0;
    let calendarDaysOffset = 0;
    
    while (validDaysCounter < totalInstallments) {
      const currentDayDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      currentDayDate.setDate(currentDayDate.getDate() + calendarDaysOffset);
      
      const isSunday = currentDayDate.getDay() === 0;
      calendarDaysOffset++;
      
      if (isSunday) continue; // Saltar domingos siempre

      const dayNum = validDaysCounter + 1; // Cuota 1, 2, 3...
      const hasPaid = paidInstallments.has(dayNum);
      
      const year = currentDayDate.getFullYear();
      const month = String(currentDayDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDayDate.getDate()).padStart(2, '0');
      let mathDateStr = `${year}-${month}-${day}`;
      
      let finalDateStr = mathDateStr;
      let finalDateObj = currentDayDate;

      // Usar la fecha explícita si existe en la base de datos ('Pendiente')
      if (pendingRecordsMap.has(dayNum)) {
        finalDateStr = pendingRecordsMap.get(dayNum);
        const parts = finalDateStr.split('-');
        if (parts.length === 3) {
          finalDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        }
      }

      const isPastDay = finalDateObj < todayZero;
      const isOverdue = isPastDay && !hasPaid;
      const isFuture = finalDateObj > todayZero;
      
      const todayYear = todayZero.getFullYear();
      const todayMonth = String(todayZero.getMonth() + 1).padStart(2, '0');
      const todayDay = String(todayZero.getDate()).padStart(2, '0');
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      
      dailyStatus.push({
        dayNumber: dayNum,
        dateStr: finalDateStr,
        isToday: finalDateStr === todayStr,
        hasPaid: hasPaid,
        isOverdue: isOverdue,
        isFuture: isFuture
      });
      
      validDaysCounter++;
    }
    
    return dailyStatus;
  },

  renderOverdueDaysList(container, dailyStatus, onClickCallback = null, selectedIds = []) {
    if (!container) return;
    container.innerHTML = '';
    
    if (!dailyStatus || dailyStatus.length === 0) {
      container.parentElement.style.display = 'none';
      return;
    }
    
    container.parentElement.style.display = 'flex';
    
    dailyStatus.forEach(status => {
      const badge = document.createElement('div');
      badge.style.display = 'inline-flex';
      badge.style.flexDirection = 'column';
      badge.style.alignItems = 'center';
      badge.style.padding = '0.35rem 0.5rem';
      badge.style.borderRadius = '6px';
      badge.style.fontSize = '0.7rem';
      badge.style.fontWeight = '600';
      badge.style.minWidth = '60px';
      badge.style.border = '1px solid';
      badge.style.textAlign = 'center';
      
      badge.style.transition = 'transform 0.1s ease';

      if (onClickCallback && !status.hasPaid) {
        badge.style.cursor = 'pointer';
        badge.title = status.isFuture ? 'Día futuro' : 'Clic para marcar como pagado';
        badge.addEventListener('click', () => {
          onClickCallback(status);
        });
        badge.addEventListener('mouseenter', () => badge.style.transform = 'scale(1.08)');
        badge.addEventListener('mouseleave', () => badge.style.transform = 'scale(1)');
      }
      
      const dateLabel = status.dateStr.slice(5); // MM-DD
      
      if (status.hasPaid) {
        badge.style.backgroundColor = 'var(--color-verde-bg)';
        badge.style.color = 'var(--color-verde)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.innerHTML = `<span>Día ${status.dayNumber}</span><span style="font-size: 0.6rem; opacity: 0.85; font-weight: 500;">${dateLabel}</span><span style="font-size: 0.55rem; font-weight: 700; margin-top: 0.15rem;">✔ Pagado</span>`;
      } else if (selectedIds && selectedIds.includes(status.dayNumber)) {
        badge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = 'var(--primary)';
        badge.style.borderColor = 'var(--primary)';
        badge.style.borderWidth = '2px';
        badge.innerHTML = `<span>Día ${status.dayNumber}</span><span style="font-size: 0.6rem; opacity: 0.85; font-weight: 500;">${dateLabel}</span><span style="font-size: 0.55rem; font-weight: 800; margin-top: 0.15rem;">✅ Sel.</span>`;
      } else if (status.isOverdue) {
        badge.style.backgroundColor = 'var(--color-rojo-bg)';
        badge.style.color = 'var(--color-rojo)';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        badge.innerHTML = `<span>Día ${status.dayNumber}</span><span style="font-size: 0.6rem; opacity: 0.85; font-weight: 500;">${dateLabel}</span><span style="font-size: 0.55rem; font-weight: 700; color: var(--color-rojo); margin-top: 0.15rem;">⚠️ Atrasada</span>`;
      } else {
        const bgHover = onClickCallback ? 'var(--bg-secondary)' : 'var(--bg-secondary)';
        badge.style.backgroundColor = bgHover;
        badge.style.color = status.isToday ? 'var(--text-primary)' : 'var(--text-secondary)';
        badge.style.borderColor = status.isToday ? 'var(--color-primary)' : 'var(--border-color)';
        const fontWeight = status.isToday ? '800' : '400';
        const labelStr = status.isToday ? 'Hoy (Cobrar)' : 'Pendiente';
        badge.innerHTML = `<span>Día ${status.dayNumber}</span><span style="font-size: 0.6rem; opacity: 0.85; font-weight: 500;">${dateLabel}</span><span style="font-size: 0.55rem; font-weight: ${fontWeight}; opacity: 0.9; margin-top: 0.15rem;">${labelStr}</span>`;
      }
      container.appendChild(badge);
    });
  },
  async getCapitalInjections(routeId) {
    try {
      const supabase = await initSupabase();
      let query = supabase.from('capital_injections').select('*');
      if (routeId) {
        query = query.eq('routeId', routeId);
      }
      const { data, error } = await query;
      if (error && error.code === '42P01') {
        console.warn('Tabla capital_injections no existe aún.');
        return [];
      }
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching capital injections:', err);
      return [];
    }
  },

  async injectCapital(routeId, agentId, amount) {
    const supabase = await initSupabase();
    const injection = {
      id: 'inj_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      routeId: routeId ? routeId : null,
      agent_id: agentId ? agentId : null,
      amount: Math.round(parseFloat(amount) || 0),
      date: new Date().toISOString().split('T')[0]
    };
    const { error } = await supabase.from('capital_injections').insert([injection]);
    if (error) {
      console.error('Error injecting capital DB:', error);
      throw error;
    }
    return true;
  },

  async getRealBaseCapital(routeId) {
    try {
      const currentUser = this.getCurrentUser();
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;

      // 1. Capital Inicial Inyectado Neto (Inyecciones + Entradas de caja - Salidas/Gastos de caja)
      const injections = await this.getCapitalInjections(routeId);
      let totalInjected = 0;
      for (const inj of injections) {
        const belongsToUser = routeId ? (inj.routeId === routeId) : (inj.agent_id === agentId);
        if (belongsToUser) totalInjected += Math.round(parseFloat(inj.amount) || 0);
      }

      const movements = await this.getCashMovements();
      let totalExpenses = 0;
      let totalAdditions = 0;
      for (const m of movements) {
        const belongsToUser = routeId ? (m.routeId === routeId) : (m.agent_id === agentId);
        if (belongsToUser) {
          if (m.type === 'salida') totalExpenses += Math.round(parseFloat(m.amount) || 0);
          if (m.type === 'entrada') totalAdditions += Math.round(parseFloat(m.amount) || 0);
        }
      }

      const capitalInyectadoNeto = Math.round(totalInjected + totalAdditions - totalExpenses);

      // 2. Suma de Descuentos/Seguros retenidos y Ganancias Reales de cartones liquidados
      const clients = await this.getClients();
      let totalDiscounts = 0;
      let totalGananciasLiquidadas = 0;

      const payments = await this.getPayments();
      const paymentsByClientMap = new Map();
      payments.forEach(p => {
        if (p.status !== 'Pendiente') {
          const ced = String(p.clientCedula);
          const currentSum = paymentsByClientMap.get(ced) || 0;
          paymentsByClientMap.set(ced, currentSum + Math.round(parseFloat(p.amount) || 0));
        }
      });

      clients.forEach(c => {
        const belongsToUser = routeId ? (c.routeId === routeId) : (c.agent_id === agentId || c.agentUsername === currentUser?.username);
        if (belongsToUser || !routeId) {
          // Seguros/retenciones cobrados
          const discount = Math.round(parseFloat(c.discount_amount || c.descuento || c.seguro) || 0);
          totalDiscounts += discount;

          // Ganancias reales de cartones liquidados por PAGO (excluyendo mora/lista negra)
          const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
          const isMoroso = c.risk === 'Rojo' || 
                           String(c.risk || '').trim().toLowerCase() === 'rojo' || 
                           rawStatus.includes('MORA') || 
                           rawStatus.includes('NEGRA');
          const isLiquidadoPagado = !isMoroso && (rawStatus.includes('LIQUIDADO') || rawStatus.includes('CANCELAD') || Number(c.outstanding || 0) === 0);

          if (isLiquidadoPagado) {
            const gananciaRegistrada = Number(c.liquidated_profit || c.ganancia_real || 0);
            if (gananciaRegistrada > 0) {
              totalGananciasLiquidadas += Math.round(gananciaRegistrada);
            } else {
              const cedula = String(c.cedula);
              const totalPagado = paymentsByClientMap.get(cedula) || 0;
              const capitalPrestadoOriginal = Math.round(Number(c.original_amount || c.amount || c.capital_prestado || 0));
              if (totalPagado > capitalPrestadoOriginal && capitalPrestadoOriginal > 0) {
                totalGananciasLiquidadas += (totalPagado - capitalPrestadoOriginal);
              }
            }
          }
        }
      });

      // PATRIMONIO = Inyecciones Netas + Seguros Retenidos + Ganancias de Cartones Liquidados
      // REGLA ESTRICTA: NUNCA se le resta el capital de préstamos activos.
      const patrimonio = Math.round(capitalInyectadoNeto + totalDiscounts + totalGananciasLiquidadas);
      return patrimonio;
    } catch (err) {
      console.error('Error fetching real base capital (Patrimonio):', err);
      return 0;
    }
  },

  async getDashboardFinancialMetrics(routeId) {
    try {
      // Consultar clientes de la ruta desde la tabla clients
      const clients = await this.getClients();

      let carteraEnCalle = 0; // Suma de outstanding ÚNICAMENTE de clientes ACTIVOS (NO Lista Negra) con saldo pendiente
      let posibleGanancia = 0; // Suma de ganancia esperada (totalDebt - amount) ÚNICAMENTE de clientes ACTIVOS con outstanding > 0

      clients.forEach(c => {
        const belongsToUser = routeId ? (c.routeId === routeId) : true;
        if (belongsToUser) {
          const outstanding = Math.round(Number(c.outstanding || c.saldo_restante || 0));
          const totalDebt = Math.round(Number(c.totalDebt || c.total_a_recaudar || c.monto_total || 0));
          const amount = Math.round(Number(c.amount || c.capital_prestado || c.monto_prestado || 0));
          const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
          const isMoroso = c.risk === 'Rojo' || 
                           String(c.risk || '').trim().toLowerCase() === 'rojo' || 
                           rawStatus.includes('MORA') || 
                           rawStatus.includes('NEGRA');

          // Regla: Si el cliente fue enviado a Lista Negra (isMoroso) o no tiene deuda activa (outstanding <= 0),
          // SE EXCLUYE por completo de Cartera en Calle y Posible Ganancia.
          if (!isMoroso && outstanding > 0) {
            carteraEnCalle += outstanding;
            const interesCredito = Math.max(0, totalDebt - amount);
            posibleGanancia += interesCredito;
          }
        }
      });

      return {
        carteraEnCalle: Math.round(carteraEnCalle),
        posibleGanancia: Math.round(posibleGanancia)
      };
    } catch (err) {
      console.error("Error al calcular métricas del Dashboard financiero:", err);
      return { carteraEnCalle: 0, posibleGanancia: 0 };
    }
  },

  async liquidateCredit({ cedula, status, outstanding }) {
    const supabase = await initSupabase();
    
    const isPaid = (status === 'Liquidado_Pagado' || status === 'Liquidado' || status === 'Cancelado' || status === 'CANCELADO');
    
    // 1. Obtener datos del cliente ANTES de resetear sus saldos numéricos
    let clientData = null;
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('cedula', String(cedula))
        .maybeSingle();
      clientData = data;
    } catch (e) {
      console.warn("No se pudo obtener datos previos del cliente:", e.message);
    }

    let gananciaReal = 0;
    let originalAmount = 0;

    // 2. Si el crédito fue liquidado/cancelado con pago, asegurar que TODAS sus cuotas queden en 'Pagado' en la tabla payments (sin tocar capital_injections)
    if (isPaid && clientData) {
      try {
        const totalDebt = Math.round(Number(clientData.totalDebt || clientData.monto_total || 0));
        originalAmount = Math.round(Number(clientData.amount || clientData.capital_prestado || 0));
        gananciaReal = Math.max(0, totalDebt - originalAmount);

        // Eliminar registros de cuotas pendientes previos para este cliente
        await supabase
          .from('payments')
          .delete()
          .eq('clientCedula', String(cedula))
          .eq('status', 'Pendiente');

        const installmentsCount = Number(clientData.installmentsCount || 30);
        const installmentAmount = Math.round(Number(clientData.installmentAmount || (installmentsCount > 0 ? totalDebt / installmentsCount : 0)));

        // Consultar pagos ya registrados para este cliente
        const existingPayments = await this.getGlobalPaymentsByClient(cedula);
        const existingMap = new Map();
        let currentPaidTotal = 0;

        existingPayments.forEach(p => {
          if (p.status !== 'Pendiente') {
            existingMap.set(Number(p.installmentNumber), p);
            currentPaidTotal += Math.round(Number(p.amount) || 0);
          }
        });

        // Generar registros de pagos para las cuotas faltantes
        const currentUser = this.getCurrentUser();
        const supId = this.getSupervisorId();
        const todayStr = new Date().toISOString().split('T')[0];
        const newPayments = [];

        let remainingDebt = Math.max(0, totalDebt - currentPaidTotal);

        const isMora = (status === 'Liquidado_Mora' || status === 'MOROSO' || status === 'Lista Negra');

        for (let i = 1; i <= installmentsCount; i++) {
          if (!existingMap.has(i)) {
            const paymentAmount = Math.min(installmentAmount, remainingDebt);
            remainingDebt -= paymentAmount;

            newPayments.push({
              id: 'pay_liq_' + i + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              clientCedula: String(cedula),
              installmentNumber: i,
              amount: paymentAmount > 0 ? paymentAmount : installmentAmount,
              date: todayStr,
              agentName: currentUser ? (currentUser.name || currentUser.username) : 'Sistema',
              agent_id: currentUser ? (currentUser.id || currentUser.username) : null,
              status: isMora ? 'Liquidado_Mora' : 'Pagado',
              signature: `BulaPay-SIG-${cedula}-LIQ-${i}`,
              supervisor_id: supId
            });
          }
        }

        if (newPayments.length > 0) {
          const { error: insErr } = await supabase.from('payments').insert(newPayments);
          if (insErr) console.error("Error al insertar cuotas pagadas en liquidación:", insErr);
        }
      } catch (errPay) {
        console.error("Error al asegurar cuotas en 'pagado' durante liquidación:", errPay);
      }
    }

    // 3. Resetear saldos numéricos a 0 en la tabla clients al liquidar (pagado o por mora)
    const isMora = (status === 'Liquidado_Mora' || status === 'MOROSO' || status === 'Lista Negra');

    const updatePayload = {
      risk: (isMora || status === 'Liquidado_Mora') ? 'Rojo' : 'Verde'
    };

    if (isPaid || isMora) {
      updatePayload.outstanding = 0;
      if (isPaid) {
        updatePayload.totalDebt = 0;
        updatePayload.amount = 0;
      }
    } else if (outstanding !== undefined) {
      updatePayload.outstanding = Math.round(Number(outstanding || 0));
    }

    const { error: clientErr } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('cedula', String(cedula));
      
    if (clientErr) {
      console.error("Error al liquidar cliente en Supabase:", clientErr);
      throw new Error(`Error Supabase: ${clientErr.message || clientErr.details || JSON.stringify(clientErr)}`);
    }

    // 4. Actualizar tabla credits si aplica
    try {
      await supabase
        .from('credits')
        .update({ 
          status: status, 
          outstanding: isPaid ? 0 : updatePayload.outstanding,
          totalDebt: isPaid ? 0 : (updatePayload.totalDebt || 0),
          amount: isPaid ? 0 : (updatePayload.amount || 0)
        })
        .or(`client_id.eq.${String(cedula)},clientCedula.eq.${String(cedula)}`);
    } catch (e) {
      console.warn("Tabla credits no disponible al liquidar crédito:", e.message);
    }
    
    return true;
  },

  async getLiquidCash(routeId) {
    try {
      const currentUser = this.getCurrentUser();
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;

      // 1. Mi Capital Base (Patrimonio)
      const baseCapital = Math.round(await this.getRealBaseCapital(routeId));

      // 2. Capital puro prestado en la calle de créditos ACTIVOS (sin intereses)
      const clients = await this.getClients();
      let capitalPrestadoActivos = 0;
      const activeClientCedulas = new Set();

      clients.forEach(c => {
        const belongsToUser = routeId ? (c.routeId === routeId) : (c.agent_id === agentId || c.agentUsername === currentUser?.username);
        if (belongsToUser || !routeId) {
          const outstanding = Math.round(Number(c.outstanding || 0));
          const rawStatus = String(c.status || c.estado || 'Activo').trim().toUpperCase();
          const isActivo = outstanding > 0 &&
                           (rawStatus === 'ACTIVO' || rawStatus === 'EN RUTA' || rawStatus === 'ACTIVA') &&
                           !rawStatus.includes('LIQUIDADO') && 
                           !rawStatus.includes('CANCELAD') && 
                           rawStatus !== 'MOROSO';

          if (isActivo) {
            const amountPuro = Math.round(Number(c.amount || c.capital_prestado || c.monto_prestado || 0));
            capitalPrestadoActivos += amountPuro;
            activeClientCedulas.add(String(c.cedula));
          }
        }
      });

      // 3. Cuotas diarias cobradas de cartones activos
      const payments = await this.getPayments();
      let cuotasCobradasActivos = 0;
      for (const p of payments) {
        if (p.status !== 'Pendiente' && activeClientCedulas.has(String(p.clientCedula))) {
          cuotasCobradasActivos += Math.round(parseFloat(p.amount) || 0);
        }
      }

      // REGLA ESTRICTA: Efectivo Disponible (Liquidez) = Mi Capital Base - Capital puro prestado activo + Cuotas cobradas activas
      const efectivoDisponible = Math.round(baseCapital - capitalPrestadoActivos + cuotasCobradasActivos);
      return efectivoDisponible;
    } catch (err) {
      console.error('Error fetching liquid cash (Liquidez):', err);
      return 0;
    }
  },

  async getCashMovements() {
    try {
      const supabase = await initSupabase();
      const currentUser = this.getCurrentUser();
      let query = supabase.from('caja_movimientos').select('*');
      
      if (currentUser && currentUser.role === 'Agente de Ruta') {
         query = query.eq('agent_id', currentUser.id || currentUser.username);
      }
      
      const { data, error } = await query;
      if (error && error.code === '42P01') {
        console.warn('Tabla caja_movimientos no existe aún.');
        return [];
      }
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching cash movements:', err);
      return [];
    }
  },

  async saveCashMovement(movement) {
    try {
      const supabase = await initSupabase();
      movement.amount = Math.round(parseFloat(movement.amount) || 0);
      const { data, error } = await supabase.from('caja_movimientos').insert([movement]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error saving cash movement:', err);
      return false;
    }
  },

  async getEfectivoEnCajaDia() {
    try {
      const payments = await this.getPayments();
      const clients = await this.getClients();
      const movements = await this.getCashMovements();
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const currentUser = this.getCurrentUser();
      if (!currentUser) return { baseCapital: 0, totalCollected: 0, totalLent: 0, totalDiscounts: 0, totalIn: 0, totalOut: 0, onHand: 0, massPaymentsTotal: 0 };
      
      // Capital Base (Patrimonio)
      const baseCapital = Math.round(await this.getRealBaseCapital(currentUser.routeId));

      const agentId = currentUser.id || currentUser.username;
      const agentNameLower = (currentUser.name || '').trim().toLowerCase();
      const supId = await this.getSupervisorIdForUser(currentUser);

      const getCleanDateStr = (raw) => {
        if (!raw) return '';
        const str = String(raw).trim();
        const datePart = str.split('T')[0].split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return datePart;
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      // Mapa/Set de cédulas de clientes en Lista Negra / Mora (risk === 'Rojo')
      const blacklistedCedulas = new Set(
        clients
          .filter(c => {
            const rawStatus = String(c.status || c.estado || '').toUpperCase();
            return c.risk === 'Rojo' || 
                   String(c.risk || '').trim().toLowerCase() === 'rojo' || 
                   rawStatus.includes('NEGRA') || 
                   rawStatus.includes('MORA');
          })
          .map(c => String(c.cedula))
      );

      // Cobrado hoy (EXCLUYENDO transacciones de clientes en Lista Negra o liquidaciones por mora)
      const todaysPayments = payments.filter(p => {
         if (!p.date) return false;
         const pDate = getCleanDateStr(p.date);
         const isToday = pDate === todayStr;
         
         const pAgentNameLower = (p.agentName || '').trim().toLowerCase();
         const isMine = (currentUser.role === 'Usuario Supervisor' || currentUser.role === 'supervisor')
            ? (p.supervisor_id === currentUser.username)
            : (
                p.agent_id === agentId || 
                p.agentUsername === currentUser.username || 
                (agentNameLower && pAgentNameLower === agentNameLower) ||
                (supId && p.supervisor_id === supId)
              );
         const isRealPayment = p.status !== 'Pendiente' && p.status !== 'No Pago';

         const pCedula = String(p.clientCedula || p.client_cedula || p.cedula || '');
         const isBlacklistedClient = blacklistedCedulas.has(pCedula);

         const pStatusUpper = String(p.status || '').toUpperCase();
         const isMoraPayment = pStatusUpper.includes('MORA') || 
                               pStatusUpper.includes('LIQUIDADO_MORA') || 
                               pStatusUpper.includes('NEGRA') ||
                               (p.id && String(p.id).startsWith('pay_liq_') && isBlacklistedClient);

         return isToday && isMine && isRealPayment && !isBlacklistedClient && !isMoraPayment;
      });
      
      const totalCollected = Math.round(todaysPayments.reduce((acc, p) => acc + Math.round(Number(p.amount) || 0), 0));
      const massPaymentsTotal = Math.round(todaysPayments.reduce((acc, p) => (p.is_mass_payment || (p.status && p.status.includes('Masivo'))) ? acc + Math.round(Number(p.amount) || 0) : acc, 0));
      
      // Prestado hoy
      const todaysClients = clients.filter(c => {
         if (!c.created_at && !c.date) return false;
         const cDate = getCleanDateStr(c.created_at || c.date);
         const isToday = cDate === todayStr;
         
         const belongsToAgent = (currentUser.role === 'Usuario Supervisor' || currentUser.role === 'supervisor')
            ? (c.supervisor_id === currentUser.username || c.agent_id === currentUser.username)
            : (
                c.agent_id === agentId || 
                c.agentUsername === currentUser.username || 
                (currentUser.routeId && c.routeId === currentUser.routeId) ||
                (supId && c.supervisor_id === supId)
              );
         return isToday && belongsToAgent;
      });

      let secondaryCreditsToday = [];
      try {
        const supabase = await initSupabase();
        let q = supabase.from('credits').select('*');
        if (currentUser.role === 'Usuario Supervisor' || currentUser.role === 'supervisor') {
          q = q.eq('supervisor_id', currentUser.username);
        } else if (currentUser.routeId) {
          q = q.eq('routeId', currentUser.routeId);
        } else {
          q = q.eq('agent_id', agentId);
        }
        const { data: creditsData } = await q;
        if (creditsData && creditsData.length > 0) {
          secondaryCreditsToday = creditsData.filter(c => {
            if (!c.created_at && !c.date) return false;
            const cDate = getCleanDateStr(c.created_at || c.date);
            return cDate === todayStr;
          });
        }
      } catch (e) {
        // credits table optional
      }

      let totalLent = Math.round(todaysClients.reduce((acc, c) => acc + Math.round(Number(c.amount) || 0), 0));
      let totalDiscounts = Math.round(todaysClients.reduce((acc, c) => acc + Math.round(Number(c.discount_amount) || 0), 0));

      if (secondaryCreditsToday.length > 0) {
        secondaryCreditsToday.forEach(sc => {
          const alreadyInClients = todaysClients.some(tc => String(tc.cedula) === String(sc.client_id));
          if (!alreadyInClients) {
            totalLent += Math.round(Number(sc.amount) || 0);
            totalDiscounts += Math.round(Number(sc.discount_amount) || 0);
          }
        });
      }

      // Movimientos de caja
      const todaysMovements = movements.filter(m => m.date && getCleanDateStr(m.date) === todayStr);
      const totalIn = Math.round(todaysMovements.filter(m => m.type === 'entrada').reduce((acc, m) => acc + Math.round(Number(m.amount) || 0), 0));
      const totalOut = Math.round(todaysMovements.filter(m => m.type === 'salida').reduce((acc, m) => acc + Math.round(Number(m.amount) || 0), 0));
      
      // Efectivo Disponible / Liquidez Diaria en Caja calculada dinámicamente según la nueva arquitectura
      const onHand = Math.round(await this.getLiquidCash(currentUser.routeId));

      return {
        baseCapital: Math.round(baseCapital),
        totalCollected: Math.round(totalCollected),
        totalLent: Math.round(totalLent),
        totalDiscounts: Math.round(totalDiscounts),
        totalIn: Math.round(totalIn),
        totalOut: Math.round(totalOut),
        onHand: Math.round(onHand),
        massPaymentsTotal: Math.round(massPaymentsTotal)
      };
    } catch (e) {
      console.error('Error calculando caja diaria:', e);
      return { baseCapital: 0, totalCollected: 0, totalLent: 0, totalDiscounts: 0, totalIn: 0, totalOut: 0, onHand: 0, massPaymentsTotal: 0 };
    }
  },

  async updatePendingInstallments(cedula, pendingCuotasArray) {
    const supabase = await initSupabase();
    // 1. Eliminar cuotas pendientes anteriores para evitar duplicados
    await supabase.from('payments').delete().eq('clientCedula', cedula).eq('status', 'Pendiente');
    
    // 2. Insertar las nuevas cuotas pendientes re-mapeadas
    if (!pendingCuotasArray || pendingCuotasArray.length === 0) return;
    
    const currentUser = this.getCurrentUser();
    const supId = this.getSupervisorId();
    
    const records = pendingCuotasArray.map(cuota => {
      return {
        id: 'pend_' + cuota.installmentNumber + '_' + Date.now() + Math.floor(Math.random()*1000),
        clientCedula: cedula,
        installmentNumber: cuota.installmentNumber,
        amount: cuota.amount,
        date: cuota.date,
        agentName: currentUser ? currentUser.name : 'Sistema',
        status: 'Pendiente',
        signature: 'N/A',
        supervisor_id: supId
      };
    });
    
    const { error } = await supabase.from('payments').insert(records);
    if (error) {
      console.error("Error al actualizar cuotas pendientes:", error);
      throw error;
    }
  },

  async shiftPendingDates(cedula) {
    const supabase = await initSupabase();
    
    // 1. Extraer Pendientes
    const { data: pendingInstallments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('clientCedula', String(cedula))
      .eq('status', 'Pendiente')
      .order('installmentNumber', { ascending: true });

    if (error) {
      console.error("Error al obtener cuotas pendientes:", error);
      throw error;
    }

    if (!pendingInstallments || pendingInstallments.length === 0) return;

    // 2. Calcular Fechas y 3. Iteración
    let nextDate = new Date();
    
    for (let i = 0; i < pendingInstallments.length; i++) {
      nextDate.setDate(nextDate.getDate() + 1);
      while (nextDate.getDay() === 0) { // Saltar domingos
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      pendingInstallments[i].date = `${yyyy}-${mm}-${dd}`;
    }

    // 4. Actualización Masiva (Upsert)
    const { error: upsertError } = await supabase
      .from('payments')
      .upsert(pendingInstallments);

    if (upsertError) {
      console.error("Error en upsert de cuotas pendientes:", upsertError);
      throw upsertError;
    }
  },

  async upsertPayments(paymentsArray) {
    const supabase = await initSupabase();
    const { data, error } = await supabase.from('payments').upsert(paymentsArray);
    if (error) {
      console.error("[DEBUG DB ERROR] Error en upsertPayments:", error);
      throw error;
    }
    return data;
  }
};

// Inicializar el cliente Supabase de manera diferida
db.init();

// Exportar globalmente
window.BulaPayDB = db;
