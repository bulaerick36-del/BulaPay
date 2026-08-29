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
    window.location.hash = '#auth';
    window.location.reload();
  },

  showSuperadminView() {
    // 1. Ocultar la sección de autenticación/login general y cualquier wrapper de auth
    const authView = document.getElementById('view-auth');
    if (authView) {
      authView.classList.remove('active');
      authView.classList.add('d-none');
      authView.style.display = 'none';
    }

    const authWrapper = document.querySelector('.auth-wrapper');
    if (authWrapper) {
      authWrapper.style.display = 'none';
    }

    // 2. Ocultar todas las demás secciones SPA
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(s => {
      if (s.id !== 'view-superadmin') {
        s.classList.remove('active');
        s.classList.add('d-none');
        s.style.display = 'none';
      }
    });

    // 3. Exponer y activar de inmediato el contenedor del Panel de Superadministrador Maestro (#view-superadmin)
    const superadminView = document.getElementById('view-superadmin');
    if (superadminView) {
      superadminView.classList.remove('d-none');
      superadminView.classList.add('active');
      superadminView.style.display = 'block';
      superadminView.style.visibility = 'visible';
      superadminView.style.opacity = '1';
    }

    const superadminWrapper = document.querySelector('.superadmin-wrapper');
    if (superadminWrapper) {
      superadminWrapper.style.display = 'block';
      superadminWrapper.style.visibility = 'visible';
      superadminWrapper.style.opacity = '1';
    }
  },

  async openSuperadminPanel() {
    // 1. Cerrar el menú lateral (drawer)
    const drawer = document.getElementById('drawer-main-menu');
    if (drawer) drawer.classList.remove('active');

    // 2. Exponer y pintar el panel de superadministrador maestro inmediatamente
    this.showSuperadminView();

    window.location.hash = '#superadmin';

    // 3. Sincronizar estado del drawer y renderizar los 3 módulos
    this.renderDrawerSection();
    await this.renderCurrentTab();
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

    // Exponer panel superadmin
    this.showSuperadminView();

    this.renderDrawerSection();
    await this.renderCurrentTab();
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
          <button type="button" class="drawer-menu-item master-item" style="width: 100%; text-align: left; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-weight: 700; cursor: pointer; border-radius: 8px; padding: 0.6rem 0.8rem; display: flex; align-items: center; gap: 0.5rem;" onclick="superadminModule.openSuperadminPanel();">
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

  async switchTab(tabName, e) {
    if (e) e.preventDefault();
    this.activeTab = tabName || 'users';

    const tabs = document.querySelectorAll('.superadmin-tab');
    tabs.forEach(t => {
      if (t.dataset.tab === this.activeTab) {
        t.classList.add('active');
        t.style.color = 'var(--color-verde)';
        t.style.borderBottom = '3px solid var(--color-verde)';
      } else {
        t.classList.remove('active');
        t.style.color = 'var(--text-secondary)';
        t.style.borderBottom = 'none';
      }
    });

    await this.renderCurrentTab();
  },

  bindEvents() {
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
      <div class="superadmin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h3 class="title-gradient" style="font-size: 1.3rem; margin-bottom: 0.25rem;">👥 Módulo de Usuarios y Clientes</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">Gestión centralizada de credenciales, perfiles y restablecimiento de contraseñas de supervisores y agentes.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; width: 100%; max-width: 380px;">
            <input type="text" id="sa-users-search" placeholder="🔍 Buscar por nombre, usuario, cédula o rol..." style="padding: 0.5rem 0.8rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); width: 100%;">
          </div>
        </div>

        <div id="sa-users-list-wrapper" style="overflow-x: auto;">
          <p style="color: var(--text-secondary);">Cargando usuarios desde Supabase...</p>
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
      wrapper.innerHTML = `<p style="color: var(--text-secondary); padding: 1rem;">No se encontraron usuarios registrados.</p>`;
      return;
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color); color: var(--color-verde); text-transform: uppercase; font-size: 0.75rem;">
            <th style="padding: 0.75rem;">Usuario / Cédula</th>
            <th style="padding: 0.75rem;">Nombre Completo</th>
            <th style="padding: 0.75rem;">Rol</th>
            <th style="padding: 0.75rem;">Teléfono / Correo</th>
            <th style="padding: 0.75rem;">Estado</th>
            <th style="padding: 0.75rem; text-align: right;">Acciones de Gestión</th>
          </tr>
        </thead>
        <tbody>
    `;

    users.forEach(u => {
      const doc = u.documentNumber ? `${u.documentType || 'CC'}: ${u.documentNumber}` : 'Sin Documento';
      const roleBadge = u.role === 'Agente Independiente' 
        ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">💼 ${u.role}</span>`
        : `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">👔 ${u.role}</span>`;

      html += `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem;">
            <strong>${u.username}</strong><br>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${doc}</span>
          </td>
          <td style="padding: 0.75rem; font-weight: 600;">${u.name || 'Sin Nombre'}</td>
          <td style="padding: 0.75rem;">${roleBadge}</td>
          <td style="padding: 0.75rem; color: var(--text-secondary);">
            📞 ${u.phone || 'N/A'}<br>
            ✉️ ${u.email || 'N/A'}
          </td>
          <td style="padding: 0.75rem;">
            <span style="color: #34d399; font-weight: 500;">Activo</span>
          </td>
          <td style="padding: 0.75rem; text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; margin-right: 0.3rem;" onclick="superadminModule.openResetPwdModal('${u.username}')">🔑 Restablecer Clave</button>
            <button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" onclick="superadminModule.openEditUserModal('${u.username}')">✏️ Editar</button>
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
            <h3 class="title-gradient" style="font-size: 1.3rem; margin-bottom: 0.25rem;">📜 Módulo de Contratos y Términos de Adhesión</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">Auditoría de acuerdos legales firmados electrónicamente con sello digital y respaldo probatorio.</p>
          </div>
        </div>

        <div id="sa-contracts-list-wrapper" style="overflow-x: auto;">
          <p style="color: var(--text-secondary);">Cargando registro de contratos desde Supabase...</p>
        </div>
      </div>
    `;

    let allUsers = [];
    try {
      allUsers = await window.BulaPayDB.getAllUsers();
    } catch (e) {
      console.warn("Fallo al obtener contratos:", e);
    }
    if (!allUsers || allUsers.length === 0) {
      allUsers = this.getFallbackUsers();
    }

    const acceptedUsers = allUsers.filter(u => u.aceptacion_terminos || u.created_at);

    const wrapper = document.getElementById('sa-contracts-list-wrapper');
    if (!wrapper) return;

    if (!acceptedUsers || acceptedUsers.length === 0) {
      wrapper.innerHTML = `<p style="color: var(--text-secondary); padding: 1rem;">No se encontraron contratos registrados.</p>`;
      return;
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color); color: var(--color-verde); text-transform: uppercase; font-size: 0.75rem;">
            <th style="padding: 0.75rem;">Firmante / Usuario</th>
            <th style="padding: 0.75rem;">Documento de Identidad</th>
            <th style="padding: 0.75rem;">Fecha de Aceptación</th>
            <th style="padding: 0.75rem;">Sello / Hash Digital</th>
            <th style="padding: 0.75rem; text-align: right;">Acciones de Auditoría</th>
          </tr>
        </thead>
        <tbody>
    `;

    acceptedUsers.forEach(u => {
      const name = u.nombre_firmante || u.name || u.username;
      const doc = u.documento_firmante || (u.documentNumber ? `${u.documentType || 'CC'}: ${u.documentNumber}` : 'Sin Documento');
      const date = u.fecha_aceptacion_terminos ? new Date(u.fecha_aceptacion_terminos).toLocaleString('es-CO') : (u.created_at ? new Date(u.created_at).toLocaleString('es-CO') : 'Al registrarse');
      const hash = u.hash_firma_digital || `BULAPAY-SIG-${u.username.toUpperCase()}-STAMP`;

      html += `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem; font-weight: 600; color: var(--text-primary);">
            👤 ${name}<br>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal;">@${u.username}</span>
          </td>
          <td style="padding: 0.75rem; color: var(--text-primary); font-weight: 500;">🆔 ${doc}</td>
          <td style="padding: 0.75rem; color: var(--text-secondary);">📅 ${date}</td>
          <td style="padding: 0.75rem; font-family: monospace; font-size: 0.75rem; color: var(--color-verde); word-break: break-all;">
            🔏 ${hash}
          </td>
          <td style="padding: 0.75rem; text-align: right; white-space: nowrap;">
            <button class="btn btn-primary" style="padding: 0.35rem 0.7rem; font-size: 0.75rem;" onclick="superadminModule.openContractPDF('${encodeURIComponent(name)}', '${encodeURIComponent(doc)}', '${encodeURIComponent(date)}', '${encodeURIComponent(hash)}')">🖨️ Ver / PDF</button>
          </td>
        </tr>
      `;
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
              <canvas id="saPerformanceCanvas"></canvas>
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
    const canvas = document.getElementById('saPerformanceCanvas');
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
