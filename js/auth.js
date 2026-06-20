// Módulo de Autenticación y Sesiones de BulaPay

const authModule = {
  init() {
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

    this.bindEvents();
    this.checkCurrentSession();
  },

  bindEvents() {
    // Botón Global de Reinicio de Simulación
    const btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) {
      btnResetDb.addEventListener('click', async () => {
        if (confirm('⚠️ ¿Está seguro de restablecer toda la base de datos? Se perderán todos los datos modificados y nuevos registros.')) {
          try {
            await window.BulaPayDB.reseed();
            alert('🔄 Base de datos restablecida a los valores iniciales de fábrica.');
            window.location.reload();
          } catch (err) {
            console.error(err);
            alert('❌ Error al restablecer la base de datos.');
          }
        }
      });
    }

    // Alternancia de Pestañas (Iniciar Sesión / Registrarse)
    this.tabLogin.addEventListener('click', () => this.switchTab('login'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));
    
    if (this.authLinkRegister) {
      this.authLinkRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab('register');
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

          if (user && user.password === passwordInput && user.role === 'Agente de Ruta') {
            this.loginUser(user);
          } else if (user && user.password === passwordInput) {
            alert('❌ Acceso denegado. Este portal es exclusivo para Agentes de Ruta.');
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
      const name = document.getElementById('register-name').value.trim();
      const username = document.getElementById('register-username').value.trim().toLowerCase();
      const password = document.getElementById('register-password').value;
      const docType = document.getElementById('register-doc-type').value;
      const docNum = document.getElementById('register-doc-num').value.trim();
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

        const newUser = {
          username,
          password,
          name,
          role: type,
          company: name,
          documentType: docType,
          documentNumber: docNum,
          estado_suscripcion: 'activa_prueba',
          id_metodo_pago: null
        };

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
      
      // Mostrar accesos rápidos de demo de nuevo por comodidad
      document.getElementById('demo-quick-links').style.display = 'flex';
      
      window.app.router.navigate('auth');
    });
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

  loginUser(user) {
    window.BulaPayDB.setCurrentUser(user);
    this.updateNavBar(user);

    // Ocultar accesos rápidos de demo para simular una experiencia limpia de producción,
    // pero se pueden activar en el enrutador si es necesario.
    document.getElementById('demo-quick-links').style.display = 'none';

    // Redirigir según el rol del usuario
    if (user.role === 'Usuario Supervisor' || user.role === 'Comercio Independiente') {
      window.app.router.navigate('supervisor');
    } else if (user.role === 'Agente de Ruta') {
      window.app.router.navigate('agent');
    }
  },

  updateNavBar(user) {
    if (user) {
      this.navUserName.textContent = user.name;
      this.navUserRole.textContent = user.role;
      this.userNavInfo.style.display = 'flex';
    } else {
      this.userNavInfo.style.display = 'none';
    }
  },

  checkCurrentSession() {
    const user = window.BulaPayDB.getCurrentUser();
    if (user) {
      this.updateNavBar(user);
      // Ocultar demos si ya está logueado
      document.getElementById('demo-quick-links').style.display = 'none';
    } else {
      this.userNavInfo.style.display = 'none';
      document.getElementById('demo-quick-links').style.display = 'flex';
    }
  }
};

window.authModule = authModule;
