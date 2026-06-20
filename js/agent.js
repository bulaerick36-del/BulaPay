// Módulo del Agente / Cobrador (Vista Móvil Optimizada)

const agentModule = {
  currentClient: null,

  init() {
    this.tabCollect = document.getElementById('tab-agent-collect');
    this.tabRegister = document.getElementById('tab-agent-register');
    this.panelCollect = document.getElementById('panel-agent-collect');
    this.panelRegister = document.getElementById('panel-agent-register');
    
    // Búsqueda
    this.inputSearchCedula = document.getElementById('agent-search-cedula');
    this.btnSearch = document.getElementById('btn-agent-search');
    this.searchPlaceholder = document.getElementById('agent-search-placeholder');
    this.searchResults = document.getElementById('agent-search-results');

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
    this.updateAgentHeader();
  },

  bindEvents() {
    // Alternancia de Pestañas
    this.tabCollect.addEventListener('click', () => this.switchTab('collect'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));

    // Búsqueda de Cliente
    this.btnSearch.addEventListener('click', () => this.searchClient());
    this.inputSearchCedula.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchClient();
      }
    });

    // Registrar Pago
    this.btnSubmitCollect.addEventListener('click', () => this.registerPayment());

    // Registrar Cliente Nuevo
    this.formRegisterClient.addEventListener('submit', (e) => {
      e.preventDefault();
      this.registerNewClient();
    });

    // Acciones del modal WhatsApp
    this.btnCloseWaModal.addEventListener('click', () => {
      this.shareModal.classList.remove('active');
    });

    this.btnOpenLinkWa.addEventListener('click', () => {
      if (this.currentClient) {
        this.shareModal.classList.remove('active');
        // Navegar a la vista del cliente dentro de la SPA
        window.app.router.navigate('customer', this.currentClient.cedula);
      }
    });
  },

  updateAgentHeader() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    const agentNameElement = document.getElementById('agent-welcome-name');
    const agentRouteElement = document.getElementById('agent-active-route');

    if (currentUser && currentUser.role === 'Agente de Ruta') {
      if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
      
      const routes = window.BulaPayDB.getRoutes();
      const myRoute = routes.find(r => r.agentUsername === currentUser.username);
      
      if (agentRouteElement) {
        agentRouteElement.textContent = myRoute 
          ? `Ruta: ${myRoute.name} | Capital: $${myRoute.capital.toLocaleString('es-CO')}` 
          : 'Ruta no asignada';
      }
    } else {
      // Demo fallback
      if (agentNameElement) agentNameElement.textContent = 'Cobrador: Juan Pérez';
      if (agentRouteElement) agentRouteElement.textContent = 'Ruta Centro - Norte';
    }
  },

  switchTab(tab) {
    if (tab === 'collect') {
      this.tabCollect.classList.add('active');
      this.tabRegister.classList.remove('active');
      this.panelCollect.style.display = 'block';
      this.panelRegister.style.display = 'none';
    } else {
      this.tabRegister.classList.add('active');
      this.tabCollect.classList.remove('active');
      this.panelCollect.style.display = 'none';
      this.panelRegister.style.display = 'block';
    }
  },

  searchClient() {
    const cedula = this.inputSearchCedula.value.trim();
    if (!cedula) {
      alert('⚠️ Por favor ingrese un número de Cédula.');
      return;
    }

    const client = window.BulaPayDB.getClientByCedula(cedula);
    if (!client) {
      alert('❌ Cliente no registrado en el sistema BulaPay.');
      this.searchResults.style.display = 'none';
      this.searchPlaceholder.style.display = 'block';
      return;
    }

    this.renderClientInfo(client);
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
    this.detailOutstanding.textContent = `$${client.outstanding.toLocaleString('es-CO')}`;
    this.detailInstallment.textContent = `$${client.installmentAmount.toLocaleString('es-CO')}`;
    
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
    if (client.outstanding === 0) statusText = 'Crédito Cancelado';
    else if (client.risk === 'Amarillo') statusText = 'Atrasado';
    else if (client.risk === 'Rojo') statusText = 'Mora Severa';

    this.detailStatus.textContent = statusText;

    // Rellenar campo de monto de abono por defecto
    this.inputCollectAmount.value = Math.min(client.installmentAmount, client.outstanding);
  },

  registerPayment() {
    if (!this.currentClient) return;

    const amount = parseFloat(this.inputCollectAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('⚠️ Ingrese un valor válido de recaudo.');
      return;
    }

    if (amount > this.currentClient.outstanding) {
      alert(`⚠️ El monto ingresado supera el saldo pendiente de $${this.currentClient.outstanding.toLocaleString('es-CO')}`);
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    const newPayment = {
      clientCedula: this.currentClient.cedula,
      installmentNumber: window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula).length + 1,
      amount: amount,
      date: new Date().toISOString().split('T')[0],
      agentName: currentUser.name,
      status: amount >= this.currentClient.installmentAmount ? 'Pagado' : 'Abonado'
    };

    // Registrar en base de datos
    window.BulaPayDB.addPayment(newPayment);

    // Desplegar recibo digital premium
    window.showBulaPayReceipt(newPayment, this.currentClient);

    // Re-buscar el cliente para actualizar pantalla
    const updatedClient = window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
    this.renderClientInfo(updatedClient);
  },

  registerNewClient() {
    const name = document.getElementById('new-client-name').value.trim();
    const cedula = document.getElementById('new-client-cedula').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim();
    const email = document.getElementById('new-client-email').value.trim();
    const city = document.getElementById('new-client-city').value;
    const zone = document.getElementById('new-client-zone').value.trim();
    const debt = parseFloat(document.getElementById('new-client-debt').value);
    const installments = parseInt(document.getElementById('new-client-installments').value);

    // Validar existencia
    const existing = window.BulaPayDB.getClientByCedula(cedula);
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
    window.BulaPayDB.saveClient(newClient);
    this.currentClient = newClient;

    // Resetear formulario
    this.formRegisterClient.reset();

    // Mostrar modal simulador WhatsApp
    this.showWhatsAppMockup(newClient);
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
  }
};

window.agentModule = agentModule;
