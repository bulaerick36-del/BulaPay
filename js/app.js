// Controlador Principal y Enrutador SPA de BulaPay PWA

const app = {
  // Configuración del Enrutador SPA
  router: {
    currentRoute: 'auth',

    async init() {
      // Escuchar cambios de hash
      window.addEventListener('hashchange', () => this.handleRouteFromHash());
      
      // Aplicar el tema dinámico inicial
      if (typeof window.applyDynamicTheme === 'function') {
        window.applyDynamicTheme();
      }

      // Manejar carga inicial
      await this.handleInitialLoad();
    },

    navigate(route, param = null) {
      if (param) {
        window.location.hash = `${route}/${param}`;
      } else {
        window.location.hash = route;
      }
    },

    async handleInitialLoad() {
      // 0. Prioridad Máxima Abierta: Restablecimiento de contraseña (#reset-password o token=)
      const fullUrl = window.location.href || '';
      const searchStr = window.location.search || '';
      const hashStr = window.location.hash || '';

      if (hashStr.includes('reset-password') || searchStr.includes('token=') || fullUrl.includes('token=')) {
        this.handleRouteFromHash();
        return;
      }

      // 0.1 Prioridad Master: Verificar sesión activa de Superadministrador Maestro
      if (window.superadminModule && window.superadminModule.isLoggedIn()) {
        this.currentRoute = 'superadmin';
        window.location.hash = '#superadmin';
        if (typeof window.superadminModule.openSuperadminPanel === 'function') {
          await window.superadminModule.openSuperadminPanel();
        }
        return;
      }

      // 1. Prioridad: Verificar si hay parámetros de consulta URL (ej. ?view=customer&id=12345)
      if (typeof window.applyDynamicTheme === 'function') {
        window.applyDynamicTheme();
      }

      const urlParams = new URLSearchParams(window.location.search);
      const queryView = urlParams.get('view');
      const queryId = urlParams.get('id');

      if (queryView) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        this.navigate(queryView, queryId);
        return;
      }

      // 2. Si hay hash en la URL, navegar a él
      if (window.location.hash) {
        this.handleRouteFromHash();
        return;
      }

      // 3. Fallback: Evaluar sesión de usuario para redirigir
      let user = window.BulaPayDB.getCurrentUser();

      if (!user) {
        try {
          user = await window.BulaPayDB.getUserByUsername('admin');
          if (user) {
            window.BulaPayDB.setCurrentUser(user);
            if (window.authModule && typeof window.authModule.updateNavBar === 'function') {
              window.authModule.updateNavBar(user);
            }
            const demoLinks = document.getElementById('demo-quick-links');
            if (demoLinks) demoLinks.style.display = 'none';
          }
        } catch (err) {
          console.warn("Fallo al auto-iniciar sesión como admin:", err);
        }
      }

      if (user) {
        if (user.role === 'Usuario Supervisor' || user.role === 'Comercio Independiente' || user.role === 'supervisor' || user.role === 'Administrador de Rutas' || user.role === 'Otros (Comercios, Compraventas, Mercados)') {
          this.navigate('supervisor');
        } else if (user.role === 'Agente de Ruta' || user.role === 'agent' || user.role === 'Agente Independiente') {
          this.navigate('agent');
        }
      } else {
        this.navigate('auth');
      }
    },

    handleRouteFromHash() {
      const hash = window.location.hash.slice(1);
      const parts = hash.split('?')[0].split('/');
      const route = parts[0];
      const param = parts[1] || null;

      if (typeof window.applyDynamicTheme === 'function') {
        window.applyDynamicTheme();
      }

      this.currentRoute = route;
      this.renderView(route, param);
    },

    async renderView(route, param) {
      const fullUrl = window.location.href || '';
      const searchStr = window.location.search || '';
      const hashStr = window.location.hash || '';

      const isResetRoute = (route && route.startsWith('reset-password')) || hashStr.includes('reset-password') || searchStr.includes('token=') || fullUrl.includes('token=');

      // Manejador Especial Estricto: Vista de restablecimiento de contraseña (#reset-password)
      if (isResetRoute) {
        let token = param;
        if (!token || token === 'undefined' || token === 'null') {
          const match = fullUrl.match(/[?&/]token=([^&/#]+)/) || fullUrl.match(/token=([^&/#]+)/);
          if (match && match[1]) {
            token = match[1];
          }
        }
        if (!token || token === 'undefined' || token === 'null') {
          const searchParams = new URLSearchParams(window.location.search);
          token = searchParams.get('token');
        }

        const authView = document.getElementById('view-auth');
        if (authView) {
          authView.classList.remove('active');
          authView.style.setProperty('display', 'none', 'important');
        }

        const authWrapper = document.querySelector('.auth-wrapper');
        if (authWrapper) {
          authWrapper.style.setProperty('display', 'none', 'important');
        }

        const sections = document.querySelectorAll('.view-section');
        sections.forEach(s => {
          s.classList.remove('active');
          s.style.setProperty('display', 'none', 'important');
        });

        let resetSection = document.getElementById('view-reset-password');
        if (!resetSection) {
          resetSection = document.createElement('section');
          resetSection.id = 'view-reset-password';
          resetSection.className = 'view-section active';
          resetSection.innerHTML = `
            <div style="background: #1e293b; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 16px; width: 100%; max-width: 440px; padding: 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #ffffff; font-family: system-ui, -apple-system, sans-serif; margin: 2rem auto;" id="reset-password-container">
              <div style="text-align: center; margin-bottom: 1.5rem;">
                <img src="assets/logo.png" alt="BulaPay Logo" style="height: 48px; margin-bottom: 0.75rem; object-fit: contain;">
                <h2 style="font-size: 1.4rem; font-weight: 800; color: #38bdf8; margin: 0 0 0.25rem 0;">Restablecer Contraseña</h2>
                <p style="font-size: 0.85rem; color: #94a3b8; margin: 0;">Plataforma de Pagos y Logística BulaPay</p>
              </div>
              <div id="reset-password-status-area">
                <div style="text-align: center; color: #38bdf8; padding: 1.5rem;">
                  <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">⏳</div>
                  <div style="font-weight: 600; font-size: 0.9rem;">Verificando token de recuperación...</div>
                </div>
              </div>
            </div>
          `;
          const mainContent = document.getElementById('main-content') || document.body;
          mainContent.appendChild(resetSection);
        }

        resetSection.classList.add('active');
        resetSection.style.setProperty('display', 'flex', 'important');
        resetSection.style.setProperty('visibility', 'visible', 'important');
        resetSection.style.setProperty('opacity', '1', 'important');
        resetSection.style.setProperty('min-height', '70vh', 'important');

        const triggerInit = () => {
          if (typeof window.initResetPasswordView === 'function') {
            window.initResetPasswordView(token);
          }
        };
        triggerInit();
        setTimeout(triggerInit, 100);
        setTimeout(triggerInit, 300);
        return;
      }

      if (route === 'superadmin' || (window.superadminModule && window.superadminModule.isLoggedIn() && window.location.hash === '#superadmin')) {
        const authView = document.getElementById('view-auth');
        if (authView) authView.style.setProperty('display', 'none', 'important');
        const authWrapper = document.querySelector('.auth-wrapper');
        if (authWrapper) authWrapper.style.setProperty('display', 'none', 'important');

        if (window.superadminModule) {
          await window.superadminModule.openSuperadminPanel();
        }
        return;
      }

      // Sincronizar sesión y header en cada cambio de vista
      if (window.authModule && typeof window.authModule.init === 'function') {
        window.authModule.init();
      }

      const devLinks = document.getElementById('demo-quick-links');
      if (devLinks) {
        const currentUser = window.BulaPayDB.getCurrentUser();
        if (currentUser) {
          devLinks.style.display = 'none';
        } else {
          devLinks.style.display = 'flex';
        }
      }

      const sections = document.querySelectorAll('.view-section');
      sections.forEach(s => {
        s.classList.remove('active');
        s.style.display = '';
      });

      if (window.supervisorModule) {
        window.supervisorModule.destroy();
      }
      if (window.agentModule && typeof window.agentModule.destroy === 'function') {
        window.agentModule.destroy();
      }

      const targetSectionId = `view-${route}`;
      const targetSection = document.getElementById(targetSectionId);

      if (!targetSection) {
        console.warn(`Ruta desconocida: ${route}. Redirigiendo a auth.`);
        this.navigate('auth');
        return;
      }

      const user = window.BulaPayDB.getCurrentUser();
      const supervisorRoles = ['Usuario Supervisor', 'Comercio Independiente', 'supervisor', 'Administrador de Rutas', 'Otros (Comercios, Compraventas, Mercados)'];
      const agentRoles = ['Agente de Ruta', 'agent', 'Agente Independiente'];

      if (route === 'supervisor') {
        if (!user || !supervisorRoles.includes(user.role)) {
          console.warn('Acceso denegado a panel de supervisor. Redirigiendo.');
          this.navigate('auth');
          return;
        }
        await window.supervisorModule.init();
      } 
      
      else if (route === 'agent') {
        if (!user || !agentRoles.includes(user.role)) {
          console.warn('Acceso denegado a terminal de agente. Redirigiendo.');
          this.navigate('agent-login');
          return;
        }
        await window.agentModule.init();
      } 
      
      else if (route === 'agent-login') {
        if (user && agentRoles.includes(user.role)) {
          this.navigate('agent');
          return;
        }
        await window.authModule.init();
      }
      
      else if (route === 'customer') {
        await window.customerModule.init(param);
      } 
      
      else if (route === 'auth') {
        await window.authModule.init();
      }

      // Mostrar la sección correspondiente de forma visible
      targetSection.classList.add('active');
      targetSection.style.display = 'block';
      
      // Scroll al inicio de la página
      window.scrollTo(0, 0);
    }
  },

  // Inicializar PWA e instalador
  pwa: {
    deferredPrompt: null,

    init() {
      // Auto-destrucción y re-registro forzoso de Service Worker
      if ('serviceWorker' in navigator) {
        if (document.readyState === 'complete') {
          if (window.forcePurgeAndRegisterServiceWorker) window.forcePurgeAndRegisterServiceWorker();
        } else {
          window.addEventListener('load', () => {
            if (window.forcePurgeAndRegisterServiceWorker) window.forcePurgeAndRegisterServiceWorker();
          });
        }
      }

      // Manejar prompt de instalación
      const installBtn = document.getElementById('btn-install-pwa');
      
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        
        if (installBtn) {
          installBtn.style.display = 'inline-block';
          
          installBtn.addEventListener('click', (event) => {
            event.preventDefault();
            installBtn.style.display = 'none';
            
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
              if (choiceResult.outcome === 'accepted') {
                console.log('El usuario aceptó la instalación de BulaPay PWA');
              } else {
                console.log('El usuario rechazó la instalación de BulaPay PWA');
              }
              this.deferredPrompt = null;
            });
          });
        }
      });

      // App instalada exitosamente
      window.addEventListener('appinstalled', () => {
        console.log('BulaPay PWA instalada en el dispositivo.');
        if (installBtn) installBtn.style.display = 'none';
      });
    }
  },

  // Inicialización global
  async init() {
    // 1. Eventos e interfaz inmediata (Non-blocking)
    this.setupGPSInstructionsEvents();

    // 2. Capa de validación de GPS en segundo plano (Non-blocking)
    this.checkGPSPermission().catch(err => console.warn("[GPS] Error no bloqueante en checkGPSPermission:", err));

    // 3. PWA y enrutamiento SPA
    this.pwa.init();
    await this.router.init();
    
    // 4. Inicializar reloj del teléfono móvil simulado
    this.startPhoneClock();
  },

  // Capa de validación de GPS (No Bloqueante)
  async checkGPSPermission() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const queryPromise = navigator.permissions.query({ name: 'geolocation' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout en navigator.permissions.query')), 2000)
        );
        const result = await Promise.race([queryPromise, timeoutPromise]);
        this.handleGPSPermissionStatus(result.state);
        
        // Escuchar cambios de estado del permiso
        result.onchange = () => {
          this.handleGPSPermissionStatus(result.state);
        };
      } else {
        await this.detectGPSPermissionFallback();
      }
    } catch (err) {
      console.warn("Fallo o timeout al consultar navigator.permissions:", err);
      await this.detectGPSPermissionFallback();
    }
  },

  async detectGPSPermissionFallback() {
    if (!navigator.geolocation) {
      this.handleGPSPermissionStatus('denied');
      return;
    }
    
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn("[GPS Fallback] Timeout al obtener posición. Continuando sin bloquear.");
          this.handleGPSPermissionStatus('granted');
          resolve();
        }
      }, 3000);

      try {
        navigator.geolocation.getCurrentPosition(
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              this.handleGPSPermissionStatus('granted');
              resolve();
            }
          },
          (err) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              if (err && err.code === err.PERMISSION_DENIED) {
                this.handleGPSPermissionStatus('denied');
              } else {
                this.handleGPSPermissionStatus('granted');
              }
              resolve();
            }
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 10000 }
        );
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          console.warn("[GPS Fallback] Excepción no controlada en getCurrentPosition:", err);
          this.handleGPSPermissionStatus('granted');
          resolve();
        }
      }
    });
  },

  handleGPSPermissionStatus(state) {
    const panelCollect = document.getElementById('panel-agent-collect');
    const blockedPanel = document.getElementById('gps-blocked-panel');
    
    if (state === 'denied') {
      window.gpsBlocked = true;
      if (panelCollect) panelCollect.style.setProperty('display', 'none', 'important');
      if (blockedPanel) blockedPanel.style.display = 'flex';
    } else {
      window.gpsBlocked = false;
      if (blockedPanel) blockedPanel.style.display = 'none';
      
      const tabCollect = document.getElementById('tab-agent-collect');
      if (panelCollect && tabCollect && tabCollect.classList.contains('active')) {
        panelCollect.style.display = 'block';
      }
    }
  },

  setupGPSInstructionsEvents() {
    const btnInstructions = document.getElementById('btn-gps-instructions');
    const modal = document.getElementById('gps-instructions-modal');
    const btnCloseX = document.getElementById('btn-close-gps-modal');
    const btnCloseOk = document.getElementById('btn-close-gps-modal-ok');

    if (btnInstructions && modal) {
      btnInstructions.addEventListener('click', () => {
        modal.style.display = 'flex';
        modal.classList.add('active');
      });
    }

    const closeModal = () => {
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
    };

    if (btnCloseX) btnCloseX.addEventListener('click', closeModal);
    if (btnCloseOk) btnCloseOk.addEventListener('click', closeModal);
  },

  startPhoneClock() {
    const clockElement = document.getElementById('phone-time');
    const batteryElement = document.getElementById('phone-battery');
    const routeStatusElement = document.getElementById('phone-route-status');

    const updateClockAndTime = async () => {
      const now = new Date();
      
      // 1. Actualizar Reloj
      if (clockElement) {
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        clockElement.textContent = `${hrs}:${mins}`;
      }

      // 2. Actualizar Temporizador de Ruta (Sincronizado con Supabase en tiempo real)
      if (routeStatusElement) {
        const currentUser = window.BulaPayDB.getCurrentUser();
        
        if (currentUser && currentUser.role === 'Agente Independiente') {
          // Los Agentes Independientes no tienen indicador de ruta ni restricciones horarias
          routeStatusElement.textContent = '';
          routeStatusElement.style.display = 'none';
          
          const registerBtn = document.getElementById('btn-agent-register-installment');
          const submitCollectBtn = document.getElementById('btn-submit-collect');
          const noPagoBtn = document.getElementById('btn-payment-card-nopago');
          if (registerBtn) registerBtn.disabled = false;
          if (submitCollectBtn) submitCollectBtn.disabled = false;
          if (noPagoBtn) noPagoBtn.disabled = false;
          const saveClientBtn = document.getElementById('btn-registrar-cliente-oficial') || document.getElementById('btn-agent-save-client');
          if (saveClientBtn) saveClientBtn.disabled = false;
        } else if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent')) {
          routeStatusElement.style.display = 'inline';
          
          // Lógica de Bloqueo Estricto (Hard Lock)
          const day = now.getDay();
          const hours = now.getHours();
          const isClosed = (day === 0 || hours < 6 || hours >= 18);
          
          const registerBtn = document.getElementById('btn-agent-register-installment');
          const submitCollectBtn = document.getElementById('btn-submit-collect');
          const noPagoBtn = document.getElementById('btn-payment-card-nopago');
          const saveClientBtn = document.getElementById('btn-registrar-cliente-oficial') || document.getElementById('btn-agent-save-client');

          if (isClosed) {
            routeStatusElement.textContent = 'Ruta Cerrada';
            routeStatusElement.style.color = 'var(--color-rojo)';
            
            if (registerBtn) registerBtn.disabled = true;
            if (submitCollectBtn) submitCollectBtn.disabled = true;
            if (noPagoBtn) noPagoBtn.disabled = true;
            // Mantener saveClientBtn activo para permitir la retroalimentación al presionar el botón
            if (saveClientBtn) saveClientBtn.disabled = false;
          } else {
            // Operando dentro del horario permitido, mostrar tiempo para el cierre (18:00)
            const closingTime = new Date(now);
            closingTime.setHours(18, 0, 0, 0);
            
            const diffMs = closingTime - now;
            const diffMinutesTotal = Math.ceil(diffMs / 60000);
            const hrsDiff = Math.floor(diffMinutesTotal / 60);
            const minsDiff = diffMinutesTotal % 60;
            
            routeStatusElement.textContent = `Cierra en: ${hrsDiff}h ${minsDiff}m`;
            routeStatusElement.style.color = 'var(--color-verde)';
            
            if (registerBtn) registerBtn.disabled = false;
            if (submitCollectBtn) submitCollectBtn.disabled = false;
            if (noPagoBtn) noPagoBtn.disabled = false;
            if (saveClientBtn) saveClientBtn.disabled = false;
          }
        } else {
          // Si no es un agente de ruta, limpiamos el temporizador
          routeStatusElement.textContent = '';
        }
      }
    };

    // Exponer el actualizador para llamadas manuales inmediatas tras el login
    this.updateClockAndTime = updateClockAndTime;

    // Inicializar reloj y temporizador de inmediato y actualizar cada minuto
    this.updateClockAndTime();
    setInterval(() => this.updateClockAndTime(), 60000);

    // 3. Obtener y escuchar nivel de batería en tiempo real
    if (batteryElement) {
      if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
          const updateBattery = () => {
            const level = Math.round(battery.level * 100);
            batteryElement.textContent = `🔋 ${level}%`;
          };
          updateBattery();
          // Registrar listener del evento de cambio de nivel
          battery.addEventListener('levelchange', updateBattery);
        }).catch(err => {
          console.warn("Fallo al acceder a la API de batería:", err);
          batteryElement.textContent = '🔋 --%';
        });
      } else {
        batteryElement.textContent = '🔋 --%';
      }
    }
  }
};

