// Módulo Interceptor de Anuncios y Publicidad BulaPay (bulapay-v330)

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

  // Helper para evaluación booleana estricta y segura
  isTrue(val) {
    return val === true || val === 'true' || val === 1 || val === '1';
  },

  // Evaluar si una fecha cae dentro del rango [start_date, end_date] con normalización YYYY-MM-DD
  isDateInRange(todayStr, startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return true;
    if (!todayStr) return true;
    
    const cleanStart = String(startDateStr).split('T')[0].trim();
    const cleanEnd = String(endDateStr).split('T')[0].trim();
    const cleanToday = String(todayStr).split('T')[0].trim();

    if (!cleanStart || !cleanEnd) return true;

    return cleanToday >= cleanStart && cleanToday <= cleanEnd;
  },

  // Método principal para evaluar e interceptar navegación o acciones del usuario
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

    try {
      if (typeof window.BulaPayDB === 'undefined' || typeof window.BulaPayDB.getAnnouncements !== 'function') {
        console.warn("⚠️ [BulaPay Anuncios] BulaPayDB.getAnnouncements no está disponible.");
        safeCallback();
        return;
      }

      const allAds = await window.BulaPayDB.getAnnouncements();
      const todayStr = this.getTodayString();

      console.log(`📢 [BulaPay Anuncios v330] Evaluando evento: "${triggerType}". Fecha actual: "${todayStr}". Total anuncios encontrados en sistema:`, (allAds || []).length);

      // Filtrar anuncios activos, vigentes y que tengan el detonante correspondiente
      const matchingAds = (allAds || []).filter((ad, idx) => {
        if (!ad) return false;
        
        const isActive = ad.active !== false && ad.active !== 'false';
        const startDate = String(ad.fecha_inicio || ad.start_date || '').split('T')[0].trim();
        const endDate = String(ad.fecha_fin || ad.end_date || '').split('T')[0].trim();

        const inRange = this.isDateInRange(todayStr, startDate, endDate);

        const isNavTrigger = this.isTrue(ad.detonante_general) || this.isTrue(ad.trigger_navigation);
        const isClientTrigger = this.isTrue(ad.detonante_cliente) || this.isTrue(ad.trigger_client_search);

        let triggerMatch = false;
        if (triggerType === 'navigation') triggerMatch = isNavTrigger;
        if (triggerType === 'client_search') triggerMatch = isClientTrigger;

        const passes = isActive && inRange && triggerMatch;

        console.log(`🔎 [Anuncio #${idx + 1} - ${ad.id}] Categoria: "${ad.categoria || ad.category}", Activo: ${isActive}, Fechas: [${startDate || 'N/A'} a ${endDate || 'N/A'}], En Rango: ${inRange}, Detonante Nav: ${isNavTrigger}, Detonante Cliente: ${isClientTrigger}, Coincide Trigger "${triggerType}": ${triggerMatch} ==> RESULTADO: ${passes ? '✅ ACEPTADO' : '❌ DESCARTADO'}`);
        console.log(`   Objeto Anuncio completo:`, ad);

        return passes;
      });

      if (!matchingAds || matchingAds.length === 0) {
        console.log(`ℹ️ [BulaPay Anuncios] No hay anuncios activos coincidentes para el evento "${triggerType}".`);
        safeCallback();
        return;
      }

      const selectedAd = matchingAds[Math.floor(Math.random() * matchingAds.length)];
      console.log(`🎯 [BulaPay Anuncios] ¡Anuncio seleccionado con éxito para desplegar en pantalla!`, selectedAd);

      this.displayAdModal(selectedAd, safeCallback);

    } catch (e) {
      console.error("❌ Excepción en verificación de anuncios:", e);
      safeCallback();
    }
  },

  displayAdModal(ad, callback) {
    try {
      this.pendingCallback = callback;
      this.isShowing = true;

      const modal = document.getElementById('pwa-ad-modal');
      if (!modal) {
        console.warn("⚠️ [BulaPay Anuncios] Elemento #pwa-ad-modal no existe en el DOM.");
        if (typeof callback === 'function') callback();
        return;
      }

      console.log("🚀 [BulaPay Anuncios] Inyectando datos y mostrando #pwa-ad-modal en pantalla...");

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

      // Descripción o mensaje del anuncio
      const descText = (ad && (ad.descripcion || ad.title_description || ad.description)) || 'Aviso Publicitario Importante';
      if (descEl) {
        descEl.textContent = descText;
      }

      // Imagen o gráfico multimedia
      const mediaUrl = (ad && (ad.multimedia_url || ad.media_url)) || '';
      if (mediaContainer && mediaImg) {
        if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim() !== '') {
          mediaImg.src = mediaUrl.trim();
          mediaContainer.style.display = 'block';
        } else {
          mediaContainer.style.display = 'none';
          mediaImg.src = '';
        }
      }

      // Mostrar modal en primer plano con máxima prioridad
      if (modal.style) {
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('z-index', '1000000', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
      }
      modal.classList.add('active');

      console.log("✅ [BulaPay Anuncios] Modal publicitario visible en pantalla.");

    } catch (e) {
      console.error("❌ Error mostrando modal de anuncio:", e);
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
