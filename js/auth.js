// Módulo de Autenticación y Sesiones de BulaPay

const authModule = {
  initialized: false,
  isProfileModalOpen: false,

  init() {
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

    // Abrir Modal de Términos y Condiciones
    if (this.linkTerms) {
      this.linkTerms.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.modalTerms) {
          this.modalTerms.classList.add('active');
        }
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

      try {
        const user = await window.BulaPayDB.getUserByUsername(usernameInput);

        if (user && user.password === passwordInput) {
          this.loginUser(user);
        } else {
          alert('❌ Credenciales inválidas. Por favor intente nuevamente.');
        }
      } catch (err) {
        console.error(err);
        alert('❌ Error al iniciar sesión.');
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

          if (user && user.password === passwordInput && (user.role === 'Agente de Ruta' || user.role === 'agent' || user.role === 'Agente Independiente')) {
            this.loginUser(user);
          } else if (user && user.password === passwordInput) {
            alert('❌ Acceso denegado. Este portal es exclusivo para Agentes.');
          } else {
            alert('❌ Credenciales inválidas. Por favor intente nuevamente.');
          }
        } catch (err) {
          console.error(err);
          alert('❌ Error al iniciar sesión del agente.');
        }
      });
    }

    // Submit Registrarse (Usuario Supervisor / Comercio)
    this.formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('register-type').value;
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

        let name = '';
        let docType = '';
        let docNum = '';
        let company = '';
        let representanteLegal = null;
        let cedulaRepresentante = null;

        if (type === 'Otros (Comercios, Compraventas, Mercados)') {
          company = document.getElementById('register-company-name').value.trim();
          name = company;
          docType = 'NIT';
          docNum = document.getElementById('register-nit').value.trim();
          representanteLegal = document.getElementById('register-rep-name').value.trim();
          cedulaRepresentante = document.getElementById('register-rep-doc').value.trim();
        } else {
          name = document.getElementById('register-name').value.trim();
          company = name;
          docType = document.getElementById('register-doc-type').value;
          docNum = document.getElementById('register-doc-num').value.trim();
        }

        const newUser = {
          username,
          password,
          name,
          role: type,
          company,
          email,
          documentType: docType,
          documentNumber: docNum,
          estado_suscripcion: 'activa_prueba',
          id_metodo_pago: null,
          routeId: type === 'Agente Independiente' ? 'route_' + username : null,
          supervisor_id: (type === 'Usuario Supervisor' || type === 'Administrador de Rutas' || type === 'Otros (Comercios, Compraventas, Mercados)' || type === 'Agente Independiente') ? username : null,
          representante_legal: representanteLegal,
          cedula_representante: cedulaRepresentante
        };

        if (type === 'Agente Independiente') {
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
        }

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
      this.userNavInfo.style.display = 'none';
      
      // Resetear rol y aplicar tema por defecto
      localStorage.removeItem('bulaRole');
      if (typeof window.applyDynamicTheme === 'function') {
        window.applyDynamicTheme();
      }
      
      window.app.router.navigate('auth');
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
    const type = document.getElementById('register-type').value;
    const stdFields = document.getElementById('register-fields-standard');
    const otherFields = document.getElementById('register-fields-others');
    
    if (!stdFields || !otherFields) return;
    
    const stdInputs = stdFields.querySelectorAll('input, select');
    const otherInputs = otherFields.querySelectorAll('input');

    if (type === 'Otros (Comercios, Compraventas, Mercados)') {
      stdFields.style.display = 'none';
      otherFields.style.display = 'block';
      
      stdInputs.forEach(i => i.removeAttribute('required'));
      otherInputs.forEach(i => i.setAttribute('required', ''));
    } else {
      stdFields.style.display = 'block';
      otherFields.style.display = 'none';
      
      stdInputs.forEach(i => i.setAttribute('required', ''));
      otherInputs.forEach(i => i.removeAttribute('required'));
    }
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
  }
};

window.authModule = authModule;
