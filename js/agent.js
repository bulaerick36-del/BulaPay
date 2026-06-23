// Módulo del Agente / Cobrador (Vista Móvil Optimizada)

const COLOMBIA_GEOGRAPHY = {
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Rionegro", "Apartadó", "Turbo", "Caucasia"],
  "Arauca": ["Arauca", "Tame", "Saravena"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanagrande", "Baranoa"],
  "Bolívar": ["Cartagena", "Magangué", "El Carmen de Bolívar", "Turbaco"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa"],
  "Caldas": ["Manizales", "La Dorada", "Chinchiná", "Riosucio"],
  "Caquetá": ["Florencia", "San Vicente del Caguán"],
  "Casanare": ["Yopal", "Aguazul", "Villanueva"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada"],
  "Cesar": ["Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia"],
  "Chocó": ["Quibdó", "Istmina", "Condoto"],
  "Córdoba": ["Montería", "Cereté", "Sahagún", "Lorica", "Montelíbano"],
  "Cundinamarca": ["Bogotá", "Soacha", "Facatativá", "Chía", "Zipaquirá", "Fusagasugá", "Girardot"],
  "Guainía": ["Inírida"],
  "Guaviare": ["San José del Guaviare"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "San Juan del Cesar", "Villanueva"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López"],
  "Nariño": ["Pasto", "Tumaco", "Ipiales", "Túquerres"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Pamplona", "Villa del Rosario"],
  "Putumayo": ["Mocoa", "Orito", "Puerto Asís"],
  "Quindío": ["Armenia", "Calarcá", "Montenegro", "Quimbaya"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil"],
  "Sucre": ["Sincelejo", "Corozal", "San Marcos"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Mariquita", "Líbano"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Yumbo", "Buga", "Cartago"],
  "Vaupés": ["Mitú"],
  "Vichada": ["Puerto Carreño"]
};

const agentModule = {
  currentClient: null,

  async init() {
    this.tabCollect = document.getElementById('tab-agent-collect');
    this.tabHistory = document.getElementById('tab-agent-history');
    this.tabRegister = document.getElementById('tab-agent-register');
    this.panelCollect = document.getElementById('panel-agent-collect');
    this.panelHistory = document.getElementById('panel-agent-history');
    this.panelRegister = document.getElementById('panel-agent-register');
    
    // Búsqueda
    this.inputSearchCedula = document.getElementById('agent-search-cedula');
    this.btnSearch = document.getElementById('btn-agent-search');
    this.searchPlaceholder = document.getElementById('agent-search-placeholder');
    this.searchResults = document.getElementById('agent-search-results');

    // Búsqueda Historial
    this.inputHistoryCedula = document.getElementById('agent-history-cedula');
    this.btnHistorySearch = document.getElementById('btn-agent-history-search');
    this.historyPlaceholder = document.getElementById('agent-history-placeholder');
    this.historyResults = document.getElementById('agent-history-results');
    this.historyError = document.getElementById('agent-history-error');

    // Detalles Cliente Historial
    this.historyTrafficLight = document.getElementById('history-traffic-light');
    this.historyRiskStatus = document.getElementById('history-risk-status');
    this.historyRiskDot = document.getElementById('history-risk-dot');
    this.historyClientName = document.getElementById('history-client-name');
    this.historyClientCedulaVal = document.getElementById('history-client-cedula-val');
    this.historyClientRiskLabel = document.getElementById('history-client-risk-label');
    this.historyClientNote = document.getElementById('history-client-note');
    this.historyActiveCreditsAlert = document.getElementById('history-active-credits-alert');

    // Cartón de Pagos Modal
    this.btnOpenPaymentCard = document.getElementById('btn-agent-register-installment');
    this.paymentCardModal = document.getElementById('agent-payment-card-modal');
    this.btnClosePaymentCard = document.getElementById('btn-close-payment-card');
    this.paymentCardGrid = document.getElementById('payment-card-grid');
    this.paymentCardClientName = document.getElementById('payment-card-client-name');
    this.paymentCardClientCedula = document.getElementById('payment-card-client-cedula');
    this.paymentCardClientOutstanding = document.getElementById('payment-card-client-outstanding');
    this.btnPaymentCardNoPago = document.getElementById('btn-payment-card-nopago');

    // Detalles Cliente
    this.riskHeader = document.getElementById('client-traffic-light');
    this.riskStatus = document.getElementById('client-risk-status');
    this.riskDot = document.getElementById('client-risk-dot');
    this.detailName = document.getElementById('client-detail-name');
    this.detailCedula = document.getElementById('client-detail-cedula');
    this.detailPhone = document.getElementById('client-detail-phone');
    this.detailStatus = document.getElementById('client-detail-status');
    this.detailInstallment = document.getElementById('client-detail-installment');
    this.detailOutstanding = document.getElementById('client-detail-outstanding');

    // Recaudo
    this.inputCollectAmount = document.getElementById('collect-amount');
    this.btnSubmitCollect = document.getElementById('btn-submit-collect');

    // Registro
    this.formRegisterClient = document.getElementById('form-register-client');

    // Modal WhatsApp
    this.shareModal = document.getElementById('notification-share-modal');
    this.waAvatar = document.getElementById('wa-avatar');
    this.waName = document.getElementById('wa-name');
    this.waLinkUrl = document.getElementById('wa-link-url');
    this.btnCloseWaModal = document.getElementById('btn-close-wa-modal');
    this.btnOpenLinkWa = document.getElementById('btn-open-link-wa');

    this.bindEvents();
    await this.updateAgentHeader();
    this.initGeography();
    this.initCalculator();

    // Geolocalización del agente (inicial y periódico cada 5 min)
    this.captureAndSendLocation();
    if (this.locationInterval) clearInterval(this.locationInterval);
    this.locationInterval = setInterval(() => this.captureAndSendLocation(), 5 * 60 * 1000);
  },

  bindEvents() {
    // Alternancia de Pestañas
    this.tabCollect.addEventListener('click', () => this.switchTab('collect'));
    this.tabHistory.addEventListener('click', () => this.switchTab('history'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));

    // Búsqueda de Cliente
    this.btnSearch.addEventListener('click', () => this.searchClient());
    this.inputSearchCedula.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchClient();
      }
    });

    // Búsqueda de Historial
    this.btnHistorySearch.addEventListener('click', () => {
      const cedula = this.inputHistoryCedula.value.trim();
      this.verificarHistorialCliente(cedula);
    });
    this.inputHistoryCedula.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const cedula = this.inputHistoryCedula.value.trim();
        this.verificarHistorialCliente(cedula);
      }
    });

    // Registrar Pago
    this.btnSubmitCollect.addEventListener('click', () => this.registerPayment());

    // Cartón de Pagos
    if (this.btnOpenPaymentCard) {
      this.btnOpenPaymentCard.addEventListener('click', () => this.openPaymentCard());
    }
    if (this.btnClosePaymentCard) {
      this.btnClosePaymentCard.addEventListener('click', () => this.closePaymentCard());
    }
    if (this.btnPaymentCardNoPago) {
      this.btnPaymentCardNoPago.addEventListener('click', () => {
        this.closePaymentCard();
        this.registerNoPayment();
      });
    }

    // Registrar Cliente Nuevo
    this.formRegisterClient.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.registerNewClient();
    });

    // Acciones del modal WhatsApp
    this.btnCloseWaModal.addEventListener('click', () => {
      this.shareModal.classList.remove('active');
    });

    this.btnOpenLinkWa.addEventListener('click', () => {
      if (this.currentClient) {
        this.shareModal.classList.remove('active');
        
        // URL dinámica del portal del cliente
        const appUrl = `${window.location.origin}${window.location.pathname}?view=customer&id=${this.currentClient.cedula}`;
        
        // Mensaje pre-armado
        const message = `👋 ¡Hola ${this.currentClient.name}! Le damos la bienvenida a BulaPay. Hemos registrado su venta a plazos. Consulte su estado de cartera y realice el seguimiento de sus pagos en su Cartón Digital personalizado aquí: ${appUrl}`;
        
        // Enlace click-to-chat de WhatsApp
        const waUrl = `https://wa.me/${this.currentClient.phone.replace(/[\s+]/g, '')}?text=${encodeURIComponent(message)}`;
        
        window.open(waUrl, '_blank');
      }
    });
  },

  async updateAgentHeader() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    const agentNameElement = document.getElementById('agent-welcome-name');
    const agentRouteElement = document.getElementById('agent-active-route');

    if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent')) {
      if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
      
      const routes = await window.BulaPayDB.getRoutes();
      const myRoute = routes.find(r => r.agentUsername && r.agentUsername.split(', ').map(u => u.trim()).includes(currentUser.username));
      
      if (agentRouteElement) {
        agentRouteElement.textContent = myRoute 
          ? `Ruta: ${myRoute.name} | Capital: $${Number(myRoute.capital).toLocaleString('es-CO')}` 
          : 'Ruta no asignada';
      }
    } else {
      // Generic fallback
      if (agentNameElement) agentNameElement.textContent = 'Cobrador: Juan Pérez';
      if (agentRouteElement) agentRouteElement.textContent = 'Ruta Centro - Norte';
    }
  },

  switchTab(tab) {
    this.tabCollect.classList.remove('active');
    this.tabHistory.classList.remove('active');
    this.tabRegister.classList.remove('active');
    this.panelCollect.style.display = 'none';
    this.panelHistory.style.display = 'none';
    this.panelRegister.style.display = 'none';

    if (tab === 'collect') {
      this.tabCollect.classList.add('active');
      this.panelCollect.style.display = 'block';
    } else if (tab === 'history') {
      this.tabHistory.classList.add('active');
      this.panelHistory.style.display = 'block';
      this.historyResults.style.display = 'none';
      this.historyError.style.display = 'none';
      this.historyPlaceholder.style.display = 'block';
      this.inputHistoryCedula.value = '';
    } else if (tab === 'register') {
      this.tabRegister.classList.add('active');
      this.panelRegister.style.display = 'block';
    }
  },

  async verificarHistorialCliente(cedula) {
    if (!cedula) {
      alert('⚠️ Por favor ingrese un número de Cédula.');
      return;
    }

    // Estado de Cargando...
    this.historyPlaceholder.style.display = 'none';
    this.historyError.style.display = 'none';
    this.historyResults.style.display = 'block';
    this.historyClientCedulaVal.textContent = cedula;
    this.historyClientName.textContent = 'Cargando...';
    this.historyClientRiskLabel.textContent = 'Cargando...';
    this.historyClientRiskLabel.style.color = 'var(--text-secondary)';
    this.historyClientNote.textContent = 'Consultando base de datos central de BulaPay en Supabase...';
    this.historyActiveCreditsAlert.style.display = 'none';
    this.historyTrafficLight.className = 'traffic-light-header';
    this.historyRiskStatus.textContent = '⏳ Buscando historial...';

    try {
      const client = await window.BulaPayDB.getGlobalClientByCedula(cedula);
      
      if (!client) {
        // Cliente NO existe: Ocultar resultados y mostrar error visual rojo
        this.historyResults.style.display = 'none';
        this.historyError.style.display = 'block';
        return;
      }

      // Cliente SÍ existe: Mostrar Nombre Real
      this.historyResults.style.display = 'block';
      this.historyError.style.display = 'none';
      this.historyClientName.textContent = client.name;

      const hasOutstanding = Number(client.outstanding) > 0;
      const isRojo = client.risk === 'Rojo';

      if (hasOutstanding && isRojo) {
        // 🔴 ROJO: Crédito en mora
        this.historyTrafficLight.className = 'traffic-light-header rojo';
        this.historyRiskStatus.textContent = '🔴 ROJO (Alto Riesgo)';
        this.historyClientRiskLabel.textContent = 'ROJO (Alto Riesgo)';
        this.historyClientRiskLabel.style.color = 'var(--color-rojo)';
        this.historyClientNote.textContent = 'No prestar, reportado en Maicao por deudas caídas / mora severa.';
        
        // Consultar la ruta del crédito activo
        const route = client.routeId ? await window.BulaPayDB.getGlobalRouteById(client.routeId) : null;
        const routeName = route ? route.name : 'Ruta Desconocida';
        
        this.historyActiveCreditsAlert.style.display = 'flex';
        this.historyActiveCreditsAlert.className = 'risk-alert-box'; // Red style
        this.historyActiveCreditsAlert.innerHTML = `⚠️ Cuidado: Este cliente tiene una deuda activa de $${Number(client.outstanding).toLocaleString('es-CO')} en la ruta "${routeName}" (${client.city}).`;
      } else if (hasOutstanding && !isRojo) {
        // 🟡 AMARILLO: Crédito activo al día
        this.historyTrafficLight.className = 'traffic-light-header amarillo';
        this.historyRiskStatus.textContent = '🟡 AMARILLO (Riesgo Medio)';
        this.historyClientRiskLabel.textContent = 'AMARILLO (Riesgo Medio)';
        this.historyClientRiskLabel.style.color = 'var(--color-amarillo)';
        this.historyClientNote.textContent = 'Cliente que pagó, pero tiene deudas o demoras constantes en la plataforma.';
        
        // Consultar la ruta del crédito activo
        const route = client.routeId ? await window.BulaPayDB.getGlobalRouteById(client.routeId) : null;
        const routeName = route ? route.name : 'Ruta Desconocida';
        
        this.historyActiveCreditsAlert.style.display = 'flex';
        this.historyActiveCreditsAlert.className = 'risk-alert-box warning'; // Yellow style
        this.historyActiveCreditsAlert.innerHTML = `⚠️ Cuidado: Este cliente ya tiene un crédito activo de $${Number(client.outstanding).toLocaleString('es-CO')} en la ruta "${routeName}" (${client.city}).`;
      } else {
        // 🟢 VERDE: Todos los créditos pagados y cerrados
        this.historyTrafficLight.className = 'traffic-light-header verde';
        this.historyRiskStatus.textContent = '🟢 VERDE (Cliente Excelente)';
        this.historyClientRiskLabel.textContent = 'VERDE (Cliente Excelente)';
        this.historyClientRiskLabel.style.color = 'var(--color-verde)';
        this.historyClientNote.textContent = 'Cliente puntual, apto para nuevos créditos. Todos los créditos están cancelados.';
        this.historyActiveCreditsAlert.style.display = 'none';
      }
    } catch (err) {
      console.error("Error al consultar Supabase:", err);
      alert('❌ Error al consultar la central de riesgos.');
      this.historyPlaceholder.style.display = 'block';
      this.historyResults.style.display = 'none';
      this.historyError.style.display = 'none';
    }
  },

  async openPaymentCard() {
    if (!this.currentClient) {
      alert('⚠️ Por favor busque un cliente primero.');
      return;
    }

    // Rellenar datos del cliente en el modal
    this.paymentCardClientName.textContent = this.currentClient.name;
    this.paymentCardClientCedula.textContent = this.currentClient.cedula;
    this.paymentCardClientOutstanding.textContent = `$${Number(this.currentClient.outstanding).toLocaleString('es-CO')}`;

    // Renderizar la cuadrícula
    await this.renderPaymentCardGrid();

    // Mostrar el modal overlay
    this.paymentCardModal.style.display = 'flex';
  },

  closePaymentCard() {
    this.paymentCardModal.style.display = 'none';
  },

  async renderPaymentCardGrid() {
    this.paymentCardGrid.innerHTML = '';
    
    const client = this.currentClient;
    const totalInstallments = client.installmentsCount || 5;
    const installmentAmount = client.installmentAmount || 100000;
    
    // Obtener los pagos reales desde Supabase
    const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
    
    // Mapear los números de cuotas que ya han sido pagadas
    const paidInstallments = payments
      .filter(p => p.status === 'Pagado' || p.status === 'Abonado' || Number(p.amount) > 0)
      .map(p => p.installmentNumber);

    // Ajustar fecha de creación del crédito para estimar los atrasos
    let creditDate = new Date(client.created_at || Date.now());
    if (payments.length > 0) {
      const earliestPayDate = new Date(Math.min(...payments.map(p => new Date(p.date))));
      if (earliestPayDate < creditDate) {
        creditDate = new Date(earliestPayDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      }
    }

    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 1; i <= totalInstallments; i++) {
      const cell = document.createElement('div');
      cell.classList.add('payment-card-cell');
      
      // Calcular fecha de vencimiento (una cuota por semana)
      const dueDate = new Date(creditDate);
      dueDate.setDate(creditDate.getDate() + (i * 7));
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      const isPaid = paidInstallments.includes(i);
      
      if (isPaid) {
        cell.classList.add('pagado');
        cell.innerHTML = `Cuota ${i}<br>✔`;
      } else {
        // ¿Vencida? Si la fecha de vencimiento es anterior a hoy
        const isOverdue = dueDateOnly < todayDateOnly;
        if (isOverdue) {
          cell.classList.add('atrasado');
          cell.innerHTML = `Cuota ${i}<br>⚠️`;
        } else {
          cell.classList.add('pendiente');
          cell.innerHTML = `Cuota ${i}<br>$${Number(installmentAmount).toLocaleString('es-CO')}`;
        }

        // Registrar acción al hacer click
        cell.addEventListener('click', async () => {
          if (confirm(`¿Confirmar pago de cuota ${i} por $${Number(installmentAmount).toLocaleString('es-CO')}?`)) {
            await this.payInstallmentFromCard(i, installmentAmount);
          }
        });
      }
      
      this.paymentCardGrid.appendChild(cell);
    }
  },

  async payInstallmentFromCard(installmentNumber, amount) {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: installmentNumber,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        agentName: currentUser.name,
        status: 'Pagado'
      };

      // Registrar el pago en Supabase y actualizar el saldo del cliente
      const savedPayment = await window.BulaPayDB.addPayment(newPayment);

      // Reportar geolocalización
      this.captureAndSendLocation();

      // Mostrar recibo digital
      window.showBulaPayReceipt(savedPayment, this.currentClient);

      // Re-consultar los datos del cliente actualizados
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      // Actualizar la interfaz principal del cobrador
      this.renderClientInfo(updatedClient);

      // Refrescar el Cartón de Pagos
      await this.renderPaymentCardGrid();
      
      // Actualizar saldo mostrado en el modal
      this.paymentCardClientOutstanding.textContent = `$${Number(updatedClient.outstanding).toLocaleString('es-CO')}`;
      
    } catch (err) {
      console.error("Error al pagar cuota desde cartón:", err);
      alert('❌ Error al registrar el pago de la cuota.');
    }
  },

  async searchClient() {
    const cedula = this.inputSearchCedula.value.trim();
    if (!cedula) {
      alert('⚠️ Por favor ingrese un número de Cédula.');
      return;
    }

    try {
      const client = await window.BulaPayDB.getClientByCedula(cedula);
      if (!client) {
        alert('❌ Cliente no registrado en el sistema BulaPay.');
        this.searchResults.style.display = 'none';
        this.searchPlaceholder.style.display = 'block';
        return;
      }

      this.renderClientInfo(client);
    } catch (err) {
      console.error(err);
      alert('❌ Error al buscar cliente.');
    }
  },

  renderClientInfo(client) {
    this.currentClient = client;
    
    // Ocultar placeholder y mostrar resultados
    this.searchPlaceholder.style.display = 'none';
    this.searchResults.style.display = 'block';

    // Rellenar Info
    this.detailName.textContent = client.name;
    this.detailCedula.textContent = client.cedula;
    this.detailPhone.textContent = client.phone;
    this.detailOutstanding.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
    this.detailInstallment.textContent = `$${Number(client.installmentAmount).toLocaleString('es-CO')}`;
    
    // Semáforo de Riesgo
    this.riskHeader.className = 'traffic-light-header'; // Reset
    
    if (client.risk === 'Verde') {
      this.riskHeader.classList.add('verde');
      this.riskStatus.textContent = '🟢 Cliente Excelente (Al Día)';
    } else if (client.risk === 'Amarillo') {
      this.riskHeader.classList.add('amarillo');
      this.riskStatus.textContent = '🟡 Pago con Retrasos (Riesgo Medio)';
    } else if (client.risk === 'Rojo') {
      this.riskHeader.classList.add('rojo');
      this.riskStatus.textContent = '🔴 Cartera Castigada (Alto Riesgo)';
    }

    // Estado de Cartera texto explicativo
    let statusText = 'Al Día';
    if (Number(client.outstanding) === 0) statusText = 'Crédito Cancelado';
    else if (client.risk === 'Amarillo') statusText = 'Atrasado';
    else if (client.risk === 'Rojo') statusText = 'Mora Severa';

    this.detailStatus.textContent = statusText;

    // Rellenar campo de monto de abono por defecto
    this.inputCollectAmount.value = Math.min(Number(client.installmentAmount), Number(client.outstanding));
  },

  async registerPayment() {
    if (!this.currentClient) return;

    const amount = parseFloat(this.inputCollectAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('⚠️ Ingrese un valor válido de recaudo.');
      return;
    }

    if (amount > Number(this.currentClient.outstanding)) {
      alert(`⚠️ El monto ingresado supera el saldo pendiente de $${Number(this.currentClient.outstanding).toLocaleString('es-CO')}`);
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: payments.length + 1,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        agentName: currentUser.name,
        status: amount >= Number(this.currentClient.installmentAmount) ? 'Pagado' : 'Abonado'
      };

      // Registrar en base de datos
      const savedPayment = await window.BulaPayDB.addPayment(newPayment);

      // Reportar ubicación
      this.captureAndSendLocation();

      // Desplegar recibo digital premium
      window.showBulaPayReceipt(savedPayment, this.currentClient);

      // Re-buscar el cliente para actualizar pantalla
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.renderClientInfo(updatedClient);
    } catch (err) {
      console.error(err);
      alert('❌ Error al registrar el pago.');
    }
  },

  async registerNoPayment() {
    if (!this.currentClient) return;

    if (!confirm(`¿Está seguro de que desea registrar un No Pago para el cliente ${this.currentClient.name} el día de hoy?`)) {
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: payments.length + 1,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        agentName: currentUser.name,
        status: 'No Pago'
      };

      // Registrar en base de datos
      const savedPayment = await window.BulaPayDB.addPayment(newPayment);

      // Reportar ubicación
      this.captureAndSendLocation();

      // Desplegar recibo digital premium
      window.showBulaPayReceipt(savedPayment, this.currentClient);

      // Re-buscar el cliente para actualizar pantalla
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.renderClientInfo(updatedClient);
    } catch (err) {
      console.error(err);
      alert('❌ Error al registrar el no pago.');
    }
  },

  async registerNewClient() {
    const name = document.getElementById('new-client-name').value.trim();
    const cedula = document.getElementById('new-client-cedula').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim();
    const email = document.getElementById('new-client-email').value.trim();
    const department = document.getElementById('new-client-department').value;
    const cityVal = document.getElementById('new-client-city').value;
    const city = department ? `${department} - ${cityVal}` : cityVal;
    const zone = document.getElementById('new-client-zone').value.trim();
    const debtRaw = document.getElementById('new-client-debt').value.replace(/\./g, '');
    const debt = parseFloat(debtRaw) || 0;
    const installments = parseInt(document.getElementById('new-client-installments').value);

    try {
      // Validar existencia
      const existing = await window.BulaPayDB.getClientByCedula(cedula);
      if (existing) {
        alert('❌ Ya existe un cliente registrado con esta Cédula.');
        return;
      }

      const currentUser = window.BulaPayDB.getCurrentUser();
      const routeId = currentUser && currentUser.routeId ? currentUser.routeId : 'route_1';

      const newClient = {
        cedula,
        name,
        phone,
        email,
        city,
        zone,
        risk: 'Verde', // Inicia excelente
        totalDebt: debt,
        outstanding: debt,
        installmentsCount: installments,
        installmentAmount: Math.round(debt / installments),
        routeId
      };

      // Guardar
      await window.BulaPayDB.saveClient(newClient);
      this.currentClient = newClient;

      // Envío de email de bienvenida (Resend placeholder)
      this.sendWelcomeEmail(newClient);

      // Resetear formulario
      this.formRegisterClient.reset();

      // Mostrar modal simulador WhatsApp
      this.showWhatsAppMockup(newClient);
    } catch (err) {
      console.error(err);
      alert('❌ Error al registrar el cliente.');
    }
  },

  showWhatsAppMockup(client) {
    if (!this.shareModal) return;

    this.waAvatar.textContent = client.name.charAt(0);
    this.waName.textContent = client.name;
    
    // URL dinámica que simula el enlace del cliente
    const appUrl = `${window.location.origin}${window.location.pathname}?view=customer&id=${client.cedula}`;
    this.waLinkUrl.href = appUrl;
    this.waLinkUrl.textContent = appUrl;

    // Activar modal
    this.shareModal.classList.add('active');
  },

  async captureAndSendLocation() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await window.BulaPayDB.updateUserLocation(currentUser.username, latitude, longitude);
          console.log(`[GPS] Ubicación reportada: ${latitude}, ${longitude}`);
        } catch (e) {
          console.warn("Fallo al actualizar geolocalización en Supabase:", e);
        }
      },
      (error) => {
        console.warn("Permiso de geolocalización denegado o error de lectura:", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  initGeography() {
    const deptSelect = document.getElementById('new-client-department');
    const citySelect = document.getElementById('new-client-city');
    if (!deptSelect || !citySelect) return;

    // Llenar departamentos
    deptSelect.innerHTML = '<option value="" disabled selected>Seleccione Departamento...</option>';
    Object.keys(COLOMBIA_GEOGRAPHY).sort().forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      deptSelect.appendChild(opt);
    });

    // Llenar ciudades cuando cambie departamento
    deptSelect.addEventListener('change', () => {
      const selectedDept = deptSelect.value;
      citySelect.innerHTML = '<option value="" disabled selected>Seleccione Municipio / Ciudad...</option>';
      const cities = COLOMBIA_GEOGRAPHY[selectedDept] || [];
      cities.sort().forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    });
  },

  initCalculator() {
    const capitalInput = document.getElementById('new-client-capital');
    const interestInput = document.getElementById('new-client-interest-percent');
    const debtInput = document.getElementById('new-client-debt');
    const installmentsInput = document.getElementById('new-client-installments');
    const installmentValInput = document.getElementById('new-client-installment-val');

    if (!capitalInput || !interestInput || !debtInput || !installmentsInput || !installmentValInput) return;

    const formatNumber = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const calculate = () => {
      const capitalRaw = capitalInput.value.replace(/\./g, '');
      const capital = parseFloat(capitalRaw) || 0;
      const interest = parseFloat(interestInput.value) || 0;
      const installments = parseInt(installmentsInput.value) || 1;

      const totalDebt = Math.round(capital + (capital * (interest / 100)));
      const installmentVal = Math.round(totalDebt / installments);

      debtInput.value = totalDebt ? formatNumber(totalDebt) : "";
      installmentValInput.value = installmentVal ? formatNumber(installmentVal) : "";
    };

    capitalInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      e.target.value = val ? formatNumber(val) : '';
      calculate();
    });

    interestInput.addEventListener('input', calculate);
    installmentsInput.addEventListener('input', calculate);
  },

  sendWelcomeEmail(clientData) {
    console.log("[EMAIL SENDER PLACEHOLDER - RESEND INTEGRATION FUTURE]");
    console.log("Datos de bienvenida del cliente:", clientData);
  },

  destroy() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }
};

window.agentModule = agentModule;
