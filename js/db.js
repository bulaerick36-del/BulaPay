// Módulo de Base de Datos Real de Supabase (BulaPay DB)

const DB_KEYS = {
  CURRENT_USER: 'bulapay_current_user'
};

const SUPABASE_URL = 'https://vxvyiklzyfmfbrgwqgxv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gXixzFlqN8TgbAwq6BsgWQ_LFfhnU4X';

let supabaseInstance = null;

async function initSupabase() {
  if (supabaseInstance) return supabaseInstance;

  // 1. Inicialización directa de Supabase en el frontend (evita 404 a /api/config en hosting estático)
  if (window.supabase) {
    try {
      supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      if (supabaseInstance) return supabaseInstance;
    } catch(err) {
      console.warn("Error al inicializar cliente directo de Supabase:", err);
    }
  }

  // 2. Fallback opcional a /api/config sólo en entornos Node/Vercel
  const host = window.location.hostname || '';
  if (!host.includes('bulapay.online') && !host.includes('github.io')) {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
          supabaseInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
          return supabaseInstance;
        }
      }
    } catch (e) {}
  }

  return supabaseInstance;
}

const db = {
  async initSupabase() {
    return await initSupabase();
  },

  async init() {
    await initSupabase();
    // v121: Se desactiva el mapeo automático en cada carga para prevenir el error 'permission denied for sequence cartones_numero_carton_seq'
  },

  async mapExistingClientsToCartones() {
    try {
      const supabase = await initSupabase();
      // 1. Obtener clientes de la tabla 'clients'
      const { data: clients, error: clientsErr } = await supabase.from('clients').select('*');
      if (clientsErr || !clients || clients.length === 0) return;

      // 2. Obtener cartones existentes para no duplicar
      const { data: cartones, error: cartonesErr } = await supabase.from('cartones').select('*');
      const existingCartonsSet = new Set();
      if (!cartonesErr && cartones) {
        cartones.forEach(c => {
          if (c.cliente_id) existingCartonsSet.add(String(c.cliente_id).trim());
        });
      }

      // 3. Mapear cada cliente que aún no esté en la tabla 'cartones'
      const newCartones = [];
      for (const client of clients) {
        const cedula = String(client.cedula).trim();
        if (!existingCartonsSet.has(cedula)) {
          const amount = Number(client.amount || 0);
          const outstanding = Number(client.outstanding || 0);
          const totalDebt = Number(client.totalDebt || 0);
          newCartones.push({
            cliente_id: cedula,
            numero_carton: Math.floor(Date.now() % 100000000) + Math.floor(Math.random() * 1000),
            fecha_apertura: client.created_at || new Date().toISOString(),
            monto_prestado: amount > 0 ? amount : (totalDebt > 0 ? totalDebt : 0),
            estado: outstanding > 0 ? 'activo' : 'liquidado',
            total_debt: totalDebt,
            outstanding: outstanding,
            installments_count: Number(client.installmentsCount || 1),
            installment_amount: Number(client.installmentAmount || 0),
            discount_amount: Number(client.discount_amount || 0),
            discount_reason: client.discount_reason || null,
            net_cash: Math.max(0, amount - Number(client.discount_amount || 0)),
            route_id: client.routeId || null,
            agent_id: client.agent_id || null,
            supervisor_id: client.supervisor_id || null,
            created_at: client.created_at || new Date().toISOString()
          });
        }
      }

      if (newCartones.length > 0) {
        console.log(`[MIGRACIÓN] Mapeando ${newCartones.length} préstamos actuales a la tabla 'cartones'...`);
        const { error: insertErr } = await supabase.from('cartones').insert(newCartones);
        if (insertErr) {
          console.warn("[MIGRACIÓN] Aviso al mapear a 'cartones':", insertErr.message);
        } else {
          console.log("✅ [MIGRACIÓN] Mapeo a 'cartones' completado con éxito.");
        }
      }
    } catch (e) {
      console.warn("Tabla cartones no disponible para mapeo automático:", e.message);
    }
  },

  async getCartones() {
    try {
      const supabase = await initSupabase();
      const { data, error } = await supabase.from('cartones').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn("Error consultando la tabla cartones:", e.message);
      return [];
    }
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
      .or(`supervisor_id.eq."${supId}",username.eq."${supId}"`);
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

    if (error && (error.message.includes('representante_legal') || error.message.includes('cedula_representante') || error.message.includes('aceptacion_terminos') || error.message.includes('nombre_firmante') || error.code === '42703')) {
      console.warn("Columnas adicionales no encontradas en Supabase, reintentando sin ellas...");
      const fallbackUser = { ...user };
      delete fallbackUser.representante_legal;
      delete fallbackUser.cedula_representante;
      delete fallbackUser.aceptacion_terminos;
      delete fallbackUser.fecha_aceptacion_terminos;
      delete fallbackUser.version_terminos;
      delete fallbackUser.nombre_firmante;
      delete fallbackUser.documento_firmante;
      delete fallbackUser.tipo_documento_firmante;
      delete fallbackUser.hash_firma_digital;
      
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
    if (!username) return null;
    try {
      const cleanInput = String(username).trim();
      const supabase = await initSupabase();

      // 1. Buscar en la tabla 'users' de Supabase por nombre de usuario (sin importar mayúsculas/minúsculas)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', cleanInput);

      if (!error && data && data.length > 0) {
        return data[0];
      }

      // 2. Búsqueda alternativa por número de documento o correo electrónico
      const { data: dataAlt, error: errAlt } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq."${cleanInput}",documentNumber.eq."${cleanInput}",email.ilike."${cleanInput}"`);

      if (!errAlt && dataAlt && dataAlt.length > 0) {
        return dataAlt[0];
      }

      return null;
    } catch (e) {
      console.warn("Error consultando usuario por username en Supabase:", e);
      return null;
    }
  },

  async getAllUsers() {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error("Error al obtener todos los usuarios de Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getAllRoutes() {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error("Error al obtener todas las rutas de Supabase:", error);
      return [];
    }
    return data || [];
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
    try {
      return JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER)) || null;
    } catch(e) {
      console.warn("Acceso a localStorage bloqueado en getCurrentUser:", e);
      return null;
    }
  },

  getSupervisorId() {
    const user = this.getCurrentUser();
    if (!user) return null;
    // v108: Los agentes (incluido Agente Independiente) devuelven su supervisor real, no su username
    if (user.role === 'Agente de Ruta' || user.role === 'agent' || user.role === 'Agente Independiente') {
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
      let query = supabase.from('routes').select('*');
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
        .select('*')
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

  // CLIENTS & CARTONES JOIN (v113 SIMPLIFICADO)
  async loadActiveCredits(options = {}) {
    try {
      const supabase = await initSupabase();
      const currentUser = this.getCurrentUser();
      if (!currentUser) return [];

      // CONSULTA DIRECTA Y SIMPLE v113: Select * sin relaciones de llaves foráneas complejas (evita error PostgREST)
      const { data: cartonesData, error: cartonesErr } = await supabase
        .from('cartones')
        .select('*')
        .in('estado', ['activo', 'activo_por_renovacion']);

      if (cartonesErr) {
        console.error("Error al obtener cartones activos en Supabase:", cartonesErr);
      }

      // Pre-cargar mapa de la tabla clients para asociar nombres e información de contacto
      const clientsMap = new Map();
      try {
        const { data: rawClients } = await supabase.from('clients').select('*');
        if (rawClients) {
          rawClients.forEach(c => {
            if (c && c.cedula) clientsMap.set(String(c.cedula).trim(), c);
          });
        }
      } catch (eCl) {
        console.warn("Aviso cargando tabla clients para fallback:", eCl);
      }

      // Pre-cargar cédulas en Lista Negra para excluir automáticamente del listado de cobro activo (v124)
      const blacklistedCedulas = new Set();
      try {
        const { data: allCls } = await supabase.from('clients').select('*');
        if (allCls) {
          allCls.forEach(c => {
            const st = String(c.status || c.estado || '').trim().toUpperCase();
            const isLoss = st === 'LIQUIDADO_PERDIDA' || st === 'LIQUIDADO_MORA' || st === 'LISTA NEGRA' || st === 'CASTIGADO' || st === 'PERDIDA' || st === 'MOROSO' || (st.includes('PERDIDA') || st.includes('NEGRA') || st.includes('MORA') || st.includes('CASTIGADO'));
            if (isLoss) {
              if (c.cedula) blacklistedCedulas.add(String(c.cedula).trim());
              if (c.id) blacklistedCedulas.add(String(c.id).trim());
            }
          });
        }
        const { data: allCarts } = await supabase.from('cartones').select('*');
        if (allCarts) {
          allCarts.forEach(c => {
            const st = String(c.status || c.estado || '').trim().toUpperCase();
            const rawEst = String(c.estado || '').trim().toLowerCase();
            const isLoss = st === 'LIQUIDADO_PERDIDA' || st === 'LIQUIDADO_MORA' || st === 'LISTA NEGRA' || st === 'CASTIGADO' || st === 'PERDIDA' || st === 'MOROSO' || rawEst === 'liquidado_perdida' || rawEst === 'liquidado_mora';
            if (isLoss) {
              if (c.cliente_id) blacklistedCedulas.add(String(c.cliente_id).trim());
              if (c.client_id) blacklistedCedulas.add(String(c.client_id).trim());
            }
          });
        }
      } catch (eB) {
        console.warn("Aviso al obtener lista negra en loadActiveCredits:", eB);
      }

      const activeCreditsList = [];
      const cartones = cartonesData || [];

      cartones.forEach(carton => {
        const cedula = String(carton.cliente_id || carton.client_id || carton.cedula || '').trim();
        if (!cedula || blacklistedCedulas.has(cedula)) return;

        const joinedClient = (carton.clients && typeof carton.clients === 'object' && carton.clients.name)
          ? carton.clients
          : (clientsMap.get(cedula) || {});

        const montoPrestado = Number(carton.monto_prestado || (joinedClient ? joinedClient.amount : 0) || 0);
        const totalDebt = Number(carton.total_debt || carton.totalDebt || (joinedClient ? joinedClient.totalDebt : 0) || (montoPrestado ? Math.round(montoPrestado * 1.2) : 0));
        const outstanding = Number((carton.outstanding !== undefined && carton.outstanding !== null && carton.outstanding !== 0) ? carton.outstanding : (totalDebt || montoPrestado));
        const installmentsCount = Number(carton.installments_count || 1);
        const installmentAmount = Number(carton.installment_amount || (installmentsCount ? Math.round(totalDebt / installmentsCount) : 0));
        const discountAmount = Number(carton.discount_amount || 0);
        const netCash = Number(carton.net_cash || (montoPrestado - discountAmount));

        activeCreditsList.push({
          ...joinedClient,
          ...carton,
          cedula: cedula,
          cliente_id: cedula,
          client_id: cedula,
          name: joinedClient.name || carton.nombre_cliente || `Cliente ${cedula}`,
          phone: joinedClient.phone || '',
          email: joinedClient.email || '',
          city: joinedClient.city || '',
          zone: joinedClient.zone || '',
          risk: joinedClient.risk || 'Verde',
          monto_prestado: montoPrestado,
          amount: montoPrestado,
          total_debt: totalDebt,
          totalDebt: totalDebt,
          outstanding: outstanding,
          installments_count: installmentsCount,
          installmentsCount: installmentsCount,
          installment_amount: installmentAmount,
          installmentAmount: installmentAmount,
          discount_amount: discountAmount,
          discount_reason: carton.discount_reason || null,
          net_cash: netCash,
          estado: 'activo',
          status: 'Activo',
          routeId: carton.route_id || joinedClient.routeId || null,
          agent_id: carton.agent_id || joinedClient.agent_id || null,
          supervisor_id: carton.supervisor_id || joinedClient.supervisor_id || null,
          carton_id: carton.id,
          numero_carton: carton.numero_carton,
          fecha_apertura: carton.fecha_apertura || carton.fecha_inicio || carton.created_at || joinedClient.created_at,
          created_at: carton.fecha_apertura || carton.fecha_inicio || carton.created_at || joinedClient.created_at
        });
      });

      console.log('✅ [BulaPay DB] Cartones activos re-mapeados con clients (loadActiveCredits):', activeCreditsList);
      return activeCreditsList;
    } catch (err) {
      console.error("Excepción en loadActiveCredits:", err);
      return [];
    }
  },

  async getClients() {
    return await this.loadActiveCredits();
  },

  async getClientByCedula(cedula) {
    try {
      const activeCredits = await this.loadActiveCredits();
      const activeCredit = activeCredits.find(c => String(c.cedula).trim() === String(cedula).trim());
      if (activeCredit) return activeCredit;

      // Si no hay un cartón activo para esa cédula, consultar clients y reportar "Sin deuda activa"
      const globalClient = await this.getGlobalClientByCedula(cedula);
      if (globalClient) {
        return globalClient;
      }
      return null;
    } catch (err) {
      console.error(`Excepción en getClientByCedula para cédula "${cedula}":`, err);
      return null;
    }
  },

  async getActiveCartonByClient(cedula) {
    try {
      const supabase = await initSupabase();
      const cedStr = String(cedula).trim();
      const { data, error } = await supabase
        .from('cartones')
        .select('*')
        .eq('cliente_id', cedStr)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Error al obtener cartón activo para cédula "${cedula}":`, error);
        return null;
      }
      return (data && data.length > 0) ? data[0] : null;
    } catch (err) {
      console.error(`Excepción en getActiveCartonByClient para cédula "${cedula}":`, err);
      return null;
    }
  },

  async getGlobalClientByCedula(cedula) {
    const supabase = await initSupabase();
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('cedula', String(cedula))
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener cliente global por cédula "${cedula}":`, error);
      return null;
    }
    if (!client) return null;

    // Verificar cartón activo en la tabla 'cartones'
    try {
      const { data: carton } = await supabase
        .from('cartones')
        .select('*')
        .eq('cliente_id', String(cedula))
        .in('estado', ['activo', 'activo_por_renovacion'])
        .maybeSingle();

      if (carton) {
        return {
          ...client,
          ...carton,
          carton_id: carton.id,
          cedula: client.cedula,
          name: client.name || client.nombre || `Cliente ${client.cedula}`,
          amount: Number(carton.monto_prestado || 0),
          monto_prestado: Number(carton.monto_prestado || 0),
          totalDebt: Number(carton.total_debt || 0),
          total_debt: Number(carton.total_debt || 0),
          outstanding: Number(carton.outstanding || 0),
          installmentsCount: Number(carton.installments_count || 1),
          installmentAmount: Number(carton.installment_amount || 0),
          status: 'Activo',
          estado: 'activo'
        };
      } else {
        const rawSt = String(client.status || client.estado || '').toUpperCase();
        const isLoss = rawSt.includes('PERDIDA') || rawSt.includes('MORA') || rawSt.includes('NEGRA') || client.risk === 'Rojo';
        let moraDebt = Number(client.totalToPay || client.totalDebt || client.monto_total || client.total_debt || 0);

        if (isLoss) {
          try {
            const cedStr = String(client.cedula).trim();
            const { data: lostCartons } = await supabase
              .from('cartones')
              .select('*')
              .eq('cliente_id', cedStr);
            
            let lc = lostCartons ? lostCartons.find(c => {
              const st = String(c.estado || c.status || '').toLowerCase();
              return st.includes('perdida') || st.includes('mora') || st.includes('castigado');
            }) : null;

            if (!lc) {
              const { data: lostCartons2 } = await supabase
                .from('cartones')
                .select('*')
                .eq('client_id', cedStr);
              if (lostCartons2) {
                lc = lostCartons2.find(c => {
                  const st = String(c.estado || c.status || '').toLowerCase();
                  return st.includes('perdida') || st.includes('mora') || st.includes('castigado');
                }) || lostCartons2[0];
              }
            }

            if (lc) {
              const cDebt = Number(
                lc.total_debt || 
                lc.totalDebt || 
                lc.monto_total || 
                (lc.monto_prestado ? Math.round(Number(lc.monto_prestado) * 1.2) : 0) || 
                (lc.amount ? Math.round(Number(lc.amount) * 1.2) : 0) || 
                0
              );
              if (cDebt > 0) moraDebt = cDebt;
            }
          } catch (eLC) {
            console.warn("Aviso al consultar cartones perdidos en getClientByCedula:", eLC);
          }

          if (moraDebt <= 0 && (client.monto_prestado || client.amount)) {
            moraDebt = Math.round(Number(client.monto_prestado || client.amount || 0) * 1.2);
          }
        }

        return {
          ...client,
          cedula: client.cedula,
          name: client.name || client.nombre || `Cliente ${client.cedula}`,
          outstanding: isLoss ? moraDebt : 0,
          moraDebt: moraDebt,
          totalDebt: isLoss ? moraDebt : 0,
          totalToPay: isLoss ? moraDebt : 0,
          amount: Number(client.amount || 0),
          installmentsCount: 1,
          installmentAmount: 0,
          status: isLoss ? 'liquidado_perdida' : (client.status || client.estado || 'Sin deuda activa'),
          estado: isLoss ? 'liquidado_perdida' : (client.estado || client.status || 'Sin deuda activa')
        };
      }
    } catch (eCarton) {
      return client;
    }
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
      const nowIso = new Date().toISOString();
      const newCartonUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('carton_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
      const newNumeroCarton = Math.floor(Date.now() % 100000000);
      const newCreditId = 'cred_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      
      const cedulaStr = String(client.cedula).trim();

      // 1. Inserción de datos personales limpios únicamente en la tabla 'clients' (sin mezcla con campos de crédito)
      const clientPayload = {
        cedula: cedulaStr,
        name: String(client.name || '').trim(),
        phone: String(client.phone || '').trim(),
        email: client.email ? String(client.email).trim() : null,
        city: client.city ? String(client.city).trim() : '',
        zone: client.zone ? String(client.zone).trim() : '',
        risk: client.risk || 'Verde',
        routeId: client.routeId || client.route_id || null,
        agent_id: client.agent_id || client.agentId || null,
        supervisor_id: client.supervisor_id || null
      };

      // Limpiar undefined
      Object.keys(clientPayload).forEach(key => {
        if (clientPayload[key] === undefined) {
          clientPayload[key] = null;
        }
      });

      console.log('Paso 1: Guardando cliente en Supabase (clients)...', clientPayload);
      
      let { data, error } = await supabase
        .from('clients')
        .insert([clientPayload])
        .select();

      // Si falla debido a esquema de columnas en 'clients', reintentar con esquema esencial
      if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && (error.message.includes('column') || error.message.includes('schema cache'))))) {
        console.warn('Reintentando inserción en clients con payload personal esencial...', error);
        const essentialPayload = {
          cedula: cedulaStr,
          name: String(client.name || '').trim(),
          phone: String(client.phone || '').trim(),
          email: client.email ? String(client.email).trim() : null,
          city: client.city ? String(client.city).trim() : '',
          zone: client.zone ? String(client.zone).trim() : '',
          risk: client.risk || 'Verde',
          agent_id: client.agent_id || null,
          supervisor_id: client.supervisor_id || null
        };
        const retryResult = await supabase
          .from('clients')
          .insert([essentialPayload])
          .select();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        console.error('Error de Supabase al insertar en clients:', error);
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
        data = [clientPayload];
      }

      console.log('✅ Paso 1 Exitoso: Cliente guardado en clients:', data[0]);
      
      // 2. Inserción inmediata del crédito inicial en la tabla 'cartones' vinculado por la cédula
      const montoPrestado = Math.round(Number(client.amount || client.monto_prestado || 0));
      const rolloverVal = Math.round(Number(client.rollover_amount || client.saldo_anterior || 0));
      const discountVal = Math.round(Number(client.discount_amount || client.descuento || 0));
      const isRenov = client.isRenewal || client.is_renewal || rolloverVal > 0;
      const cartonState = isRenov ? 'activo_por_renovacion' : 'activo';
      const newTotalDebt = Math.round(Number(client.totalDebt || client.monto_total || (montoPrestado ? montoPrestado * 1.2 : 0)));
      const newOutstanding = Math.round(Number(client.outstanding || newTotalDebt));
      const installmentsCount = Number(client.installmentsCount || client.installments_count || 30);
      const installmentAmount = Math.round(Number(client.installmentAmount || (installmentsCount > 0 ? newTotalDebt / installmentsCount : 0)));
      const netCashVal = Math.max(0, montoPrestado - discountVal - rolloverVal);

      try {
        const cartonPayload = {
          cliente_id: cedulaStr,
          numero_carton: newNumeroCarton,
          fecha_apertura: nowIso,
          monto_prestado: montoPrestado,
          estado: cartonState,
          saldo_anterior: rolloverVal,
          total_debt: newTotalDebt,
          outstanding: newOutstanding,
          installments_count: installmentsCount,
          installment_amount: installmentAmount,
          discount_amount: discountVal,
          net_cash: netCashVal,
          route_id: client.routeId || client.route_id || null,
          agent_id: client.agent_id || client.agentId || null,
          supervisor_id: client.supervisor_id || null,
          created_at: nowIso
        };

        let { data: cData, error: cErr } = await supabase.from('cartones').insert([cartonPayload]).select();
        
        if (cErr) {
          console.warn("⚠️ Advertencia al insertar cartón en 'cartones'. Reintentando con payload esencial...", cErr);
          const essentialCartonPayload = {
            cliente_id: cedulaStr,
            numero_carton: newNumeroCarton,
            fecha_apertura: nowIso,
            monto_prestado: montoPrestado,
            estado: cartonState,
            total_debt: newTotalDebt,
            outstanding: newOutstanding,
            installments_count: installmentsCount,
            installment_amount: installmentAmount,
            discount_amount: discountVal,
            net_cash: netCashVal
          };
          const retryRes = await supabase.from('cartones').insert([essentialCartonPayload]).select();
          if (retryRes.error) {
            console.error("❌ Error definitivo al insertar cartón en 'cartones':", retryRes.error);
          } else {
            if (retryRes.data && retryRes.data[0] && retryRes.data[0].id) {
              newCartonUuid = retryRes.data[0].id;
            }
            console.log("✅ Cartón esencial creado exitosamente en 'cartones' para cédula:", cedulaStr);
          }
        } else {
          if (cData && cData[0] && cData[0].id) {
            newCartonUuid = cData[0].id;
          }
          console.log("✅ Paso 2 Exitoso: Cartón completo creado en 'cartones' para cédula:", cedulaStr, cData);
        }
      } catch (eCarton) {
        console.error("Excepción al registrar cartón en 'cartones':", eCarton);
      }

      // 3. Generar y guardar las cuotas correspondientes (1..N en estado Pendiente) en la tabla 'payments'
      try {
        const todayStr = nowIso.split('T')[0];
        const supId = (typeof this.getSupervisorId === 'function') ? this.getSupervisorId() : (client.supervisor_id || null);
        const initialPendingPayments = [];

        for (let i = 1; i <= installmentsCount; i++) {
          initialPendingPayments.push({
            id: 'pay_init_' + i + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            clientCedula: cedulaStr,
            carton_id: newCartonUuid,
            credit_id: newCreditId,
            numero_carton: newNumeroCarton,
            installmentNumber: i,
            amount: installmentAmount,
            date: todayStr,
            agentName: client.agent_id || client.agentId || 'Sistema',
            agent_id: client.agent_id || client.agentId || null,
            status: 'Pendiente',
            liquidado: false,
            supervisor_id: supId,
            created_at: nowIso
          });
        }

        const { error: payErr } = await supabase.from('payments').insert(initialPendingPayments);
        if (payErr) {
          if (payErr.code === 'PGRST204' || (payErr.message && payErr.message.includes('liquidado'))) {
            initialPendingPayments.forEach(p => delete p.liquidado);
            await supabase.from('payments').insert(initialPendingPayments);
          } else {
            console.warn("⚠️ Advertencia al insertar cuotas iniciales en 'payments':", payErr);
          }
        } else {
          console.log(`✅ Paso 3 Exitoso: ${installmentsCount} cuotas registradas en 'payments' para el cartón:`, newCartonUuid);
        }
      } catch (ePay) {
        console.warn("Excepción al registrar cuotas pendientes iniciales:", ePay?.message);
      }

      return {
        ...(data[0] || clientPayload),
        amount: montoPrestado,
        monto_prestado: montoPrestado,
        totalDebt: newTotalDebt,
        total_debt: newTotalDebt,
        outstanding: newOutstanding,
        installmentsCount: installmentsCount,
        installments_count: installmentsCount,
        installmentAmount: installmentAmount,
        installment_amount: installmentAmount,
        discount_amount: discountVal,
        net_cash: netCashVal,
        carton_id: newCartonUuid,
        numero_carton: newNumeroCarton,
        credit_id: newCreditId,
        status: 'Activo',
        estado: cartonState
      };
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
        .select('*')
        .eq('cedula', String(payload.cedula))
        .limit(1);

      if (existing && existing.length > 0) {
        return await this.registerCreditToExistingClient(payload);
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
    
    // 1. Recuperar únicamente por Cédula (los datos de contacto se pueden repetir libremente)
    const { data: existing, error: searchErr } = await supabase
      .from('clients')
      .select('*')
      .eq('cedula', String(payload.cedula))
      .limit(1);

    if (searchErr) {
      console.error("Error buscando por cédula en registerCreditToExistingClient:", searchErr);
    }

    const clientId = (existing && existing.length > 0) ? String(existing[0].cedula) : String(payload.cedula);
    const nowIso = new Date().toISOString();
    let newCartonUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('carton_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
    const newCreditId = 'cred_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const newNumeroCarton = Math.floor(Date.now() % 100000000);

    console.log('-> ID/Cédula del cliente recuperado:', clientId);
    console.log('-> Generando nuevo crédito independiente ID:', newCreditId, 'Cartón UUID:', newCartonUuid);

    // 2. CIERRE CONTABLE DEL ANTERIOR: Marcar explícitamente los cartones anteriores como 'liquidado_por_renovacion' con outstanding: 0
    try {
      const cedStr = String(clientId).trim();
      const cartonUpdateOld = { 
        estado: 'liquidado_por_renovacion', 
        status: 'liquidado_por_renovacion',
        outstanding: 0,
        total_debt: 0,
        fecha_cierre: nowIso
      };

      await supabase.from('cartones').update(cartonUpdateOld).eq('cliente_id', cedStr).in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO', 'ACTIVO_POR_RENOVACION', 'Activo']);
      await supabase.from('cartones').update(cartonUpdateOld).eq('client_id', cedStr).in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO', 'ACTIVO_POR_RENOVACION', 'Activo']);
      await supabase.from('cartones').update(cartonUpdateOld).eq('cedula', cedStr).in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO', 'ACTIVO_POR_RENOVACION', 'Activo']);
      if (!isNaN(Number(cedStr))) {
        await supabase.from('cartones').update(cartonUpdateOld).eq('cliente_id', Number(cedStr)).in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO', 'ACTIVO_POR_RENOVACION', 'Activo']);
        await supabase.from('cartones').update(cartonUpdateOld).eq('client_id', Number(cedStr)).in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO', 'ACTIVO_POR_RENOVACION', 'Activo']);
        await supabase.from('cartones').update(cartonUpdateOld).eq('cedula', Number(cedStr)).in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO', 'ACTIVO_POR_RENOVACION', 'Activo']);
      }
    } catch (e) {
      console.warn("Aviso al cerrar cartones anteriores:", e.message);
    }
    
    // 3. CÁLCULO DE VALORES Y FLUJO NETO (Net Cash)
    const rolloverVal = Math.round(Number(payload.rollover_amount || payload.saldo_anterior || 0));
    const discountVal = Math.round(Number(payload.discount_amount || payload.descuento || 0));
    const isRenov = payload.isRenewal || payload.is_renewal || rolloverVal > 0;
    const newState = isRenov ? 'activo_por_renovacion' : 'activo';
    const newTotalDebt = Math.round(Number(payload.totalDebt || 0));
    const newMontoPrestado = Math.round(Number(payload.amount || payload.monto_prestado || 0));
    
    // Cálculo limpio del flujo neto (Net Cash: Capital Prestado menos Descuentos menos Rollover/Saldo Anterior)
    const netCashVal = Math.max(0, newMontoPrestado - discountVal - rolloverVal);

    // 4. REGISTRO 100% NUEVO: Registrar nuevo cartón independiente con validación estricta de respuesta de Supabase
    try {
      const cartonPayload = {
        cliente_id: String(clientId),
        numero_carton: newNumeroCarton,
        fecha_apertura: nowIso,
        monto_prestado: newMontoPrestado,
        estado: newState,
        saldo_anterior: rolloverVal,
        total_debt: newTotalDebt,
        outstanding: newTotalDebt, // Saldo inicial 100% igual a la nueva deuda total
        installments_count: Number(payload.installmentsCount || 30),
        installment_amount: Number(payload.installmentAmount || Math.round(newTotalDebt / (payload.installmentsCount || 30))),
        discount_amount: discountVal,
        net_cash: netCashVal,
        route_id: payload.routeId || payload.route_id || null,
        agent_id: payload.agent_id || payload.agentId || null,
        supervisor_id: payload.supervisor_id || null,
        created_at: nowIso
      };

      const { data: insertedCarton, error: cartonErr } = await supabase
        .from('cartones')
        .insert([cartonPayload])
        .select();

      if (cartonErr) {
        console.warn("⚠️ Error al insertar cartón completo en 'cartones'. Reintentando con payload esencial...", cartonErr);
        const essentialPayload = {
          cliente_id: String(clientId),
          numero_carton: newNumeroCarton,
          fecha_apertura: nowIso,
          monto_prestado: newMontoPrestado,
          estado: newState,
          total_debt: newTotalDebt,
          outstanding: newTotalDebt,
          installments_count: Number(payload.installmentsCount || 30),
          installment_amount: Number(payload.installmentAmount || Math.round(newTotalDebt / (payload.installmentsCount || 30))),
          discount_amount: discountVal,
          net_cash: netCashVal
        };

        const { data: retryData, error: retryErr } = await supabase
          .from('cartones')
          .insert([essentialPayload])
          .select();

        if (retryErr) {
          console.error("❌ Error definitivo al insertar nuevo cartón en 'cartones':", retryErr);
        } else if (retryData && retryData.length > 0 && retryData[0].id) {
          newCartonUuid = retryData[0].id;
          console.log("✅ Nuevo cartón esencial creado exitosamente con ID:", newCartonUuid);
        }
      } else if (insertedCarton && insertedCarton.length > 0 && insertedCarton[0].id) {
        newCartonUuid = insertedCarton[0].id;
        console.log("✅ Nuevo cartón (Renovación Atómica) registrado exitosamente con UUID:", newCartonUuid);
      }
    } catch (e) {
      console.error("Excepción al insertar nuevo cartón en 'cartones':", e);
    }

    // 5. ARCHIVADO DE CUOTAS PENDIENTES DEL CARTÓN ANTERIOR:
    // Marcar y archivar explícitamente las cuotas pendientes del cartón anterior como 'Liquidado_Por_Renovacion' y liquidado: true
    try {
      const archivePayload = { status: 'Liquidado_Por_Renovacion', liquidado: true };
      const { error: archErr } = await supabase.from('payments').update(archivePayload).eq('clientCedula', String(clientId)).eq('status', 'Pendiente');
      if (archErr) {
        delete archivePayload.liquidado;
        await supabase.from('payments').update(archivePayload).eq('clientCedula', String(clientId)).eq('status', 'Pendiente');
      }
    } catch (e) {
      console.warn("Aviso al archivar cuotas pendientes del cartón anterior:", e.message);
    }

    // 6. Actualizar únicamente la información de contacto/perfil del cliente en la tabla 'clients'
    const clientUpdatePayload = {
      name: payload.name || '',
      phone: payload.phone || '',
      email: payload.email || null,
      city: payload.city || '',
      zone: payload.zone || '',
      risk: payload.risk || 'Verde',
      routeId: payload.routeId || payload.route_id || null,
      agent_id: payload.agent_id || payload.agentId || null,
      supervisor_id: payload.supervisor_id || null
    };

    Object.keys(clientUpdatePayload).forEach(key => {
      if (clientUpdatePayload[key] === undefined) {
        clientUpdatePayload[key] = null;
      }
    });

    const { error: clientUpdateErr } = await supabase
      .from('clients')
      .update(clientUpdatePayload)
      .eq('cedula', clientId);

    if (clientUpdateErr) {
      console.error("❌ Error de Supabase al actualizar cliente en 'clients':", clientUpdateErr);
    } else {
      console.log("✅ Ficha del cliente actualizada exitosamente en 'clients' para cédula:", clientId);
    }

    // 7. Insertar los registros iniciales de las cuotas del nuevo cartón desvinculados del anterior (cuotas 1..N) con validación de error
    try {
      const installmentsCount = Number(payload.installmentsCount || 30);
      const installmentAmount = Math.round(Number(payload.installmentAmount || (newTotalDebt / installmentsCount)));
      const todayStr = nowIso.split('T')[0];
      const supId = (typeof this.getSupervisorId === 'function') ? this.getSupervisorId() : (payload.supervisor_id || null);
      const initialPendingPayments = [];

      for (let i = 1; i <= installmentsCount; i++) {
        initialPendingPayments.push({
          id: 'pay_init_' + i + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          clientCedula: String(clientId),
          carton_id: newCartonUuid,
          credit_id: newCreditId,
          numero_carton: newNumeroCarton,
          installmentNumber: i,
          amount: installmentAmount,
          date: todayStr,
          agentName: payload.agent_id || payload.agentId || 'Sistema',
          agent_id: payload.agent_id || payload.agentId || null,
          status: 'Pendiente',
          liquidado: false,
          supervisor_id: supId,
          created_at: nowIso
        });
      }

      const { error: payErr } = await supabase.from('payments').insert(initialPendingPayments);
      if (payErr) {
        if (payErr.code === 'PGRST204' || (payErr.message && payErr.message.includes('liquidado'))) {
          initialPendingPayments.forEach(p => delete p.liquidado);
          await supabase.from('payments').insert(initialPendingPayments);
        } else {
          console.warn("⚠️ Advertencia al insertar cuotas iniciales en 'payments':", payErr);
        }
      }
    } catch (e) {
      console.warn("Excepción al registrar cuotas pendientes iniciales:", e.message);
    }
    
    return { 
      ...payload, 
      cedula: clientId, 
      carton_id: newCartonUuid, 
      credit_id: newCreditId, 
      numero_carton: newNumeroCarton,
      monto_prestado: newMontoPrestado,
      amount: newMontoPrestado,
      discount_amount: discountVal,
      rollover_amount: rolloverVal,
      saldo_anterior: rolloverVal,
      net_cash: netCashVal,
      outstanding: newTotalDebt, 
      totalDebt: newTotalDebt, 
      created_at: nowIso 
    };
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
    if (payload) {
      delete payload.carton_id;
      delete payload.estado;
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
      const clientUpdatePayload = { outstanding: newOutstanding, risk: newRisk };
      if (newOutstanding === 0) {
        newRisk = 'Verde'; // Se pone al día al cancelar crédito
        clientUpdatePayload.risk = 'Verde';
        clientUpdatePayload.status = 'Liquidado_Pagado';
      }

      const { error } = await supabase
        .from('clients')
        .update(clientUpdatePayload)
        .eq('cedula', String(cedula));
         // Actualizar la tabla cartones en tiempo real para mantener sincronización total
      try {
        const cartonStateUpdate = { outstanding: newOutstanding };
        if (newOutstanding === 0) {
          cartonStateUpdate.estado = 'liquidado';
          cartonStateUpdate.status = 'Liquidado_Pagado';
        }
        await supabase
          .from('cartones')
          .update(cartonStateUpdate)
          .eq('cliente_id', String(cedula))
          .in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO']);
      } catch (eCarton) {
        console.warn(`Aviso actualizando saldo en cartón para "${cedula}":`, eCarton);
      }
    }
  },

  async checkAndHandleLastInstallment(client, onCompleteCallback) {
    if (!client) return false;
    const outstanding = Math.round(Number(client.outstanding || 0));
    if (outstanding <= 0) {
      const clientName = client.name || client.nombre || 'Cliente';
      const message = `¡Felicitaciones por pagar las cuotas exitosamente! BulaPay te invita a obtener un nuevo crédito.`;

      const executeLiquidation = async () => {
        try {
          await this.liquidateCredit({
            cedula: client.cedula || client.id,
            status: 'Liquidado_Pagado',
            outstanding: 0,
            cartonId: client.carton_id || client.id || null,
            numeroCarton: client.numero_carton || null
          });
          if (typeof onCompleteCallback === 'function') {
            await onCompleteCallback();
          }
        } catch (e) {
          console.error("Error al liquidar automáticamente cartón finalizado:", e);
        }
      };

      if (typeof window.BulaPayAgent !== 'undefined' && typeof window.BulaPayAgent.showSuccessLiquidationModal === 'function') {
        window.BulaPayAgent.showSuccessLiquidationModal(client, onCompleteCallback);
        return true;
      }

      if (typeof Swal !== 'undefined') {
        await Swal.fire({
          title: '🎉 ¡Felicitaciones!',
          text: message,
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#10b981',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(async (result) => {
          if (result.isConfirmed) {
            await executeLiquidation();
          }
        });
      } else {
        alert(message);
        await executeLiquidation();
      }
      return true;
    }
    return false;
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
      if (supId) {
        query = query.eq('supervisor_id', supId);
      } else if (agentId) {
        query = query.eq('agent_id', agentId);
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

  async syncCartonLiquidadoStates() {
    try {
      const supabase = await initSupabase();
      // 1. Cartón '04dc7d1e-6668-47c7-a6d1-a27a7c92c753' -> liquidado: true
      await supabase
        .from('payments')
        .update({ liquidado: true, status: 'Liquidado_Por_Renovacion' })
        .eq('carton_id', '04dc7d1e-6668-47c7-a6d1-a27a7c92c753');

      // 2. Cartón 'fe0e2ef4-cae7-4ab9-a924-d01a6f21a386' -> liquidado: false
      await supabase
        .from('payments')
        .update({ liquidado: false })
        .eq('carton_id', 'fe0e2ef4-cae7-4ab9-a924-d01a6f21a386');

      console.log("✅ Estados de la columna 'liquidado' sincronizados exitosamente.");
    } catch (e) {
      console.warn("Aviso al sincronizar columna liquidado:", e.message);
    }
  },

  async getPaymentsByClient(cedula, cartonId = null) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();

    const cedStr = String(typeof cedula === 'object' && cedula !== null ? (cedula.cedula || cedula.clientCedula || '') : (cedula || ''));
    let targetCartonId = cartonId || (typeof cedula === 'object' && cedula !== null ? (cedula.carton_id || cedula.id || null) : null);

    // Si no se proporcionó cartonId explícito, obtener el ID del cartón activo actual desde la tabla 'cartones'
    if (!targetCartonId && cedStr) {
      try {
        const { data: cartonData } = await supabase
          .from('cartones')
          .select('id')
          .eq('cliente_id', cedStr)
          .in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (cartonData && cartonData.length > 0 && cartonData[0].id) {
          targetCartonId = cartonData[0].id;
        }
      } catch (e) {
        console.warn("Aviso al consultar el cartón activo del cliente desde 'cartones':", e.message);
      }
    }

    let queryBase = supabase.from('payments').select('*').eq('clientCedula', cedStr);

    if (targetCartonId) {
      queryBase = queryBase.eq('carton_id', String(targetCartonId));
    }

    if (supId) {
      queryBase = queryBase.eq('supervisor_id', supId);
    }

    // Filtrar obligatoriamente por registros donde liquidado sea false o no verdaderos
    let queryWithLiquidado = queryBase.or('liquidado.is.null,liquidado.eq.false');

    let { data, error } = await queryWithLiquidado;
    if (error) {
      // Fallback transparente por si la columna 'liquidado' aún no está creada en Supabase
      const { data: fallbackData, error: fbErr } = await queryBase;
      if (fbErr) {
        console.error(`Error al obtener pagos del cliente "${cedStr}":`, fbErr);
        return [];
      }
      data = fallbackData;
    }

    // Filtro adicional en memoria por seguridad
    const filteredData = (data || []).filter(p => p.liquidado !== true && p.liquidado !== 'true');
    return filteredData;
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

    // Obtener cartón activo para vincular el pago e independizar cuotas de créditos anteriores
    const cartonId = payment.carton_id || client.carton_id || client.id || null;
    const cartonStartDate = client.fecha_apertura || client.created_at;
    const cartonStartTime = cartonStartDate ? new Date(cartonStartDate).getTime() : 0;

    const clientPayments = await this.getPaymentsByClient(payment.clientCedula);
    const activeCartonPayments = (clientPayments || []).filter(p => {
      const pStatus = String(p.status || '').toUpperCase();
      const isCanceled = pStatus.includes('CANCEL') || pStatus.includes('RECHAZ') || pStatus === 'NO PAGO' || pStatus === 'PENDIENTE';
      const isLiquidationRecord = (p.id && String(p.id).startsWith('pay_liq_')) || pStatus === 'LIQUIDADO_PAGADO' || pStatus === 'LIQUIDADO_MORA';
      if (isCanceled || isLiquidationRecord || !Number(p.amount)) return false;

      if (cartonId && p.carton_id) {
        return String(p.carton_id) === String(cartonId);
      }
      if (cartonStartTime > 0) {
        let pTime = 0;
        if (p.created_at) pTime = new Date(p.created_at).getTime();
        else if (p.date) pTime = new Date(String(p.date).trim().includes('T') ? String(p.date).trim() : String(p.date).trim() + 'T00:00:00').getTime();
        return pTime >= cartonStartTime - 2000;
      }
      return true;
    });

    const installmentNumber = payment.installmentNumber || (activeCartonPayments.length + 1);
    
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
      carton_id: cartonId,
      credit_id: payment.credit_id || client.credit_id || null,
      installmentNumber: installmentNumber,
      amount: amountPaid,
      date: payment.date || localDateStr,
      agentName: agentName,
      agent_id: agentId,
      status: payment.status || 'Pagado',
      liquidado: false,
      signature: signature,
      supervisor_id: supId,
      created_at: now.toISOString()
    };

    // 1. Registrar pago
    let { data, error: payError } = await supabase
      .from('payments')
      .insert([newPayment])
      .select();

    if (payError) {
      // Si falla porque la columna 'liquidado' aún no está creada, reintentar sin ella
      if (payError.code === 'PGRST204' || (payError.message && payError.message.includes('liquidado'))) {
        delete newPayment.liquidado;
        const retryRes = await supabase.from('payments').insert([newPayment]).select();
        if (retryRes.error) {
          console.error("Error al registrar pago en Supabase (retry):", retryRes.error);
          throw retryRes.error;
        }
      } else {
        console.error("Error al registrar pago en Supabase:", payError);
        throw payError;
      }
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
    
    const cartonDateStr = client.fecha_apertura || client.fecha_inicio || client.created_at;
    const startDate = cartonDateStr ? new Date(cartonDateStr) : new Date();
    const todayZero = new Date();
    todayZero.setHours(0,0,0,0);
    
    // Mapear pagos por número de cuota (concordancia exacta con el saldo pendiente)
    const paidInstallments = new Set();
    let maxPaymentDateStr = null;

    const pendingRecordsMap = new Map();

    if (payments) {
      const cartonId = client.carton_id || client.id || client.numero_carton;
      const clientCreatedTime = cartonDateStr ? new Date(cartonDateStr).getTime() : 0;
      payments.forEach(p => {
        let pTime = 0;
        if (p.created_at) {
          pTime = new Date(p.created_at).getTime();
        } else if (p.date) {
          const dStr = String(p.date).trim();
          pTime = new Date(dStr.includes('T') ? dStr : dStr + 'T00:00:00').getTime();
        }

        // Si el pago pertenece a un cartón anterior (diferente carton_id o marcado como liquidado: true), se excluye obligatoriamente
        let belongsToCurrentCarton = true;
        if (p.liquidado === true || p.liquidado === 'true') {
          belongsToCurrentCarton = false;
        } else if (p.carton_id && cartonId && String(p.carton_id).trim().toLowerCase() !== String(cartonId).trim().toLowerCase()) {
          belongsToCurrentCarton = false;
        } else if (!p.carton_id && clientCreatedTime > 0 && pTime > 0 && (clientCreatedTime - pTime > 2000)) {
          belongsToCurrentCarton = false;
        }

        const rawStatus = String(p.status || '').trim().toLowerCase();

        const isLiquidationRecord = (p.id && String(p.id).startsWith('pay_liq_')) || 
          rawStatus.includes('liquidado') || 
          rawStatus.includes('cancelado') || 
          rawStatus.includes('rechazado');

        const isPaidStatus = !isLiquidationRecord && (
          rawStatus.includes('pagado') || 
          rawStatus.includes('abonado') || 
          rawStatus.includes('completo') || 
          (Number(p.amount) > 0 && rawStatus !== 'no pago' && rawStatus !== 'pendiente')
        );

        if (isPaidStatus && belongsToCurrentCarton) {
          paidInstallments.add(Number(p.installmentNumber));
          if (p.date) {
            if (!maxPaymentDateStr || p.date > maxPaymentDateStr) {
              maxPaymentDateStr = p.date;
            }
          }
        }
        if (rawStatus === 'pendiente' && belongsToCurrentCarton) {
          pendingRecordsMap.set(Number(p.installmentNumber), p.date);
        }
      });
    }

    const dailyStatus = [];
    const totalInstallments = Number(client?.installmentsCount || client?.installments_count || 30); // Mostrar todo el cartón
    
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

  async injectCapital(routeId, agentId, amount, isWithdrawal = false) {
    const supabase = await initSupabase();
    let cleanAmount = Math.round(parseFloat(amount) || 0);
    if (isWithdrawal && cleanAmount > 0) {
      cleanAmount = -cleanAmount;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const injectionId = (isWithdrawal ? 'inj_ret_' : 'inj_') + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // ESQUEMA EXACTO SEGÚN SUPABASE TABLE EDITOR:
    // Columnas: id (text), routeId (text), agent_id (text), amount (numeric), date (date)
    const exactPayload = {
      id: injectionId,
      routeId: routeId ? String(routeId) : null,
      agent_id: agentId ? String(agentId) : null,
      amount: cleanAmount,
      date: todayStr
    };

    const { error } = await supabase.from('capital_injections').insert([exactPayload]);

    if (error) {
      console.error("Error directo al insertar en capital_injections:", error);
      throw error;
    }

    // Insert secundario en caja_movimientos para trazabilidad auditable
    try {
      await supabase.from('caja_movimientos').insert([{
        id: 'mov_' + injectionId,
        route_id: routeId ? String(routeId) : null,
        routeId: routeId ? String(routeId) : null,
        agent_id: agentId ? String(agentId) : null,
        type: isWithdrawal ? 'salida' : 'entrada',
        tipo: isWithdrawal ? 'salida' : 'entrada',
        amount: Math.abs(cleanAmount),
        monto: Math.abs(cleanAmount),
        concept: isWithdrawal ? 'Retiro de caja (Salida)' : 'Inyección de capital (Entrada)',
        concepto: isWithdrawal ? 'Retiro de caja (Salida)' : 'Inyección de capital (Entrada)',
        date: new Date().toISOString()
      }]);
    } catch (eMov) {
      console.warn("Omitiendo insert secundario en caja_movimientos:", eMov.message);
    }

    return true;
  },

  getRetainedFeesFromCredit(c) {
    if (!c) return 0;

    // 1. Buscar valores numéricos explícitos de segVal y papVal (o seguro/papelería/val_seguro)
    const segVal = Math.round(parseFloat(c.segVal || c.seguro || c.val_seguro) || 0);
    const papVal = Math.round(parseFloat(c.papVal || c.papeleria || c.val_papeleria || c.software) || 0);
    if (segVal > 0 || papVal > 0) {
      return segVal + papVal;
    }

    // 2. Buscar campo aislado de retained_fees / retained_amount
    const retainedFees = Math.round(parseFloat(c.retained_fees || c.retained_amount) || 0);
    if (retainedFees > 0) {
      return retainedFees;
    }

    // FALLBACK HISTÓRICO ESTRICTO:
    // Para cartones viejos de la base de datos con data mezclada, RETORNAR CERO (0).
    // Jamás leer discount_amount ni discount_reason para evitar inflar con refinanciaciones o saldos anteriores.
    return 0;
  },

  async getRealBaseCapital(routeId) {
    try {
      const currentUser = this.getCurrentUser();
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;

      // 1. Capital Inicial Inyectado Neto (Inyecciones deduplicadas + Entradas de caja - Salidas/Gastos de caja)
      const rawInjections = await this.getCapitalInjections(routeId);
      const uniqueInjectionsMap = new Map();
      rawInjections.forEach(inj => {
        if (inj) {
          const statusStr = String(inj.status || '').toLowerCase();
          if (statusStr.includes('rechaz') || statusStr.includes('cancel')) return;
          const injId = String(inj.id || (inj.routeId + '_' + inj.amount + '_' + inj.date));
          if (!uniqueInjectionsMap.has(injId)) uniqueInjectionsMap.set(injId, inj);
        }
      });
      const injections = Array.from(uniqueInjectionsMap.values());

      let totalInjected = 0;
      for (const inj of injections) {
        const belongsToUser = routeId ? (String(inj.routeId) === String(routeId)) : (String(inj.agent_id) === String(agentId));
        if (belongsToUser) totalInjected += Math.round(parseFloat(inj.amount) || 0);
      }

      // Solo si NO hay inyecciones registradas en la tabla capital_injections, usar route.capital como fallback
      if (injections.length === 0 && totalInjected === 0 && routeId) {
        const route = await this.getRouteById(routeId);
        if (route && route.capital) {
          totalInjected = Math.round(parseFloat(route.capital) || 0);
        }
      }

      const movements = await this.getCashMovements();
      let totalExpenses = 0;
      let totalAdditions = 0;
      for (const m of movements) {
        const belongsToUser = routeId ? (m.routeId === routeId) : (m.agent_id === agentId);
        if (belongsToUser) {
          if (m.type === 'salida') totalExpenses += Math.round(parseFloat(m.amount) || 0);
          if (m.type === 'entrada') {
            const concept = String(m.concept || m.concepto || m.description || '').toLowerCase();
            const idStr = String(m.id || '');
            const isInjection = concept.includes('inyecc') || concept.includes('inyección') || concept.includes('inyeccion') || concept.includes('capital') || idStr.startsWith('inj_') || (!concept && !m.description && !m.concepto);
            if (!isInjection) {
              totalAdditions += Math.round(parseFloat(m.amount) || 0);
            }
          }
        }
      }

      const capitalInyectadoNeto = Math.round(totalInjected + totalAdditions - totalExpenses);

      // 2. Obtener clientes de la tabla 'clients'
      const rawClients = await this.getClients();
      const clientsMap = new Map();
      rawClients.forEach(c => {
        if (c && c.cedula) {
          const ced = String(c.cedula).trim();
          if (!clientsMap.has(ced)) clientsMap.set(ced, c);
        }
      });

      // 3. Obtener cartones de la tabla 'cartones' (historial completo e independiente de la ruta/agente)
      let creditsList = [];
      try {
        const supabase = await initSupabase();
        let q = supabase.from('cartones').select('*');
        if (routeId) {
          q = q.eq('route_id', routeId);
        } else if (agentId) {
          q = q.eq('agent_id', agentId);
        }
        const { data: cartonesData } = await q;
        if (cartonesData && cartonesData.length > 0) {
          creditsList = cartonesData.map(c => ({
            ...c,
            cedula: c.cliente_id,
            client_id: c.cliente_id,
            clientCedula: c.cliente_id,
            amount: c.monto_prestado,
            totalDebt: c.total_debt,
            outstanding: c.outstanding,
            installmentsCount: c.installments_count,
            installmentAmount: c.installment_amount,
            discount_amount: c.discount_amount,
            fecha_apertura: c.fecha_apertura || c.fecha_inicio || c.created_at,
            created_at: c.fecha_apertura || c.fecha_inicio || c.created_at,
            status: c.estado === 'activo' ? 'Activo' : (c.estado === 'liquidado_mora' ? 'Liquidado_Mora' : 'Liquidado_Pagado')
          }));
        }
      } catch (e) {
        console.warn("Tabla cartones no disponible en getRealBaseCapital, usando clients:", e.message);
      }

      // Si no hay registros en 'cartones', usar la tabla 'clients'
      if (creditsList.length === 0) {
        creditsList = Array.from(clientsMap.values());
      } else {
        // Enriquecer cada crédito con los datos actuales del cliente en 'clients' (risk, status)
        creditsList = creditsList.map(c => {
          const ced = String(c.client_id || c.clientCedula || c.cedula || '').trim();
          const clientObj = clientsMap.get(ced);
          return {
            ...c,
            clientRisk: clientObj ? clientObj.risk : c.risk,
            clientStatus: clientObj ? clientObj.status : c.status,
            cedula: ced
          };
        });
      }

      let totalRetainedFees = 0;
      let totalGananciasLiquidadas = 0;
      let totalPerdidasMora = 0;

      const payments = await this.getPayments();
      const paymentsByClientMap = new Map();
      payments.forEach(p => {
        if (p.status !== 'Pendiente' && p.status !== 'No Pago' && String(p.status || '').toUpperCase() !== 'LIQUIDADO_MORA') {
          const ced = String(p.clientCedula || p.client_cedula || p.cedula || '').trim();
          const currentSum = paymentsByClientMap.get(ced) || 0;
          paymentsByClientMap.set(ced, currentSum + Math.round(parseFloat(p.amount) || 0));
        }
      });

      creditsList.forEach(c => {
        const belongsToUser = routeId ? (c.routeId === routeId) : (c.agent_id === agentId || c.agentUsername === currentUser?.username);
        if (belongsToUser || !routeId) {
          // A) Seguros/retenciones cobrados (INGRESOS RETENIDOS A FAVOR DEL NEGOCIO - NUNCA RESTAR)
          const retainedFee = this.getRetainedFeesFromCredit(c);
          totalRetainedFees += Math.round(retainedFee);

          const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
          const isExplicitMoraStatus = rawStatus.includes('MORA') || rawStatus.includes('NEGRA');
          const isCurrentClientMoroso = (Number(c.outstanding || 0) > 0 || !rawStatus.includes('LIQUIDADO')) && 
                                        (c.clientRisk === 'Rojo' || String(c.clientRisk || '').trim().toLowerCase() === 'rojo');

          const isMoroso = isExplicitMoraStatus || isCurrentClientMoroso;

          const cedula = String(c.client_id || c.clientCedula || c.cedula || '').trim();
          const totalPagado = paymentsByClientMap.get(cedula) || 0;
          const totalDebt = Math.round(Number(c.totalDebt || c.total_a_recaudar || c.monto_total || 0));
          const amountPuro = Math.round(Number(c.amount || c.capital_prestado || c.monto_prestado || 0));
          
          const capitalPrincipal = amountPuro > 0 ? amountPuro : (totalDebt > 0 ? Math.round(totalDebt / 1.2) : 0);

          if (isMoroso) {
            // REGLA CONTABLE v99: La pérdida por Lista Negra incluye el valor total del cartón con intereses (Capital + Intereses)
            const totalConIntereses = totalDebt > 0 ? totalDebt : (capitalPrincipal > 0 ? Math.round(capitalPrincipal * 1.2) : 0);
            const capitalPerdidoNeto = Math.max(0, totalConIntereses - totalPagado);
            totalPerdidasMora += capitalPerdidoNeto;
          } else {
            const isLiquidadoPagado = rawStatus === 'LIQUIDADO_PAGADO' || 
                                      rawStatus === 'PAGADO' || 
                                      rawStatus === 'PAGADO_TOTAL' ||
                                      (rawStatus.includes('LIQUIDADO') && !rawStatus.includes('MORA') && !rawStatus.includes('RENOVAC'));

            const isLiquidadoRenovacion = rawStatus.includes('RENOVAC') || rawStatus.includes('RENOVADO');

            if (isLiquidadoPagado) {
              const gananciaRegistrada = Number(c.liquidated_profit || c.ganancia_real || 0);
              if (gananciaRegistrada > 0) {
                totalGananciasLiquidadas += Math.round(gananciaRegistrada);
              } else if (totalDebt > capitalPrincipal && capitalPrincipal > 0) {
                totalGananciasLiquidadas += (totalDebt - capitalPrincipal);
              }
            } else if (isLiquidadoRenovacion) {
              // Si fue renovado con saldo a favor/anterior, solo la utilidad cobrada realmente en efectivo antes de la renovación genera ganancia real
              const gananciaEfectivoCobrada = Math.max(0, totalPagado - capitalPrincipal);
              if (gananciaEfectivoCobrada > 0) {
                totalGananciasLiquidadas += Math.round(gananciaEfectivoCobrada);
              }
            }
          }
        }
      });

      // FÓRMULA CONTABLE DEFINITIVA (v90):
      // Capital Base (Patrimonio Neto) = Capital Inyectado Neto + Ingresos Retenidos (Seguro/Papelería) + Ganancias Reales Liquidadas
      const patrimonioCalculado = Math.round(capitalInyectadoNeto + totalRetainedFees + totalGananciasLiquidadas);
      const patrimonioFinal = Math.max(capitalInyectadoNeto, patrimonioCalculado);

      // DESGLOSE Y AUDITORÍA EN CONSOLA SOLICITADA
      console.log('=== [AUDITORÍA DESGLOSE CAPITAL BASE] ===', {
        'Total Inyectado': capitalInyectadoNeto,
        'Total Ganancias Liquidadas': totalGananciasLiquidadas,
        'Total Ingresos Retenidos (Seguros/Papelería)': totalRetainedFees,
        'PATRIMONIO CALCULADO': patrimonioCalculado,
        'PATRIMONIO FINAL': patrimonioFinal
      });

      return patrimonioFinal;
    } catch (err) {
      console.error('Error fetching real base capital (Patrimonio):', err);
      return 0;
    }
  },

  async getDashboardFinancialMetrics(routeId) {
    try {
      const supabase = await initSupabase();
      const currentUser = this.getCurrentUser();
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;

      let assignedRouteId = routeId || (currentUser ? currentUser.routeId : null);
      if (!assignedRouteId && currentUser && typeof this.getActiveRouteIdForUser === 'function') {
        assignedRouteId = await this.getActiveRouteIdForUser(currentUser);
      }

      // 1. Obtener cedulas en Lista Negra / Mora desde las tablas 'clients' y 'cartones' (v118)
      const blacklistedCedulas = new Set();
      try {
        const { data: allCls } = await supabase.from('clients').select('*');
        if (allCls) {
          allCls.forEach(c => {
            const st = String(c.status || c.estado || '').trim().toUpperCase();
            const isLoss = st === 'LIQUIDADO_PERDIDA' || st === 'LIQUIDADO_MORA' || st === 'LISTA NEGRA' || st === 'CASTIGADO' || st === 'PERDIDA' || st === 'MOROSO' || (st.includes('PERDIDA') || st.includes('NEGRA') || st.includes('MORA') || st.includes('CASTIGADO'));
            if (isLoss) {
              if (c.cedula) blacklistedCedulas.add(String(c.cedula).trim());
              if (c.id) blacklistedCedulas.add(String(c.id).trim());
            }
          });
        }
        const { data: allCarts } = await supabase.from('cartones').select('*');
        if (allCarts) {
          allCarts.forEach(c => {
            const st = String(c.status || c.estado || '').trim().toUpperCase();
            const rawEst = String(c.estado || '').trim().toLowerCase();
            const isLoss = st === 'LIQUIDADO_PERDIDA' || st === 'LIQUIDADO_MORA' || st === 'LISTA NEGRA' || st === 'CASTIGADO' || st === 'PERDIDA' || st === 'MOROSO' || rawEst === 'liquidado_perdida' || rawEst === 'liquidado_mora';
            if (isLoss) {
              if (c.cliente_id) blacklistedCedulas.add(String(c.cliente_id).trim());
              if (c.client_id) blacklistedCedulas.add(String(c.client_id).trim());
            }
          });
        }
      } catch (eB) {
        console.warn("Aviso al obtener lista negra para métricas v118:", eB);
      }

      // 2. AUDITORÍA V182: Consulta estricta a la tabla 'cartones' con estado = 'activo' / 'activo_por_renovacion'
      const { data: cartonesActivos, error } = await supabase
        .from('cartones')
        .select('*')
        .in('estado', ['activo', 'activo_por_renovacion', 'ACTIVO']);

      console.log("🔍 [v182 AUDIT] Cartones Activos devueltos por Supabase:", cartonesActivos, "Error:", error);
      console.log("🔍 [v182 AUDIT] Cédulas en Lista Negra detectadas:", Array.from(blacklistedCedulas));

      let carteraEnCalle = 0; // Suma del capital principal activo en poder de los clientes
      let interesesActivos = 0; // Suma de ganancias proyectadas de cartones activos

      if (!error && cartonesActivos && cartonesActivos.length > 0) {
        // Filtrar y deduplicar cartones activos conservando únicamente el más reciente por cliente
        const activeMap = new Map();

        cartonesActivos.forEach(c => {
          const ced = String(c.cliente_id || c.client_id || c.cedula || '').trim();
          const rawEstado = String(c.estado || '').trim().toUpperCase();
          const rawStatus = String(c.status || '').trim().toUpperCase();

          const isLoss = rawEstado.includes('PERDIDA') || rawEstado.includes('MORA') || rawStatus.includes('PERDIDA') || rawStatus.includes('MORA') || blacklistedCedulas.has(ced);
          const isClosedOrRenewed = rawEstado === 'CERRADO' || rawEstado === 'RENOVADO' || rawEstado === 'LIQUIDADO_POR_RENOVACION' || rawEstado === 'LIQUIDADO' || rawStatus === 'CERRADO' || rawStatus === 'RENOVADO' || rawStatus === 'LIQUIDADO_POR_RENOVACION' || rawStatus === 'LIQUIDADO';

          const isStrictlyActive = (rawEstado === 'ACTIVO' || rawEstado === 'ACTIVO_POR_RENOVACION' || rawStatus === 'ACTIVO') && !isLoss && !isClosedOrRenewed;

          if (isStrictlyActive && ced) {
            const existingCarton = activeMap.get(ced);
            if (!existingCarton || (new Date(c.created_at || c.fecha_apertura || 0) > new Date(existingCarton.created_at || existingCarton.fecha_apertura || 0))) {
              activeMap.set(ced, c);
            }
          }
        });

        activeMap.forEach(c => {
          const outstanding = Math.round(Number(c.outstanding || 0));
          let totalDebt = Math.round(Number(c.total_debt || c.totalDebt || c.total_a_recaudar || c.monto_total || 0));
          let amount = Math.round(Number(c.monto_prestado || c.amount || c.capital_prestado || 0));

          if (outstanding > 0) {
            if (totalDebt <= 0 && amount > 0) {
              totalDebt = Math.round(amount * 1.2);
            }
            if (amount <= 0 && totalDebt > 0) {
              amount = Math.round(totalDebt / 1.2);
            }

            const originalInterest = (totalDebt > amount) ? Math.round(totalDebt - amount) : 0;

            // REGLA 1 (v168): Intereses Activos permanecen estables mientras el cartón siga activo (no disminuyen por abonos o pagos masivos)
            interesesActivos += originalInterest;

            // REGLA 2 (v168): Cartera en Calle descuenta directamente los abonos/pagos masivos del capital prestado
            const capitalPendiente = Math.max(0, Math.min(amount, outstanding - originalInterest));
            carteraEnCalle += capitalPendiente;
          }
        });
      }

      console.log(`✅ [v168 AUDIT] Totales recalculados -> Cartera en Calle: $${carteraEnCalle}, Intereses Activos: $${interesesActivos}`);
      
      if (!cartonesActivos || cartonesActivos.length === 0) {
        // Fallback en caso de que la tabla cartones no tenga registros aún (v151: definir rawClients)
        const rawClients = (await this.getClients()) || [];
        rawClients.forEach(c => {
          const belongsToUser = assignedRouteId ? (c.routeId === assignedRouteId) : true;
          if (belongsToUser) {
            const ced = String(c.cedula || c.id || '').trim();
            const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
            const rawRisk = String(c.risk || '').trim().toUpperCase();
            // FILTRO GLOBAL ACTIVOS v107: excluir mora, perdida, castigado, lista negra
            // Nota: 'Liquidado_Pagado' también se excluye de cartera activa (el crédito fue saldado)
            const isExcluded = blacklistedCedulas.has(ced) ||
                               rawRisk === 'ROJO' || 
                               rawStatus.includes('MORA') || 
                               rawStatus.includes('PERDIDA') || 
                               rawStatus.includes('CASTIGADO') || 
                               rawStatus.includes('NEGRA') || 
                               rawStatus.includes('LIQUIDADO') ||
                               rawStatus === 'SIN DEUDA ACTIVA';

            if (!isExcluded) {
              const outstanding = Math.round(Number(c.outstanding || c.saldo_restante || 0));
              let totalDebt = Math.round(Number(c.totalDebt || c.total_a_recaudar || c.monto_total || c.total_debt || 0));
              let amount = Math.round(Number(c.amount || c.capital_prestado || c.monto_prestado || 0));

              if (outstanding > 0) {
                if (totalDebt <= 0 && amount > 0) {
                  totalDebt = Math.round(amount * 1.2);
                }
                if (amount <= 0 && totalDebt > 0) {
                  amount = Math.round(totalDebt / 1.2);
                }

                const originalInterest = (totalDebt > amount) ? Math.round(totalDebt - amount) : 0;

                // REGLA 1 (v168): Intereses Activos estables mientras el cartón siga activo
                interesesActivos += originalInterest;

                // REGLA 2 (v168): Cartera en Calle descuenta directamente del capital
                const capitalPendiente = Math.max(0, Math.min(amount, outstanding - originalInterest));
                carteraEnCalle += capitalPendiente;
              }
            }
          }
        });
      }

      return {
        carteraEnCalle: Math.round(carteraEnCalle),
        interesesActivos: Math.round(interesesActivos),
        posibleGanancia: Math.round(interesesActivos)
      };
    } catch (err) {
      console.error("Error al calcular métricas del Dashboard financiero (v168):", err);
      return { carteraEnCalle: 0, interesesActivos: 0, posibleGanancia: 0 };
    }
  },

  async liquidateCredit({ cedula, status, outstanding, totalDebt, cartonId, numeroCarton }) {
    const supabase = await initSupabase();
    
    const isRenovacion = (status === 'liquidado_por_renovacion' || status === 'Liquidado_Renovacion' || status === 'renovacion' || status === 'RENOVACION');
    const isPaidRealCash = (status === 'Liquidado_Pagado' || status === 'Liquidado' || status === 'Cancelado' || status === 'CANCELADO' || status === 'liquidado' || status === 'LIQUIDADO');
    const isPaid = isPaidRealCash || isRenovacion || (outstanding !== undefined && Number(outstanding) <= 0);
    
    // REGLA ABSOLUTA: Si el saldo pendiente es <= 0 o es pago/liquidación exitosa, NUNCA es mora ni lista negra.
    const isMora = !isPaid && (outstanding !== undefined && Number(outstanding) > 0) && (status === 'liquidado_perdida' || status === 'Liquidado_Mora' || status === 'MOROSO' || status === 'Lista Negra' || status === 'castigado');
    
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

    // 2. Si el crédito fue liquidado/cancelado con PAGO REAL EN EFECTIVO o saldo final 0, asegurar que TODAS sus cuotas queden en 'Pagado' en la tabla payments.
    // REGLA CONTABLE ABSOLUTA v173: En RENOVACIÓN no se insertan cuotas pagadas en payments porque el saldo anterior es puramente simbólico/referencial.
    if ((isPaidRealCash || isPaid) && !isRenovacion && clientData) {
      try {
        const totalDebt = Math.round(Number(clientData?.totalDebt || clientData?.monto_total || 0));
        originalAmount = Math.round(Number(clientData?.amount || clientData?.capital_prestado || 0));
        gananciaReal = Math.max(0, totalDebt - originalAmount);

        // Eliminar registros de cuotas pendientes previos para este cliente
        await supabase
          .from('payments')
          .delete()
          .eq('clientCedula', String(cedula))
          .eq('status', 'Pendiente');

        const installmentsCount = Number(clientData?.installmentsCount || clientData?.installments_count || 30);
        const installmentAmount = Math.round(Number(clientData?.installmentAmount || (installmentsCount > 0 ? totalDebt / installmentsCount : 0)));

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

        // Generar registros de pagos para las cuotas faltantes ÚNICAMENTE si es liquidación exitosa por pago real (v122)
        const currentUser = this.getCurrentUser();
        const supId = this.getSupervisorId();
        const todayStr = new Date().toISOString().split('T')[0];
        const newPayments = [];

        let remainingDebt = Math.max(0, totalDebt - currentPaidTotal);

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
              status: 'Pagado',
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

    // 3. Actualizar la tabla 'cartones' (GARANTIZAR CAMBIO DE ESTADO EN SUPABASE VIA RPC v134)
    const cartonEstadoTarget = isRenovacion ? 'liquidado_por_renovacion' : (isPaid ? 'liquidado' : (isMora ? 'liquidado_perdida' : 'liquidado'));
    const cartonStatusTarget = isRenovacion ? 'liquidado_por_renovacion' : (isPaid ? 'Liquidado_Pagado' : (isMora ? 'liquidado_perdida' : 'Liquidado_Pagado'));
    try {
      const cedStr = String(cedula || '').trim();
      const moraOutstanding = isMora ? ((outstanding !== undefined && outstanding !== null && outstanding !== 0) ? Math.round(Number(outstanding)) : Math.round(Number(clientData?.outstanding || 0))) : 0;
      const cartonUpdatePayload = { 
        estado: cartonEstadoTarget, 
        outstanding: moraOutstanding
      };
      const isValidUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (cartonId && isValidUuid(cartonId)) {
        await supabase.from('cartones').update(cartonUpdatePayload).eq('id', cartonId);
      }
      if (numeroCarton && !isNaN(Number(numeroCarton))) {
        await supabase.from('cartones').update(cartonUpdatePayload).eq('numero_carton', Number(numeroCarton));
      }
      if (cedStr) {
        await supabase.from('cartones').update(cartonUpdatePayload).eq('cliente_id', cedStr);
      }

      if (isMora && cedStr) {
        const { error: rpcErr } = await supabase.rpc('liquidar_carton_por_morosidad', {
          p_cliente_id: cedStr
        });
        if (rpcErr) console.error("Error al liquidar mediante RPC en liquidateCredit:", rpcErr);
        else console.log(`✅ [v134 LIQUIDATE RPC] Cartón(es) de ${cedStr} liquidados por morosidad vía RPC en Supabase.`);

        // Inserción en la tabla 'lista_negra' registrando el saldo pendiente real
        try {
          await supabase.from('lista_negra').insert([{
            cliente_id: cedStr,
            cedula: cedStr,
            monto: moraOutstanding,
            saldo_pendiente: moraOutstanding,
            outstanding: moraOutstanding,
            total_debt: totalDebt || 0,
            carton_id: cartonId || null,
            motivo: 'Liquidado por Mora',
            created_at: new Date().toISOString()
          }]);
        } catch (eLn) {
          console.warn("Aviso opcional en liquidateCredit al insertar en lista_negra:", eLn?.message);
        }
      }
    } catch (eCarton) {
      console.warn("Excepción al actualizar tabla cartones:", eCarton.message);
    }

    // 4. Actualizar tabla 'clients'
    try {
      const clientUpdatePayload = {
        risk: isMora ? 'Rojo' : 'Verde',
        status: isMora ? 'liquidado_perdida' : (isRenovacion ? 'liquidado_por_renovacion' : (isPaid ? 'Liquidado_Pagado' : 'liquidado'))
      };

      if (isPaid) {
        clientUpdatePayload.outstanding = 0;
        clientUpdatePayload.totalDebt = 0;
        clientUpdatePayload.amount = 0;
      } else if (isMora) {
        const moraOutstanding = (outstanding !== undefined && outstanding !== 0) ? Math.round(Number(outstanding)) : Math.round(Number(clientData?.outstanding || 0));
        clientUpdatePayload.outstanding = moraOutstanding;
      } else if (outstanding !== undefined) {
        clientUpdatePayload.outstanding = Math.round(Number(outstanding || 0));
      }

      const { error: clientErr } = await supabase
        .from('clients')
        .update(clientUpdatePayload)
        .eq('cedula', String(cedula));

      if (clientErr) {
        await supabase
          .from('clients')
          .update({ risk: isMora ? 'Rojo' : 'Verde', status: isMora ? 'liquidado_perdida' : 'Liquidado_Pagado' })
          .eq('cedula', String(cedula));
      }
    } catch (eClient) {
      console.warn("Excepción al actualizar tabla clients:", eClient.message);
    }

    // 5. PROHIBIDO INSERTAR EN PAYMENTS AL LIQUIDAR POR MORA (v122)
    // Cuando un cliente va a Lista Negra/pérdida, NO se inserta ningún registro en 'payments'.
    // En su lugar, se sanean registros basura pendientes o nulos de la tabla payments.
    if (isMora) {
      try {
        await supabase
          .from('payments')
          .delete()
          .eq('clientCedula', String(cedula))
          .eq('status', 'Pendiente');
        
        await supabase
          .from('payments')
          .delete()
          .eq('clientCedula', String(cedula))
          .eq('amount', 0);
      } catch (eMoraPay) {
        console.warn("Aviso al sanealizar tabla payments en liquidación por mora:", eMoraPay);
      }
    }
    
    return true;
  },

  async getBlacklistedClients(routeId) {
    try {
      const supabase = await initSupabase();
      const currentUser = this.getCurrentUser();
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;
      const targetRouteId = routeId || (currentUser ? currentUser.routeId : null);

      // 1. Obtener clientes de la tabla clients con risk = 'Rojo' o status moroso
      let qClients = supabase.from('clients').select('*');
      if (targetRouteId) {
        qClients = qClients.eq('routeId', targetRouteId);
      } else if (agentId) {
        qClients = qClients.eq('agent_id', agentId);
      }
      const { data: clientsData } = await qClients;

      // 2. Obtener cartones con estado = 'liquidado_mora' o 'liquidado_perdida' de la tabla cartones (select * simple v120)
      let qCartones = supabase.from('cartones').select('*');
      if (targetRouteId) {
        qCartones = qCartones.eq('route_id', targetRouteId);
      } else if (agentId) {
        qCartones = qCartones.eq('agent_id', agentId);
      }
      const { data: cartonesData, error: cartonesErr } = await qCartones;
      if (cartonesErr) {
        console.error("Error al obtener cartones para lista negra:", cartonesErr);
      }

      const allClientsByCedula = new Map();
      if (clientsData) {
        clientsData.forEach(c => {
          if (c.cedula) allClientsByCedula.set(String(c.cedula).trim(), c);
        });
      }

      const blacklistedMap = new Map();

      if (clientsData) {
        clientsData.forEach(c => {
          const rawStatus = String(c.status || c.estado || '').toUpperCase();
          if (c.risk === 'Rojo' || String(c.risk || '').toLowerCase() === 'rojo' || rawStatus.includes('MORA') || rawStatus.includes('NEGRA')) {
            const ced = String(c.cedula).trim();
            const realSaldoPendiente = Math.round(Number(c.outstanding ?? c.saldo_pendiente ?? c.saldo_restante ?? c.totalDebt ?? c.monto_total ?? 0));
            blacklistedMap.set(ced, {
              ...c,
              cedula: ced,
              name: c.name || c.nombre || null,
              status: 'Liquidado_Mora',
              outstanding: realSaldoPendiente > 0 ? realSaldoPendiente : Number(c.amount || 0)
            });
          }
        });
      }

      if (cartonesData) {
        cartonesData.forEach(carton => {
          const rawEstado = String(carton.estado || carton.status || '').toLowerCase();
          if (rawEstado === 'liquidado_perdida' || rawEstado === 'liquidado_mora' || rawEstado === 'castigado' || rawEstado.includes('perdida') || rawEstado.includes('mora')) {
            const ced = String(carton.cliente_id || carton.client_id || '').trim();
            if (ced) {
              const clientFromDb = allClientsByCedula.get(ced) || {};
              const joinedClient = carton.clients || {};
              const existing = blacklistedMap.get(ced);
              const realSaldoPendiente = Math.round(Number(
                carton.outstanding ?? 
                clientFromDb.outstanding ?? 
                joinedClient.outstanding ?? 
                carton.saldo_pendiente ?? 
                clientFromDb.saldo_pendiente ?? 
                carton.total_debt ?? 
                carton.totalDebt ?? 
                0
              ));
              const foundName = clientFromDb.name || clientFromDb.nombre || joinedClient.name || carton.nombre_cliente || (existing ? existing.name : null);
              blacklistedMap.set(ced, {
                ...clientFromDb,
                ...joinedClient,
                ...carton,
                cedula: ced,
                name: foundName,
                phone: clientFromDb.phone || joinedClient.phone || (existing ? existing.phone : ''),
                city: clientFromDb.city || joinedClient.city || (existing ? existing.city : ''),
                zone: clientFromDb.zone || joinedClient.zone || (existing ? existing.zone : ''),
                risk: 'Rojo',
                status: 'liquidado_perdida',
                outstanding: realSaldoPendiente > 0 ? realSaldoPendiente : Number(existing ? existing.outstanding : 0)
              });
            }
          }
        });
      }

      return Array.from(blacklistedMap.values());
    } catch (e) {
      console.error("Error al obtener lista negra:", e);
      return [];
    }
  },

  async rehabilitateBlacklistedClient(cedula, amount, cartonId = null) {
    try {
      const supabase = await initSupabase();
      const currentUser = this.getCurrentUser();
      const cedStr = String(cedula).trim();
      const payAmt = Math.round(Number(amount) || 0);

      if (!cedStr || payAmt <= 0) {
        alert("⚠️ Por favor ingresa un monto válido a recibir.");
        return false;
      }

      // PASO 1 (CRÍTICO v150): Actualizar estado en Supabase PRIMERO con esquema válido (solo campo estado)
      const cartonUpdatePayload = {
        estado: 'liquidado_pagado',
        outstanding: 0,
        total_debt: 0
      };

      let updateErrors = [];
      let updateExecuted = false;

      // A) Si se recibe cartonId, actualizar directamente por ID
      if (cartonId) {
        const { error: errId } = await supabase
          .from('cartones')
          .update(cartonUpdatePayload)
          .eq('id', cartonId);
        if (errId) {
          console.error("Error al actualizar cartón por id:", errId);
          updateErrors.push(errId.message);
        } else {
          updateExecuted = true;
        }
      }

      // B) Actualizar cartones por cliente_id / client_id / cedula
      const { error: err1 } = await supabase.from('cartones').update(cartonUpdatePayload).eq('cliente_id', cedStr);
      if (err1) updateErrors.push(err1.message); else updateExecuted = true;

      const { error: err2 } = await supabase.from('cartones').update(cartonUpdatePayload).eq('client_id', cedStr);
      if (err2) updateErrors.push(err2.message); else updateExecuted = true;

      const { error: err3 } = await supabase.from('cartones').update(cartonUpdatePayload).eq('cedula', cedStr);
      if (!err3) updateExecuted = true;

      if (!isNaN(Number(cedStr))) {
        await supabase.from('cartones').update(cartonUpdatePayload).eq('cliente_id', Number(cedStr));
        await supabase.from('cartones').update(cartonUpdatePayload).eq('client_id', Number(cedStr));
        await supabase.from('cartones').update(cartonUpdatePayload).eq('cedula', Number(cedStr));
      }

      // C) Intentar actualización opcional en 'historial_creditos' y 'creditos'
      try { await supabase.from('historial_creditos').update(cartonUpdatePayload).eq('cedula', cedStr); } catch(e){}
      try { await supabase.from('creditos').update(cartonUpdatePayload).eq('cedula', cedStr); } catch(e){}

      // D) Actualizar cliente en tabla 'clients'
      const clientUpdatePayload = {
        risk: 'Verde',
        status: 'Liquidado_Pagado',
        outstanding: 0
      };

      const { error: errClient } = await supabase.from('clients').update(clientUpdatePayload).eq('cedula', cedStr);
      if (errClient) {
        await supabase.from('clients').update(clientUpdatePayload).eq('id', cedStr);
        if (!isNaN(Number(cedStr))) {
          await supabase.from('clients').update(clientUpdatePayload).eq('cedula', Number(cedStr));
          await supabase.from('clients').update(clientUpdatePayload).eq('id', Number(cedStr));
        }
      }

      // SI SUPABASE DEVOLVIÓ ERROR Y NINGÚN UPDATE SE EJECUTÓ SIN ERROR: MOSTRAR ALERTA Y ABORTAR (v149)
      if (!updateExecuted && updateErrors.length > 0) {
        const firstErr = updateErrors[0];
        alert("❌ Error de Supabase al actualizar el cartón: " + firstErr + "\nNo se ha registrado el pago ni la rehabilitación.");
        return false;
      }

      // PASO 2: Solo si Supabase respondió sin error, registrar movimiento en caja e insertar pago
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;
      const routeId = currentUser ? currentUser.routeId : null;
      const supId = await this.getSupervisorIdForUser(currentUser);
      const now = new Date();
      const todayIso = now.toISOString();
      const todayClean = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const paymentRecord = {
        id: `pay_rehab_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        clientCedula: cedStr,
        client_cedula: cedStr,
        amount: payAmt,
        date: todayClean,
        created_at: todayIso,
        status: 'Pagado',
        payment_type: 'Rehabilitacion_Lista_Negra',
        concept: 'Pago de Deuda Lista Negra',
        agent_id: agentId,
        agentUsername: currentUser ? currentUser.username : null,
        agentName: currentUser ? currentUser.name : null,
        routeId: routeId,
        supervisor_id: supId
      };

      const { error: payErr } = await supabase.from('payments').insert([paymentRecord]);
      if (payErr) console.error("Error al registrar pago en payments:", payErr);

      await this.loadActiveCredits();

      // PASO 3 (v153): Mensaje de éxito de rehabilitación indicando inyección voluntaria a caja
      alert("¡Pago exitoso! Cliente rehabilitado. Lo invitamos a inyectar ese valor a la caja si lo desea.");
      return true;
    } catch (e) {
      console.error("Error al rehabilitar cliente de Lista Negra:", e);
      alert("❌ Error al procesar la actualización en Supabase: " + (e.message || e));
      return false;
    }
  },

  async getLiquidCash(routeId) {
    try {
      const supabase = await initSupabase();
      const currentUser = this.getCurrentUser();
      const agentId = currentUser ? (currentUser.id || currentUser.username) : null;
      const targetRouteId = routeId || (currentUser ? currentUser.routeId : null);

      // ============================================================
      // FÓRMULA MAESTRA CAJA v115 (RELOJ SUIZO):
      // Capital en Caja = Total Inyectado - Total Prestado (Salida de Caja) + Total Abonos Reales
      // 1. Salida al prestar: al crear cualquier cartón/préstamo, el dinero sale de caja de inmediato.
      // 2. Entrada al abonar: cada abono/pago suma de inmediato a la caja.
      // 3. Baja por Lista Negra: la caja se mantiene ESTABLE (el dinero salió físicamente al prestarse y no se suma de vuelta).
      // ============================================================

      // 1. Suma total de inyecciones de la tabla 'capital_injections'
      const rawInjections = await this.getCapitalInjections(targetRouteId);
      const uniqueInjectionsMap = new Map();
      rawInjections.forEach(inj => {
        if (inj) {
          const statusStr = String(inj.status || '').toLowerCase();
          if (statusStr.includes('rechaz') || statusStr.includes('cancel')) return;
          const injId = String(inj.id || (inj.routeId + '_' + inj.amount + '_' + inj.date));
          if (!uniqueInjectionsMap.has(injId)) uniqueInjectionsMap.set(injId, inj);
        }
      });

      let totalInjected = 0;
      for (const inj of uniqueInjectionsMap.values()) {
        const belongsToUser = targetRouteId 
          ? (String(inj.routeId || inj.route_id) === String(targetRouteId)) 
          : (String(inj.agent_id) === String(agentId));
        if (belongsToUser || !targetRouteId) {
          totalInjected += Math.round(parseFloat(inj.amount) || 0);
        }
      }

      // 2. Suma del capital entregado en TODOS los préstamos otorgados (salida física de caja al prestar)
      let totalPrestadoSalioDeCaja = 0;
      try {
        const { data: cartonesData } = await supabase.from('cartones').select('*');
        if (cartonesData && cartonesData.length > 0) {
          cartonesData.forEach(c => {
            const rawEstado = String(c.estado || c.status || '').trim().toLowerCase();
            const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
            // Ignorar únicamente cartones cancelados/rechazados sin desembolso
            const isCanceled = rawEstado.includes('cancelad') || rawStatus.includes('CANCELAD') || rawStatus.includes('RECHAZAD');

            if (!isCanceled) {
              const montoPrestado = Math.round(Number(c.monto_prestado || c.amount || 0));
              const discountAmt = Math.round(Number(c.discount_amount || c.descuento || 0));
              const rolloverAmt = Math.round(Number(c.rollover_amount || c.saldo_anterior || 0));
              
              let realNetCashOut = (c.net_cash !== undefined && c.net_cash !== null && !isNaN(Number(c.net_cash)))
                ? Math.round(Number(c.net_cash))
                : Math.max(0, montoPrestado - discountAmt - rolloverAmt);

              totalPrestadoSalioDeCaja += realNetCashOut;
            }
          });
        } else {
          const clientsData = await this.getClients();
          if (clientsData && clientsData.length > 0) {
            clientsData.forEach(c => {
              const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
              const isCanceled = rawStatus.includes('CANCEL') || rawStatus.includes('RECHAZ');
              if (!isCanceled) {
                const monto = Math.round(Number(c.amount || c.monto_prestado || 0));
                const discount = Math.round(Number(c.discount_amount || c.descuento || 0));
                const rollover = Math.round(Number(c.rollover_amount || c.saldo_anterior || 0));
                const realNetCashOut = (c.net_cash !== undefined && c.net_cash !== null && !isNaN(Number(c.net_cash)))
                  ? Math.round(Number(c.net_cash))
                  : Math.max(0, monto - discount - rollover);
                totalPrestadoSalioDeCaja += realNetCashOut;
              }
            });
          }
        }
      } catch (eCart) {
        console.warn("Aviso al consultar cartones para Capital en Caja v115:", eCart);
      }

      // 3. Suma de TODOS los abonos y pagos reales en efectivo recibidos (tabla 'payments')
      const payments = await this.getPayments();
      let totalAbonosReales = 0;
      for (const p of payments) {
        const pStatus = String(p.status || '').toUpperCase();
        const isCanceled = pStatus.includes('CANCEL') || pStatus.includes('RECHAZ') || pStatus === 'NO PAGO' || pStatus === 'PENDIENTE';
        const isMoraLoss = pStatus.includes('LIQUIDADO_MORA') || pStatus.includes('MORA');
        const isRealPayment = p.amount > 0 && !isCanceled && !isMoraLoss;

        if (isRealPayment) {
          totalAbonosReales += Math.round(parseFloat(p.amount) || 0);
        }
      }

      // 4. Suma de entradas y salidas registradas en 'caja_movimientos' (Movimientos manuales de caja)
      let totalMovimientosEntrada = 0;
      let totalMovimientosSalida = 0;
      try {
        const movements = await this.getCashMovements();
        const currentUser = this.getCurrentUser();
        const agentId = currentUser ? (currentUser.id || currentUser.username) : null;
        movements.forEach(m => {
          const mRoute = m.route_id || m.routeId;
          const mAgent = m.agent_id || m.agentId;
          const belongsToUser = targetRouteId 
            ? (!mRoute || String(mRoute) === String(targetRouteId) || (agentId && String(mAgent) === String(agentId))) 
            : (!agentId || String(mAgent) === String(agentId));
          if (belongsToUser || !targetRouteId) {
            const typeStr = String(m.type || m.tipo || '').toLowerCase();
            const isEntrada = typeStr === 'entrada' || typeStr === 'ingreso' || typeStr === 'inyeccion' || typeStr === 'inyección' || typeStr === 'in';
            const isSalida = typeStr === 'salida' || typeStr === 'egreso' || typeStr === 'retiro' || typeStr === 'out';
            const amount = Math.abs(Math.round(Number(m.amount || m.monto || 0)));
            const concept = String(m.concept || m.concepto || m.description || '').toLowerCase();
            const isRenov = (m.id && String(m.id).startsWith('mov_renov_in_')) || concept.includes('renovac') || concept.includes('renovación');

            if (isEntrada) {
              const isInjection = concept.includes('inyecc') || concept.includes('inyección') || concept.includes('inyeccion') || concept.includes('capital') || String(m.id || '').startsWith('inj_') || (!concept && !m.description && !m.concepto);
              
              // Omitir cualquier entrada manual duplicada de renovación
              if (!isRenov && !isInjection) {
                totalMovimientosEntrada += amount;
              }
            } else if (isSalida) {
              const isInjectionSalida = concept.includes('inyecc') || concept.includes('inyección') || concept.includes('inyeccion') || concept.includes('capital') || String(m.id || '').startsWith('inj_') || String(m.id || '').startsWith('mov_inj_');
              if (!concept.includes('desembolso') && !concept.includes('cartón') && !concept.includes('carton') && !isRenov && !isInjectionSalida) {
                totalMovimientosSalida += amount;
              }
            }
          }
        });
      } catch (eMov) {
        console.warn("Aviso al calcular movimientos de caja en getLiquidCash:", eMov);
      }

      const capitalEnCajaFinal = Math.round(totalInjected - totalPrestadoSalioDeCaja + totalAbonosReales + totalMovimientosEntrada - totalMovimientosSalida);
      return Math.max(0, capitalEnCajaFinal);
    } catch (err) {
      console.error('Error fetching liquid cash (v115):', err);
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
         const isRealPayment = Number(p.amount) > 0 && p.status !== 'Pendiente' && p.status !== 'No Pago';
         const pCedula = String(p.clientCedula || p.client_cedula || p.cedula || '');
         const isRehabPayment = p.payment_type === 'Rehabilitacion_Lista_Negra' || (p.id && String(p.id).startsWith('pay_rehab_'));
         const isBlacklistedClient = blacklistedCedulas.has(pCedula);

         const pStatusUpper = String(p.status || '').toUpperCase();
         const isRenovationPayment = pStatusUpper.includes('RENOVAC') || pStatusUpper.includes('LIQUIDADO_POR_RENOVACION') || p.liquidado === true;
         const isMoraPayment = pStatusUpper.includes('MORA') || 
                               pStatusUpper.includes('LIQUIDADO_MORA') || 
                               pStatusUpper.includes('NEGRA') ||
                               (p.id && String(p.id).startsWith('pay_liq_') && isBlacklistedClient);

         if (isRehabPayment && isToday && isMine && isRealPayment) return true;

         return isToday && isMine && isRealPayment && (!isBlacklistedClient || isRehabPayment) && !isMoraPayment && !isRenovationPayment;
      });
      
      const totalCollected = Math.round(todaysPayments.reduce((acc, p) => acc + Math.round(Number(p.amount) || 0), 0));
      const massPaymentsTotal = Math.round(todaysPayments.reduce((acc, p) => (p.is_mass_payment || String(p.status || '').includes('Masivo')) ? acc + Math.round(Number(p.amount) || 0) : acc, 0));
      
      // Prestado hoy (Desembolso Neto Real entregado de caja)
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

      let secondaryCartonesToday = [];
      try {
        const supabase = await initSupabase();
        let q = supabase.from('cartones').select('*');
        if (currentUser.role === 'Usuario Supervisor' || currentUser.role === 'supervisor') {
          q = q.eq('supervisor_id', currentUser.username);
        } else if (currentUser.routeId) {
          q = q.eq('route_id', currentUser.routeId);
        } else {
          q = q.eq('agent_id', agentId);
        }
        const { data: cartonesData } = await q;
        if (cartonesData && cartonesData.length > 0) {
          secondaryCartonesToday = cartonesData.filter(c => {
            if (!c.fecha_apertura && !c.fecha_inicio && !c.created_at) return false;
            const cDate = getCleanDateStr(c.fecha_apertura || c.fecha_inicio || c.created_at);
            return cDate === todayStr;
          });
        }
      } catch (e) {
        // cartones query fallback
      }

      let totalLent = Math.round(todaysClients.reduce((acc, c) => {
        const monto = Math.round(Number(c.amount || c.monto_prestado || 0));
        const discount = Math.round(Number(c.discount_amount || c.descuento || 0));
        const rollover = Math.round(Number(c.rollover_amount || c.saldo_anterior || 0));
        const net = (c.net_cash !== undefined && c.net_cash !== null && !isNaN(Number(c.net_cash)))
          ? Math.round(Number(c.net_cash))
          : Math.max(0, monto - discount - rollover);
        return acc + net;
      }, 0));
      let totalDiscounts = Math.round(todaysClients.reduce((acc, c) => acc + this.getRetainedFeesFromCredit(c), 0));

      if (secondaryCartonesToday.length > 0) {
        secondaryCartonesToday.forEach(sc => {
          const alreadyInClients = todaysClients.some(tc => String(tc.cedula) === String(sc.cliente_id));
          if (!alreadyInClients) {
            const monto = Math.round(Number(sc.monto_prestado || sc.amount || 0));
            const discount = Math.round(Number(sc.discount_amount || sc.descuento || 0));
            const rollover = Math.round(Number(sc.rollover_amount || sc.saldo_anterior || 0));
            const net = (sc.net_cash !== undefined && sc.net_cash !== null && !isNaN(Number(sc.net_cash)))
              ? Math.round(Number(sc.net_cash))
              : Math.max(0, monto - discount - rollover);
            totalLent += net;
            totalDiscounts += Math.round(Number(sc.discount_amount) || 0);
          }
        });
      }

      // Movimientos de caja
      const todaysMovements = movements.filter(m => m.date && getCleanDateStr(m.date) === todayStr);
      const totalIn = Math.round(todaysMovements.filter(m => {
        if (m.type !== 'entrada') return false;
        const concept = String(m.concept || m.concepto || m.description || '').toLowerCase();
        const idStr = String(m.id || '');
        const isRenov = idStr.startsWith('mov_renov_in_') || concept.includes('renovac') || concept.includes('renovación');
        const isInjection = concept.includes('inyecc') || concept.includes('inyección') || concept.includes('inyeccion') || concept.includes('capital') || idStr.startsWith('inj_') || (!concept && !m.description && !m.concepto);
        return !isInjection && !isRenov;
      }).reduce((acc, m) => acc + Math.round(Number(m.amount) || 0), 0));
      const totalOut = Math.round(todaysMovements.filter(m => {
        const typeStr = String(m.type || m.tipo || '').toLowerCase();
        return typeStr === 'salida' || typeStr === 'egreso' || typeStr === 'retiro' || typeStr === 'out';
      }).reduce((acc, m) => acc + Math.abs(Math.round(Number(m.amount || m.monto) || 0)), 0));
      
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
  },

  // ==========================================
  // MÓDULO DE SOPORTE Y MENSAJERÍA DIRECTA
  // ==========================================
  async createSupportTicket(ticketData) {
    const wa = ticketData.whatsapp || ticketData.sop_whatsapp || ticketData.phone || '';
    const rawMsg = ticketData.message || ticketData.sop_mensaje || '';

    const newTicket = {
      id: 'ticket_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: ticketData.name || ticketData.sop_nombre || 'Sin Nombre',
      role: ticketData.role || ticketData.sop_rol || 'Usuario',
      document_number: ticketData.documentNumber || ticketData.document_number || ticketData.sop_cedula || 'N/A',
      message: wa ? `📱 WhatsApp: ${wa}\n💬 Inquietud: ${rawMsg}` : rawMsg,
      attachment: ticketData.attachment || ticketData.sop_archivo || null,
      status: 'Pendiente',
      created_at: new Date().toISOString()
    };

    // 1. Intentar persistir en Supabase
    try {
      const supabase = await initSupabase();
      if (supabase) {
        const { data, error } = await supabase.from('support_tickets').insert([newTicket]).select();
        if (!error && data && data.length > 0) {
          console.log("✅ Ticket de soporte guardado en Supabase:", data[0]);
          this._saveSupportTicketLocal(data[0]);
          return data[0];
        }
      }
    } catch(e) {
      console.warn("Fallo guardando ticket en Supabase, usando almacenamiento local:", e);
    }

    // 2. Fallback seguro local
    this._saveSupportTicketLocal(newTicket);
    return newTicket;
  },

  _saveSupportTicketLocal(ticket) {
    try {
      const raw = localStorage.getItem('bula_support_tickets') || localStorage.getItem('bula_local_tickets');
      const tickets = raw ? JSON.parse(raw) : [];
      const existsIndex = tickets.findIndex(t => t.id === ticket.id);
      if (existsIndex >= 0) {
        tickets[existsIndex] = ticket;
      } else {
        tickets.unshift(ticket);
      }
      localStorage.setItem('bula_support_tickets', JSON.stringify(tickets));
      localStorage.setItem('bula_local_tickets', JSON.stringify(tickets));
    } catch(e) {
      console.warn("Error guardando ticket en localStorage:", e);
    }
  },

  async getSupportTickets() {
    let supabaseTickets = [];
    try {
      const supabase = await initSupabase();
      if (supabase) {
        const { data, error } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          supabaseTickets = data;
        }
      }
    } catch(e) {
      console.warn("Fallo leyendo tickets de Supabase:", e);
    }

    let localTickets = [];
    try {
      const raw = localStorage.getItem('bula_support_tickets') || localStorage.getItem('bula_local_tickets');
      if (raw) localTickets = JSON.parse(raw);
    } catch(e) {}

    const ticketsMap = new Map();
    supabaseTickets.forEach(t => ticketsMap.set(t.id, t));
    localTickets.forEach(t => {
      if (!ticketsMap.has(t.id)) ticketsMap.set(t.id, t);
    });

    const allTickets = Array.from(ticketsMap.values());
    allTickets.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return allTickets;
  },

  async updateSupportTicketStatus(ticketId, newStatus) {
    try {
      const supabase = await initSupabase();
      if (supabase) {
        await supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticketId);
      }
    } catch(e) {
      console.warn("Fallo actualizando ticket en Supabase:", e);
    }

    try {
      const raw = localStorage.getItem('bula_support_tickets');
      if (raw) {
        const tickets = JSON.parse(raw);
        const target = tickets.find(t => t.id === ticketId);
        if (target) {
          target.status = newStatus;
          localStorage.setItem('bula_support_tickets', JSON.stringify(tickets));
        }
      }
    } catch(e) {}
  },

  async deleteSupportTicket(ticketId) {
    try {
      const supabase = await initSupabase();
      if (supabase) {
        await supabase.from('support_tickets').delete().eq('id', ticketId);
      }
    } catch(e) {
      console.warn("Fallo eliminando ticket en Supabase:", e);
    }

    try {
      const raw = localStorage.getItem('bula_support_tickets');
      if (raw) {
        let tickets = JSON.parse(raw);
        tickets = tickets.filter(t => t.id !== ticketId);
        localStorage.setItem('bula_support_tickets', JSON.stringify(tickets));
      }
    } catch(e) {}
  },



  // Restablecimiento Directo de Contraseña por Cédula / Usuario en el Modal de Soporte
  async resetUserPasswordDirectly(identifier, newPassword) {
    if (!identifier || !newPassword) {
      return { success: false, message: 'Faltan datos obligatorios.' };
    }
    const cleanId = String(identifier).trim();
    let updated = false;

    // 1. Actualizar en Supabase
    try {
      const supabase = await initSupabase();
      if (supabase) {
        // Actualizar por cédula o usuario en la tabla users
        const { error } = await supabase
          .from('users')
          .update({ password: newPassword })
          .or(`documentNumber.eq.${cleanId},username.eq.${cleanId}`);

        if (!error) {
          updated = true;
          console.log(`✅ Contraseña actualizada en Supabase para cédula/usuario: ${cleanId}`);
        } else {
          console.warn("Fallo actualización directa en Supabase por OR:", error);
          await supabase.from('users').update({ password: newPassword }).eq('documentNumber', cleanId);
          await supabase.from('users').update({ password: newPassword }).eq('username', cleanId);
          updated = true;
        }
      }
    } catch(err) {
      console.warn("Error intentando actualizar contraseña en Supabase:", err);
    }

    // 2. Actualizar en localStorage fallback
    try {
      const keys = ['bula_users', 'users', 'bulapay_users'];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const users = JSON.parse(raw);
          let matchFound = false;
          users.forEach(u => {
            if (
              String(u.documentNumber) === cleanId ||
              String(u.username).toLowerCase() === cleanId.toLowerCase() ||
              (u.name && String(u.name).toLowerCase() === cleanId.toLowerCase())
            ) {
              u.password = newPassword;
              matchFound = true;
            }
          });
          if (matchFound) {
            localStorage.setItem(k, JSON.stringify(users));
            updated = true;
          }
        }
      }
    } catch(e) {}

    return { success: true, message: 'Contraseña actualizada correctamente.' };
  }
};

// Inicializar el cliente Supabase de manera diferida
db.init();

// Exportar globalmente
window.BulaPayDB = db;
