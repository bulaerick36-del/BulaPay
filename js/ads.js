// Módulo Interceptor de Anuncios y Publicidad BulaPay (bulapay-v328)

const adsModule = {
  isShowing: false,
  pendingCallback: null,

  // Obtener fecha actual local en formato ISO YYYY-MM-DD
  getTodayString() {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch(e) {
      return '';
    }
  },

  // Evaluar si una fecha cae dentro del rango [start_date, end_date]
  isDateInRange(todayStr, startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return true;
    if (!todayStr) return true;
    return todayStr >= startDateStr && todayStr <= endDateStr;
  },

  // Método principal para evaluar e interceptar navegación o acciones del usuario de forma NO BLOQUEANTE
  async checkAndShowAd(triggerType, onCompleteCallback) {
    let callbackExecuted = false;
    const safeCallback = () => {
      if (!callbackExecuted && typeof onCompleteCallback === 'function') {
        callbackExecuted = true;
        try {
          onCompleteCallback();
        } catch(errCb) {
          console.warn("Error ejecutando callback tras anuncio:", errCb);
        }
      }
    };

    // Timeout de seguridad: Si los anuncios tardan más de 800ms o se congelan, continuar el flujo inmediatamente
    const safetyTimer = setTimeout(() => {
      safeCallback();
    }, 800);

    try {
      if (typeof window.BulaPayDB === 'undefined' || typeof window.BulaPayDB.getAnnouncements !== 'function') {
        clearTimeout(safetyTimer);
        safeCallback();
        return;
      }

      // Consulta protegida con timeout para no congelar promesas
      const adsPromise = window.BulaPayDB.getAnnouncements();
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 600));
      const allAds = await Promise.race([adsPromise, timeoutPromise]);

      const todayStr = this.getTodayString();

      // Filtrar anuncios activos, vigentes y que tengan el detonante correspondiente
      const matchingAds = (allAds || []).filter(ad => {
        if (!ad || ad.active === false || ad.active === 'false') return false;
        
        const startDate = ad.fecha_inicio || ad.start_date;
        const endDate = ad.fecha_fin || ad.end_date;

        if (!this.isDateInRange(todayStr, startDate, endDate)) return false;

        const isNavTrigger = ad.detonante_general === true || ad.detonante_general === 'true' || ad.trigger_navigation === true || ad.trigger_navigation === 'true';
        const isClientTrigger = ad.detonante_cliente === true || ad.detonante_cliente === 'true' || ad.trigger_client_search === true || ad.trigger_client_search === 'true';

        if (triggerType === 'navigation') return isNavTrigger;
        if (triggerType === 'client_search') return isClientTrigger;
        return false;
      });

      if (!matchingAds || matchingAds.length === 0) {
        clearTimeout(safetyTimer);
        safeCallback();
        return;
      }

      // Seleccionar un anuncio coincidente aleatorio entre los vigentes
      const selectedAd = matchingAds[Math.floor(Math.random() * matchingAds.length)];
      clearTimeout(safetyTimer);
      this.displayAdModal(selectedAd, safeCallback);

    } catch (e) {
      console.warn("Excepción silenciosa en verificación de anuncios:", e);
      clearTimeout(safetyTimer);
      safeCallback();
    }
  },

  displayAdModal(ad, callback) {
    try {
      this.pendingCallback = callback;
      this.isShowing = true;

      const modal = document.getElementById('pwa-ad-modal');
      if (!modal) {
        if (typeof callback === 'function') callback();
        return;
      }

      const badgeEl = document.getElementById('pwa-ad-badge');
      const categoryEl = document.getElementById('pwa-ad-category');
      const descEl = document.getElementById('pwa-ad-desc');
      const mediaContainer = document.getElementById('pwa-ad-media-container');
      const mediaImg = document.getElementById('pwa-ad-image');

      // Categoría badge
      const cat = (ad && (ad.categoria || ad.category)) || 'Comercial';
      if (categoryEl) categoryEl.textContent = cat;

      let badgeColor = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
      if (cat === 'Institucional') badgeColor = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
      if (cat === 'Promoción') badgeColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';

      if (badgeEl && badgeEl.style) {
        badgeEl.style.background = badgeColor;
      }

      // Descripción
      if (descEl) {
        descEl.textContent = (ad && (ad.descripcion || ad.title_description || ad.description)) || 'Aviso Publicitario Importante';
      }

      // Imagen o gráfico
      const mediaUrl = (ad && (ad.multimedia_url || ad.media_url)) || '';
      if (mediaContainer && mediaImg) {
        if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim() !== '') {
          mediaImg.src = mediaUrl;
          mediaContainer.style.display = 'block';
        } else {
          mediaContainer.style.display = 'none';
          mediaImg.src = '';
        }
      }

      // Mostrar modal con animación de entrada
      if (modal.style) {
        modal.style.setProperty('display', 'flex', 'important');
      }
      modal.classList.add('active');

    } catch (e) {
      console.warn("Error mostrando modal de anuncio:", e);
      if (typeof callback === 'function') callback();
    }
  },

  closeAdModal() {
    try {
      const modal = document.getElementById('pwa-ad-modal');
      if (modal) {
        modal.classList.remove('active');
        if (modal.style) {
          modal.style.setProperty('display', 'none', 'important');
        }
      }
    } catch(e) {
      console.warn("Error cerrando modal de anuncio:", e);
    }

    this.isShowing = false;
    if (typeof this.pendingCallback === 'function') {
      const cb = this.pendingCallback;
      this.pendingCallback = null;
      try { cb(); } catch(e) {}
    }
  }
};

window.adsModule = adsModule;