// Arrancar la aplicación
window.app = app;
document.addEventListener('DOMContentLoaded', async () => {
  await app.init();
});

// Utilidad Global: Mostrar Recibo Digital de Pago
window.showBulaPayReceipt = function(payment, client) {
  const modal = document.getElementById('receipt-modal');
  if (!modal) return;

  // Llenar campos
  document.getElementById('receipt-client-name').textContent = client.name;
  document.getElementById('receipt-client-cedula').textContent = client.cedula;
  document.getElementById('receipt-installment-num').textContent = `Cuota ${payment.installmentNumber}`;
  document.getElementById('receipt-date').textContent = payment.date;
  document.getElementById('receipt-agent-name').textContent = payment.agentName;
  document.getElementById('receipt-amount').textContent = `$${payment.amount.toLocaleString('es-CO')}`;
  document.getElementById('receipt-signature').textContent = payment.signature;

  const badge = document.getElementById('receipt-status-badge');
  const stamp = document.getElementById('receipt-stamp-type');
  
  if (payment.status === 'Abonado') {
    badge.textContent = 'ABONADO';
    badge.className = 'receipt-badge-status abonado';
    if (stamp) {
      stamp.textContent = '🟡';
      stamp.style.color = 'var(--color-amarillo)';
    }
  } else {
    badge.textContent = 'PAGADO';
    badge.className = 'receipt-badge-status';
    if (stamp) {
      stamp.textContent = '🟢';
      stamp.style.color = 'var(--color-verde)';
    }
  }

  modal.classList.add('active');

  const btnClose = document.getElementById('btn-close-receipt');

  const handleClose = () => {
    modal.classList.remove('active');
  };

  if (btnClose) {
    btnClose.onclick = handleClose;
  }
};

