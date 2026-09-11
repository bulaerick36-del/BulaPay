// Módulo de Autenticación y Sesiones de BulaPay

const authModule = {
  initialized: false,
  isProfileModalOpen: false,

  init() {
    const authWrapper = document.querySelector('.auth-wrapper');
    if (authWrapper) {
      const isSuperadminUrl = window.location.hash === '#superadmin' || (window.superadminModule && window.superadminModule.isLoggedIn() && window.location.hash === '#superadmin');
      
      if (isSuperadminUrl) {
        authWrapper.style.setProperty('display', 'none', 'important');
      } else {
        authWrapper.style.display = 'block';
      }
    }

    if (this.initialized) {
      this.checkCurrentSession();
      return;
    }
    this.formLogin = document.getElementById('form-login');
    this.formRegister = document.getElementById('form-register');
    this.formAgentLogin = document.getElementById('form-agent-login');
    
    this.tabLogin = document.getElementById('tab-login');
    this.tabRegister = document.getElementById('tab-register');
    this.authSwitchText = document.getElementById('auth-switch-text');
    this.authLinkRegister = document.getElementById('auth-link-register');
    
    this.userNavInfo = document.getElementById('user-nav-info');
    this.navUserName = document.getElementById('nav-user-name');
    this.navUserRole = document.getElementById('nav-user-role');
    this.btnLogout = document.getElementById('btn-logout');

    this.linkTerms = document.getElementById('link-terms-conditions');
    this.modalTerms = document.getElementById('terms-modal');
    this.btnCloseTerms = document.getElementById('btn-close-terms');

    this.bindEvents();
    this.initialized = true;
    this.checkCurrentSession();
  },

  bindEvents() {
    // Alternancia de Pestañas (Iniciar Sesión / Registrarse)
    this.tabLogin.addEventListener('click', () => this.switchTab('login'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));
    
    if (this.authLinkRegister) {
      this.authLinkRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab('register');
      });
    }

    // Listener dinámico para inyectar nombre y documento en el enlace de Términos y Condiciones
    const regNameInput = document.getElementById('register-name');
    const regDocTypeSelect = document.getElementById('register-doc-type');
    const regDocNumInput = document.getElementById('register-doc-num');

    const updateTermsParams = () => {
      const nameVal = regNameInput ? regNameInput.value.trim() : '';
      const docTypeVal = regDocTypeSelect ? regDocTypeSelect.value : 'CC';
      const docNumVal = regDocNumInput ? regDocNumInput.value.trim() : '';
      
      if (this.linkTerms) {
        const params = new URLSearchParams();
        if (nameVal) params.set('name', nameVal);
        if (docTypeVal) params.set('docType', docTypeVal);
        if (docNumVal) params.set('docNum', docNumVal);
        const q = params.toString();
        this.linkTerms.href = q ? `terminos.html?${q}` : 'terminos.html';
      }

      const modalName = document.getElementById('modal-sig-name');
      const modalDoc = document.getElementById('modal-sig-doc');
      if (modalName) modalName.textContent = nameVal ? nameVal.toUpperCase() : '[Capturado en formulario]';
      if (modalDoc) modalDoc.textContent = docNumVal ? `${docTypeVal}: ${docNumVal}` : '[Capturado en formulario]';
    };

    if (regNameInput) regNameInput.addEventListener('input', updateTermsParams);
    if (regDocTypeSelect) regDocTypeSelect.addEventListener('change', updateTermsParams);
    if (regDocNumInput) regDocNumInput.addEventListener('input', updateTermsParams);

    // Abrir Términos y Condiciones en nueva pestaña (abrir terminos.html de forma nativa con query params)
    if (this.linkTerms) {
      this.linkTerms.addEventListener('click', () => {
        updateTermsParams();
      });
    }

    // Cerrar Modal de Términos y Condiciones
    if (this.btnCloseTerms) {
      this.btnCloseTerms.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.modalTerms) {
          this.modalTerms.classList.remove('active');
        }
      });
    }

    // Submit Iniciar Sesión
    this.formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('login-username').value.trim();
      const passwordInput = document.getElementById('login-password').value;

      if ((usernameInput === '1121338578' || usernameInput === 'admin' || usernameInput === 'erick26') && window.superadminModule) {
        if (window.superadminModule.login(usernameInput, passwordInput)) {
          alert('🔑 Acceso concedido al Panel de Superadministrador Maestro.');
          await window.superadminModule.openSuperadminPanel();
          return;
        }
      }

      try {
        const user = await window.BulaPayDB.getUserByUsername(usernameInput);

        if (user && user.bloqueado_por_mora === true) {
          alert('⛔ ACCESO SUSPENDIDO POR MORA / IMPAGO\n\nEstimado usuario, su cuenta ha sido suspendida temporalmente por impago. Por favor comuníquese con el Administrador para regularizar su suscripción.');
          return;
        }

        if (user && String(user.password).trim() === String(passwordInput).trim()) {
          this.loginUser(user);
        } else if ((usernameInput === '1121338578' || usernameInput === 'admin' || usernameInput === 'erick26') && window.superadminModule) {
          if (window.superadminModule.login('1121338578', passwordInput)) {
            alert('🔑 Acceso concedido al Panel de Superadministrador Maestro.');
            await window.superadminModule.openSuperadminPanel();
            return;
          } else {
            alert('❌ Credenciales inválidas. Por favor intente nuevamente.');
          }
        } else {
          alert('❌ Credenciales inválidas. Por favor intente nuevamente.');
        }
      } catch (err) {
        console.error("Error de inicio de sesión:", err);
        alert('❌ Error al iniciar sesión. Por favor intente nuevamente.');
      }
    });

    // Submit Iniciar Sesión Agente
    if (this.formAgentLogin) {
      this.formAgentLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('agent-login-username').value.trim();
        const passwordInput = document.getElementById('agent-login-password').value;

        try {
          const user = await window.BulaPayDB.getUserByUsername(usernameInput);

          if (user && user.bloqueado_por_mora === true) {
            alert('⛔ ACCESO SUSPENDIDO POR MORA / IMPAGO\n\nEstimado usuario, su cuenta ha sido suspendida temporalmente por impago. Por favor comuníquese con el Administrador para regularizar su suscripción.');
            return;
          }

          if (user && String(user.password).trim() === String(passwordInput).trim() && (user.role === 'Agente de Ruta' || user.role === 'agent' || user.role === 'Agente Independiente')) {
            this.loginUser(user);
          } else if (user && String(user.password).trim() === String(passwordInput).trim()) {
            alert('❌ Acceso denegado. Este portal es exclusivo para Agentes.');
          } else {
            alert('❌ Credenciales inválidas. Por favor intente nuevamente.');
          }
        } catch (err) {
          console.error("Error de inicio de sesión agente:", err);
          alert('❌ Error al iniciar sesión del agente.');
        }
      });
    }

    // Submit Registrarse
    this.formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const registerTypeElem = document.getElementById('register-type');
      let selectedType = (registerTypeElem && registerTypeElem.value) ? registerTypeElem.value.trim() : 'Usuario Supervisor';
      const email = document.getElementById('register-email').value.trim();
      const username = document.getElementById('register-username').value.trim().toLowerCase();
      const password = document.getElementById('register-password').value;
      const legalChecked = document.getElementById('register-legal').checked;

      if (!legalChecked) {
        alert('⚠️ Debe aceptar los Términos y Condiciones para registrarse.');
        return;
      }

      const docNum = document.getElementById('register-doc-num').value.trim();
      // Si se registra erick26 o cédula 1121338578, asignar rol Supervisor por defecto
      if (username === 'erick26' || docNum === '1121338578') {
        selectedType = 'Usuario Supervisor';
      }

      try {
        // Validar si el usuario ya existe
        const existingUser = await window.BulaPayDB.getUserByUsername(username);
        if (existingUser) {
          alert('❌ Este nombre de usuario ya está registrado en BulaPay.');
          return;
        }

        const name = document.getElementById('register-name').value.trim();
        const company = name;
        const docType = document.getElementById('register-doc-type').value;
        const phone = document.getElementById('register-phone') ? document.getElementById('register-phone').value.trim() : '';
        const representanteLegal = null;
        const cedulaRepresentante = null;

        const acceptationTimestamp = new Date().toISOString();
        const docFormatted = `${docType}: ${docNum}`;
        const signatureHash = 'BULAPAY-SIG-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now();

        const newUser = {
          username,
          password,
          name,
          role: selectedType,
          company,
          phone,
          email,
          documentType: docType,
          documentNumber: docNum,
          estado_suscripcion: 'activa_prueba',
          routeId: null,
          supervisor_id: username,
          representante_legal: representanteLegal,
          cedula_representante: cedulaRepresentante,
          aceptacion_terminos: true,
          fecha_aceptacion_terminos: acceptationTimestamp,
          version_terminos: '1.0',
          nombre_firmante: name,
          documento_firmante: docFormatted,
          tipo_documento_firmante: docType,
          hash_firma_digital: signatureHash
        };

        // Guardar usuario en base de datos sin generar rutas fantasmas
        await window.BulaPayDB.saveUser(newUser);
        alert('🎉 Registro exitoso. ¡Bienvenido a BulaPay!');
        this.loginUser(newUser);
      } catch (err) {
        console.error(err);
        alert('❌ Error al registrar usuario.');
      }
    });

    // Cerrar Sesión
    this.btnLogout.addEventListener('click', () => {
      window.BulaPayDB.logout();
      
      // Limpiar datos temporales de la sesión
      localStorage.removeItem('bulaRole');
      
      // Forzar recarga completa de la página para limpiar TODO el estado del DOM (inputs, variables en memoria)
      window.location.hash = '';
      window.location.reload();
    });

    // Listener de Tipo de Cuenta en Registro
    const registerTypeSelect = document.getElementById('register-type');
    if (registerTypeSelect) {
      registerTypeSelect.addEventListener('change', () => this.handleRegisterTypeChange());
    }

    // Triggers de Perfil de Usuario
    const supTrigger = document.getElementById('supervisor-profile-trigger');
    if (supTrigger) {
      supTrigger.addEventListener('click', () => this.openUserProfileModal());
    }
    const agentTrigger = document.getElementById('agent-profile-trigger');
    if (agentTrigger) {
      agentTrigger.addEventListener('click', () => this.openUserProfileModal());
    }
  },

  switchTab(tab) {
    if (tab === 'login') {
      this.tabLogin.classList.add('active');
      this.tabRegister.classList.remove('active');
      this.formLogin.style.display = 'block';
      this.formRegister.style.display = 'none';
      if (this.authSwitchText) {
        this.authSwitchText.innerHTML = `¿No tienes cuenta? <a href="#" id="auth-link-register">Regístrate gratis</a>`;
        // Re-enlazar evento
        document.getElementById('auth-link-register').addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab('register');
        });
      }
    } else {
      this.tabRegister.classList.add('active');
      this.tabLogin.classList.remove('active');
      this.formRegister.style.display = 'block';
      this.formLogin.style.display = 'none';
      if (this.authSwitchText) {
        this.authSwitchText.innerHTML = `¿Ya tienes una cuenta? <a href="#" id="auth-link-login">Inicia Sesión</a>`;
        document.getElementById('auth-link-login').addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab('login');
        });
      }
    }
  },

  handleRegisterTypeChange() {
    const registerTypeElem = document.getElementById('register-type');
    const type = registerTypeElem ? registerTypeElem.value : 'Agente Independiente';
    const stdFields = document.getElementById('register-fields-standard');
    const otherFields = document.getElementById('register-fields-others');
    
    if (!stdFields || !otherFields) return;
    
    const stdInputs = stdFields.querySelectorAll('input, select');
    const otherInputs = otherFields.querySelectorAll('input');

    stdFields.style.display = 'block';
    otherFields.style.display = 'none';
    
    stdInputs.forEach(i => i.setAttribute('required', ''));
    otherInputs.forEach(i => i.removeAttribute('required'));
  },

  async loginUser(user) {
    window.BulaPayDB.setCurrentUser(user);
    this.updateNavBar(user);

    const role = String(user.role || '').trim();
    const roleLower = role.toLowerCase();
    const username = String(user.username || '').trim().toLowerCase();
    const docNum = String(user.documentNumber || '').trim();

    const isMaster = username === '1121338578' || docNum === '1121338578' || username === 'admin' || username === 'erick26';
    const isSupervisorOrAdmin = isMaster || 
      roleLower.includes('supervisor') || 
      roleLower.includes('admin') || 
      roleLower.includes('administrador') || 
      role === 'Usuario Supervisor' || 
      role === 'Supervisor' || 
      role === 'Administrador' || 
      role === 'Administrador de Rutas' || 
      role === 'Superadministrador' || 
      role === 'Superadmin';

    const isCommerce = role === 'Otros (Comercios, Compraventas, Mercados)' || role === 'Comercio Independiente' || roleLower.includes('comercio');

    // Sincronizar el rol del usuario con el tema de colores dinámico
    let targetThemeRole = 'supervisor';
    if (isSupervisorOrAdmin) {
      targetThemeRole = 'supervisor';
    } else if (role === 'Agente de Ruta' || role === 'agent') {
      targetThemeRole = 'route';
    } else if (role === 'Agente Independiente') {
      targetThemeRole = 'independent';
    } else if (isCommerce) {
      targetThemeRole = 'commerce';
    }
    localStorage.setItem('bulaRole', targetThemeRole);
    if (typeof window.applyDynamicTheme === 'function') {
      window.applyDynamicTheme();
    }

    // Redirigir según el rol del usuario:
    // 1. Supervisor / Administrador / Cédula Maestra -> ÚNICA Y ESTRICTAMENTE al Panel de Superadministrador Maestro
    if (isSupervisorOrAdmin) {
      sessionStorage.setItem('bula_superadmin_active', 'true');
      if (window.superadminModule && typeof window.superadminModule.openSuperadminPanel === 'function') {
        await window.superadminModule.openSuperadminPanel();
      } else if (window.app && window.app.router) {
        window.app.router.navigate('superadmin');
      }
    } else if (isCommerce) {
      if (window.app && window.app.router) {
        window.app.router.navigate('supervisor');
      }
    } else {
      // 2. Agente Independiente / Agente de Ruta -> Terminal de Cobro Agente
      if (window.app && window.app.router) {
        window.app.router.navigate('agent');
      }
    }

    // Evaluación automática e interna de notificaciones de cobro privadas para este usuario
    if (window.BulaPayDB && typeof window.BulaPayDB.evaluateUserCobroNotifications === 'function') {
      window.BulaPayDB.evaluateUserCobroNotifications(user).then(() => {
        if (window.adsModule && typeof window.adsModule.updateComunicadosBadge === 'function') {
          window.adsModule.updateComunicadosBadge();
        }
      });
    }
  },

  updateNavBar(user) {
    if (user) {
      if (this.navUserName) this.navUserName.textContent = user.name;
      if (this.navUserRole) this.navUserRole.textContent = user.role;
      if (this.userNavInfo) {
        this.userNavInfo.style.display = 'flex';
        let badge = document.getElementById('nav-user-vigencia-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.id = 'nav-user-vigencia-badge';
          badge.style.cssText = "font-size: 0.76rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.3rem;";
          this.userNavInfo.insertBefore(badge, this.userNavInfo.firstChild);
        }
        if (window.BulaPayDB && typeof window.BulaPayDB.getDiasRestantes === 'function') {
          const info = window.BulaPayDB.getDiasRestantes(user);
          badge.textContent = `⏳ Vigencia: Faltan ${info.dias} días`;
          badge.style.color = info.dias <= 5 ? '#fca5a5' : '#38bdf8';
          badge.style.background = info.dias <= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)';
          badge.style.border = info.dias <= 5 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(56, 189, 248, 0.35)';
          badge.title = `Fecha de Corte: ${info.fechaCorteStr}`;
        }
      }
    } else {
      if (this.userNavInfo) this.userNavInfo.style.display = 'none';
    }
  },

  checkCurrentSession() {
    const user = window.BulaPayDB.getCurrentUser();
    if (user && user.bloqueado_por_mora === true) {
      alert('⛔ ACCESO SUSPENDIDO POR MORA / IMPAGO\n\nSu cuenta se encuentra suspendida. La sesión se cerrará automáticamente.');
      this.logout();
      return;
    }
    if (user) {
      this.updateNavBar(user);
      if (window.BulaPayDB && typeof window.BulaPayDB.evaluateUserCobroNotifications === 'function') {
        window.BulaPayDB.evaluateUserCobroNotifications(user).then(() => {
          if (window.adsModule && typeof window.adsModule.updateComunicadosBadge === 'function') {
            window.adsModule.updateComunicadosBadge();
          }
        });
      }
    } else {
      this.userNavInfo.style.display = 'none';
    }

    // Sincronizar visibilidad de enlaces rápidos condicionalmente (Ocultar si hay sesión iniciada)
    const devLinks = document.getElementById('demo-quick-links');
    if (devLinks) {
      if (user) {
        devLinks.style.display = 'none';
      } else {
        devLinks.style.display = 'flex';
      }
    }
  },

  // Modal de perfil de usuario con fetch en tiempo real
  async openUserProfileModal() {
    const modal = document.getElementById('modal-user-profile');
    if (!modal) return;

    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) return;

    // Sincronizar estado de apertura
    this.isProfileModalOpen = true;

    // Mostrar el modal inmediatamente con los datos locales mientras carga
    this.populateProfileFields(currentUser);
    modal.classList.add('active');

    try {
      // Fetch rápido a la base de datos Supabase
      const freshUser = await window.BulaPayDB.getUserByUsername(currentUser.username);
      if (freshUser) {
        this.populateProfileFields(freshUser);
      }
    } catch (e) {
      console.warn("Fallo al traer datos en tiempo real de Supabase, usando sesión en memoria:", e);
    }
  },

  populateProfileFields(user) {
    const fields = {
      'profile-input-name': user.name || '',
      'profile-input-doc': user.documentNumber || user.cedula || '',
      'profile-input-phone': user.phone || '',
      'profile-input-email': user.email || '',
      'profile-input-role': user.role || ''
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
  },

  async handleUserProfileUpdate(event) {
    if (event) event.preventDefault();

    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) return;

    const nameVal = document.getElementById('profile-input-name').value.trim();
    const docVal = document.getElementById('profile-input-doc').value.trim();
    const phoneVal = document.getElementById('profile-input-phone').value.trim();
    const emailVal = document.getElementById('profile-input-email').value.trim();

    if (!nameVal || !docVal || !phoneVal || !emailVal) {
      alert('⚠️ Por favor complete todos los campos obligatorios.');
      return;
    }

    try {
      const updatedData = {
        name: nameVal,
        documentNumber: docVal,
        phone: phoneVal,
        email: emailVal
      };

      await window.BulaPayDB.updateUserProfile(currentUser.username, updatedData);
      
      // Construir el objeto de usuario actualizado para la sesión
      const updatedUser = {
        ...currentUser,
        ...updatedData
      };

      // Guardar en la sesión local
      window.BulaPayDB.setCurrentUser(updatedUser);

      // Sincronizar UI
      this.updateNavBar(updatedUser);

      // Sincronizar Supervisor Dashboard reactivamente si está activo
      if (window.location.hash === '#supervisor' && window.supervisorModule && typeof window.supervisorModule.renderDashboard === 'function') {
        await window.supervisorModule.renderDashboard();
      }

      // Sincronizar Agente Dashboard reactivamente si está activo
      if (window.location.hash === '#agent' && window.agentModule && typeof window.agentModule.updateAgentHeader === 'function') {
        await window.agentModule.updateAgentHeader();
      }

      alert('✔ Datos actualizados correctamente.');
      this.closeUserProfileModal();
    } catch (e) {
      console.error("Error al guardar cambios de perfil:", e);
      alert('❌ Error al actualizar los datos en el servidor.');
    }
  },

  closeUserProfileModal() {
    const modal = document.getElementById('modal-user-profile');
    if (modal) {
      modal.classList.remove('active');
      this.isProfileModalOpen = false;
    }
  },

  openSupportModal() {
    if (typeof window.abrirModalSoporteDirecto === 'function') {
      window.abrirModalSoporteDirecto();
    }
  },

  closeSupportModal() {
    const modals = document.querySelectorAll('#modal-login-support');
    modals.forEach(modal => {
      modal.style.setProperty('display', 'none', 'important');
      modal.classList.remove('active', 'show');
    });
  },

  async handleSupportSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nomInp = document.getElementById('sop_nombre') || document.getElementById('support-name');
    const cedInp = document.getElementById('sop_cedula') || document.getElementById('support-doc');
    const rolInp = document.getElementById('sop_rol') || document.getElementById('support-role');
    const waInp = document.getElementById('sop_whatsapp') || document.getElementById('support-phone');
    const msgInp = document.getElementById('sop_mensaje') || document.getElementById('support-message');

    const nom = nomInp ? nomInp.value.trim() : '';
    const ced = cedInp ? cedInp.value.trim() : '';
    const rol = rolInp ? rolInp.value : 'Otro';
    const wa = waInp ? waInp.value.trim() : '';
    const msg = msgInp ? msgInp.value.trim() : '';

    if (!nom || !wa || !msg) {
      alert('⚠️ Por favor completa tu Nombre, WhatsApp y la Inquietud / Mensaje de soporte.');
      return;
    }

    try {
      if (window.BulaPayDB && typeof window.BulaPayDB.createSupportTicket === 'function') {
        await window.BulaPayDB.createSupportTicket({ name: nom, documentNumber: ced, role: rol, whatsapp: wa, message: msg });
      }
    } catch(err) {
      console.warn("Fallo guardando ticket de soporte:", err);
    }

    window.dispatchEvent(new CustomEvent('bula_support_updated'));
    if (window.superadminModule && typeof window.superadminModule.loadSupportTickets === 'function') {
      window.superadminModule.loadSupportTickets();
    }

    alert('✅ ¡Mensaje de soporte enviado exitosamente! El equipo de administración revisará tu inquietud en breve.');
    this.closeSupportModal();
  }
};

