// Módulo Interceptor de Anuncios y Publicidad BulaPay (bulapay-v327)

const adsModule = {
  isShowing: false,
  pendingCallback: null,

  // Obtener fecha actual local en formato ISO YYYY-MM-DD
  getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Evaluar si una fecha cae dentro del rango [start_date, end_date]
  isDateInRange(todayStr, startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return true;
    return todayStr >= startDateStr && todayStr <= endDateStr;
  },

  // Método principal para evaluar e interceptar navegación o acciones del usuario
  async checkAndShowAd(triggerType, onCompleteCallback) {
    try {
      if (typeof window.BulaPayDB === 'undefined' || typeof window.BulaPayDB.getAnnouncements !== 'function') {
        if (typeof onCompleteCallback === 'function') onCompleteCallback();
        return;
      }

      const allAds = await window.BulaPayDB.getAnnouncements();
      const todayStr = this.getTodayString();

      // Filtrar anuncios activos, vigentes y que tengan el detonante correspondiente
      const matchingAds = (allAds || []).filter(ad => {
        if (ad.active === false || ad.active === 'false') return false;
        
        const startDate = ad.fecha_inicio || ad.start_date;
        const endDate = ad.fecha_fin || ad.end_date;

        // Validar rango de fechas
        if (!this.isDateInRange(todayStr, startDate, endDate)) return false;

        const isNavTrigger = ad.detonante_general === true || ad.detonante_general === 'true' || ad.trigger_navigation === true || ad.trigger_navigation === 'true';
        const isClientTrigger = ad.detonante_cliente === true || ad.detonante_cliente === 'true' || ad.trigger_client_search === true || ad.trigger_client_search === 'true';

        // Validar detonante
        if (triggerType === 'navigation') {
          return isNavTrigger;
        } else if (triggerType === 'client_search') {
          return isClientTrigger;
        }
        return false;
      });

      if (!matchingAds || matchingAds.length === 0) {
        if (typeof onCompleteCallback === 'function') onCompleteCallback();
        return;
      }

      // Seleccionar un anuncio coincidente aleatorio entre los vigentes
      const selectedAd = matchingAds[Math.floor(Math.random() * matchingAds.length)];
      this.displayAdModal(selectedAd, onCompleteCallback);

    } catch (e) {
      console.warn("Fallo en verificación de anuncios:", e);
      if (typeof onCompleteCallback === 'function') onCompleteCallback();
    }
  },

  displayAdModal(ad, callback) {
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
    const cat = ad.categoria || ad.category || 'Comercial';
    if (categoryEl) categoryEl.textContent = cat;

    let badgeColor = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    if (cat === 'Institucional') badgeColor = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
    if (cat === 'Promoción') badgeColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';

    if (badgeEl) {
      badgeEl.style.background = badgeColor;
    }

    // Descripción
    if (descEl) {
      descEl.textContent = ad.descripcion || ad.title_description || ad.description || 'Aviso Publicitario Importante';
    }

    // Imagen o gráfico
    const mediaUrl = ad.multimedia_url || ad.media_url || '';
    if (mediaContainer && mediaImg) {
      if (mediaUrl && mediaUrl.trim() !== '') {
        mediaImg.src = mediaUrl;
        mediaContainer.style.display = 'block';
      } else {
        mediaContainer.style.display = 'none';
        mediaImg.src = '';
      }
    }

    // Mostrar modal con animación de entrada
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('active');
  },

  closeAdModal() {
    const modal = document.getElementById('pwa-ad-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.setProperty('display', 'none', 'important');
    }

    this.isShowing = false;
    if (typeof this.pendingCallback === 'function') {
      const cb = this.pendingCallback;
      this.pendingCallback = null;
      cb();
    }
  }
};

window.adsModule = adsModule;
