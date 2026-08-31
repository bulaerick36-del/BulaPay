// Módulo de Autenticación y Sesiones de BulaPay

const authModule = {
  initialized: false,
  isProfileModalOpen: false,

  init() {
    const authWrapper = document.querySelector('.auth-wrapper');
    if (authWrapper) {
      if (window.location.hash === '#superadmin' || (window.superadminModule && window.superadminModule.isLoggedIn() && window.location.hash === '#superadmin')) {
        authWrapper.style.display = 'none';
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

      if ((usernameInput === '1121338578' || usernameInput === 'admin') && window.superadminModule) {
        if (window.superadminModule.login(usernameInput, passwordInput)) {
          alert('🔑 Acceso concedido al Panel de Superadministrador Maestro.');
          await window.superadminModule.openSuperadminPanel();
          return;
        }
      }

      try {
        const user = await window.BulaPayDB.getUserByUsername(usernameInput);

        if (user && String(user.password).trim() === String(passwordInput).trim()) {
          this.loginUser(user);
        } else if ((usernameInput === '1121338578' || usernameInput === 'admin') && window.superadminModule) {
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

    // Submit Registrarse (Agente Independiente)
    this.formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = 'Agente Independiente'; // Forzado de manera fija e invariable
      const email = document.getElementById('register-email').value.trim();
      const username = document.getElementById('register-username').value.trim().toLowerCase();
      const password = document.getElementById('register-password').value;
      const legalChecked = document.getElementById('register-legal').checked;

      if (!legalChecked) {
        alert('⚠️ Debe aceptar los Términos y Condiciones para registrarse.');
        return;
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
        const docNum = document.getElementById('register-doc-num').value.trim();
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
          role: 'Agente Independiente',
          company,
          phone,
          email,
          documentType: docType,
          documentNumber: docNum,
          estado_suscripcion: 'activa_prueba',
          id_metodo_pago: null,
          routeId: 'route_' + username,
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

        const defaultRoute = {
          id: 'route_' + username,
          name: 'Ruta ' + name,
          agentUsername: username,
          agentName: name,
          capital: 0,
          collected: 0,
          status: 'En Ruta',
          supervisor_id: username,
          opening_time: '06:00',
          closing_time: '18:00',
          has_extension: false
        };
        await window.BulaPayDB.saveRoute(defaultRoute);

        // Guardar en base de datos
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

  loginUser(user) {
    window.BulaPayDB.setCurrentUser(user);
    this.updateNavBar(user);

    // Sincronizar el rol del usuario con el tema de colores dinámico
    let targetRole = 'supervisor';
    if (user.role === 'Usuario Supervisor' || user.role === 'supervisor' || user.role === 'Administrador de Rutas') {
      targetRole = 'supervisor';
    } else if (user.role === 'Agente de Ruta' || user.role === 'agent') {
      targetRole = 'route';
    } else if (user.role === 'Agente Independiente') {
      targetRole = 'independent';
    } else if (user.role === 'Otros (Comercios, Compraventas, Mercados)') {
      targetRole = 'commerce';
    }
    localStorage.setItem('bulaRole', targetRole);
    if (typeof window.applyDynamicTheme === 'function') {
      window.applyDynamicTheme();
    }

    // Redirigir según el rol del usuario
    if (user.role === 'Usuario Supervisor' || user.role === 'Comercio Independiente' || user.role === 'supervisor' || user.role === 'Administrador de Rutas' || user.role === 'Otros (Comercios, Compraventas, Mercados)') {
      window.app.router.navigate('supervisor');
    } else if (user.role === 'Agente de Ruta' || user.role === 'agent' || user.role === 'Agente Independiente') {
      window.app.router.navigate('agent');
    }
  },

  updateNavBar(user) {
    if (user) {
      if (this.navUserName) this.navUserName.textContent = user.name;
      if (this.navUserRole) this.navUserRole.textContent = user.role;
      this.userNavInfo.style.display = 'flex';
    } else {
      this.userNavInfo.style.display = 'none';
    }
  },

  checkCurrentSession() {
    const user = window.BulaPayDB.getCurrentUser();
    if (user) {
      this.updateNavBar(user);
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
    const modal = document.getElementById('modal-login-support');
    if (modal) {
      modal.style.display = 'flex';
    }
  },

  closeSupportModal() {
    const modal = document.getElementById('modal-login-support');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  async handleSupportSubmit(e) {
    if (e) {
      e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const nameInput = document.getElementById('support-name');
    const roleSelect = document.getElementById('support-role');
    const docInput = document.getElementById('support-doc');
    const msgInput = document.getElementById('support-message');

    if (!nameInput || !docInput || !msgInput) return;

    const nameVal = nameInput.value.trim();
    const roleVal = roleSelect ? roleSelect.value : 'Usuario';
    const docVal = docInput.value.trim();
    const msgVal = msgInput.value.trim();

    if (!nameVal || !docVal || !msgVal) {
      alert('⚠️ Por favor completa todos los campos del formulario de soporte.');
      return;
    }

    try {
      if (window.BulaPayDB && typeof window.BulaPayDB.createSupportTicket === 'function') {
        await window.BulaPayDB.createSupportTicket({
          name: nameVal,
          role: roleVal,
          documentNumber: docVal,
          message: msgVal
        });

        alert('✅ ¡Tu mensaje de soporte ha sido enviado con éxito! El Superadministrador lo revisará de inmediato.');

        nameInput.value = '';
        docInput.value = '';
        msgInput.value = '';
        this.closeSupportModal();

        if (window.superadminModule && typeof window.superadminModule.loadSupportTickets === 'function') {
          window.superadminModule.loadSupportTickets();
        }
      }
    } catch(err) {
      console.error("Error al enviar solicitud de soporte:", err);
      alert('❌ Ocurrió un error al enviar la solicitud. Por favor reintenta.');
    }
  }
};

window.authModule = authModule;
