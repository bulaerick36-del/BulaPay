// Módulo de Base de Datos Real de Supabase (BulaPay DB)

const DB_KEYS = {
  CURRENT_USER: 'bulapay_current_user'
};

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

  // Fallbacks estáticos provistos en la configuración inicial
  const urlFallback = 'https://vxvyiklzyfmfbrgwqgxv.supabase.co';
  const keyFallback = 'sb_publishable_gXixzFlqN8TgbAwq6BsgWQ_LFfhnU4X';

  if (window.supabase) {
    supabaseInstance = window.supabase.createClient(urlFallback, keyFallback);
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
    await supabase.from('users').insert([
      { username: 'admin', password: '123', name: 'Carlos Mendoza', role: 'Usuario Supervisor', company: 'Logística Mendoza S.A.', city: 'Bogotá', zone: 'Chapinero / Norte', phone: '+57 315 123 4567', email: 'contacto@logisticamendoza.co' },
      { username: 'tienda', password: '123', name: 'Almacén La Esquina', role: 'Comercio Independiente', company: 'Almacén La Esquina', city: 'Bogotá', zone: 'Centro / Santa Fe', phone: '+57 318 987 6543', email: 'laesquina@gmail.com' },
      { username: 'medellin_sup', password: '123', name: 'Inés Restrepo', role: 'Usuario Supervisor', company: 'Inversiones Antioquia', city: 'Medellín', zone: 'El Poblado / Laureles', phone: '+57 310 444 5566', email: 'contacto@inversionesantioquia.com' },
      { username: 'cali_sup', password: '123', name: 'Felipe Caicedo', role: 'Usuario Supervisor', company: 'CrediCali S.A.S.', city: 'Cali', zone: 'Oriente / Versalles', phone: '+57 312 888 9900', email: 'felipe.caicedo@credicali.com' }
    ]);
    
    // Insertar Rutas Semilla
    await supabase.from('routes').insert([
      { id: 'route_1', name: 'Ruta Centro - Norte', agentUsername: 'agente1', agentName: 'Juan Pérez', capital: 500000, collected: 180000, status: 'En Ruta', date: '2026-06-18' },
      { id: 'route_2', name: 'Ruta Zona Sur', agentUsername: 'agente2', agentName: 'María López', capital: 300000, collected: 150000, status: 'Completado', date: '2026-06-18' }
    ]);
    
    // Insertar Agentes de Ruta Semilla (que dependen de la ruta creada previamente)
    await supabase.from('users').insert([
      { username: 'agente1', password: '123', name: 'Juan Pérez', role: 'Agente de Ruta', supervisor: 'admin', routeId: 'route_1' },
      { username: 'agente2', password: '123', name: 'María López', role: 'Agente de Ruta', supervisor: 'admin', routeId: 'route_2' }
    ]);
    
    // Insertar Clientes Semilla
    await supabase.from('clients').insert([
      { cedula: '12345', name: 'Roberto Gómez', phone: '3115551234', email: 'roberto.gomez@gmail.com', city: 'Bogotá', zone: 'Centro', risk: 'Verde', totalDebt: 500000, outstanding: 150000, installmentsCount: 5, installmentAmount: 100000, routeId: 'route_1' },
      { cedula: '67890', name: 'Ana María Silva', phone: '3125556789', email: 'ana.silva@outlook.com', city: 'Bogotá', zone: 'Norte', risk: 'Amarillo', totalDebt: 400000, outstanding: 240000, installmentsCount: 5, installmentAmount: 80000, routeId: 'route_1' },
      { cedula: '11223', name: 'Pedro Pablo Restrepo', phone: '3105559988', email: 'pedro.restrepo@yahoo.com', city: 'Medellín', zone: 'Sur', risk: 'Rojo', totalDebt: 600000, outstanding: 450000, installmentsCount: 6, installmentAmount: 100000, routeId: 'route_2' }
    ]);
    
    // Insertar Pagos Semilla
    await supabase.from('payments').insert([
      { id: 'pay_1', clientCedula: '12345', installmentNumber: 1, amount: 100000, date: '2026-06-01', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-12345-01' },
      { id: 'pay_2', clientCedula: '12345', installmentNumber: 2, amount: 100000, date: '2026-06-08', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-12345-02' },
      { id: 'pay_3', clientCedula: '12345', installmentNumber: 3, amount: 150000, date: '2026-06-15', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-12345-03' },
      { id: 'pay_4', clientCedula: '67890', installmentNumber: 1, amount: 80000, date: '2026-06-02', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-67890-01' },
      { id: 'pay_5', clientCedula: '67890', installmentNumber: 2, amount: 80000, date: '2026-06-12', agentName: 'Juan Pérez', status: 'Pagado', signature: 'BulaPay-SIG-67890-02' },
      { id: 'pay_6', clientCedula: '11223', installmentNumber: 1, amount: 100000, date: '2026-05-20', agentName: 'María López', status: 'Pagado', signature: 'BulaPay-SIG-11223-01' },
      { id: 'pay_7', clientCedula: '11223', installmentNumber: 2, amount: 50000, date: '2026-05-30', agentName: 'María López', status: 'Abonado', signature: 'BulaPay-SIG-11223-02' }
    ]);

    localStorage.removeItem(DB_KEYS.CURRENT_USER);
  },

  // USERS
  async getUsers() {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*');
    if (error) {
      console.error("Error al obtener usuarios en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async saveUser(user) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('users')
      .insert([user]);
    if (error) {
      console.error("Error al guardar usuario en Supabase:", error);
      throw error;
    }
    return user;
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

  // CURRENT SESSION (Mantenido local por simplicidad de navegación)
  getCurrentUser() {
    return JSON.parse(localStorage.getItem(DB_KEYS.CURRENT_USER)) || null;
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
    const { data, error } = await supabase
      .from('routes')
      .select('*');
    if (error) {
      console.error("Error al obtener rutas en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getRouteById(id) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener ruta por ID "${id}":`, error);
      return null;
    }
    return data;
  },

  async saveRoute(route) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('routes')
      .insert([route]);
    if (error) {
      console.error("Error al crear ruta en Supabase:", error);
      throw error;
    }
    return route;
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

  // CLIENTS
  async getClients() {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*');
    if (error) {
      console.error("Error al obtener clientes en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getClientByCedula(cedula) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('cedula', String(cedula))
      .maybeSingle();
    if (error) {
      console.error(`Error al obtener cliente por cédula "${cedula}":`, error);
      return null;
    }
    return data;
  },

  async saveClient(client) {
    const supabase = await initSupabase();
    const { error } = await supabase
      .from('clients')
      .insert([client]);
    if (error) {
      console.error("Error al guardar cliente en Supabase:", error);
      throw error;
    }
    return client;
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
    const { data, error } = await supabase
      .from('payments')
      .select('*');
    if (error) {
      console.error("Error al obtener pagos en Supabase:", error);
      return [];
    }
    return data || [];
  },

  async getPaymentsByClient(cedula) {
    const supabase = await initSupabase();
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('clientCedula', String(cedula));
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
    
    const newPayment = {
      id: id,
      clientCedula: String(payment.clientCedula),
      installmentNumber: installmentNumber,
      amount: Number(payment.amount),
      date: payment.date || new Date().toISOString().split('T')[0],
      agentName: payment.agentName,
      status: payment.status,
      signature: signature
    };

    // 1. Registrar pago
    const { error: payError } = await supabase
      .from('payments')
      .insert([newPayment]);
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
