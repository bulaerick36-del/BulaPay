// Controlador Principal y Enrutador SPA de BulaPay PWA

const app = {
  // Configuración del Enrutador SPA
  router: {
    currentRoute: 'auth',

    async init() {
      // Escuchar cambios de hash
      window.addEventListener('hashchange', () => this.handleRouteFromHash());
      
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
      // 1. Prioridad: Verificar si hay parámetros de consulta URL (ej. ?view=customer&id=12345)
      // Esto es crucial para simular el click de WhatsApp/SMS
      const urlParams = new URLSearchParams(window.location.search);
      const queryView = urlParams.get('view');
      const queryId = urlParams.get('id');

      if (queryView) {
        // Limpiar parámetros de la URL sin recargar para mantener limpia la SPA
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

      // Auto-login automático con usuario admin de Supabase si no hay sesión iniciada
      if (!user) {
        try {
          user = await window.BulaPayDB.getUserByUsername('admin');
          if (user) {
            window.BulaPayDB.setCurrentUser(user);
            // Actualizar navbar de forma segura si el modulo de autenticación está cargado
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
      const hash = window.location.hash.slice(1); // Remover '#'
      const parts = hash.split('/');
      const route = parts[0];
      const param = parts[1] || null;

      this.currentRoute = route;
      this.renderView(route, param);
    },

    async renderView(route, param) {
      // Ocultar todas las secciones
      const sections = document.querySelectorAll('.view-section');
      sections.forEach(s => s.classList.remove('active'));

      // Destruir procesos previos si aplica (ej. animaciones del mapa)
      if (window.supervisorModule) {
        window.supervisorModule.destroy();
      }
      if (window.agentModule && typeof window.agentModule.destroy === 'function') {
        window.agentModule.destroy();
      }

      const targetSectionId = `view-${route}`;
      const targetSection = document.getElementById(targetSectionId);

      if (!targetSection) {
        // Fallback a login si no existe la ruta
        console.warn(`Ruta desconocida: ${route}. Redirigiendo a auth.`);
        this.navigate('auth');
        return;
      }

      // Validaciones de Seguridad y Sesión
      const user = window.BulaPayDB.getCurrentUser();

      if (route === 'supervisor') {
        if (!user || (user.role !== 'Usuario Supervisor' && user.role !== 'Comercio Independiente' && user.role !== 'supervisor' && user.role !== 'Administrador de Rutas' && user.role !== 'Otros (Comercios, Compraventas, Mercados)')) {
          console.warn('Acceso denegado a panel de supervisor. Redirigiendo.');
          this.navigate('auth');
          return;
        }
        await window.supervisorModule.init();
      } 
      
      else if (route === 'agent') {
        if (!user || (user.role !== 'Agente de Ruta' && user.role !== 'agent' && user.role !== 'Agente Independiente')) {
          console.warn('Acceso denegado a terminal de agente. Redirigiendo.');
          this.navigate('agent-login');
          return;
        }
        await window.agentModule.init();
      } 
      
      else if (route === 'agent-login') {
        if (user && (user.role === 'Agente de Ruta' || user.role === 'agent' || user.role === 'Agente Independiente')) {
          this.navigate('agent');
          return;
        }
        await window.authModule.init();
      }
      
      else if (route === 'customer') {
        // El portal de cliente es de acceso público mediante el enlace único
        await window.customerModule.init(param);
      } 
      
      else if (route === 'auth') {
        await window.authModule.init();
      }

      // Mostrar la sección correspondiente
      targetSection.classList.add('active');
      
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
    // Capa de validación de GPS (primera en ejecutarse)
    await this.checkGPSPermission();
    this.setupGPSInstructionsEvents();

    this.pwa.init();
    await this.router.init();
    
    // Inicializar reloj del teléfono móvil simulado
    this.startPhoneClock();
  },

  // Capa de validación de GPS
  async checkGPSPermission() {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        this.handleGPSPermissionStatus(result.state);
        
        // Escuchar cambios de estado del permiso
        result.onchange = () => {
          this.handleGPSPermissionStatus(result.state);
        };
      } catch (err) {
        console.warn("Fallo al consultar navigator.permissions:", err);
        await this.detectGPSPermissionFallback();
      }
    } else {
      await this.detectGPSPermissionFallback();
    }
  },

  async detectGPSPermissionFallback() {
    if (!navigator.geolocation) {
      this.handleGPSPermissionStatus('denied');
      return;
    }
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          this.handleGPSPermissionStatus('granted');
          resolve();
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            this.handleGPSPermissionStatus('denied');
          } else {
            this.handleGPSPermissionStatus('granted');
          }
          resolve();
        },
        { enableHighAccuracy: false, timeout: 3000 }
      );
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
        
        if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente')) {
          const routeId = currentUser.routeId;
          if (routeId) {
            try {
              const route = await window.BulaPayDB.getRouteById(routeId);
              if (route) {
                const openingStr = route.opening_time || '06:00';
                const closingStr = route.closing_time || '18:00';
                const hasExtension = !!route.has_extension;
                
                const [openHrs, openMins] = openingStr.split(':').map(Number);
                const [closeHrs, closeMins] = closingStr.split(':').map(Number);
                
                const openingTime = new Date(now);
                openingTime.setHours(openHrs, openMins, 0, 0);
                
                const closingTime = new Date(now);
                closingTime.setHours(closeHrs, closeMins, 0, 0);
                
                const isOpen = (now >= openingTime && now < closingTime) || hasExtension;
                
                const registerBtn = document.getElementById('btn-agent-register-installment');
                const submitCollectBtn = document.getElementById('btn-submit-collect');
                const noPagoBtn = document.getElementById('btn-payment-card-nopago');
                
                if (isOpen) {
                  if (hasExtension) {
                    routeStatusElement.textContent = `Prórroga Activa`;
                    routeStatusElement.style.color = 'var(--accent)';
                  } else {
                    const diffMs = closingTime - now;
                    const diffMinutesTotal = Math.ceil(diffMs / 60000);
                    const hours = Math.floor(diffMinutesTotal / 60);
                    const minutes = diffMinutesTotal % 60;
                    routeStatusElement.textContent = `Cierra en: ${hours}h ${minutes}m`;
                    routeStatusElement.style.color = 'var(--color-verde)';
                  }
                  
                  if (registerBtn) registerBtn.disabled = false;
                  if (submitCollectBtn) submitCollectBtn.disabled = false;
                  if (noPagoBtn) noPagoBtn.disabled = false;
                } else {
                  routeStatusElement.textContent = 'Ruta Cerrada';
                  routeStatusElement.style.color = 'var(--color-rojo)';
                  
                  if (registerBtn) registerBtn.disabled = true;
                  if (submitCollectBtn) submitCollectBtn.disabled = true;
                  if (noPagoBtn) noPagoBtn.disabled = true;
                }
              }
            } catch (err) {
              console.warn("Fallo al obtener estado de ruta de agente en tiempo real:", err);
            }
          } else {
            routeStatusElement.textContent = 'Sin Ruta';
            routeStatusElement.style.color = 'var(--color-rojo)';
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
    stamp.textContent = '🟡';
    stamp.style.color = 'var(--color-amarillo)';
  } else {
    badge.textContent = 'PAGADO';
    badge.className = 'receipt-badge-status';
    stamp.textContent = '🟢';
    stamp.style.color = 'var(--color-verde)';
  }

  modal.classList.add('active');

  const btnClose = document.getElementById('btn-close-receipt');
  if (btnClose) {
    const handleClose = () => {
      modal.classList.remove('active');
      btnClose.removeEventListener('click', handleClose);
    };
    btnClose.addEventListener('click', handleClose);
  }
};
