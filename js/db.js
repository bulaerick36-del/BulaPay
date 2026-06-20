// Módulo de Base de Datos Local Simulada (BulaPay DB)

const DB_KEYS = {
  USERS: 'bulapay_users',
  ROUTES: 'bulapay_routes',
  CLIENTS: 'bulapay_clients',
  PAYMENTS: 'bulapay_payments',
  CURRENT_USER: 'bulapay_current_user'
};

const SEED_USERS = [
  {
    username: 'admin',
    password: '123',
    name: 'Carlos Mendoza',
    role: 'Usuario Supervisor',
    company: 'Logística Mendoza S.A.',
    city: 'Bogotá',
    zone: 'Chapinero / Norte',
    phone: '+57 315 123 4567',
    email: 'contacto@logisticamendoza.co'
  },
  {
    username: 'tienda',
    password: '123',
    name: 'Almacén La Esquina',
    role: 'Comercio Independiente',
    company: 'Almacén La Esquina',
    city: 'Bogotá',
    zone: 'Centro / Santa Fe',
    phone: '+57 318 987 6543',
    email: 'laesquina@gmail.com'
  },
  {
    username: 'medellin_sup',
    password: '123',
    name: 'Inés Restrepo',
    role: 'Usuario Supervisor',
    company: 'Inversiones Antioquia',
    city: 'Medellín',
    zone: 'El Poblado / Laureles',
    phone: '+57 310 444 5566',
    email: 'contacto@inversionesantioquia.com'
  },
  {
    username: 'cali_sup',
    password: '123',
    name: 'Felipe Caicedo',
    role: 'Usuario Supervisor',
    company: 'CrediCali S.A.S.',
    city: 'Cali',
    zone: 'Oriente / Versalles',
    phone: '+57 312 888 9900',
    email: 'felipe.caicedo@credicali.com'
  },
  {
    username: 'agente1',
    password: '123',
    name: 'Juan Pérez',
    role: 'Agente de Ruta',
    supervisor: 'admin',
    routeId: 'route_1'
  },
  {
    username: 'agente2',
    password: '123',
    name: 'María López',
    role: 'Agente de Ruta',
    supervisor: 'admin',
    routeId: 'route_2'
  }
];

const SEED_ROUTES = [
  {
    id: 'route_1',
    name: 'Ruta Centro - Norte',
    agentUsername: 'agente1',
    agentName: 'Juan Pérez',
    capital: 500000,
    collected: 180000,
    status: 'En Ruta', // 'En Ruta', 'Completado', 'Incidencia'
    date: '2026-06-18'
  },
  {
    id: 'route_2',
    name: 'Ruta Zona Sur',
    agentUsername: 'agente2',
    agentName: 'María López',
    capital: 300000,
    collected: 150000,
    status: 'Completado',
    date: '2026-06-18'
  }
];

const SEED_CLIENTS = [
  {
    cedula: '12345',
    name: 'Roberto Gómez',
    phone: '3115551234',
    email: 'roberto.gomez@gmail.com',
    city: 'Bogotá',
    zone: 'Centro',
    risk: 'Verde', // 'Verde', 'Amarillo', 'Rojo'
    totalDebt: 500000,
    outstanding: 150000,
    installmentsCount: 5,
    installmentAmount: 100000,
    routeId: 'route_1'
  },
  {
    cedula: '67890',
    name: 'Ana María Silva',
    phone: '3125556789',
    email: 'ana.silva@outlook.com',
    city: 'Bogotá',
    zone: 'Norte',
    risk: 'Amarillo',
    totalDebt: 400000,
    outstanding: 240000,
    installmentsCount: 5,
    installmentAmount: 80000,
    routeId: 'route_1'
  },
  {
    cedula: '11223',
    name: 'Pedro Pablo Restrepo',
    phone: '3105559988',
    email: 'pedro.restrepo@yahoo.com',
    city: 'Medellín',
    zone: 'Sur',
    risk: 'Rojo',
    totalDebt: 600000,
    outstanding: 450000,
    installmentsCount: 6,
    installmentAmount: 100000,
    routeId: 'route_2'
  }
];

