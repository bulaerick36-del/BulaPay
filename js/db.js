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
      { id: 'route_1', name: 'Ruta Centro - Norte', agentUsername: 'agente1', agentName: 'Juan Pérez', capital: 500000, collected: 180000, status: 'En Ruta', date: '2026-06-18', supervisor_id: 'admin' },
      { id: 'route_2', name: 'Ruta Zona Sur', agentUsername: 'agente2', agentName: 'María López', capital: 300000, collected: 150000, status: 'Completado', date: '2026-06-18', supervisor_id: 'admin' }
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
    if (user.role === 'Usuario Supervisor' && !user.supervisor_id) {
      user.supervisor_id = user.username;
    }
    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select();
    if (error) {
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

  // CLIENTS
  async getClients() {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return [];
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('supervisor_id', supId);
    if (error) {
      console.error("Error al obtener clientes en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getClientByCedula(cedula) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (!supId) return null;
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('cedula', String(cedula))
      .eq('supervisor_id', supId)
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener cliente por cédula "${cedula}":`, error);
      return null;
    }
    return data;
  },

  async saveClient(client) {
    const supabase = await initSupabase();
    const supId = this.getSupervisorId();
    if (supId) {
      client.supervisor_id = supId;
    }
    const { data, error } = await supabase
      .from('clients')
      .insert([client])
      .select();
    if (error) {
      console.error("Error al guardar cliente en Supabase:", error);
      throw error;
    }
    return data ? data[0] : client;
  },

  async updateClientOutstanding(cedula, amountPaid) {
    const supabase = await initSupabase();
    const client = await this.getClientByCedula(cedula);
    if (client) {
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
    
    // Obtener total de pagos históricos del cliente para calcular el correlativo de cuota
    const clientPayments = await this.getPaymentsByClient(payment.clientCedula);
    const installmentNumber = clientPayments.length + 1;
    
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
    const client = await this.getClientByCedula(payment.clientCedula);
    if (client && client.routeId) {
      await this.updateRouteCollected(client.routeId, payment.amount);
    }
    
    return newPayment;
  }
};

// Inicializar el cliente Supabase de manera diferida
db.init();

// Exportar globalmente
window.BulaPayDB = db;
