/**
 * Módulo de Checkout e Integración de Pasarela de Pagos (Wompi / ePayco / Mercado Pago)
 * Gestión automatizada de cobro de mensualidades con soporte para Nequi, Daviplata, PSE y Tarjetas.
 */

window.CrediPayCheckout = {
  // Configuración por defecto de la Pasarela (Colombia)
  config: {
    wompiPublicKey: 'pub_test_Q5y15g9QLiW3s0v2i9B6w4V5e6', // Clave pública por defecto de Wompi
    montoMensualidadCOP: 50000, // $50.000 COP
    moneda: 'COP',
    redirectUrl: window.location.href.split('#')[0],
  },

  /**
   * Obtiene y valida la Llave Pública de Wompi evitando valores 'undefined' o 'null'
   */
  getPublicKey() {
    const key = window.WOMPI_PUBLIC_KEY || 
                (window.env && window.env.WOMPI_PUBLIC_KEY) || 
                localStorage.getItem('wompi_public_key') || 
                this.config.wompiPublicKey || 
                'pub_test_Q5y15g9QLiW3s0v2i9B6w4V5e6';
    const cleanKey = String(key || '').trim();
    return (cleanKey && cleanKey !== 'undefined' && cleanKey !== 'null') 
      ? cleanKey 
      : 'pub_test_Q5y15g9QLiW3s0v2i9B6w4V5e6';
  },

  /**
   * Genera la referencia única de pago cada vez que el usuario hace clic en Pagar.
   * Formato: sub_${userId}_${Date.now()}
   */
  generarReferencia(userIdParam) {
    const cleanUserId = String(userIdParam || 'usuario').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `sub_${cleanUserId}_${Date.now()}`;
  },

  /**
   * Carga dinámicamente el SDK oficial del Widget de Wompi desde CDN
   */
  async cargarWidgetWompiSDK() {
    if (window.WidgetCheckout) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('⚠️ No se pudo cargar widget.js de Wompi desde CDN.');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  },

  /**
   * Abre la configuración y ejecución del WidgetCheckout de Wompi con parámetros totalmente validados
   */
  async iniciarPagoSuscripcion(userParam, options = {}) {
    try {
      const user = userParam || (window.CrediPayDB ? window.CrediPayDB.getCurrentUser() : null);
      if (!user || (!user.username && !user.id)) {
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'warning',
            title: 'Sesión no iniciada',
            text: 'Debes iniciar sesión para renovar tu suscripción.',
            background: '#0f172a',
            color: '#ffffff'
          });
        } else {
          alert('Debes iniciar sesión para renovar tu suscripción.');
        }
        return;
      }

      // 1. Validación de la Llave Pública (publicKey)
      const publicKey = this.getPublicKey();
      if (!publicKey || publicKey === 'undefined' || publicKey === 'null') {
        console.error("❌ Error: Llave pública de Wompi no configurada.");
        alert("Error: La llave pública de Wompi no está configurada correctamente.");
        return;
      }

      // 2. Tipado del Monto: amountInCents debe ser un número entero explícito (5.000.000 centavos = $50.000 COP)
      const montoCOP = Number(options.monto || this.config.montoMensualidadCOP || 50000);
      const amountInCents = parseInt(Math.round(montoCOP * 100), 10); // 5000000 (Number entero)

      // 3. Moneda (currency = 'COP') y Generación de Referencia Única (sub_${userId}_${Date.now()})
      const currency = 'COP';
      const userId = user.id || user.username || user.documentNumber || 'usuario';
      const reference = this.generarReferencia(userId);
      const redirectUrl = options.redirectUrl || this.config.redirectUrl;
      const email = (user.email && user.email.includes('@')) 
        ? String(user.email).trim() 
        : `${user.username || 'usuario'}@credipay.co`;

      console.log("📋 [Wompi Widget Configuration Validated]:", {
        publicKey,
        amountInCents,
        currency,
        reference,
        email,
        redirectUrl
      });

      // Confirmación modal previa antes de abrir el Widget de Wompi
      if (typeof Swal !== 'undefined') {
        const confirmResult = await Swal.fire({
          title: '💳 Pagar Mensualidad CrediPay',
          html: `
            <div style="text-align: left; font-size: 0.9rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: rgba(30, 41, 59, 0.8); padding: 1rem; border-radius: 10px; border: 1px solid rgba(52, 211, 153, 0.3);">
                <span style="color: #94a3b8; font-size: 0.8rem; display: block;">Plan Activo:</span>
                <strong style="color: #34d399; font-size: 1.15rem;">Mensualidad Licencia CrediPay (+30 Días)</strong>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem;">
                  <span>Valor a pagar:</span>
                  <strong style="color: #ffffff; font-size: 1.25rem;">$${montoCOP.toLocaleString('es-CO')} COP</strong>
                </div>
              </div>

              <div style="background: #1e293b; padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <span style="color: #94a3b8; font-size: 0.78rem; display: block; margin-bottom: 0.4rem;">Métodos Disponibles en Wompi:</span>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <span style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">📱 Nequi</span>
                  <span style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">🔴 Daviplata</span>
                  <span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">🏦 PSE (Todos los Bancos)</span>
                  <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">💳 Tarjetas Débito / Crédito</span>
                </div>
              </div>

              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0;">
                ⚡ Al completar el pago, tu cuenta se reactivará de manera <strong>inmediata y automática</strong> sin enviar comprobantes manuales.
              </p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: '🚀 Proceder al Pago Seguro',
          confirmButtonColor: '#10b981',
          cancelButtonText: 'Cancelar',
          cancelButtonColor: '#64748b',
          background: '#0f172a',
          color: '#ffffff',
          width: '540px'
        });

        if (!confirmResult.isConfirmed) return;
      }

      // 4. Cargar e Iniciar WidgetCheckout de Wompi
      const sdkCargado = await this.cargarWidgetWompiSDK();

      if (sdkCargado && typeof window.WidgetCheckout === 'function') {
        console.log("🚀 [Wompi WidgetCheckout] Ejecutando instancia con datos validados...");
        
        // Instancia del Widget de Wompi con parámetros estrictamente validados
        const checkout = new window.WidgetCheckout({
          currency: currency,                          // 'COP'
          amountInCents: parseInt(amountInCents, 10),  // 5000000 (Number entero)
          reference: reference,                        // 'sub_${userId}_${Date.now()}'
          publicKey: publicKey,                        // Llave pública sin espacios ni nulos
          redirectUrl: redirectUrl,
          customerData: {
            email: email,
            fullName: user.name || user.username || 'Usuario CrediPay'
          }
        });

        checkout.open(function (result) {
          const transaction = result ? result.transaction : null;
          console.log('📌 [Wompi Callback Transaction]:', transaction);
          if (transaction && (transaction.status === 'APPROVED' || transaction.status === 'PENDING')) {
            if (typeof Swal !== 'undefined') {
              Swal.fire({
                icon: 'success',
                title: '¡Pago Recibido!',
                text: 'Tu transacción ha sido aprobada. Tu suscripción se ampliará automáticamente.',
                background: '#0f172a',
                color: '#ffffff'
              });
            }
          }
        });
      } else {
        // Redirección directa al Web Checkout de Wompi como fallback
        const wompiCheckoutUrl = `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(publicKey)}&currency=${currency}&amount-in-cents=${amountInCents}&reference=${encodeURIComponent(reference)}&redirect-url=${encodeURIComponent(redirectUrl)}`;
        console.log(`🔗 [Wompi Checkout Fallback] Redirigiendo a: ${wompiCheckoutUrl}`);
        window.location.href = wompiCheckoutUrl;
      }
    } catch (err) {
      console.error("❌ Error al ejecutar el Widget de Wompi:", err);
      alert("Ocurrió un inconveniente al abrir la pasarela de pago. Intenta de nuevo.");
    }
  }
};
