// Módulo del Agente / Cobrador (Vista Móvil Optimizada)

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

    // Detalles Cliente Historial
    this.historyTrafficLight = document.getElementById('history-traffic-light');
    this.historyRiskStatus = document.getElementById('history-risk-status');
    this.historyRiskDot = document.getElementById('history-risk-dot');
    this.historyClientName = document.getElementById('history-client-name');
    this.historyClientCedulaVal = document.getElementById('history-client-cedula-val');
    this.historyClientRiskLabel = document.getElementById('history-client-risk-label');
    this.historyClientNote = document.getElementById('history-client-note');
    this.historyActiveCreditsAlert = document.getElementById('history-active-credits-alert');

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
    this.btnSubmitNoPago = document.getElementById('btn-submit-nopago');

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
    if (this.btnSubmitNoPago) {
      this.btnSubmitNoPago.addEventListener('click', () => this.registerNoPayment());
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
        // Navegar a la vista del cliente dentro de la SPA
        window.app.router.navigate('customer', this.currentClient.cedula);
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
    } else if (tab === 'register') {
      this.tabRegister.classList.add('active');
      this.panelRegister.style.display = 'block';
    }
  },

  verificarHistorialCliente(cedula) {
    if (!cedula) {
      alert('⚠️ Por favor ingrese un número de Cédula.');
      return;
    }

    // Ocultar placeholder y mostrar resultados
    this.historyPlaceholder.style.display = 'none';
    this.historyResults.style.display = 'block';

    // Rellenar cédula
    this.historyClientCedulaVal.textContent = cedula;

    // Resetear clases de semáforo
    this.historyTrafficLight.className = 'traffic-light-header';

    // Determinar nivel de riesgo con datos de prueba
    // Si termina en 1 o 2 -> Rojo
    // Si termina en 3 o 4 -> Amarillo
    // Si termina en cualquier otro -> Verde
    const lastDigit = cedula.charAt(cedula.length - 1);
    
    // Nombres ficticios para hacerlo realista
    const mockNames = {
      '1': 'Carlos Eduardo Restrepo',
      '2': 'María Camila Buendía',
      '3': 'Jairo Alonso Martínez',
      '4': 'Sandra Patricia Rojas',
      '5': 'Andrés Felipe Gómez',
      '6': 'Diana Marcela Torres',
      '7': 'Gustavo Adolfo Petro',
      '8': 'Gloria Isabel Ospina',
      '9': 'Héctor Fabio Valencia',
      '0': 'Leonor Inés Gutiérrez'
    };
    const name = mockNames[lastDigit] || 'Cliente de Prueba BulaPay';
    this.historyClientName.textContent = name;

    if (lastDigit === '1' || lastDigit === '2') {
      // 🔴 ROJO (Alto Riesgo)
      this.historyTrafficLight.classList.add('rojo');
      this.historyRiskStatus.textContent = '🔴 ROJO (Alto Riesgo)';
      this.historyClientRiskLabel.textContent = 'ROJO (Alto Riesgo)';
      this.historyClientRiskLabel.style.color = 'var(--color-rojo)';
      this.historyClientNote.textContent = 'No prestar, reportado en Maicao por mora severa.';
      
      // Alerta de Créditos Activos Globales
      this.historyActiveCreditsAlert.style.display = 'flex';
      this.historyActiveCreditsAlert.className = 'risk-alert-box'; // Red alert style
      this.historyActiveCreditsAlert.innerHTML = '⚠️ Cuidado: Este cliente ya tiene 3 créditos activos en la ruta El Molino.';
    } else if (lastDigit === '3' || lastDigit === '4') {
      // 🟡 AMARILLO (Riesgo Medio)
      this.historyTrafficLight.classList.add('amarillo');
      this.historyRiskStatus.textContent = '🟡 AMARILLO (Riesgo Medio)';
      this.historyClientRiskLabel.textContent = 'AMARILLO (Riesgo Medio)';
      this.historyClientRiskLabel.style.color = 'var(--color-amarillo)';
      this.historyClientNote.textContent = 'Cliente que pagó, pero con demoras constantes.';
      
      // Alerta de Créditos Activos Globales
      this.historyActiveCreditsAlert.style.display = 'flex';
      this.historyActiveCreditsAlert.className = 'risk-alert-box warning'; // Yellow alert style
      this.historyActiveCreditsAlert.innerHTML = '⚠️ Cuidado: Este cliente ya tiene 1 crédito activo en la ruta Valledupar.';
    } else {
      // 🟢 VERDE (Cliente Excelente)
      this.historyTrafficLight.classList.add('verde');
      this.historyRiskStatus.textContent = '🟢 VERDE (Cliente Excelente)';
      this.historyClientRiskLabel.textContent = 'VERDE (Cliente Excelente)';
      this.historyClientRiskLabel.style.color = 'var(--color-verde)';
      this.historyClientNote.textContent = 'Cliente puntual, apto para nuevos créditos.';
      
      // Ocultar alerta de créditos
      this.historyActiveCreditsAlert.style.display = 'none';
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
    const city = document.getElementById('new-client-city').value;
    const zone = document.getElementById('new-client-zone').value.trim();
    const debt = parseFloat(document.getElementById('new-client-debt').value);
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

  destroy() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }
};

window.agentModule = agentModule;
