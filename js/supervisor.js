// Módulo del Supervisor (Dashboard y Gestión de Rutas Interactivo)

const supervisorModule = {
  mapAnimationInterval: null,
  liveFeedInterval: null,
  activeKpiModal: null,
  handlePaymentRegistered: null,

  async init() {
    this.formCreateRoute = document.getElementById('form-create-route');
    this.routesTbody = document.getElementById('routes-tbody');
    this.welcomeMsg = document.getElementById('supervisor-welcome-msg');
    
    // KPIs
    this.kpiActiveAgents = document.getElementById('kpi-active-agents');
    this.kpiTotalCapital = document.getElementById('kpi-total-capital');
    this.kpiTotalCollected = document.getElementById('kpi-total-collected');
    this.kpiRouteProgress = document.getElementById('kpi-route-progress');

    this.bindEvents();
    await this.renderDashboard();
    this.startMapSimulation();
    await this.initMapRouteFilter();
    this.startLiveFeedSimulation();
    this.calculateRouteSuggestedQuota(); // Calcular inicial
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
    };
    window.addEventListener('bulapay-payment-registered', this.handlePaymentRegistered);
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
    const allUsers = await window.BulaPayDB.getUsers();
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

    const allUsers = await window.BulaPayDB.getUsers();
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
      const allUsers = await window.BulaPayDB.getUsers();
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
            <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem; padding-left: 1.7rem;">Deuda: $${Number(client.outstanding).toLocaleString('es-CO')}</div>
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

      nameEl.textContent = client.name;
      metaEl.textContent = `Cédula: ${client.cedula} | Saldo Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')} / $${Number(client.totalDebt).toLocaleString('es-CO')}`;

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
          <div style="font-size: 0.7rem; color: var(--text-secondary);">Deuda Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')}</div>
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

    nameEl.textContent = client.name;
    metaEl.textContent = `Cédula: ${client.cedula} | Saldo Pendiente: $${Number(client.outstanding).toLocaleString('es-CO')} / $${Number(client.totalDebt).toLocaleString('es-CO')}`;

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

  // ZOOM Y CENTRADO DE MAPA SIMULADO
  centerMapOnRoute() {
    const filter = document.getElementById('map-route-filter');
    const transformGroup = document.getElementById('map-transform-group');
    if (!filter || !transformGroup) return;

    const value = filter.value;

    if (value === 'Todos') {
      // Restablecer zoom completo
      transformGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
      return;
    }

    // Coordenadas de los agentes para el centrado
    let targetX = 200;
    let targetY = 140;
    let scale = 1.8;

    if (value === 'route_1' || value.includes('1')) {
      targetX = 150;
      targetY = 70;
    } else if (value === 'route_2' || value.includes('2')) {
      targetX = 200;
      targetY = 240;
    } else {
      targetX = 250;
      targetY = 150;
      scale = 1.5;
    }

    const transX = 200 - targetX * scale;
    const transY = 140 - targetY * scale;

    transformGroup.setAttribute('transform', `translate(${transX}, ${transY}) scale(${scale})`);
  },

  // 6. FEED EN VIVO DE SIMULACIÓN
  async startLiveFeedSimulation() {
    const feedContent = document.getElementById('live-feed-content');
    const feedTime = document.getElementById('live-feed-time');
    if (!feedContent) return;

    feedContent.innerHTML = '';
    
    if (this.liveFeedInterval) {
      clearInterval(this.liveFeedInterval);
    }

    const routes = await window.BulaPayDB.getRoutes();

    if (routes.length === 0) {
      const logEl = document.createElement('div');
      logEl.className = 'live-feed-log';
      logEl.textContent = '📍 Central de monitoreo activa. Registre una ruta para iniciar el seguimiento en vivo.';
      feedContent.appendChild(logEl);
      if (feedTime) {
        feedTime.textContent = 'Sin eventos activos';
      }
      return;
    }

    // Logs iniciales con agentes reales
    const firstAgent = routes[0].agentName.split(',')[0];
    const log1 = document.createElement('div');
    log1.className = 'live-feed-log';
    log1.textContent = `📍 Central de monitoreo activa. Conexión establecida con las rutas de cobro.`;
    feedContent.appendChild(log1);

    const log2 = document.createElement('div');
    log2.className = 'live-feed-log';
    log2.textContent = `📍 Agente ${firstAgent} inició el recorrido de la ruta: ${routes[0].name}.`;
    feedContent.appendChild(log2);

    if (routes.length > 1) {
      const secondAgent = routes[1].agentName.split(',')[0];
      const log3 = document.createElement('div');
      log3.className = 'live-feed-log';
      log3.textContent = `📍 Agente ${secondAgent} reportó inicio de actividades en ${routes[1].name}.`;
      feedContent.appendChild(log3);
    }

    if (feedTime) {
      feedTime.textContent = 'Actualizado hace unos segundos';
    }

    const logTemplates = [
      'Agente {agent} registró un recaudo de ${amount} para el Cliente {client}.',
      'Agente {agent} reportó retraso del Cliente {client} (Riesgo Amarillo).',
      'Agente {agent} completó la cobranza en el sector {sector}.',
      'Agente {agent} generó un recibo digital (Sello {signature}).',
      'Sistema BulaPay actualizó el estado de la ruta {route}.'
    ];

    this.liveFeedInterval = setInterval(async () => {
      try {
        const currentRoutes = await window.BulaPayDB.getRoutes();
        const currentClients = await window.BulaPayDB.getClients();
        
        if (currentRoutes.length === 0 || currentClients.length === 0) return;

        const randomRoute = currentRoutes[Math.floor(Math.random() * currentRoutes.length)];
        const routeClients = currentClients.filter(c => c.routeId === randomRoute.id);
        if (routeClients.length === 0) return;

        const randomClient = routeClients[Math.floor(Math.random() * routeClients.length)];
        const agentName = randomRoute.agentName.split(',')[0]; 

        // Generar datos aleatorios
        const amount = (Math.floor(Math.random() * 5) + 1) * 20000;
        const sectors = ['Norte', 'Centro', 'Sur', 'Zona Comercial', 'Occidente'];
        const sector = sectors[Math.floor(Math.random() * sectors.length)];
        const signature = 'BulaPay-SIG-' + Math.floor(Math.random() * 90000 + 10000);

        // Elegir plantilla aleatoria
        let logText = logTemplates[Math.floor(Math.random() * logTemplates.length)];
        logText = logText
          .replace('{agent}', agentName)
          .replace('{client}', randomClient.name)
          .replace('{amount}', amount.toLocaleString('es-CO'))
          .replace('{sector}', sector)
          .replace('{signature}', signature)
          .replace('{route}', randomRoute.name);

        const logEl = document.createElement('div');
        logEl.className = 'live-feed-log';
        logEl.textContent = '📍 ' + logText;
        
        feedContent.appendChild(logEl);
        feedContent.scrollTop = feedContent.scrollHeight;

        if (feedContent.children.length > 8) {
          feedContent.removeChild(feedContent.firstChild);
        }

        if (feedTime) {
          const now = new Date();
          feedTime.textContent = `Último evento: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        }
      } catch (err) {
        console.warn("Fallo en la simulación de logs dinámicos:", err);
      }
    }, 6000);
  },

  // RENDERIZAR DASHBOARD KPIs Y TABLA
  async renderDashboard() {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Administrador Demo', username: 'admin' };
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
    this.renderRoutesTable(routes);
  },

  renderRoutesTable(routes) {
    if (!this.routesTbody) return;
    this.routesTbody.innerHTML = '';

    if (routes.length === 0) {
      this.routesTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay rutas creadas en el sistema.</td></tr>`;
      return;
    }

    routes.forEach(route => {
      const progress = Number(route.capital) > 0 ? Math.round((Number(route.collected) / Number(route.capital)) * 100) : 0;
      
      let statusClass = 'en-ruta';
      if (route.status === 'Completado') statusClass = 'completado';
      if (route.status === 'Incidencia') statusClass = 'incidencia';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: white;">${route.name}</td>
        <td>👤 ${route.agentName}</td>
        <td>$${Number(route.capital).toLocaleString('es-CO')}</td>
        <td style="color: var(--accent); font-weight: 600;">$${Number(route.collected).toLocaleString('es-CO')}</td>
        <td>
          <span class="status-badge ${statusClass}">${route.status}</span>
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

      const allUsers = await window.BulaPayDB.getUsers();
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
      const allUsers = await window.BulaPayDB.getUsers();
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
      const allUsers = await window.BulaPayDB.getUsers();
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

  destroy() {
    if (this.mapAnimationInterval) {
      clearInterval(this.mapAnimationInterval);
    }
    if (this.liveFeedInterval) {
      clearInterval(this.liveFeedInterval);
    }
    if (this.handlePaymentRegistered) {
      window.removeEventListener('bulapay-payment-registered', this.handlePaymentRegistered);
      this.handlePaymentRegistered = null;
    }
  }
};

window.supervisorModule = supervisorModule;
