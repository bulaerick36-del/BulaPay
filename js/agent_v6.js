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

let activeGeography = null;

function normalizeName(str) {
  return str.trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
}

async function fetchColombiaGeography() {
  if (activeGeography) return activeGeography;

  const cached = localStorage.getItem('colombia_geography_cached');
  if (cached) {
    try {
      activeGeography = JSON.parse(cached);
      return activeGeography;
    } catch (e) {}
  }

  // Lista de APIs oficiales y de respaldo
  const urls = [
    'https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json',
    'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000',
    'https://www.datos.gov.co/resource/xdk5-pm3f.json?$limit=5000'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const map = {};

        if (Array.isArray(data) && data.length > 0) {
          // Formato marcovega: [{"departamento": "...", "ciudades": [...]}]
          if (data[0].ciudades && Array.isArray(data[0].ciudades)) {
            data.forEach(item => {
              if (item.departamento && item.ciudades) {
                const dptoNorm = normalizeName(item.departamento);
                map[dptoNorm] = item.ciudades.map(city => normalizeName(city));
              }
            });
          } 
          // Formato DIVIPOLA / Datos Abiertos: [{"dpto": "...", "nom_mpio": "..."}]
          else {
            const firstRow = data[0];
            const deptKey = firstRow.dpto ? 'dpto' : (firstRow.departamento ? 'departamento' : null);
            const mpioKey = firstRow.nom_mpio ? 'nom_mpio' : (firstRow.municipio ? 'municipio' : null);

            if (deptKey && mpioKey) {
              data.forEach(item => {
                let dpto = item[deptKey];
                let mpio = item[mpioKey];
                if (dpto && mpio) {
                  dpto = normalizeName(dpto);
                  mpio = normalizeName(mpio);

                  if (!map[dpto]) {
                    map[dpto] = [];
                  }
                  if (!map[dpto].includes(mpio)) {
                    map[dpto].push(mpio);
                  }
                }
              });
            }
          }

          if (Object.keys(map).length > 20) {
            activeGeography = map;
            localStorage.setItem('colombia_geography_cached', JSON.stringify(map));
            return map;
          }
        }
      }
    } catch (err) {
      console.warn(`Error al obtener geografía colombiana desde ${url}:`, err);
    }
  }

  // Fallback
  activeGeography = COLOMBIA_GEOGRAPHY;
  return activeGeography;
}