// Función global para forzar la visualización de la sección de login/registro
window.openLoginSection = function() {
  // Limpiar cualquier estilo inline residual para permitir que las clases CSS funcionen
  const sections = document.querySelectorAll('.view-section');
  if (sections) {
    sections.forEach(s => {
      s.style.display = '';
    });
  }

  // Actualizar el enrutador SPA para estar en la ruta 'auth'
  if (window.app && window.app.router) {
    window.app.router.navigate('auth');
  }
};

// Compatibilidad con navegación basada en estado (React-like/global)
window.setCurrentView = function(view) {
  if (view === 'auth' || view === 'Supervisor' || view === 'Agente Independiente' || view === 'Otro Comercio o Tienda') {
    window.openLoginSection();
  } else if (window.app && window.app.router) {
    // Limpiar estilos inline residuales por seguridad al navegar
    const sections = document.querySelectorAll('.view-section');
    if (sections) {
      sections.forEach(s => {
        s.style.display = '';
      });
    }
    window.app.router.navigate(view);
  }
};

// Función para aplicar el tema de color dinámico según el rol seleccionado
window.applyDynamicTheme = function() {
  const role = localStorage.getItem('bulaRole') || 'supervisor';
  
  // Paleta de colores por rol
  let primaryColor = '#10b981'; // supervisor: verde esmeralda original
  let primaryHover = '#059669';
  let accentColor = '#10b981';
  let borderColorFocus = 'rgba(16, 185, 129, 0.4)';
  let roleLabel = 'Supervisor';

  if (role === 'route') {
    primaryColor = '#2563eb'; // azul (blue-600)
    primaryHover = '#1d4ed8'; // blue-700
    accentColor = '#2563eb';
    borderColorFocus = 'rgba(37, 99, 235, 0.4)';
    roleLabel = 'Agente de Ruta';
  } else if (role === 'client') {
    primaryColor = '#4ade80'; // verde claro (green-400)
    primaryHover = '#22c55e'; // green-500
    accentColor = '#22c55e'; // green-500
    borderColorFocus = 'rgba(74, 222, 128, 0.4)';
    roleLabel = 'Cliente';
  } else if (role === 'commerce') {
    primaryColor = '#f97316'; // naranja (orange-500)
    primaryHover = '#ea580c'; // orange-600
    accentColor = '#f97316';
    borderColorFocus = 'rgba(249, 115, 22, 0.4)';
    roleLabel = 'Otro Comercio o Tienda';
  } else if (role === 'independent') {
    primaryColor = '#eab308'; // amarillo (yellow-500)
    primaryHover = '#ca8a04'; // yellow-600
    accentColor = '#eab308';
    borderColorFocus = 'rgba(234, 179, 8, 0.4)';
    roleLabel = 'Agente Independiente';
  }

  // Configurar las variables CSS a nivel del elemento raíz (documentElement)
  document.documentElement.style.setProperty('--primary', primaryColor);
  document.documentElement.style.setProperty('--primary-hover', primaryHover);
  document.documentElement.style.setProperty('--accent', accentColor);
  document.documentElement.style.setProperty('--border-color-focus', borderColorFocus);

  // Actualizar títulos e indicaciones dinámicamente si los elementos existen
  const authTitleBrand = document.getElementById('auth-title-brand');
  const authSubtitle = document.getElementById('auth-subtitle');
  
  if (authSubtitle) {
    if (role === 'supervisor') {
      authSubtitle.innerText = 'Administración de Cartera y Logística de Rutas';
    } else {
      authSubtitle.innerText = `Ingreso - ${roleLabel}`;
    }
  }

  // Soporte para el subtítulo del Portal de Agentes
  const agentLoginSubtitle = document.querySelector('#view-agent-login .auth-header p');
  if (agentLoginSubtitle) {
    agentLoginSubtitle.innerText = `Inicio de Sesión Autorizado - ${roleLabel}`;
  }
};

