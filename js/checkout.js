/**
 * Módulo de Checkout e Integración de Pasarela de Pagos (Wompi / ePayco / Mercado Pago)
 * Gestión automatizada de cobro de mensualidades con soporte para Nequi, Daviplata, PSE y Tarjetas.
 */

window.CrediPayCheckout = {
  // Configuración por defecto de la Pasarela (Colombia)
  config: {
    wompiPublicKey: 'pub_test_Q5y15g9QLiW3s0v2i9B6w4V5e6', // Clave pública configurable de Wompi / ePayco
    montoMensualidadCOP: 50000, // $50.000 COP
    moneda: 'COP',
    redirectUrl: window.location.href,
  },

  /**
   * Genera la referencia única de pago para el usuario
   */
  generarReferencia(username) {
    const cleanUser = String(username || 'usuario').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `credipay_${cleanUser}_${Date.now()}`;
  },

  /**
   * Abre el Modal / Checkout Automatizado de la Pasarela
   */
  async iniciarPagoSuscripcion(userParam, options = {}) {
    try {
      const user = userParam || (window.CrediPayDB ? window.CrediPayDB.getCurrentUser() : null);
      if (!user || !user.username) {
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

      const monto = options.monto || this.config.montoMensualidadCOP;
      const montoCentavos = monto * 100;
      const referencia = this.generarReferencia(user.username);
      const email = user.email || `${user.username}@credipay.co`;

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
                  <strong style="color: #ffffff; font-size: 1.25rem;">$${monto.toLocaleString('es-CO')} COP</strong>
                </div>
              </div>

              <div style="background: #1e293b; padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <span style="color: #94a3b8; font-size: 0.78rem; display: block; margin-bottom: 0.4rem;">Métodos Disponibles 24/7:</span>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <span style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">📱 Nequi</span>
                  <span style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">🔴 Daviplata</span>
                  <span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">🏦 PSE (Todos los bancos)</span>
                  <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">💳 Tarjeta Débito / Crédito</span>
                </div>
              </div>

              <p style="font-size: 0.78rem; color: #94a3b8; margin: 0;">
                ⚡ Al completar el pago, tu cuenta se reactivará de manera <strong>inmediata y automática</strong> sin necesidad de enviar comprobantes manuales.
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

      // Redirección directa al Checkout Seguro de Wompi / Pasarela de Pagos
      const wompiCheckoutUrl = `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(this.config.wompiPublicKey)}&currency=COP&amount-in-cents=${montoCentavos}&reference=${encodeURIComponent(referencia)}&customer-data:email=${encodeURIComponent(email)}&redirect-url=${encodeURIComponent(window.location.href)}`;
      
      console.log(`🔗 [CrediPay Checkout] Redirigiendo a pasarela con referencia ${referencia}...`);
      window.location.href = wompiCheckoutUrl;
    } catch (err) {
      console.error("❌ Error al iniciar proceso de pago:", err);
      alert("Ocurrió un inconveniente al abrir la pasarela de pago. Intenta de nuevo.");
    }
  }
};
