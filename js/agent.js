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

    if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente')) {
      if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
      if (roleTag) roleTag.textContent = currentUser.role;
      
      const routes = await window.BulaPayDB.getRoutes();
      const myRoute = routes.find(r => r.agentUsername && r.agentUsername.split(', ').map(u => u.trim()).includes(currentUser.username));
      
      if (agentRouteElement) {
        if (currentUser.role === 'Agente Independiente') {
          agentRouteElement.textContent = 'Cobrador Independiente';
        } else {
          agentRouteElement.textContent = myRoute 
            ? `Ruta: ${myRoute.name} | Capital: $${Number(myRoute.capital).toLocaleString('es-CO')}` 
            : 'Ruta no asignada';
        }
      }
    } else {
      // Generic fallback
      if (agentNameElement) agentNameElement.textContent = 'Cobrador: Juan Pérez';
      if (agentRouteElement) agentRouteElement.textContent = 'Ruta Centro - Norte';
      if (roleTag) roleTag.textContent = 'Agente de Ruta';
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
        this.historyResults.style.display = 'none';
        this.historyError.style.display = 'none';
        this.historyPlaceholder.style.display = 'block';
        this.inputHistoryCedula.value = '';
      } else if (tab === 'register') {
        this.tabRegister.classList.add('active');
        this.panelRegister.style.display = 'block';
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

      // Renderizar Días de Mora en Historial / Evaluación de Riesgo
      try {
        const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
        const dailyStatus = window.BulaPayDB.getDailyPaymentStatus(client, payments);
        const container = document.getElementById('history-overdue-days-list');
        window.BulaPayDB.renderOverdueDaysList(container, dailyStatus);
      } catch (e) {
        console.error("Error al renderizar días de mora en verificarHistorialCliente:", e);
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
    
    // Calcular el acumulado total pagado por el cliente
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

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
      
      const isPaid = totalPaid >= i * installmentAmount;
      const isPartiallyPaid = !isPaid && totalPaid > (i - 1) * installmentAmount;
      
      if (isPaid) {
        cell.classList.add('pagado');
        cell.innerHTML = `Cuota ${i}<br>✔`;
      } else if (isPartiallyPaid) {
        cell.classList.add('abonado');
        const abonoAmount = totalPaid - ((i - 1) * installmentAmount);
        cell.innerHTML = `Cuota ${i}<br>Abonado:<br>$${Number(abonoAmount).toLocaleString('es-CO')}`;
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
      // Validar si ya pagó hoy
      const todayStr = new Date().toISOString().split('T')[0];
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

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
      await this.renderClientInfo(updatedClient);

      // Refrescar el Cartón de Pagos
      await this.renderPaymentCardGrid();
      
      // Actualizar saldo mostrado en el modal
      this.paymentCardClientOutstanding.textContent = `$${Number(updatedClient.outstanding).toLocaleString('es-CO')}`;
      
      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
      
    } catch (err) {
      console.error("Error al pagar cuota desde cartón:", err);
      if (err.message && err.message.includes('Precaución')) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el pago de la cuota.');
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
        this.searchResults.style.display = 'none';
        this.searchPlaceholder.style.display = 'block';
        return;
      }

      await this.renderClientInfo(client);
    } catch (err) {
      console.error(err);
      alert('❌ Error al buscar cliente.');
    }
  },

  async renderClientInfo(client) {
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

    // Renderizar Días de Mora en Detalles del Cliente
    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
      const dailyStatus = window.BulaPayDB.getDailyPaymentStatus(client, payments);
      const container = document.getElementById('client-overdue-days-list');
      window.BulaPayDB.renderOverdueDaysList(container, dailyStatus);
    } catch (e) {
      console.error("Error al renderizar días de mora en renderClientInfo:", e);
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
      const todayStr = new Date().toISOString().split('T')[0];
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

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
      await this.renderClientInfo(updatedClient);

      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('Precaución')) {
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
      const todayStr = new Date().toISOString().split('T')[0];
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

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
      await this.renderClientInfo(updatedClient);

      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('Precaución')) {
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
        routeId,
        agent_id: agentId
      };

      console.log('[DEBUG] Objeto cliente a guardar:', newClient);

      // Guardar
      await window.BulaPayDB.saveClient(newClient);
      this.currentClient = newClient;
      console.log('[DEBUG] Cliente guardado exitosamente en base de datos. currentClient:', this.currentClient);

      // Envío de email de bienvenida (Resend placeholder)
      console.log('[DEBUG] Llamando a sendWelcomeEmail para:', newClient.email);
      this.sendWelcomeEmail(newClient);

      // Resetear formulario
      this.formRegisterClient.reset();

      // Mostrar modal simulador WhatsApp
      this.showWhatsAppMockup(newClient);
    } catch (err) {
      console.error('[DEBUG ERROR] Error atrapado al registrar cliente en agent.js:', err);
      if (err && typeof err === 'object') {
        console.error('[DEBUG ERROR] Detalles del error (claves):', Object.keys(err));
        console.error('[DEBUG ERROR] Error stringificado:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      }
      const dupMsg = window.BulaPayDB.getClientDuplicationMessage(err);
      if (dupMsg) {
        alert(dupMsg);
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
      const todayStr = new Date().toISOString().split('T')[0];
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
    const content = document.getElementById('route-tracking-modal-content');
    if (!modal || !content) return;

    content.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.8rem;">Cargando listado...</p>';
    modal.style.display = 'flex';

    try {
      const clients = await window.BulaPayDB.getClients();
      const todayStr = new Date().toISOString().split('T')[0];
      const allPayments = await window.BulaPayDB.getPayments();
      
      const todayPaymentsMap = new Set(
        allPayments
          .filter(p => p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago')
          .map(p => p.clientCedula)
      );

      content.innerHTML = '';

      if (clients.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">No tiene clientes asignados hoy.</p>';
        return;
      }

      clients.forEach(c => {
        const hasPaid = todayPaymentsMap.has(c.cedula);
        const item = document.createElement('div');
        item.className = 'tracking-client-item';
        
        const borderStyle = hasPaid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        const bgStyle = hasPaid ? 'var(--color-verde-bg)' : 'var(--color-rojo-bg)';
        const textColor = hasPaid ? 'var(--color-verde)' : 'var(--color-rojo)';
        const badgeBg = hasPaid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        const badgeText = hasPaid ? 'Pagó' : 'Pendiente';
        const dashedBorder = hasPaid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        
        item.style.border = `1px solid ${borderStyle}`;
        item.style.borderRadius = '10px';
        item.style.backgroundColor = bgStyle;
        item.style.overflow = 'hidden';
        item.style.marginBottom = '0.5rem';
        item.style.transition = 'var(--transition-smooth)';
        item.style.minHeight = '44px';
        
        item.innerHTML = `
          <div class="tracking-client-header" style="padding: 0.75rem 1rem !important; display: flex !important; justify-content: space-between !important; align-items: center !important; cursor: pointer !important; user-select: none !important; width: 100% !important; min-height: 44px !important; visibility: visible !important; opacity: 1 !important;">
            <span style="font-weight: 700 !important; font-size: 0.85rem !important; color: var(--text-primary) !important; text-align: left !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important;">${c.name}</span>
            <div style="display: flex !important; align-items: center !important; gap: 0.5rem !important; margin-left: auto !important;">
              <span class="status-badge" style="font-size: 0.7rem !important; font-weight: bold !important; padding: 0.15rem 0.4rem !important; border-radius: 4px !important; background-color: ${badgeBg} !important; color: ${textColor} !important; border: 1px solid ${borderStyle} !important; display: inline-block !important;">${badgeText}</span>
              <span class="accordion-arrow" style="font-size: 0.75rem !important; color: var(--text-secondary) !important; transition: transform 0.2s !important; display: inline-block !important;">▼</span>
            </div>
          </div>
          <div class="tracking-client-details" style="padding: 0.75rem 1rem !important; display: none; font-size: 0.75rem !important; border-top: 1px dashed ${dashedBorder} !important; flex-direction: column !important; gap: 0.35rem !important; color: var(--text-secondary) !important; margin-top: 0.25rem !important; width: 100% !important;">
            <div><strong>Cédula:</strong> <span style="color: var(--text-primary) !important; font-weight: 500 !important;">${c.cedula}</span></div>
            <div><strong>Teléfono:</strong> <span style="color: var(--text-primary) !important; font-weight: 500 !important;">${c.phone}</span></div>
            <div><strong>Dirección:</strong> <span style="color: var(--text-primary) !important; font-weight: 500 !important;">${c.zone}, ${c.city}</span></div>
            <div><strong>Valor Cuota:</strong> <span style="font-weight: 700 !important; color: var(--text-primary) !important;">$${Number(c.installmentAmount).toLocaleString('es-CO')}</span></div>
          </div>
        `;
        
        content.appendChild(item);
      });

      const headers = content.querySelectorAll('.tracking-client-header');
      headers.forEach(h => {
        h.addEventListener('click', () => {
          const item = h.parentElement;
          const details = item.querySelector('.tracking-client-details');
          const arrow = h.querySelector('.accordion-arrow');
          const isOpen = details.style.display === 'flex';
          
          content.querySelectorAll('.tracking-client-details').forEach(d => d.style.display = 'none');
          content.querySelectorAll('.accordion-arrow').forEach(a => a.style.transform = 'rotate(0deg)');
          
          if (!isOpen) {
            details.style.display = 'flex';
            arrow.style.transform = 'rotate(180deg)';
          }
        });
      });
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

      const todayStr = new Date().toISOString().split('T')[0];
      const allPayments = await window.BulaPayDB.getPayments();
      
      // Filtrar cobros por el cobrador actual y fecha de hoy
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
        const createdDateStr = c.created_at.split('T')[0];
        return createdDateStr === todayStr;
      });

      // Sumar capital prestado (asumiendo interés comercial estándar de 20%)
      // capital = totalDebt / 1.2
      const totalLent = todayClients.reduce((sum, c) => sum + Math.round(Number(c.totalDebt) / 1.2), 0);
      const netCash = totalCollected - totalLent;

      const message = `📋 REPORTE DE CAJA DIARIO\n` +
                      `-----------------------------------\n` +
                      `• Total Cobrado en Cuotas: $${totalCollected.toLocaleString('es-CO')}\n` +
                      `• Total Prestado a Nuevos Clientes: $${totalLent.toLocaleString('es-CO')}\n` +
                      `-----------------------------------\n` +
                      `💰 TOTAL EFECTIVO A ENTREGAR: $${netCash.toLocaleString('es-CO')}`;
      
      alert(message);
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
