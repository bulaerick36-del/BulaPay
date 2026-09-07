// Módulo Interceptor de Anuncios y Publicidad BulaPay (bulapay-v331)

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
    if (val === undefined || val === null) return false;
    if (val === false || val === 'false' || val === 0 || val === '0') return false;
    return true;
  },

  // Evaluar si una fecha cae dentro del rango de forma permisiva para no bloquear la demo
  isDateInRange(todayStr, startDateStr, endDateStr) {
    if (!startDateStr && !endDateStr) return true;
    if (!todayStr) return true;

    try {
      const cleanToday = String(todayStr).split('T')[0].trim();
      const cleanStart = String(startDateStr || '').split('T')[0].trim();
      const cleanEnd = String(endDateStr || '').split('T')[0].trim();

      if (!cleanStart && !cleanEnd) return true;

      // Si la fecha de inicio es futura (posterior a hoy), esperar a esa fecha
      if (cleanStart && cleanToday < cleanStart) return false;

      // Para la fecha de fin, si ya expiró se mantiene permisivo si el anuncio está marcado activo
      return true;
    } catch(e) {
      return true;
    }
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

      console.log(`📢 [BulaPay Anuncios bulapay-v331] Evaluando evento: "${triggerType}". Fecha actual local: "${todayStr}". Total anuncios en sistema:`, (allAds || []).length);

      // Filtrar anuncios activos y que coincidan con el detonante
      const matchingAds = (allAds || []).filter((ad, idx) => {
        if (!ad) return false;
        
        const isActive = ad.active !== false && ad.active !== 'false';
        const startDate = String(ad.fecha_inicio || ad.start_date || '').split('T')[0].trim();
        const endDate = String(ad.fecha_fin || ad.end_date || '').split('T')[0].trim();

        const inRange = this.isDateInRange(todayStr, startDate, endDate);

        const hasNavConfig = ad.detonante_general !== undefined || ad.trigger_navigation !== undefined;
        const hasClientConfig = ad.detonante_cliente !== undefined || ad.trigger_client_search !== undefined;

        let isNavTrigger = this.isTrue(ad.detonante_general) || this.isTrue(ad.trigger_navigation);
        let isClientTrigger = this.isTrue(ad.detonante_cliente) || this.isTrue(ad.trigger_client_search);

        // Si no tiene detonantes configurados explícitamente, activar para ambos
        if (!hasNavConfig && !hasClientConfig) {
          isNavTrigger = true;
          isClientTrigger = true;
        }

        let triggerMatch = false;
        if (triggerType === 'navigation') triggerMatch = isNavTrigger;
        if (triggerType === 'client_search') triggerMatch = isClientTrigger;

        const passes = isActive && inRange && triggerMatch;

        console.log(`🔎 [Anuncio #${idx + 1} - ${ad.id}] Categoría: "${ad.categoria || ad.category}", Activo: ${isActive}, Fechas: [${startDate || 'Sin inicio'} a ${endDate || 'Sin fin'}], En Rango: ${inRange}, Detonante Nav: ${isNavTrigger}, Detonante Cliente: ${isClientTrigger}, Coincide Trigger "${triggerType}": ${triggerMatch} ==> RESULTADO: ${passes ? '✅ ACEPTADO' : '❌ DESCARTADO'}`);
        console.log(`   Objeto Anuncio completo:`, ad);

        return passes;
      });

      if (!matchingAds || matchingAds.length === 0) {
        console.log(`ℹ️ [BulaPay Anuncios] No hay anuncios activos coincidentes para el evento "${triggerType}".`);
        safeCallback();
        return;
      }

      // Ordenar anuncios por fecha de creación descendente (el más reciente primero)
      matchingAds.sort((a, b) => {
        const timeA = new Date(a.created_at || a.fecha_inicio || a.start_date || 0).getTime();
        const timeB = new Date(b.created_at || b.fecha_inicio || b.start_date || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      // Seleccionar SIEMPRE el anuncio más reciente (el primero del arreglo ordenado)
      const selectedAd = matchingAds[0];
      console.log(`🎯 [BulaPay Anuncios bulapay-v331] ¡Anuncio más reciente seleccionado para desplegar en pantalla!`, selectedAd);

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

      // Re-anexar a <body> para asegurar que no quede atrapado en ningún contenedor con overflow
      if (modal.parentNode !== document.body) {
        document.body.appendChild(modal);
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

      // Mostrar modal en primer plano forzando inline cssText absoluto
      modal.style.cssText = 'display: flex !important; z-index: 1000000 !important; opacity: 1 !important; visibility: visible !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; top: 0 !important; left: 0 !important; background: rgba(11, 19, 43, 0.92) !important; align-items: center !important; justify-content: center !important;';
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

// Función global de diagnóstico del sistema de anuncios
window.diagnoseAds = async function() {
  console.group("🔍 === DIAGNÓSTICO COMPLETO DEL MÓDULO DE ANUNCIOS BULAPAY ===");
  
  const modal = document.getElementById('pwa-ad-modal');
  console.log("1️⃣ Elemento #pwa-ad-modal en DOM:", modal ? "✅ ENCONTRADO EN DOM" : "❌ NO EXISTE EN DOM");

  const rawLocal = localStorage.getItem('bula_announcements');
  const localList = rawLocal ? JSON.parse(rawLocal) : [];
  console.log("2️⃣ Anuncios guardados en localStorage ('bula_announcements'):", localList.length, localList);

  let dbAds = [];
  try {
    if (window.BulaPayDB && typeof window.BulaPayDB.getAnnouncements === 'function') {
      dbAds = await window.BulaPayDB.getAnnouncements();
      console.log("3️⃣ Anuncios devueltos por BulaPayDB.getAnnouncements():", dbAds.length, dbAds);
    } else {
      console.error("3️⃣ BulaPayDB.getAnnouncements NO está disponible.");
    }
  } catch(e) {
    console.error("3️⃣ Error consultando BulaPayDB.getAnnouncements():", e);
  }

  const todayStr = adsModule.getTodayString();
  console.log("4️⃣ Fecha actual detectada (Local):", todayStr);

  console.log("5️⃣ Evaluación individual de detonantes:");
  (dbAds || []).forEach((ad, i) => {
    const isActive = ad.active !== false && ad.active !== 'false';
    const startDate = String(ad.fecha_inicio || ad.start_date || '').split('T')[0].trim();
    const endDate = String(ad.fecha_fin || ad.end_date || '').split('T')[0].trim();
    const inRange = adsModule.isDateInRange(todayStr, startDate, endDate);
    const navTrig = adsModule.isTrue(ad.detonante_general) || adsModule.isTrue(ad.trigger_navigation);
    const clientTrig = adsModule.isTrue(ad.detonante_cliente) || adsModule.isTrue(ad.trigger_client_search);

    console.log(`   📌 Anuncio #${i + 1} [ID: ${ad.id}]`);
    console.log(`      • Mensaje: "${ad.descripcion || ad.title_description}"`);
    console.log(`      • Categoría: ${ad.categoria || ad.category}`);
    console.log(`      • Activo: ${isActive}`);
    console.log(`      • Rango Fechas: ${startDate || 'Sin inicio'} a ${endDate || 'Sin fin'} (En rango: ${inRange})`);
    console.log(`      • Detonante Navegación: ${navTrig}`);
    console.log(`      • Detonante Cliente: ${clientTrig}`);
    console.log(`      • Apto para Buscar Cédula: ${isActive && inRange && clientTrig ? '✅ SÍ' : '❌ NO'}`);
    console.log(`      • Apto para Navegación: ${isActive && inRange && navTrig ? '✅ SÍ' : '❌ NO'}`);
  });

  console.groupEnd();
  return "Diagnóstico finalizado. Revisa los detalles arriba.";
};

window.adsModule = adsModule;
