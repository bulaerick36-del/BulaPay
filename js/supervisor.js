// Módulo del Supervisor (Dashboard y Gestión de Rutas Interactivo)

const supervisorModule = {
  mapAnimationInterval: null,
  liveFeedInterval: null,
  activeKpiModal: null,
  handlePaymentRegistered: null,
  mapInstance: null,
  mapMarkers: {},
  mapUpdateInterval: null,
  cachedUsers: null,

  async getCachedUsers(forceRefresh = false) {
    if (!this.cachedUsers || forceRefresh) {
      this.cachedUsers = await window.BulaPayDB.getUsers();
    }
    return this.cachedUsers;
  },

  async init() {
    this.cachedUsers = null; // Limpiar caché al inicializar
    this.formCreateRoute = document.getElementById('form-create-route');
    this.routesTbody = document.getElementById('routes-tbody');
    this.welcomeMsg = document.getElementById('supervisor-welcome-msg');
    
    // KPIs
    this.kpiActiveAgents = document.getElementById('kpi-active-agents');
    this.kpiTotalCapital = document.getElementById('kpi-total-capital');
    this.kpiTotalCollected = document.getElementById('kpi-total-collected');
    this.kpiRouteProgress = document.getElementById('kpi-route-progress');

    const currentUser = window.BulaPayDB.getCurrentUser();
    const isCommerce = currentUser && currentUser.role === 'Otros (Comercios, Compraventas, Mercados)';

    this.bindEvents();
    await this.renderDashboard();
    
    if (isCommerce) {
      if (this.mapUpdateInterval) clearInterval(this.mapUpdateInterval);
      if (this.operatingTimeInterval) clearInterval(this.operatingTimeInterval);
      return;
    }
    
    // Inicializar el mapa GPS Leaflet
    this.initGpsMap();

    await this.initMapRouteFilter();
    await this.renderLiveFeed();
    this.calculateRouteSuggestedQuota(); // Calcular inicial

    // Actualizar marcadores periódicamente (cada 30 segundos)
    if (this.mapUpdateInterval) clearInterval(this.mapUpdateInterval);
    this.mapUpdateInterval = setInterval(() => this.updateMapMarkers(), 30 * 1000);

    // Actualizar tiempos de operación periódicamente (cada 30 segundos)
    if (this.operatingTimeInterval) clearInterval(this.operatingTimeInterval);
    this.operatingTimeInterval = setInterval(() => this.updateOperatingTimes(), 30 * 1000);
  },

  bindEvents() {
    // Manejo de Pestañas de Ruta (Crear / Gestionar)
    const btnTabCreate = document.getElementById('btn-route-tab-create');
    const btnTabManage = document.getElementById('btn-route-tab-manage');
    const contentCreate = document.getElementById('route-tab-content-create');
    const contentManage = document.getElementById('route-tab-content-manage');

    if (btnTabCreate && btnTabManage) {
      btnTabCreate.addEventListener('click', () => {
        btnTabCreate.classList.add('active');
        btnTabCreate.style.backgroundColor = 'var(--bg-primary)';
        btnTabCreate.style.color = 'var(--accent)';
        
        btnTabManage.classList.remove('active');
        btnTabManage.style.backgroundColor = 'transparent';
        btnTabManage.style.color = 'var(--text-secondary)';

        contentCreate.style.display = 'block';
        contentManage.style.display = 'none';
      });

      btnTabManage.addEventListener('click', async () => {
        btnTabManage.classList.add('active');
        btnTabManage.style.backgroundColor = 'var(--bg-primary)';
        btnTabManage.style.color = 'var(--accent)';
        
        btnTabCreate.classList.remove('active');
        btnTabCreate.style.backgroundColor = 'transparent';
        btnTabCreate.style.color = 'var(--text-secondary)';

        contentCreate.style.display = 'none';
        contentManage.style.display = 'block';

        await this.renderManageRoutesList();
      });
    }

    // Submit del formulario para agregar agente en el modal
    const formModalAddAgent = document.getElementById('form-modal-add-agent');
    if (formModalAddAgent) {
      formModalAddAgent.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddAgentFromModal();
      });
    }

    // Crear Nueva Ruta y Credenciales de Agente (Múltiples)
    if (this.formCreateRoute) {
      this.formCreateRoute.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const routeName = document.getElementById('route-name').value.trim();
        const capitalBase = parseFloat(document.getElementById('route-capital').value) || 0;
        
        // Obtener todos los agentes definidos en el formulario
        const agentGroups = document.querySelectorAll('#route-agents-list .agent-fields-group');
        const agentsData = [];
        let validationFailed = false;

        for (const group of agentGroups) {
          const nameInput = group.querySelector('.route-agent-name').value.trim();
          const cedulaInput = group.querySelector('.route-agent-cedula').value.trim();
          const usernameInput = group.querySelector('.route-agent-username').value.trim().toLowerCase();
          const passwordInput = group.querySelector('.route-agent-password').value;

          // Validar si el usuario ya existe
          const existingUser = await window.BulaPayDB.getUserByUsername(usernameInput);
          if (existingUser) {
            alert(`❌ El nombre de usuario "${usernameInput}" ya está registrado.`);
            validationFailed = true;
            return;
          }

          agentsData.push({
            name: nameInput,
            cedula: cedulaInput,
            username: usernameInput,
            password: passwordInput
          });
        }

        if (validationFailed || agentsData.length === 0) return;

        const supervisorUser = window.BulaPayDB.getCurrentUser() || { username: 'admin' };
        const routeId = 'route_' + Date.now();

        // 1. Crear la Ruta Logística PRIMERO (para que la FK en users sea válida)
        const combinedNames = agentsData.map(a => a.name).join(', ');
        const combinedUsernames = agentsData.map(a => a.username).join(', ');

        const newRoute = {
          id: routeId,
          name: routeName,
          agentUsername: combinedUsernames,
          agentName: combinedNames,
          capital: capitalBase,
          collected: 0,
          status: 'En Ruta',
          date: new Date().toISOString().split('T')[0]
        };

        try {
          await window.BulaPayDB.saveRoute(newRoute);

          // 2. Registrar cada agente en la base de datos SEGUNDO
          for (const agent of agentsData) {
            const newAgent = {
              username: agent.username,
              password: agent.password,
              name: agent.name,
              role: 'Agente de Ruta',
              supervisor: supervisorUser.username,
              routeId: routeId,
              documentType: 'CC',
              documentNumber: agent.cedula
            };
            await window.BulaPayDB.saveUser(newAgent);
          }

          alert(`✅ Ruta "${routeName}" creada con éxito.\n👤 Se registraron ${agentsData.length} agentes asignados.`);
          
          // Resetear formulario y dejar solo un agente
          this.formCreateRoute.reset();
          document.getElementById('route-agents-list').innerHTML = `
            <div class="agent-fields-group" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem;">
              <h5 style="color: var(--text-secondary); font-size: 0.75rem; margin-bottom: 0.5rem;">Agente Principal</h5>
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label style="font-size: 0.7rem;">Nombre Completo del Agente</label>
                <input type="text" class="route-agent-name" placeholder="Ej. Juan Pérez" required style="padding: 0.5rem; font-size: 0.85rem;">
              </div>
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label style="font-size: 0.7rem;">Número de Cédula</label>
                <input type="text" class="route-agent-cedula" placeholder="Ej. 12345678" required style="padding: 0.5rem; font-size: 0.85rem;">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label style="font-size: 0.7rem;">Usuario (Login)</label>
                  <input type="text" class="route-agent-username" placeholder="Usuario" required autocomplete="username" style="padding: 0.5rem; font-size: 0.85rem;">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label style="font-size: 0.7rem;">Contraseña</label>
                  <input type="password" class="route-agent-password" placeholder="Contraseña" required autocomplete="new-password" style="padding: 0.5rem; font-size: 0.85rem;">
                </div>
              </div>
            </div>
          `;

          await this.renderDashboard();
          await this.initMapRouteFilter();
        } catch (err) {
          console.error(err);
          const errorMsg = err.message || err.details || JSON.stringify(err);
          alert(`❌ Error al crear la ruta o guardar los agentes:\n${errorMsg}`);
        }
      });
    }

    // Conectar el botón de ver cartera de clientes del agente
    const btnViewAgentClients = document.getElementById('btn-view-agent-clients');
    if (btnViewAgentClients) {
      btnViewAgentClients.addEventListener('click', () => this.openAgentAuditView());
    }

    // Escuchar el evento de pago registrado en tiempo real
    if (this.handlePaymentRegistered) {
      window.removeEventListener('bulapay-payment-registered', this.handlePaymentRegistered);
    }
    this.handlePaymentRegistered = async () => {
      await this.renderDashboard();
      await this.renderLiveFeed();
      await this.updateMapMarkers();
    };
    window.addEventListener('bulapay-payment-registered', this.handlePaymentRegistered);

    // Calculadora en tiempo real para el valor de cuota en el registro de venta del comercio
    const salePriceInput = document.getElementById('sale-product-price');
    const saleInstallmentsInput = document.getElementById('sale-installments');
    if (salePriceInput && saleInstallmentsInput) {
      const calcFn = () => this.calculateCommerceInstallmentValue();
      salePriceInput.addEventListener('input', calcFn);
      saleInstallmentsInput.addEventListener('input', calcFn);
    }
  },

  calculateCommerceInstallmentValue() {
    const priceInput = document.getElementById('sale-product-price');
    const installmentsInput = document.getElementById('sale-installments');
    const resultInput = document.getElementById('sale-installment-value');

    if (!priceInput || !installmentsInput || !resultInput) return;

    const priceRaw = priceInput.value.replace(/\./g, '');
    const price = parseFloat(priceRaw) || 0;
    const installments = parseInt(installmentsInput.value) || 0;

    if (price > 0 && installments > 0) {
      const installmentVal = Math.round(price / installments);
      resultInput.value = installmentVal.toLocaleString('es-CO');
    } else {
      resultInput.value = '';
    }
  },

  // CALCULADORA AUTOMÁTICA
  calculateRouteSuggestedQuota() {
    const capitalInput = document.getElementById('route-capital');
    const marginInput = document.getElementById('route-margin');
    const totalRecollectInput = document.getElementById('route-total-recollect');
    const suggestedQuotaInput = document.getElementById('route-suggested-quota');

    if (!capitalInput || !marginInput) return;

    const base = parseFloat(capitalInput.value) || 0;
    const marginPercent = parseFloat(marginInput.value) || 0;

    const total = Math.round(base * (1 + (marginPercent / 100)));
    const dailySuggested = Math.round(total / 30);

    if (totalRecollectInput) totalRecollectInput.value = `$${total.toLocaleString('es-CO')}`;
    if (suggestedQuotaInput) suggestedQuotaInput.value = `$${dailySuggested.toLocaleString('es-CO')}`;
  },

  // CREACIÓN MÚLTIPLE DE AGENTES (AGREGAR CAMPOS)
  addAgentFieldGroup() {
    const container = document.getElementById('route-agents-list');
    if (!container) return;

    const groupCount = container.querySelectorAll('.agent-fields-group').length + 1;
    const newGroup = document.createElement('div');
    newGroup.className = 'agent-fields-group';
    newGroup.style.background = 'rgba(255,255,255,0.01)';
    newGroup.style.border = '1px solid var(--border-color)';
    newGroup.style.borderRadius = '8px';
    newGroup.style.padding = '0.75rem';
    newGroup.style.marginBottom = '0.75rem';
    newGroup.style.marginTop = '0.5rem';

    newGroup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h5 style="color: var(--accent); font-size: 0.75rem; margin: 0;">Agente Adicional #${groupCount}</h5>
        <button type="button" onclick="supervisorModule.removeAgentFieldGroup(this)" style="background: transparent; border: none; color: var(--color-rojo); cursor: pointer; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Eliminar</button>
      </div>
      <div class="form-group" style="margin-bottom: 0.75rem;">
        <label style="font-size: 0.7rem;">Nombre Completo del Agente</label>
        <input type="text" class="route-agent-name" placeholder="Ej. Pedro Gómez" required style="padding: 0.5rem; font-size: 0.85rem;">
      </div>
      <div class="form-group" style="margin-bottom: 0.75rem;">
        <label style="font-size: 0.7rem;">Número de Cédula</label>
        <input type="text" class="route-agent-cedula" placeholder="Ej. 98765432" required style="padding: 0.5rem; font-size: 0.85rem;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.7rem;">Usuario (Login)</label>
          <input type="text" class="route-agent-username" placeholder="Usuario" required autocomplete="username" style="padding: 0.5rem; font-size: 0.85rem;">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.7rem;">Contraseña</label>
          <input type="password" class="route-agent-password" placeholder="Contraseña" required autocomplete="new-password" style="padding: 0.5rem; font-size: 0.85rem;">
        </div>
      </div>
    `;
    container.appendChild(newGroup);
  },

  removeAgentFieldGroup(button) {
    const group = button.closest('.agent-fields-group');
    if (group) {
      group.remove();
    }
  },

  // KPIs INTERACTIVOS (DRILL-DOWN MODALS)
  async openKpiModal(kpi) {
    this.activeKpiModal = kpi;
    const overlay = document.getElementById(`modal-kpi-${kpi}`);
    if (!overlay) return;

    overlay.classList.add('active');
    
    // Poblar datos correspondientes
    if (kpi === 'agents') {
      await this.populateKpiAgentsModal();
    } else if (kpi === 'capital') {
      await this.populateKpiCapitalModal();
    } else if (kpi === 'collected') {
      await this.populateKpiCollectedModal();
    } else if (kpi === 'progress') {
      await this.populateKpiProgressModal();
    }
  },

  closeKpiModal(kpi) {
    const overlay = document.getElementById(`modal-kpi-${kpi}`);
    if (overlay) {
      overlay.classList.remove('active');
    }
    this.activeKpiModal = null;
  },

  // 1. POPULATE MODAL: AGENTES ACTIVOS
  async populateKpiAgentsModal() {
    const routeFilterInput = document.getElementById('modal-agents-route-filter');
    const listContainer = document.getElementById('modal-agents-list-container');
    const detailSection = document.getElementById('modal-agent-detail-section');
    const datalist = document.getElementById('route-datalist');
    
    if (!routeFilterInput || !listContainer) return;
    
    if (detailSection) detailSection.style.display = 'none';

    // Limpiar filtro
    routeFilterInput.value = '';

    // Llenar datalist dinámicamente con los nombres de todas las rutas activas
    if (datalist) {
      datalist.innerHTML = '';
      const routes = await window.BulaPayDB.getRoutes();
      routes.forEach(r => {
        const option = document.createElement('option');
        option.value = r.name;
        datalist.appendChild(option);
      });
    }

    await this.filterModalAgents();
  },

  async filterModalAgents() {
    const routeFilterInput = document.getElementById('modal-agents-route-filter');
    const listContainer = document.getElementById('modal-agents-list-container');
    if (!routeFilterInput || !listContainer) return;

    const filterText = routeFilterInput.value.trim().toLowerCase();
    const allUsers = await this.getCachedUsers();
    let agents = allUsers.filter(u => u.role === 'Agente de Ruta');
    const routes = await window.BulaPayDB.getRoutes();

    if (filterText !== '') {
      agents = agents.filter(a => {
        const r = routes.find(rt => rt.id === a.routeId);
        return r && r.name.toLowerCase().includes(filterText);
      });
    }

    listContainer.innerHTML = '';
    if (agents.length === 0) {
      listContainer.innerHTML = `<div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 1rem;">No hay agentes asociados a este filtro.</div>`;
      return;
    }

    agents.forEach(agent => {
      const r = routes.find(rt => rt.id === agent.routeId) || { name: 'Sin ruta asignada' };
      
      const item = document.createElement('div');
      item.style.padding = '0.75rem 1rem';
      item.style.background = 'rgba(255,255,255,0.02)';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '8px';
      item.style.cursor = 'pointer';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.transition = 'var(--transition-smooth)';
      
      item.innerHTML = `
        <div>
          <strong style="color: var(--text-primary); font-size: 0.9rem;">${agent.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Ruta: ${r.name}</div>
        </div>
        <span style="font-size: 0.75rem; color: var(--accent); font-weight: bold;">Ver detalles ➔</span>
      `;
      
      item.addEventListener('mouseenter', () => {
        item.style.borderColor = 'var(--accent)';
        item.style.backgroundColor = 'rgba(16, 185, 129, 0.03)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = 'var(--border-color)';
        item.style.backgroundColor = 'rgba(255,255,255,0.02)';
      });

      item.addEventListener('click', () => this.showModalAgentDetail(agent.username));
      listContainer.appendChild(item);
    });
  },

  selectedAuditAgentUsername: null,

  async showModalAgentDetail(username) {
    this.selectedAuditAgentUsername = username;
    const detailSection = document.getElementById('modal-agent-detail-section');
    const title = document.getElementById('modal-agent-detail-title');
    const clientsCountEl = document.getElementById('modal-agent-clients-count');
    const routeCapitalEl = document.getElementById('modal-agent-route-capital');
    const routeCollectedEl = document.getElementById('modal-agent-route-collected');
    
    if (!detailSection) return;

    const allUsers = await this.getCachedUsers();
    const agent = allUsers.find(u => u.username === username);
    if (!agent) return;

    title.textContent = `Detalles de Operación: ${agent.name}`;

    // Obtener clientes asignados a la ruta del agente
    const allClients = await window.BulaPayDB.getClients();
    const clients = allClients.filter(c => c.routeId === agent.routeId);
    clientsCountEl.textContent = `${clients.length} cliente(s)`;

    // Obtener capital y recaudo
    const routes = await window.BulaPayDB.getRoutes();
    const r = routes.find(rt => rt.id === agent.routeId);
    
    const capital = r ? r.capital : 0;
    const collected = r ? r.collected : 0;

    routeCapitalEl.textContent = `$${Number(capital).toLocaleString('es-CO')}`;
    routeCollectedEl.textContent = `$${Number(collected).toLocaleString('es-CO')}`;

    // Calcular proporciones de la cartera (Riesgo)
    let totalRisk = clients.length || 1;
    let greenCount = clients.filter(c => c.risk === 'Verde').length;
    let yellowCount = clients.filter(c => c.risk === 'Amarillo').length;
    let redCount = clients.filter(c => c.risk === 'Rojo').length;

    // Si no hay clientes, simular datos coherentes
    if (clients.length === 0) {
      greenCount = 1;
      yellowCount = 0;
      redCount = 0;
      totalRisk = 1;
    }

    const pGreen = (greenCount / totalRisk) * 100;
    const pYellow = (yellowCount / totalRisk) * 100;
    const pRed = (redCount / totalRisk) * 100;

    // Configurar segmentos SVG
    const greenEl = document.getElementById('chart-segment-green');
    const yellowEl = document.getElementById('chart-segment-yellow');
    const redEl = document.getElementById('chart-segment-red');

    if (greenEl && yellowEl && redEl) {
      greenEl.setAttribute('stroke-dasharray', `${pGreen} 100`);
      greenEl.setAttribute('stroke-dashoffset', '0');

      yellowEl.setAttribute('stroke-dasharray', `${pYellow} 100`);
      yellowEl.setAttribute('stroke-dashoffset', `-${pGreen}`);

      redEl.setAttribute('stroke-dasharray', `${pRed} 100`);
      redEl.setAttribute('stroke-dashoffset', `-${pGreen + pYellow}`);
    }

    detailSection.style.display = 'block';
  },

  async openAgentAuditView() {
    const username = this.selectedAuditAgentUsername;
    if (!username) return;

    const overlay = document.getElementById('modal-agent-audit-portfolio');
    const subtitle = document.getElementById('agent-audit-modal-subtitle');
    const listContainer = document.getElementById('agent-audit-clients-list');
    const ledgerContainer = document.getElementById('agent-audit-ledger-container');

    if (!overlay || !listContainer) return;

    if (ledgerContainer) ledgerContainer.style.display = 'none';
    listContainer.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 1rem;">Cargando cartera...</div>';

    overlay.classList.add('active');

    try {
      const allUsers = await this.getCachedUsers();
      const agent = allUsers.find(u => u.username === username);
      if (!agent) {
        alert('❌ No se encontró la información del agente.');
        this.closeAgentAuditModal();
        return;
      }

      const routes = await window.BulaPayDB.getRoutes();
      const route = routes.find(r => r.id === agent.routeId);
      const routeName = route ? route.name : 'Sin ruta asignada';

      if (subtitle) {
        subtitle.textContent = `Auditoría de Cartera: ${agent.name} | Ruta: ${routeName}`;
      }

      // Obtener todos los clientes de la ruta
      const allClients = await window.BulaPayDB.getClients();
      const clients = allClients.filter(c => c.routeId === agent.routeId);

      // Obtener todos los pagos de hoy
      const todayStr = new Date().toISOString().split('T')[0];
      const allPayments = await window.BulaPayDB.getPayments();
      const todayPayments = allPayments.filter(p => p.date === todayStr);

      listContainer.innerHTML = '';
      if (clients.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 1rem; border: 1px dashed var(--border-color); border-radius: 8px;">Este agente no tiene clientes asignados en su ruta.</div>';
        return;
      }

      clients.forEach(client => {
        // Verificar si el cliente hizo un abono hoy
        const clientTodayPayments = todayPayments.filter(p => p.clientCedula === client.cedula);
        const madePaymentToday = clientTodayPayments.some(p => p.status === 'Pagado' || p.status === 'Abonado');
        const statusIcon = madePaymentToday ? '✅' : '❌';
        const statusColor = madePaymentToday ? 'var(--color-verde)' : 'var(--color-rojo)';
        const statusLabel = madePaymentToday ? 'Recaudado Hoy' : 'Sin Cobro Hoy';
        const bgLight = madePaymentToday ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)';
        const borderLight = madePaymentToday ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';

        // Buscar nombre del agente por agent_id
        const associatedAgent = allUsers.find(u => u.username === client.agent_id);
        const agentNameLabel = associatedAgent ? associatedAgent.name : 'No asignado';

        const item = document.createElement('div');
        item.style.padding = '0.75rem 1rem';
        item.style.background = bgLight;
        item.style.border = `1px solid ${borderLight}`;
        item.style.borderRadius = '8px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.transition = 'var(--transition-smooth)';

        item.innerHTML = `
          <div>
            <span style="font-size: 1.1rem; margin-right: 0.5rem; vertical-align: middle;">${statusIcon}</span>
            <strong style="color: ${statusColor}; font-size: 0.9rem; font-weight: 700; transition: color 0.3s ease; vertical-align: middle;">${client.name}</strong>
            <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem; padding-left: 1.7rem;">Deuda: $${Number(client.outstanding).toLocaleString('es-CO')} | Agente: ${agentNameLabel}</div>
          </div>
          <span style="font-size: 0.65rem; background-color: ${madePaymentToday ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; color: ${statusColor}; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${statusLabel}</span>
        `;

        item.addEventListener('mouseenter', () => {
          item.style.borderColor = statusColor;
          item.style.backgroundColor = madePaymentToday ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.borderColor = borderLight;
          item.style.backgroundColor = bgLight;
        });

        item.addEventListener('click', () => this.showAgentClientAuditLedger(client.cedula));
        listContainer.appendChild(item);
      });

    } catch (err) {
      console.error(err);
      alert('❌ Error al cargar la cartera para auditar.');
    }
  },

  async showAgentClientAuditLedger(cedula) {
    const ledgerContainer = document.getElementById('agent-audit-ledger-container');
    const nameEl = document.getElementById('agent-audit-client-name');
    const metaEl = document.getElementById('agent-audit-client-meta');
    const gridEl = document.getElementById('agent-audit-ledger-grid');

    if (!ledgerContainer || !gridEl) return;

    try {
      const client = await window.BulaPayDB.getClientByCedula(cedula);
      if (!client) return;

      const allUsers = await this.getCachedUsers();
      const associatedAgent = allUsers.find(u => u.username === client.agent_id);
      const agentNameLabel = associatedAgent ? associatedAgent.name : 'No asignado';

      nameEl.textContent = client.name;
      metaEl.textContent = `Cédula: ${client.cedula} | Agente: ${agentNameLabel} | Saldo Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')} / $${Number(client.totalDebt).toLocaleString('es-CO')}`;

      const payments = await window.BulaPayDB.getPaymentsByClient(cedula);

      gridEl.innerHTML = '';
      const totalSlots = client.installmentsCount;
      
      for (let i = 1; i <= totalSlots; i++) {
        const payment = payments.find(p => p.installmentNumber === i);
        const slotCard = document.createElement('div');
        slotCard.className = 'ledger-slot-card'; // Reusar clases
        slotCard.style.padding = '0.5rem';
        slotCard.style.fontSize = '0.7rem';
        slotCard.style.minHeight = '70px';

        if (payment) {
          const isAbonado = payment.status === 'Abonado';
          const isNoPago = payment.status === 'No Pago';
          
          if (isNoPago) {
            slotCard.classList.add('nopago');
            slotCard.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            slotCard.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
          } else {
            slotCard.classList.add(isAbonado ? 'abonado' : 'paid');
          }
          
          slotCard.innerHTML = `
            <span class="slot-num" style="font-size: 0.55rem;">CUOTA ${i}</span>
            <span class="slot-amount" style="font-size: 0.75rem;">$${Number(payment.amount).toLocaleString('es-CO')}</span>
            <span class="slot-date" style="font-size: 0.5rem; display:block;">${payment.date}</span>
            <div class="slot-stamp" style="font-size: 0.75rem; bottom:2px; right:4px;">${isNoPago ? '🔴' : (isAbonado ? '🟡' : '🟢')}</div>
          `;
          slotCard.addEventListener('click', () => {
            window.showBulaPayReceipt(payment, client);
          });
        } else {
          slotCard.innerHTML = `
            <span class="slot-num" style="font-size: 0.55rem;">CUOTA ${i}</span>
            <span class="slot-amount" style="color: var(--text-muted); font-size: 0.7rem;">$${Number(client.installmentAmount).toLocaleString('es-CO')}</span>
            <span class="slot-empty-text" style="font-size: 0.55rem;">Atrasado</span>
          `;
          slotCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
          slotCard.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
        }

        gridEl.appendChild(slotCard);
      }

      // Restricción crítica: Ocultar o eliminar del DOM cualquier botón de 'Registrar Pago', 'Editar Cliente' o 'Eliminar'
      const forbiddenButtons = ledgerContainer.querySelectorAll('button');
      forbiddenButtons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes('registrar') || text.includes('pago') || text.includes('editar') || text.includes('eliminar') || text.includes('borrar')) {
          btn.remove();
        }
      });

      ledgerContainer.style.display = 'block';
    } catch (err) {
      console.error(err);
      alert('❌ Error al cargar el historial del cliente.');
    }
  },

  closeAgentAuditModal() {
    const overlay = document.getElementById('modal-agent-audit-portfolio');
    if (overlay) {
      overlay.classList.remove('active');
    }
  },

  // 2. POPULATE MODAL: CAPITAL ASIGNADO
  async populateKpiCapitalModal() {
    const container = document.getElementById('modal-capital-routes-container');
    const detailSection = document.getElementById('modal-capital-detail-section');
    if (!container) return;

    if (detailSection) detailSection.style.display = 'none';

    container.innerHTML = '';
    const routes = await window.BulaPayDB.getRoutes();

    routes.forEach(route => {
      const item = document.createElement('div');
      item.style.padding = '0.75rem 1rem';
      item.style.background = 'rgba(255,255,255,0.02)';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '8px';
      item.style.cursor = 'pointer';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.transition = 'var(--transition-smooth)';

      item.innerHTML = `
        <div>
          <strong style="color: white; font-size: 0.9rem;">${route.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Agente: ${route.agentName}</div>
        </div>
        <div style="text-align: right;">
          <strong style="color: var(--accent); font-size: 0.95rem;">$${Number(route.capital).toLocaleString('es-CO')}</strong>
          <div style="font-size: 0.65rem; color: var(--text-muted);">Clic para analizar</div>
        </div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.borderColor = 'var(--accent)';
        item.style.backgroundColor = 'rgba(0, 245, 212, 0.03)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = 'var(--border-color)';
        item.style.backgroundColor = 'rgba(255,255,255,0.02)';
      });

      item.addEventListener('click', () => this.showModalCapitalDetail(route.id));
      container.appendChild(item);
    });
  },

  async showModalCapitalDetail(routeId) {
    const detailSection = document.getElementById('modal-capital-detail-section');
    const title = document.getElementById('modal-capital-detail-title');
    const deliveredEl = document.getElementById('modal-capital-delivered');
    const collectedEl = document.getElementById('modal-capital-collected');
    const remainingEl = document.getElementById('modal-capital-remaining');
    const moraEl = document.getElementById('modal-capital-mora-index');

    if (!detailSection) return;

    const routes = await window.BulaPayDB.getRoutes();
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    title.textContent = `Análisis de Rendimiento: ${route.name}`;
    deliveredEl.textContent = `$${Number(route.capital).toLocaleString('es-CO')}`;
    collectedEl.textContent = `$${Number(route.collected).toLocaleString('es-CO')}`;
    
    const remaining = Math.max(0, Number(route.capital) - Number(route.collected));
    remainingEl.textContent = `$${remaining.toLocaleString('es-CO')}`;

    // Simular un índice de mora en base a clientes de esa ruta
    const allClients = await window.BulaPayDB.getClients();
    const clients = allClients.filter(c => c.routeId === route.id);
    const redCount = clients.filter(c => c.risk === 'Rojo').length;
    const yellowCount = clients.filter(c => c.risk === 'Amarillo').length;
    
    let moraPercent = 0;
    if (clients.length > 0) {
      moraPercent = Math.round(((redCount * 1.0 + yellowCount * 0.4) / clients.length) * 100);
    } else {
      moraPercent = routeId === 'route_2' ? 12 : 5; // seed fallback
    }

    moraEl.textContent = `${moraPercent}%`;

    detailSection.style.display = 'block';
  },

  // 3. POPULATE MODAL: RECAUDO HOY (RANKING)
  async populateKpiCollectedModal() {
    const container = document.getElementById('modal-collected-ranking-container');
    if (!container) return;

    container.innerHTML = '';
    const routes = await window.BulaPayDB.getRoutes();

    // Ordenar de mayor a menor recaudo
    const sortedRoutes = [...routes].sort((a, b) => Number(b.collected) - Number(a.collected));

    // Encontrar recaudo máximo para normalizar barra al 100%
    const maxCollected = sortedRoutes[0] ? Number(sortedRoutes[0].collected) : 1;

    sortedRoutes.forEach((route, index) => {
      const percentage = maxCollected > 0 ? Math.round((Number(route.collected) / maxCollected) * 100) : 0;
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏃';

      const wrapper = document.createElement('div');
      wrapper.className = 'ranking-bar-wrapper';

      wrapper.innerHTML = `
        <div class="ranking-bar-info">
          <span>${medal} <strong>#${rank} ${route.name}</strong> (${route.agentName})</span>
          <span style="color: var(--color-verde); font-weight: 700;">$${Number(route.collected).toLocaleString('es-CO')}</span>
        </div>
        <div class="ranking-bar-container">
          <div class="ranking-bar-fill" id="rank-bar-${route.id}"></div>
        </div>
      `;

      container.appendChild(wrapper);

      // Animar barra
      setTimeout(() => {
        const bar = document.getElementById(`rank-bar-${route.id}`);
        if (bar) bar.style.width = `${percentage}%`;
      }, 100);
    });
  },

  // 4. POPULATE MODAL: PROGRESO DE COBROS (AUDITORÍA CLIENTES MOROSOS)
  async populateKpiProgressModal() {
    const routeSelect = document.getElementById('modal-audit-route-filter');
    const dateInput = document.getElementById('modal-audit-date-filter');
    const clientsList = document.getElementById('modal-audit-clients-list');
    const ledgerContainer = document.getElementById('modal-audit-ledger-container');

    if (!routeSelect || !clientsList) return;

    if (ledgerContainer) ledgerContainer.style.display = 'none';

    // Establecer fecha por defecto (hoy)
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    routeSelect.innerHTML = `<option value="Todos">Todas las Rutas</option>`;
    const routes = await window.BulaPayDB.getRoutes();
    routes.forEach(r => {
      routeSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`;
    });

    await this.filterAuditClients();
  },

  // METRICAS DE AUDITORIA FINANCIERA (HISTORICO Y DIARIO)
  async calculateAuditMetrics(selectedRouteId, selectedDate) {
    const routes = await window.BulaPayDB.getRoutes();
    const payments = await window.BulaPayDB.getPayments();
    const clients = await window.BulaPayDB.getClients();

    const routeIds = selectedRouteId === 'Todos' 
      ? routes.map(r => r.id) 
      : [selectedRouteId];

    // Clientes que pertenecen a las rutas seleccionadas
    const routeClients = clients.filter(c => c.routeId && routeIds.includes(c.routeId));

    let capitalEsperado = 0;
    let totalRecaudado = 0;
    const unpaidClients = [];

    for (const client of routeClients) {
      // Calcular abonos hechos antes de la fecha seleccionada
      const clientPayments = payments.filter(p => p.clientCedula === client.cedula);
      const paymentsBefore = clientPayments.filter(p => p.date < selectedDate);
      const totalPaidBefore = paymentsBefore.reduce((sum, p) => sum + Number(p.amount), 0);

      // Si ya estaba saldado antes de la fecha seleccionada, no se esperaba cuota
      if (totalPaidBefore >= Number(client.totalDebt)) {
        continue;
      }

      const expectedAmount = Number(client.installmentAmount);
      capitalEsperado += expectedAmount;

      // Pagos realizados en la fecha seleccionada
      const paymentsOnDate = clientPayments.filter(p => p.date === selectedDate);
      const amountPaidOnDate = paymentsOnDate.reduce((sum, p) => sum + Number(p.amount), 0);
      totalRecaudado += amountPaidOnDate;

      // Si no pagó ese día o registró "No Pago"
      const hasNoPagoStatus = paymentsOnDate.some(p => p.status === 'No Pago');
      if (amountPaidOnDate === 0 || hasNoPagoStatus) {
        unpaidClients.push({
          ...client,
          dueToday: expectedAmount
        });
      }
    }

    const deficit = Math.max(0, capitalEsperado - totalRecaudado);

    return {
      capitalEsperado,
      totalRecaudado,
      deficit,
      unpaidClients
    };
  },

  async filterAuditClients() {
    const routeSelect = document.getElementById('modal-audit-route-filter');
    const dateInput = document.getElementById('modal-audit-date-filter');
    const clientsList = document.getElementById('modal-audit-clients-list');
    const ledgerContainer = document.getElementById('modal-audit-ledger-container');
    
    if (!routeSelect || !dateInput || !clientsList) return;

    const selectedRouteId = routeSelect.value;
    const selectedDate = dateInput.value || new Date().toISOString().split('T')[0];

    if (ledgerContainer) ledgerContainer.style.display = 'none';

    // Calcular métricas
    const metrics = await this.calculateAuditMetrics(selectedRouteId, selectedDate);
    const allUsers = await this.getCachedUsers();

    // Actualizar KPIs del modal
    const expectedEl = document.getElementById('modal-audit-kpi-expected');
    const collectedEl = document.getElementById('modal-audit-kpi-collected');
    const deficitEl = document.getElementById('modal-audit-kpi-deficit');

    if (expectedEl) expectedEl.textContent = `$${metrics.capitalEsperado.toLocaleString('es-CO')}`;
    if (collectedEl) collectedEl.textContent = `$${metrics.totalRecaudado.toLocaleString('es-CO')}`;
    if (deficitEl) deficitEl.textContent = `$${metrics.deficit.toLocaleString('es-CO')}`;

    clientsList.innerHTML = '';
    if (metrics.unpaidClients.length === 0) {
      clientsList.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem;">No hay registros de déficit para esta fecha.</div>`;
      return;
    }

    metrics.unpaidClients.forEach(client => {
      const associatedAgent = allUsers.find(u => u.username === client.agent_id);
      const agentNameLabel = associatedAgent ? associatedAgent.name : 'No asignado';

      const item = document.createElement('div');
      item.style.padding = '0.5rem 0.75rem';
      item.style.background = 'rgba(239, 68, 68, 0.02)';
      item.style.border = '1px solid rgba(239, 68, 68, 0.15)';
      item.style.borderRadius = '6px';
      item.style.cursor = 'pointer';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.fontSize = '0.8rem';
      item.style.transition = 'var(--transition-smooth)';

      item.innerHTML = `
        <div>
          <strong style="color: var(--color-rojo);">${client.name}</strong>
          <div style="font-size: 0.7rem; color: var(--text-secondary);">Deuda Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')} | Agente: ${agentNameLabel}</div>
        </div>
        <span style="font-size: 0.75rem; color: var(--color-rojo); font-weight: 600;">Cuota: $${Number(client.dueToday).toLocaleString('es-CO')}</span>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.borderColor = 'var(--color-rojo)';
        item.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = 'rgba(239, 68, 68, 0.15)';
        item.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
      });

      item.addEventListener('click', () => this.showAuditClientLedger(client.cedula));
      clientsList.appendChild(item);
    });
  },

  async showAuditClientLedger(cedula) {
    const ledgerContainer = document.getElementById('modal-audit-ledger-container');
    const nameEl = document.getElementById('modal-audit-client-name');
    const metaEl = document.getElementById('modal-audit-client-meta');
    const gridEl = document.getElementById('modal-audit-ledger-grid');

    if (!ledgerContainer || !gridEl) return;

    const client = await window.BulaPayDB.getClientByCedula(cedula);
    if (!client) return;

    const allUsers = await this.getCachedUsers();
    const associatedAgent = allUsers.find(u => u.username === client.agent_id);
    const agentNameLabel = associatedAgent ? associatedAgent.name : 'No asignado';

    nameEl.textContent = client.name;
    metaEl.textContent = `Cédula: ${client.cedula} | Agente: ${agentNameLabel} | Saldo Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')} / $${Number(client.totalDebt).toLocaleString('es-CO')}`;

    const payments = await window.BulaPayDB.getPaymentsByClient(cedula);

    gridEl.innerHTML = '';
    const totalSlots = client.installmentsCount;
    
    for (let i = 1; i <= totalSlots; i++) {
      const payment = payments.find(p => p.installmentNumber === i);
      const slotCard = document.createElement('div');
      slotCard.className = 'ledger-slot-card'; // Reusar clases
      slotCard.style.padding = '0.5rem';
      slotCard.style.fontSize = '0.7rem';
      slotCard.style.minHeight = '70px';

      if (payment) {
        const isAbonado = payment.status === 'Abonado';
        const isNoPago = payment.status === 'No Pago';
        
        if (isNoPago) {
          slotCard.classList.add('nopago');
          slotCard.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          slotCard.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        } else {
          slotCard.classList.add(isAbonado ? 'abonado' : 'paid');
        }
        
        slotCard.innerHTML = `
          <span class="slot-num" style="font-size: 0.55rem;">CUOTA ${i}</span>
          <span class="slot-amount" style="font-size: 0.75rem;">$${Number(payment.amount).toLocaleString('es-CO')}</span>
          <span class="slot-date" style="font-size: 0.5rem; display:block;">${payment.date}</span>
          <div class="slot-stamp" style="font-size: 0.75rem; bottom:2px; right:4px;">${isNoPago ? '🔴' : (isAbonado ? '🟡' : '🟢')}</div>
        `;
        slotCard.addEventListener('click', () => {
          window.showBulaPayReceipt(payment, client);
        });
      } else {
        slotCard.innerHTML = `
          <span class="slot-num" style="font-size: 0.55rem;">CUOTA ${i}</span>
          <span class="slot-amount" style="color: var(--text-muted); font-size: 0.7rem;">$${Number(client.installmentAmount).toLocaleString('es-CO')}</span>
          <span class="slot-empty-text" style="font-size: 0.55rem;">Atrasado</span>
        `;
        slotCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        slotCard.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
      }

      gridEl.appendChild(slotCard);
    }

    ledgerContainer.style.display = 'block';
  },

  // 5. INICIALIZAR FILTRO DE MAPA
  async initMapRouteFilter() {
    const filter = document.getElementById('map-route-filter');
    if (!filter) return;

    filter.innerHTML = `<option value="Todos">Todas las Rutas</option>`;
    const routes = await window.BulaPayDB.getRoutes();
    routes.forEach(r => {
      filter.innerHTML += `<option value="${r.id}">${r.name}</option>`;
    });
  },

  initGpsMap() {
    const mapContainer = document.getElementById('live-gps-map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (this.mapInstance) {
      try {
        this.mapInstance.remove();
      } catch (e) {
        console.warn("Error al remover instancia previa del mapa:", e);
      }
      this.mapInstance = null;
    }

    this.mapMarkers = {};

    // Centrado por defecto en La Guajira, Colombia
    this.mapInstance = L.map('live-gps-map').setView([11.5444, -72.9069], 9);

    // Tile server CartoDB Positron para una estética clara
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.mapInstance);

    setTimeout(() => {
      if (this.mapInstance) {
        this.mapInstance.invalidateSize();
      }
    }, 400);

    this.updateMapMarkers();
  },

  async updateMapMarkers() {
    if (!this.mapInstance) return;

    const filter = document.getElementById('map-route-filter');
    const selectedRouteId = filter ? filter.value : 'Todos';

    const routes = await window.BulaPayDB.getRoutes();
    const allUsers = await window.BulaPayDB.getUsers();

    let activeRoutes = routes;
    if (selectedRouteId !== 'Todos') {
      activeRoutes = routes.filter(r => r.id === selectedRouteId);
    }

    const activeRouteIds = new Set(activeRoutes.map(r => r.id));
    const agents = allUsers.filter(u => u.role === 'Agente de Ruta' && u.routeId && activeRouteIds.has(u.routeId));

    const markerGroup = [];

    // Limpiar marcadores antiguos que no correspondan
    const currentAgentUsernames = new Set(agents.map(a => a.username));
    for (const username in this.mapMarkers) {
      if (!currentAgentUsernames.has(username)) {
        this.mapInstance.removeLayer(this.mapMarkers[username]);
        delete this.mapMarkers[username];
      }
    }

    agents.forEach(agent => {
      if (!agent.last_lat || !agent.last_lng) return;

      const lat = Number(agent.last_lat);
      const lng = Number(agent.last_lng);
      
      const routeName = routes.find(r => r.id === agent.routeId)?.name || 'Ruta';
      const timeStr = agent.last_location_time 
        ? new Date(agent.last_location_time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        : 'N/A';

      const markerColor = this.getAgentColor(agent.username);
      const popupContent = `
        <div style="font-family: var(--font-sans); font-size: 0.8rem; color: #000; min-width: 150px;">
          <strong style="color: ${markerColor}; font-size: 0.85rem;">👤 ${agent.name}</strong><br>
          <span style="color: #4b5563; font-weight: 600;">Ruta: ${routeName}</span><br>
          <span style="color: #6b7280; font-size: 0.75rem;">Último reporte: ${timeStr}</span>
        </div>
      `;

      // Crear divIcon personalizado para soportar múltiples agentes visualmente con colores y nombres
      const customIcon = L.divIcon({
        className: 'custom-agent-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="background-color: ${markerColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; gap: 4px;">
              👤 ${agent.name}
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${markerColor}; margin-top: -1px;"></div>
          </div>
        `,
        iconSize: [120, 40],
        iconAnchor: [60, 40]
      });

      if (this.mapMarkers[agent.username]) {
        this.mapMarkers[agent.username].setLatLng([lat, lng]);
        this.mapMarkers[agent.username].setIcon(customIcon);
        this.mapMarkers[agent.username].getPopup().setContent(popupContent);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.mapInstance);
        marker.bindPopup(popupContent);
        this.mapMarkers[agent.username] = marker;
      }

      markerGroup.push([lat, lng]);
    });

    if (markerGroup.length > 0) {
      this.mapInstance.fitBounds(markerGroup, { padding: [50, 50], maxZoom: 14 });
    }

    // Actualizar dinámicamente el Panel Inferior de Agentes
    const panel = document.getElementById('supervisor-agents-panel');
    const list = document.getElementById('supervisor-agents-list');
    
    if (panel && list) {
      if (agents.length === 0) {
        panel.style.display = 'none';
        list.innerHTML = '';
      } else {
        panel.style.display = 'block';
        list.innerHTML = '';
        agents.forEach(agent => {
          const isOnline = agent.last_location_time && (new Date() - new Date(agent.last_location_time) < 3 * 60 * 1000);
          const statusText = isOnline ? '🟢 En línea' : '🔴 Desconectado';
          const statusColor = isOnline ? 'var(--color-verde)' : 'var(--color-rojo)';
          const statusBg = isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
          const agentColor = this.getAgentColor(agent.username);
          
          const cardHtml = `
            <div class="card" style="padding: 1rem; border: 1px solid var(--border-color); background-color: var(--bg-primary); border-radius: 10px; display: flex; flex-direction: column; gap: 0.5rem; border-left: 4px solid ${agentColor}; transition: transform 0.2s, box-shadow 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h5 style="margin: 0; font-size: 0.9rem; color: var(--text-primary); font-weight: 600;">${agent.name}</h5>
                <span style="font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 12px; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
                  ${statusText}
                </span>
              </div>
              <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary);">
                Ruta: ${routes.find(r => r.id === agent.routeId)?.name || 'Sin Ruta'}
              </p>
              <p style="margin: 0; font-size: 0.7rem; color: var(--text-muted);">
                Último reporte: ${agent.last_location_time ? new Date(agent.last_location_time).toLocaleTimeString('es-CO') : 'Nunca'}
              </p>
              <button type="button" class="btn btn-secondary" onclick="supervisorModule.centerMapOnAgent('${agent.username}', ${agent.last_lat}, ${agent.last_lng})" 
                      style="padding: 0.4rem; font-size: 0.75rem; margin-top: 0.5rem; width: 100%; border-color: rgba(255,255,255,0.1); cursor: pointer;" 
                      ${(!agent.last_lat || !agent.last_lng) ? 'disabled' : ''}>
                📍 Centrar Mapa
              </button>
            </div>
          `;
          list.innerHTML += cardHtml;
        });
      }
    }
  },

  centerMapOnRoute() {
    if (this.mapInstance) {
      this.mapInstance.invalidateSize();
    }
    this.updateMapMarkers();
  },

  getAgentColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e'];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  },

  centerMapOnAgent(username, lat, lng) {
    if (!this.mapInstance || !lat || !lng) return;
    this.mapInstance.setView([lat, lng], 15);
    
    if (this.mapMarkers[username]) {
      this.mapMarkers[username].openPopup();
    }
  },

  // 6. FEED EN VIVO REAL DE PAGOS
  async renderLiveFeed() {
    const feedContent = document.getElementById('live-feed-content');
    const feedTime = document.getElementById('live-feed-time');
    if (!feedContent) return;

    feedContent.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0];
    const payments = await window.BulaPayDB.getPayments();
    const clients = await window.BulaPayDB.getClients();
    const routes = await window.BulaPayDB.getRoutes();

    // Filtra los pagos de hoy
    const paymentsToday = payments
      .filter(p => p.date === todayStr)
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });

    if (paymentsToday.length === 0) {
      feedContent.innerHTML = `<div class="live-feed-log" style="color: var(--text-secondary); font-style: italic; text-align: center;">Sin actividad de cobros registrada hoy.</div>`;
      if (feedTime) feedTime.textContent = 'Actualizado hace un momento';
      return;
    }

    paymentsToday.forEach(p => {
      const client = clients.find(c => c.cedula === p.clientCedula);
      const clientName = client ? client.name : `Cliente (${p.clientCedula})`;
      
      const route = client && client.routeId ? routes.find(r => r.id === client.routeId) : null;
      const routeName = route ? route.name : 'Ruta Desconocida';

      const logEl = document.createElement('div');
      logEl.className = 'live-feed-log';
      
      if (p.status === 'No Pago') {
        logEl.textContent = `📍 Agente ${p.agentName} reportó NO PAGO del Cliente ${clientName} en la ruta ${routeName}.`;
        logEl.style.color = 'var(--color-rojo)';
      } else {
        logEl.textContent = `📍 Agente ${p.agentName} registró un recaudo de $${Number(p.amount).toLocaleString('es-CO')} para el Cliente ${clientName} en la ruta ${routeName}.`;
        logEl.style.color = p.status === 'Abonado' ? 'var(--color-amarillo)' : 'var(--accent)';
      }
      
      feedContent.appendChild(logEl);
    });

    feedContent.scrollTop = feedContent.scrollHeight;

    if (feedTime) {
      const now = new Date();
      feedTime.textContent = `Último evento: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }
  },

  startLiveFeedSimulation() {
    // Deprecated - reemplazado por renderLiveFeed()
  },

  // RENDERIZAR DASHBOARD KPIs Y TABLA
  async renderDashboard() {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Administrador', username: 'admin' };
    
    // Check if the user is a commerce role
    if (currentUser.role === 'Otros (Comercios, Compraventas, Mercados)') {
      if (this.welcomeMsg) {
        this.welcomeMsg.textContent = `Bienvenido, ${currentUser.name} | ${currentUser.company || 'Comercio'}`;
      }
      
      const btnSchedule = document.getElementById('btn-schedule-config');
      if (btnSchedule) btnSchedule.style.display = 'none';
      
      const stdDashboard = document.getElementById('supervisor-dashboard-standard');
      if (stdDashboard) stdDashboard.style.display = 'none';
      
      const commerceKpis = document.getElementById('commerce-kpis');
      if (commerceKpis) commerceKpis.style.display = 'grid';
      
      const commerceMainSection = document.getElementById('commerce-main-section');
      if (commerceMainSection) commerceMainSection.style.display = 'block';
      
      // Load commerce KPIs
      const clients = await window.BulaPayDB.getClients();
      // Total clients is simply clients.length
      const products = clients.filter(c => c.product_name);
      
      const kpiCommerceClients = document.getElementById('kpi-commerce-clients');
      if (kpiCommerceClients) kpiCommerceClients.textContent = clients.length;
      
      const kpiCommerceProducts = document.getElementById('kpi-commerce-products');
      if (kpiCommerceProducts) kpiCommerceProducts.textContent = products.length;
      
      return;
    } else {
      const btnSchedule = document.getElementById('btn-schedule-config');
      if (btnSchedule) btnSchedule.style.display = 'flex';
      
      const stdDashboard = document.getElementById('supervisor-dashboard-standard');
      if (stdDashboard) stdDashboard.style.display = 'block';
      
      const commerceKpis = document.getElementById('commerce-kpis');
      if (commerceKpis) commerceKpis.style.display = 'none';
      
      const commerceMainSection = document.getElementById('commerce-main-section');
      if (commerceMainSection) commerceMainSection.style.display = 'none';
    }

    if (this.welcomeMsg) {
      this.welcomeMsg.textContent = `Bienvenido, ${currentUser.name} | ${currentUser.company || 'BulaPay'}`;
    }

    const routes = await window.BulaPayDB.getRoutes();
    const allUsers = await window.BulaPayDB.getUsers();
    const agents = allUsers.filter(u => u.role === 'Agente de Ruta');

    // Calcular KPIs
    const totalAgentsCount = agents.length;
    const totalCapital = routes.reduce((acc, curr) => acc + Number(curr.capital), 0);
    const totalCollected = routes.reduce((acc, curr) => acc + Number(curr.collected), 0);
    
    // Calcular Progreso de Cobros con la nueva fórmula dinámica y en tiempo real
    const todayStr = new Date().toISOString().split('T')[0];
    const payments = await window.BulaPayDB.getPayments();
    const clients = await window.BulaPayDB.getClients();
    const routeIds = new Set(routes.map(r => r.id));

    const paymentsToday = payments.filter(p => p.date === todayStr);
    const totalCollectedToday = paymentsToday.reduce((sum, p) => sum + Number(p.amount), 0);

    const expectedClients = clients.filter(c => {
      if (!c.routeId || !routeIds.has(c.routeId)) return false;
      const hasPaymentToday = paymentsToday.some(p => p.clientCedula === c.cedula);
      return Number(c.outstanding) > 0 || hasPaymentToday;
    });
    const totalExpectedToday = expectedClients.reduce((sum, c) => sum + Number(c.installmentAmount), 0);

    let progressPercent = 0;
    if (totalExpectedToday > 0) {
      progressPercent = Math.round((totalCollectedToday / totalExpectedToday) * 100);
    }

    // Inyectar KPIs
    if (this.kpiActiveAgents) this.kpiActiveAgents.textContent = totalAgentsCount;
    if (this.kpiTotalCapital) this.kpiTotalCapital.textContent = `$${totalCapital.toLocaleString('es-CO')}`;
    if (this.kpiTotalCollected) this.kpiTotalCollected.textContent = `$${totalCollected.toLocaleString('es-CO')}`;
    
    if (this.kpiRouteProgress) this.kpiRouteProgress.textContent = `${progressPercent}%`;
    const mainProgressBar = document.getElementById('kpi-route-progress-bar');
    if (mainProgressBar) {
      mainProgressBar.style.width = `${Math.min(progressPercent, 100)}%`;
    }

    // Renderizar la tabla de progreso en vivo
    await this.renderRoutesTable(routes);
  },

  async renderRoutesTable(routes) {
    if (!this.routesTbody) return;
    this.routesTbody.innerHTML = '';

    if (routes.length === 0) {
      this.routesTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay rutas creadas en el sistema.</td></tr>`;
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const payments = await window.BulaPayDB.getPayments();
    const clients = await window.BulaPayDB.getClients();

    // Group routes by name
    const groupedRoutes = {};

    routes.forEach(route => {
      const name = route.name;
      if (!groupedRoutes[name]) {
        groupedRoutes[name] = {
          name: name,
          routeIds: [],
          agentNames: new Set(),
          capital: 0,
          status: route.status,
          openingTime: route.opening_time || '06:00'
        };
      }
      groupedRoutes[name].routeIds.push(route.id);
      if (route.agentName) {
        route.agentName.split(',').forEach(a => {
          const trimmed = a.trim();
          if (trimmed) groupedRoutes[name].agentNames.add(trimmed);
        });
      }
      groupedRoutes[name].capital += Number(route.capital);
      if (route.status === 'En Ruta') {
        groupedRoutes[name].status = 'En Ruta';
      } else if (route.status === 'Incidencia' && groupedRoutes[name].status !== 'En Ruta') {
        groupedRoutes[name].status = 'Incidencia';
      }
    });

    const paymentsToday = payments.filter(p => p.date === todayStr);

    for (const name in groupedRoutes) {
      const gRoute = groupedRoutes[name];
      const rIds = gRoute.routeIds;

      const routeClients = clients.filter(c => c.routeId && rIds.includes(c.routeId));
      const clientCedulas = new Set(routeClients.map(c => c.cedula));
      
      const routePaymentsToday = paymentsToday.filter(p => clientCedulas.has(p.clientCedula));
      const totalCollectedToday = routePaymentsToday.reduce((sum, p) => sum + Number(p.amount), 0);

      const expectedClients = routeClients.filter(c => {
        const hasPaymentToday = routePaymentsToday.some(p => p.clientCedula === c.cedula);
        return Number(c.outstanding) > 0 || hasPaymentToday;
      });
      const totalExpectedToday = expectedClients.reduce((sum, c) => sum + Number(c.installmentAmount), 0);

      let progress = 0;
      if (totalExpectedToday > 0) {
        progress = Math.round((totalCollectedToday / totalExpectedToday) * 100);
      }

      let statusClass = 'en-ruta';
      if (gRoute.status === 'Completado') statusClass = 'completado';
      if (gRoute.status === 'Incidencia') statusClass = 'incidencia';

      const agentsList = Array.from(gRoute.agentNames).join(', ') || 'Sin Agente';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: white;">${gRoute.name}</td>
        <td>👤 ${agentsList}</td>
        <td>$${Number(gRoute.capital).toLocaleString('es-CO')}</td>
        <td style="color: var(--accent); font-weight: 600;">$${totalCollectedToday.toLocaleString('es-CO')}</td>
        <td>
          <span class="status-badge ${statusClass}">${gRoute.status}</span>
        </td>
        <td class="operating-time-cell" data-opening-time="${gRoute.openingTime}" data-status="${gRoute.status}">
          <!-- Calculado dinámicamente -->
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.8rem; font-weight: 600; min-width: 30px;">${progress}%</span>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
            </div>
          </div>
        </td>
      `;
      this.routesTbody.appendChild(tr);
    }

    this.updateOperatingTimes();
  },

  updateOperatingTimes() {
    const cells = document.querySelectorAll('.operating-time-cell');
    if (cells.length === 0) return;

    const now = new Date();

    cells.forEach(cell => {
      const openingTimeStr = cell.getAttribute('data-opening-time') || '06:00';
      const [openHrs, openMins] = openingTimeStr.split(':').map(Number);
      
      const openingTime = new Date(now);
      openingTime.setHours(openHrs, openMins, 0, 0);

      let diffMs = now - openingTime;
      if (diffMs < 0) {
        diffMs = 0; // Si es antes de la hora de apertura, el tiempo transcurrido es 0
      }

      const diffMinutesTotal = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMinutesTotal / 60);
      const minutes = diffMinutesTotal % 60;
      const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} horas`;

      let bgColor = 'rgba(59, 130, 246, 0.15)';
      let textColor = '#60a5fa';
      let borderColor = 'rgba(59, 130, 246, 0.3)';

      if (hours >= 12) {
        bgColor = 'rgba(245, 158, 11, 0.15)';
        textColor = 'var(--color-amarillo)';
        borderColor = 'rgba(245, 158, 11, 0.3)';
      } else if (hours >= 2) {
        bgColor = 'rgba(16, 185, 129, 0.15)';
        textColor = 'var(--color-verde)';
        borderColor = 'rgba(16, 185, 129, 0.3)';
      }

      cell.innerHTML = `
        <span style="padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; background-color: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor}; display: inline-flex; align-items: center; gap: 0.25rem;">
          🕒 ${formattedTime}
        </span>
      `;
    });
  },

  async startMapSimulation() {
    if (this.mapAnimationInterval) {
      clearInterval(this.mapAnimationInterval);
    }

    const agent1 = document.getElementById('map-agent-1');
    const agent1Pulse = document.getElementById('map-agent-1-pulse');
    const agent2 = document.getElementById('map-agent-2');
    const agent2Pulse = document.getElementById('map-agent-2-pulse');
    const lbl1 = document.getElementById('map-lbl-agent-1');
    const lbl2 = document.getElementById('map-lbl-agent-2');

    // Obtener rutas activas
    const routes = await window.BulaPayDB.getRoutes();

    if (routes.length === 0) {
      if (agent1) agent1.style.display = 'none';
      if (agent1Pulse) agent1Pulse.style.display = 'none';
      if (lbl1) lbl1.style.display = 'none';
      if (agent2) agent2.style.display = 'none';
      if (agent2Pulse) agent2Pulse.style.display = 'none';
      if (lbl2) lbl2.style.display = 'none';
      return;
    }

    // Configurar agentes según las rutas reales
    if (agent1) agent1.style.display = 'block';
    if (agent1Pulse) agent1Pulse.style.display = 'block';
    if (lbl1) {
      lbl1.style.display = 'block';
      lbl1.textContent = `${routes[0].agentName.split(',')[0]} (En Ruta)`;
    }

    if (routes.length > 1) {
      if (agent2) agent2.style.display = 'block';
      if (agent2Pulse) agent2Pulse.style.display = 'block';
      if (lbl2) {
        lbl2.style.display = 'block';
        lbl2.textContent = `${routes[1].agentName.split(',')[0]} (En Ruta)`;
      }
    } else {
      if (agent2) agent2.style.display = 'none';
      if (agent2Pulse) agent2Pulse.style.display = 'none';
      if (lbl2) lbl2.style.display = 'none';
    }

    const path1 = [
      {cx: 150, cy: 70},
      {cx: 200, cy: 110},
      {cx: 250, cy: 180},
      {cx: 300, cy: 150},
      {cx: 350, cy: 110},
      {cx: 400, cy: 220}
    ];

    const path2 = [
      {cx: 200, cy: 240},
      {cx: 260, cy: 210},
      {cx: 320, cy: 190},
      {cx: 280, cy: 160},
      {cx: 180, cy: 200}
    ];

    let index1 = 0;
    let index2 = 0;
    let dir1 = 1;
    let dir2 = 1;

    this.mapAnimationInterval = setInterval(() => {
      // Agente 1
      if (agent1 && agent1Pulse && agent1.style.display !== 'none') {
        index1 += dir1;
        if (index1 >= path1.length || index1 < 0) {
          dir1 *= -1;
          index1 += dir1 * 2;
        }
        const pos1 = path1[index1];
        agent1.setAttribute('cx', pos1.cx);
        agent1.setAttribute('cy', pos1.cy);
        agent1Pulse.setAttribute('cx', pos1.cx);
        agent1Pulse.setAttribute('cy', pos1.cy);
        
        if (lbl1) {
          lbl1.setAttribute('x', pos1.cx + 15);
          lbl1.setAttribute('y', pos1.cy - 5);
        }
      }

      // Agente 2
      if (agent2 && agent2Pulse && agent2.style.display !== 'none') {
        index2 += dir2;
        if (index2 >= path2.length || index2 < 0) {
          dir2 *= -1;
          index2 += dir2 * 2;
        }
        const pos2 = path2[index2];
        agent2.setAttribute('cx', pos2.cx);
        agent2.setAttribute('cy', pos2.cy);
        agent2Pulse.setAttribute('cx', pos2.cx);
        agent2Pulse.setAttribute('cy', pos2.cy);

        if (lbl2) {
          lbl2.setAttribute('x', pos2.cx + 15);
          lbl2.setAttribute('y', pos2.cy - 5);
        }
      }
    }, 3000);
  },

  async renderManageRoutesList() {
    const listContainer = document.getElementById('manage-routes-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 2rem;">
        Cargando rutas...
      </div>
    `;

    try {
      const routes = await window.BulaPayDB.getRoutes();
      const allUsers = await window.BulaPayDB.getUsers();
      
      listContainer.innerHTML = '';
      if (routes.length === 0) {
        listContainer.innerHTML = `
          <div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 2rem; border: 1px dashed var(--border-color); border-radius: 8px;">
            No hay rutas registradas.
          </div>
        `;
        return;
      }

      routes.forEach(route => {
        // Encontrar agentes asociados
        const routeAgents = allUsers.filter(u => u.routeId === route.id && u.role === 'Agente de Ruta');
        const agentsText = routeAgents.length > 0 
          ? routeAgents.map(a => `${a.name} (${a.documentNumber || 'Sin Cédula'})`).join(', ') 
          : 'Sin agentes asignados';

        const card = document.createElement('div');
        card.style.background = 'rgba(255, 255, 255, 0.02)';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = '10px';
        card.style.padding = '1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.75rem';
        card.style.transition = 'var(--transition-smooth)';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 style="color: white; margin: 0; font-size: 1rem;">${route.name}</h4>
              <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">ID: ${route.id}</p>
            </div>
            <span style="font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 4px; background: rgba(0, 245, 212, 0.1); color: var(--accent); border: 1px solid rgba(0, 245, 212, 0.2);">${route.status || 'En Ruta'}</span>
          </div>
          
          <div style="font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.25rem;">
            <div>
              <span style="color: var(--text-secondary);">Capital Base:</span>
              <strong style="color: white;">$${Number(route.capital).toLocaleString('es-CO')}</strong>
            </div>
            <div>
              <span style="color: var(--text-secondary);">Agentes:</span>
              <span style="color: white;">${agentsText}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="supervisorModule.openEditRouteModal('${route.id}')" style="flex: 1; padding: 0.4rem; font-size: 0.75rem; border-color: rgba(0, 245, 212, 0.2); color: var(--accent);">👤 Editar Personal</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="supervisorModule.handleDeleteRoute('${route.id}', '${route.name}')" style="flex: 1; padding: 0.4rem; font-size: 0.75rem; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--color-rojo);">🗑️ Eliminar</button>
          </div>
        `;
        
        card.addEventListener('mouseenter', () => {
          card.style.borderColor = 'rgba(0, 245, 212, 0.3)';
          card.style.background = 'rgba(255, 255, 255, 0.03)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.borderColor = 'var(--border-color)';
          card.style.background = 'rgba(255, 255, 255, 0.02)';
        });

        listContainer.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      listContainer.innerHTML = `
        <div style="color: var(--color-rojo); text-align: center; font-size: 0.85rem; padding: 2rem;">
          ❌ Error al cargar las rutas.
        </div>
      `;
    }
  },

  async handleDeleteRoute(routeId, routeName) {
    if (!confirm(`¿Está seguro de que desea eliminar la ruta "${routeName}"?\nEsta acción también eliminará permanentemente todos los agentes de ruta asociados y desvinculará a los clientes de esta ruta.`)) {
      return;
    }

    try {
      await window.BulaPayDB.deleteRoute(routeId);
      alert(`✅ Ruta "${routeName}" eliminada con éxito.`);
      await this.renderDashboard();
      await this.renderManageRoutesList();
      await this.initMapRouteFilter();
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || err.details || JSON.stringify(err);
      alert(`❌ Error al eliminar la ruta de Supabase:\n${errorMsg}`);
    }
  },

  editingRouteId: null,

  async openEditRouteModal(routeId) {
    this.editingRouteId = routeId;
    const subtitle = document.getElementById('edit-route-modal-subtitle');
    const container = document.getElementById('edit-route-current-agents');
    
    if (!container) return;

    container.innerHTML = `
      <div style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem;">
        Cargando agentes...
      </div>
    `;

    try {
      const route = await window.BulaPayDB.getRouteById(routeId);
      if (!route) {
        alert('❌ No se encontró la ruta especificada.');
        this.closeEditRouteModal();
        return;
      }

      if (subtitle) {
        subtitle.textContent = `Gestión de agentes para la ruta: ${route.name}`;
      }

      const allUsers = await this.getCachedUsers();
      const routeAgents = allUsers.filter(u => u.routeId === routeId && u.role === 'Agente de Ruta');

      container.innerHTML = '';
      if (routeAgents.length === 0) {
        container.innerHTML = `
          <div style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem; border: 1px dashed var(--border-color); border-radius: 6px;">
            No hay agentes asignados a esta ruta.
          </div>
        `;
      } else {
        routeAgents.forEach(agent => {
          const item = document.createElement('div');
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.style.background = 'rgba(255, 255, 255, 0.02)';
          item.style.border = '1px solid var(--border-color)';
          item.style.borderRadius = '8px';
          item.style.padding = '0.5rem 0.75rem';

          item.innerHTML = `
            <div>
              <strong style="color: white; font-size: 0.85rem;">${agent.name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">Cédula: ${agent.documentNumber || 'Sin Cédula'} | Usuario: ${agent.username}</div>
            </div>
            <button type="button" onclick="supervisorModule.removeAgentFromRoute('${agent.username}', '${routeId}')" style="background: transparent; border: none; color: var(--color-rojo); cursor: pointer; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 0.25rem;">Desvincular</button>
          `;
          container.appendChild(item);
        });
      }

      document.getElementById('modal-edit-route-agents').classList.add('active');
    } catch (err) {
      console.error(err);
      alert('❌ Error al cargar el personal de la ruta.');
    }
  },

  closeEditRouteModal() {
    const modal = document.getElementById('modal-edit-route-agents');
    if (modal) {
      modal.classList.remove('active');
    }
    const form = document.getElementById('form-modal-add-agent');
    if (form) form.reset();
    this.editingRouteId = null;
  },

  async removeAgentFromRoute(username, routeId) {
    if (!confirm(`¿Está seguro de que desea desvincular y eliminar al agente "${username}" de esta ruta?`)) {
      return;
    }

    try {
      await window.BulaPayDB.deleteUser(username);
      
      // Sincronizar campos concatenados en la tabla routes
      const allUsers = await this.getCachedUsers(true); // Force refresh cache!
      const remainingAgents = allUsers.filter(u => u.routeId === routeId && u.role === 'Agente de Ruta');
      
      const usernames = remainingAgents.map(a => a.username).join(', ');
      const names = remainingAgents.map(a => a.name).join(', ');
      
      await window.BulaPayDB.updateRouteAgents(routeId, usernames, names);
      
      // Actualizar modal, listado de rutas y dashboard
      await this.openEditRouteModal(routeId);
      await this.renderManageRoutesList();
      await this.renderDashboard();
      await this.initMapRouteFilter();
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || err.details || JSON.stringify(err);
      alert(`❌ Error al desvincular el agente:\n${errorMsg}`);
    }
  },

  async handleAddAgentFromModal() {
    const routeId = this.editingRouteId;
    if (!routeId) return;

    const nameInput = document.getElementById('modal-new-agent-name');
    const cedulaInput = document.getElementById('modal-new-agent-cedula');
    const usernameInput = document.getElementById('modal-new-agent-username');
    const passwordInput = document.getElementById('modal-new-agent-password');

    if (!nameInput || !cedulaInput || !usernameInput || !passwordInput) return;

    const name = nameInput.value.trim();
    const cedula = cedulaInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    try {
      // Validar si el usuario ya existe
      const existingUser = await window.BulaPayDB.getUserByUsername(username);
      if (existingUser) {
        alert(`❌ El nombre de usuario "${username}" ya está registrado.`);
        return;
      }

      const supervisorUser = window.BulaPayDB.getCurrentUser() || { username: 'admin' };
      
      // Guardar agente
      const newAgent = {
        username: username,
        password: password,
        name: name,
        role: 'Agente de Ruta',
        supervisor: supervisorUser.username,
        routeId: routeId,
        documentType: 'CC',
        documentNumber: cedula
      };

      await window.BulaPayDB.saveUser(newAgent);

      // Sincronizar campos concatenados en la tabla routes
      const allUsers = await this.getCachedUsers(true); // Force refresh cache!
      const allRouteAgents = allUsers.filter(u => u.routeId === routeId && u.role === 'Agente de Ruta');
      
      const usernames = allRouteAgents.map(a => a.username).join(', ');
      const names = allRouteAgents.map(a => a.name).join(', ');

      await window.BulaPayDB.updateRouteAgents(routeId, usernames, names);

      alert(`✅ Agente "${name}" registrado y asignado con éxito.`);
      
      // Limpiar formulario del modal
      document.getElementById('form-modal-add-agent').reset();

      // Recargar modal, listado de rutas y dashboard
      await this.openEditRouteModal(routeId);
      await this.renderManageRoutesList();
      await this.renderDashboard();
      await this.initMapRouteFilter();
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || err.details || JSON.stringify(err);
      alert(`❌ Error al agregar y asignar el agente:\n${errorMsg}`);
    }
  },

  async openScheduleModal() {
    const modal = document.getElementById('modal-route-schedule');
    if (!modal) return;
    
    modal.classList.add('active');
    
    try {
      const routes = await window.BulaPayDB.getRoutes();
      
      let openingTime = '06:00';
      let closingTime = '18:00';
      if (routes && routes.length > 0) {
        if (routes[0].opening_time) openingTime = routes[0].opening_time;
        if (routes[0].closing_time) closingTime = routes[0].closing_time;
      }
      
      document.getElementById('schedule-opening-time').value = openingTime;
      document.getElementById('schedule-closing-time').value = closingTime;
      
      this.renderScheduleExtensions(routes);
    } catch (err) {
      console.error("Error al abrir modal de horario:", err);
    }
  },
  
  closeScheduleModal() {
    const modal = document.getElementById('modal-route-schedule');
    if (modal) modal.classList.remove('active');
  },
  
  renderScheduleExtensions(routes) {
    const listContainer = document.getElementById('schedule-extensions-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    if (!routes || routes.length === 0) {
      listContainer.innerHTML = `
        <div style="color: var(--text-secondary); text-align: center; font-size: 0.8rem; padding: 1rem;">
          No hay rutas activas para habilitar prórrogas.
        </div>
      `;
      return;
    }
    
    routes.forEach(route => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.background = 'rgba(255, 255, 255, 0.02)';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '8px';
      item.style.padding = '0.75rem';
      
      const hasExtension = !!route.has_extension;
      
      item.innerHTML = `
        <div>
          <h5 style="margin: 0; color: white; font-size: 0.85rem;">Ruta: ${route.name}</h5>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Agente: ${route.agentName || 'Sin asignar'}</span>
        </div>
        <button class="btn ${hasExtension ? 'btn-accent' : 'btn-secondary'}" 
                onclick="supervisorModule.toggleExtension('${route.id}', ${hasExtension})" 
                style="width: auto; padding: 0.35rem 0.75rem; font-size: 0.75rem; border-color: ${hasExtension ? 'rgba(0, 245, 212, 0.3)' : 'rgba(255,255,255,0.1)'}; color: ${hasExtension ? 'var(--accent)' : 'var(--text-secondary)'};">
          ${hasExtension ? '🔴 Deshabilitar' : '🟢 Prórroga'}
        </button>
      `;
      listContainer.appendChild(item);
    });
  },
  
  async saveRouteSchedule(event) {
    event.preventDefault();
    const openingTime = document.getElementById('schedule-opening-time').value;
    const closingTime = document.getElementById('schedule-closing-time').value;
    
    try {
      await window.BulaPayDB.updateRoutesSchedule(openingTime, closingTime);
      alert("✅ Horario de rutas actualizado con éxito.");
      
      // Forzar actualización inmediata del reloj si el agente comparte sesión
      if (window.app && typeof window.app.updateClockAndTime === 'function') {
        await window.app.updateClockAndTime();
      }
      
      this.closeScheduleModal();
    } catch (err) {
      console.error("Error al guardar horario:", err);
      alert("❌ Error al guardar el horario.");
    }
  },
  
  async toggleExtension(routeId, currentStatus) {
    try {
      await window.BulaPayDB.toggleRouteExtension(routeId, !currentStatus);
      
      // Recargar lista del modal
      const routes = await window.BulaPayDB.getRoutes();
      this.renderScheduleExtensions(routes);
      
      // Forzar actualización inmediata del reloj si el agente comparte sesión
      if (window.app && typeof window.app.updateClockAndTime === 'function') {
        await window.app.updateClockAndTime();
      }
    } catch (err) {
      console.error("Error al cambiar prórroga:", err);
      alert("❌ Error al actualizar la prórroga.");
    }
  },

  switchCommerceTab(tab) {
    const btnSale = document.getElementById('btn-commerce-tab-sale');
    const btnPayment = document.getElementById('btn-commerce-tab-payment');
    const panelSale = document.getElementById('commerce-tab-sale');
    const panelPayment = document.getElementById('commerce-tab-payment');
    
    if (tab === 'sale') {
      btnSale.classList.add('active');
      btnSale.style.backgroundColor = 'var(--bg-primary)';
      btnSale.style.color = 'var(--accent)';
      
      btnPayment.classList.remove('active');
      btnPayment.style.backgroundColor = 'transparent';
      btnPayment.style.color = 'var(--text-secondary)';
      
      panelSale.style.display = 'block';
      panelPayment.style.display = 'none';
    } else {
      btnPayment.classList.add('active');
      btnPayment.style.backgroundColor = 'var(--bg-primary)';
      btnPayment.style.color = 'var(--accent)';
      
      btnSale.classList.remove('active');
      btnSale.style.backgroundColor = 'transparent';
      btnSale.style.color = 'var(--text-secondary)';
      
      panelSale.style.display = 'none';
      panelPayment.style.display = 'block';
    }
  },

  handleCategoryChange() {
    const category = document.getElementById('sale-product-category').value;
    const otherWrapper = document.getElementById('sale-product-category-other-wrapper');
    const otherInput = document.getElementById('sale-product-category-other');
    if (category === 'Otros') {
      otherWrapper.style.display = 'block';
      otherInput.setAttribute('required', '');
    } else {
      otherWrapper.style.display = 'none';
      otherInput.removeAttribute('required');
    }
  },

  formatPriceInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value) {
      value = Number(value).toLocaleString('es-CO');
    }
    input.value = value;
  },

  async registerCommerceSale(event) {
    event.preventDefault();
    
    const productName = document.getElementById('sale-product-name').value.trim();
    const categorySelect = document.getElementById('sale-product-category').value;
    const categoryOther = document.getElementById('sale-product-category-other').value.trim();
    const category = categorySelect === 'Otros' ? categoryOther : categorySelect;
    
    const priceRaw = document.getElementById('sale-product-price').value.replace(/\./g, '');
    const price = parseFloat(priceRaw) || 0;
    
    const installments = parseInt(document.getElementById('sale-installments').value);
    const periodicity = document.getElementById('sale-periodicity').value;
    
    const name = document.getElementById('sale-client-name').value.trim();
    const cedula = document.getElementById('sale-client-cedula').value.trim();
    const email = document.getElementById('sale-client-email').value.trim();
    const phone = document.getElementById('sale-client-phone').value.trim();
    
    const currentUser = window.BulaPayDB.getCurrentUser();
    const supervisor_id = currentUser ? currentUser.username : 'admin';
    
    const newClient = {
      cedula: String(cedula),
      name,
      phone,
      email,
      city: 'Comercio',
      zone: periodicity,
      risk: 'Verde',
      totalDebt: price,
      outstanding: price,
      installmentsCount: installments,
      installmentAmount: Math.round(price / installments),
      routeId: null,
      agent_id: null,
      supervisor_id: supervisor_id,
      product_name: productName,
      product_category: category
    };
    
    try {
      const existing = await window.BulaPayDB.getClientByCedula(cedula);
      if (existing) {
        alert('❌ Ya existe un cliente registrado con esta Cédula.');
        return;
      }
      
      await window.BulaPayDB.saveClient(newClient);
      
      const cardLink = `${window.location.origin}${window.location.pathname}?view=customer&id=${cedula}`;
      
      // Llamada comentada/vacía para futura integración
      this.sendDigitalCardEmail(email, cardLink);
      
      alert('🎉 Venta registrada con éxito y Cartón Digital generado!');
      document.getElementById('form-commerce-sale').reset();
      const otherWrapper = document.getElementById('sale-product-category-other-wrapper');
      if (otherWrapper) otherWrapper.style.display = 'none';
      
      await this.renderDashboard();
    } catch (err) {
      console.error(err);
      alert('❌ Error al registrar la venta.');
    }
  },
  
  sendDigitalCardEmail(clientEmail, cardLink) {
    // Función vacía para futura integración de correos de cartón digital
    // console.log(`[Email Integration] Enviando cartón digital a ${clientEmail}: ${cardLink}`);
  },

  async searchCommerceClientPayment() {
    const cedula = document.getElementById('commerce-search-cedula').value.trim();
    if (!cedula) {
      alert('⚠️ Ingrese una cédula.');
      return;
    }
    
    try {
      const client = await window.BulaPayDB.getClientByCedula(cedula);
      const resultsDiv = document.getElementById('commerce-payment-results');
      const placeholderDiv = document.getElementById('commerce-payment-placeholder');
      
      if (!client) {
        alert('❌ Comprador no encontrado.');
        if (resultsDiv) resultsDiv.style.display = 'none';
        if (placeholderDiv) placeholderDiv.style.display = 'block';
        return;
      }
      
      if (placeholderDiv) placeholderDiv.style.display = 'none';
      if (resultsDiv) {
        resultsDiv.style.display = 'block';
        await this.renderCommerceLedgerGrid(client, resultsDiv);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error al buscar comprador.');
    }
  },

  async renderCommerceLedgerGrid(client, container) {
    container.innerHTML = `
      <div style="background-color: var(--bg-secondary); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.8rem; border: 1px solid var(--border-color);">
        <div><strong>Comprador:</strong> ${client.name}</div>
        <div><strong>Producto:</strong> ${client.product_name || 'N/A'}</div>
        <div><strong>Saldo Pendiente:</strong> $${Number(client.outstanding).toLocaleString('es-CO')}</div>
        <div><strong>Cuota Regular:</strong> $${Number(client.installmentAmount).toLocaleString('es-CO')}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;" id="commerce-ledger-cells">
      </div>
    `;
    
    const cellsGrid = document.getElementById('commerce-ledger-cells');
    const totalInstallments = client.installmentsCount || 5;
    const installmentAmount = client.installmentAmount || 100000;
    
    const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
    const paidInstallments = payments
      .filter(p => p.status === 'Pagado' || p.status === 'Abonado' || Number(p.amount) > 0)
      .map(p => p.installmentNumber);
      
    for (let i = 1; i <= totalInstallments; i++) {
      const cell = document.createElement('div');
      cell.classList.add('payment-card-cell');
      
      const isPaid = paidInstallments.includes(i);
      
      if (isPaid) {
        cell.classList.add('pagado');
        cell.style.backgroundColor = 'var(--color-verde)';
        cell.style.color = 'var(--bg-primary)';
        cell.style.padding = '0.5rem';
        cell.style.borderRadius = '6px';
        cell.style.fontSize = '0.75rem';
        cell.style.textAlign = 'center';
        cell.innerHTML = `Cuota ${i}<br>✔`;
      } else {
        cell.classList.add('pendiente');
        cell.style.backgroundColor = 'var(--bg-secondary)';
        cell.style.border = '1px solid var(--border-color)';
        cell.style.padding = '0.5rem';
        cell.style.borderRadius = '6px';
        cell.style.fontSize = '0.75rem';
        cell.style.textAlign = 'center';
        cell.style.cursor = 'pointer';
        cell.innerHTML = `Cuota ${i}<br>$${Number(installmentAmount).toLocaleString('es-CO')}`;
        
        cell.addEventListener('click', async () => {
          if (confirm(`¿Marcar cuota ${i} como PAGADA por $${Number(installmentAmount).toLocaleString('es-CO')}?`)) {
            await this.payCommerceInstallment(client, i, installmentAmount);
            await this.renderCommerceLedgerGrid(client, container);
          }
        });
      }
      cellsGrid.appendChild(cell);
    }
  },
  
  async payCommerceInstallment(client, installmentNumber, amount) {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Comercio' };
    
    try {
      const newPayment = {
        clientCedula: client.cedula,
        installmentNumber: installmentNumber,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        agentName: currentUser.name,
        status: 'Pagado'
      };
      
      await window.BulaPayDB.addPayment(newPayment);
      
      this.sendPaymentReceiptEmail(client.email, {
        clientName: client.name,
        productName: client.product_name,
        installmentNumber: installmentNumber,
        amount: amount
      });
      
      alert(`✅ Pago de la cuota ${installmentNumber} registrado con éxito.`);
      client.outstanding = Math.max(0, Number(client.outstanding) - Number(amount));
      
      await this.renderDashboard();
    } catch (err) {
      console.error(err);
      alert('❌ Error al registrar el pago.');
    }
  },
  
  sendPaymentReceiptEmail(clientEmail, paymentDetails) {
    // Función vacía para futura integración de correos de recibo de pago
    // console.log(`[Email Integration] Enviando recibo a ${clientEmail}:`, paymentDetails);
  },

  async openCommerceModal(type) {
    const modal = document.getElementById('modal-commerce-details');
    const title = document.getElementById('commerce-modal-title');
    const content = document.getElementById('commerce-modal-content');
    
    if (!modal || !title || !content) return;
    
    try {
      const clients = await window.BulaPayDB.getClients();
      
      if (type === 'clients') {
        title.textContent = '👥 Listado de Clientes';
        
        if (clients.length === 0) {
          content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No hay clientes registrados.</p>';
        } else {
          let html = `
            <div style="display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; align-items: start;">
              <!-- Columna izquierda: Lista -->
              <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem;">
          `;
          
          clients.forEach(c => {
            html += `
              <div class="card kpi-card-clickable" onclick="supervisorModule.showCommerceClientDetails('${c.cedula}')" style="padding: 0.75rem; border: 1px solid var(--border-color); background-color: var(--bg-secondary); border-radius: 8px; cursor: pointer;">
                <div style="font-weight: 700; color: var(--accent); font-size: 0.85rem;">${c.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Cédula: ${c.cedula}</div>
              </div>
            `;
          });
          
          html += `
              </div>
              <!-- Columna derecha: Detalles Cartón -->
              <div id="commerce-modal-client-details" style="border-left: 1px solid var(--border-color); padding-left: 1.5rem; min-height: 250px;">
                <p style="color: var(--text-muted); text-align: center; padding-top: 4rem;">Seleccione un cliente para ver su Cartón Digital.</p>
              </div>
            </div>
          `;
          
          content.innerHTML = html;
        }
      } else if (type === 'products') {
        title.textContent = '📦 Productos Financiados';
        const products = clients.filter(c => c.product_name);
        
        if (products.length === 0) {
          content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No hay productos financiados actualmente.</p>';
        } else {
          const productsWithPayments = [];
          for (const p of products) {
            const payments = await window.BulaPayDB.getPaymentsByClient(p.cedula);
            const paidCount = payments.filter(pay => pay.status === 'Pagado').length;
            const remaining = Math.max(0, p.installmentsCount - paidCount);
            productsWithPayments.push({ ...p, remaining });
          }

          let html = `
            <div class="table-wrapper">
              <table class="route-table" style="width: 100%;">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Valor</th>
                    <th>Cliente</th>
                    <th>Cuotas Faltantes</th>
                  </tr>
                </thead>
                <tbody>
          `;
          
          productsWithPayments.forEach(p => {
            html += `
              <tr>
                <td style="font-weight: bold; color: var(--accent);">${p.product_name}</td>
                <td>${p.product_category || 'Otros'}</td>
                <td>$${Number(p.totalDebt).toLocaleString('es-CO')}</td>
                <td>${p.name}</td>
                <td style="font-weight: bold; text-align: center;">${p.remaining} / ${p.installmentsCount}</td>
              </tr>
            `;
          });
          
          html += `
                </tbody>
              </table>
            </div>
          `;
          content.innerHTML = html;
        }
      }
      
      modal.style.display = 'flex';
    } catch (e) {
      console.error(e);
      alert('❌ Error al cargar métricas.');
    }
  },
  
  closeCommerceModal() {
    const modal = document.getElementById('modal-commerce-details');
    if (modal) modal.style.display = 'none';
  },
  
  async showCommerceClientDetails(cedula) {
    const clientDetailsDiv = document.getElementById('commerce-modal-client-details');
    if (!clientDetailsDiv) return;
    
    try {
      const client = await window.BulaPayDB.getClientByCedula(cedula);
      if (!client) return;
      
      clientDetailsDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="color: var(--text-primary); margin: 0; font-size: 1.1rem; font-weight: 700;">${client.name}</h4>
          <span class="read-only-badge" style="background-color: rgba(16, 185, 129, 0.1); color: var(--color-verde); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.7rem; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 600;">
            Cartón Digital
          </span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Cédula: ${client.cedula} | Producto: ${client.product_name || 'N/A'} | Saldo Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')}
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.5rem;" id="modal-commerce-ledger-grid">
        </div>
      `;
      
      const grid = document.getElementById('modal-commerce-ledger-grid');
      const totalInstallments = client.installmentsCount || 5;
      const installmentAmount = client.installmentAmount || 100000;
      
      const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
      const paidInstallments = payments
        .filter(p => p.status === 'Pagado' || p.status === 'Abonado' || Number(p.amount) > 0)
        .map(p => p.installmentNumber);
        
      for (let i = 1; i <= totalInstallments; i++) {
        const cell = document.createElement('div');
        cell.classList.add('payment-card-cell');
        
        const isPaid = paidInstallments.includes(i);
        
        if (isPaid) {
          cell.classList.add('pagado');
          cell.style.backgroundColor = 'var(--color-verde)';
          cell.style.color = 'var(--bg-primary)';
          cell.style.padding = '0.5rem';
          cell.style.borderRadius = '6px';
          cell.style.fontSize = '0.75rem';
          cell.style.textAlign = 'center';
          cell.innerHTML = `Cuota ${i}<br>✔`;
        } else {
          cell.classList.add('pendiente');
          cell.style.backgroundColor = 'var(--bg-secondary)';
          cell.style.border = '1px solid var(--border-color)';
          cell.style.padding = '0.5rem';
          cell.style.borderRadius = '6px';
          cell.style.fontSize = '0.75rem';
          cell.style.textAlign = 'center';
          cell.innerHTML = `Cuota ${i}<br>$${Number(installmentAmount).toLocaleString('es-CO')}`;
        }
        grid.appendChild(cell);
      }
    } catch (e) {
      console.error(e);
      clientDetailsDiv.innerHTML = '<p style="color: var(--color-rojo);">Error al cargar el cartón digital.</p>';
    }
  },

  destroy() {
    if (this.mapAnimationInterval) {
      clearInterval(this.mapAnimationInterval);
    }
    if (this.liveFeedInterval) {
      clearInterval(this.liveFeedInterval);
    }
    if (this.mapUpdateInterval) {
      clearInterval(this.mapUpdateInterval);
      this.mapUpdateInterval = null;
    }
    if (this.operatingTimeInterval) {
      clearInterval(this.operatingTimeInterval);
      this.operatingTimeInterval = null;
    }
    if (this.handlePaymentRegistered) {
      window.removeEventListener('bulapay-payment-registered', this.handlePaymentRegistered);
      this.handlePaymentRegistered = null;
    }
    if (this.mapInstance) {
      try {
        this.mapInstance.remove();
      } catch (e) {
        console.warn("Error removing map instance on destroy:", e);
      }
      this.mapInstance = null;
    }
  }
};

window.supervisorModule = supervisorModule;
