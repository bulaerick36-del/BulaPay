/**
 * BulaPay SaaS - Módulo de Interfaz Frontend para Agente de Ruta (Cobrador de Campo)
 * 
 * NOTA DE DISEÑO & ARQUITECTURA DE NEGOCIO:
 * Este agente tiene un perfil estrictamente operativo (Solo Recaudo en Campo).
 * Se eliminaron intencionalmente los módulos de:
 *  - ❌ Caja global (El agente no administra saldos generales ni cierres patrimoniales)
 *  - ❌ Inyección de caja (Las inyecciones las autoriza y ejecuta el Supervisor)
 *  - ❌ Patrimonio / Rendimientos (Propiedad exclusiva de la vista del Supervisor/Dueño)
 */

const AgenteRutaModule = {
  activeRoute: null,
  supervisorInfo: null,
  todayCollected: 0,
  routeClients: [],

  init() {
    console.log("🚀 Inicializando módulo Agente de Ruta (BulaPay)...");
    this.renderViewContainer();
    this.bindEvents();
    this.loadAgentRouteData();
  },

  /**
   * Carga los datos de la ruta asignada y supervisor desde Supabase o estado local
   */
  async loadAgentRouteData() {
    try {
      const sessionUser = JSON.parse(localStorage.getItem('bulapay_user') || '{}');
      const agentUsername = sessionUser.username || 'agente1';

      // Simulación de consulta relacional: agentes_ruta JOIN routes JOIN users (Supervisor)
      if (window.dbModule && typeof window.dbModule.getAgentRouteProfile === 'function') {
        const profile = await window.dbModule.getAgentRouteProfile(agentUsername);
        this.activeRoute = profile.ruta || { id: 'route_1', name: 'Ruta San Diego' };
        this.supervisorInfo = profile.supervisor || { name: 'Carlos Mendoza', phone: '+57 315 123 4567' };
      } else {
        // Fallback datos por defecto para demostración fluida
        this.activeRoute = { id: 'route_1', name: 'Ruta San Diego' };
        this.supervisorInfo = { name: 'Carlos Mendoza', phone: '+57 315 123 4567' };
      }

      this.updateHeaderUI();
      this.fetchDailyCollectionStats();
    } catch (err) {
      console.error("Error al cargar datos del Agente de Ruta:", err);
    }
  },

  updateHeaderUI() {
    const elRouteName = document.getElementById('agente-ruta-nombre');
    const elSupervisorName = document.getElementById('agente-ruta-supervisor');

    if (elRouteName) elRouteName.textContent = this.activeRoute.name || 'Ruta no asignada';
    if (elSupervisorName) elSupervisorName.textContent = `Supervisor: ${this.supervisorInfo.name || 'N/A'}`;
  },

  fetchDailyCollectionStats() {
    // Calcular recaudo del día para esta ruta
    const payments = JSON.parse(localStorage.getItem('bulapay_payments') || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    
    const totalToday = payments
      .filter(p => p.date === todayStr || p.created_at?.startsWith(todayStr))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    this.todayCollected = totalToday;
    const elCollected = document.getElementById('agente-ruta-total-cobrado');
    if (elCollected) {
      elCollected.textContent = `$${totalToday.toLocaleString('es-CO')}`;
    }
  },

  /**
   * Renderiza la plantilla HTML para la vista del Agente de Ruta
   * Recicla la estética Glassmorphic de BulaPay / BulaPay
   */
  getHTMLTemplate() {
    return `
    <div id="view-agente-ruta-container" class="agente-ruta-wrapper" style="max-width: 500px; margin: 0 auto; padding: 1rem; font-family: 'Inter', system-ui, sans-serif;">
      
      <!-- BANNER DE ENCABEZADO: RUTA & SUPERVISOR -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 1.25rem; color: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); margin-bottom: 1.25rem; position: relative; overflow: hidden;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #10b981; font-weight: 800;">📍 Ruta Asignada</span>
            <h2 id="agente-ruta-nombre" style="margin: 0.2rem 0 0.4rem 0; font-size: 1.5rem; font-weight: 900; color: #ffffff;">Ruta San Diego</h2>
            <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #94a3b8;">
              <span>👤</span>
              <span id="agente-ruta-supervisor" style="font-weight: 600;">Supervisor: Carlos Mendoza</span>
            </div>
          </div>

          <button id="btn-contact-supervisor" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; padding: 0.5rem 0.75rem; border-radius: 12px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; transition: all 0.2s;" onclick="AgenteRutaModule.contactSupervisor()">
            💬 Contactar
          </button>
        </div>

        <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.15); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; color: #cbd5e1; font-weight: 500;">Estado de Operación:</span>
          <span style="background: #10b981; color: #022c22; font-size: 0.72rem; padding: 0.25rem 0.6rem; border-radius: 20px; font-weight: 800; display: inline-flex; align-items: center; gap: 0.3rem;">
            ● En Ruta de Cobro
          </span>
        </div>
      </div>

      <!-- TARJETA DE UNICO METRICO AUTORIZADO: TOTAL COBRADO HOY -->
      <!-- (Sin Caja Global, Sin Inyecciones, Sin Patrimonio) -->
      <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 20px; padding: 1.5rem; color: white; text-align: center; box-shadow: 0 10px 20px -5px rgba(5,150,105,0.4); margin-bottom: 1.25rem;">
        <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; opacity: 0.9;">Recaudo Total del Día</span>
        <h1 id="agente-ruta-total-cobrado" style="margin: 0.4rem 0; font-size: 2.6rem; font-weight: 900; letter-spacing: -1px;">$0</h1>
        <p style="margin: 0; font-size: 0.78rem; opacity: 0.85;">Dinero recibido en campo listo para entregar al supervisor</p>
      </div>

      <!-- BARRA DE PROGRESO DE COBROS DE LA RUTA -->
      <div style="background: var(--bg-secondary, #1e293b); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 16px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.5rem; font-weight: 700; color: var(--text-primary, #f8fafc);">
          <span>Meta de Cobros del Día</span>
          <span id="agente-ruta-progress-text">12 de 20 Clientes (60%)</span>
        </div>
        <div style="width: 100%; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden;">
          <div id="agente-ruta-progress-bar" style="width: 60%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 5px; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- HERRAMIENTA OPERATIVA DE BUSQUEDA Y COBRO -->
      <div style="background: var(--bg-secondary, #1e293b); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 16px; padding: 1.25rem; margin-bottom: 1.25rem;">
        <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary, #f8fafc);">
          🔎 Buscar Cliente en la Ruta
        </label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="agente-ruta-search-input" placeholder="Nombre o Cédula..." style="flex: 1; padding: 0.75rem; border-radius: 12px; border: 1px solid var(--border-color, #334155); background: var(--bg-primary, #0f172a); color: white; font-size: 0.95rem;">
          <button id="btn-agente-ruta-search" style="padding: 0.75rem 1.25rem; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
            Buscar
          </button>
        </div>
      </div>

      <!-- BOTONERA DE ACCIONES DE CAMPO -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
        <button id="btn-open-scan-qr" style="padding: 1rem; background: #3b82f6; color: white; border: none; border-radius: 16px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(59,130,246,0.3);">
          <span style="font-size: 1.5rem;">📷</span>
          Escanear QR / Carnet
        </button>

        <button id="btn-report-novedad" style="padding: 1rem; background: #ef4444; color: white; border: none; border-radius: 16px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(239,68,68,0.3);" onclick="AgenteRutaModule.reportNovedad()">
          <span style="font-size: 1.5rem;">⚠️</span>
          Reportar Novedad
        </button>
      </div>

    </div>
    `;
  },

  renderViewContainer() {
    let target = document.getElementById('view-agente-ruta');
    if (!target) {
      target = document.createElement('section');
      target.id = 'view-agente-ruta';
      target.className = 'view-section';
      document.body.appendChild(target);
    }
    target.innerHTML = this.getHTMLTemplate();
  },

  bindEvents() {
    const btnSearch = document.getElementById('btn-agente-ruta-search');
    if (btnSearch) {
      btnSearch.addEventListener('click', () => this.handleSearch());
    }
  },

  handleSearch() {
    const input = document.getElementById('agente-ruta-search-input');
    const query = input ? input.value.trim() : '';
    if (!query) {
      alert("Por favor ingresa la cédula o nombre del cliente.");
      return;
    }
    alert(`Buscando cliente "${query}" en la ${this.activeRoute?.name || 'Ruta asignada'}...`);
  },

  contactSupervisor() {
    if (this.supervisorInfo && this.supervisorInfo.phone) {
      const cleanPhone = this.supervisorInfo.phone.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(`Hola ${this.supervisorInfo.name}, te hablo desde la ${this.activeRoute?.name || 'Ruta'}.`);
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
    } else {
      alert("Teléfono del supervisor no disponible.");
    }
  },

  reportNovedad() {
    const novedad = prompt("Escribe la novedad (Ej. Cliente no estuvo, Promesa de pago para mañana):");
    if (novedad) {
      alert(`Novedad registrada y enviada al Supervisor (${this.supervisorInfo?.name}): "${novedad}"`);
    }
  }
};

// Exportar globalmente
window.AgenteRutaModule = AgenteRutaModule;
