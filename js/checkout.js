/**
 * Módulo de Checkout - Pago Manual y Cuentas de Recaudo Oficiales
 * Valor Fijo de Suscripción: $50.000 COP
 */

window.BulaPayCheckout = {
  config: {
    montoMensualidadCOP: 50000, // $50.000 COP Fijo
    moneda: 'COP'
  },

  /**
   * Copiar número de cuenta al portapapeles con notificación visual
   */
  async copiarNumero(numero, bancoName = 'Cuenta') {
    if (!numero) return;
    const cleanNum = String(numero).trim();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanNum);
      } else {
        const input = document.createElement('input');
        input.value = cleanNum;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `¡Número de ${bancoName} copiado!`,
          text: cleanNum,
          showConfirmButton: false,
          timer: 2000,
          background: '#0f172a',
          color: '#34d399'
        });
      } else {
        alert(`¡Número de ${bancoName} copiado: ${cleanNum}!`);
      }
    } catch(err) {
      console.error("Error al copiar número:", err);
      alert(`Número de cuenta: ${cleanNum}`);
    }
  },

  /**
   * Abre el Modal de Cuentas de Recaudo Oficiales (Nequi / Daviplata)
   * Valor Fijo: $50.000 COP - WhatsApp de Confirmación
   */
  async iniciarPagoSuscripcion(userParam, options = {}) {
    try {
      const user = userParam || (window.BulaPayDB ? window.BulaPayDB.getCurrentUser() : null);
      
      // Obtener cuentas registradas o usar las cuentas oficiales por defecto
      let cuentas = [];
      let waNumber = '3044191522';

      try {
        if (window.BulaPayDB) {
          if (typeof window.BulaPayDB.getCuentas === 'function') {
            cuentas = await window.BulaPayDB.getCuentas();
          }
          if (typeof window.BulaPayDB.getWhatsAppRecaudo === 'function') {
            waNumber = await window.BulaPayDB.getWhatsAppRecaudo();
          }
        }
      } catch(e) {
        console.warn("Error leyendo cuentas o whatsapp:", e);
      }

      // Si no hay cuentas en BD, ofrecer Nequi y Daviplata predeterminadas
      if (!cuentas || cuentas.length === 0) {
        cuentas = [
          { id: 'def_nequi', banco: 'Nequi', tipo_cuenta: 'Billetera Digital', numero_cuenta: '3044191522', titular: 'BulaPay Oficial' },
          { id: 'def_daviplata', banco: 'Daviplata', tipo_cuenta: 'Billetera Digital', numero_cuenta: '3044191522', titular: 'BulaPay Oficial' }
        ];
      }

      let digitsOnly = String(waNumber || '3044191522').replace(/\D/g, '');
      if (digitsOnly.length === 10) digitsOnly = '57' + digitsOnly;
      
      const userNameStr = user ? (user.name || user.username || 'Usuario') : 'Usuario';
      const waMsg = encodeURIComponent(`Hola, adjunto comprobante de pago de mi suscripción BulaPay ($50.000 COP). Usuario: ${userNameStr}`);
      const waUrl = `https://wa.me/${digitsOnly}?text=${waMsg}`;

      // Construcción del HTML de las cuentas
      let cuentasCardsHtml = '';
      cuentas.forEach((c) => {
        const bancoClean = String(c.banco || 'Cuenta').trim();
        const numClean = String(c.numero_cuenta || '').trim();
        const tipoClean = String(c.tipo_cuenta || 'Ahorros').trim();
        const titularClean = String(c.titular || 'BulaPay').trim();
        
        let isNequi = bancoClean.toLowerCase().includes('nequi');
        let isDaviplata = bancoClean.toLowerCase().includes('daviplata');
        let badgeColor = isNequi ? '#f472b6' : (isDaviplata ? '#fca5a5' : '#93c5fd');
        let borderColor = isNequi ? 'rgba(236, 72, 153, 0.35)' : (isDaviplata ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.35)');

        cuentasCardsHtml += `
          <div style="background: #1e293b; border: 1px solid ${borderColor}; border-radius: 12px; padding: 0.9rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; margin-bottom: 0.6rem;">
            <div style="text-align: left; flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span style="background: rgba(255,255,255,0.08); color: ${badgeColor}; font-weight: 800; font-size: 0.8rem; padding: 0.15rem 0.55rem; border-radius: 6px;">
                  🏦 ${bancoClean}
                </span>
                <span style="color: #94a3b8; font-size: 0.75rem;">${tipoClean}</span>
              </div>
              <div style="color: #ffffff; font-size: 1.15rem; font-weight: 900; letter-spacing: 0.5px; margin: 0.2rem 0;">
                ${numClean}
              </div>
              <div style="color: #64748b; font-size: 0.75rem;">
                Titular: <strong style="color: #cbd5e1;">${titularClean}</strong>
              </div>
            </div>
            <button type="button" 
                    onclick="window.BulaPayCheckout.copiarNumero('${numClean}', '${bancoClean}')"
                    style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 0.55rem 0.9rem; border-radius: 8px; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
              📋 Copiar
            </button>
          </div>
        `;
      });

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: '💳 Cuentas de Recaudo Oficiales',
          html: `
            <div style="text-align: center; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.85rem;">
              
              <!-- Banner con Monto Fijo -->
              <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.15)); padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.4);">
                <span style="color: #94a3b8; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Valor Fijo de Renovación</span>
                <div style="color: #34d399; font-size: 2rem; font-weight: 900; margin: 0.2rem 0;">$50.000 COP</div>
                <span style="color: #e2e8f0; font-size: 0.82rem; font-weight: 600; display: block;">Licencia Mensual BulaPay (+30 Días)</span>
              </div>

              <p style="text-align: left; margin: 0; color: #94a3b8; font-size: 0.82rem;">
                Realiza la transferencia por el valor de <strong>$50.000 COP</strong> a cualquiera de las siguientes cuentas oficiales y envía el comprobante por WhatsApp para tu reactivación:
              </p>

              <!-- Lista de Cuentas -->
              <div style="max-height: 240px; overflow-y: auto; padding-right: 0.2rem;">
                ${cuentasCardsHtml}
              </div>

            </div>
          `,
          showCancelButton: true,
          confirmButtonText: '💬 Enviar Comprobante (WhatsApp)',
          confirmButtonColor: '#25D366',
          cancelButtonText: 'Cerrar',
          cancelButtonColor: '#64748b',
          background: '#0f172a',
          color: '#ffffff',
          width: '540px',
          target: document.body
        }).then((res) => {
          if (res.isConfirmed) {
            window.open(waUrl, '_blank');
          }
        });
      } else {
        window.open(waUrl, '_blank');
      }
    } catch(err) {
      console.error("Error al mostrar Cuentas de Recaudo Oficiales:", err);
      alert("No se pudo cargar el panel de cuentas de recaudo.");
    }
  }
};
