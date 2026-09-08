// Módulo Interceptor de Anuncios y Publicidad BulaPay (bulapay-v337)

const adsModule = {
  isShowing: false,
  pendingCallback: null,
  currentAd: null,

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

  // Helper para evaluación de franja horaria HH:MM
  isTimeInRange(currentTimeStr, startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) return true;
    try {
      const toMinutes = (tStr) => {
        if (!tStr || typeof tStr !== 'string') return 0;
        const parts = tStr.trim().split(':').map(Number);
        return (parts[0] || 0) * 60 + (parts[1] || 0);
      };
      const cur = toMinutes(currentTimeStr);
      const start = toMinutes(startTimeStr);
      const end = toMinutes(endTimeStr);

      if (start <= end) {
        return cur >= start && cur <= end;
      } else {
        return cur >= start || cur <= end;
      }
    } catch(e) {
      return true;
    }
  },

  // Helper para detectar si la URL o base64 corresponde a un video
  isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim().toLowerCase();
    
    // 1. Data URI de video
    if (cleanUrl.startsWith('data:video/')) return true;

    // 2. Extensiones de archivo de video conocidas
    const videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg', '.3gp', '.mkv'];
    if (videoExtensions.some(ext => cleanUrl.includes(ext))) return true;

    // 3. Tipos MIME o parametros URL
    if (cleanUrl.includes('video/') || cleanUrl.includes('type=video') || cleanUrl.includes('format=mp4')) return true;

    return false;
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

      console.log(`📢 [BulaPay Anuncios bulapay-v337] Evaluando evento: "${triggerType}". Fecha actual local: "${todayStr}". Total anuncios en sistema:`, (allAds || []).length);

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      // Filtrar anuncios activos y que coincidan con la fecha, franja horaria y detonante
      const matchingAds = (allAds || []).filter((ad, idx) => {
        if (!ad) return false;
        
        const isActive = ad.active !== false && ad.active !== 'false';
        const startDate = String(ad.fecha_inicio || ad.start_date || '').split('T')[0].trim();
        const endDate = String(ad.fecha_fin || ad.end_date || '').split('T')[0].trim();
        const startTime = String(ad.hora_inicio || ad.start_time || '00:00').trim();
        const endTime = String(ad.hora_fin || ad.end_time || '23:59').trim();

        const inRange = this.isDateInRange(todayStr, startDate, endDate);
        const inTimeRange = this.isTimeInRange(currentTimeStr, startTime, endTime);

        const hasNavConfig = ad.detonante_general !== undefined || ad.trigger_navigation !== undefined;
        const hasClientConfig = ad.detonante_cliente !== undefined || ad.trigger_client_search !== undefined;

        let isNavTrigger = this.isTrue(ad.detonante_general) || this.isTrue(ad.trigger_navigation);
        let isClientTrigger = this.isTrue(ad.detonante_cliente) || this.isTrue(ad.trigger_client_search);

        if (!hasNavConfig && !hasClientConfig) {
          isNavTrigger = true;
          isClientTrigger = true;
        }

        let triggerMatch = false;
        if (triggerType === 'navigation') triggerMatch = isNavTrigger;
        if (triggerType === 'client_search') triggerMatch = isClientTrigger;

        const passes = isActive && inRange && inTimeRange && triggerMatch;

        console.log(`🔎 [Anuncio #${idx + 1} - ${ad.id}] Categoría: "${ad.categoria || ad.category}", Activo: ${isActive}, Fechas: [${startDate} a ${endDate}], Hora [${startTime} a ${endTime}], En Franja: ${inTimeRange}, Detonante Nav: ${isNavTrigger}, Detonante Cliente: ${isClientTrigger}, Coincide Trigger "${triggerType}": ${triggerMatch} ==> RESULTADO: ${passes ? '✅ ACEPTADO' : '❌ DESCARTADO'}`);

        return passes;
      });

      if (!matchingAds || matchingAds.length === 0) {
        console.log(`ℹ️ [BulaPay Anuncios] No hay anuncios activos coincidentes para el evento "${triggerType}".`);
        safeCallback();
        return;
      }

      // Ordenar anuncios por fecha de creación descendente
      matchingAds.sort((a, b) => {
        const timeA = new Date(a.created_at || a.fecha_inicio || a.start_date || 0).getTime();
        const timeB = new Date(b.created_at || b.fecha_inicio || b.start_date || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      // LÓGICA DE ROTACIÓN SECUENCIAL Y ALTERNANCIA (IMAGEN / VIDEO) SIN REPETICIÓN
      const videoAds = matchingAds.filter(a => this.isVideoUrl(a.multimedia_url || a.media_url));
      const imageAds = matchingAds.filter(a => !this.isVideoUrl(a.multimedia_url || a.media_url));

      let lastInfo = {};
      try {
        const rawLast = localStorage.getItem('bula_last_ad_info');
        if (rawLast) lastInfo = JSON.parse(rawLast);
      } catch(e) {}

      const lastType = lastInfo.type; // 'video' | 'image'
      const lastId = lastInfo.id;
      const lastIndex = parseInt(lastInfo.index ?? -1, 10);

      let selectedAd = null;

      // Alternancia estricta: si el último fue imagen, busca video; si fue video, busca imagen
      if (lastType === 'image' && videoAds.length > 0) {
        selectedAd = videoAds.find(a => a.id !== lastId) || videoAds[0];
      } else if (lastType === 'video' && imageAds.length > 0) {
        selectedAd = imageAds.find(a => a.id !== lastId) || imageAds[0];
      }

      // Si no fue posible alternar de tipo, rotar por cola secuencial evitando repetición consecutiva de ID
      if (!selectedAd) {
        let nextIndex = (lastIndex + 1) % matchingAds.length;
        if (matchingAds.length > 1 && matchingAds[nextIndex].id === lastId) {
          nextIndex = (nextIndex + 1) % matchingAds.length;
        }
        selectedAd = matchingAds[nextIndex];
      }

      // Guardar el anuncio seleccionado para la próxima rotación
      const isSelectedVid = this.isVideoUrl(selectedAd.multimedia_url || selectedAd.media_url);
      const newIndex = matchingAds.findIndex(a => a.id === selectedAd.id);
      try {
        localStorage.setItem('bula_last_ad_info', JSON.stringify({
          id: selectedAd.id,
          type: isSelectedVid ? 'video' : 'image',
          index: newIndex >= 0 ? newIndex : 0,
          timestamp: Date.now()
        }));
      } catch(e) {}

      console.log(`🎯 [BulaPay Anuncios bulapay-v337] ¡Anuncio seleccionado por rotación secuencial (${isSelectedVid ? 'VIDEO' : 'IMAGEN'})!`, selectedAd);

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
      this.currentAd = ad;

      // Incrementar impresiones dinámicamente en Supabase/Local DB
      if (ad && ad.id && window.BulaPayDB && typeof window.BulaPayDB.incrementAdImpression === 'function') {
        window.BulaPayDB.incrementAdImpression(ad.id);
      }

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

      console.log("🚀 [BulaPay Anuncios bulapay-v337] Inyectando datos y mostrando #pwa-ad-modal en pantalla...");

      const badgeEl = document.getElementById('pwa-ad-badge');
      const categoryEl = document.getElementById('pwa-ad-category');
      const descEl = document.getElementById('pwa-ad-desc');
      const mediaContainer = document.getElementById('pwa-ad-media-container');
      const continueBtn = document.getElementById('pwa-ad-btn-continue');

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
      const descText = (ad && (ad.descripcion || ad.title_description || ad.description)) || '';
      if (descEl) {
        descEl.textContent = descText;
      }

      // Multimedia: renderizado dinámico de <video> o <img>
      const mediaUrl = (ad && (ad.multimedia_url || ad.media_url)) || '';
      const isVideo = mediaUrl && typeof mediaUrl === 'string' && this.isVideoUrl(mediaUrl);

      // ELIMINACIÓN TOTAL DE LA "X" EN ANUNCIOS DE VIDEO (REQUISITO CRÍTICO UI/UX MÓVIL)
      const closeBtn = modal.querySelector('.pwa-ad-close-btn');
      if (closeBtn) {
        if (isVideo) {
          closeBtn.style.setProperty('display', 'none', 'important');
        } else {
          closeBtn.style.setProperty('display', 'flex', 'important');
        }
      }

      // BLOQUEO INICIAL DEL BOTÓN CONTINUAR EN VIDEOS
      if (isVideo && continueBtn) {
        continueBtn.disabled = true;
        continueBtn.style.opacity = '0.5';
        continueBtn.style.pointerEvents = 'none';
        continueBtn.style.cursor = 'not-allowed';
        continueBtn.innerHTML = '⏳ Viendo Video... ➔';
      } else if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.style.opacity = '1';
        continueBtn.style.pointerEvents = 'auto';
        continueBtn.style.cursor = 'pointer';
        continueBtn.innerHTML = 'Continuar ➔';
      }

      if (mediaContainer) {
        const cleanMediaUrl = typeof mediaUrl === 'string' ? mediaUrl.trim() : '';
        if (cleanMediaUrl !== '') {
          mediaContainer.style.display = 'block';
          if (isVideo) {
            console.log("🎬 [BulaPay Anuncios bulapay-v337] Detectado archivo de video. Renderizando <video> (bloqueando botón continuar hasta finalización):", cleanMediaUrl.substring(0, 60));
            mediaContainer.innerHTML = `
              <video 
                id="pwa-ad-video" 
                class="pwa-ad-modal-video" 
                controls 
                autoplay 
                muted 
                playsinline 
                style="width: 100%; height: 100%; max-height: 80vh; object-fit: contain; border: none; background: transparent; display: block;">
                <source src="${cleanMediaUrl}">
                Tu navegador no soporta la reproducción de video.
              </video>
            `;

            // Escuchar finalización del video (100% de reproducción) para desbloquear botón "Continuar"
            setTimeout(() => {
              const videoEl = document.getElementById('pwa-ad-video');
              if (videoEl) {
                const unlockContinueBtn = () => {
                  if (continueBtn) {
                    continueBtn.disabled = false;
                    continueBtn.style.opacity = '1';
                    continueBtn.style.pointerEvents = 'auto';
                    continueBtn.style.cursor = 'pointer';
                    continueBtn.innerHTML = 'Continuar ➔';
                    console.log("✅ [BulaPay Anuncios bulapay-v337] Video finalizado (ended/60s). Botón 'Continuar' desbolqueado.");
                  }
                };

                // 1. Evento ended al llegar al 100%
                videoEl.addEventListener('ended', unlockContinueBtn);

                // 2. Evento timeupdate para restringir máximo a 60 segundos
                videoEl.addEventListener('timeupdate', () => {
                  if (videoEl.currentTime >= 60) {
                    videoEl.pause();
                    unlockContinueBtn();
                  }
                });

                // Fallback de seguridad en 60s
                setTimeout(() => {
                  if (continueBtn && continueBtn.disabled) {
                    unlockContinueBtn();
                  }
                }, 60000);
              }
            }, 100);

          } else {
            console.log("🖼️ [BulaPay Anuncios bulapay-v337] Detectada imagen. Renderizando <img>:", cleanMediaUrl.substring(0, 60));
            mediaContainer.innerHTML = `
              <img 
                id="pwa-ad-image" 
                class="pwa-ad-modal-image" 
                src="${cleanMediaUrl}" 
                alt="Anuncio Publicitario" 
                style="width: 100%; height: 100%; max-height: 80vh; object-fit: contain; border: none; background: transparent; display: block;">
            `;
          }

          // REQUISITO: Ocultar la descripción por completo si es un VIDEO para pantalla limpia sin texto estorboso
          if (descEl) {
            if (isVideo) {
              descEl.style.display = 'none';
            } else if (!descText || descText.includes('Módulo de Anuncios BulaPay') || descText.includes('Aviso Publicitario')) {
              descEl.style.display = 'none';
            } else {
              descEl.style.display = 'block';
            }
          }
        } else {
          mediaContainer.style.display = 'none';
          mediaContainer.innerHTML = '';
          if (descEl) descEl.style.display = 'block';
        }
      }

      // Mostrar modal en primer plano forzando inline cssText absoluto
      modal.style.cssText = 'display: flex !important; z-index: 1000000 !important; opacity: 1 !important; visibility: visible !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; top: 0 !important; left: 0 !important; background: rgba(11, 19, 43, 0.92) !important; align-items: center !important; justify-content: center !important;';
      modal.classList.add('active');

      console.log("✅ [BulaPay Anuncios bulapay-v337] Modal publicitario visible en pantalla.");

    } catch (e) {
      console.error("❌ Error mostrando modal de anuncio:", e);
      if (typeof callback === 'function') callback();
    }
  },

  closeAdModal() {
    try {
      // Incrementar clics / interacciones al cerrar o continuar
      if (this.currentAd && this.currentAd.id && window.BulaPayDB && typeof window.BulaPayDB.incrementAdClick === 'function') {
        window.BulaPayDB.incrementAdClick(this.currentAd.id);
      }

      const modal = document.getElementById('pwa-ad-modal');
      if (modal) {
        modal.classList.remove('active');
        if (modal.style) {
          modal.style.setProperty('display', 'none', 'important');
        }

        const videoEl = modal.querySelector('video');
        if (videoEl) {
          try {
            if (typeof videoEl.pause === 'function') videoEl.pause();
            videoEl.src = '';
            videoEl.load();
          } catch(eVid) {}
        }
      }
    } catch(e) {
      console.warn("Error cerrando modal de anuncio:", e);
    }

    this.isShowing = false;
    this.currentAd = null;
    if (typeof this.pendingCallback === 'function') {
      const cb = this.pendingCallback;
      this.pendingCallback = null;
      try { cb(); } catch(e) {}
    }
  },

  async updateComunicadosBadge() {
    const btnList = document.querySelectorAll('.btn-comunicados-nav, #btn-pwa-comunicados');
    const badgeList = document.querySelectorAll('.comunicados-badge, #pwa-comunicados-count');

    try {
      const notifs = (window.BulaPayDB && typeof window.BulaPayDB.getNotificaciones === 'function')
        ? await window.BulaPayDB.getNotificaciones()
        : [];

      let readIds = new Set();
      try {
        const rawRead = localStorage.getItem('bula_read_notif_ids');
        if (rawRead) readIds = new Set(JSON.parse(rawRead));
      } catch(e) {}

      // Excluir el de bienvenida limpio para no marcar badge falso si no hay notificaciones reales
      const unreadList = (notifs || []).filter(n => n && n.id && n.id !== 'notif_welcome_clean' && !readIds.has(String(n.id)));
      const count = unreadList.length;

      btnList.forEach(btn => {
        if (count > 0) {
          btn.classList.add('has-unread');
        } else {
          btn.classList.remove('has-unread');
        }
      });

      badgeList.forEach(badgeEl => {
        if (count > 0) {
          badgeEl.textContent = count > 99 ? '99+' : String(count);
          badgeEl.style.display = 'inline-flex';
        } else {
          badgeEl.textContent = '0';
          badgeEl.style.display = 'none';
        }
      });
    } catch(e) {
      console.warn("Error actualizando badge de comunicados:", e);
    }
  },

  async openComunicadosModal() {
    const modal = document.getElementById('modal-pwa-comunicados');
    const content = document.getElementById('modal-pwa-comunicados-content');
    if (!modal) return;

    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }

    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('active');

    if (content) {
      content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">⏳ Cargando comunicados oficiales en tiempo real...</p>';
      try {
        let notifs = [];
        if (window.BulaPayDB && typeof window.BulaPayDB.getNotificaciones === 'function') {
          notifs = await window.BulaPayDB.getNotificaciones();
        }

        // Marcar notificaciones como leídas al abrir la bandeja
        if (Array.isArray(notifs) && notifs.length > 0) {
          try {
            let readIds = new Set();
            try {
              const rawRead = localStorage.getItem('bula_read_notif_ids');
              if (rawRead) readIds = new Set(JSON.parse(rawRead));
            } catch(e) {}
            notifs.forEach(n => { if (n && n.id) readIds.add(String(n.id)); });
            localStorage.setItem('bula_read_notif_ids', JSON.stringify(Array.from(readIds)));
          } catch(e) {}
        }

        await this.updateComunicadosBadge();

        if (!notifs || !Array.isArray(notifs) || notifs.length === 0) {
          content.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #94a3b8;">
              <span style="font-size: 2rem;">📭</span>
              <p style="margin-top: 0.5rem; font-weight: 600;">No hay comunicados disponibles</p>
            </div>
          `;
          return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 0.85rem;">';
        notifs.forEach(n => {
          const dateStr = n.created_at ? new Date(n.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          const cat = n.categoria || n.category || 'Institucional';
          let badgeColor = 'rgba(59, 130, 246, 0.2)';
          let textColor = '#60a5fa';
          if (cat.includes('Gerencial') || cat.includes('Aviso') || cat.includes('Urgente')) {
            badgeColor = 'rgba(245, 158, 11, 0.2)';
            textColor = '#fbbf24';
          } else if (cat.includes('Institucional')) {
            badgeColor = 'rgba(16, 185, 129, 0.2)';
            textColor = '#34d399';
          }

          html += `
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.4rem;">
                <span style="background: ${badgeColor}; color: ${textColor}; font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 6px; text-transform: uppercase;">
                  ${cat}
                </span>
                <span style="font-size: 0.72rem; color: #94a3b8;">${dateStr}</span>
              </div>
              <h4 style="color: #ffffff; margin: 0 0 0.4rem 0; font-size: 0.95rem; font-weight: 700;">
                ${n.titulo || n.title || 'Comunicado Oficial'}
              </h4>
              <p style="color: #cbd5e1; font-size: 0.85rem; line-height: 1.45; margin: 0; white-space: pre-line;">
                ${n.mensaje || n.message || n.content || ''}
              </p>
            </div>
          `;
        });
        html += '</div>';
        content.innerHTML = html;

      } catch(e) {
        console.error("Error al renderizar comunicados:", e);
        content.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 1rem;">Error al cargar los comunicados.</p>';
      }
    }
  },

  closeComunicadosModal() {
    const modal = document.getElementById('modal-pwa-comunicados');
    if (modal) {
      modal.style.setProperty('display', 'none', 'important');
      modal.classList.remove('active');
    }
    this.updateComunicadosBadge();
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
      console.log("3️⃣ Anuncios leídos desde Supabase/DB (BulaPayDB.getAnnouncements):", dbAds.length, dbAds);
    }
  } catch(e) {
    console.error("❌ Error consultando BulaPayDB.getAnnouncements:", e);
  }

  const allAds = (dbAds && dbAds.length > 0) ? dbAds : localList;
  console.log("4️⃣ Anuncios combinados activos a evaluar:", allAds.length);

  const todayStr = new Date().toISOString().split('T')[0];
  allAds.forEach((ad, i) => {
    const isActive = adsModule.isTrue(ad.activo) || adsModule.isTrue(ad.active) || adsModule.isTrue(ad.estado);
    const startDate = ad.fecha_inicio || ad.start_date || '';
    const endDate = ad.fecha_fin || ad.end_date || '';
    const inRange = adsModule.isDateInRange(todayStr, startDate, endDate);
    const navTrig = adsModule.isTrue(ad.detonante_navegacion) || adsModule.isTrue(ad.trigger_navigation);
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

// Auto-ejecución inicial para lectura y actualización dinámica del badge de comunicados (bulapay-v339)
const triggerBadgeUpdate = () => {
  if (window.adsModule && typeof window.adsModule.updateComunicadosBadge === 'function') {
    window.adsModule.updateComunicadosBadge();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', triggerBadgeUpdate);
} else {
  setTimeout(triggerBadgeUpdate, 150);
}

// Escuchas de reactivación al cambiar foco de pantalla en teléfono móvil
window.addEventListener('focus', triggerBadgeUpdate);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') triggerBadgeUpdate();
});

// Actualización periódica y ante cambios de visibilidad en PWA (bulapay-v346)
window.addEventListener('storage', (e) => {
  if (e.key === 'bulapay_comunicados_oficiales' || e.key === 'bula_notificaciones') {
    triggerBadgeUpdate();
  }
});
