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
      const targetHash = param ? `${route}/${param}` : route;
      const currentHash = window.location.hash.slice(1);
      if (currentHash === targetHash) {
        this.handleRouteFromHash();
      } else {
        window.location.hash = targetHash;
      }
    },

    async handleInitialLoad() {
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
      if (window.location.hash && window.location.hash.length > 1) {
        this.handleRouteFromHash();
        return;
      }

      // 3. Fallback: Evaluar sesión de usuario para redirigir
      let user = (window.BulaPayDB && typeof window.BulaPayDB.getCurrentUser === 'function') ? window.BulaPayDB.getCurrentUser() : null;

      if (!user && window.BulaPayDB && typeof window.BulaPayDB.getUserByUsername === 'function') {
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

      const uName = user ? String(user.username || '').toLowerCase() : '';
      const uDoc = user ? String(user.documentNumber || '').trim() : '';
      const uRole = user ? String(user.role || '').trim() : '';

      const isMasterSuperadmin = user && (uName === 'admin' || uRole === 'Superadministrador' || uRole === 'Superadmin');
      const isSupervisor = user && !isMasterSuperadmin && (uRole === 'Usuario Supervisor' || uRole === 'Supervisor' || uRole === 'Administrador' || uRole === 'Administrador de Rutas' || uRole.includes('Comercio') || uRole.includes('Otros') || uRole.toLowerCase().includes('supervisor'));
      const isAgent = user && (uRole === 'Agente Independiente' || uRole === 'Agente de Ruta' || uRole === 'agent');

      if (user) {
        if (isMasterSuperadmin) {
          sessionStorage.setItem('credi_superadmin_active', 'true');
          this.navigate('superadmin');
        } else if (isSupervisor) {
          sessionStorage.removeItem('credi_superadmin_active');
          this.navigate('supervisor');
        } else if (isAgent) {
          sessionStorage.removeItem('credi_superadmin_active');
          this.navigate('agent');
        } else {
          this.navigate('auth');
        }
      } else {
        this.navigate('auth');
      }
    },

    handleRouteFromHash() {
      const hash = window.location.hash.slice(1);
      const parts = hash ? hash.split('?')[0].split('/') : ['auth'];
      const route = parts[0] || 'auth';
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
        try { window.authModule.init(); } catch(e) { console.warn("Fallo no crítico en authModule.init:", e); }
      }

      const devLinks = document.getElementById('demo-quick-links');
      if (devLinks) {
        const currentUser = (window.BulaPayDB && typeof window.BulaPayDB.getCurrentUser === 'function') ? window.BulaPayDB.getCurrentUser() : null;
        devLinks.style.display = currentUser ? 'none' : 'flex';
      }

      let targetSectionId = `view-${route}`;
      let targetSection = document.getElementById(targetSectionId);

      if (!targetSection) {
        console.warn(`Ruta desconocida: ${route}. Redirigiendo a auth.`);
        targetSection = document.getElementById('view-auth');
        route = 'auth';
      }

      const user = (window.BulaPayDB && typeof window.BulaPayDB.getCurrentUser === 'function') ? window.BulaPayDB.getCurrentUser() : null;
      const curName = user ? String(user.username || '').toLowerCase() : '';
      const curDoc = user ? String(user.documentNumber || '').trim() : '';
      const curRole = user ? String(user.role || '').trim() : '';

      const isUserMasterAdmin = user && (curName === 'admin' || curRole === 'Superadministrador' || curRole === 'Superadmin');
      const isUserSupervisor = user && !isUserMasterAdmin && (curRole === 'Usuario Supervisor' || curRole === 'Supervisor' || curRole === 'Administrador' || curRole === 'Administrador de Rutas' || curRole.includes('Comercio') || curRole.includes('Otros') || curRole.toLowerCase().includes('supervisor'));
      const agentRoles = ['Agente de Ruta', 'agent', 'Agente Independiente'];

      // SEGURIDAD DE RUTAS RBAC:
      // 1. Si Usuario Supervisor estándar intenta entrar a Superadmin Maestro, redirigir a #supervisor
      if (isUserSupervisor && route === 'superadmin') {
        console.warn('⛔ Usuario Supervisor intentando acceder a Superadmin Maestro. Redirigiendo a panel de supervisor.');
        sessionStorage.removeItem('credi_superadmin_active');
        this.navigate('supervisor');
        return;
      }

      // 2. Si un Administrador o Supervisor intenta abrir interfaz de agentes, redirigir adecuadamente
      if ((isUserSupervisor || isUserMasterAdmin) && (route === 'agent' || route === 'agent-login')) {
        console.warn('⛔ Acceso restringido: Usuario administrativo no puede abrir interfaz de agentes.');
        if (isUserMasterAdmin) {
          sessionStorage.setItem('credi_superadmin_active', 'true');
          this.navigate('superadmin');
        } else {
          sessionStorage.removeItem('credi_superadmin_active');
          this.navigate('supervisor');
        }
        return;
      }

      if (route === 'agent' && (!user || !agentRoles.includes(user.role))) {
        console.warn('Acceso denegado a terminal de agente. Redirigiendo.');
        this.renderView('agent-login');
        window.location.hash = '#agent-login';
        return;
      } 
      
      if (route === 'agent-login' && user && agentRoles.includes(user.role)) {
        this.renderView('agent');
        window.location.hash = '#agent';
        return;
      }

      // ACTIVACIÓN INMEDIATA DEL ELEMENTO DE LA VISTA EN EL DOM (Evita pantalla en blanco al 100%)
      const sections = document.querySelectorAll('.view-section');
      sections.forEach(s => {
        if (s !== targetSection) {
          s.classList.remove('active');
          s.style.display = 'none';
        }
      });

      if (window.supervisorModule && typeof window.supervisorModule.destroy === 'function') {
        try { window.supervisorModule.destroy(); } catch(e) {}
      }
      if (window.agentModule && typeof window.agentModule.destroy === 'function') {
        try { window.agentModule.destroy(); } catch(e) {}
      }

      targetSection.classList.add('active');
      targetSection.style.display = 'block';
      targetSection.style.visibility = 'visible';
      targetSection.style.opacity = '1';

      // Inicializar el módulo JS correspondiente en bloque try-catch seguro
      try {
        if (route === 'supervisor' && window.supervisorModule) {
          await window.supervisorModule.init();
        } else if (route === 'agent' && window.agentModule) {
          await window.agentModule.init();
        } else if (route === 'agent-login' && window.authModule) {
          await window.authModule.init();
        } else if (route === 'customer' && window.customerModule) {
          await window.customerModule.init(param);
        } else if (route === 'auth' && window.authModule) {
          await window.authModule.init();
        }
      } catch (err) {
        console.error(`Error no bloqueante al inicializar módulo para ruta [${route}]:`, err);
      }

      // Scroll al inicio de la página
      window.scrollTo(0, 0);
    }
  },

  // Inicializar PWA e instalador inteligente (Android + iOS)
  pwa: {
    deferredPrompt: null,

    init() {
      // 1. Auto-destrucción y re-registro forzoso de Service Worker
      if ('serviceWorker' in navigator) {
        if (document.readyState === 'complete') {
          if (window.forcePurgeAndRegisterServiceWorker) window.forcePurgeAndRegisterServiceWorker();
        } else {
          window.addEventListener('load', () => {
            if (window.forcePurgeAndRegisterServiceWorker) window.forcePurgeAndRegisterServiceWorker();
          });
        }
      }

      // 2. Verificar si la app ya corre como PWA nativa (Standalone)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone === true;

      if (isStandalone) {
        console.log('⚡ BulaPay ejecutándose en modo Standalone PWA.');
        return;
      }

      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      // 3. Android / Chrome / Edge: Manejo de beforeinstallprompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.showAndroidBanner();
      });

      // 4. iOS Safari: Banner explicativo de instalación manual
      if (isIOS && !sessionStorage.getItem('iosPwaBannerDismissed')) {
        window.addEventListener('load', () => {
          setTimeout(() => this.showIOSModal(), 2500);
        });
      }

      // 5. App instalada exitosamente
      window.addEventListener('appinstalled', () => {
        console.log('🎉 BulaPay PWA instalada en el dispositivo.');
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.remove();
        const installBtn = document.getElementById('btn-install-pwa');
        if (installBtn) installBtn.style.display = 'none';
      });
    },

    showAndroidBanner() {
      if (document.getElementById('pwa-install-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'pwa-install-banner';
      banner.className = 'pwa-install-banner';
      banner.innerHTML = `
        <div class="pwa-banner-content">
          <img src="./assets/icon-192.png" alt="BulaPay Logo" class="pwa-banner-icon">
          <div class="pwa-banner-text">
            <h4>Instalar BulaPay</h4>
            <p>Acceso directo a tu cartera y rutas</p>
          </div>
        </div>
        <div class="pwa-banner-actions">
          <button id="btn-install-bulapay-banner" class="btn-pwa-install">Instalar</button>
          <button id="btn-close-pwa-banner" class="btn-pwa-close">&times;</button>
        </div>
      `;
      document.body.appendChild(banner);

      const triggerInstall = async () => {
        if (!this.deferredPrompt) return;
        banner.style.display = 'none';
        this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        console.log('Resultado instalación PWA:', choice.outcome);
        this.deferredPrompt = null;
      };

      document.getElementById('btn-install-bulapay-banner')?.addEventListener('click', triggerInstall);
      
      const mainBtn = document.getElementById('btn-install-pwa');
      if (mainBtn) {
        mainBtn.style.display = 'inline-block';
        mainBtn.addEventListener('click', triggerInstall);
      }

      document.getElementById('btn-close-pwa-banner')?.addEventListener('click', () => {
        banner.remove();
      });
    },

    showIOSModal() {
      if (document.getElementById('pwa-install-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'pwa-install-banner';
      banner.className = 'pwa-install-banner';
      banner.innerHTML = `
        <div class="ios-instruction-box">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; color:#00f5d4; font-size:14px; font-weight:700;">📲 Instala BulaPay en tu iPhone</h4>
            <button id="btn-close-ios-banner" class="btn-pwa-close">&times;</button>
          </div>
          <p style="margin:6px 0 6px 0; color:#cbd5e1; font-size:12px;">Para instalar la App nativa:</p>
          <div style="margin-top:6px; font-size:13px; line-height:1.5; color:#e2e8f0;">
            <p style="margin:0 0 6px 0;">1. Toca el botón Compartir <span class="ios-share-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; margin-top: -3px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> en tu navegador.</p>
            <p style="margin:0;">2. Selecciona <strong>"Añadir a pantalla de inicio" ➕</strong>.</p>
          </div>
        </div>
      `;
      document.body.appendChild(banner);

      document.getElementById('btn-close-ios-banner')?.addEventListener('click', () => {
        sessionStorage.setItem('iosPwaBannerDismissed', 'true');
        banner.remove();
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
  if (window.adsModule && typeof window.adsModule.updateComunicadosBadge === 'function') {
    window.adsModule.updateComunicadosBadge();
  }
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
  const role = localStorage.getItem('crediRole') || 'supervisor';
  
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

// Purga automática de Service Workers y comunicados obsoletos en caché local (bulapay-v350)
window.forcePurgeAndRegisterServiceWorker = async function() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const newReg = await navigator.serviceWorker.register('./sw.js');
    console.log('✔ Service Worker BulaPay registrado con éxito. Scope:', newReg.scope);

    const pwaStatus = document.getElementById('pwa-status');
    if (pwaStatus) pwaStatus.textContent = 'PWA Activa (BulaPay)';
  } catch (err) {
    console.error('❌ Error al registrar el Service Worker:', err);
  }
};

// Registro de Service Worker BulaPay PWA
if ('serviceWorker' in navigator) {
  const triggerRegister = () => {
    window.forcePurgeAndRegisterServiceWorker();
  };

  if (document.readyState === 'complete') {
    triggerRegister();
  } else {
    window.addEventListener('load', triggerRegister);
  }
}

// Fin de Controlador Principal BulaPay PWA