// Purga automática de Service Workers obsoletos y registro forzado (v307)
window.forcePurgeAndRegisterServiceWorker = async function() {
  if (!('serviceWorker' in navigator)) return;

  try {
    // 1. Desinscribir de inmediato cualquier Service Worker antiguo (v193, v204, v206, v207, v208, v209, v300, v301, v302, v303, v306, v308, etc.)
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations && registrations.length > 0) {
      for (const registration of registrations) {
        const unregistered = await registration.unregister();
        if (unregistered) {
          console.log('🧹 [PWA Purga] SW antiguo desregistrado:', registration.scope);
          if (window.bulaMobileDebugLog) {
            window.bulaMobileDebugLog('SW Antiguo Desregistrado: ' + registration.scope, 'warning');
          }
        }
      }
    }

    // 2. Limpiar todas las cachés locales antiguas almacenadas en el dispositivo móvil
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        await caches.delete(key);
        console.log('🧹 [PWA Purga] Caché eliminada:', key);
        if (window.bulaMobileDebugLog) {
          window.bulaMobileDebugLog('Caché obsoleta eliminada: ' + key, 'warning');
        }
      }
    }

    // 3. Registrar el nuevo Service Worker con parámetro de versión dinámico
    const swUrl = './sw.js?v=312&t=' + Date.now();
    const newReg = await navigator.serviceWorker.register(swUrl);
    await newReg.update();
    console.log('✔ Service Worker v312 registrado con éxito (Fresh Register). Scope:', newReg.scope);

    if (window.bulaMobileDebugLog) {
      window.bulaMobileDebugLog('¡SW v312 Registrado y Purgado con Éxito!', 'success');
    }

    const pwaStatus = document.getElementById('pwa-status');
    if (pwaStatus) pwaStatus.textContent = 'PWA Activa (v312 Actualizada)';
  } catch (err) {
    console.error('❌ Error durante la purga/registro del Service Worker:', err);
    if (window.bulaMobileDebugLog) {
      window.bulaMobileDebugLog('Error en purga/registro SW: ' + (err.message || err), 'error');
    }
  }
};

// Registro de Service Worker PWA con Auto-Destrucción y Re-registro Forzoso (v312)
if ('serviceWorker' in navigator) {
  const triggerPurge = () => {
    window.forcePurgeAndRegisterServiceWorker();
  };

  if (document.readyState === 'complete') {
    triggerPurge();
  } else {
    window.addEventListener('load', triggerPurge);
  }
}

// Fin de Controlador Principal BulaPay PWA