const agentModule = {
  currentClient: null,
  isMassPaymentMode: false,
  selectedInstallments: [],

  async init() {
    this.tabCollect = document.getElementById('tab-agent-collect');
    this.tabHistory = document.getElementById('tab-agent-history');
    this.tabRegister = document.getElementById('tab-agent-register');
    this.panelCollect = document.getElementById('panel-agent-collect');
    this.panelHistory = document.getElementById('panel-agent-history');
    this.panelRegister = document.getElementById('panel-agent-register');
    
    // Búsqueda
    this.inputSearchCedula = document.getElementById('cobrar-search-input');
    this.btnSearch = document.getElementById('btn-agent-search');
    this.searchPlaceholder = document.getElementById('agent-search-placeholder');
    this.searchError = document.getElementById('agent-search-error');

    // Vista Aislada de Cobro
    this.cobroActionContainer = document.getElementById('cobro-action-container');
    this.cobroClientName = document.getElementById('cobro-client-name');
    this.cobroClientOutstanding = document.getElementById('cobro-client-outstanding');
    this.inputCobroAmount = document.getElementById('input-cobro-amount');
    
    // Contenedores Flujo A y Flujo B
    this.cobroInputState = document.getElementById('cobro-input-state');
    this.cobroCartonState = document.getElementById('cobro-carton-state');
    this.cobroOverdueDaysList = document.getElementById('cobro-overdue-days-list');
    
    // Botones
    this.btnCobroInvoice = document.getElementById('btn-cobro-invoice');
    this.btnCobroCarton = document.getElementById('btn-cobro-carton');
    this.btnCobroBack = document.getElementById('btn-cobro-back');
    this.btnLiquidarCarton = document.getElementById('btn-liquidar-carton');
    
    // Modal Factura
    this.cobroInvoiceModal = document.getElementById('cobro-invoice-modal');
    this.invoiceClientName = document.getElementById('invoice-client-name');
    this.invoiceAmount = document.getElementById('invoice-amount');
    this.invoiceNewBalance = document.getElementById('invoice-new-balance');
    this.btnInvoiceConfirm = document.getElementById('btn-invoice-confirm');
    this.btnInvoiceCancel = document.getElementById('btn-invoice-cancel');

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
    this.historyActiveCreditsAlert = document.getElementById('history-active-credits-alert');

    // Cartón de Pagos Modal
    this.btnOpenPaymentCard = document.getElementById('btn-agent-view-carton');
    this.btnRegisterInstallment = document.getElementById('btn-agent-register-installment');
    this.paymentCardModal = document.getElementById('agent-payment-card-modal');
    this.btnClosePaymentCard = document.getElementById('btn-close-payment-card');
    this.paymentCardGrid = document.getElementById('payment-card-grid');
    this.paymentCardClientName = document.getElementById('payment-card-client-name');
    this.paymentCardClientCedula = document.getElementById('payment-card-client-cedula');
    this.paymentCardClientOutstanding = document.getElementById('payment-card-client-outstanding');
    this.btnPaymentCardNoPago = document.getElementById('btn-payment-card-nopago');
    this.massPaymentSwitch = document.getElementById('mass-payment-switch');
    this.btnProcessMassPayment = document.getElementById('btn-process-mass-payment');

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
    this.btnSendEmailWa = document.getElementById('btn-send-email-wa');

    this.bindEvents();
    await this.updateAgentHeader();
    await this.updateRouteTracking();
    this.initGeography();
    this.initCalculator();
    await this.populateAgentSelector();

    // Geolocalización y monitoreo constante en tiempo real (cada 30 segundos con watchPosition)
    this.startLocationMonitoring();

    // Si el acceso está bloqueado, aplicar el bloqueo visual de inmediato
    if (window.gpsBlocked) {
      if (this.panelCollect) this.panelCollect.style.setProperty('display', 'none', 'important');
      const blockedPanel = document.getElementById('gps-blocked-panel');
      if (blockedPanel) blockedPanel.style.display = 'flex';
    }
  },

  bindEvents() {
    // Alternancia de Pestañas
    this.tabCollect.addEventListener('click', () => this.switchTab('collect'));
    this.tabHistory.addEventListener('click', () => this.switchTab('history'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));

    // Botón Búsqueda Cobro
    if (this.btnSearch) {
      this.btnSearch.addEventListener('click', () => this.searchClient());
    }
    if (this.inputSearchCedula) {
      this.inputSearchCedula.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchClient();
      });
    }

    // Botones Flujo Doble (Factura y Cartón)
    if (this.btnCobroInvoice) {
      this.btnCobroInvoice.addEventListener('click', () => this.handleInvoiceRequest());
    }
    if (this.btnCobroCarton) {
      this.btnCobroCarton.addEventListener('click', () => {
        if (this.cobroInputState && this.cobroCartonState) {
          this.cobroInputState.style.setProperty('display', 'none', 'important');
          this.cobroCartonState.style.setProperty('display', 'block', 'important');
        }
      });
    }
    if (this.btnCobroBack) {
      this.btnCobroBack.addEventListener('click', () => {
        if (this.cobroInputState && this.cobroCartonState) {
          this.cobroCartonState.style.setProperty('display', 'none', 'important');
          this.cobroInputState.style.setProperty('display', 'block', 'important');
        }
      });
    }
    
    if (this.btnLiquidarCarton) {
      this.btnLiquidarCarton.addEventListener('click', () => {
        alert('🎉 ¡Cartón Liquidado Exitosamente! Todas las 30 cuotas han sido cubiertas.');
        if (this.cobroCartonState && this.cobroInputState) {
          this.cobroCartonState.style.setProperty('display', 'none', 'important');
          this.cobroInputState.style.setProperty('display', 'block', 'important');
        }
        if (this.inputCobroCedula) this.inputCobroCedula.value = '';
        if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'flex';
        if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'none', 'important');
      });
    }

    // Botones Modal Factura
    if (this.btnInvoiceConfirm) {
      this.btnInvoiceConfirm.addEventListener('click', () => {
        this.cobroInvoiceModal.style.display = 'none';
        this.executePaymentTransaction();
      });
    }
    if (this.btnInvoiceCancel) {
      this.btnInvoiceCancel.addEventListener('click', () => {
        this.cobroInvoiceModal.style.display = 'none';
      });
    }

    // Historial
    if (this.btnHistorySearch) {
      this.btnHistorySearch.addEventListener('click', () => {
        const cedula = this.inputHistoryCedula.value.trim();
        this.verificarHistorialCliente(cedula);
      });
    }
    this.inputHistoryCedula.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const cedula = this.inputHistoryCedula.value.trim();
        this.verificarHistorialCliente(cedula);
      }
    });

    // Búsqueda Rápida (Header)
    const inputQuickSearch = document.getElementById('header-search-input');
    const btnQuickSearch = document.getElementById('btn-quick-search');
    const executeQuickSearch = () => {
      if (!inputQuickSearch) return;
      const cedula = inputQuickSearch.value.trim();
      if (!cedula) return;
      executeGlobalSearchModal(cedula);
      inputQuickSearch.value = ''; // limpiar
    };
    
    const executeGlobalSearchModal = async (cedula) => {
      const modal = document.getElementById('global-search-modal');
      const statusDiv = document.getElementById('global-search-status');
      const resultsDiv = document.getElementById('global-search-results');
      const nameEl = document.getElementById('global-search-name');
      const cedulaEl = document.getElementById('global-search-cedula');
      const phoneEl = document.getElementById('global-search-phone');
      const cityEl = document.getElementById('global-search-city');
      const addressEl = document.getElementById('global-search-address');
      const outEl = document.getElementById('global-search-outstanding');
      const btnClose = document.getElementById('btn-close-global-search');
      
      if (!modal) return;
      
      if (btnClose) {
        btnClose.onclick = () => modal.style.display = 'none';
      }
      
      modal.style.display = 'flex';
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Buscando cliente...';
      resultsDiv.style.display = 'none';
      
      try {
        const client = await window.BulaPayDB.getGlobalClientByCedula(cedula);
        if (!client) {
          statusDiv.textContent = '❌ Cliente no encontrado.';
          return;
        }
        
        statusDiv.style.display = 'none';
        resultsDiv.style.display = 'flex';
        
        nameEl.textContent = client.name;
        cedulaEl.textContent = client.cedula;
        phoneEl.textContent = client.phone || 'N/A';
        cityEl.textContent = client.city || 'N/A';
        addressEl.textContent = client.direccion || client.zone || 'N/A';
        outEl.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
      } catch (err) {
        console.error(err);
        statusDiv.textContent = '❌ Error al consultar Supabase.';
      }
    };
    if (btnQuickSearch) {
      btnQuickSearch.addEventListener('click', executeQuickSearch);
    }
    if (inputQuickSearch) {
      inputQuickSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeQuickSearch();
      });
    }

    // Registrar Pago
    if (this.btnSubmitCollect) {
      this.btnSubmitCollect.addEventListener('click', () => this.registerPayment());
    }

    // Seguimiento de Ruta Diario Modal
    const btnTracking = document.getElementById('btn-agent-route-tracking');
    if (btnTracking) {
      btnTracking.addEventListener('click', () => this.openRouteTrackingModal());
    }
    const btnCloseTracking = document.getElementById('btn-close-route-tracking');
    if (btnCloseTracking) {
      btnCloseTracking.addEventListener('click', () => this.closeRouteTrackingModal());
    }

    const btnReport = document.getElementById('btn-generate-cash-report');
    if (btnReport) {
      btnReport.addEventListener('click', () => this.generateCashReport());
    }
    const btnCloseReport = document.getElementById('btn-close-cash-report');
    if (btnCloseReport) {
      btnCloseReport.addEventListener('click', () => {
        const modal = document.getElementById('agent-cash-report-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Cartón de Pagos
    if (this.btnOpenPaymentCard) {
      this.btnOpenPaymentCard.addEventListener('click', () => this.openPaymentCard());
    }
    if (this.btnClosePaymentCard) {
      this.btnClosePaymentCard.addEventListener('click', () => this.closePaymentCard());
    }

    if (this.massPaymentSwitch) {
      this.massPaymentSwitch.addEventListener('change', (e) => {
        this.isMassPaymentMode = e.target.checked;
        this.selectedInstallments = [];
        if (this.btnProcessMassPayment) this.btnProcessMassPayment.style.display = 'none';
        if (this.currentClient) {
          window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula).then(payments => {
            const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
            window.BulaPayDB.renderOverdueDaysList(this.cobroOverdueDaysList, dailyStatusList, (st) => this.handleCartonPayment(st), []);
          });
        }
      });
    }

    if (this.btnProcessMassPayment) {
      this.btnProcessMassPayment.addEventListener('click', () => this.processMassPayment());
    }

    // Registrar Cliente Nuevo
    this.formRegisterClient.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.registerNewClient();
    });

    // Acciones del modal WhatsApp
    if (this.btnCloseWaModal) {
      this.btnCloseWaModal.addEventListener('click', () => {
        this.shareModal.classList.remove('active');
      });
    }

    if (this.btnOpenLinkWa) {
      this.btnOpenLinkWa.addEventListener('click', () => {
        if (this.currentClient) {
          this.shareModal.classList.remove('active');
          
          // URL dinámica del portal del cliente
          const appUrl = `${window.location.origin}${window.location.pathname}?view=customer&id=${this.currentClient.cedula}`;
          
          // Mensaje pre-armado
          const message = `👋 ¡Hola ${this.currentClient.name}! Le damos la bienvenida a BulaPay. Hemos registrado su venta a plazos. Consulte su estado de cartera y realice el seguimiento de sus pagos en su Cartón Digital personalizado aquí: ${appUrl}`;
          
          // Enlace click-to-chat de WhatsApp armando la URL (https://wa.me/+57...) con el teléfono limpio
          let rawPhone = this.currentClient.phone.replace(/[\s+]/g, '');
          if (rawPhone.startsWith('57')) {
            rawPhone = rawPhone.substring(2);
          }
          const waUrl = `https://wa.me/+57${rawPhone}?text=${encodeURIComponent(message)}`;
          
          window.open(waUrl, '_blank');
        }
      });
    }

    if (this.btnSendEmailWa) {
      this.btnSendEmailWa.addEventListener('click', () => {
        if (this.currentClient) {
          this.shareModal.classList.remove('active');
          this.sendWelcomeEmail(this.currentClient);
        }
      });
    }
  },

  async updateAgentHeader() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    const agentNameElement = document.getElementById('agent-welcome-name');
    const agentRouteElement = document.getElementById('agent-active-route');
    const roleTag = document.getElementById('agent-role-tag');
    const profileTrigger = document.getElementById('agent-profile-trigger');
    const privatePanel = document.getElementById('private-agent-panel-modal');
    const btnClosePrivatePanel = document.getElementById('btn-close-private-panel');
    const tabProfileBtn = document.getElementById('btn-tab-private-profile');
    const tabBusinessBtn = document.getElementById('btn-tab-private-business');
    const tabProfileContent = document.getElementById('private-panel-profile');
    const tabBusinessContent = document.getElementById('private-panel-business');
    const cashModal = document.getElementById('private-panel-cash-modal');
    const blacklistModal = document.getElementById('private-panel-blacklist-modal');
    
    // Inicializar Eventos del Panel Privado
    if (btnClosePrivatePanel) {
      btnClosePrivatePanel.onclick = () => {
        if (privatePanel) privatePanel.style.display = 'none';
      };
    }

    if (tabProfileBtn && tabBusinessBtn) {
      tabProfileBtn.onclick = () => {
        tabProfileBtn.style.color = 'var(--accent)';
        tabProfileBtn.style.borderBottom = '2px solid var(--accent)';
        tabBusinessBtn.style.color = 'var(--text-secondary)';
        tabBusinessBtn.style.borderBottom = 'none';
        tabProfileContent.style.display = 'block';
        tabBusinessContent.style.display = 'none';
      };
      tabBusinessBtn.onclick = () => {
        tabBusinessBtn.style.color = 'var(--accent)';
        tabBusinessBtn.style.borderBottom = '2px solid var(--accent)';
        tabProfileBtn.style.color = 'var(--text-secondary)';
        tabProfileBtn.style.borderBottom = 'none';
        tabProfileContent.style.display = 'none';
        tabBusinessContent.style.display = 'flex';
      };
    }

    if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente')) {
      if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
      if (roleTag) roleTag.textContent = currentUser.role;
      
      const routes = await window.BulaPayDB.getRoutes();
      const myRoute = routes.find(r => r.agentUsername && r.agentUsername.split(', ').map(u => u.trim()).includes(currentUser.username));
      
      if (agentRouteElement) {
        if (currentUser.role === 'Agente Independiente') {
          agentRouteElement.textContent = 'Cobrador Independiente';
          
          // RBAC: Solo Agente Independiente puede abrir el Panel
          if (profileTrigger) {
            profileTrigger.style.cursor = 'pointer';
            profileTrigger.style.transition = 'opacity 0.2s';
            profileTrigger.onmouseover = () => profileTrigger.style.opacity = '0.8';
            profileTrigger.onmouseout = () => profileTrigger.style.opacity = '1';
            profileTrigger.onclick = () => {
              if (privatePanel) {
                privatePanel.style.display = 'flex';
                this.hydratePrivatePanel(currentUser);
              }
            };
          }
          
          // Asegurar que la pestaña de Registro esté visible para el Agente Independiente
          if (this.tabRegister) {
            this.tabRegister.style.display = 'block';
          }
        } else {
          agentRouteElement.textContent = myRoute 
            ? `Ruta: ${myRoute.name} | Capital: $${Number(myRoute.capital).toLocaleString('es-CO')}` 
            : 'Ruta no asignada';
            
          // Bloquear interacción del panel privado
          if (profileTrigger) {
            profileTrigger.style.cursor = 'default';
            profileTrigger.onmouseover = null;
            profileTrigger.onmouseout = null;
            profileTrigger.onclick = null;
          }
          
          // Asegurar que la pestaña de Registro esté visible para los Agentes de Ruta (pueden registrar clientes)
          if (this.tabRegister) {
            this.tabRegister.style.display = 'block';
          }
        }
      }
    } else {
      if (agentNameElement) agentNameElement.textContent = 'Cargando...';
      if (agentRouteElement) agentRouteElement.textContent = 'Verificando sesión';
    }
  },

  async hydratePrivatePanel(currentUser) {
    try {
      const dbUser = await window.BulaPayDB.getUserByUsername(currentUser.username);
      if (dbUser) {
        currentUser = { ...currentUser, ...dbUser };
        localStorage.setItem('bulapay_user', JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn("Error sincronizando perfil desde DB:", e);
    }
    
    // 1. Hidratar 'Mi Perfil'
    const nameInput = document.getElementById('private-profile-name');
    const phoneInput = document.getElementById('private-profile-phone');
    const emailInput = document.getElementById('private-profile-email');
    const cedulaInput = document.getElementById('private-profile-cedula');
    const addressInput = document.getElementById('private-profile-address');
    const usernameInput = document.getElementById('private-profile-username');
    if (nameInput) nameInput.value = currentUser.name || "";
    if (phoneInput) phoneInput.value = currentUser.phone || "";
    if (emailInput) emailInput.value = currentUser.email || "";
    if (cedulaInput) cedulaInput.value = currentUser.documentNumber || currentUser.id || "";
    if (addressInput) addressInput.value = currentUser.zone || "";
    if (usernameInput) usernameInput.value = currentUser.username || "";

    const btnSaveProfile = document.getElementById('btn-save-private-profile');
    if (btnSaveProfile) {
      btnSaveProfile.onclick = async () => {
        try {
          const newName = nameInput.value.trim();
          const newPhone = phoneInput.value.trim();
          const newEmail = emailInput.value.trim();
          const newAddress = addressInput.value.trim();
          
          if (!newName) {
            alert('❌ El nombre no puede estar vacío');
            return;
          }
          btnSaveProfile.textContent = 'Guardando...';
          btnSaveProfile.disabled = true;
          
          const profileUpdates = {
            name: newName,
            phone: newPhone,
            email: newEmail,
            zone: newAddress
          };
          
          await window.BulaPayDB.updateUserProfile(currentUser.username, profileUpdates);
          
          currentUser.name = newName;
          currentUser.phone = newPhone;
          currentUser.email = newEmail;
          currentUser.address = newAddress;
          currentUser.direccion = newAddress;
          localStorage.setItem('bulapay_user', JSON.stringify(currentUser));
          
          // Actualizar la vista
          const agentNameElement = document.getElementById('agent-welcome-name');
          if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
          
          alert('✅ Perfil actualizado correctamente');
        } catch (err) {
          console.error(err);
          alert('❌ Error al actualizar el perfil');
        } finally {
          btnSaveProfile.textContent = 'Guardar Cambios';
          btnSaveProfile.disabled = false;
        }
      };
    }
    
    // 1.5 Cambiar Contraseña
    const btnUpdatePassword = document.getElementById('btn-update-private-password');
    const inputCurrentPassword = document.getElementById('private-profile-current-password');
    const inputNewPassword = document.getElementById('private-profile-new-password');
    
    if (btnUpdatePassword && inputNewPassword) {
      btnUpdatePassword.onclick = async () => {
        const currentPass = inputCurrentPassword ? inputCurrentPassword.value : '';
        const newPass = inputNewPassword.value;
        
        if (newPass.length < 6) {
          alert('❌ La nueva contraseña debe tener al menos 6 caracteres para ser segura.');
          return;
        }
        
        if (currentUser.password && currentPass !== currentUser.password) {
          alert('❌ La contraseña actual es incorrecta.');
          return;
        }
        
        const originalText = btnUpdatePassword.textContent;
        btnUpdatePassword.textContent = 'Actualizando...';
        btnUpdatePassword.disabled = true;
        
        try {
          await window.BulaPayDB.updateUserPassword(currentUser.username, newPass);
          
          currentUser.password = newPass; 
          localStorage.setItem('bulapay_user', JSON.stringify(currentUser));
          
          alert('✅ ¡Contraseña actualizada correctamente!');
          if (inputCurrentPassword) inputCurrentPassword.value = '';
          inputNewPassword.value = '';
        } catch (error) {
          console.error(error);
          alert('❌ Error al actualizar: ' + error.message);
        } finally {
          btnUpdatePassword.textContent = originalText;
          btnUpdatePassword.disabled = false;
        }
      };
    }

    // 2. Dar vida al Dashboard 'Mi Negocio' (Métrica de Capital)
    const capitalEl = document.getElementById('private-panel-capital');
    let agentClients = [];
    if (capitalEl) {
      capitalEl.textContent = 'Calculando...';
      try {
        const currentUser = window.BulaPayDB.getCurrentUser();
        const route = currentUser && currentUser.routeId ? await window.BulaPayDB.getRouteById(currentUser.routeId) : null;
        const routeCapital = route ? parseFloat(route.capital) || 0 : 0;
        capitalEl.textContent = `$${routeCapital.toLocaleString('es-CO')}`;
      } catch (err) {
        console.error(err);
        capitalEl.textContent = 'Error';
      }
    }
    
    // Lógica para Modales
    const cashModal = document.getElementById('private-panel-cash-modal');
    const blacklistModal = document.getElementById('private-panel-blacklist-modal');
    const btnCash = document.getElementById('btn-trigger-cash-modal');
    const btnBlacklist = document.getElementById('btn-trigger-blacklist-modal');
    
    if (cashModal) {
      document.getElementById('btn-close-private-cash').onclick = () => cashModal.style.display = 'none';
    }
    if (blacklistModal) {
      document.getElementById('btn-close-private-blacklist').onclick = () => blacklistModal.style.display = 'none';
    }

    // Modal de Cierre de Caja
    if (btnCash && cashModal) {
      btnCash.onclick = async () => {
        cashModal.style.display = 'flex';
        const elCollected = document.getElementById('private-cash-collected');
        const elLent = document.getElementById('private-cash-lent');
        const elDiscounts = document.getElementById('private-cash-discounts');
        const elOnHand = document.getElementById('private-cash-on-hand');
        
        elCollected.textContent = 'Cargando...';
        elLent.textContent = 'Cargando...';
        if (elDiscounts) elDiscounts.textContent = 'Cargando...';
        elOnHand.textContent = 'Cargando...';
        
        try {
          const { totalCollected, totalLent, totalDiscounts, onHand, massPaymentsTotal } = await window.BulaPayDB.getEfectivoEnCajaDia();
          
          elCollected.textContent = `$${Math.abs(totalCollected).toLocaleString('es-CO')}`;
          
          const elMass = document.getElementById('private-cash-mass-payments');
          if (elMass) {
            if (massPaymentsTotal && massPaymentsTotal > 0) {
              elMass.textContent = `$${Math.abs(massPaymentsTotal).toLocaleString('es-CO')}`;
              elMass.style.color = 'var(--color-verde, #10b981)';
            } else {
              elMass.textContent = '$0';
              elMass.style.color = 'var(--text-muted)';
            }
          }
          
          const prestadoFormateado = totalLent === 0 ? "$0" : "-$" + Math.abs(totalLent).toLocaleString('es-CO');
          elLent.textContent = prestadoFormateado;

          if (elDiscounts) {
            const discountsFormateado = totalDiscounts === 0 ? "$0" : "+$" + Math.abs(totalDiscounts).toLocaleString('es-CO');
            elDiscounts.textContent = discountsFormateado;
          }
          
          if (onHand < 0) {
            elOnHand.textContent = `-$${Math.abs(onHand).toLocaleString('es-CO')}`;
            elOnHand.style.color = 'var(--color-rojo)';
          } else {
            elOnHand.textContent = `$${onHand.toLocaleString('es-CO')}`;
            elOnHand.style.color = 'var(--text-primary)';
          }
        } catch (e) {
          console.error(e);
          elCollected.textContent = 'Error';
        }
      };
    }

    // Modal de Gestión de Caja
    const cashMgmtModal = document.getElementById('agent-cash-management-modal');
    const btnCashMgmt = document.getElementById('btn-trigger-cash-management-modal');
    if (cashMgmtModal && btnCashMgmt) {
      btnCashMgmt.onclick = async () => {
        cashMgmtModal.style.display = 'flex';
        const elAvailable = document.getElementById('cash-management-available');
        elAvailable.textContent = 'Cargando...';
        
        const { onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
        elAvailable.textContent = `$${Math.abs(onHand).toLocaleString('es-CO')}`;
        elAvailable.style.color = onHand < 0 ? 'var(--color-rojo)' : 'var(--color-verde)';
        
        document.getElementById('cash-movement-form').style.display = 'none';
        document.getElementById('cash-movement-amount').value = '';
      };

      document.getElementById('btn-close-cash-management').onclick = () => cashMgmtModal.style.display = 'none';

      const cashMovementAmountInput = document.getElementById('cash-movement-amount');
      if (cashMovementAmountInput) {
        cashMovementAmountInput.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\D/g, '');
          e.target.value = val ? val.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
        });
      }

      let currentMovementType = '';
      
      document.getElementById('btn-cash-add').onclick = () => {
        currentMovementType = 'entrada';
        document.getElementById('cash-movement-form').style.display = 'flex';
        document.getElementById('cash-movement-title').textContent = 'Ingresar Dinero a Caja (Entrada)';
      };

      document.getElementById('btn-cash-remove').onclick = () => {
        currentMovementType = 'salida';
        document.getElementById('cash-movement-form').style.display = 'flex';
        document.getElementById('cash-movement-title').textContent = 'Retirar Dinero de Caja (Salida)';
      };

      document.getElementById('btn-cash-movement-confirm').onclick = async () => {
        const amountRaw = document.getElementById('cash-movement-amount').value.replace(/\./g, '');
        const amount = parseFloat(amountRaw);
        if (!amount || amount <= 0) {
          alert('Por favor ingrese un monto válido mayor a 0.');
          return;
        }
        
        const currentUser = window.BulaPayDB.getCurrentUser();
        if (!currentUser) return;

        const btnConfirm = document.getElementById('btn-cash-movement-confirm');
        btnConfirm.disabled = true;
        btnConfirm.textContent = 'Procesando...';

        if (currentMovementType === 'salida') {
           const { onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
           if (amount > onHand) {
             alert(`❌ Fondos insuficientes. Solo hay $${onHand.toLocaleString('es-CO')} en caja hoy.`);
             btnConfirm.disabled = false;
             btnConfirm.textContent = 'Confirmar Movimiento';
             return;
           }
        }

        const movement = {
          id: 'mov_' + Date.now(),
          agent_id: currentUser.id || currentUser.username,
          routeId: currentUser.routeId,
          type: currentMovementType,
          amount: amount,
          date: new Date().toISOString().split('T')[0]
        };

        // Sincronizar Capital Base
        let capitalDelta = 0;
        if (currentMovementType === 'entrada') {
          capitalDelta = amount;
        } else if (currentMovementType === 'salida') {
          capitalDelta = -amount;
        }
        
        try {
          await window.BulaPayDB.updateRouteCapital(currentUser.routeId, capitalDelta);
          const success = await window.BulaPayDB.saveCashMovement(movement);
          
          if (success) {
            alert('✅ Movimiento registrado y Capital Base actualizado exitosamente.');
            document.getElementById('cash-movement-amount').value = '';
            document.getElementById('cash-movement-form').style.display = 'none';
            
            // Actualizar vista Caja
            const { onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
            const elAvailable = document.getElementById('cash-management-available');
            elAvailable.textContent = `$${Math.abs(onHand).toLocaleString('es-CO')}`;
            elAvailable.style.color = onHand < 0 ? 'var(--color-rojo)' : 'var(--color-verde)';
            
            // Re-render del número gigante Capital Base
            const route = await window.BulaPayDB.getRouteById(currentUser.routeId);
            const routeCapital = route ? parseFloat(route.capital) || 0 : 0;
            const capitalEl = document.getElementById('private-panel-capital');
            if (capitalEl) capitalEl.textContent = `$${routeCapital.toLocaleString('es-CO')}`;
          } else {
            alert('❌ Error al guardar el movimiento de caja.');
          }
        } catch (error) {
          console.error(error);
          alert('❌ Error al actualizar el Capital Base.');
        }
        
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Confirmar Movimiento';
      };
    }
    
    // Modal de Lista Negra
    if (btnBlacklist && blacklistModal) {
      btnBlacklist.onclick = async () => {
        blacklistModal.style.display = 'flex';
        const container = document.getElementById('private-blacklist-container');
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Calculando morosos...</p>';
        
        try {
          const clients = await window.BulaPayDB.getClients();
          const badClients = clients.filter(c => 
            c.agent_id === currentUser.username && 
            Number(c.outstanding) > 0 && 
            c.risk === 'Rojo'
          );
          
          if (badClients.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #10b981; font-weight: bold;">🎉 ¡Felicidades! No tienes clientes en Lista Negra.</p>';
            return;
          }
          
          // Renderizar lista
          container.innerHTML = badClients.map(c => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-color);">
              <div>
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">${c.name}</h4>
                <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">CC: ${c.cedula}</p>
              </div>
              <span style="background-color: rgba(239, 68, 68, 0.1); color: var(--color-rojo); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;">
                Deuda: $${Number(c.outstanding).toLocaleString('es-CO')}
              </span>
            </div>
          `).join('');
          
        } catch (e) {
          console.error(e);
          container.innerHTML = '<p style="text-align: center; color: var(--color-rojo);">Error al calcular lista negra.</p>';
        }
      };
    }
  },

  switchTab(tab) {
    this.tabCollect.classList.remove('active');
    this.tabHistory.classList.remove('active');
    this.tabRegister.classList.remove('active');
    this.panelCollect.style.display = 'none';
    this.panelHistory.style.display = 'none';
    this.panelRegister.style.display = 'none';

    const blockedPanel = document.getElementById('gps-blocked-panel');

    if (tab === 'collect') {
      this.tabCollect.classList.add('active');
      
      // Limpiar Estado Cobro
      this.currentClient = null;
      if (this.inputCobroCedula) this.inputCobroCedula.value = '';
      if (this.inputSearchCedula) this.inputSearchCedula.value = '';
      if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'flex';
      if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'none', 'important');
      if (this.cobroInputState) this.cobroInputState.style.setProperty('display', 'block', 'important');
      if (this.cobroCartonState) this.cobroCartonState.style.setProperty('display', 'none', 'important');
      
      if (window.gpsBlocked) {
        this.panelCollect.style.setProperty('display', 'none', 'important');
        if (blockedPanel) blockedPanel.style.display = 'flex';
      } else {
        this.panelCollect.style.display = 'block';
        if (blockedPanel) blockedPanel.style.display = 'none';
      }
    } else {
      if (blockedPanel) blockedPanel.style.display = 'none';
      if (tab === 'history') {
        this.tabHistory.classList.add('active');
        this.panelHistory.style.display = 'block';
        
        // Limpiar Estado Historial
        this.historyResults.style.display = 'none';
        this.historyError.style.display = 'none';
        this.historyPlaceholder.style.display = 'block';
        if (this.inputHistoryCedula) this.inputHistoryCedula.value = '';
      } else if (tab === 'register') {
        this.tabRegister.classList.add('active');
        this.panelRegister.style.display = 'block';
        
        // Limpiar Estado Registro
        if (this.formRegisterClient) this.formRegisterClient.reset();
      }
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
    this.historyClientName.textContent = 'Cargando...';
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

      // Calcular riesgo dinámico basado en pagos
      try {
        const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
        const dailyStatus = window.BulaPayDB.getDailyPaymentStatus(client, payments);
        const overdueCount = dailyStatus.filter(s => s.isOverdue).length;
        
        if (Number(client.outstanding) === 0) {
          client.risk = 'Verde';
        } else if (overdueCount >= 3) {
          client.risk = 'Rojo';
        } else if (overdueCount > 0) {
          client.risk = 'Amarillo';
        } else {
          client.risk = 'Verde';
        }
      } catch (e) {
        console.error("Error al calcular riesgo dinámico en historial:", e);
      }

      const hasOutstanding = Number(client.outstanding) > 0;
      
      if (client.risk === 'Rojo') {
        this.historyTrafficLight.className = 'traffic-light-header rojo';
        this.historyRiskStatus.textContent = '🔴 ROJO (Alto Riesgo)';
      } else if (client.risk === 'Amarillo') {
        this.historyTrafficLight.className = 'traffic-light-header amarillo';
        this.historyRiskStatus.textContent = '🟡 AMARILLO (Riesgo Medio)';
      } else {
        this.historyTrafficLight.className = 'traffic-light-header verde';
        this.historyRiskStatus.textContent = '🟢 VERDE (Buen Cliente)';
      }
      
      if (hasOutstanding) {
        let agentName = client.agent_id || 'Desconocido';
        try {
          if (client.agent_id) {
            const agentUser = await window.BulaPayDB.getUserByUsername(client.agent_id);
            if (agentUser) agentName = agentUser.name || agentUser.username;
          }
        } catch (e) {}
        const municipality = client.city || 'Desconocido';
        
        if (this.historyActiveCreditsAlert) {
          this.historyActiveCreditsAlert.style.display = 'flex';
          this.historyActiveCreditsAlert.className = 'risk-alert-box warning';
          this.historyActiveCreditsAlert.innerHTML = `⚠️ Atención: Este cliente tiene un crédito activo con el agente ${agentName} en el municipio ${municipality}.`;
        }
      } else {
        if (this.historyActiveCreditsAlert) {
          this.historyActiveCreditsAlert.style.display = 'none';
        }
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
    this.isMassPaymentMode = false;
    this.selectedInstallments = [];
    if (this.massPaymentSwitch) this.massPaymentSwitch.checked = false;
    if (this.btnProcessMassPayment) this.btnProcessMassPayment.style.display = 'none';
  },

  async renderPaymentCardGrid() {
    this.paymentCardGrid.innerHTML = '';
    
    const client = this.currentClient;
    const totalInstallments = client.installmentsCount || 20; // Default to typical 20 or 24 quotas
    const installmentAmount = client.installmentAmount || 8000;
    
    // Obtener los pagos reales desde Supabase
    const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
    
    const startDate = new Date(client.created_at || Date.now());
    const startZero = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    
    const paymentDates = new Set();
    payments.forEach(p => {
      if (p.amount > 0 && p.status !== 'No Pago') {
        paymentDates.add(p.date);
      }
    });

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let dayCount = 0;
    let cuotaIdx = 1;

    // Generar celdas hasta completar el cartón
    while (cuotaIdx <= totalInstallments) {
      const currentDayDate = new Date(startZero);
      currentDayDate.setDate(startZero.getDate() + dayCount);
      
      // Saltar Domingos (0)
      if (currentDayDate.getDay() === 0) {
        dayCount++;
        continue;
      }
      
      const dayStr = currentDayDate.toISOString().split('T')[0];
      const isPast = currentDayDate < todayZero;
      const hasPaid = paymentDates.has(dayStr);
      
      const cell = document.createElement('div');
      cell.classList.add('payment-card-cell');
      
      if (hasPaid) {
        cell.classList.add('pagado');
        cell.innerHTML = `Cuota ${cuotaIdx}<br>✔`;
      } else if (isPast) {
        cell.classList.add('atrasado');
        cell.innerHTML = `Cuota ${cuotaIdx}<br>⚠️`;
      } else {
        cell.classList.add('pendiente');
        cell.innerHTML = `Cuota ${cuotaIdx}<br>$${Number(installmentAmount).toLocaleString('es-CO')}`;
      }
      
      // Manejar clicks (excepto si ya está pagado)
      if (!hasPaid) {
        const currentCuota = cuotaIdx;
        const currentAmount = installmentAmount;
        const currentDayStr = dayStr;
        const currentIsPast = isPast;
        
        // Mantener selección visual si ya estaba seleccionada
        if (this.isMassPaymentMode && this.selectedInstallments.find(i => i.number === currentCuota)) {
          cell.classList.add('selected');
        }

        cell.style.cursor = 'pointer';
        cell.onclick = () => {
          if (this.isMassPaymentMode) {
            const idx = this.selectedInstallments.findIndex(i => i.number === currentCuota);
            if (idx > -1) {
              this.selectedInstallments.splice(idx, 1);
              cell.classList.remove('selected');
            } else {
              this.selectedInstallments.push({ number: currentCuota, amount: currentAmount, date: currentDayStr });
              cell.classList.add('selected');
            }
            
            // Actualizar botón procesar
            if (this.selectedInstallments.length > 0) {
              this.btnProcessMassPayment.style.display = 'block';
              const total = this.selectedInstallments.reduce((sum, item) => sum + item.amount, 0);
              this.btnProcessMassPayment.innerText = `Procesar Pago Masivo (${this.selectedInstallments.length}) - Total: $${total.toLocaleString('es-CO')}`;
            } else {
              this.btnProcessMassPayment.style.display = 'none';
            }
          } else {
            const todayStr = this.getLocalDateString();
            if (!currentIsPast && currentDayStr > todayStr) {
              alert('Candado: No se pueden cobrar cuotas futuras en modo normal. Active el Pago Masivo para adelantar cuotas.');
              return;
            }
            this.payInstallmentFromCard(currentCuota, currentAmount, currentDayStr);
          }
        };
      }
      
      this.paymentCardGrid.appendChild(cell);
      
      cuotaIdx++;
      dayCount++;
    }
  },

  async payInstallmentFromCard(installmentNumber, amount) {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      // Validar si ya pagó hoy
      const todayStr = this.getLocalDateString();
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: installmentNumber,
        amount: amount,
        date: this.getLocalDateString(),
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
      await this.renderClientInfo(updatedClient);

      // Refrescar el Cartón de Pagos
      await this.renderPaymentCardGrid();
      
      // Actualizar saldo mostrado en el modal
      this.paymentCardClientOutstanding.textContent = `$${Number(updatedClient.outstanding).toLocaleString('es-CO')}`;
      
      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
      
    } catch (err) {
      console.error("Error al pagar cuota desde cartón:", err);
      if (err.message && (err.message.includes('Precaución') || err.message.includes('Acceso Denegado'))) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el pago de la cuota.');
      }
    }
  },

  async processMassPayment() {
    if (!this.selectedInstallments || this.selectedInstallments.length === 0) return;
    
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };
    const todayStr = this.getLocalDateString();
    
    try {
      this.btnProcessMassPayment.disabled = true;
      this.btnProcessMassPayment.innerText = 'Procesando...';
      
      let totalAmount = 0;
      let lastPayment = null;
      
      // Procesar en lote (una por una para mantener el ledger intacto)
      for (const cuota of this.selectedInstallments) {
        const newPayment = {
          clientCedula: this.currentClient.cedula,
          installmentNumber: cuota.number,
          amount: cuota.amount,
          date: todayStr, // La instrucción dice: usar fecha de HOY
          agentName: currentUser.name,
          status: 'Pagado',
          is_mass_payment: true
        };
        lastPayment = await window.BulaPayDB.addPayment(newPayment);
        totalAmount += cuota.amount;
      }

      // Reportar geolocalización una sola vez
      this.captureAndSendLocation();

      // Preparar recibo virtual agrupado
      if (lastPayment) {
        const fakePaymentForReceipt = {
          ...lastPayment,
          amount: totalAmount, // Gran total
          installmentNumber: `Masivo (${this.selectedInstallments.length} cuotas)` 
        };
        window.showBulaPayReceipt(fakePaymentForReceipt, this.currentClient);
      }

      // Reset UI y Estados
      this.isMassPaymentMode = false;
      this.selectedInstallments = [];
      if (this.massPaymentSwitch) this.massPaymentSwitch.checked = false;
      if (this.btnProcessMassPayment) {
        this.btnProcessMassPayment.style.display = 'none';
      }

      // Re-consultar los datos del cliente actualizados
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      // Actualizar la interfaz principal del cobrador y Cartón
      await this.renderClientInfo(updatedClient);
      
      // Actualizar saldo mostrado en el modal
      if (this.paymentCardClientOutstanding) {
        this.paymentCardClientOutstanding.textContent = `$${Number(updatedClient.outstanding).toLocaleString('es-CO')}`;
      }
      
      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
      
    } catch (err) {
      console.error("Error al procesar pago masivo:", err);
      alert('❌ Error al procesar el pago masivo. ' + err.message);
    } finally {
      if (this.btnProcessMassPayment) {
        this.btnProcessMassPayment.disabled = false;
      }
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
        if (this.cobroActionContainer) this.cobroActionContainer.style.display = 'none';
        if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'block';
        if (this.searchError) this.searchError.style.display = 'none';
        return;
      }

      if (this.searchError) this.searchError.style.display = 'none';
      
      this.currentClient = client;
      
      // Mostrar la tarjeta minimalista aislada y asegurar estado inicial
      if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'none';
      if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'block', 'important');
      if (this.cobroInputState && this.cobroCartonState) {
        this.cobroInputState.style.setProperty('display', 'block', 'important');
        this.cobroCartonState.style.setProperty('display', 'none', 'important');
      }
      
      if (this.cobroClientName) this.cobroClientName.textContent = client.name;
      if (this.cobroClientOutstanding) this.cobroClientOutstanding.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
      
      if (this.inputCobroAmount) {
        this.inputCobroAmount.value = Math.min(Number(client.installmentAmount), Number(client.outstanding));
      }

      // Preparar el Cartón Interactivo (Flujo B)
      if (this.cobroOverdueDaysList) {
        try {
          const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
          const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(client, payments);
          
          // Lógica del Botón Liquidar Cartón
          if (this.btnLiquidarCarton) {
            if (Number(client.outstanding) <= 0) {
              this.btnLiquidarCarton.disabled = false;
              this.btnLiquidarCarton.style.cursor = 'pointer';
              this.btnLiquidarCarton.style.opacity = '1';
            } else {
              this.btnLiquidarCarton.disabled = true;
              this.btnLiquidarCarton.style.cursor = 'not-allowed';
              this.btnLiquidarCarton.style.opacity = '0.5';
            }
          }

          // Lógica Candado Inteligente: Excepción para Morosos
          if (this.btnCobroInvoice) {
            const hasOverdue = dailyStatusList.some(s => s.isOverdue);
            const todayStr = this.getLocalDateString();
            const paidToday = payments.some(p => p.date === todayStr);
            const cuotaDeHoy = dailyStatusList.find(c => c.dateStr === todayStr);

            if (!cuotaDeHoy || cuotaDeHoy.hasPaid || (!hasOverdue && paidToday)) {
              this.btnCobroInvoice.disabled = true;
              this.btnCobroInvoice.style.cursor = 'not-allowed';
              this.btnCobroInvoice.style.opacity = '0.5';
            } else {
              this.btnCobroInvoice.disabled = false;
              this.btnCobroInvoice.style.cursor = 'pointer';
              this.btnCobroInvoice.style.opacity = '1';
            }
          }

          window.BulaPayDB.renderOverdueDaysList(
            this.cobroOverdueDaysList, 
            dailyStatusList, 
            (status) => this.handleCartonPayment(status) // Callback interactivo solo aquí
          );
        } catch (e) {
          console.error("Error al preparar cartón interactivo:", e);
        }
      }
      
    } catch (err) {
      console.error(err);
      if (err.message === 'ACCESO_DENEGADO_OTRO_AGENTE') {
        if (this.searchError) {
          this.searchError.style.display = 'block';
          this.searchError.textContent = 'Operación denegada: Este cliente pertenece a la ruta de otro asesor. No puedes gestionar sus cobros.';
        } else {
          alert('Operación denegada: Este cliente pertenece a la ruta de otro asesor. No puedes gestionar sus cobros.');
        }
        if (this.cobroActionContainer) this.cobroActionContainer.style.display = 'none';
        if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'none';
      } else {
        alert('❌ Error al buscar cliente.');
      }
    }
  },

  handleInvoiceRequest() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
    if (!this.currentClient) return;

    const amount = parseFloat(this.inputCobroAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('⚠️ Ingrese un valor válido de recaudo.');
      return;
    }

    // Regla de Seguridad 1: Prevención de Saldos Negativos
    if (amount > Number(this.currentClient.outstanding)) {
      alert('Error: El pago supera la deuda actual');
      return;
    }

    // Abrir Modal de Factura
    if (this.cobroInvoiceModal) {
      this.invoiceClientName.textContent = this.currentClient.name;
      this.invoiceAmount.textContent = `$${amount.toLocaleString('es-CO')}`;
      
      const newBalance = Number(this.currentClient.outstanding) - amount;
      this.invoiceNewBalance.textContent = `$${newBalance.toLocaleString('es-CO')}`;
      
      this.cobroInvoiceModal.style.display = 'flex';
    }
  },

  async executePaymentTransaction() {
    if (this.isLoadingPayment) return;
    this.isLoadingPayment = true;

    if (this.btnCobroInvoice) {
      this.btnCobroInvoice.disabled = true;
      this.btnCobroInvoice.innerHTML = 'Procesando...';
    }

    try {
      const amount = parseFloat(this.inputCobroAmount.value);
      const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
      
      const todayStr = this.getLocalDateString();
      const cuotaDeHoy = dailyStatusList.find(c => c.dateStr === todayStr);

      // 1. Búsqueda Única y Exclusiva (HOY)
      if (!cuotaDeHoy) {
        return; // Detiene el proceso si no hay cuota exacta para hoy
      }

      // 2. El Mensaje de Servicio (Bloqueo de Futuro)
      if (cuotaDeHoy.hasPaid) {
        alert('No puede pagar el día de hoy porque ya está pago. Lo invitamos a ponerse al día con sus cuotas atrasadas.');
        return; // Aborta la transacción
      }

      // 3. Ejecución del pago apuntando EXCLUSIVAMENTE a la cuota de hoy
      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: cuotaDeHoy.dayNumber,
        amount: amount,
        date: todayStr,
        agentName: currentUser.name,
        status: amount >= Number(this.currentClient.installmentAmount) ? 'Pagado' : 'Abonado'
      };

      await window.BulaPayDB.addPayment(newPayment);
      
      // Si llega aquí, es porque NO hubo error en Supabase
      this.captureAndSendLocation();

      // Forzar re-render descargando las cuotas nuevamente (El Fix visual)
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      if (this.inputCobroAmount) {
        this.inputCobroAmount.value = '';
      }
      
      await this.searchClient(); // Recarga y repinta el cartón completo ANTES del alert

      // Evaluar estado general del cliente para la alerta dinámica
      const allPayments = await window.BulaPayDB.getPaymentsByClient(updatedClient.cedula);
      const updatedDailyStatusList = window.BulaPayDB.getDailyPaymentStatus(updatedClient, allPayments);
      const hasOverdue = updatedDailyStatusList.some(s => s.isOverdue);

      if (hasOverdue) {
        alert('Pago exitoso. Recuerde que tiene unos días atrasados, recuerde ponerse al día.');
      } else {
        alert('Pago exitoso.');
      }
      
    } catch (e) {
      console.error("Error capturado en Confirmar Pago:", e);
      alert('Error REAL: ' + (e.message || 'Fallo desconocido al registrar el pago.'));
    } finally {
      this.isLoadingPayment = false;
      if (this.btnCobroInvoice) {
        this.btnCobroInvoice.disabled = false;
        this.btnCobroInvoice.innerHTML = 'Confirmar Pago';
      }
    }
  },

  async handleCartonPayment(status) {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada.');
      return;
    }
    if (!this.currentClient) return;
    
    const amountToPay = Math.min(Number(this.currentClient.installmentAmount), Number(this.currentClient.outstanding));

    if (this.isMassPaymentMode) {
      if (status.hasPaid) return;
      
      const idx = this.selectedInstallments.findIndex(i => i.number === status.dayNumber);
      if (idx > -1) {
        this.selectedInstallments.splice(idx, 1);
      } else {
        this.selectedInstallments.push({ number: status.dayNumber, amount: amountToPay, date: status.dateStr });
      }
      
      if (this.selectedInstallments.length > 0) {
        this.btnProcessMassPayment.style.display = 'block';
        const total = this.selectedInstallments.reduce((sum, item) => sum + item.amount, 0);
        this.btnProcessMassPayment.innerText = `Procesar Pago Masivo (${this.selectedInstallments.length}) - Total: $${total.toLocaleString('es-CO')}`;
      } else {
        this.btnProcessMassPayment.style.display = 'none';
      }
      
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
      const selectedIds = this.selectedInstallments.map(i => i.number);
      window.BulaPayDB.renderOverdueDaysList(this.cobroOverdueDaysList, dailyStatusList, (st) => this.handleCartonPayment(st), selectedIds);
      return;
    }
    
    if (status.isFuture) {
      alert('Operación denegada: No se puede registrar pagos en días futuros. Active el modo Pago Masivo para adelantar pagos.');
      return;
    }

    // Confirmación nativa
    const dateLabel = status.dateStr.slice(5);
    const isConfirmed = confirm(`¿Marcar Día ${status.dayNumber} (${dateLabel}) como pagado?`);
    if (!isConfirmed) return;

    // Regla de Seguridad 2: Descontar el valor de la cuota
    
    // Regla de Seguridad 1: Prevenir saldo negativo (aunque Math.min lo cubre, validamos por si acaso)
    if (amountToPay > Number(this.currentClient.outstanding)) {
      alert('Error: El pago supera la deuda actual');
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      
      const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
      const tieneAtrasos = dailyStatusList.some(s => s.isOverdue);
      const todayStr = this.getLocalDateString();
      
      if (!tieneAtrasos && payments.some(p => p.date === todayStr)) {
        alert('Precaución: El cliente está al día y ya registró un pago hoy. Por seguridad, solo se permite una transacción diaria para clientes al día.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: status.dayNumber, // Insertar asignado al dia exacto
        amount: amountToPay,
        date: todayStr, // La fecha de pago es hoy
        agentName: currentUser.name,
        status: 'Pagado'
      };

      await window.BulaPayDB.addPayment(newPayment);
      this.captureAndSendLocation();

      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      await this.searchClient(); // Refresca y actualiza cartón automáticamente ANTES del alert para evitar falsos positivos visuales
      
      alert(`✅ Día ${status.dayNumber} registrado como pagado.`);
      
    } catch (e) {
      console.error(e);
      if (e.message && e.message.includes('transacción diaria por cliente')) {
        // En caso de que el sistema antifraude de un solo pago por fecha bloquee
        alert('❌ No se puede registrar: Ya existe un pago registrado para esa fecha específica.');
      } else {
        alert('❌ Error al registrar el pago retroactivo.');
      }
    }
  },

  async renderClientInfo(client) {
    this.currentClient = client;
    
    // Ocultar placeholder y mostrar resultados
    if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'none';
    if (this.searchResults) this.searchResults.style.display = 'block';

    // Rellenar Info
    if (this.detailName) this.detailName.textContent = client.name;
    if (this.detailCedula) this.detailCedula.textContent = client.cedula;
    if (this.detailPhone) this.detailPhone.textContent = client.phone;
    if (this.detailOutstanding) this.detailOutstanding.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
    if (this.detailInstallment) this.detailInstallment.textContent = `$${Number(client.installmentAmount).toLocaleString('es-CO')}`;
    
    // Calcular riesgo dinámico basado en pagos
    let dailyStatusList = [];
    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
      dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(client, payments);
      const overdueCount = dailyStatusList.filter(s => s.isOverdue).length;
      
      if (Number(client.outstanding) === 0) {
        client.risk = 'Verde';
      } else if (overdueCount >= 3) {
        client.risk = 'Rojo';
      } else if (overdueCount > 0) {
        client.risk = 'Amarillo';
      } else {
        client.risk = 'Verde';
      }
    } catch (e) {
      console.error("Error al calcular riesgo dinámico en renderClientInfo:", e);
    }

    // Semáforo de Riesgo
    if (this.riskHeader) {
      this.riskHeader.className = 'traffic-light-header'; // Reset
      
      if (client.risk === 'Verde') {
        this.riskHeader.classList.add('verde');
        if (this.riskStatus) this.riskStatus.textContent = '🟢 Cliente Excelente (Al Día)';
      } else if (client.risk === 'Amarillo') {
        this.riskHeader.classList.add('amarillo');
        if (this.riskStatus) this.riskStatus.textContent = '🟡 Pago con Retrasos (Riesgo Medio)';
      } else if (client.risk === 'Rojo') {
        this.riskHeader.classList.add('rojo');
        if (this.riskStatus) this.riskStatus.textContent = '🔴 Cartera Castigada (Alto Riesgo)';
      }
    }

    // Estado de Cartera texto explicativo
    let statusText = 'Al Día';
    if (Number(client.outstanding) === 0) statusText = 'Crédito Cancelado';
    else if (client.risk === 'Amarillo') statusText = 'Atrasado';
    else if (client.risk === 'Rojo') statusText = 'Mora Severa';

    if (this.detailStatus) this.detailStatus.textContent = statusText;

    // Rellenar campo de monto de abono por defecto
    if (this.inputCollectAmount) {
      this.inputCollectAmount.value = Math.min(Number(client.installmentAmount), Number(client.outstanding));
    }

    // Renderizar Días de Mora en Detalles del Cliente
    const container = document.getElementById('client-overdue-days-list');
    if (container) {
      window.BulaPayDB.renderOverdueDaysList(container, dailyStatusList);
    }
  },

  isRouteClosed() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) return false;
    
    // El Agente Independiente está libre de restricciones
    if (currentUser.role === 'Agente Independiente') return false;
    
    // Si es Agente de Ruta estándar o rol general de agente
    if (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent') {
      const now = new Date();
      const day = now.getDay();
      const hours = now.getHours();
      if (day === 0 || hours < 6 || hours >= 18) {
        return true;
      }
    }
    return false;
  },

  async registerPayment() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
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
      
      // Validar si ya pagó hoy
      const todayStr = this.getLocalDateString();
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: payments.length + 1,
        amount: amount,
        date: this.getLocalDateString(),
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
      await this.renderClientInfo(updatedClient);

      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('Precaución') || err.message.includes('Acceso Denegado'))) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el pago.');
      }
    }
  },

  async registerNoPayment() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
    if (!this.currentClient) return;

    if (!confirm(`¿Está seguro de que desea registrar un No Pago para el cliente ${this.currentClient.name} el día de hoy?`)) {
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      
      // Validar si ya pagó hoy
      const todayStr = this.getLocalDateString();
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: payments.length + 1,
        amount: 0,
        date: this.getLocalDateString(),
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
      await this.renderClientInfo(updatedClient);

      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('Precaución') || err.message.includes('Acceso Denegado'))) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el no pago.');
      }
    }
  },

  async registerNewClient() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
    const name = document.getElementById('new-client-name').value.trim();
    
    // Obtener agentId de forma segura desde la sesión activa
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) {
      alert('❌ Error de seguridad: No hay sesión activa.');
      return;
    }
    const agentId = currentUser.username;

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

    console.log('[DEBUG] Intentando registrar nuevo cliente. Datos del formulario:', {
      name, agentId, cedula, phone, email, department, cityVal, city, zone, debt, installments
    });

    try {
      console.log('[DEBUG] Dentro del bloque try de registerNewClient. Verificando cédula existente...');
      // Validar existencia
      const existing = await window.BulaPayDB.getClientByCedula(cedula);
      if (existing) {
        console.warn('[DEBUG] Cédula ya existente registrada:', existing);
        alert('❌ Ya existe un cliente registrado con esta Cédula.');
        return;
      }

      const currentUser = window.BulaPayDB.getCurrentUser();
      const routeId = currentUser && currentUser.routeId ? currentUser.routeId : null;

      const capitalRaw = document.getElementById('new-client-capital').value.replace(/\./g, '');
      const montoPrestamo = parseFloat(capitalRaw) || 0;

      const applyDiscount = document.getElementById('new-client-apply-discount')?.checked;
      let discountAmount = 0;
      let discountReason = null;

      if (applyDiscount) {
        const discountRaw = document.getElementById('new-client-discount-amount').value.replace(/\./g, '');
        discountAmount = parseFloat(discountRaw) || 0;
        
        let reasons = [];
        if (document.getElementById('new-client-discount-reason-seguro')?.checked) reasons.push('Seguro');
        if (document.getElementById('new-client-discount-reason-papeleria')?.checked) reasons.push('Papelería o Software');
        if (document.getElementById('new-client-discount-reason-otros')?.checked) {
          const otrosText = document.getElementById('new-client-discount-reason-otros-text').value.trim();
          reasons.push(otrosText ? `Otros: ${otrosText}` : 'Otros');
        }
        discountReason = reasons.length > 0 ? reasons.join(', ') : null;
      }

      const montoSalida = montoPrestamo - discountAmount;

      // 1. Fix Crítico del Freno de Préstamos (Hard Stop) con Descuento
      const { onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
      if (montoSalida > onHand) {
        alert(`❌ Fondos Insuficientes. El efectivo en caja de hoy es menor a la salida real de capital.\nSalida Neta: $${montoSalida.toLocaleString('es-CO')}\nEfectivo Disponible: $${onHand.toLocaleString('es-CO')}`);
        return;
      }

      const payload = {
        cedula,
        name,
        phone,
        email,
        city,
        zone,
        risk: 'Verde', // Inicia excelente
        amount: montoPrestamo, // Guardamos el capital prestado para la caja diaria
        discount_amount: discountAmount, // Guardamos el descuento inicial
        discount_reason: discountReason, // Motivo del descuento
        totalDebt: debt,
        outstanding: debt,
        installmentsCount: installments,
        installmentAmount: Math.round(debt / installments),
        routeId,
        agent_id: currentUser.id || currentUser.username
      };

      console.log('Firma del Agente antes de guardar:', currentUser.id || currentUser.username, 'Payload completo:', payload);

      // Guardar
      await window.BulaPayDB.saveClient(payload);
      this.currentClient = payload;
      console.log('[DEBUG] Cliente guardado exitosamente en base de datos. currentClient:', this.currentClient);

      // Actualización de la Interfaz (Refetch) para el contador
      if (typeof this.updateRouteTracking === 'function') {
        this.updateRouteTracking();
      }

      // Envío de email de bienvenida (Resend placeholder)
      console.log('[DEBUG] Llamando a sendWelcomeEmail para:', payload.email);
      this.sendWelcomeEmail(payload);

      // Resetear formulario
      this.formRegisterClient.reset();

      // Mostrar modal simulador WhatsApp
      this.showWhatsAppMockup(payload);
    } catch (err) {
      console.error('[DEBUG ERROR] Error atrapado al registrar cliente en agent.js:', err);
      if (err && typeof err === 'object') {
        console.error('[DEBUG ERROR] Detalles del error (claves):', Object.keys(err));
        console.error('[DEBUG ERROR] Error stringificado:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      }
      const dupMsg = window.BulaPayDB.getClientDuplicationMessage(err);
      if (dupMsg) {
        alert(dupMsg);
      } else if (err.message === 'ACCESO_DENEGADO_OTRO_AGENTE') {
        alert('❌ Error: Ya existe un cliente registrado con esta Cédula (cartera de otro cobrador).');
      } else {
        alert('❌ Error al registrar el cliente. Detalles técnicos en la consola.');
      }
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
          console.log(`[GPS] Ubicación crítica reportada: ${latitude}, ${longitude}`);
        } catch (e) {
          console.warn("Fallo al actualizar geolocalización crítica en Supabase:", e);
        }
      },
      (error) => {
        console.warn("Error al capturar ubicación crítica:", error);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  },

  startLocationMonitoring() {
    if (!navigator.geolocation) return;

    // Detener cualquier monitoreo anterior
    this.stopLocationMonitoring();

    let lastPosition = null;

    // Iniciar watchPosition con alta precisión y sin caché
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        lastPosition = position;
        // Al recibir la primera posición, la enviamos de inmediato
        if (!this.hasSentInitialLocation) {
          this.hasSentInitialLocation = true;
          this.sendWatchPosition(position);
        }
      },
      (error) => {
        console.warn("[GPS Watch] Error al rastrear ubicación:", error);
        if (error.code === error.PERMISSION_DENIED) {
          window.gpsBlocked = true;
          if (window.app && typeof window.app.handleGPSPermissionStatus === 'function') {
            window.app.handleGPSPermissionStatus('denied');
          }
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    // Enviar a Supabase cada 30 segundos
    this.locationInterval = setInterval(() => {
      if (lastPosition) {
        this.sendWatchPosition(lastPosition);
      }
    }, 30000);
  },

  async sendWatchPosition(position) {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) return;

    const { latitude, longitude } = position.coords;
    try {
      await window.BulaPayDB.updateUserLocation(currentUser.username, latitude, longitude);
      console.log(`[GPS Watch] Ubicación reportada a Supabase cada 30s: ${latitude}, ${longitude}`);
    } catch (e) {
      console.warn("[GPS Watch] Fallo al actualizar geolocalización en Supabase:", e);
    }
  },

  stopLocationMonitoring() {
    if (this.locationWatchId !== undefined && this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
    this.hasSentInitialLocation = false;
  },

  async initGeography() {
    const deptSelect = document.getElementById('new-client-department');
    const citySelect = document.getElementById('new-client-city');
    if (!deptSelect || !citySelect) return;

    // Poblar departamentos inicialmente con el fallback estático local
    const populateDepts = (geography) => {
      const currentSelected = deptSelect.value;
      deptSelect.innerHTML = '<option value="" disabled selected>Seleccione Departamento...</option>';
      Object.keys(geography).sort().forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        if (dept === currentSelected) {
          opt.selected = true;
        }
        deptSelect.appendChild(opt);
      });
    };

    populateDepts(COLOMBIA_GEOGRAPHY);

    // Poblar municipios dependientes
    const updateCities = (geography) => {
      const selectedDept = deptSelect.value;
      citySelect.innerHTML = '<option value="" disabled selected>Seleccione Municipio / Ciudad...</option>';
      const cities = geography[selectedDept] || [];
      cities.sort().forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    };

    deptSelect.addEventListener('change', () => {
      const currentGeo = activeGeography || COLOMBIA_GEOGRAPHY;
      updateCities(currentGeo);
    });

    // Cargar la base de datos completa de geografía desde la API
    try {
      const fullGeography = await fetchColombiaGeography();
      if (fullGeography) {
        populateDepts(fullGeography);
        if (deptSelect.value) {
          updateCities(fullGeography);
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar la geografía remota. Se usará el listado estático local.", err);
    }
  },

  initCalculator() {
    const capitalInput = document.getElementById('new-client-capital');
    const interestInput = document.getElementById('new-client-interest-percent');
    const debtInput = document.getElementById('new-client-debt');
    const installmentsInput = document.getElementById('new-client-installments');
    const installmentValInput = document.getElementById('new-client-installment-val');

    if (!capitalInput || !interestInput || !debtInput || !installmentsInput || !installmentValInput) return;

    const discountCheckbox = document.getElementById('new-client-apply-discount');
    const discountPanel = document.getElementById('new-client-discount-panel');
    const discountAmountInput = document.getElementById('new-client-discount-amount');
    const cbSeguro = document.getElementById('new-client-discount-reason-seguro');
    const cbPapeleria = document.getElementById('new-client-discount-reason-papeleria');
    const cbOtros = document.getElementById('new-client-discount-reason-otros');
    const inputOtrosText = document.getElementById('new-client-discount-reason-otros-text');

    if (discountCheckbox && discountPanel) {
      discountCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          discountPanel.style.display = 'flex';
          discountAmountInput.required = true;
        } else {
          discountPanel.style.display = 'none';
          discountAmountInput.required = false;
          discountAmountInput.value = '';
          if (cbSeguro) cbSeguro.checked = false;
          if (cbPapeleria) cbPapeleria.checked = false;
          if (cbOtros) cbOtros.checked = false;
          if (inputOtrosText) {
            inputOtrosText.style.display = 'none';
            inputOtrosText.required = false;
            inputOtrosText.value = '';
          }
        }
      });
    }

    if (cbOtros && inputOtrosText) {
      cbOtros.addEventListener('change', (e) => {
        if (e.target.checked) {
          inputOtrosText.style.display = 'block';
          inputOtrosText.required = true;
        } else {
          inputOtrosText.style.display = 'none';
          inputOtrosText.required = false;
          inputOtrosText.value = '';
        }
      });
    }

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

    if (discountAmountInput) {
      discountAmountInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? formatNumber(val) : '';
      });
    }

    interestInput.addEventListener('input', calculate);
    installmentsInput.addEventListener('input', calculate);
  },

  async sendWelcomeEmail(clientData) {
    console.log('[DEBUG] sendWelcomeEmail - Preparando fetch a /api/send-email con body:', { clientData });
    let data = { details: 'No details' };
    try {
      console.log('[DEBUG] sendWelcomeEmail - Iniciando fetch...');
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientData })
      });

      console.log('[DEBUG] sendWelcomeEmail - Respuesta del servidor recibida. Status:', response.status, 'OK:', response.ok);

      if (response.ok) {
        console.log('[DEBUG] sendWelcomeEmail - Correo enviado exitosamente');
        alert('✅ Correo enviado exitosamente a ' + clientData.email);
      } else {
        const errorText = await response.text();
        console.error('[DEBUG ERROR] Error en respuesta de /api/send-email (Raw):', errorText);
        try {
          data = JSON.parse(errorText);
        } catch (e) {
          data = { error: errorText, details: errorText };
        }
        const err = new Error(data.error || `Código de estado: ${response.status}`);
        throw err;
      }
    } catch (err) {
      console.error('[DEBUG ERROR] Error atrapado al enviar correo en sendWelcomeEmail:', err);
      alert('Error técnico: ' + err.message + ' - Detalles: ' + JSON.stringify(data.details));
    }
  },

  async populateAgentSelector() {
    const selector = document.getElementById('agent-selector');
    if (!selector) return;

    const currentUser = window.BulaPayDB.getCurrentUser();
    if (currentUser) {
      selector.innerHTML = `<option value="${currentUser.username}" selected>${currentUser.name}</option>`;
    } else {
      selector.innerHTML = '<option value="" disabled selected>No hay sesión activa</option>';
    }
  },

  getLocalDateString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  async updateRouteTracking() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser || (currentUser.role !== 'Agente de Ruta' && currentUser.role !== 'agent' && currentUser.role !== 'Agente Independiente')) {
      const btn = document.getElementById('btn-agent-route-tracking');
      if (btn) btn.style.display = 'none';
      return;
    }

    const btn = document.getElementById('btn-agent-route-tracking');
    if (!btn) return;
    
    btn.style.display = 'inline-flex';

    try {
      const clients = await window.BulaPayDB.getClients();
      const todayStr = this.getLocalDateString();
      const allPayments = await window.BulaPayDB.getPayments();
      
      const todayPaymentsMap = new Set(
        allPayments
          .filter(p => p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago')
          .map(p => p.clientCedula)
      );

      const totalClientsCount = clients.length;
      let paidClientsCount = 0;

      clients.forEach(c => {
        if (todayPaymentsMap.has(c.cedula)) {
          paidClientsCount++;
        }
      });

      const progressEl = document.getElementById('agent-tracking-progress');
      if (progressEl) progressEl.textContent = `${paidClientsCount}/${totalClientsCount}`;

      const dotEl = document.getElementById('agent-tracking-dot');
      
      btn.style.transition = 'var(--transition-smooth)';
      
      if (totalClientsCount === 0) {
        btn.style.backgroundColor = 'var(--bg-secondary)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border-color)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--text-muted)';
      } else if (paidClientsCount === totalClientsCount) {
        btn.style.backgroundColor = 'var(--color-verde-bg)';
        btn.style.color = 'var(--color-verde)';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--color-verde)';
      } else if (paidClientsCount > 0) {
        btn.style.backgroundColor = 'var(--color-amarillo-bg)';
        btn.style.color = 'var(--color-amarillo)';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--color-amarillo)';
      } else {
        btn.style.backgroundColor = 'var(--color-rojo-bg)';
        btn.style.color = 'var(--color-rojo)';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--color-rojo)';
      }
    } catch (e) {
      console.error("Error al actualizar seguimiento de ruta:", e);
    }
  },

  async openRouteTrackingModal() {
    const modal = document.getElementById('agent-route-tracking-modal');
    if (!modal) return;
    
    const content = document.getElementById('route-tracking-modal-content');
    if (!content) return;

    content.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">Cargando clientes...</p>';
    modal.style.display = 'flex';

    try {
      const clients = await window.BulaPayDB.getClients();
      const todayStr = this.getLocalDateString();
      const allPayments = await window.BulaPayDB.getPayments();
      
      const todayPaymentsMap = new Set(
        allPayments
          .filter(p => p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago')
          .map(p => p.clientCedula)
      );

      if (clients.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">No tiene clientes asignados hoy.</p>';
        return;
      }

      // 3. Renderizado Condicional del Contenido (Los Datos)
      const renderClients = () => {
        let htmlContent = '';
        clients.forEach(c => {
          const hasPaidRecordToday = todayPaymentsMap.has(c.cedula);
          
          const isCancelled = Number(c.outstanding) <= 0;
          const clientPayments = allPayments.filter(p => String(p.clientCedula) === String(c.cedula));
          const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(c, clientPayments);
          const todayStatus = dailyStatusList.find(s => s.isToday);
          const hasPaidTodayQuota = todayStatus ? todayStatus.hasPaid : false;
          
          const hasPaid = isCancelled || hasPaidRecordToday || hasPaidTodayQuota;

          const clientCreatedAt = c.created_at ? new Date(c.created_at) : new Date(0);
          const msIn24Hours = 24 * 60 * 60 * 1000;
          const isNewClient = (Date.now() - clientCreatedAt.getTime()) < msIn24Hours;
          const isNewUnpaid = !hasPaid && isNewClient;

          let borderStyle, bgStyle, textColor, badgeBg, dashedBorder;

          if (hasPaid) {
            borderStyle = 'rgba(16, 185, 129, 0.4)';
            bgStyle = 'var(--color-verde-bg)';
            textColor = 'var(--color-verde)';
            badgeBg = 'rgba(16, 185, 129, 0.2)';
            dashedBorder = 'rgba(16, 185, 129, 0.2)';
          } else if (isNewUnpaid) {
            borderStyle = 'var(--border-color, rgba(156, 163, 175, 0.4))';
            bgStyle = 'var(--bg-primary, #ffffff)';
            textColor = 'var(--text-primary, #333333)';
            badgeBg = 'var(--bg-secondary, rgba(156, 163, 175, 0.15))';
            dashedBorder = 'var(--border-color, rgba(156, 163, 175, 0.2))';
          } else {
            borderStyle = 'rgba(239, 68, 68, 0.4)';
            bgStyle = 'var(--color-rojo-bg)';
            textColor = 'var(--color-rojo)';
            badgeBg = 'rgba(239, 68, 68, 0.2)';
            dashedBorder = 'rgba(239, 68, 68, 0.2)';
          }

          const clientCedula = String(c.cedula || 'No registrada');
          
          let badgeText = clientCedula;
          if (isCancelled) badgeText = 'Cancelado';
          else if (hasPaid) badgeText = 'Pagó';
          
          const clientName = c.name || 'Desconocido';
          const clientPhone = c.phone || 'Sin teléfono';
          const clientAddress = (c.zone || c.city) ? `${c.zone || 'N/A'}, ${c.city || 'N/A'}` : 'Sin dirección';
          const clientInstallment = c.installmentAmount ? `$${Number(c.installmentAmount).toLocaleString('es-CO')}` : '0';
          
          htmlContent += `
            <div class="tracking-client-item" style="border: 1px solid ${borderStyle}; border-radius: 10px; background-color: ${bgStyle}; overflow: hidden; margin-bottom: 0.5rem; transition: var(--transition-smooth); min-height: 44px; width: 100%;">
              <div class="client-accordion-header" style="padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: text; width: 100%; min-height: 44px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                  <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-align: left;">${clientName}</span>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); user-select: all;">C.C. ${clientCedula}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: auto;">
                  <span class="status-badge" onclick="event.stopPropagation()" style="font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.4rem; border-radius: 4px; background-color: ${badgeBg}; color: ${textColor}; border: 1px solid ${borderStyle}; display: inline-block; user-select: all; cursor: text;">${badgeText}</span>
                  <span class="accordion-arrow" style="font-size: 0.75rem; color: var(--text-secondary); transition: transform 0.2s; display: inline-block; transform: rotate(0deg); pointer-events: none;">▼</span>
                </div>
              </div>
              <div id="details-${clientCedula}" class="tracking-client-details" style="display: none; padding: 0.75rem 1rem; font-size: 0.75rem; border-top: 1px dashed ${dashedBorder}; flex-direction: column; gap: 0.35rem; color: var(--text-secondary); width: 100%; animation: fadeIn 0.2s ease-in-out;">
                <div><strong>Cédula:</strong> <span style="color: var(--text-primary); font-weight: 500;">${c.cedula || 'No registrada'}</span></div>
                <div><strong>Teléfono:</strong> <span style="color: var(--text-primary); font-weight: 500;">${c.phone || 'Sin teléfono'}</span></div>
                <div><strong>Dirección:</strong> <span style="color: var(--text-primary); font-weight: 500;">${c.direccion || clientAddress}</span></div>
                <div><strong>Cuota:</strong> <span style="font-weight: 700; color: var(--text-primary);">${clientInstallment}</span></div>
                <button class="btn-select-client" data-cedula="${c.cedula}" style="margin-top: 0.5rem; padding: 0.6rem; background-color: var(--color-primario); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🧾 Cobrar a este cliente</button>
              </div>
            </div>
          `;
        });
        content.innerHTML = htmlContent;

        // Interacción: Seleccionar cliente para cobrar
        const selectButtons = content.querySelectorAll('.btn-select-client');
        selectButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const cedula = e.target.getAttribute('data-cedula');
            
            // Cerrar el modal
            const modal = document.getElementById('agent-route-tracking-modal');
            if (modal) modal.style.display = 'none';
            
            // Llenar el input y disparar la búsqueda
            const input = document.getElementById('cobrar-search-input');
            if (input) {
              input.value = cedula;
              const searchBtn = document.getElementById('btn-agent-search');
              if (searchBtn) searchBtn.click();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        });
      };

      // Iniciar el renderizado inicial
      renderClients();
    } catch (e) {
      console.error("Error al abrir modal de seguimiento:", e);
      content.innerHTML = '<p style="text-align: center; color: var(--color-rojo); font-size: 0.8rem; padding: 1rem;">Error al cargar datos.</p>';
    }
  },

  closeRouteTrackingModal() {
    const modal = document.getElementById('agent-route-tracking-modal');
    if (modal) modal.style.display = 'none';
  },

  async generateCashReport() {
    try {
      const currentUser = window.BulaPayDB.getCurrentUser();
      if (!currentUser) return;

      const todayStr = this.getLocalDateString();
      const allPayments = await window.BulaPayDB.getPayments();
      
      // Filtrar cobros por el cobrador actual y fecha de hoy estrictamente en hora local
      const todayPayments = allPayments.filter(p => 
        p.date === todayStr && 
        Number(p.amount) > 0 && 
        p.status !== 'No Pago' &&
        p.agentName && p.agentName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
      );
      const totalCollected = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Obtener clientes creados hoy por este cobrador
      const allClients = await window.BulaPayDB.getClients();
      const todayClients = allClients.filter(c => {
        if (!c.created_at) return false;
        // Filtrado estricto convirtiendo c.created_at a la zona horaria local
        const clientLocalDate = this.getLocalDateString(new Date(c.created_at));
        return clientLocalDate === todayStr;
      });

      // Sumar capital prestado (asumiendo interés comercial estándar de 20%)
      // capital = totalDebt / 1.2
      const totalLent = todayClients.reduce((sum, c) => sum + Math.round(Number(c.totalDebt) / 1.2), 0);
      const netCash = totalCollected - totalLent;

      // Poblar el modal tipo tirilla/factura
      document.getElementById('cash-report-date').textContent = `Fecha: ${todayStr}`;
      document.getElementById('cash-report-agent').textContent = `Cobrador: ${currentUser.name}`;
      document.getElementById('cash-report-income').textContent = `+$${totalCollected.toLocaleString('es-CO')}`;
      document.getElementById('cash-report-expenses').textContent = `-$${totalLent.toLocaleString('es-CO')}`;
      
      const netEl = document.getElementById('cash-report-net');
      netEl.textContent = `$${netCash.toLocaleString('es-CO')}`;
      
      if (netCash < 0) {
        netEl.style.color = '#dc2626';
      } else {
        netEl.style.color = '#111111';
      }

      // Mostrar el modal de reporte
      const reportModal = document.getElementById('agent-cash-report-modal');
      if (reportModal) {
        reportModal.style.display = 'flex';
      }
    } catch (e) {
      console.error("Error al generar reporte de caja:", e);
      alert("❌ Error al calcular el reporte de caja.");
    }
  },

  destroy() {
    this.stopLocationMonitoring();
  }
};

window.agentModule = agentModule;