window.authModule = authModule;

// Creador e inyector dinámico del Modal de Soporte Directo Nativo
window.ensureSupportModalExists = function() {
  let modal = document.getElementById('modal-login-support');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-login-support';
    modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(6px); z-index: 9999999; justify-content: center; align-items: center; padding: 1rem; box-sizing: border-box;';
    modal.innerHTML = `
    <div style="background: #1e293b; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.85rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.4rem;">💬</span>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #38bdf8;">Mensajería Interna de Soporte BulaPay</h3>
            <p style="margin: 0; font-size: 0.78rem; color: #94a3b8;">Tu mensaje se enviará directamente al panel de administración</p>
          </div>
        </div>
        <button type="button" onclick="if(window.authModule && typeof window.authModule.closeSupportModal === 'function'){ window.authModule.closeSupportModal(); } else { const m = document.getElementById('modal-login-support'); if(m) m.style.display = 'none'; }" style="background: rgba(255,255,255,0.1); border: none; color: #ffffff; font-weight: 800; font-size: 1.1rem; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>

      <form id="form-login-support" onsubmit="event.preventDefault(); if(window.authModule && typeof window.authModule.handleSupportSubmit === 'function'){ window.authModule.handleSupportSubmit(event); }">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label style="display: block; font-size: 0.78rem; color: #cbd5e1; font-weight: 700; margin-bottom: 0.35rem;">NOMBRE COMPLETO:</label>
          <input type="text" id="sop_nombre" placeholder="Ej. Mario Alberto Pérez" required style="width: 100%; padding: 0.65rem 0.85rem; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 0.88rem; outline: none; box-sizing: border-box;">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label style="display: block; font-size: 0.78rem; color: #cbd5e1; font-weight: 700; margin-bottom: 0.35rem;">ROL O CARGO:</label>
            <select id="sop_rol" required style="width: 100%; padding: 0.65rem 0.85rem; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 0.85rem; outline: none; box-sizing: border-box;">
              <option value="Agente de Ruta" selected>Agente de Ruta</option>
              <option value="Agente Independiente">Agente Independiente</option>
              <option value="Usuario Supervisor">Usuario Supervisor</option>
              <option value="Comercio / Cliente">Comercio / Cliente</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 0.78rem; color: #cbd5e1; font-weight: 700; margin-bottom: 0.35rem;">NÚMERO DE CÉDULA:</label>
            <input type="text" id="sop_cedula" placeholder="Ej. 1098765432" required style="width: 100%; padding: 0.65rem 0.85rem; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 0.88rem; outline: none; box-sizing: border-box;">
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label style="display: block; font-size: 0.78rem; color: #cbd5e1; font-weight: 700; margin-bottom: 0.35rem;">NÚMERO DE WHATSAPP:</label>
          <input type="tel" id="sop_whatsapp" placeholder="Ej. 3001234567" required style="width: 100%; padding: 0.65rem 0.85rem; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 0.88rem; outline: none; box-sizing: border-box;">
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.78rem; color: #cbd5e1; font-weight: 700; margin-bottom: 0.35rem;">INQUIETUD / MENSAJE DE SOPORTE:</label>
          <textarea id="sop_mensaje" rows="3" placeholder="Describe brevemente el inconveniente..." required style="width: 100%; padding: 0.65rem 0.85rem; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 0.88rem; outline: none; resize: vertical; box-sizing: border-box; font-family: inherit;"></textarea>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" onclick="if(window.authModule && typeof window.authModule.closeSupportModal === 'function'){ window.authModule.closeSupportModal(); } else { const m = document.getElementById('modal-login-support'); if(m) m.style.display = 'none'; }" style="padding: 0.65rem 1.1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; font-weight: 600; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">Cancelar</button>
          <button type="submit" style="padding: 0.65rem 1.25rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #ffffff; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); display: inline-flex; align-items: center; gap: 0.4rem;">
            🚀 Enviar Mensaje
          </button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(modal);
  }
  return modal;
};

window.openSupportModal = function(e) {
  if (typeof window.abrirContactoMailto === 'function') {
    window.abrirContactoMailto(e);
  }
};

window.openSupportModalDirect = function(e) {
  if (typeof window.abrirContactoMailto === 'function') {
    window.abrirContactoMailto(e);
  }
};
