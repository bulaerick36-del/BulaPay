// Módulo del Supervisor (Dashboard y Gestión de Rutas Interactivo)

const supervisorModule = {
  mapAnimationInterval: null,
  liveFeedInterval: null,
  activeKpiModal: null,

  init() {
    this.formCreateRoute = document.getElementById('form-create-route');
    this.routesTbody = document.getElementById('routes-tbody');
    this.welcomeMsg = document.getElementById('supervisor-welcome-msg');
    
    // KPIs
    this.kpiActiveAgents = document.getElementById('kpi-active-agents');
    this.kpiTotalCapital = document.getElementById('kpi-total-capital');
    this.kpiTotalCollected = document.getElementById('kpi-total-collected');
    this.kpiRouteProgress = document.getElementById('kpi-route-progress');

    this.bindEvents();
    this.renderDashboard();
    this.startMapSimulation();
    this.initMapRouteFilter();
    this.startLiveFeedSimulation();
    this.calculateRouteSuggestedQuota(); // Calcular inicial
  },

  bindEvents() {
    // Crear Nueva Ruta y Credenciales de Agente (Múltiples)
    if (this.formCreateRoute) {
      this.formCreateRoute.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const routeName = document.getElementById('route-name').value.trim();
        const capitalBase = parseFloat(document.getElementById('route-capital').value) || 0;
        
        // Obtener todos los agentes definidos en el formulario
        const agentGroups = document.querySelectorAll('#route-agents-list .agent-fields-group');
        const agentsData = [];
        let validationFailed = false;

        agentGroups.forEach((group, index) => {
          const nameInput = group.querySelector('.route-agent-name').value.trim();
          const usernameInput = group.querySelector('.route-agent-username').value.trim().toLowerCase();
          const passwordInput = group.querySelector('.route-agent-password').value;

          // Validar si el usuario ya existe
          const existingUser = window.BulaPayDB.getUserByUsername(usernameInput);
          if (existingUser) {
            alert(`❌ El nombre de usuario "${usernameInput}" ya está registrado.`);
            validationFailed = true;
            return;
          }

          agentsData.push({
            name: nameInput,
            username: usernameInput,
            password: passwordInput
          });
        });

        if (validationFailed || agentsData.length === 0) return;

        const supervisorUser = window.BulaPayDB.getCurrentUser() || { username: 'admin' };
        const routeId = 'route_' + Date.now();

        // 1. Registrar cada agente en la base de datos
        agentsData.forEach(agent => {
          const newAgent = {
            username: agent.username,
            password: agent.password,
            name: agent.name,
            role: 'Agente de Ruta',
            supervisor: supervisorUser.username,
            routeId: routeId
          };
          window.BulaPayDB.saveUser(newAgent);
        });

        // 2. Crear la Ruta Logística con la lista combinada
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
        window.BulaPayDB.saveRoute(newRoute);

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

        this.calculateRouteSuggestedQuota();
        this.renderDashboard();
        this.initMapRouteFilter();
      });
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
  openKpiModal(kpi) {
    this.activeKpiModal = kpi;
    const overlay = document.getElementById(`modal-kpi-${kpi}`);
    if (!overlay) return;

    overlay.classList.add('active');
    
    // Poblar datos correspondientes
    if (kpi === 'agents') {
      this.populateKpiAgentsModal();
    } else if (kpi === 'capital') {
      this.populateKpiCapitalModal();
    } else if (kpi === 'collected') {
      this.populateKpiCollectedModal();
    } else if (kpi === 'progress') {
      this.populateKpiProgressModal();
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
  populateKpiAgentsModal() {
    const routeSelect = document.getElementById('modal-agents-route-filter');
    const listContainer = document.getElementById('modal-agents-list-container');
    const detailSection = document.getElementById('modal-agent-detail-section');
    
    if (!routeSelect || !listContainer) return;
    
    if (detailSection) detailSection.style.display = 'none';

    // Rellenar select
    routeSelect.innerHTML = `<option value="Todos">Todas las Rutas</option>`;
    const routes = window.BulaPayDB.getRoutes();
    routes.forEach(r => {
      routeSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`;
    });

    this.filterModalAgents();
  },

  filterModalAgents() {
    const routeSelect = document.getElementById('modal-agents-route-filter');
    const listContainer = document.getElementById('modal-agents-list-container');
    if (!routeSelect || !listContainer) return;

    const selectedRouteId = routeSelect.value;
    let agents = window.BulaPayDB.getUsers().filter(u => u.role === 'Agente de Ruta');

    if (selectedRouteId !== 'Todos') {
      agents = agents.filter(a => a.routeId === selectedRouteId);
    }

    listContainer.innerHTML = '';
    if (agents.length === 0) {
      listContainer.innerHTML = `<div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 1rem;">No hay agentes asociados a este filtro.</div>`;
      return;
    }

    agents.forEach(agent => {
      const routes = window.BulaPayDB.getRoutes();
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
          <strong style="color: white; font-size: 0.9rem;">${agent.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Ruta: ${r.name}</div>
        </div>
        <span style="font-size: 0.75rem; color: var(--accent); font-weight: bold;">Ver detalles ➔</span>
      `;
      
      item.addEventListener('mouseenter', () => {
        item.style.borderColor = 'var(--accent)';
        item.style.backgroundColor = 'rgba(0, 245, 212, 0.03)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = 'var(--border-color)';
        item.style.backgroundColor = 'rgba(255,255,255,0.02)';
      });

      item.addEventListener('click', () => this.showModalAgentDetail(agent.username));
      listContainer.appendChild(item);
    });
  },

  showModalAgentDetail(username) {
    const detailSection = document.getElementById('modal-agent-detail-section');
    const title = document.getElementById('modal-agent-detail-title');
    const clientsCountEl = document.getElementById('modal-agent-clients-count');
    const routeCapitalEl = document.getElementById('modal-agent-route-capital');
    const routeCollectedEl = document.getElementById('modal-agent-route-collected');
    
    if (!detailSection) return;

    const agent = window.BulaPayDB.getUsers().find(u => u.username === username);
    if (!agent) return;

    title.textContent = `Detalles de Operación: ${agent.name}`;

    // Obtener clientes asignados a la ruta del agente
    const clients = window.BulaPayDB.getClients().filter(c => c.routeId === agent.routeId);
    clientsCountEl.textContent = `${clients.length} cliente(s)`;

    // Obtener capital y recaudo
    const routes = window.BulaPayDB.getRoutes();
    const r = routes.find(rt => rt.id === agent.routeId);
    
    const capital = r ? r.capital : 0;
    const collected = r ? r.collected : 0;

    routeCapitalEl.textContent = `$${capital.toLocaleString('es-CO')}`;
    routeCollectedEl.textContent = `$${collected.toLocaleString('es-CO')}`;

    // Calcular proporciones de la cartera (Simulación en base al riesgo de los clientes)
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
      // SVG Circle de r=15.915 tiene circunferencia = 100
      greenEl.setAttribute('stroke-dasharray', `${pGreen} 100`);
      greenEl.setAttribute('stroke-dashoffset', '0');

      yellowEl.setAttribute('stroke-dasharray', `${pYellow} 100`);
      yellowEl.setAttribute('stroke-dashoffset', `-${pGreen}`);

      redEl.setAttribute('stroke-dasharray', `${pRed} 100`);
      redEl.setAttribute('stroke-dashoffset', `-${pGreen + pYellow}`);
    }

    detailSection.style.display = 'block';
  },

  // 2. POPULATE MODAL: CAPITAL ASIGNADO
  populateKpiCapitalModal() {
    const container = document.getElementById('modal-capital-routes-container');
    const detailSection = document.getElementById('modal-capital-detail-section');
    if (!container) return;

    if (detailSection) detailSection.style.display = 'none';

    container.innerHTML = '';
    const routes = window.BulaPayDB.getRoutes();

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
          <strong style="color: var(--accent); font-size: 0.95rem;">$${route.capital.toLocaleString('es-CO')}</strong>
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

  showModalCapitalDetail(routeId) {
    const detailSection = document.getElementById('modal-capital-detail-section');
    const title = document.getElementById('modal-capital-detail-title');
    const deliveredEl = document.getElementById('modal-capital-delivered');
    const collectedEl = document.getElementById('modal-capital-collected');
    const remainingEl = document.getElementById('modal-capital-remaining');
    const moraEl = document.getElementById('modal-capital-mora-index');

    if (!detailSection) return;

    const route = window.BulaPayDB.getRoutes().find(r => r.id === routeId);
    if (!route) return;

    title.textContent = `Análisis de Rendimiento: ${route.name}`;
    deliveredEl.textContent = `$${route.capital.toLocaleString('es-CO')}`;
    collectedEl.textContent = `$${route.collected.toLocaleString('es-CO')}`;
    
    const remaining = Math.max(0, route.capital - route.collected);
    remainingEl.textContent = `$${remaining.toLocaleString('es-CO')}`;

    // Simular un índice de mora para fines visuales en base a clientes de esa ruta
    const clients = window.BulaPayDB.getClients().filter(c => c.routeId === route.id);
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
  populateKpiCollectedModal() {
    const container = document.getElementById('modal-collected-ranking-container');
    if (!container) return;

    container.innerHTML = '';
    const routes = window.BulaPayDB.getRoutes();

    // Ordenar de mayor a menor recaudo
    const sortedRoutes = [...routes].sort((a, b) => b.collected - a.collected);

    // Encontrar recaudo máximo para normalizar barra al 100%
    const maxCollected = sortedRoutes[0] ? sortedRoutes[0].collected : 1;

    sortedRoutes.forEach((route, index) => {
      const percentage = maxCollected > 0 ? Math.round((route.collected / maxCollected) * 100) : 0;
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏃';

      const wrapper = document.createElement('div');
      wrapper.className = 'ranking-bar-wrapper';

      wrapper.innerHTML = `
        <div class="ranking-bar-info">
          <span>${medal} <strong>#${rank} ${route.name}</strong> (${route.agentName})</span>
          <span style="color: var(--color-verde); font-weight: 700;">$${route.collected.toLocaleString('es-CO')}</span>
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
  populateKpiProgressModal() {
    const routeSelect = document.getElementById('modal-audit-route-filter');
    const clientsList = document.getElementById('modal-audit-clients-list');
    const ledgerContainer = document.getElementById('modal-audit-ledger-container');

    if (!routeSelect || !clientsList) return;

    if (ledgerContainer) ledgerContainer.style.display = 'none';

    routeSelect.innerHTML = `<option value="Todos">Todas las Rutas</option>`;
    const routes = window.BulaPayDB.getRoutes();
    routes.forEach(r => {
      routeSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`;
    });

    this.filterAuditClients();
  },

  filterAuditClients() {
    const routeSelect = document.getElementById('modal-audit-route-filter');
    const clientsList = document.getElementById('modal-audit-clients-list');
    if (!routeSelect || !clientsList) return;

    const selectedRouteId = routeSelect.value;
    
    // Obtener morosos (riesgo Amarillo o Rojo, o con saldo pendiente > 0)
    let clients = window.BulaPayDB.getClients().filter(c => c.outstanding > 0 && (c.risk === 'Amarillo' || c.risk === 'Rojo'));

    if (selectedRouteId !== 'Todos') {
      clients = clients.filter(c => c.routeId === selectedRouteId);
    }

    clientsList.innerHTML = '';
    if (clients.length === 0) {
      clientsList.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem;">No hay clientes en mora para el filtro seleccionado.</div>`;
      return;
    }

    clients.forEach(client => {
      const riskColor = client.risk === 'Rojo' ? 'var(--color-rojo)' : 'var(--color-amarillo)';
      const riskLabel = client.risk === 'Rojo' ? 'Mora Severa' : 'Atrasado';

      const item = document.createElement('div');
      item.style.padding = '0.5rem 0.75rem';
      item.style.background = 'rgba(255,255,255,0.01)';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '6px';
      item.style.cursor = 'pointer';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.fontSize = '0.8rem';
      item.style.transition = 'var(--transition-smooth)';

      item.innerHTML = `
        <div>
          <strong style="color: white;">${client.name}</strong>
          <div style="font-size: 0.7rem; color: var(--text-secondary);">Deuda: $${client.outstanding.toLocaleString('es-CO')}</div>
        </div>
        <span style="font-size: 0.75rem; color: ${riskColor}; font-weight: 600;">${riskLabel}</span>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.borderColor = riskColor;
        item.style.backgroundColor = 'rgba(255,255,255,0.03)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = 'var(--border-color)';
        item.style.backgroundColor = 'rgba(255,255,255,0.01)';
      });

      item.addEventListener('click', () => this.showAuditClientLedger(client.cedula));
      clientsList.appendChild(item);
    });
  },

  showAuditClientLedger(cedula) {
    const ledgerContainer = document.getElementById('modal-audit-ledger-container');
    const nameEl = document.getElementById('modal-audit-client-name');
    const metaEl = document.getElementById('modal-audit-client-meta');
    const gridEl = document.getElementById('modal-audit-ledger-grid');

    if (!ledgerContainer || !gridEl) return;

    const client = window.BulaPayDB.getClientByCedula(cedula);
    if (!client) return;

    nameEl.textContent = client.name;
    metaEl.textContent = `Cédula: ${client.cedula} | Saldo Pendiente: $${client.outstanding.toLocaleString('es-CO')} / $${client.totalDebt.toLocaleString('es-CO')}`;

    const payments = window.BulaPayDB.getPaymentsByClient(cedula);

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
        slotCard.classList.add(isAbonado ? 'abonado' : 'paid');
        
        slotCard.innerHTML = `
          <span class="slot-num" style="font-size: 0.55rem;">CUOTA ${i}</span>
          <span class="slot-amount" style="font-size: 0.75rem;">$${payment.amount.toLocaleString('es-CO')}</span>
          <span class="slot-date" style="font-size: 0.5rem; display:block;">${payment.date}</span>
          <div class="slot-stamp" style="font-size: 0.75rem; bottom:2px; right:4px;">${isAbonado ? '🟡' : '🟢'}</div>
        `;
      } else {
        slotCard.innerHTML = `
          <span class="slot-num" style="font-size: 0.55rem;">CUOTA ${i}</span>
          <span class="slot-amount" style="color: var(--text-muted); font-size: 0.7rem;">$${client.installmentAmount.toLocaleString('es-CO')}</span>
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
  initMapRouteFilter() {
    const filter = document.getElementById('map-route-filter');
    if (!filter) return;

    filter.innerHTML = `<option value="Todos">Todas las Rutas</option>`;
    const routes = window.BulaPayDB.getRoutes();
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
    // Agente 1 (Ruta 1): (150, 70)
    // Agente 2 (Ruta 2): (200, 240)
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
      // Rutas creadas dinámicamente: usar punto intermedio
      targetX = 250;
      targetY = 150;
      scale = 1.5;
    }

    // Canvas del mapa es de 400x280.
    // Centrar targetX, targetY:
    // translateX = 200 - targetX * scale
    // translateY = 140 - targetY * scale
    const transX = 200 - targetX * scale;
    const transY = 140 - targetY * scale;

    transformGroup.setAttribute('transform', `translate(${transX}, ${transY}) scale(${scale})`);
  },

  // 6. FEED EN VIVO DE SIMULACIÓN
  startLiveFeedSimulation() {
    const feedContent = document.getElementById('live-feed-content');
    const feedTime = document.getElementById('live-feed-time');
    if (!feedContent) return;

    feedContent.innerHTML = '';
    
    // Logs semilla
    const initialLogs = [
      '📍 Sistema BulaPay iniciado. Central de monitoreo en línea.',
      '📍 Agente Juan Pérez inició el recorrido de la Ruta Centro - Norte.',
      '📍 Agente María López reportó llegada a la Zona Sur.'
    ];

    initialLogs.forEach(log => {
      const logEl = document.createElement('div');
      logEl.className = 'live-feed-log';
      logEl.textContent = log;
      feedContent.appendChild(logEl);
    });

    if (feedTime) {
      feedTime.textContent = 'Actualizado hace unos segundos';
    }

    if (this.liveFeedInterval) {
      clearInterval(this.liveFeedInterval);
    }

    const logTemplates = [
      'Agente {agent} registró un recaudo de ${amount} para el Cliente {client}.',
      'Agente {agent} reportó retraso del Cliente {client} (Riesgo Amarillo).',
      'Agente {agent} completó la cobranza en el sector {sector}.',
      'Agente {agent} generó un recibo digital digital (Sello {signature}).',
      'Sistema BulaPay actualizó el estado de la ruta {route}.'
    ];

    this.liveFeedInterval = setInterval(() => {
      const routes = window.BulaPayDB.getRoutes();
      const clients = window.BulaPayDB.getClients();
      
      if (routes.length === 0 || clients.length === 0) return;

      const randomRoute = routes[Math.floor(Math.random() * routes.length)];
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      const agentName = randomRoute.agentName.split(',')[0]; // Tomar el primer agente si hay múltiples

      // Generar datos aleatorios
      const amount = (Math.floor(Math.random() * 5) + 1) * 20000;
      const sectors = ['Chapinero', 'Centro Histórico', 'Zona Financiera', 'El Poblado', 'Oriente'];
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
      
      // Auto scroll al final del feed
      feedContent.scrollTop = feedContent.scrollHeight;

      // Limitar a máximo 8 logs en pantalla para evitar saturación
      if (feedContent.children.length > 8) {
        feedContent.removeChild(feedContent.firstChild);
      }

      if (feedTime) {
        const now = new Date();
        feedTime.textContent = `Último evento: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      }
    }, 6000);
  },

  // RENDERIZAR DASHBOARD KPIs Y TABLA
  renderDashboard() {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Administrador Demo', username: 'admin' };
    if (this.welcomeMsg) {
      this.welcomeMsg.textContent = `Bienvenido, ${currentUser.name} | ${currentUser.company || 'BulaPay'}`;
    }

    const routes = window.BulaPayDB.getRoutes();
    const agents = window.BulaPayDB.getUsers().filter(u => u.role === 'Agente de Ruta');

    // Calcular KPIs
    const totalAgentsCount = agents.length;
    const totalCapital = routes.reduce((acc, curr) => acc + curr.capital, 0);
    const totalCollected = routes.reduce((acc, curr) => acc + curr.collected, 0);
    
    let progressPercent = 0;
    if (totalCapital > 0) {
      progressPercent = Math.round((totalCollected / totalCapital) * 100);
    }

    // Inyectar KPIs
    if (this.kpiActiveAgents) this.kpiActiveAgents.textContent = totalAgentsCount;
    if (this.kpiTotalCapital) this.kpiTotalCapital.textContent = `$${totalCapital.toLocaleString('es-CO')}`;
    if (this.kpiTotalCollected) this.kpiTotalCollected.textContent = `$${totalCollected.toLocaleString('es-CO')}`;
    if (this.kpiRouteProgress) this.kpiRouteProgress.textContent = `${progressPercent}%`;

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
      const progress = route.capital > 0 ? Math.round((route.collected / route.capital) * 100) : 0;
      
      let statusClass = 'en-ruta';
      if (route.status === 'Completado') statusClass = 'completado';
      if (route.status === 'Incidencia') statusClass = 'incidencia';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: white;">${route.name}</td>
        <td>👤 ${route.agentName}</td>
        <td>$${route.capital.toLocaleString('es-CO')}</td>
        <td style="color: var(--accent); font-weight: 600;">$${route.collected.toLocaleString('es-CO')}</td>
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

  startMapSimulation() {
    if (this.mapAnimationInterval) {
      clearInterval(this.mapAnimationInterval);
    }

    const agent1 = document.getElementById('map-agent-1');
    const agent1Pulse = document.getElementById('map-agent-1-pulse');
    const agent2 = document.getElementById('map-agent-2');
    const agent2Pulse = document.getElementById('map-agent-2-pulse');
    
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
      if (agent1 && agent1Pulse) {
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
        
        const lbl1 = document.getElementById('map-lbl-agent-1');
        if (lbl1) {
          lbl1.setAttribute('x', pos1.cx + 15);
          lbl1.setAttribute('y', pos1.cy - 5);
        }
      }

      // Agente 2
      if (agent2 && agent2Pulse) {
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

        const lbl2 = document.getElementById('map-lbl-agent-2');
        if (lbl2) {
          lbl2.setAttribute('x', pos2.cx + 15);
          lbl2.setAttribute('y', pos2.cy - 5);
        }
      }
    }, 3000);
  },

  destroy() {
    if (this.mapAnimationInterval) {
      clearInterval(this.mapAnimationInterval);
    }
    if (this.liveFeedInterval) {
      clearInterval(this.liveFeedInterval);
    }
  }
};

window.supervisorModule = supervisorModule;
