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
      // 0. Prioridad Master: Verificar sesión activa de Superadministrador Maestro
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
      const parts = hash.split('/');
      const route = parts[0];
      const param = parts[1] || null;

      if (typeof window.applyDynamicTheme === 'function') {
        window.applyDynamicTheme();
      }

      this.currentRoute = route;
      this.renderView(route, param);
    },

    async renderView(route, param) {
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
      // Registrar Service Worker
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js')
            .then(reg => {
              console.log('✔ Service Worker registrado con éxito. Scope:', reg.scope);
              const pwaStatus = document.getElementById('pwa-status');
              if (pwaStatus) pwaStatus.textContent = 'PWA Activa (Offline Listo)';
            })
            .catch(err => {
              console.error('❌ Fallo al registrar Service Worker:', err);
            });
        });
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
    this.setupSupportModalEvents();
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

  setupSupportModalEvents() {
    const bindDirectId = () => {
      const btnDirect = document.getElementById('btn-contactanos') || document.getElementById('btn-open-support') || document.getElementById('btn-top-contactus');
      if (btnDirect) {
        btnDirect.onclick = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (typeof window.openSupportModal === 'function') {
            window.openSupportModal();
          }
        };
      }
    };
    bindDirectId();

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#btn-contactanos, #btn-open-support, #btn-top-contactus, .btn-contactanos, .btn-open-support, [data-action="open-support"]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openSupportModal === 'function') {
          window.openSupportModal();
        } else if (window.authModule && typeof window.authModule.openSupportModal === 'function') {
          window.authModule.openSupportModal();
        } else {
          const modal = window.ensureSupportModalExists ? window.ensureSupportModalExists() : document.getElementById('modal-login-support');
          if (modal) {
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.setProperty('visibility', 'visible', 'important');
            modal.style.setProperty('opacity', '1', 'important');
            modal.style.setProperty('z-index', '999999', 'important');
            modal.classList.add('active');
          }
        }
      }
    }, true);
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

// Registro de Service Worker PWA con actualización forzada (v167)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
      console.log('[PWA] Service Worker registrado exitosamente');
    }).catch((err) => console.warn('[PWA] Error al registrar SW:', err));
  });
}

// Registro incondicional e inmediato para el botón "💬 Contáctanos" (DOM-ready e independiente)
(function initGlobalSupportListener() {
  const bindSupportEvent = () => {
    const btnDirect = document.getElementById('btn-contactanos') || document.getElementById('btn-open-support') || document.getElementById('btn-top-contactus');
    if (btnDirect) {
      btnDirect.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (typeof window.openSupportModal === 'function') {
          window.openSupportModal();
        }
      }, true);
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#btn-contactanos, #btn-open-support, #btn-top-contactus, .btn-contactanos, .btn-open-support, [data-action="open-support"]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openSupportModal === 'function') {
          window.openSupportModal();
        } else if (window.authModule && typeof window.authModule.openSupportModal === 'function') {
          window.authModule.openSupportModal();
        } else {
          const modal = window.ensureSupportModalExists ? window.ensureSupportModalExists() : document.getElementById('modal-login-support');
          if (modal) {
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.setProperty('visibility', 'visible', 'important');
            modal.style.setProperty('opacity', '1', 'important');
            modal.style.setProperty('z-index', '999999', 'important');
            modal.classList.add('active');
          }
        }
      }
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSupportEvent);
  } else {
    bindSupportEvent();
  }
})();
