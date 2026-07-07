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
      const supId = this.getSupervisorId();
      if (supId) {
        query = query.eq('supervisor_id', supId);
      }
      
      // Filtrar por Ruta en lugar de agent_id
      let assignedRouteId = currentUser.routeId;
      
      if (!assignedRouteId) {
        // Fallback: Buscar en la tabla de rutas si el agente está asignado allí
        const { data: routes } = await supabase.from('routes').select('id, agentUsername').eq('supervisor_id', supId || currentUser.username);
        if (routes) {
          const myRoute = routes.find(r => r.agentUsername && r.agentUsername.split(',').map(u => u.trim()).includes(currentUser.username));
          if (myRoute) {
            assignedRouteId = myRoute.id;
          }
        }
      }

      if (assignedRouteId) {
        query = query.eq('routeId', assignedRouteId);
      } else {
        // Si no tiene ruta asignada, no mostramos clientes para no mezclar datos
        return [];
      }
    } else {
      // Supervisor o Comercio
      const supId = this.getSupervisorId();
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
      return 'ERROR: El correo, cédula, teléfono o dirección ya está registrado en la base de datos. Por favor, verifica los datos.';
    }
    
    return null;
  },

  async saveClient(client) {
    console.log('[DEBUG DB] saveClient - Preparando inserción de cliente en Supabase:', client);
    const currentUser = this.getCurrentUser();
    if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente')) {
      const agentId = currentUser.id || currentUser.username;
      // Forzar que el cliente tome el agent_id del usuario actual para evitar registros huérfanos
      client.agent_id = agentId;
    }
    try {
      const supabase = await initSupabase();
      const supId = this.getSupervisorId();
      if (supId && !client.supervisor_id) {
        client.supervisor_id = supId;
      }
      console.log('[DEBUG DB] saveClient - Conectando a Supabase e insertando...');
      let { data, error } = await supabase
        .from('clients')
        .insert([client])
        .select();

      if (error && (error.message.includes('product_name') || error.message.includes('product_category') || error.code === '42703')) {
        console.warn("Columnas de producto no encontradas en Supabase, reintentando sin ellas...");
        const fallbackClient = { ...client };
        delete fallbackClient.product_name;
        delete fallbackClient.product_category;

        const retryResult = await supabase
          .from('clients')
          .insert([fallbackClient])
          .select();

        if (retryResult.error) {
          console.error("[DEBUG DB ERROR] Error en reintento de saveClient:", retryResult.error);
          throw retryResult.error;
        }
        data = retryResult.data;
        error = null;
      } else if (error) {
        console.error("[DEBUG DB ERROR] Error devuelto por Supabase al registrar cliente:", error);
        throw error;
      }

      console.log('[DEBUG DB] saveClient - Registro exitoso. Datos devueltos:', data);
      return data ? data[0] : client;
    } catch (err) {
      console.error("[DEBUG DB ERROR] Excepción atrapada en saveClient:", err);
      throw err;
    }
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

  async updateClientOutstanding(cedula, amountPaid) {
    const supabase = await initSupabase();
    const client = await this.getGlobalClientByCedula(cedula);
    if (client) {
      const currentUser = this.getCurrentUser();
      const newOutstanding = Math.max(0, Number(client.outstanding) - Number(amountPaid));
      
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
    const supId = this.getSupervisorId();
    if (!supId) return [];
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('supervisor_id', supId);
    if (error) {
      console.error("Error al obtener pagos en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getPaymentsByClient(cedula) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return [];
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('clientCedula', String(cedula))
      .eq('supervisor_id', supId);
    if (error) {
      console.error(`Error al obtener pagos del cliente "${cedula}":`, error);
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
    // Obtener total de pagos históricos del cliente para calcular el correlativo de cuota
    const clientPayments = await this.getPaymentsByClient(payment.clientCedula);
    const installmentNumber = payment.installmentNumber || (clientPayments.length + 1);
    
    const signature = `BulaPay-SIG-${payment.clientCedula}-${Date.now().toString().slice(-4)}`;
    const id = 'pay_' + installmentNumber + '_' + Date.now();
    
    const supId = this.getSupervisorId();
    
    const newPayment = {
      id: id,
      clientCedula: String(payment.clientCedula),
      installmentNumber: installmentNumber,
      amount: Number(payment.amount),
      date: payment.date || new Date().toISOString().split('T')[0],
      agentName: payment.agentName,
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

    // 2. Actualizar saldo pendiente del cliente
    await this.updateClientOutstanding(payment.clientCedula, payment.amount);

    // 3. Registrar abono a la ruta del cliente
    if (client && client.routeId) {
      await this.updateRouteCollected(client.routeId, payment.amount);
    }
    
    // Dispatch custom event to notify supervisor SPA in real-time
    window.dispatchEvent(new CustomEvent('bulapay-payment-registered'));

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
    if (payments) {
      payments.forEach(p => {
        if (p.amount > 0 && p.status !== 'No Pago') {
          paidInstallments.add(Number(p.installmentNumber));
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
      
      const currentUser = this.getCurrentUser();
      const isIndependent = currentUser && currentUser.role === 'Agente Independiente';
      
      if (isSunday) continue; // Saltar domingos siempre

      
      const dayNum = validDaysCounter + 1; // Cuota 1, 2, 3...
      const hasPaid = paidInstallments.has(dayNum);
      
      const year = currentDayDate.getFullYear();
      const month = String(currentDayDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDayDate.getDate()).padStart(2, '0');
      const dayStr = `${year}-${month}-${day}`;
      
      const isPastDay = currentDayDate < todayZero;
      const isOverdue = isPastDay && !hasPaid;
      const isFuture = currentDayDate > todayZero;
      
      const todayYear = todayZero.getFullYear();
      const todayMonth = String(todayZero.getMonth() + 1).padStart(2, '0');
      const todayDay = String(todayZero.getDate()).padStart(2, '0');
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      
      dailyStatus.push({
        dayNumber: dayNum,
        dateStr: dayStr,
        isToday: dayStr === todayStr,
        hasPaid: hasPaid,
        isOverdue: isOverdue,
        isFuture: isFuture
      });
      
      validDaysCounter++;
    }
    
    return dailyStatus;
  },

  renderOverdueDaysList(container, dailyStatus, onClickCallback = null) {
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

      if (onClickCallback && !status.hasPaid && !status.isFuture) {
        badge.style.cursor = 'pointer';
        badge.title = 'Clic para marcar como pagado';
        badge.addEventListener('click', () => {
          onClickCallback(status);
        });
        badge.addEventListener('mouseenter', () => badge.style.transform = 'scale(1.08)');
        badge.addEventListener('mouseleave', () => badge.style.transform = 'scale(1)');
      } else if (status.isFuture) {
        badge.title = 'Día futuro (No se puede marcar aún)';
      }
      
      const dateLabel = status.dateStr.slice(5); // MM-DD
      
      if (status.hasPaid) {
        badge.style.backgroundColor = 'var(--color-verde-bg)';
        badge.style.color = 'var(--color-verde)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.innerHTML = `<span>Día ${status.dayNumber}</span><span style="font-size: 0.6rem; opacity: 0.85; font-weight: 500;">${dateLabel}</span><span style="font-size: 0.55rem; font-weight: 700; margin-top: 0.15rem;">✔ Pagado</span>`;
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
      
      const todayStr = new Date().toISOString().split('T')[0];
      const currentUser = this.getCurrentUser();
      if (!currentUser) return { totalCollected: 0, totalLent: 0, totalIn: 0, totalOut: 0, onHand: 0 };
      
      // Cobrado hoy
      const todaysPayments = payments.filter(p => {
         const isToday = p.date && p.date.startsWith(todayStr);
         const isMine = p.supervisor_id === currentUser.username || p.agentName === currentUser.name;
         return isToday && isMine;
      });
      const totalCollected = todaysPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      
      // Prestado hoy (clientes nuevos hoy)
      const todaysClients = clients.filter(c => {
         const isToday = c.created_at && c.created_at.startsWith(todayStr);
         return isToday && c.agent_id === (currentUser.id || currentUser.username);
      });
      const totalLent = todaysClients.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      
      // Movimientos de caja
      const todaysMovements = movements.filter(m => m.date === todayStr);
      const totalIn = todaysMovements.filter(m => m.type === 'entrada').reduce((acc, m) => acc + Number(m.amount), 0);
      const totalOut = todaysMovements.filter(m => m.type === 'salida').reduce((acc, m) => acc + Number(m.amount), 0);
      
      const onHand = totalCollected - totalLent + totalIn - totalOut;
      return { totalCollected, totalLent, totalIn, totalOut, onHand };
    } catch (e) {
      console.error('Error calculando caja diaria:', e);
      return { totalCollected: 0, totalLent: 0, totalIn: 0, totalOut: 0, onHand: 0 };
    }
  }
};

// Inicializar el cliente Supabase de manera diferida
db.init();

// Exportar globalmente
window.BulaPayDB = db;
