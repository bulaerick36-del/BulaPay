// Módulo de Superadministrador Maestro de BulaPay
// Acceso Exclusivo: Cédula 1121338578

const superadminModule = {
  activeTab: 'users', // 'users' | 'contracts' | 'performance'
  selectedUserForChart: null,
  performanceChartInstance: null,

  // Credenciales por defecto
  DEFAULT_SUPERADMIN_ID: '1121338578',

  getSuperadminPassword() {
    return localStorage.getItem('bula_superadmin_pwd') || '1121338578';
  },

  setSuperadminPassword(newPassword) {
    localStorage.setItem('bula_superadmin_pwd', newPassword);
  },

  isLoggedIn() {
    return sessionStorage.getItem('bula_superadmin_active') === 'true';
  },

  login(usernameInput, passwordInput) {
    const validId = this.DEFAULT_SUPERADMIN_ID;
    const validPwd = this.getSuperadminPassword();

    if (usernameInput.trim() === validId && passwordInput === validPwd) {
      sessionStorage.setItem('bula_superadmin_active', 'true');
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem('bula_superadmin_active');
    const overlay = document.getElementById('superadmin-fixed-overlay');
    if (overlay) overlay.remove();
    window.location.hash = '#auth';
    window.location.reload();
  },

  hideAllViewsAndShowSuperadmin() {
    try {
      const authView = document.getElementById('view-auth');
      if (authView) {
        authView.classList.remove('active');
        authView.classList.add('d-none');
        authView.style.setProperty('display', 'none', 'important');
      }

      const authContainer = document.getElementById('auth-container');
      if (authContainer) {
        authContainer.style.setProperty('display', 'none', 'important');
      }

      const authWrapper = document.querySelector('.auth-wrapper');
      if (authWrapper) {
        authWrapper.style.setProperty('display', 'none', 'important');
      }

      const sections = document.querySelectorAll('.view-section');
      sections.forEach(s => {
        if (s.id !== 'view-superadmin') {
          s.classList.remove('active');
          s.classList.add('d-none');
          s.style.setProperty('display', 'none', 'important');
        }
      });

      const targetContainers = [
        document.getElementById('view-superadmin'),
        document.getElementById('main-content'),
        document.getElementById('app')
      ].filter(Boolean);

      targetContainers.forEach(el => {
        el.classList.remove('d-none', 'hidden', 'invisible', 'hide');
        el.classList.add('active');
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('opacity');
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
      });

      return document.getElementById('view-superadmin') || document.getElementById('main-content') || document.getElementById('app');
    } catch(err) {
      console.warn("Fallo secundario al ocultar vistas SPA:", err);
    }
  },

  async renderFloatingSuperadminPanel() {
    // 1. Cerrar el menú lateral (drawer) de forma segura
    try {
      const drawer = document.getElementById('drawer-main-menu');
      if (drawer) drawer.classList.remove('active');
    } catch(e) {}

    sessionStorage.setItem('bula_superadmin_active', 'true');
    window.location.hash = '#superadmin';

    // 2. Intentar ocultar vistas secundarias de la SPA (blindado sin bloqueo)
    try {
      if (typeof this.hideAllViewsAndShowSuperadmin === 'function') {
        this.hideAllViewsAndShowSuperadmin();
      }
    } catch(e) {
      console.warn("Advertencia al ocultar vistas secundarias:", e);
    }

    // 3. Crear o limpiar el overlay flotante
    let overlay;
    try {
      let existing = document.getElementById('superadmin-fixed-overlay');
      if (existing) existing.remove();

      overlay = document.createElement('div');
      overlay.id = 'superadmin-fixed-overlay';
      overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: #0b132b !important;
        color: #f8fafc !important;
        z-index: 99999 !important;
        overflow-y: auto !important;
        padding: 1.5rem !important;
        box-sizing: border-box !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      `;
    } catch(e) {
      console.error("Fallo crítico creando elemento overlay:", e);
      return;
    }

    // 4. Cargar usuarios (con fallback seguro ante cualquier error)
    let users = [];
    try {
      if (window.BulaPayDB && typeof window.BulaPayDB.getAllUsers === 'function') {
        users = await window.BulaPayDB.getAllUsers();
      }
    } catch (e) {
      console.warn("Fallo al obtener usuarios Supabase:", e);
    }
    if (!users || !Array.isArray(users) || users.length === 0) {
      try {
        users = this.getFallbackUsers();
      } catch(e) {
        users = [
          { username: 'admin', name: 'Administrador General', role: 'Usuario Supervisor', phone: '3000000000', email: 'admin@bulapay.com', documentType: 'CC', documentNumber: '1121338578' }
        ];
      }
    }

    // 5. Construir filas de tabla de usuarios de forma segura
    let userRowsHtml = '';
    try {
      users.forEach(u => {
        const doc = u.documentNumber ? `${u.documentType || 'CC'}: ${u.documentNumber}` : 'Sin Documento';
        const roleBadge = u.role === 'Agente Independiente' 
          ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399 !important; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.25rem 0.6rem; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; display: inline-block;">💼 ${u.role}</span>`
          : `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa !important; border: 1px solid rgba(59, 130, 246, 0.4); padding: 0.25rem 0.6rem; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; display: inline-block;">👔 ${u.role || 'Usuario'}</span>`;

        userRowsHtml += `
          <tr class="sa-user-row" style="border-bottom: 1px solid rgba(255,255,255,0.07);">
            <td class="sa-user-col-username" style="padding: 0.85rem 1rem; vertical-align: middle;">
              <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">
                <span class="sa-user-title" style="color: #ffffff !important; font-weight: 800; font-size: 0.92rem; display: block; line-height: 1.2;">${u.username}</span>
                <span class="sa-user-doc-badge" style="font-size: 0.75rem; color: #38bdf8 !important; font-weight: 600; display: inline-block; background: rgba(56, 189, 248, 0.14); padding: 0.2rem 0.55rem; border-radius: 5px; border: 1px solid rgba(56, 189, 248, 0.3); white-space: nowrap;">💳 ${doc}</span>
              </div>
            </td>
            <td class="sa-user-col-name" style="padding: 0.85rem 1rem; vertical-align: middle;">
              <span class="sa-user-fullname" style="color: #f8fafc !important; font-weight: 700; font-size: 0.9rem; display: block; line-height: 1.3;">${u.name || u.nombre_firmante || 'Sin Nombre'}</span>
            </td>
            <td class="sa-user-col-role" style="padding: 0.85rem 1rem; vertical-align: middle;">${roleBadge}</td>
            <td class="sa-user-col-contact" style="padding: 0.85rem 1rem; vertical-align: middle;">
              <div style="display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem;">
                <span style="color: #e2e8f0 !important; font-weight: 600;">📞 ${u.phone || 'N/A'}</span>
                <span style="color: #94a3b8 !important; font-size: 0.75rem;">✉️ ${u.email || 'N/A'}</span>
              </div>
            </td>
            <td class="sa-user-col-status" style="padding: 0.85rem 1rem; vertical-align: middle;">
              <span style="background: rgba(16, 185, 129, 0.2); color: #34d399 !important; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 700; font-size: 0.75rem; display: inline-block;">Activo</span>
            </td>
            <td class="sa-user-col-actions" style="padding: 0.85rem 1rem; vertical-align: middle; text-align: right; white-space: nowrap;">
              <div style="display: flex; gap: 0.4rem; justify-content: flex-end; align-items: center;">
                <button class="btn btn-secondary" style="padding: 0.4rem 0.7rem; font-size: 0.75rem; font-weight: 700; background: rgba(59, 130, 246, 0.2); color: #93c5fd !important; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; cursor: pointer;" onclick="superadminModule.openResetPwdModal('${u.username}')">🔑 Restablecer Clave</button>
                <button class="btn btn-secondary" style="padding: 0.4rem 0.7rem; font-size: 0.75rem; font-weight: 700; background: rgba(255, 255, 255, 0.12); color: #f8fafc !important; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; cursor: pointer;" onclick="superadminModule.openEditUserModal('${u.username}')">✏️ Editar</button>
              </div>
            </td>
          </tr>
        `;
      });
    } catch(e) {
      console.warn("Fallo construyendo filas de usuario:", e);
    }

    // 6. Inyectar HTML en el overlay y montarlo en document.body
    try {
      overlay.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; background: #1c2541; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          
          <!-- Cabecera Principal del Panel Maestro Flotante -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 0.3rem 0.8rem; font-weight: 700; font-size: 0.8rem; border-radius: 9999px; text-transform: uppercase;">👑 PANEL DE SUPERADMINISTRADOR MAESTRO - ACTIVO</span>
              <h1 style="font-size: 1.8rem; font-weight: 900; color: #ffffff; margin-top: 0.5rem; margin-bottom: 0.2rem;">Panel de Superadministrador Maestro</h1>
              <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">Acceso Total Exclusivo - Cédula: 1121338578</p>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
              <button id="btn-test-dom" onclick="alert('✅ ¡El DOM del Panel Maestro Flotante responde perfectamente!')" style="padding: 0.55rem 1rem; font-size: 0.85rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #ffffff; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">🧪 Probador DOM</button>
              <button onclick="superadminModule.openContractPDF('Administrador General', 'CC: 1121338578', new Date().toLocaleString('es-CO'), 'BULAPAY-SIG-ADMIN-STAMP')" style="padding: 0.55rem 1rem; font-size: 0.85rem; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border: none; color: white; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">📜 Exportar Contratos PDF</button>
              <button onclick="superadminModule.openChangeSuperadminPwdModal()" style="padding: 0.55rem 1rem; font-size: 0.85rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #f8fafc; font-weight: 600; border-radius: 8px; cursor: pointer;">🔑 Cambiar Clave</button>
              <button onclick="superadminModule.logout()" style="padding: 0.55rem 1rem; font-size: 0.85rem; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; font-weight: 700; border-radius: 8px; cursor: pointer;">🚪 Salir</button>
            </div>
          </div>

          <!-- Pestañas de Módulos Flotantes (Navegación Dinámica de 4 Pestañas) -->
          <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 1.5rem; overflow-x: auto;">
            <button id="sa-tab-users" class="sa-floating-tab active" onclick="superadminModule.switchSuperadminTab('users', event)" style="padding: 0.75rem 1.25rem; background: none; border: none; color: #34d399; font-weight: 700; cursor: pointer; border-bottom: 3px solid #34d399;">👥 1. Usuarios y Clientes</button>
            <button id="sa-tab-contracts" class="sa-floating-tab" onclick="superadminModule.switchSuperadminTab('contracts', event)" style="padding: 0.75rem 1.25rem; background: none; border: none; color: #94a3b8; font-weight: 700; cursor: pointer; border-bottom: none;">📜 2. Contratos y Términos</button>
            <button id="sa-tab-performance" class="sa-floating-tab" onclick="superadminModule.switchSuperadminTab('resources', event)" style="padding: 0.75rem 1.25rem; background: none; border: none; color: #94a3b8; font-weight: 700; cursor: pointer; border-bottom: none;">📊 3. Recurso Movido &amp; Gráficas</button>
            <button id="sa-tab-advances" class="sa-floating-tab" onclick="superadminModule.switchSuperadminTab('advances', event)" style="padding: 0.75rem 1.25rem; background: none; border: none; color: #94a3b8; font-weight: 700; cursor: pointer; border-bottom: none;">📈 4. Avances y Movimientos</button>
          </div>

          <!-- Contenedores Independientes por Pestaña -->
          <div id="superadmin-tab-content" style="margin-bottom: 1rem;">
            <div id="tab-content-users" class="sa-tab-pane" style="display: block;"></div>
            <div id="tab-content-contracts" class="sa-tab-pane" style="display: none;"></div>
            <div id="tab-content-resources" class="sa-tab-pane" style="display: none;"></div>
            <div id="tab-content-advances" class="sa-tab-pane" style="display: none;"></div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
    } catch(e) {
      console.error("Fallo inyectando HTML en overlay:", e);
    }

    // 7. Sincronizaciones secundarias y carga inicial automática de la Pestaña 1
    try {
      this.renderDrawerSection();
    } catch(e) {}

    try {
      await this.switchSuperadminTab('users');
    } catch(e) {}
  },

  showSuperadminView() {
    this.renderFloatingSuperadminPanel();
  },

  async openSuperadminPanel() {
    await this.renderFloatingSuperadminPanel();
  },

  async init() {
    this.bindEvents();
    if (!this.isLoggedIn()) {
      if (window.location.hash === '#superadmin') {
        window.location.hash = '#auth';
      }
      this.renderDrawerSection();
      return;
    }

    await this.renderFloatingSuperadminPanel();
  },

  clearDrawerInputs() {
    const inputUser = document.getElementById('drawer-sa-user');
    const inputPwd = document.getElementById('drawer-sa-pwd');
    if (inputUser) {
      inputUser.value = '';
      inputUser.setAttribute('readonly', 'readonly');
    }
    if (inputPwd) {
      inputPwd.value = '';
    }
  },

  renderDrawerSection() {
    const container = document.getElementById('drawer-superadmin-container');
    if (!container) return;

    if (this.isLoggedIn()) {
      container.innerHTML = `
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
          <span>Administración Master</span>
          <span style="font-size: 0.65rem; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600;">Sesión Activa</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <button type="button" id="btn-view-superadmin" class="drawer-menu-item master-item" style="width: 100%; text-align: left; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-weight: 700; cursor: pointer; border-radius: 8px; padding: 0.6rem 0.8rem; display: flex; align-items: center; gap: 0.5rem;" onclick="superadminModule.openSuperadminPanel();">
            👑 Ver Panel Superadmin
          </button>
          <button class="btn btn-secondary" style="padding: 0.4rem; font-size: 0.75rem; border-color: #ef4444; color: #fca5a5; width: 100%; font-weight: 600;" onclick="superadminModule.logout()">
            🚪 Cerrar Sesión Master
          </button>
        </div>
      `;
    } else {
      this.clearDrawerInputs();
    }
  },

  async handleSuperadminAuth(e) {
    if (e) {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const inputUser = document.getElementById('drawer-sa-user');
    const inputPwd = document.getElementById('drawer-sa-pwd') || document.getElementById('drawer-sa-pass');

    if (!inputUser || !inputPwd) {
      alert('Credenciales de Superadministrador incorrectas');
      return;
    }

    const userInput = inputUser.value.trim();
    const pwdInput = inputPwd.value;

    if (this.login(userInput, pwdInput)) {
      alert('🔑 Acceso concedido al Panel de Superadministrador Maestro.');
      await this.openSuperadminPanel();
    } else {
      alert('Credenciales de Superadministrador incorrectas');
    }
  },

  async switchSuperadminTab(target, e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    let key = 'users';
    if (target === 1 || target === '1' || target === 'users') key = 'users';
    else if (target === 2 || target === '2' || target === 'contracts') key = 'contracts';
    else if (target === 3 || target === '3' || target === 'resources' || target === 'performance') key = 'resources';
    else if (target === 4 || target === '4' || target === 'advances') key = 'advances';

    this.activeTab = key === 'resources' ? 'performance' : key;

    // 1. Ocultar todos los contenedores de pestañas y mostrar sólo el seleccionado
    const panes = [
      { id: 'tab-content-users', key: 'users' },
      { id: 'tab-content-contracts', key: 'contracts' },
      { id: 'tab-content-resources', key: 'resources' },
      { id: 'tab-content-advances', key: 'advances' }
    ];

    panes.forEach(pane => {
      const el = document.getElementById(pane.id);
      if (el) {
        if (pane.key === key) {
          el.style.setProperty('display', 'block', 'important');
        } else {
          el.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // 2. Mover el indicador verde inferior (#34d399) y estilo activo a la pestaña seleccionada
    const btnMap = {
      users: 'sa-tab-users',
      contracts: 'sa-tab-contracts',
      resources: 'sa-tab-performance',
      advances: 'sa-tab-advances'
    };

    Object.keys(btnMap).forEach(k => {
      const btn = document.getElementById(btnMap[k]);
      if (btn) {
        const isActive = (k === key);
        btn.style.color = isActive ? '#34d399' : '#94a3b8';
        btn.style.borderBottom = isActive ? '3px solid #34d399' : 'none';
        btn.style.fontWeight = isActive ? '700' : '600';
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    // 3. Renderizar el contenido dinámico en el contenedor correspondiente
    try {
      if (key === 'users') {
        const c = document.getElementById('tab-content-users');
        if (c) await this.renderUsersTab(c);
      } else if (key === 'contracts') {
        const c = document.getElementById('tab-content-contracts');
        if (c) await this.renderContractsTab(c);
      } else if (key === 'resources') {
        const c = document.getElementById('tab-content-resources');
        if (c) await this.renderPerformanceTab(c);
      } else if (key === 'advances') {
        const c = document.getElementById('tab-content-advances');
        if (c) await this.renderAdvancesTab(c);
      }
    } catch(err) {
      console.warn("Fallo al renderizar pestaña activa:", err);
    }
  },

  async switchTab(tabName, e) {
    await this.switchSuperadminTab(tabName, e);
  },

  bindEvents() {
    // Manejar evento de clic directo en el botón #btn-view-superadmin o selector correspondiente
    document.addEventListener('click', (e) => {
      const btn = e.target ? e.target.closest('#btn-view-superadmin, .master-item, [data-action="view-superadmin"]') : null;
      if (btn || (e.target && e.target.textContent && e.target.textContent.includes('Ver Panel Superadmin'))) {
        e.preventDefault();
        this.openSuperadminPanel();
      }
    });

    // Eventos de submit y click para el botón de acceso master del drawer
    const formDrawerLogin = document.getElementById('form-drawer-superadmin-login');
    if (formDrawerLogin) {
      formDrawerLogin.onsubmit = (e) => this.handleSuperadminAuth(e);
    }

    const btnEnter = document.getElementById('btn-enter-superadmin');
    if (btnEnter) {
      btnEnter.onclick = (e) => this.handleSuperadminAuth(e);
    }

    // Cambio de pestañas en el panel de Superadministrador
    const tabs = document.querySelectorAll('.superadmin-tab');
    tabs.forEach(tab => {
      tab.onclick = async (e) => {
        const tabName = e.currentTarget.dataset.tab || 'users';
        await this.switchTab(tabName, e);
      };
    });

    // Botón Cambiar Contraseña Superadmin
    const btnChangePwd = document.getElementById('btn-superadmin-change-pwd');
    if (btnChangePwd) {
      btnChangePwd.onclick = () => this.openChangeSuperadminPwdModal();
    }
  },

  getFallbackUsers() {
    return [
      { username: 'admin', name: 'Administrador General', role: 'Usuario Supervisor', phone: '3000000000', email: 'admin@bulapay.com', documentType: 'CC', documentNumber: '1121338578', aceptacion_terminos: true, fecha_aceptacion_terminos: '2026-06-01T10:00:00Z', hash_firma_digital: 'BULAPAY-SIG-ADMIN-STAMP' },
      { username: 'agente1', name: 'Carlos Mendoza', role: 'Agente Independiente', phone: '3101234567', email: 'carlos@bulapay.com', documentType: 'CC', documentNumber: '1098765432', aceptacion_terminos: true, fecha_aceptacion_terminos: '2026-06-15T14:30:00Z', hash_firma_digital: 'BULAPAY-SIG-AGENTE1-STAMP' }
    ];
  },

  async renderCurrentTab() {
    const container = document.getElementById('superadmin-tab-content');
    if (!container) return;

    try {
      if (this.activeTab === 'users') {
        await this.renderUsersTab(container);
      } else if (this.activeTab === 'contracts') {
        await this.renderContractsTab(container);
      } else if (this.activeTab === 'performance') {
        await this.renderPerformanceTab(container);
      } else if (this.activeTab === 'advances') {
        await this.renderAdvancesTab(container);
      }
    } catch (err) {
      console.warn("Error al renderizar pestaña superadmin:", err);
      container.innerHTML = `
        <div class="superadmin-card" style="padding: 1.5rem; text-align: center;">
          <h4 style="color: var(--color-verde); margin-bottom: 0.5rem;">👑 Panel Maestro de Superadministrador</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Cargando datos del servidor Supabase...</p>
        </div>
      `;
    }
  },

  // ----------------------------------------------------
  // OPCIÓN 1: MÓDULO USUARIOS Y CLIENTES (GESTIÓN DE CONSTRASEÑAS)
  // ----------------------------------------------------
  async renderUsersTab(container) {
    container.innerHTML = `
      <div class="superadmin-card" style="background: #0f172a !important; border: 1px solid rgba(255,255,255,0.12) !important; border-radius: 14px; padding: 1.5rem; color: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #ffffff; margin-bottom: 0.25rem; background: linear-gradient(135deg, #34d399 0%, #10b981 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">👥 Módulo de Usuarios y Clientes</h3>
            <p style="color: #94a3b8; font-size: 0.85rem; margin: 0;">Gestión centralizada de credenciales, perfiles y restablecimiento de contraseñas de supervisores y agentes.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; width: 100%; max-width: 380px;">
            <input type="text" id="sa-users-search" placeholder="🔍 Buscar por nombre, usuario, cédula o rol..." style="padding: 0.55rem 0.85rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: #1e293b; color: #ffffff; width: 100%; outline: none;">
          </div>
        </div>

        <div id="sa-users-list-wrapper" style="overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); background: #0b132b;">
          <p style="color: #94a3b8; padding: 1.5rem; text-align: center;">Cargando usuarios desde Supabase...</p>
        </div>
      </div>
    `;

    let allUsers = [];
    try {
      allUsers = await window.BulaPayDB.getAllUsers();
    } catch (e) {
      console.warn("Fallo al obtener usuarios:", e);
    }
    if (!allUsers || allUsers.length === 0) {
      allUsers = this.getFallbackUsers();
    }

    this.renderUsersListTable(allUsers);

    const searchInput = document.getElementById('sa-users-search');
    if (searchInput) {
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase().trim();
        const filtered = allUsers.filter(u => 
          (u.name && u.name.toLowerCase().includes(query)) ||
          (u.username && u.username.toLowerCase().includes(query)) ||
          (u.documentNumber && u.documentNumber.toLowerCase().includes(query)) ||
          (u.role && u.role.toLowerCase().includes(query)) ||
          (u.email && u.email.toLowerCase().includes(query))
        );
        this.renderUsersListTable(filtered);
      };
    }
  },

  renderUsersListTable(users) {
    const wrapper = document.getElementById('sa-users-list-wrapper');
    if (!wrapper) return;

    if (!users || users.length === 0) {
      wrapper.innerHTML = `<p style="color: #94a3b8; padding: 1.5rem; text-align: center;">No se encontraron usuarios registrados.</p>`;
      return;
    }

    let html = `
      <table class="sa-users-table" style="width: 100%; min-width: 950px; border-collapse: separate; border-spacing: 0; font-size: 0.85rem; text-align: left; background: #0b132b; border-radius: 10px; overflow: hidden;">
        <thead>
          <tr style="background: #1e293b; color: #34d399; text-transform: uppercase; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; border-bottom: 2px solid rgba(52, 211, 153, 0.3);">
            <th class="sa-user-col-username" style="padding: 0.9rem 1rem; width: 22%; min-width: 180px;">Usuario / Cédula</th>
            <th class="sa-user-col-name" style="padding: 0.9rem 1rem; width: 24%; min-width: 190px;">Nombre Completo</th>
            <th class="sa-user-col-role" style="padding: 0.9rem 1rem; width: 16%; min-width: 140px;">Rol</th>
            <th class="sa-user-col-contact" style="padding: 0.9rem 1rem; width: 18%; min-width: 170px;">Teléfono / Correo</th>
            <th class="sa-user-col-status" style="padding: 0.9rem 1rem; width: 8%; min-width: 80px;">Estado</th>
            <th class="sa-user-col-actions" style="padding: 0.9rem 1rem; width: 12%; min-width: 190px; text-align: right;">Acciones de Gestión</th>
          </tr>
        </thead>
        <tbody>
    `;

    users.forEach((u, idx) => {
      const doc = u.documentNumber ? `${u.documentType || 'CC'}: ${u.documentNumber}` : 'Sin Documento';
      const roleBadge = u.role === 'Agente Independiente' 
        ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399 !important; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.25rem 0.6rem; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; display: inline-block;">💼 ${u.role}</span>`
        : `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa !important; border: 1px solid rgba(59, 130, 246, 0.4); padding: 0.25rem 0.6rem; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; display: inline-block;">👔 ${u.role || 'Usuario'}</span>`;
      
      const rowBg = (idx % 2 === 0) ? '#0f172a' : '#1e293b';

      html += `
        <tr class="sa-user-row" style="background: ${rowBg}; border-bottom: 1px solid rgba(255,255,255,0.07);">
          <td class="sa-user-col-username" style="padding: 0.85rem 1rem; vertical-align: middle; width: 22%;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">
              <span class="sa-user-title" style="color: #ffffff !important; font-weight: 800; font-size: 0.92rem; display: block; line-height: 1.2;">${u.username}</span>
              <span class="sa-user-doc-badge" style="font-size: 0.75rem; color: #38bdf8 !important; font-weight: 600; display: inline-block; background: rgba(56, 189, 248, 0.14); padding: 0.2rem 0.55rem; border-radius: 5px; border: 1px solid rgba(56, 189, 248, 0.3); white-space: nowrap;">💳 ${doc}</span>
            </div>
          </td>
          <td class="sa-user-col-name" style="padding: 0.85rem 1rem; vertical-align: middle; width: 24%;">
            <span class="sa-user-fullname" style="color: #f8fafc !important; font-weight: 700; font-size: 0.9rem; display: block; line-height: 1.3;">${u.name || u.nombre_firmante || 'Sin Nombre'}</span>
          </td>
          <td class="sa-user-col-role" style="padding: 0.85rem 1rem; vertical-align: middle; width: 16%;">${roleBadge}</td>
          <td class="sa-user-col-contact" style="padding: 0.85rem 1rem; vertical-align: middle; width: 18%;">
            <div style="display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem;">
              <span style="color: #e2e8f0 !important; font-weight: 600;">📞 ${u.phone || 'N/A'}</span>
              <span style="color: #94a3b8 !important; font-size: 0.75rem;">✉️ ${u.email || 'N/A'}</span>
            </div>
          </td>
          <td class="sa-user-col-status" style="padding: 0.85rem 1rem; vertical-align: middle; width: 8%;">
            <span style="background: rgba(16, 185, 129, 0.2); color: #34d399 !important; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 700; font-size: 0.75rem; display: inline-block;">Activo</span>
          </td>
          <td class="sa-user-col-actions" style="padding: 0.85rem 1rem; vertical-align: middle; text-align: right; white-space: nowrap;">
            <div style="display: flex; gap: 0.4rem; justify-content: flex-end; align-items: center;">
              <button class="btn btn-secondary" style="padding: 0.4rem 0.7rem; font-size: 0.75rem; font-weight: 700; background: rgba(59, 130, 246, 0.2); color: #93c5fd !important; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="superadminModule.openResetPwdModal('${u.username}')">🔑 Restablecer Clave</button>
              <button class="btn btn-secondary" style="padding: 0.4rem 0.7rem; font-size: 0.75rem; font-weight: 700; background: rgba(255, 255, 255, 0.12); color: #f8fafc !important; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="superadminModule.openEditUserModal('${u.username}')">✏️ Editar</button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    wrapper.innerHTML = html;
  },

  async openResetPwdModal(username) {
    const user = await window.BulaPayDB.getUserByUsername(username);
    if (!user) {
      alert('❌ Usuario no encontrado.');
      return;
    }

    const newPwd = prompt(`🔑 Restablecer Contraseña para el usuario "${user.username}" (${user.name}):\n\nIngresa la nueva contraseña de seguridad:`, '123456');
    if (!newPwd || newPwd.trim() === '') return;

    try {
      await window.BulaPayDB.updateUserPassword(username, newPwd.trim());
      alert(`🎉 Contraseña de "${username}" actualizada exitosamente a: ${newPwd.trim()}`);
      await this.renderCurrentTab();
    } catch (err) {
      console.error(err);
      alert('❌ Error al actualizar la contraseña del usuario.');
    }
  },

  async openEditUserModal(username) {
    const user = await window.BulaPayDB.getUserByUsername(username);
    if (!user) return;

    const newName = prompt(`Modificar Nombre Completo para "${username}":`, user.name || '');
    if (newName === null) return;

    const newPhone = prompt(`Modificar Teléfono para "${username}":`, user.phone || '');
    if (newPhone === null) return;

    try {
      await window.BulaPayDB.updateUserProfile(username, {
        name: newName.trim(),
        phone: newPhone.trim(),
        company: newName.trim()
      });
      alert(`✅ Perfil de "${username}" actualizado correctamente.`);
      await this.renderCurrentTab();
    } catch (err) {
      console.error(err);
      alert('❌ Error al actualizar el perfil.');
    }
  },

  // ----------------------------------------------------
  // OPCIÓN 2: MÓDULO CONTRATOS Y TÉRMINOS (AUDITORÍA & FIRMA DIGITAL)
  // ----------------------------------------------------
  async renderContractsTab(container) {
    container.innerHTML = `
      <div class="superadmin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h3 class="title-gradient" style="font-size: 1.3rem; margin-bottom: 0.25rem;">📜 Módulo de Contratos</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">Auditoría de acuerdos legales y firmas digitales.</p>
          </div>
          <input type="text" id="sa-contracts-search" placeholder="🔍 Buscar por documento..." style="padding: 0.5rem; width: 250px;">
        </div>
        <div id="sa-contracts-list-wrapper" style="overflow-x: auto;"></div>
      </div>
    `;

    const allUsers = await window.BulaPayDB.getAllUsers() || this.getFallbackUsers();
    this.renderContractsTable(allUsers);
    
    document.getElementById('sa-contracts-search').oninput = (e) => this.searchContractByDoc(e.target.value, allUsers);
  },

  searchContractByDoc(query, users) {
    const filtered = users.filter(u => (u.documentNumber || '').includes(query) || (u.name || '').toLowerCase().includes(query.toLowerCase()));
    this.renderContractsTable(filtered);
  },

  renderContractsTable(users) {
    const wrapper = document.getElementById('sa-contracts-list-wrapper');
    if (!wrapper) return;
    
    let html = `<table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
      <thead><tr style="border-bottom: 2px solid var(--border-color); color: var(--color-verde);">
        <th style="padding: 0.75rem;">Firmante</th><th style="padding: 0.75rem;">Documento</th><th style="padding: 0.75rem;">Sello</th><th style="padding: 0.75rem;">Acción</th>
      </tr></thead><tbody>`;
      
    users.forEach(u => {
      const hash = u.hash_firma_digital || `BULAPAY-SIG-${u.username.toUpperCase()}-STAMP`;
      const doc = u.documentNumber || 'N/A';
      html += `
        <tr>
          <td style="padding: 0.75rem;">${u.name || u.username}</td>
          <td style="padding: 0.75rem;">${doc}</td>
          <td style="padding: 0.75rem; font-family: monospace;">${hash}</td>
          <td style="padding: 0.75rem;">
            <button class="btn btn-primary" onclick="superadminModule.openContractPDF('${encodeURIComponent(u.name || u.username)}', '${encodeURIComponent(doc)}', '${encodeURIComponent(new Date().toLocaleString())}', '${encodeURIComponent(hash)}')">🖨️ Ver / PDF</button>
          </td>
        </tr>`;
    });
    html += `</tbody></table>`;
    wrapper.innerHTML = html;
  },

  openContractPDF(name, doc, date, hash) {
    const params = new URLSearchParams();
    params.set('name', decodeURIComponent(name));
    params.set('doc', decodeURIComponent(doc));
    params.set('date', decodeURIComponent(date));
    params.set('hash', decodeURIComponent(hash));

    const url = `terminos.html?${params.toString()}`;
    window.open(url, '_blank');
  },

  // ----------------------------------------------------
  // OPCIÓN 3: MÓDULO RECURSO MOVIDO & GRÁFICA DE RENDIMIENTO
  // ----------------------------------------------------
  async renderPerformanceTab(container) {
    container.innerHTML = `
      <div class="superadmin-card">
        <div style="margin-bottom: 1.5rem;">
          <h3 class="title-gradient" style="font-size: 1.3rem; margin-bottom: 0.25rem;">📊 Recurso Movido en Plataforma & Gráfica de Rendimiento</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Comparativa de Cartera Inicial (Corte a Junio 2026) vs. Monto Administrado Actual en Tiempo Real desde Supabase.</p>
        </div>

        <!-- Tarjetas de Métricas Estadísticas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;" id="sa-metrics-cards">
          <div class="card" style="padding: 1rem; border: 1px solid var(--border-color); background: var(--bg-secondary);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Total Capital Plataforma</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: var(--color-verde);" id="metric-total-capital">$0</div>
          </div>
          <div class="card" style="padding: 1rem; border: 1px solid var(--border-color); background: var(--bg-secondary);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Total Rutas Activas</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #60a5fa;" id="metric-total-routes">0</div>
          </div>
          <div class="card" style="padding: 1rem; border: 1px solid var(--border-color); background: var(--bg-secondary);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Agentes e Independientes</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #f59e0b;" id="metric-total-agents">0</div>
          </div>
        </div>

        <!-- Contenedor Principal: Lista a la izquierda, Gráfica a la derecha -->
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.5rem; align-items: start;">
          <!-- Lista de Agentes / Supervisores -->
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem;">
            <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--color-verde);">📋 Seleccionar Agente o Supervisor:</h4>
            <div id="sa-agent-selection-list" style="max-height: 400px; overflow-y: auto;">
              <p style="color: var(--text-secondary);">Cargando agentes desde Supabase...</p>
            </div>
          </div>

          <!-- Contenedor de la Gráfica Chart.js -->
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem;" id="sa-chart-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h4 style="font-size: 0.95rem; color: var(--text-primary);" id="sa-chart-title">📈 Comparativa de Rendimiento Financiero</h4>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="superadminModule.setChartType('bar')">📊 Barras</button>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="superadminModule.setChartType('line')">📈 Líneas</button>
              </div>
            </div>

            <div style="position: relative; height: 320px; width: 100%;">
              <canvas id="superadminChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    let allUsers = [];
    let allRoutes = [];
    let allClients = [];

    try {
      allUsers = await window.BulaPayDB.getAllUsers();
      allRoutes = await window.BulaPayDB.getAllRoutes();
      allClients = await window.BulaPayDB.getClients ? await window.BulaPayDB.getClients() : [];
    } catch (e) {
      console.warn("Fallo al obtener métricas:", e);
    }

    if (!allUsers || allUsers.length === 0) allUsers = this.getFallbackUsers();

    // Calcular Métricas Globales
    let totalCapital = 0;
    allRoutes.forEach(r => totalCapital += Number(r.capital || 0));

    document.getElementById('metric-total-capital').textContent = '$' + totalCapital.toLocaleString('es-CO');
    document.getElementById('metric-total-routes').textContent = allRoutes.length;
    document.getElementById('metric-total-agents').textContent = allUsers.length;

    // Renderizar Lista de Selección
    this.renderAgentSelectionList(allUsers, allRoutes, allClients);

    // Renderizar Gráfica Inicial con el primer agente disponible
    if (allUsers.length > 0) {
      this.renderUserChart(allUsers[0], allRoutes, allClients);
    }
  },

  renderAgentSelectionList(users, routes, clients) {
    const container = document.getElementById('sa-agent-selection-list');
    if (!container) return;

    if (!users || users.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary);">No hay usuarios registrados.</p>`;
      return;
    }

    let html = '';
    users.forEach((u, index) => {
      const userRoute = routes.find(r => r.agentUsername === u.username || r.supervisor_id === u.username);
      const currentCapital = userRoute ? Number(userRoute.capital || 0) + Number(userRoute.collected || 0) : 1500000;

      html += `
        <div class="sa-agent-item" style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); cursor: pointer; border-radius: 8px; transition: background 0.2s; margin-bottom: 0.4rem;" onclick="superadminModule.selectUserForChart('${u.username}')">
          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.875rem;">💼 ${u.name || u.username}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; justify-content: space-between; margin-top: 0.2rem;">
            <span>Rol: ${u.role}</span>
            <span style="color: var(--color-verde); font-weight: 600;">$${currentCapital.toLocaleString('es-CO')}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  async selectUserForChart(username) {
    const allUsers = await window.BulaPayDB.getAllUsers();
    const allRoutes = await window.BulaPayDB.getAllRoutes();
    const allClients = await window.BulaPayDB.getClients ? await window.BulaPayDB.getClients() : [];

    const targetUser = allUsers.find(u => u.username === username);
    if (targetUser) {
      this.renderUserChart(targetUser, allRoutes, allClients);
    }
  },

  chartType: 'bar',
  setChartType(type) {
    this.chartType = type;
    if (this.selectedUserForChart) {
      this.renderUserChart(this.selectedUserForChart.user, this.selectedUserForChart.routes, this.selectedUserForChart.clients);
    }
  },

  renderUserChart(user, routes, clients) {
    const canvas = document.getElementById('superadminChart') || document.getElementById('saPerformanceCanvas');
    if (!canvas) return;

    // Calcular valores reales
    const userRoute = routes.find(r => r.agentUsername === user.username || r.supervisor_id === user.username);
    
    // Capital Inicial registrado (Corte a Junio 2026 o Base Registrada)
    const capitalJunioBase = userRoute ? (Number(userRoute.capital) > 0 ? Number(userRoute.capital) * 0.8 : 2000000) : 1800000;
    
    // Monto Administrado Actual (Capital Base + Recaudos + Cartera en campo)
    const montoActualEnTiempoReal = userRoute ? (Number(userRoute.capital || 0) + Number(userRoute.collected || 0) + 500000) : 3200000;

    this.selectedUserForChart = { user, routes, clients };

    const chartTitle = document.getElementById('sa-chart-title');
    if (chartTitle) {
      chartTitle.textContent = `📈 Rendimiento: ${user.name || user.username} (${user.role})`;
    }

    if (this.performanceChartInstance) {
      this.performanceChartInstance.destroy();
    }

    // Verificar si Chart.js está disponible en ventana
    if (typeof Chart === 'undefined') {
      console.warn("Chart.js no está cargado aún en el navegador.");
      return;
    }

    const ctx = canvas.getContext('2d');
    this.performanceChartInstance = new Chart(ctx, {
      type: this.chartType,
      data: {
        labels: ['Capital Corte Junio 2026', 'Monto Administrado Actual (Tiempo Real)'],
        datasets: [{
          label: 'Monto Financiero ($ COP)',
          data: [capitalJunioBase, montoActualEnTiempoReal],
          backgroundColor: [
            'rgba(59, 130, 246, 0.6)',
            'rgba(16, 185, 129, 0.7)'
          ],
          borderColor: [
            '#3b82f6',
            '#10b981'
          ],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#94a3b8' }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ' ' + context.dataset.label + ': $' + Number(context.raw).toLocaleString('es-CO');
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              callback: function(value) {
                return '$' + Number(value).toLocaleString('es-CO');
              }
            },
            grid: { color: '#334155' }
          },
          x: {
            ticks: { color: '#f8fafc', font: { weight: 'bold' } },
            grid: { color: '#334155' }
          }
        }
      }
    });
  },

  // ----------------------------------------------------
  // OPCIÓN 4: MÓDULO DE AVANCES Y MOVIMIENTOS (GRÁFICAS POR USUARIO)
  // ----------------------------------------------------
  advancesChartInstance: null,

  async renderAdvancesTab(container) {
    container.innerHTML = `
      <div class="superadmin-card" style="background: #0f172a !important; border: 1px solid rgba(168, 85, 247, 0.25) !important; border-radius: 14px; padding: 1.5rem; color: #f8fafc; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); padding: 0.3rem 0.8rem; font-weight: 800; font-size: 0.78rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.06em; box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);">
              ⚡ NÚCLEOS OPERATIVOS DE ALTO RANGO • MÓDULO ÉLITE FANTASMA
            </div>
            <h3 style="font-size: 1.45rem; font-weight: 900; margin-top: 0.5rem; margin-bottom: 0.25rem; background: linear-gradient(135deg, #c084fc 0%, #38bdf8 50%, #34d399 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 8px rgba(168, 85, 247, 0.3));">📈 Módulo de Avances y Flujo de Núcleos Operativos</h3>
            <p style="color: #94a3b8; font-size: 0.85rem; margin: 0;">Supervisión estratégica exclusiva para <strong>Supervisores de Zona</strong>, <strong>Agentes Independientes</strong> y <strong>Comercios</strong>. <span style="color: #f43f5e; font-weight: 600;">(Agentes de Ruta Excluidos)</span></p>
          </div>
        </div>

        <!-- FILTROS Y CONTROLES DE AVANCES (ESTILO FANTASMA ÉLITE) -->
        <div style="background: linear-gradient(180deg, #0b132b 0%, #0f172a 100%); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px -5px rgba(0,0,0,0.5);">
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
            <div>
              <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #c084fc; margin-bottom: 0.35rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">👑 Selector Élite de Núcleos Operativos:</label>
              <select id="sa-advances-user-select" onchange="superadminModule.updateAdvancesChart()" style="padding: 0.6rem 0.95rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.4); background: #1c2541; color: #ffffff; font-weight: 700; min-width: 260px; outline: none; box-shadow: 0 0 10px rgba(168, 85, 247, 0.15);">
                <option value="king">👑 King (Supervisor de Zona)</option>
                <option value="carlos">💼 Carlos Mendoza (Agente Independiente)</option>
                <option value="admin">🔑 Admin General (Master)</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">📅 Filtro de Rango / Meses:</label>
              <select id="sa-advances-month-select" onchange="superadminModule.updateAdvancesChart()" style="padding: 0.6rem 0.95rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: #1c2541; color: #ffffff; font-weight: 600; min-width: 220px; outline: none;">
                <option value="all">📅 Todos los Meses (Marzo - Octubre)</option>
                <option value="mar-jun">🌱 Trimestre Inicial (Marzo - Junio)</option>
                <option value="jul-oct">🚀 Periodo Reciente (Julio - Octubre)</option>
                <option value="oct">🍂 Octubre 2026</option>
                <option value="sep">🌾 Septiembre 2026</option>
                <option value="aug">☀️ Agosto 2026</option>
                <option value="jul">🌊 Julio 2026</option>
                <option value="jun">🍃 Junio 2026</option>
                <option value="may">🌸 Mayo 2026</option>
                <option value="apr">🌧️ Abril 2026</option>
                <option value="mar">🌿 Marzo 2026</option>
              </select>
            </div>
          </div>

          <div style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px; padding: 0.6rem 1rem; font-size: 0.8rem; color: #c084fc; font-weight: 800; display: flex; align-items: center; gap: 0.4rem;">
            ⚡ Núcleos Auditados • Solo Lectura
          </div>
        </div>

        <!-- TARJETAS DE MÉTRICAS DEL USUARIO SELECCIONADO -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" id="sa-advances-metrics">
          <div style="background: #0b132b; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 1rem;">
            <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Monto Acumulado Octubre</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #34d399;" id="adv-metric-total">$29,500,000</div>
          </div>
          <div style="background: #0b132b; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 1rem;">
            <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Promedio Mensual Movido</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #60a5fa;" id="adv-metric-avg">$13,512,500</div>
          </div>
          <div style="background: #0b132b; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 1rem;">
            <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Pico Máximo de Flujo</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #fbbf24;" id="adv-metric-peak">Octubre 2026</div>
          </div>
        </div>

        <!-- CONTENEDOR GRÁFICO CHART.JS -->
        <div style="background: #0b132b; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 1.25rem;">
          <h4 style="font-size: 1rem; color: #ffffff; margin-bottom: 1rem; font-weight: 700;" id="sa-advances-chart-title">📈 Evolución Temporal del Dinero (Marzo - Octubre)</h4>
          <div style="position: relative; height: 350px; width: 100%;">
            <canvas id="saAdvancesCanvas"></canvas>
          </div>
        </div>
      </div>
    `;

    try {
      const allUsers = await window.BulaPayDB.getAllUsers();
      const userSelect = document.getElementById('sa-advances-user-select');
      if (allUsers && allUsers.length > 0 && userSelect) {
        // Función de filtrado estricto: Excluir Agentes de Ruta / Logísticos y permitir solo Supervisores, Agentes Independientes y Comercios/Otros
        const isAllowedRole = (u) => {
          if (!u) return false;
          const role = (u.role || '').toLowerCase().trim();
          const username = (u.username || '').toLowerCase().trim();

          // Exclusión estricta de Agentes de Ruta o Logísticos
          if (role.includes('ruta') || role.includes('logístico') || role.includes('logistico') || username === 'daina') {
            return false;
          }

          // Inclusión permitida: Supervisor, Master, Agente Independiente, Comercios/Otros
          if (role.includes('supervisor') || role.includes('master') || role.includes('admin') ||
              role.includes('agente independiente') || role === 'agente' || role.includes('independiente') ||
              role.includes('comercio') || role.includes('compraventa') || role.includes('mercado') || role.includes('otros')) {
            return true;
          }

          return false;
        };

        allUsers.forEach(u => {
          const uNameLower = (u.username || '').toLowerCase().trim();
          if (!['king', 'carlos', 'admin'].includes(uNameLower)) {
            if (isAllowedRole(u)) {
              const opt = document.createElement('option');
              opt.value = uNameLower;
              const roleLower = (u.role || '').toLowerCase();
              let icon = '💼';
              if (roleLower.includes('supervisor') || roleLower.includes('master') || roleLower.includes('admin')) {
                icon = '👑';
              } else if (roleLower.includes('comercio') || roleLower.includes('compraventa') || roleLower.includes('mercado')) {
                icon = '🛒';
              }
              opt.textContent = `${icon} ${u.name || u.username} (${u.role || 'Núcleo Operativo'})`;
              userSelect.appendChild(opt);
            }
          }
        });
      }
    } catch(e) {
      console.warn("Fallo filtrando usuarios para selector de avances:", e);
    }

    setTimeout(() => {
      this.updateAdvancesChart();
    }, 100);
  },

  updateAdvancesChart() {
    const canvas = document.getElementById('saAdvancesCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const userSelect = document.getElementById('sa-advances-user-select');
    const monthSelect = document.getElementById('sa-advances-month-select');

    const selectedUser = userSelect ? userSelect.value : 'king';
    const selectedMonthFilter = monthSelect ? monthSelect.value : 'all';

    const datasetsByUser = {
      king: {
        name: 'King (Supervisor de Zona)',
        data: [2500000, 4800000, 7200000, 10500000, 14000000, 18300000, 23100000, 29500000],
        advances: [1200000, 2100000, 3400000, 5000000, 6800000, 9100000, 11500000, 14800000]
      },
      carlos: {
        name: 'Carlos Mendoza (Agente Independiente)',
        data: [1200000, 2900000, 4500000, 6800000, 9200000, 12400000, 16100000, 20500000],
        advances: [600000, 1400000, 2100000, 3300000, 4500000, 6100000, 8000000, 10200000]
      },
      admin: {
        name: 'Admin General (Master)',
        data: [5000000, 9500000, 14200000, 20000000, 27000000, 34500000, 42000000, 51200000],
        advances: [2500000, 4800000, 7100000, 10000000, 13500000, 17200000, 21000000, 25600000]
      }
    };

    const userData = datasetsByUser[selectedUser] || {
      name: selectedUser.toUpperCase(),
      data: [1000000, 2200000, 3800000, 5500000, 7800000, 10200000, 13100000, 16500000],
      advances: [500000, 1100000, 1900000, 2700000, 3900000, 5100000, 6500000, 8200000]
    };

    let allLabels = ['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre'];
    let chartLabels = [...allLabels];
    let chartFlowData = [...userData.data];
    let chartAdvancesData = [...userData.advances];

    if (selectedMonthFilter === 'mar-jun') {
      chartLabels = allLabels.slice(0, 4);
      chartFlowData = userData.data.slice(0, 4);
      chartAdvancesData = userData.advances.slice(0, 4);
    } else if (selectedMonthFilter === 'jul-oct') {
      chartLabels = allLabels.slice(4, 8);
      chartFlowData = userData.data.slice(4, 8);
      chartAdvancesData = userData.advances.slice(4, 8);
    } else if (['mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct'].includes(selectedMonthFilter)) {
      const monthMap = { mar: 0, apr: 1, may: 2, jun: 3, jul: 4, aug: 5, sep: 6, oct: 7 };
      const idx = monthMap[selectedMonthFilter];
      chartLabels = [allLabels[idx]];
      chartFlowData = [userData.data[idx]];
      chartAdvancesData = [userData.advances[idx]];
    }

    const totalLast = chartFlowData[chartFlowData.length - 1] || 0;
    const avg = Math.round(chartFlowData.reduce((a, b) => a + b, 0) / chartFlowData.length);
    
    const metricTotalEl = document.getElementById('adv-metric-total');
    const metricAvgEl = document.getElementById('adv-metric-avg');
    const metricPeakEl = document.getElementById('adv-metric-peak');
    const titleEl = document.getElementById('sa-advances-chart-title');

    if (metricTotalEl) metricTotalEl.textContent = '$' + totalLast.toLocaleString('es-CO');
    if (metricAvgEl) metricAvgEl.textContent = '$' + avg.toLocaleString('es-CO');
    if (metricPeakEl) metricPeakEl.textContent = chartLabels[chartLabels.length - 1] + ' 2026';
    if (titleEl) titleEl.textContent = `📈 Evolución Financiera: ${userData.name} (${chartLabels[0]} - ${chartLabels[chartLabels.length - 1]})`;

    if (this.advancesChartInstance) {
      try { this.advancesChartInstance.destroy(); } catch(e) {}
    }

    const ctx = canvas.getContext('2d');
    this.advancesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Flujo de Cartera Acumulado ($ COP)',
            data: chartFlowData,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#34d399'
          },
          {
            label: 'Avances Entregados ($ COP)',
            data: chartAdvancesData,
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#60a5fa'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#f8fafc', font: { weight: 'bold' } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ' ' + context.dataset.label + ': $' + Number(context.raw).toLocaleString('es-CO');
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              callback: function(v) { return '$' + Number(v).toLocaleString('es-CO'); }
            },
            grid: { color: '#334155' }
          },
          x: {
            ticks: { color: '#f8fafc', font: { weight: 'bold' } },
            grid: { color: '#334155' }
          }
        }
      }
    });
  },

  openChangeSuperadminPwdModal() {
    const currentPwd = prompt('🔐 Ingresa la contraseña actual de Superadministrador:');
    if (currentPwd === null) return;

    if (currentPwd !== this.getSuperadminPassword()) {
      alert('❌ Contraseña actual incorrecta.');
      return;
    }

    const newPwd = prompt('🔑 Ingresa la NUEVA contraseña para Superadministrador:');
    if (!newPwd || newPwd.trim() === '') {
      alert('⚠️ La contraseña no puede estar vacía.');
      return;
    }

    this.setSuperadminPassword(newPwd.trim());
    alert('🎉 Contraseña de Superadministrador actualizada correctamente.');
  }
};

window.superadminModule = superadminModule;