const SEED_PAYMENTS = [
  // Pagos de Roberto Gómez (Cédula 12345)
  {
    id: 'pay_1',
    clientCedula: '12345',
    installmentNumber: 1,
    amount: 100000,
    date: '2026-06-01',
    agentName: 'Juan Pérez',
    status: 'Pagado',
    signature: 'BulaPay-SIG-12345-01'
  },
  {
    id: 'pay_2',
    clientCedula: '12345',
    installmentNumber: 2,
    amount: 100000,
    date: '2026-06-08',
    agentName: 'Juan Pérez',
    status: 'Pagado',
    signature: 'BulaPay-SIG-12345-02'
  },
  {
    id: 'pay_3',
    clientCedula: '12345',
    installmentNumber: 3,
    amount: 150000, // Abono parcial mayor
    date: '2026-06-15',
    agentName: 'Juan Pérez',
    status: 'Pagado',
    signature: 'BulaPay-SIG-12345-03'
  },
  // Pagos de Ana Silva (Cédula 67890)
  {
    id: 'pay_4',
    clientCedula: '67890',
    installmentNumber: 1,
    amount: 80000,
    date: '2026-06-02',
    agentName: 'Juan Pérez',
    status: 'Pagado',
    signature: 'BulaPay-SIG-67890-01'
  },
  {
    id: 'pay_5',
    clientCedula: '67890',
    installmentNumber: 2,
    amount: 80000,
    date: '2026-06-12', // Atrasada por 5 días
    agentName: 'Juan Pérez',
    status: 'Pagado',
    signature: 'BulaPay-SIG-67890-02'
  },
  // Pagos de Pedro Restrepo (Cédula 11223)
  {
    id: 'pay_6',
    clientCedula: '11223',
    installmentNumber: 1,
    amount: 100000,
    date: '2026-05-20',
    agentName: 'María López',
    status: 'Pagado',
    signature: 'BulaPay-SIG-11223-01'
  },
  {
    id: 'pay_7',
    clientCedula: '11223',
    installmentNumber: 2,
    amount: 50000, // Abono incompleto
    date: '2026-05-30',
    agentName: 'María López',
    status: 'Abonado',
    signature: 'BulaPay-SIG-11223-02'
  }
];

const db = {
  init() {
    if (!localStorage.getItem(DB_KEYS.USERS)) {
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(DB_KEYS.ROUTES)) {
      localStorage.setItem(DB_KEYS.ROUTES, JSON.stringify(SEED_ROUTES));
    }
    if (!localStorage.getItem(DB_KEYS.CLIENTS)) {
      localStorage.setItem(DB_KEYS.CLIENTS, JSON.stringify(SEED_CLIENTS));
    }
    if (!localStorage.getItem(DB_KEYS.PAYMENTS)) {
      localStorage.setItem(DB_KEYS.PAYMENTS, JSON.stringify(SEED_PAYMENTS));
    }
  },

  reseed() {
    localStorage.removeItem(DB_KEYS.USERS);
    localStorage.removeItem(DB_KEYS.ROUTES);
    localStorage.removeItem(DB_KEYS.CLIENTS);
    localStorage.removeItem(DB_KEYS.PAYMENTS);
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
    this.init();
  },

  // USERS
  getUsers() {
    return JSON.parse(localStorage.getItem(DB_KEYS.USERS)) || [];
  },

  saveUser(user) {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
    return user;
  },

  getUserByUsername(username) {
    return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  // CURRENT SESSION
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
  getRoutes() {
    return JSON.parse(localStorage.getItem(DB_KEYS.ROUTES)) || [];
  },

  saveRoute(route) {
    const routes = this.getRoutes();
    routes.push(route);
    localStorage.setItem(DB_KEYS.ROUTES, JSON.stringify(routes));
    return route;
  },

  updateRouteCollected(routeId, collectedAdd) {
    const routes = this.getRoutes();
    const route = routes.find(r => r.id === routeId);
    if (route) {
      route.collected += collectedAdd;
      localStorage.setItem(DB_KEYS.ROUTES, JSON.stringify(routes));
    }
  },

  // CLIENTS
  getClients() {
    return JSON.parse(localStorage.getItem(DB_KEYS.CLIENTS)) || [];
  },

  getClientByCedula(cedula) {
    return this.getClients().find(c => c.cedula === cedula);
  },

  saveClient(client) {
    const clients = this.getClients();
    clients.push(client);
    localStorage.setItem(DB_KEYS.CLIENTS, JSON.stringify(clients));
    return client;
  },

  updateClientOutstanding(cedula, amountPaid) {
    const clients = this.getClients();
    const client = clients.find(c => c.cedula === cedula);
    if (client) {
      client.outstanding = Math.max(0, client.outstanding - amountPaid);
      localStorage.setItem(DB_KEYS.CLIENTS, JSON.stringify(clients));
    }
  },

  // PAYMENTS
  getPayments() {
    return JSON.parse(localStorage.getItem(DB_KEYS.PAYMENTS)) || [];
  },

  getPaymentsByClient(cedula) {
    return this.getPayments().filter(p => p.clientCedula === cedula);
  },

  addPayment(payment) {
    const payments = this.getPayments();
    payment.id = 'pay_' + (payments.length + 1) + '_' + Date.now();
    payment.signature = `BulaPay-SIG-${payment.clientCedula}-${Date.now().toString().slice(-4)}`;
    payments.push(payment);
    localStorage.setItem(DB_KEYS.PAYMENTS, JSON.stringify(payments));

    // Descontar saldo del cliente
    this.updateClientOutstanding(payment.clientCedula, payment.amount);

    // Sumar recaudo a la ruta del cliente
    const client = this.getClientByCedula(payment.clientCedula);
    if (client && client.routeId) {
      this.updateRouteCollected(client.routeId, payment.amount);
    }
    return payment;
  }
};

// Auto-inicializar la BD
db.init();

// Exportar globalmente para que otros módulos lo consuman
window.BulaPayDB = db;
