// Módulo del Agente / Cobrador (Vista Móvil Optimizada)

const COLOMBIA_GEOGRAPHY = {
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Rionegro", "Apartadó", "Turbo", "Caucasia"],
  "Arauca": ["Arauca", "Tame", "Saravena"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanagrande", "Baranoa"],
  "Bolívar": ["Cartagena", "Magangué", "El Carmen de Bolívar", "Turbaco"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa"],
  "Caldas": ["Manizales", "La Dorada", "Chinchiná", "Riosucio"],
  "Caquetá": ["Florencia", "San Vicente del Caguán"],
  "Casanare": ["Yopal", "Aguazul", "Villanueva"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada"],
  "Cesar": ["Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia"],
  "Chocó": ["Quibdó", "Istmina", "Condoto"],
  "Córdoba": ["Montería", "Cereté", "Sahagún", "Lorica", "Montelíbano"],
  "Cundinamarca": ["Bogotá", "Soacha", "Facatativá", "Chía", "Zipaquirá", "Fusagasugá", "Girardot"],
  "Guainía": ["Inírida"],
  "Guaviare": ["San José del Guaviare"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "San Juan del Cesar", "Villanueva"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López"],
  "Nariño": ["Pasto", "Tumaco", "Ipiales", "Túquerres"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Pamplona", "Villa del Rosario"],
  "Putumayo": ["Mocoa", "Orito", "Puerto Asís"],
  "Quindío": ["Armenia", "Calarcá", "Montenegro", "Quimbaya"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil"],
  "Sucre": ["Sincelejo", "Corozal", "San Marcos"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Mariquita", "Líbano"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Yumbo", "Buga", "Cartago"],
  "Vaupés": ["Mitú"],
  "Vichada": ["Puerto Carreño"]
};

let activeGeography = null;

function normalizeName(str) {
  return str.trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
}

async function fetchColombiaGeography() {
  if (activeGeography) return activeGeography;

  const cached = localStorage.getItem('colombia_geography_cached');
  if (cached) {
    try {
      activeGeography = JSON.parse(cached);
      return activeGeography;
    } catch (e) {}
  }

  // Lista de APIs oficiales y de respaldo
  const urls = [
    'https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json',
    'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000',
    'https://www.datos.gov.co/resource/xdk5-pm3f.json?$limit=5000'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const map = {};

        if (Array.isArray(data) && data.length > 0) {
          // Formato marcovega: [{"departamento": "...", "ciudades": [...]}]
          if (data[0].ciudades && Array.isArray(data[0].ciudades)) {
            data.forEach(item => {
              if (item.departamento && item.ciudades) {
                const dptoNorm = normalizeName(item.departamento);
                map[dptoNorm] = item.ciudades.map(city => normalizeName(city));
              }
            });
          } 
          // Formato DIVIPOLA / Datos Abiertos: [{"dpto": "...", "nom_mpio": "..."}]
          else {
            const firstRow = data[0];
            const deptKey = firstRow.dpto ? 'dpto' : (firstRow.departamento ? 'departamento' : null);
            const mpioKey = firstRow.nom_mpio ? 'nom_mpio' : (firstRow.municipio ? 'municipio' : null);

            if (deptKey && mpioKey) {
              data.forEach(item => {
                let dpto = item[deptKey];
                let mpio = item[mpioKey];
                if (dpto && mpio) {
                  dpto = normalizeName(dpto);
                  mpio = normalizeName(mpio);

                  if (!map[dpto]) {
                    map[dpto] = [];
                  }
                  if (!map[dpto].includes(mpio)) {
                    map[dpto].push(mpio);
                  }
                }
              });
            }
          }

          if (Object.keys(map).length > 20) {
            activeGeography = map;
            localStorage.setItem('colombia_geography_cached', JSON.stringify(map));
            return map;
          }
        }
      }
    } catch (err) {
      console.warn(`Error al obtener geografía colombiana desde ${url}:`, err);
    }
  }

  // Fallback
  activeGeography = COLOMBIA_GEOGRAPHY;
  return activeGeography;
}

const agentModule = {
  currentClient: null,
  isMassPaymentMode: false,
  selectedInstallments: [],

  async init() {
    this.tabCollect = document.getElementById('tab-agent-collect');
    this.tabHistory = document.getElementById('tab-agent-history');
    this.tabRegister = document.getElementById('tab-agent-register');
    this.panelCollect = document.getElementById('panel-agent-collect');
    this.panelHistory = document.getElementById('panel-agent-history');
    this.panelRegister = document.getElementById('panel-agent-register');
    
    // Búsqueda
    this.inputSearchCedula = document.getElementById('cobrar-search-input');
    this.btnSearch = document.getElementById('btn-agent-search');
    this.searchPlaceholder = document.getElementById('agent-search-placeholder');
    this.searchError = document.getElementById('agent-search-error');

    // Vista Aislada de Cobro
    this.cobroActionContainer = document.getElementById('cobro-action-container');
    this.cobroClientName = document.getElementById('cobro-client-name');
    this.cobroClientOutstanding = document.getElementById('cobro-client-outstanding');
    this.inputCobroAmount = document.getElementById('input-cobro-amount');
    
    // Contenedores Flujo A y Flujo B
    this.cobroInputState = document.getElementById('cobro-input-state');
    this.cobroCartonState = document.getElementById('cobro-carton-state');
    this.cobroOverdueDaysList = document.getElementById('cobro-overdue-days-list');
    
    // Botones
    this.btnCobroInvoice = document.getElementById('btn-cobro-invoice');
    this.btnCobroCarton = document.getElementById('btn-cobro-carton');
    this.btnCobroBack = document.getElementById('btn-cobro-back');
    this.btnLiquidarCarton = document.getElementById('btn-liquidar-carton');
    this.btnCobroRenovar = document.getElementById('btn-cobro-renovar');
    this.btnCobroLiquidarMora = document.getElementById('btn-cobro-liquidar-mora');
    
    // Modal Factura
    this.cobroInvoiceModal = document.getElementById('cobro-invoice-modal');
    this.invoiceClientName = document.getElementById('invoice-client-name');
    this.invoiceAmount = document.getElementById('invoice-amount');
    this.invoiceNewBalance = document.getElementById('invoice-new-balance');
    this.btnInvoiceConfirm = document.getElementById('btn-invoice-confirm');
    this.btnInvoiceCancel = document.getElementById('btn-invoice-cancel');

    // Búsqueda Historial
    this.inputHistoryCedula = document.getElementById('agent-history-cedula');
    this.btnHistorySearch = document.getElementById('btn-agent-history-search');
    this.historyPlaceholder = document.getElementById('agent-history-placeholder');
    this.historyResults = document.getElementById('agent-history-results');
    this.historyError = document.getElementById('agent-history-error');

    // Detalles Cliente Historial
    this.historyTrafficLight = document.getElementById('history-traffic-light');
    this.historyRiskStatus = document.getElementById('history-risk-status');
    this.historyRiskDot = document.getElementById('history-risk-dot');
    this.historyClientName = document.getElementById('history-client-name');
    this.historyActiveCreditsAlert = document.getElementById('history-active-credits-alert');

    // Cartón de Pagos Modal
    this.btnOpenPaymentCard = document.getElementById('btn-agent-view-carton');
    this.btnRegisterInstallment = document.getElementById('btn-agent-register-installment');
    this.paymentCardModal = document.getElementById('agent-payment-card-modal');
    this.btnClosePaymentCard = document.getElementById('btn-close-payment-card');
    this.paymentCardGrid = document.getElementById('payment-card-grid');
    this.paymentCardClientName = document.getElementById('payment-card-client-name');
    this.paymentCardClientCedula = document.getElementById('payment-card-client-cedula');
    this.paymentCardClientOutstanding = document.getElementById('payment-card-client-outstanding');
    this.btnPaymentCardNoPago = document.getElementById('btn-payment-card-nopago');
    this.massPaymentSwitch = document.getElementById('mass-payment-switch');
    this.btnProcessMassPayment = document.getElementById('btn-process-mass-payment');

    // Detalles Cliente
    this.riskHeader = document.getElementById('client-traffic-light');
    this.riskStatus = document.getElementById('client-risk-status');
    this.riskDot = document.getElementById('client-risk-dot');
    this.detailName = document.getElementById('client-detail-name');
    this.detailCedula = document.getElementById('client-detail-cedula');
    this.detailPhone = document.getElementById('client-detail-phone');
    this.detailStatus = document.getElementById('client-detail-status');
    this.detailInstallment = document.getElementById('client-detail-installment');
    this.detailOutstanding = document.getElementById('client-detail-outstanding');

    // Recaudo
    this.inputCollectAmount = document.getElementById('collect-amount');
    this.btnSubmitCollect = document.getElementById('btn-submit-collect');

    // Registro
    this.formRegisterClient = document.getElementById('form-register-client');


    this.bindEvents();
    await this.updateAgentHeader();
    await this.updateRouteTracking();
    this.initGeography();
    this.initCalculator();
    await this.populateAgentSelector();

    // Geolocalización y monitoreo constante en tiempo real (cada 30 segundos con watchPosition)
    this.startLocationMonitoring();

    // Si el acceso está bloqueado, aplicar el bloqueo visual de inmediato
    if (window.gpsBlocked) {
      if (this.panelCollect) this.panelCollect.style.setProperty('display', 'none', 'important');
      const blockedPanel = document.getElementById('gps-blocked-panel');
      if (blockedPanel) blockedPanel.style.display = 'flex';
    }
  },

  bindEvents() {
    window.addEventListener('bulapay-payment-registered', async () => {
      await this.renderFinancialDashboard();
      await this.updateCashViews();
    });

    // Alternancia de Pestañas
    this.tabCollect.addEventListener('click', () => this.switchTab('collect'));
    this.tabHistory.addEventListener('click', () => this.switchTab('history'));
    this.tabRegister.addEventListener('click', () => {
      this.setRenewalMode(false);
      this.switchTab('register');
    });

    // Botón Búsqueda Cobro
    if (this.btnSearch) {
      this.btnSearch.addEventListener('click', () => this.searchClient());
    }
    if (this.inputSearchCedula) {
      this.inputSearchCedula.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchClient();
      });
    }

    // Botones Flujo Doble (Factura y Cartón)
    if (this.btnCobroInvoice) {
      this.btnCobroInvoice.addEventListener('click', () => this.handleInvoiceRequest());
    }
    if (this.inputCobroAmount) {
      this.inputCobroAmount.addEventListener('input', () => this.updateCobroInvoiceButtonState());
      this.inputCobroAmount.addEventListener('change', () => this.updateCobroInvoiceButtonState());
      this.inputCobroAmount.addEventListener('keyup', () => this.updateCobroInvoiceButtonState());
    }
    if (this.btnCobroCarton) {
      this.btnCobroCarton.addEventListener('click', () => {
        if (this.cobroInputState && this.cobroCartonState) {
          this.cobroInputState.style.setProperty('display', 'none', 'important');
          this.cobroCartonState.style.setProperty('display', 'block', 'important');
        }
      });
    }
    if (this.btnCobroBack) {
      this.btnCobroBack.addEventListener('click', () => {
        if (this.cobroInputState && this.cobroCartonState) {
          this.cobroCartonState.style.setProperty('display', 'none', 'important');
          this.cobroInputState.style.setProperty('display', 'block', 'important');
        }
      });
    }

    if (this.btnCobroRenovar) {
      this.btnCobroRenovar.addEventListener('click', async () => {
        if (!this.currentClient) return;
        const client = this.currentClient;

        // Validación de Regla de Renovación (v85/v160)
        const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
        const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(client, payments);
        const canRenovar = this.canRenovarCarton(client, dailyStatusList);

        if (!canRenovar) {
          alert(`⚠️ No es posible renovar en este momento.\nEl cliente ${client.name} se encuentra al día y no ha cumplido la mitad del plazo.\nSolo se habilita la opción de renovación si el cliente ha transcurrido/pagado la mitad o más de sus cuotas o si el cartón se encuentra vencido.`);
          return;
        }

        // REGLA OBLIGATORIA v177: Cálculo exacto del Saldo Real Remanente del cartón actual
        // Saldo_Real_Remanente = Saldo_Total_Inicial - (Suma de todos los pagos reales/masivos de este cartón)
        let totalPagadoReal = 0;
        const cartonDateStr = client.fecha_apertura || client.fecha_inicio || client.created_at;
        const cartonCreatedTime = cartonDateStr ? new Date(cartonDateStr).getTime() : 0;
        const cartonId = client.carton_id || client.id;
        const numeroCarton = client.numero_carton;

        if (payments && Array.isArray(payments)) {
          payments.forEach(p => {
            const pStatus = String(p.status || '').toUpperCase();
            const isCanceled = pStatus.includes('CANCEL') || pStatus.includes('RECHAZ') || pStatus === 'NO PAGO' || pStatus === 'PENDIENTE';
            const isLiquidationRecord = (p.id && String(p.id).startsWith('pay_liq_')) || pStatus === 'LIQUIDADO_PAGADO' || pStatus === 'LIQUIDADO_MORA';

            if (!isCanceled && !isLiquidationRecord && Number(p.amount) > 0) {
              let belongsToCarton = true;
              if (p.carton_id && cartonId && String(p.carton_id) !== String(cartonId)) {
                belongsToCarton = false;
              } else if (p.numero_carton && numeroCarton && String(p.numero_carton) !== String(numeroCarton)) {
                belongsToCarton = false;
              } else if (cartonCreatedTime > 0) {
                let pTime = 0;
                if (p.created_at) pTime = new Date(p.created_at).getTime();
                else if (p.date) pTime = new Date(String(p.date).trim().includes('T') ? String(p.date).trim() : String(p.date).trim() + 'T00:00:00').getTime();
                if (pTime > 0 && (cartonCreatedTime - pTime > 2000)) {
                  belongsToCarton = false;
                }
              }

              if (belongsToCarton) {
                totalPagadoReal += Math.round(Number(p.amount));
              }
            }
          });
        }

        const saldoTotalInicial = Math.round(Number(client.totalDebt || client.total_debt || client.monto_total || (Number(client.amount || client.monto_prestado || 0) * 1.2)));
        const saldoRealRemanente = Math.max(0, saldoTotalInicial - totalPagadoReal);

        const confirmMsg = `¿Estás seguro de liquidar para renovar el préstamo del cliente ${client.name} (C.C. ${client.cedula})?\nSaldo real a refinanciar: $${saldoRealRemanente.toLocaleString('es-CO')}.\nEsto marcará las cuotas y liquidará el cartón sin alterar la caja.`;
        if (!confirm(confirmMsg)) return;

        try {
          // Liquidar cartón anterior con estado 'liquidado_por_renovacion' y marcar cuotas restantes (v160)
          await window.BulaPayDB.liquidateCredit({
            cedula: client.cedula,
            status: 'liquidado_por_renovacion',
            outstanding: 0,
            cartonId: client.carton_id || client.id || null,
            numeroCarton: client.numero_carton || null
          });

          // Alerta con el Saldo Real Remanente (v177)
          const formattedMonto = saldoRealRemanente.toLocaleString('es-CO');
          alert(`¡Liquidación exitosa para renovación! Saldo restante: $${formattedMonto}. No olvide descontarlo del nuevo crédito.`);

          this.switchTab('register');
          this.setRenewalMode(true, saldoRealRemanente);

          const inputName = document.getElementById('new-client-name');
          const inputCedula = document.getElementById('new-client-cedula');
          const inputPhone = document.getElementById('new-client-phone');
          const inputDept = document.getElementById('new-client-department');
          const inputCity = document.getElementById('new-client-city');
          const inputZone = document.getElementById('new-client-zone');
          
          if (inputName) inputName.value = client.name || '';
          if (inputCedula) inputCedula.value = client.cedula || '';
          if (inputPhone) inputPhone.value = client.phone || '';
          if (inputZone) inputZone.value = client.zone || client.barrio || client.direccion || client.address || '';

          if (inputDept && (client.department || client.departamento)) {
            const targetDept = client.department || client.departamento;
            inputDept.value = targetDept;
            inputDept.dispatchEvent(new Event('change'));
            if (inputCity && (client.city || client.ciudad || client.municipio)) {
              inputCity.value = client.city || client.ciudad || client.municipio;
            }
          }
        } catch (e) {
          console.error("Error al procesar renovación:", e);
          alert('❌ Error al procesar renovación: ' + (e.message || e));
        }
      });
    }

    if (this.btnCobroLiquidarMora) {
      this.btnCobroLiquidarMora.addEventListener('click', async () => {
        const btn = this.btnCobroLiquidarMora;
        const cartonId = btn?.dataset?.cartonId || this.currentClient?.carton_id || this.currentClient?.id || null;
        const numeroCarton = btn?.dataset?.numeroCarton || this.currentClient?.numero_carton || null;
        const cedula = btn?.dataset?.cedula || this.currentClient?.cedula || (this.inputSearchCedula ? this.inputSearchCedula.value : '') || null;
        const name = btn?.dataset?.name || this.currentClient?.name || `Cliente ${cedula || ''}`;
        
        const capPrestado = Number(this.currentClient?.amount || this.currentClient?.monto_prestado || 0);
        const totalConIntereses = Number(btn?.dataset?.totalConIntereses || this.currentClient?.totalToPay || this.currentClient?.totalDebt || this.currentClient?.monto_total || (capPrestado ? Math.round(capPrestado * 1.2) : 0));

        if (!cedula && !cartonId && !numeroCarton) {
          alert('❌ No se encontró la información del cartón a liquidar.');
          return;
        }

        const confirmMsg = `⚠️ ATENCIÓN: ¿Deseas liquidar el cartón de ${name} y enviarlo a Lista Negra (Liquidado por Mora)?\nDeuda Total a Lista Negra (Capital + Intereses): $${totalConIntereses.toLocaleString('es-CO')}.\nEsta acción removerá al cliente de la cartera activa. El Capital en Caja permanecerá intacto y sin desajustes.`;
        if (!confirm(confirmMsg)) return;

        try {
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
          }

          const cedulaStr = String(this.currentClient?.cedula || cedula || '').trim();
          const supabase = await window.BulaPayDB.initSupabase();

          // v135: Llamada limpia a la función RPC de Supabase 'liquidar_carton_por_morosidad'
          const { error } = await supabase.rpc('liquidar_carton_por_morosidad', { 
            p_cliente_id: cedulaStr 
          });
          if (error) console.error("Error al liquidar:", error);

          // Reset de cliente activo y formulario
          this.currentClient = null;
          if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'none', 'important');
          if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'block';
          if (this.inputSearchCedula) this.inputSearchCedula.value = '';

          // Forzar recarga limpia del mapa de clientes en DB y de la UI
          console.log("🔄 [RECARGA INTERFAZ] Recargando cartones activos y métricas financieras...");
          await window.BulaPayDB.loadActiveCredits();
          await Promise.all([
            this.updateRouteTracking(),
            this.renderFinancialDashboard()
          ]);

          alert(`⚠️ El cliente ${name} (C.C. ${cedulaStr}) ha sido enviado a Lista Negra (Liquidado por Mora).\nDeuda Total registrada: $${totalConIntereses.toLocaleString('es-CO')} (Capital + Intereses).\nEl saldo del Capital en Caja se mantiene estable.`);
        } catch (e) {
          console.error("Error al enviar a Lista Negra:", e);
          alert('❌ Error al procesar liquidación: ' + (e.message || e));
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = '⛔ Liquidar / Lista Negra';
          }
        }
      });
    }
    
    if (this.btnLiquidarCarton) {
      this.btnLiquidarCarton.addEventListener('click', async () => {
        if (!this.currentClient) return;

        if (!confirm('¿Estás seguro de liquidar este cartón? Esta acción es irreversible.')) return;

        this.btnLiquidarCarton.disabled = true;
        this.btnLiquidarCarton.textContent = 'Liquidando...';

        try {
          const client = this.currentClient;
          const totalEsperado = Number(client.totalToPay || client.monto_total || client.totalDebt || client.total_debt || (client.amount ? Math.round(client.amount * 1.2) : 0));
          const saldoRestante = Number(client.outstanding || client.saldo_restante || 0);
          const capitalPrestado = Number(client.amount || client.monto_prestado || client.capital_prestado || 0);
          
          // Recaudo Real es la diferencia entre el total esperado y el saldo pendiente actual
          const recaudoReal = Math.max(0, totalEsperado - saldoRestante);
          
          let gananciaReal = 0;
          let nuevoEstado = 'Liquidado_Pagado';

          // Escenario A: Liquidación Exitosa con Pago Completo
          if (saldoRestante <= 0 || recaudoReal >= totalEsperado) {
            gananciaReal = Math.max(0, recaudoReal - capitalPrestado);
            nuevoEstado = 'Liquidado_Pagado';
          } 
          // Escenario B: Default / Pérdida por Mora (Mala Paga -> Lista Negra - v103: liquidado_perdida)
          else {
            nuevoEstado = 'liquidado_perdida';
          }

          const cartonId = client.carton_id || client.id;
          const numeroCarton = client.numero_carton;
          const cedulaStr = String(client.cedula || '').trim();

          const supabase = await window.BulaPayDB.initSupabase();
          if (nuevoEstado === 'liquidado_perdida') {
            const { error } = await supabase.rpc('liquidar_carton_por_morosidad', { 
              p_cliente_id: cedulaStr 
            });
            if (error) console.error("Error al liquidar:", error);
          } else {
            await window.BulaPayDB.liquidateCredit({
              cedula: client.cedula,
              cartonId: cartonId,
              numeroCarton: numeroCarton,
              status: nuevoEstado,
              outstanding: 0,
              totalDebt: totalEsperado
            });
          }

          // Fuerza una recarga inmediata de la interfaz (loadActiveCredits() y resumen de caja v124)
          await window.BulaPayDB.loadActiveCredits();

          // Actualizar inmediatamente las métricas financieras del Dashboard de forma síncrona en vivo (v124)
          await Promise.all([
            this.renderFinancialDashboard(),
            this.updateRouteTracking(),
            typeof this.renderPaymentCardGrid === 'function' ? this.renderPaymentCardGrid() : Promise.resolve()
          ]);

          if (nuevoEstado === 'Liquidado_Pagado') {
            alert('🎉 ¡Cartón Liquidado Exitosamente!');
          } else {
            alert(`⚠️ El cliente ha sido enviado a Lista Negra (Moroso) con deuda total con intereses de $${totalEsperado.toLocaleString('es-CO')}.\nEl crédito se marca como 'liquidado_perdida': la Cartera en Calle se reduce a $0 y el saldo de Capital en Caja permanece estable.`);
          }

          // Limpiar UI
          if (this.cobroCartonState && this.cobroInputState) {
            this.cobroCartonState.style.setProperty('display', 'none', 'important');
            this.cobroInputState.style.setProperty('display', 'block', 'important');
          }
          if (this.inputCobroCedula) this.inputCobroCedula.value = '';
          if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'flex';
          if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'none', 'important');
          this.currentClient = null;

        } catch (error) {
          console.error("Error al liquidar cartón:", error);
          alert('❌ Error al liquidar cartón: ' + (error.message || error));
        } finally {
          this.btnLiquidarCarton.disabled = false;
          this.btnLiquidarCarton.textContent = 'Liquidar Cartón';
        }
      });
    }

    // Botones Modal Factura
    if (this.btnInvoiceConfirm) {
      this.btnInvoiceConfirm.addEventListener('click', () => {
        this.cobroInvoiceModal.style.display = 'none';
        this.executePaymentTransaction();
      });
    }
    if (this.btnInvoiceCancel) {
      this.btnInvoiceCancel.addEventListener('click', () => {
        this.cobroInvoiceModal.style.display = 'none';
      });
    }

    // Historial
    if (this.btnHistorySearch) {
      this.btnHistorySearch.addEventListener('click', () => {
        const cedula = this.inputHistoryCedula.value.trim();
        this.verificarHistorialCliente(cedula);
      });
    }
    this.inputHistoryCedula.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const cedula = this.inputHistoryCedula.value.trim();
        this.verificarHistorialCliente(cedula);
      }
    });

    // Búsqueda Rápida (Header)
    const inputQuickSearch = document.getElementById('header-search-input');
    const btnQuickSearch = document.getElementById('btn-quick-search');
    const executeQuickSearch = () => {
      if (!inputQuickSearch) return;
      const cedula = inputQuickSearch.value.trim();
      if (!cedula) return;
      executeGlobalSearchModal(cedula);
      inputQuickSearch.value = ''; // limpiar
    };
    
    const executeGlobalSearchModal = async (cedula) => {
      const modal = document.getElementById('global-search-modal');
      const statusDiv = document.getElementById('global-search-status');
      const resultsDiv = document.getElementById('global-search-results');
      const nameEl = document.getElementById('global-search-name');
      const cedulaEl = document.getElementById('global-search-cedula');
      const phoneEl = document.getElementById('global-search-phone');
      const cityEl = document.getElementById('global-search-city');
      const addressEl = document.getElementById('global-search-address');
      const outEl = document.getElementById('global-search-outstanding');
      const btnClose = document.getElementById('btn-close-global-search');
      
      if (!modal) return;
      
      if (btnClose) {
        btnClose.onclick = () => modal.style.display = 'none';
      }
      
      modal.style.display = 'flex';
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Buscando cliente...';
      resultsDiv.style.display = 'none';
      
      try {
        const client = await window.BulaPayDB.getGlobalClientByCedula(cedula);
        if (!client) {
          statusDiv.textContent = '❌ Cliente no encontrado.';
          return;
        }
        
        statusDiv.style.display = 'none';
        resultsDiv.style.display = 'flex';
        
        nameEl.textContent = client.name;
        cedulaEl.textContent = client.cedula;
        phoneEl.textContent = client.phone || 'N/A';
        cityEl.textContent = client.city || 'N/A';
        addressEl.textContent = client.direccion || client.zone || 'N/A';
        outEl.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
      } catch (err) {
        console.error(err);
        statusDiv.textContent = '❌ Error al consultar Supabase.';
      }
    };
    if (btnQuickSearch) {
      btnQuickSearch.addEventListener('click', executeQuickSearch);
    }
    if (inputQuickSearch) {
      inputQuickSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeQuickSearch();
      });
    }

    // Registrar Pago
    if (this.btnSubmitCollect) {
      this.btnSubmitCollect.addEventListener('click', () => this.registerPayment());
    }

    // Seguimiento de Ruta Diario Modal
    const btnTracking = document.getElementById('btn-agent-route-tracking');
    if (btnTracking) {
      btnTracking.addEventListener('click', () => this.openRouteTrackingModal());
    }
    const btnCloseTracking = document.getElementById('btn-close-route-tracking');
    if (btnCloseTracking) {
      btnCloseTracking.addEventListener('click', () => this.closeRouteTrackingModal());
    }

    const btnReport = document.getElementById('btn-generate-cash-report');
    if (btnReport) {
      btnReport.addEventListener('click', () => this.generateCashReport());
    }
    const btnCloseReport = document.getElementById('btn-close-cash-report');
    if (btnCloseReport) {
      btnCloseReport.addEventListener('click', () => {
        const modal = document.getElementById('agent-cash-report-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Cartón de Pagos
    if (this.btnOpenPaymentCard) {
      this.btnOpenPaymentCard.addEventListener('click', () => this.openPaymentCard());
    }
    if (this.btnClosePaymentCard) {
      this.btnClosePaymentCard.addEventListener('click', () => this.closePaymentCard());
    }

    if (this.massPaymentSwitch) {
      this.massPaymentSwitch.addEventListener('change', (e) => {
        this.isMassPaymentMode = e.target.checked;
        this.selectedInstallments = [];
        if (this.btnProcessMassPayment) this.btnProcessMassPayment.style.display = 'none';
        if (this.currentClient) {
          window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula).then(payments => {
            const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
            window.BulaPayDB.renderOverdueDaysList(this.cobroOverdueDaysList, dailyStatusList, (st) => this.handleCartonPayment(st), []);
          });
        }
      });
    }

    if (this.btnProcessMassPayment) {
      this.btnProcessMassPayment.addEventListener('click', () => this.processMassPayment());
    }

    // Registrar Cliente Nuevo (Reconexión explícita del botón oficial)
    const btnGuardar = document.getElementById('btn-registrar-cliente-oficial');
    if (btnGuardar) {
      btnGuardar.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('¡BINGO! El botón está vivo y conectado.');
        console.log('Intentando enviar a Supabase la tabla clients...');
        await this.registerNewClient();
      };
    }

  },

  async updateAgentHeader() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    const agentNameElement = document.getElementById('agent-welcome-name');
    const agentRouteElement = document.getElementById('agent-active-route');
    const roleTag = document.getElementById('agent-role-tag');
    const profileTrigger = document.getElementById('agent-profile-trigger');
    const privatePanel = document.getElementById('private-agent-panel-modal');
    const btnClosePrivatePanel = document.getElementById('btn-close-private-panel');
    const tabProfileBtn = document.getElementById('btn-tab-private-profile');
    const tabBusinessBtn = document.getElementById('btn-tab-private-business');
    const tabProfileContent = document.getElementById('private-panel-profile');
    const tabBusinessContent = document.getElementById('private-panel-business');
    const cashModal = document.getElementById('private-panel-cash-modal');
    const blacklistModal = document.getElementById('private-panel-blacklist-modal');
    
    // Inicializar Eventos del Panel Privado
    if (btnClosePrivatePanel) {
      btnClosePrivatePanel.onclick = () => {
        if (privatePanel) privatePanel.style.display = 'none';
      };
    }

    if (tabProfileBtn && tabBusinessBtn) {
      tabProfileBtn.onclick = () => {
        tabProfileBtn.style.color = 'var(--accent)';
        tabProfileBtn.style.borderBottom = '2px solid var(--accent)';
        tabBusinessBtn.style.color = 'var(--text-secondary)';
        tabBusinessBtn.style.borderBottom = 'none';
        tabProfileContent.style.display = 'block';
        tabBusinessContent.style.display = 'none';
      };
      tabBusinessBtn.onclick = () => {
        tabBusinessBtn.style.color = 'var(--accent)';
        tabBusinessBtn.style.borderBottom = '2px solid var(--accent)';
        tabProfileBtn.style.color = 'var(--text-secondary)';
        tabProfileBtn.style.borderBottom = 'none';
        tabProfileContent.style.display = 'none';
        tabBusinessContent.style.display = 'flex';
      };
    }

    if (currentUser && (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent' || currentUser.role === 'Agente Independiente')) {
      if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
      if (roleTag) roleTag.textContent = currentUser.role;
      
      const routes = await window.BulaPayDB.getRoutes();
      const myRoute = routes.find(r => r.agentUsername && r.agentUsername.split(', ').map(u => u.trim()).includes(currentUser.username));
      
      if (agentRouteElement) {
        if (currentUser.role === 'Agente Independiente') {
          agentRouteElement.textContent = 'Cobrador Independiente';
          
          // RBAC: Solo Agente Independiente puede abrir el Panel
          if (profileTrigger) {
            profileTrigger.style.cursor = 'pointer';
            profileTrigger.style.transition = 'opacity 0.2s';
            profileTrigger.onmouseover = () => profileTrigger.style.opacity = '0.8';
            profileTrigger.onmouseout = () => profileTrigger.style.opacity = '1';
            profileTrigger.onclick = () => {
              if (privatePanel) {
                privatePanel.style.display = 'flex';
                this.hydratePrivatePanel(currentUser);
              }
            };
          }
          
          // Asegurar que la pestaña de Registro esté visible para el Agente Independiente
          if (this.tabRegister) {
            this.tabRegister.style.display = 'block';
          }
        } else {
          agentRouteElement.textContent = myRoute 
            ? `Ruta: ${myRoute.name} | Capital: $${Number(myRoute.capital).toLocaleString('es-CO')}` 
            : 'Ruta no asignada';
            
          // Bloquear interacción del panel privado
          if (profileTrigger) {
            profileTrigger.style.cursor = 'default';
            profileTrigger.onmouseover = null;
            profileTrigger.onmouseout = null;
            profileTrigger.onclick = null;
          }
          
          // Asegurar que la pestaña de Registro esté visible para los Agentes de Ruta (pueden registrar clientes)
          if (this.tabRegister) {
            this.tabRegister.style.display = 'block';
          }
        }
      }
    } else {
      if (agentNameElement) agentNameElement.textContent = 'Cargando...';
      if (agentRouteElement) agentRouteElement.textContent = 'Verificando sesión';
    }
  },

  async hydratePrivatePanel(currentUser) {
    try {
      const dbUser = await window.BulaPayDB.getUserByUsername(currentUser.username);
      if (dbUser) {
        currentUser = { ...currentUser, ...dbUser };
        localStorage.setItem('bulapay_user', JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn("Error sincronizando perfil desde DB:", e);
    }
    
    // 1. Hidratar 'Mi Perfil'
    const nameInput = document.getElementById('private-profile-name');
    const phoneInput = document.getElementById('private-profile-phone');
    const emailInput = document.getElementById('private-profile-email');
    const cedulaInput = document.getElementById('private-profile-cedula');
    const addressInput = document.getElementById('private-profile-address');
    const usernameInput = document.getElementById('private-profile-username');
    if (nameInput) nameInput.value = currentUser.name || "";
    if (phoneInput) phoneInput.value = currentUser.phone || "";
    if (emailInput) emailInput.value = currentUser.email || "";
    if (cedulaInput) cedulaInput.value = currentUser.documentNumber || currentUser.id || "";
    if (addressInput) addressInput.value = currentUser.zone || "";
    if (usernameInput) usernameInput.value = currentUser.username || "";

    const btnSaveProfile = document.getElementById('btn-save-private-profile');
    if (btnSaveProfile) {
      btnSaveProfile.onclick = async () => {
        try {
          const newName = nameInput.value.trim();
          const newPhone = phoneInput.value.trim();
          const newEmail = emailInput.value.trim();
          const newAddress = addressInput.value.trim();
          
          if (!newName) {
            alert('❌ El nombre no puede estar vacío');
            return;
          }
          btnSaveProfile.textContent = 'Guardando...';
          btnSaveProfile.disabled = true;
          
          const profileUpdates = {
            name: newName,
            phone: newPhone,
            email: newEmail,
            zone: newAddress
          };
          
          await window.BulaPayDB.updateUserProfile(currentUser.username, profileUpdates);
          
          currentUser.name = newName;
          currentUser.phone = newPhone;
          currentUser.email = newEmail;
          currentUser.address = newAddress;
          currentUser.direccion = newAddress;
          localStorage.setItem('bulapay_user', JSON.stringify(currentUser));
          
          // Actualizar la vista
          const agentNameElement = document.getElementById('agent-welcome-name');
          if (agentNameElement) agentNameElement.textContent = `Cobrador: ${currentUser.name}`;
          
          alert('✅ Perfil actualizado correctamente');
        } catch (err) {
          console.error(err);
          alert('❌ Error al actualizar el perfil');
        } finally {
          btnSaveProfile.textContent = 'Guardar Cambios';
          btnSaveProfile.disabled = false;
        }
      };
    }
    
    // 1.5 Cambiar Contraseña
    const btnUpdatePassword = document.getElementById('btn-update-private-password');
    const inputCurrentPassword = document.getElementById('private-profile-current-password');
    const inputNewPassword = document.getElementById('private-profile-new-password');
    
    if (btnUpdatePassword && inputNewPassword) {
      btnUpdatePassword.onclick = async () => {
        const currentPass = inputCurrentPassword ? inputCurrentPassword.value : '';
        const newPass = inputNewPassword.value;
        
        if (newPass.length < 6) {
          alert('❌ La nueva contraseña debe tener al menos 6 caracteres para ser segura.');
          return;
        }
        
        if (currentUser.password && currentPass !== currentUser.password) {
          alert('❌ La contraseña actual es incorrecta.');
          return;
        }
        
        const originalText = btnUpdatePassword.textContent;
        btnUpdatePassword.textContent = 'Actualizando...';
        btnUpdatePassword.disabled = true;
        
        try {
          await window.BulaPayDB.updateUserPassword(currentUser.username, newPass);
          
          currentUser.password = newPass; 
          localStorage.setItem('bulapay_user', JSON.stringify(currentUser));
          
          alert('✅ ¡Contraseña actualizada correctamente!');
          if (inputCurrentPassword) inputCurrentPassword.value = '';
          inputNewPassword.value = '';
        } catch (error) {
          console.error(error);
          alert('❌ Error al actualizar: ' + error.message);
        } finally {
          btnUpdatePassword.textContent = originalText;
          btnUpdatePassword.disabled = false;
        }
      };
    }

    // 2. Dar vida al Dashboard 'Mi Negocio' (Métricas Financieras Estrictas)
    await this.renderFinancialDashboard();
    
    // Lógica para Modales
    const injectModal = document.getElementById('modal-inject-capital');
    const btnInjectCapital = document.getElementById('btn-show-inject-modal');
    if (injectModal && btnInjectCapital) {
      btnInjectCapital.onclick = () => injectModal.style.display = 'flex';
      document.getElementById('btn-close-inject-modal').onclick = () => injectModal.style.display = 'none';
      
      const btnConfirmInject = document.getElementById('btn-confirm-inject-capital');
      if (btnConfirmInject) {
        const injectInput = document.getElementById('inject-capital-amount');
        if (injectInput) {
          injectInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            e.target.value = val ? val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
          });
        }
        
        btnConfirmInject.onclick = async () => {
          const currentUser = window.BulaPayDB.getCurrentUser();
          const rawAmount = document.getElementById('inject-capital-amount').value.replace(/\./g, '');
          const amount = Math.round(parseFloat(rawAmount) || 0);
          
          if (isNaN(amount) || amount <= 0) {
            alert('Por favor ingresa un monto válido.');
            return;
          }
          
          btnConfirmInject.disabled = true;
          btnConfirmInject.textContent = 'Procesando...';
          
          try {
            await window.BulaPayDB.injectCapital(currentUser.routeId, currentUser.username || currentUser.id, amount);
            alert('✅ Capital inyectado exitosamente.');
            injectModal.style.display = 'none';
            document.getElementById('inject-capital-amount').value = '';
            
            // Re-render Capital Base y métricas financieras
            if (typeof window.AgentV6 !== 'undefined' && window.AgentV6.renderFinancialDashboard) {
              await window.AgentV6.renderFinancialDashboard();
            } else {
              const newCapital = await window.BulaPayDB.getRealBaseCapital(currentUser.routeId);
              const capEl = document.getElementById('private-panel-capital');
              if (capEl) capEl.textContent = `$${newCapital.toLocaleString('es-CO')}`;
            }

            // Actualizar vistas de Caja en tiempo real para reflejar de inmediato el dinero inyectado (sin F5)
            const { onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
            const elAvailable = document.getElementById('cash-management-available');
            if (elAvailable) {
              elAvailable.textContent = `$${Math.abs(onHand).toLocaleString('es-CO')}`;
              elAvailable.style.color = onHand < 0 ? 'var(--color-rojo)' : 'var(--color-verde)';
            }
            const elOnHand = document.getElementById('private-cash-on-hand');
            if (elOnHand) {
              if (onHand < 0) {
                elOnHand.textContent = `-$${Math.abs(onHand).toLocaleString('es-CO')}`;
                elOnHand.style.color = 'var(--color-rojo)';
              } else {
                elOnHand.textContent = `$${onHand.toLocaleString('es-CO')}`;
                elOnHand.style.color = 'var(--text-primary)';
              }
            }
          } catch (error) {
            console.error(error);
            alert('❌ Error al inyectar capital: ' + (error.message || JSON.stringify(error)));
          } finally {
            btnConfirmInject.disabled = false;
            btnConfirmInject.textContent = 'Registrar Inyección';
          }
        };
      }
    }

    const cashModal = document.getElementById('private-panel-cash-modal');
    const blacklistModal = document.getElementById('private-panel-blacklist-modal');
    const btnCash = document.getElementById('btn-trigger-cash-modal');
    const btnBlacklist = document.getElementById('btn-trigger-blacklist-modal');
    
    if (cashModal) {
      const btnClosePrivateCash = document.getElementById('btn-close-private-cash');
      if (btnClosePrivateCash) btnClosePrivateCash.onclick = () => cashModal.style.display = 'none';
      const btnClosePrivateCashX = document.getElementById('btn-close-private-cash-x');
      if (btnClosePrivateCashX) btnClosePrivateCashX.onclick = () => cashModal.style.display = 'none';
    }
    if (blacklistModal) {
      const btnCloseBlacklist = document.getElementById('btn-close-private-blacklist');
      if (btnCloseBlacklist) btnCloseBlacklist.onclick = () => blacklistModal.style.display = 'none';
    }

    // Función unificada para abrir el modal de Cierre / Gestión de Caja
    const openCashModalWithMovement = async (type = null) => {
      if (!cashModal) return;
      cashModal.style.display = 'flex';
      
      const elCollected = document.getElementById('private-cash-collected');
      const elLent = document.getElementById('private-cash-lent');
      const elDiscounts = document.getElementById('private-cash-discounts');
      const elOnHand = document.getElementById('private-cash-on-hand');
      
      if (elCollected) elCollected.textContent = 'Cargando...';
      if (elLent) elLent.textContent = 'Cargando...';
      if (elDiscounts) elDiscounts.textContent = 'Cargando...';
      if (elOnHand) elOnHand.textContent = 'Cargando...';
      
      const movementForm = document.getElementById('cash-movement-form');
      if (movementForm) movementForm.style.display = 'none';
      const movementAmount = document.getElementById('cash-movement-amount');
      if (movementAmount) movementAmount.value = '';

      try {
        const data = await window.BulaPayDB.getEfectivoEnCajaDia() || {};
        const totalCollected = Number(data.totalCollected) || 0;
        const totalLent = Number(data.totalLent) || 0;
        const totalDiscounts = Number(data.totalDiscounts) || 0;
        const onHand = Number(data.onHand) || 0;
        const massPaymentsTotal = Number(data.massPaymentsTotal) || 0;
        const totalIn = Number(data.totalIn) || 0;
        const totalOut = Number(data.totalOut) || 0;
        
        if (elCollected) elCollected.textContent = `$${Math.abs(totalCollected).toLocaleString('es-CO')}`;
        
        const elMass = document.getElementById('private-cash-mass-payments');
        if (elMass) {
          if (massPaymentsTotal > 0) {
            elMass.textContent = `$${Math.abs(massPaymentsTotal).toLocaleString('es-CO')}`;
            elMass.style.color = 'var(--color-verde, #10b981)';
          } else {
            elMass.textContent = '$0';
            elMass.style.color = 'var(--text-muted)';
          }
        }
        
        const elInMovements = document.getElementById('private-cash-in-movements');
        if (elInMovements) {
          elInMovements.textContent = totalIn > 0 ? `+$${totalIn.toLocaleString('es-CO')}` : '$0';
        }

        const elOutMovements = document.getElementById('private-cash-out-movements');
        if (elOutMovements) {
          elOutMovements.textContent = totalOut > 0 ? `-$${totalOut.toLocaleString('es-CO')}` : '$0';
        }

        if (elLent) {
          const prestadoFormateado = totalLent === 0 ? "$0" : "-$" + Math.abs(totalLent).toLocaleString('es-CO');
          elLent.textContent = prestadoFormateado;
        }

        if (elDiscounts) {
          const discountsFormateado = totalDiscounts === 0 ? "$0" : "+$" + Math.abs(totalDiscounts).toLocaleString('es-CO');
          elDiscounts.textContent = discountsFormateado;
        }
        
        if (elOnHand) {
          if (onHand < 0) {
            elOnHand.textContent = `-$${Math.abs(onHand).toLocaleString('es-CO')}`;
            elOnHand.style.color = 'var(--color-rojo)';
          } else {
            elOnHand.textContent = `$${onHand.toLocaleString('es-CO')}`;
            elOnHand.style.color = 'var(--text-primary)';
          }
        }
      } catch (e) {
        console.error("Error al cargar métricas de caja en el modal:", e);
        if (elCollected) elCollected.textContent = '$0';
        if (elLent) elLent.textContent = '$0';
        if (elDiscounts) elDiscounts.textContent = '$0';
        if (elOnHand) elOnHand.textContent = '$0';
        const elMass = document.getElementById('private-cash-mass-payments');
        if (elMass) elMass.textContent = '$0';
        const elInMovements = document.getElementById('private-cash-in-movements');
        if (elInMovements) elInMovements.textContent = '$0';
        const elOutMovements = document.getElementById('private-cash-out-movements');
        if (elOutMovements) elOutMovements.textContent = '$0';
      }

      if (type) {
        window._currentCashMovementType = type;
        if (movementForm) movementForm.style.display = 'flex';
        const movementTitle = document.getElementById('cash-movement-title');
        if (movementTitle) {
          movementTitle.textContent = type === 'entrada' ? 'Ingresar Dinero a Caja (Entrada)' : 'Retirar Dinero de Caja (Salida)';
        }
        if (movementAmount) movementAmount.focus();
      }
    };

    if (btnCash) {
      btnCash.onclick = () => openCashModalWithMovement(null);
    }

    const btnQuickAdd = document.getElementById('btn-quick-cash-add');
    if (btnQuickAdd) {
      btnQuickAdd.onclick = () => openCashModalWithMovement('entrada');
    }

    const btnQuickRemove = document.getElementById('btn-quick-cash-remove');
    if (btnQuickRemove) {
      btnQuickRemove.onclick = () => openCashModalWithMovement('salida');
    }

    const cashMovementAmountInput = document.getElementById('cash-movement-amount');
    if (cashMovementAmountInput) {
      cashMovementAmountInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? val.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
      });
    }

    const btnAdd = document.getElementById('btn-cash-add');
    if (btnAdd) {
      btnAdd.onclick = () => {
        window._currentCashMovementType = 'entrada';
        const movementForm = document.getElementById('cash-movement-form');
        if (movementForm) movementForm.style.display = 'flex';
        const movementTitle = document.getElementById('cash-movement-title');
        if (movementTitle) movementTitle.textContent = 'Ingresar Dinero a Caja (Entrada)';
        const inputAmt = document.getElementById('cash-movement-amount');
        if (inputAmt) inputAmt.focus();
      };
    }

    const btnRemove = document.getElementById('btn-cash-remove');
    if (btnRemove) {
      btnRemove.onclick = () => {
        window._currentCashMovementType = 'salida';
        const movementForm = document.getElementById('cash-movement-form');
        if (movementForm) movementForm.style.display = 'flex';
        const movementTitle = document.getElementById('cash-movement-title');
        if (movementTitle) movementTitle.textContent = 'Retirar Dinero de Caja (Salida)';
        const inputAmt = document.getElementById('cash-movement-amount');
        if (inputAmt) inputAmt.focus();
      };
    }

    const btnConfirmMov = document.getElementById('btn-cash-movement-confirm');
    if (btnConfirmMov) {
      btnConfirmMov.onclick = async () => {
        const amountRaw = document.getElementById('cash-movement-amount').value.replace(/\./g, '');
        const amount = Math.round(parseFloat(amountRaw) || 0);
        if (!amount || amount <= 0) {
          alert('Por favor ingrese un monto válido mayor a 0.');
          return;
        }
        
        const currentUser = window.BulaPayDB.getCurrentUser();
        if (!currentUser) return;

        btnConfirmMov.disabled = true;
        btnConfirmMov.textContent = 'Procesando...';

        const agentId = currentUser.id || currentUser.username;

        try {
          // 1. Guardar la inyección ÚNICAMENTE en la tabla oficial capital_injections (fuente única v161)
          await window.BulaPayDB.injectCapital(currentUser.routeId, agentId, amount);

          alert(`✅ Inyección de $${amount.toLocaleString('es-CO')} ingresada exitosamente a caja.`);
          document.getElementById('cash-movement-amount').value = '';

          // Actualizar datos del modal de Cierre de Caja
          const { onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
          const elOnHand = document.getElementById('private-cash-on-hand');
          if (elOnHand) {
            if (onHand < 0) {
              elOnHand.textContent = `-$${Math.abs(onHand).toLocaleString('es-CO')}`;
              elOnHand.style.color = 'var(--color-rojo)';
            } else {
              elOnHand.textContent = `$${onHand.toLocaleString('es-CO')}`;
              elOnHand.style.color = 'var(--text-primary)';
            }
          }

          // Actualizar vistas y dashboard financiero global
          if (this && typeof this.renderFinancialDashboard === 'function') {
            await this.renderFinancialDashboard();
          } else if (window.agentModule && typeof window.agentModule.renderFinancialDashboard === 'function') {
            await window.agentModule.renderFinancialDashboard();
          } else if (window.AgentV6 && typeof window.AgentV6.renderFinancialDashboard === 'function') {
            await window.AgentV6.renderFinancialDashboard();
          }
        } catch (error) {
          console.error("Error al guardar inyección de capital:", error);
          alert('❌ Error al guardar la inyección en la base de datos: ' + (error.message || 'Error de conexión'));
        }
        
        btnConfirmMov.disabled = false;
        btnConfirmMov.textContent = 'Confirmar Movimiento';
      };
    }

    // Modal de Patrimonio Real del Negocio (Informativo Consolidado)
    const cashMgmtModal = document.getElementById('agent-cash-management-modal');
    const btnCashMgmt = document.getElementById('btn-trigger-cash-management-modal');
    if (cashMgmtModal && btnCashMgmt) {
      btnCashMgmt.onclick = async () => {
        cashMgmtModal.style.display = 'flex';
        await window.AgentV6.updateCashViews();
      };

      const btnCloseMgmt = document.getElementById('btn-close-cash-management');
      if (btnCloseMgmt) btnCloseMgmt.onclick = () => cashMgmtModal.style.display = 'none';

      const btnCloseX = document.getElementById('btn-close-patrimonio-x');
      if (btnCloseX) btnCloseX.onclick = () => cashMgmtModal.style.display = 'none';
    }
    
    // Modal de Lista Negra (Regla 4)
    if (btnBlacklist && blacklistModal) {
      const loadAndRenderBlacklist = async () => {
        blacklistModal.style.display = 'flex';
        const container = document.getElementById('private-blacklist-container');
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Cargando morosos...</p>';
        
        try {
          const currentUser = window.BulaPayDB.getCurrentUser();
          const targetRouteId = currentUser ? currentUser.routeId : null;
          const badClients = await window.BulaPayDB.getBlacklistedClients(targetRouteId);
          
          if (badClients.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #10b981; font-weight: bold;">🎉 ¡Felicidades! No tienes clientes en Lista Negra.</p>';
            return;
          }
          
          // Renderizar lista negra (v99: Deuda completa incluyendo Intereses proyectados - v145: Cierre de ciclo y actualización en vivo)
          container.innerHTML = badClients.map(c => {
            const moraDebt = Number(
              c.totalToPay || 
              c.totalDebt || 
              c.total_debt || 
              c.monto_total || 
              c.moraDebt || 
              (c.monto_prestado ? Math.round(Number(c.monto_prestado) * 1.2) : 0) || 
              (c.amount ? Math.round(Number(c.amount) * 1.2) : 0) || 
              c.outstanding || 
              0
            );
            const cedulaStr = String(c.cedula || c.cliente_id || c.client_id || '').trim();
            const rawName = String(c.name || c.nombre || '').trim();
            const isGeneric = !rawName || /^cliente\s+\d+$/i.test(rawName) || rawName.toLowerCase() === `cliente ${cedulaStr}`.toLowerCase() || rawName === cedulaStr;
            const titleText = (!isGeneric && rawName) ? `${rawName} (${cedulaStr})` : (cedulaStr || rawName || 'Sin Cédula');
            const cartonId = c.id || c.carton_id || '';

            return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-color); gap: 0.75rem;">
              <div>
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">${titleText}</h4>
                <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">CC: ${cedulaStr} | ${c.city || ''} ${c.zone ? '(' + c.zone + ')' : ''}</p>
                <span style="font-size: 0.72rem; color: #ef4444; font-weight: 600;">Estado: Liquidado por Mora (Lista Negra)</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem;">
                <span style="background-color: rgba(239, 68, 68, 0.1); color: var(--color-rojo); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700;">
                  Deuda Total (Capital + Intereses): $${moraDebt.toLocaleString('es-CO')}
                </span>
                <button type="button" class="btn-rehabilitate-card" data-cedula="${cedulaStr}" data-debt="${moraDebt}" data-carton-id="${cartonId}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 800; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3); cursor: pointer; transition: transform 0.1s;">
                  💳 Recibir Pago y Rehabilitar
                </button>
              </div>
            </div>
            `;
          }).join('');

          // Evento click para recibir pago y rehabilitar cliente desde la modal (v145)
          const rehabButtons = container.querySelectorAll('.btn-rehabilitate-card');
          rehabButtons.forEach(btn => {
            btn.onclick = async (evt) => {
              evt.stopPropagation();
              const cedula = btn.dataset.cedula;
              const debtVal = Number(btn.dataset.debt || 0);
              const cartonId = btn.dataset.cartonId;

              const inputVal = prompt(`Recibir pago para rehabilitar cliente (C.C. ${cedula}):`, debtVal > 0 ? debtVal : "120000");
              if (!inputVal) return;

              const amountToPay = Number(inputVal);
              if (isNaN(amountToPay) || amountToPay <= 0) {
                alert("⚠️ Por favor ingresa un monto válido mayor a 0.");
                return;
              }

              btn.disabled = true;
              btn.textContent = "⏳ Procesando...";

              const success = await window.BulaPayDB.rehabilitateBlacklistedClient(cedula, amountToPay, cartonId);
              if (success) {
                // Refrescar la interfaz completamente (v146)
                setTimeout(() => {
                  window.location.reload();
                }, 300);
              } else {
                btn.disabled = false;
                btn.textContent = "💳 Recibir Pago y Rehabilitar";
              }
            };
          });
          
        } catch (e) {
          console.error("Error al cargar Lista Negra:", e);
          container.innerHTML = '<p style="text-align: center; color: var(--color-rojo);">Error al cargar Lista Negra.</p>';
        }
      };

      btnBlacklist.onclick = loadAndRenderBlacklist;
    }
  },

  switchTab(tab) {
    this.tabCollect.classList.remove('active');
    this.tabHistory.classList.remove('active');
    this.tabRegister.classList.remove('active');
    if (this.panelCollect) this.panelCollect.style.setProperty('display', 'none', 'important');
    if (this.panelHistory) this.panelHistory.style.setProperty('display', 'none', 'important');
    if (this.panelRegister) this.panelRegister.style.setProperty('display', 'none', 'important');

    const blockedPanel = document.getElementById('gps-blocked-panel');

    if (tab === 'collect') {
      this.tabCollect.classList.add('active');
      
      // Limpiar Estado Cobro
      this.currentClient = null;
      if (this.inputCobroCedula) this.inputCobroCedula.value = '';
      if (this.inputSearchCedula) this.inputSearchCedula.value = '';
      if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'flex';
      if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'none', 'important');
      if (this.cobroInputState) this.cobroInputState.style.setProperty('display', 'block', 'important');
      if (this.cobroCartonState) this.cobroCartonState.style.setProperty('display', 'none', 'important');
      
      if (window.gpsBlocked) {
        this.panelCollect.style.setProperty('display', 'none', 'important');
        if (blockedPanel) blockedPanel.style.display = 'flex';
      } else {
        this.panelCollect.style.display = 'block';
        if (blockedPanel) blockedPanel.style.display = 'none';
      }
    } else {
      if (blockedPanel) blockedPanel.style.display = 'none';
      if (tab === 'history') {
        this.tabHistory.classList.add('active');
        if (this.panelHistory) this.panelHistory.style.setProperty('display', 'block', 'important');
        
        // Limpiar Estado Historial
        this.historyResults.style.display = 'none';
        this.historyError.style.display = 'none';
        this.historyPlaceholder.style.display = 'block';
        if (this.inputHistoryCedula) this.inputHistoryCedula.value = '';
      } else if (tab === 'register') {
        this.tabRegister.classList.add('active');
        if (this.panelRegister) this.panelRegister.style.setProperty('display', 'block', 'important');
        
        // Limpiar Estado Registro
        if (this.formRegisterClient) this.formRegisterClient.reset();

        const btnGuardar = document.getElementById('btn-registrar-cliente-oficial');
        if (btnGuardar) {
          btnGuardar.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('¡BINGO! El botón está vivo y conectado.');
            console.log('Intentando enviar a Supabase la tabla clients...');
            await this.registerNewClient();
          };
        }
      }
    }
  },

  async verificarHistorialCliente(cedula) {
    if (!cedula) {
      alert('⚠️ Por favor ingrese un número de Cédula.');
      return;
    }

    // Estado de Cargando...
    this.historyPlaceholder.style.display = 'none';
    this.historyError.style.display = 'none';
    this.historyResults.style.display = 'block';
    this.historyClientName.textContent = 'Cargando...';
    this.historyActiveCreditsAlert.style.display = 'none';
    this.historyTrafficLight.className = 'traffic-light-header';
    this.historyRiskStatus.textContent = '⏳ Buscando historial...';

    try {
      const cedulaBuscada = String(cedula || '').trim();
      const supabase = await window.BulaPayDB.initSupabase();

      // 1. CONSULTA DIRECTA A SUPABASE DE CARTONES DEL CLIENTE (v152)
      let hasHistoricalLoss = false;
      let hasCleanNewCredit = false;
      let hasActiveCredit = false;

      try {
        let userCartons = [];
        const { data: c1 } = await supabase.from('cartones').select('*').eq('cliente_id', cedulaBuscada);
        if (c1 && c1.length > 0) {
          userCartons = c1;
        } else {
          const { data: c2 } = await supabase.from('cartones').select('*').eq('cedula', cedulaBuscada);
          if (c2 && c2.length > 0) userCartons = c2;
        }
        
        if (userCartons && userCartons.length > 0) {
          userCartons.forEach(c => {
            const st = String(c.estado || c.status || '').trim().toLowerCase();
            const out = Number(c.outstanding || c.total_debt || 0);

            // Si el cliente tiene algún cartón previo en liquidado_perdida, liquidado_mora, o liquidado_pagado
            if (st === 'liquidado_perdida' || st === 'liquidado_mora' || st === 'liquidado_pagado' || st.includes('perdida') || st.includes('mora') || st.includes('castigado')) {
              hasHistoricalLoss = true;
            } else if (st === 'activo' && out > 0) {
              hasActiveCredit = true;
            } else if ((st === 'pagado' || st === 'liquidado') && !st.includes('perdida') && !st.includes('mora') && st !== 'liquidado_pagado') {
              hasCleanNewCredit = true;
            }
          });
        }
      } catch (eCartonErr) {
        console.warn("Aviso al consultar cartones del cliente en historial:", eCartonErr);
      }

      // 2. Consultar perfil del cliente en 'clients'
      const { data: dbClient } = await supabase
        .from('clients')
        .select('*')
        .eq('cedula', cedulaBuscada)
        .maybeSingle();

      const client = dbClient || (await window.BulaPayDB.getGlobalClientByCedula(cedulaBuscada));
      
      if (!client && !hasHistoricalLoss) {
        // Cliente NO existe: Ocultar resultados y mostrar error visual rojo
        this.historyResults.style.display = 'none';
        this.historyError.style.display = 'block';
        return;
      }

      const clientDisplayName = (client && (client.name || client.nombre)) ? (client.name || client.nombre) : `Cliente ${cedulaBuscada}`;
      this.historyResults.style.display = 'block';
      this.historyError.style.display = 'none';
      this.historyClientName.textContent = clientDisplayName;

      // 3. REGLA PARCHE DEFINITIVO RIESGO EN ROJO (v152):
      // Si tiene antecedentes de haber estado en liquidado_perdida o liquidado_pagado (recuperado), NO confiar ciegamente en risk='Verde'.
      // Forzar a ROJO salvo que tenga un crédito NUEVO abierto desde cero y pagado limpio.
      if (hasHistoricalLoss && !hasCleanNewCredit) {
        if (client) client.risk = 'Rojo';
        this.historyTrafficLight.className = 'traffic-light-header rojo';
        this.historyRiskStatus.textContent = '🔴 ROJO (Cliente de Riesgo / Antecedentes de Mora)';
        
        if (this.historyActiveCreditsAlert) {
          this.historyActiveCreditsAlert.style.display = 'flex';
          this.historyActiveCreditsAlert.className = 'risk-alert-box warning';
          this.historyActiveCreditsAlert.style.borderColor = 'var(--color-rojo, #ef4444)';
          this.historyActiveCreditsAlert.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
          this.historyActiveCreditsAlert.style.color = '#ef4444';
          this.historyActiveCreditsAlert.innerHTML = `⚠️ ADVERTENCIA DE HISTORIAL: Este cliente cuenta con antecedentes de crédito en pérdida/mora pasada. Requiere evaluación estricta antes de autorizar un nuevo crédito.`;
        }
        return;
      }

      // Flujo normal de evaluación para clientes sin antecedentes o con crédito nuevo limpio
      try {
        const payments = await window.BulaPayDB.getPaymentsByClient(cedulaBuscada);
        const dailyStatus = window.BulaPayDB.getDailyPaymentStatus(client, payments);
        const overdueCount = dailyStatus.filter(s => s.isOverdue).length;
        
        if (overdueCount >= 3) {
          client.risk = 'Rojo';
        } else if (overdueCount > 0) {
          client.risk = 'Amarillo';
        } else {
          client.risk = 'Verde';
        }
      } catch (e) {
        console.error("Error al calcular riesgo dinámico en historial:", e);
      }
      
      if (client.risk === 'Rojo') {
        this.historyTrafficLight.className = 'traffic-light-header rojo';
        this.historyRiskStatus.textContent = '🔴 ROJO (Alto Riesgo)';
      } else if (client.risk === 'Amarillo') {
        this.historyTrafficLight.className = 'traffic-light-header amarillo';
        this.historyRiskStatus.textContent = '🟡 AMARILLO (Riesgo Medio)';
      } else {
        this.historyTrafficLight.className = 'traffic-light-header verde';
        this.historyRiskStatus.textContent = '🟢 VERDE (Buen Cliente)';
      }

      // Solo mostrar alerta de crédito activo si REALMENTE tiene un cartón activo con saldo pendiente
      if (hasActiveCredit) {
        let agentName = client?.agent_id || 'Desconocido';
        try {
          if (client?.agent_id) {
            const agentUser = await window.BulaPayDB.getUserByUsername(client.agent_id);
            if (agentUser) agentName = agentUser.name || agentUser.username;
          }
        } catch (e) {}
        const municipality = client?.city || 'Desconocido';
        
        if (this.historyActiveCreditsAlert) {
          this.historyActiveCreditsAlert.style.display = 'flex';
          this.historyActiveCreditsAlert.className = 'risk-alert-box warning';
          this.historyActiveCreditsAlert.style.borderColor = '';
          this.historyActiveCreditsAlert.style.backgroundColor = '';
          this.historyActiveCreditsAlert.style.color = '';
          this.historyActiveCreditsAlert.innerHTML = `⚠️ Atención: Este cliente tiene un crédito activo con el agente ${agentName} en el municipio ${municipality}.`;
        }
      } else {
        if (this.historyActiveCreditsAlert) {
          this.historyActiveCreditsAlert.style.display = 'none';
        }
      }

    } catch (err) {
      console.error("Error al consultar Supabase:", err);
      alert('❌ Error al consultar la central de riesgos.');
      this.historyPlaceholder.style.display = 'block';
      this.historyResults.style.display = 'none';
      this.historyError.style.display = 'none';
    }
  },

  async openPaymentCard() {
    if (!this.currentClient) {
      alert('⚠️ Por favor busque un cliente primero.');
      return;
    }

    // Rellenar datos del cliente en el modal
    this.paymentCardClientName.textContent = this.currentClient.name;
    this.paymentCardClientCedula.textContent = this.currentClient.cedula;
    this.paymentCardClientOutstanding.textContent = `$${Number(this.currentClient.outstanding).toLocaleString('es-CO')}`;

    // Renderizar la cuadrícula
    await this.renderPaymentCardGrid();

    // Mostrar el modal overlay
    this.paymentCardModal.style.display = 'flex';
  },

  closePaymentCard() {
    this.paymentCardModal.style.display = 'none';
    this.isMassPaymentMode = false;
    this.selectedInstallments = [];
    if (this.massPaymentSwitch) this.massPaymentSwitch.checked = false;
    if (this.btnProcessMassPayment) this.btnProcessMassPayment.style.display = 'none';
  },

  async renderPaymentCardGrid() {
    if (!this.paymentCardGrid) return;
    this.paymentCardGrid.innerHTML = '';
    
    const client = this.currentClient;
    if (!client) return;

    const totalInstallments = Number(client?.installmentsCount || client?.installments_count || 20);
    const installmentAmount = Number(client?.installmentAmount || client?.installment_amount || 8000);
    const cedula = client?.cedula;
    if (!cedula) return;
    
    // Obtener los pagos reales desde Supabase
    const payments = await window.BulaPayDB.getPaymentsByClient(cedula);
    
    const cartonDateStr = client.fecha_apertura || client.fecha_inicio || client.created_at;
    const startDate = cartonDateStr ? new Date(cartonDateStr) : new Date();
    const startZero = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    
    const paymentDates = new Set();
    payments.forEach(p => {
      if (p.amount > 0 && p.status !== 'No Pago') {
        paymentDates.add(p.date);
      }
    });

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let dayCount = 0;
    let cuotaIdx = 1;

    // Generar celdas hasta completar el cartón
    while (cuotaIdx <= totalInstallments) {
      const currentDayDate = new Date(startZero);
      currentDayDate.setDate(startZero.getDate() + dayCount);
      
      // Saltar Domingos (0)
      if (currentDayDate.getDay() === 0) {
        dayCount++;
        continue;
      }
      
      const dayStr = currentDayDate.toISOString().split('T')[0];
      const isPast = currentDayDate < todayZero;
      const hasPaid = paymentDates.has(dayStr);
      
      const cell = document.createElement('div');
      cell.classList.add('payment-card-cell');
      
      if (hasPaid) {
        cell.classList.add('pagado');
        cell.innerHTML = `Cuota ${cuotaIdx}<br>✔`;
      } else if (isPast) {
        cell.classList.add('atrasado');
        cell.innerHTML = `Cuota ${cuotaIdx}<br>⚠️`;
      } else {
        cell.classList.add('pendiente');
        cell.innerHTML = `Cuota ${cuotaIdx}<br>$${Number(installmentAmount).toLocaleString('es-CO')}`;
      }
      
      // Manejar clicks (excepto si ya está pagado)
      if (!hasPaid) {
        const currentCuota = cuotaIdx;
        const currentAmount = installmentAmount;
        const currentDayStr = dayStr;
        const currentIsPast = isPast;
        
        // Mantener selección visual si ya estaba seleccionada
        if (this.isMassPaymentMode && this.selectedInstallments.find(i => i.number === currentCuota)) {
          cell.classList.add('selected');
        }

        cell.style.cursor = 'pointer';
        cell.onclick = () => {
          if (this.isMassPaymentMode) {
            const idx = this.selectedInstallments.findIndex(i => i.number === currentCuota);
            if (idx > -1) {
              this.selectedInstallments.splice(idx, 1);
              cell.classList.remove('selected');
            } else {
              this.selectedInstallments.push({ number: currentCuota, amount: currentAmount, date: currentDayStr });
              cell.classList.add('selected');
            }
            
            // Actualizar botón procesar
            if (this.selectedInstallments.length > 0) {
              this.btnProcessMassPayment.style.display = 'block';
              const total = this.selectedInstallments.reduce((sum, item) => sum + item.amount, 0);
              this.btnProcessMassPayment.innerText = `Procesar Pago Masivo (${this.selectedInstallments.length}) - Total: $${total.toLocaleString('es-CO')}`;
            } else {
              this.btnProcessMassPayment.style.display = 'none';
            }
          } else {
            const todayStr = this.getLocalDateString();
            if (!currentIsPast && currentDayStr > todayStr) {
              alert('Candado: No se pueden cobrar cuotas futuras en modo normal. Active el Pago Masivo para adelantar cuotas.');
              return;
            }
            this.payInstallmentFromCard(currentCuota, currentAmount, currentDayStr);
          }
        };
      }
      
      this.paymentCardGrid.appendChild(cell);
      
      cuotaIdx++;
      dayCount++;
    }
  },

  async payInstallmentFromCard(installmentNumber, amount) {
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      // Validar si ya pagó hoy
      const todayStr = this.getLocalDateString();
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: installmentNumber,
        amount: amount,
        date: this.getLocalDateString(),
        agentName: currentUser.name,
        status: 'Pagado'
      };

      // Registrar el pago en Supabase y actualizar el saldo del cliente
      const savedPayment = await window.BulaPayDB.addPayment(newPayment);

      // Reportar geolocalización
      this.captureAndSendLocation();

      // Mostrar recibo digital
      window.showBulaPayReceipt(savedPayment, this.currentClient);

      // Re-consultar los datos del cliente actualizados
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      // Actualizar la interfaz principal del cobrador
      await this.renderClientInfo(updatedClient);

      // Refrescar el Cartón de Pagos
      await this.renderPaymentCardGrid();
      
      // Actualizar saldo mostrado en el modal
      this.paymentCardClientOutstanding.textContent = `$${Number(updatedClient.outstanding).toLocaleString('es-CO')}`;
      
      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
      
    } catch (err) {
      console.error("Error al pagar cuota desde cartón:", err);
      if (err.message && (err.message.includes('Precaución') || err.message.includes('Acceso Denegado'))) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el pago de la cuota.');
      }
    }
  },

  async processMassPayment() {
    if (!this.selectedInstallments || this.selectedInstallments.length === 0) return;
    
    if (this.selectedInstallments.length < 2) {
      alert('Operación denegada: El Pago Masivo requiere seleccionar 2 o más cuotas. Para pagos individuales, espere a mañana.');
      return;
    }
    
    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };
    const todayStr = this.getLocalDateString();
    
    try {
      this.btnProcessMassPayment.disabled = true;
      this.btnProcessMassPayment.innerText = 'Procesando...';
      
      let totalAmount = 0;
      let lastPayment = null;
      
      // Procesar en lote (una por una para mantener el ledger intacto)
      for (const cuota of this.selectedInstallments) {
        const newPayment = {
          clientCedula: this.currentClient.cedula,
          installmentNumber: cuota.number,
          amount: cuota.amount,
          date: todayStr, // La instrucción dice: usar fecha de HOY
          agentName: currentUser.name,
          status: 'Pagado Masivo',
          is_mass_payment: true
        };
        lastPayment = await window.BulaPayDB.addPayment(newPayment);
        totalAmount += cuota.amount;
      }

      // 2. Date Shifting (Corrimiento de Fechas) Estricto
      await window.BulaPayDB.shiftPendingDates(this.currentClient.cedula);

      // Reportar geolocalización una sola vez
      this.captureAndSendLocation();

      // Preparar recibo virtual agrupado
      if (lastPayment) {
        const fakePaymentForReceipt = {
          ...lastPayment,
          amount: totalAmount, // Gran total
          installmentNumber: `Masivo (${this.selectedInstallments.length} cuotas)` 
        };
        window.showBulaPayReceipt(fakePaymentForReceipt, this.currentClient);
      }

      // Reset UI y Estados
      this.isMassPaymentMode = false;
      this.selectedInstallments = [];
      if (this.massPaymentSwitch) this.massPaymentSwitch.checked = false;
      if (this.btnProcessMassPayment) {
        this.btnProcessMassPayment.style.display = 'none';
      }

      // Re-consultar los datos del cliente actualizados
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      if (Number(updatedClient.outstanding) <= 0) {
        await window.BulaPayDB.liquidateCredit({
          cedula: updatedClient.cedula,
          status: 'Liquidado_Pagado',
          outstanding: 0
        });
        alert('🎉 ¡Felicitaciones! Esta es tu última cuota, el cartón se liquidará automáticamente, te invitamos a adquirir otro crédito');
        await this.renderFinancialDashboard();
        await this.searchClient();
      } else {
        // Actualizar la interfaz principal del cobrador, Cartón y estado de liquidación
        await this.renderClientInfo(updatedClient);
        this.updateCobroViewState(updatedClient);
        
        // Actualizar saldo mostrado en el modal
        if (this.paymentCardClientOutstanding) {
          this.paymentCardClientOutstanding.textContent = `$${Number(updatedClient.outstanding).toLocaleString('es-CO')}`;
        }
        
        // Actualizar botón de seguimiento
        await this.updateRouteTracking();

        // Actualizar métricas financieras en tiempo real (v168)
        await this.renderFinancialDashboard();
        
        // Mostrar modal obligatorio SMS para notificar el pago masivo
        this.showMandatorySmsPrompt(updatedClient, 'payment');
      }
      
    } catch (err) {
      console.error("Error al procesar pago masivo:", err);
      alert('❌ Error al procesar el pago masivo. ' + err.message);
    } finally {
      if (this.btnProcessMassPayment) {
        this.btnProcessMassPayment.disabled = false;
      }
    }
  },

  updateCobroInvoiceButtonState() {
    if (!this.btnCobroInvoice) return;
    if (!this.currentClient) {
      this.btnCobroInvoice.disabled = true;
      this.btnCobroInvoice.style.cursor = 'not-allowed';
      this.btnCobroInvoice.style.opacity = '0.5';
      return;
    }

    // Bloqueo Inteligente: Si el cliente YA hizo un pago físico hoy, se deshabilita el atajo directo (en gris)
    if (this.hasPaidRecordToday) {
      this.btnCobroInvoice.disabled = true;
      this.btnCobroInvoice.style.cursor = 'not-allowed';
      this.btnCobroInvoice.style.opacity = '0.5';
      this.btnCobroInvoice.title = 'Ya existe un pago registrado hoy. Use Registrar Pago para ir al Cartón (Pago Masivo).';
      return;
    }

    this.btnCobroInvoice.title = '';
    const outstanding = Number(this.currentClient.outstanding || 0);
    const amountVal = this.inputCobroAmount ? parseFloat(this.inputCobroAmount.value) : 0;

    // Regla simple y reactiva: Si el cliente tiene deuda activa (outstanding > 0) y el monto es mayor a 0 (o ingresándose), el atajo se HABILITA.
    if (outstanding > 0 && (!this.inputCobroAmount || (!isNaN(amountVal) && amountVal > 0) || this.inputCobroAmount.value === '')) {
      this.btnCobroInvoice.disabled = false;
      this.btnCobroInvoice.style.cursor = 'pointer';
      this.btnCobroInvoice.style.opacity = '1';
    } else {
      this.btnCobroInvoice.disabled = true;
      this.btnCobroInvoice.style.cursor = 'not-allowed';
      this.btnCobroInvoice.style.opacity = '0.5';
    }
  },

  updateCobroViewState(client, dailyStatusList = null) {
    if (!client) return;

    const outstanding = Number(client.outstanding || 0);
    const amount = Number(client.amount || client.monto_prestado || 0);
    const totalDebt = Number(client.totalDebt || client.total_debt || 0);
    const rawStatus = String(client.status || client.estado || '').trim().toUpperCase();
    const isLossStatus = rawStatus.includes('PERDIDA') || rawStatus.includes('MORA') || rawStatus.includes('NEGRA') || rawStatus.includes('CASTIGADO');
    const isLiquidadoStatus = (rawStatus.includes('LIQUIDADO') || rawStatus.includes('CANCELAD') || rawStatus === 'SIN DEUDA ACTIVA') && !isLossStatus;

    const isBlacklisted = client.risk === 'Rojo' || 
                          String(client.risk || '').trim().toLowerCase() === 'rojo' || 
                          isLossStatus;

    const cobroFormFields = document.getElementById('cobro-form-fields');
    const cobroLiquidatedBanner = document.getElementById('cobro-liquidated-banner');
    const cobroBlacklistBanner = document.getElementById('cobro-blacklist-banner');
    const cobroActionButtonsWrapper = document.getElementById('cobro-action-buttons-wrapper');

    if (cobroActionButtonsWrapper) {
      cobroActionButtonsWrapper.style.setProperty('display', 'flex', 'important');
    }

    // RENDERIZADO CONDICIONAL DE MÁXIMA PRIORIDAD: Cliente en Lista Negra (risk === 'Rojo')
    if (isBlacklisted) {
      if (cobroFormFields) cobroFormFields.style.setProperty('display', 'none', 'important');
      if (cobroLiquidatedBanner) cobroLiquidatedBanner.style.setProperty('display', 'none', 'important');
      if (cobroBlacklistBanner) cobroBlacklistBanner.style.setProperty('display', 'block', 'important');

      const moraDebt = Math.round(Number(
        client.totalToPay || 
        client.totalDebt || 
        client.total_debt || 
        client.monto_total || 
        client.moraDebt || 
        (client.monto_prestado ? Math.round(Number(client.monto_prestado) * 1.2) : 0) || 
        (client.amount ? Math.round(Number(client.amount) * 1.2) : 0) || 
        client.outstanding || 
        0
      ));

      if (this.cobroClientOutstanding) {
        this.cobroClientOutstanding.textContent = `$${moraDebt.toLocaleString('es-CO')}`;
      }

      const debtInfoEl = document.getElementById('cobro-blacklist-debt-info');
      if (debtInfoEl) {
        debtInfoEl.textContent = `Saldo Pendiente de Recuperación: $${moraDebt.toLocaleString('es-CO')}`;
      }

      const inputPayAmount = document.getElementById('input-blacklist-pay-amount');
      if (inputPayAmount && (!inputPayAmount.value || Number(inputPayAmount.value) === 0)) {
        inputPayAmount.value = moraDebt;
      }

      const btnPayRehab = document.getElementById('btn-pay-and-rehabilitate');
      if (btnPayRehab) {
        btnPayRehab.textContent = "💳 Pagar Deuda y Rehabilitar Cliente";
        btnPayRehab.onclick = async () => {
          const targetAmount = Number(inputPayAmount ? inputPayAmount.value : moraDebt);
          if (!targetAmount || targetAmount <= 0) {
            alert("⚠️ Por favor ingresa un monto válido a recibir.");
            return;
          }
          btnPayRehab.disabled = true;
          btnPayRehab.textContent = "⏳ Procesando pago...";
          const success = await window.BulaPayDB.rehabilitateBlacklistedClient(client.cedula, targetAmount);
          if (success) {
            await agentModule.searchClient();
            await agentModule.renderFinancialDashboard();
            await agentModule.updateRouteTracking();
          } else {
            btnPayRehab.disabled = false;
            btnPayRehab.textContent = "💳 Pagar Deuda y Rehabilitar Cliente";
          }
        };
      }

      if (this.btnLiquidarCarton) {
        this.btnLiquidarCarton.style.setProperty('display', 'none', 'important');
      }
      this.updateCobroInvoiceButtonState();
      this.updateCobroActionButtonsState(client, dailyStatusList, true);
      return;
    } else {
      if (cobroBlacklistBanner) cobroBlacklistBanner.style.setProperty('display', 'none', 'important');
    }

    // Condición: El cliente no tiene deuda activa si outstanding <= 0 o sus saldos numéricos son 0 o su estado es liquidado
    const isWithoutActiveDebt = (outstanding <= 0 || (amount <= 0 && totalDebt <= 0) || isLiquidadoStatus);

    if (isWithoutActiveDebt) {
      // 1. Ocultar el formulario de cobro (monto y botón de confirmar pago)
      if (cobroFormFields) cobroFormFields.style.setProperty('display', 'none', 'important');
      // 2. Mostrar letrero verde claro "✅ Cartón Liquidado / Cliente sin deuda activa"
      if (cobroLiquidatedBanner) cobroLiquidatedBanner.style.setProperty('display', 'block', 'important');
    } else {
      // Cliente con cuotas/deuda activa (outstanding > 0)
      if (cobroFormFields) cobroFormFields.style.setProperty('display', 'block', 'important');
      if (cobroLiquidatedBanner) cobroLiquidatedBanner.style.setProperty('display', 'none', 'important');
    }

    if (this.btnLiquidarCarton) {
      if (!isLossStatus) {
        this.btnLiquidarCarton.style.removeProperty('display');
        this.btnLiquidarCarton.style.display = 'inline-flex';
        this.btnLiquidarCarton.disabled = false;
        this.btnLiquidarCarton.style.cursor = 'pointer';
        this.btnLiquidarCarton.style.opacity = '1';
      } else {
        this.btnLiquidarCarton.style.setProperty('display', 'none', 'important');
      }
    }

    this.updateCobroInvoiceButtonState();
    this.updateCobroActionButtonsState(client, dailyStatusList, isWithoutActiveDebt);
    this.renderOverdueBanner(client, dailyStatusList);
  },

  renderOverdueBanner(client, dailyStatusList = null) {
    const banner = document.getElementById('cobro-overdue-banner');
    if (!banner) return;

    if (!client) {
      banner.style.display = 'none';
      return;
    }

    const isOverdue = this.isCartonOverdue(client, dailyStatusList);

    if (isOverdue && Number(client.outstanding) > 0) {
      banner.style.display = 'block';
      const infoEl = document.getElementById('overdue-banner-info');
      if (infoEl) {
        const outstandingFmt = Number(client.outstanding).toLocaleString('es-CO');
        infoEl.textContent = `El cliente ${client.name} (C.C. ${client.cedula}) tiene el plazo vencido con un saldo de $${outstandingFmt}.`;
      }
    } else {
      banner.style.display = 'none';
    }
  },

  parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    const s = String(dateStr).trim();
    if (s.includes('T')) {
      const datePart = s.split('T')[0];
      const parts = datePart.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else if (s.includes('-')) {
      const parts = s.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },

  calculateCartonDueDate(startDateObj, totalInstallments) {
    let validDaysCounter = 0;
    let calendarDaysOffset = 0;
    let lastDate = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
    
    while (validDaysCounter < totalInstallments) {
      const currentDayDate = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
      currentDayDate.setDate(currentDayDate.getDate() + calendarDaysOffset);
      calendarDaysOffset++;
      
      if (currentDayDate.getDay() === 0) continue; // Saltar domingos
      
      validDaysCounter++;
      lastDate = currentDayDate;
    }
    return lastDate;
  },

  isCartonOverdue(client, dailyStatusList = null) {
    if (!client || Number(client?.outstanding || 0) <= 0) return false;

    const totalInstallmentsCount = Number(client?.installmentsCount || client?.installments_count || 30);
    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayStr = `${todayZero.getFullYear()}-${String(todayZero.getMonth() + 1).padStart(2, '0')}-${String(todayZero.getDate()).padStart(2, '0')}`;

    // 1. Chequeo por dailyStatusList si existe
    if (dailyStatusList && dailyStatusList.length > 0) {
      const lastInstallment = dailyStatusList.find(s => s?.dayNumber === totalInstallmentsCount) || dailyStatusList[dailyStatusList.length - 1];
      if (lastInstallment && lastInstallment?.dateStr && lastInstallment?.dateStr < todayStr) {
        return true;
      }
    }

    // 2. Chequeo directo por fecha_apertura
    const cartonDateStr = client?.fecha_apertura || client?.fecha_inicio || client?.created_at;
    if (!cartonDateStr) return false;

    const startDate = this.parseLocalDate(cartonDateStr);
    const dueDate = this.calculateCartonDueDate(startDate, totalInstallmentsCount);

    const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

    return todayStr > dueDateStr;
  },

  canRenovarCarton(client, dailyStatusList = null) {
    if (!client) return false;
    if (Number(client?.outstanding || 0) <= 0) return true; // Cliente sin deuda activa puede renovar

    const totalInstallmentsCount = Number(client?.installmentsCount || client?.installments_count || 30);
    const halfTerm = Math.ceil(totalInstallmentsCount / 2);

    let paidCount = 0;
    if (dailyStatusList && dailyStatusList.length > 0) {
      paidCount = dailyStatusList.filter(s => s.hasPaid).length;
    } else {
      const debt = Number(client.totalDebt || client.total_debt || (client.amount * 1.2) || 0);
      const out = Number(client.outstanding || 0);
      const paidAmt = Math.max(0, debt - out);
      if (debt > 0) {
        paidCount = Math.round((paidAmt / debt) * totalInstallmentsCount);
      }
    }

    const cartonDateStr = client.fecha_apertura || client.fecha_inicio || client.created_at;
    let daysElapsed = 0;
    if (cartonDateStr) {
      const startDate = this.parseLocalDate(cartonDateStr);
      const today = new Date();
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let tempDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      while (tempDate < todayZero) {
        if (tempDate.getDay() !== 0) daysElapsed++;
        tempDate.setDate(tempDate.getDate() + 1);
      }
    }

    const isOverdue = this.isCartonOverdue(client, dailyStatusList);
    const hasPaidHalfOrMore = paidCount >= halfTerm || daysElapsed >= halfTerm;

    return hasPaidHalfOrMore || isOverdue;
  },

  updateCobroActionButtonsState(client, dailyStatusList, isWithoutActiveDebt) {
    const btnRenovar = document.getElementById('btn-cobro-renovar');
    const btnLiquidarMora = document.getElementById('btn-cobro-liquidar-mora');

    if (!client) return;

    const canRenovar = this.canRenovarCarton(client, dailyStatusList) || isWithoutActiveDebt;
    const isOverdueCarton = this.isCartonOverdue(client, dailyStatusList);
    const rawSt = String(client?.estado || client?.status || '').toLowerCase();
    const isMoraOrPerdida = rawSt.includes('mora') || rawSt.includes('perdida') || String(client?.risk || '').toLowerCase() === 'rojo';

    // Habilitar botón de liquidar por mora ÚNICAMENTE si el cartón está vencido por fecha o en mora
    const canLiquidarMora = (isOverdueCarton || isMoraOrPerdida) && !isWithoutActiveDebt;

    if (btnRenovar) {
      btnRenovar.style.removeProperty('display');
      btnRenovar.style.display = 'inline-flex';
      btnRenovar.style.alignItems = 'center';
      btnRenovar.style.justifyContent = 'center';
      if (canRenovar) {
        btnRenovar.disabled = false;
        btnRenovar.style.opacity = '1';
        btnRenovar.style.cursor = 'pointer';
        btnRenovar.title = 'Liquidar cartón actual para solicitar renovación';
      } else {
        btnRenovar.disabled = true; // Deshabilitado hasta cumplir la mitad del cobro (cuota 15+)
        btnRenovar.style.opacity = '0.4';
        btnRenovar.style.cursor = 'not-allowed';
        btnRenovar.title = 'Solo se habilita desde la cuota 15 en adelante (mitad del cobro cumplida)';
      }
    }

    if (btnLiquidarMora) {
      btnLiquidarMora.style.removeProperty('display');
      btnLiquidarMora.style.display = 'inline-flex';
      btnLiquidarMora.style.alignItems = 'center';
      btnLiquidarMora.style.justifyContent = 'center';
      if (canLiquidarMora) {
        btnLiquidarMora.disabled = false;
        btnLiquidarMora.style.opacity = '1';
        btnLiquidarMora.style.cursor = 'pointer';
        btnLiquidarMora.title = 'Liquidar por mora / Lista Negra';
      } else {
        btnLiquidarMora.disabled = true;
        btnLiquidarMora.style.opacity = '0.4';
        btnLiquidarMora.style.cursor = 'not-allowed';
        btnLiquidarMora.title = 'Disponible solo para préstamos vencidos en mora';
      }
    }
  },

  async searchClient() {
    const cedula = this.inputSearchCedula.value.trim();
    if (!cedula) {
      alert('⚠️ Por favor ingrese un número de Cédula.');
      return;
    }

    try {
      const client = await window.BulaPayDB.getClientByCedula(cedula);
      if (!client) {
        alert('❌ Cliente no registrado en el sistema BulaPay.');
        if (this.cobroActionContainer) this.cobroActionContainer.style.display = 'none';
        if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'block';
        if (this.searchError) this.searchError.style.display = 'none';
        return;
      }

      if (this.searchError) this.searchError.style.display = 'none';
      
      this.currentClient = client;
      
      if (this.btnCobroLiquidarMora) {
        this.btnCobroLiquidarMora.dataset.cartonId = client.carton_id || client.id || '';
        this.btnCobroLiquidarMora.dataset.numeroCarton = client.numero_carton || '';
        this.btnCobroLiquidarMora.dataset.cedula = client.cedula || '';
        this.btnCobroLiquidarMora.dataset.name = client.name || '';
        const cap = Number(client.amount || client.monto_prestado || client.capital_prestado || 0);
        this.btnCobroLiquidarMora.dataset.totalConIntereses = client.totalToPay || client.totalDebt || client.monto_total || client.total_debt || (cap ? Math.round(cap * 1.2) : 0);
      }
      if (this.btnLiquidarCarton) {
        this.btnLiquidarCarton.dataset.cartonId = client.carton_id || client.id || '';
        this.btnLiquidarCarton.dataset.numeroCarton = client.numero_carton || '';
        this.btnLiquidarCarton.dataset.cedula = client.cedula || '';
        this.btnLiquidarCarton.dataset.name = client.name || '';
        this.btnLiquidarCarton.dataset.totalDebt = client.totalToPay || client.totalDebt || client.monto_total || client.total_debt || 0;
        this.btnLiquidarCarton.dataset.outstanding = client.outstanding || client.saldo_restante || 0;
        this.btnLiquidarCarton.dataset.amount = client.amount || client.monto_prestado || 0;
      }
      
      // Mostrar la tarjeta minimalista aislada y asegurar estado inicial
      if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'none';
      if (this.cobroActionContainer) this.cobroActionContainer.style.setProperty('display', 'block', 'important');
      if (this.cobroInputState && this.cobroCartonState) {
        this.cobroInputState.style.setProperty('display', 'block', 'important');
        this.cobroCartonState.style.setProperty('display', 'none', 'important');
      }
      
      if (this.cobroClientName) this.cobroClientName.textContent = client.name;
      if (this.cobroClientOutstanding) this.cobroClientOutstanding.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
      
      if (this.inputCobroAmount) {
        this.inputCobroAmount.value = Math.min(Number(client.installmentAmount), Math.max(0, Number(client.outstanding)));
      }

      // Aplicar reactivamente el estado visual y bloqueo inteligente según el saldo del cliente
      this.updateCobroViewState(client);

      // Preparar el Cartón Interactivo (Flujo B)
      if (this.cobroOverdueDaysList) {
        try {
          const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
          const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(client, payments);
          const todayStr = this.getLocalDateString();
          this.hasPaidRecordToday = payments ? payments.some(p => p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago') : false;
          
          // Re-evaluar estado de los botones de pago, renovación y liquidación por mora
          this.updateCobroViewState(client, dailyStatusList);

          window.BulaPayDB.renderOverdueDaysList(
            this.cobroOverdueDaysList, 
            dailyStatusList, 
            (status) => this.handleCartonPayment(status) // Callback interactivo solo aquí
          );


        } catch (e) {
          console.error("Error al preparar cartón interactivo:", e);
        }
      }
      
    } catch (err) {
      console.error(err);
      if (err.message === 'ACCESO_DENEGADO_OTRO_AGENTE') {
        if (this.searchError) {
          this.searchError.style.display = 'block';
          this.searchError.textContent = 'Operación denegada: Este cliente pertenece a la ruta de otro asesor. No puedes gestionar sus cobros.';
        } else {
          alert('Operación denegada: Este cliente pertenece a la ruta de otro asesor. No puedes gestionar sus cobros.');
        }
        if (this.cobroActionContainer) this.cobroActionContainer.style.display = 'none';
        if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'none';
      } else {
        alert('❌ Error al buscar cliente.');
      }
    }
  },

  handleInvoiceRequest() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
    if (!this.currentClient) return;

    const amount = parseFloat(this.inputCobroAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('⚠️ Ingrese un valor válido de recaudo.');
      return;
    }

    // Regla de Seguridad 1: Prevención de Saldos Negativos
    if (amount > Number(this.currentClient.outstanding)) {
      alert('Error: El pago supera la deuda actual');
      return;
    }

    // Abrir Modal de Factura
    if (this.cobroInvoiceModal) {
      this.invoiceClientName.textContent = this.currentClient.name;
      this.invoiceAmount.textContent = `$${amount.toLocaleString('es-CO')}`;
      
      const newBalance = Number(this.currentClient.outstanding) - amount;
      this.invoiceNewBalance.textContent = `$${newBalance.toLocaleString('es-CO')}`;
      
      this.cobroInvoiceModal.style.display = 'flex';
    }
  },

  async executePaymentTransaction() {
    if (this.isLoadingPayment) return;
    this.isLoadingPayment = true;

    if (this.btnInvoiceConfirm) {
      this.btnInvoiceConfirm.disabled = true;
      this.btnInvoiceConfirm.innerHTML = 'Procesando...';
    }

    try {
      const amount = parseFloat(this.inputCobroAmount.value);
      const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
      
      const todayStr = this.getLocalDateString();
      const firstPending = dailyStatusList.find(c => !c.hasPaid);

      // Búsqueda de la primera cuota pendiente
      if (!firstPending) {
        alert('⚠️ El cliente no tiene cuotas pendientes por cobrar.');
        if (this.cobroInvoiceModal) this.cobroInvoiceModal.style.display = 'none';
        return;
      }

      const hasPaidRecordToday = payments.some(p => p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago');

      if (firstPending.isFuture && hasPaidRecordToday) {
        alert('Operación denegada: Ya se adelantó una cuota individual hoy. Use Pago Masivo para adelantar más días, o espere a mañana.');
        if (this.cobroInvoiceModal) this.cobroInvoiceModal.style.display = 'none';
        return;
      }

      // Ejecución del pago apuntando a la primera cuota pendiente
      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: firstPending.dayNumber,
        amount: amount,
        date: todayStr,
        agentName: currentUser.name,
        status: amount >= Number(this.currentClient.installmentAmount) ? 'Pagado' : 'Abonado'
      };

      await window.BulaPayDB.addPayment(newPayment);
      
      // Si llega aquí, es porque NO hubo error en Supabase
      this.captureAndSendLocation();

      // Cerrar Modal de Factura / Ticket al tener éxito
      if (this.cobroInvoiceModal) {
        this.cobroInvoiceModal.style.display = 'none';
      }

      // Forzar re-render descargando las cuotas nuevamente (El Fix visual)
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      if (this.inputCobroAmount) {
        this.inputCobroAmount.value = '';
      }
      
      await this.searchClient(); // Recarga y repinta los datos completos

      // Liquidación Automática de Última Cuota (v83)
      if (Number(updatedClient.outstanding) <= 0) {
        await window.BulaPayDB.liquidateCredit({
          cedula: updatedClient.cedula,
          status: 'Liquidado_Pagado',
          outstanding: 0
        });
        alert('🎉 ¡Felicitaciones! Esta es tu última cuota, el cartón se liquidará automáticamente, te invitamos a adquirir otro crédito');
        await this.renderFinancialDashboard();
        await this.searchClient();
      } else {
        // Mostrar modal obligatorio SMS para notificar el pago
        this.showMandatorySmsPrompt(updatedClient, 'payment');
      }
      
    } catch (e) {
      console.error("Error capturado en Confirmar Pago:", e);
      alert('Error REAL: ' + (e.message || 'Fallo desconocido al registrar el pago.'));
    } finally {
      this.isLoadingPayment = false;
      if (this.btnInvoiceConfirm) {
        this.btnInvoiceConfirm.disabled = false;
        this.btnInvoiceConfirm.innerHTML = 'Pagar';
      }
      this.updateCobroInvoiceButtonState();
    }
  },

  async handleCartonPayment(status) {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada.');
      return;
    }
    if (!this.currentClient) return;
    
    const amountToPay = Math.min(Number(this.currentClient.installmentAmount), Number(this.currentClient.outstanding));

    if (this.isMassPaymentMode) {
      if (status.hasPaid) return;
      
      const idx = this.selectedInstallments.findIndex(i => i.number === status.dayNumber);
      if (idx > -1) {
        this.selectedInstallments.splice(idx, 1);
      } else {
        this.selectedInstallments.push({ number: status.dayNumber, amount: amountToPay, date: status.dateStr });
      }
      
      if (this.selectedInstallments.length > 0) {
        this.btnProcessMassPayment.style.display = 'block';
        const total = this.selectedInstallments.reduce((sum, item) => sum + item.amount, 0);
        this.btnProcessMassPayment.innerText = `Procesar Pago Masivo (${this.selectedInstallments.length}) - Total: $${total.toLocaleString('es-CO')}`;
      } else {
        this.btnProcessMassPayment.style.display = 'none';
      }
      
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
      const selectedIds = this.selectedInstallments.map(i => i.number);
      window.BulaPayDB.renderOverdueDaysList(this.cobroOverdueDaysList, dailyStatusList, (st) => this.handleCartonPayment(st), selectedIds);
      return;
    }
    
    const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
    const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
    const firstPending = dailyStatusList.find(s => !s.hasPaid);

    const todayStr = this.getLocalDateString();
    const hasPaidRecordToday = payments.some(p => p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago');

    if (firstPending && firstPending.isFuture && hasPaidRecordToday) {
      alert('Operación denegada: Ya se adelantó una cuota individual hoy. Use Pago Masivo para adelantar más días, o espere a mañana.');
      return;
    }

    if (status.isFuture) {
      // Excepción de Días Futuros: SIEMPRE permitir cobrar la primera cuota pendiente
      if (!firstPending || status.dayNumber !== firstPending.dayNumber) {
        alert('Operación denegada: Solo se puede cobrar la primera cuota pendiente o activar el modo Pago Masivo para adelantar múltiples pagos.');
        return;
      }
    }

    // Confirmación nativa
    const dateLabel = status.dateStr.slice(5);
    const isConfirmed = confirm(`¿Marcar Día ${status.dayNumber} (${dateLabel}) como pagado?`);
    if (!isConfirmed) return;

    // Regla de Seguridad 2: Descontar el valor de la cuota
    
    // Regla de Seguridad 1: Prevenir saldo negativo (aunque Math.min lo cubre, validamos por si acaso)
    if (amountToPay > Number(this.currentClient.outstanding)) {
      alert('Error: El pago supera la deuda actual');
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      
      const dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(this.currentClient, payments);
      const tieneAtrasos = dailyStatusList.some(s => s.isOverdue);
      const todayStr = this.getLocalDateString();
      
      if (!tieneAtrasos && payments.some(p => p.date === todayStr)) {
        alert('Precaución: El cliente está al día y ya registró un pago hoy. Por seguridad, solo se permite una transacción diaria para clientes al día.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: status.dayNumber, // Insertar asignado al dia exacto
        amount: amountToPay,
        date: todayStr, // La fecha de pago es hoy
        agentName: currentUser.name,
        status: 'Pagado'
      };

      await window.BulaPayDB.addPayment(newPayment);
      this.captureAndSendLocation();

      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      this.currentClient = updatedClient;
      
      if (Number(updatedClient.outstanding) <= 0) {
        await window.BulaPayDB.liquidateCredit({
          cedula: updatedClient.cedula,
          status: 'Liquidado_Pagado',
          outstanding: 0
        });
        alert('🎉 ¡Felicitaciones! Esta es tu última cuota, el cartón se liquidará automáticamente, te invitamos a adquirir otro crédito');
        await this.renderFinancialDashboard();
        await this.searchClient();
      } else {
        await this.searchClient(); // Refresca y actualiza cartón automáticamente ANTES del alert para evitar falsos positivos visuales
        this.showMandatorySmsPrompt(updatedClient, 'payment');
      }
      
    } catch (e) {
      console.error(e);
      if (e.message && e.message.includes('transacción diaria por cliente')) {
        // En caso de que el sistema antifraude de un solo pago por fecha bloquee
        alert('❌ No se puede registrar: Ya existe un pago registrado para esa fecha específica.');
      } else {
        alert('❌ Error al registrar el pago retroactivo.');
      }
    }
  },

  async renderClientInfo(client) {
    this.currentClient = client;
    this.updateCobroViewState(client);
    
    // Ocultar placeholder y mostrar resultados
    if (this.searchPlaceholder) this.searchPlaceholder.style.display = 'none';
    if (this.searchResults) this.searchResults.style.display = 'block';

    // Rellenar Info
    if (this.detailName) this.detailName.textContent = client.name;
    if (this.detailCedula) this.detailCedula.textContent = client.cedula;
    if (this.detailPhone) this.detailPhone.textContent = client.phone;
    if (this.detailOutstanding) this.detailOutstanding.textContent = `$${Number(client.outstanding).toLocaleString('es-CO')}`;
    if (this.detailInstallment) this.detailInstallment.textContent = `$${Number(client.installmentAmount).toLocaleString('es-CO')}`;
    
    // Preservar riesgo si el cliente está en Lista Negra o tiene cartones morosos/perdidos (risk === 'Rojo')
    let dailyStatusList = [];
    const cedulaDetailStr = String(client.cedula || '').trim();
    let isLossRecordInDetail = false;
    try {
      const supabaseDetail = await window.BulaPayDB.initSupabase();
      const { data: cartonesMorosos } = await supabaseDetail
        .from('cartones')
        .select('*')
        .eq('cliente_id', cedulaDetailStr)
        .eq('estado', 'liquidado_perdida');
      if (cartonesMorosos && cartonesMorosos.length > 0) {
        isLossRecordInDetail = true;
      }
    } catch (e) {}

    const rawStatusDetail = String(client.status || client.estado || '').trim().toUpperCase();
    const isDbBlacklistedDetail = isLossRecordInDetail ||
                                  client.risk === 'Rojo' || 
                                  String(client.risk || '').trim().toLowerCase() === 'rojo' || 
                                  rawStatusDetail.includes('NEGRA') || 
                                  rawStatusDetail.includes('MORA') ||
                                  rawStatusDetail.includes('PERDIDA');

    if (isDbBlacklistedDetail) {
      client.risk = 'Rojo';
    } else {
      try {
        const payments = await window.BulaPayDB.getPaymentsByClient(client.cedula);
        dailyStatusList = window.BulaPayDB.getDailyPaymentStatus(client, payments);
        const overdueCount = dailyStatusList.filter(s => s.isOverdue).length;
        
        if (overdueCount >= 3) {
          client.risk = 'Rojo';
        } else if (overdueCount > 0) {
          client.risk = 'Amarillo';
        } else {
          client.risk = 'Verde';
        }
      } catch (e) {
        console.error("Error al calcular riesgo dinámico en renderClientInfo:", e);
      }
    }

    // Semáforo de Riesgo
    if (this.riskHeader) {
      this.riskHeader.className = 'traffic-light-header'; // Reset
      
      if (client.risk === 'Verde') {
        this.riskHeader.classList.add('verde');
        if (this.riskStatus) this.riskStatus.textContent = '🟢 Cliente Excelente (Al Día)';
      } else if (client.risk === 'Amarillo') {
        this.riskHeader.classList.add('amarillo');
        if (this.riskStatus) this.riskStatus.textContent = '🟡 Pago con Retrasos (Riesgo Medio)';
      } else if (client.risk === 'Rojo') {
        this.riskHeader.classList.add('rojo');
        if (this.riskStatus) this.riskStatus.textContent = '🔴 ROJO (Mal Cliente / Lista Negra)';
      }
    }

    // Estado de Cartera texto explicativo
    let statusText = 'Al Día';
    if (Number(client.outstanding) === 0) statusText = 'Crédito Cancelado';
    else if (client.risk === 'Amarillo') statusText = 'Atrasado';
    else if (client.risk === 'Rojo') statusText = 'Mora Severa';

    if (this.detailStatus) this.detailStatus.textContent = statusText;

    // Rellenar campo de monto de abono por defecto
    if (this.inputCollectAmount) {
      this.inputCollectAmount.value = Math.min(Number(client.installmentAmount), Number(client.outstanding));
    }

    // Renderizar Días de Mora en Detalles del Cliente
    const container = document.getElementById('client-overdue-days-list');
    if (container) {
      window.BulaPayDB.renderOverdueDaysList(container, dailyStatusList);
    }
  },

  isRouteClosed() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) return false;
    
    // El Agente Independiente está libre de restricciones (por rol o por bulaRole en localStorage)
    if (currentUser.role === 'Agente Independiente' || localStorage.getItem('bulaRole') === 'independent') return false;
    
    // Si es Agente de Ruta estándar o rol general de agente
    if (currentUser.role === 'Agente de Ruta' || currentUser.role === 'agent') {
      const now = new Date();
      const day = now.getDay();
      const hours = now.getHours();
      if (day === 0 || hours < 6 || hours >= 18) {
        return true;
      }
    }
    return false;
  },

  async registerPayment() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
    if (!this.currentClient) return;

    const amount = parseFloat(this.inputCollectAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('⚠️ Ingrese un valor válido de recaudo.');
      return;
    }

    if (amount > Number(this.currentClient.outstanding)) {
      alert(`⚠️ El monto ingresado supera el saldo pendiente de $${Number(this.currentClient.outstanding).toLocaleString('es-CO')}`);
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      
      // Validar si ya pagó hoy
      const todayStr = this.getLocalDateString();
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: payments.length + 1,
        amount: amount,
        date: this.getLocalDateString(),
        agentName: currentUser.name,
        status: amount >= Number(this.currentClient.installmentAmount) ? 'Pagado' : 'Abonado'
      };

      // Registrar en base de datos
      const savedPayment = await window.BulaPayDB.addPayment(newPayment);

      // Reportar ubicación
      this.captureAndSendLocation();

      // Desplegar recibo digital premium
      window.showBulaPayReceipt(savedPayment, this.currentClient);

      // Re-buscar el cliente para actualizar pantalla
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      await this.renderClientInfo(updatedClient);

      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('Precaución') || err.message.includes('Acceso Denegado'))) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el pago.');
      }
    }
  },

  async registerNoPayment() {
    if (this.isRouteClosed()) {
      alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
      return;
    }
    if (!this.currentClient) return;

    if (!confirm(`¿Está seguro de que desea registrar un No Pago para el cliente ${this.currentClient.name} el día de hoy?`)) {
      return;
    }

    const currentUser = window.BulaPayDB.getCurrentUser() || { name: 'Juan Pérez' };

    try {
      const payments = await window.BulaPayDB.getPaymentsByClient(this.currentClient.cedula);
      
      // Validar si ya pagó hoy
      const todayStr = this.getLocalDateString();
      if (payments.some(p => p.date === todayStr)) {
        alert('Precaución: Ya se registró un pago hoy para este cliente. Por seguridad, solo se permite una transacción diaria por cliente.');
        return;
      }

      const newPayment = {
        clientCedula: this.currentClient.cedula,
        installmentNumber: payments.length + 1,
        amount: 0,
        date: this.getLocalDateString(),
        agentName: currentUser.name,
        status: 'No Pago'
      };

      // Registrar en base de datos
      const savedPayment = await window.BulaPayDB.addPayment(newPayment);

      // Reportar ubicación
      this.captureAndSendLocation();

      // Desplegar recibo digital premium
      window.showBulaPayReceipt(savedPayment, this.currentClient);

      // Re-buscar el cliente para actualizar pantalla
      const updatedClient = await window.BulaPayDB.getClientByCedula(this.currentClient.cedula);
      await this.renderClientInfo(updatedClient);

      // Actualizar botón de seguimiento
      await this.updateRouteTracking();
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('Precaución') || err.message.includes('Acceso Denegado'))) {
        alert(err.message);
      } else {
        alert('❌ Error al registrar el no pago.');
      }
    }
  },

  async registerNewClient() {
    // Bloqueo estricto de carrera (Race Condition Lock)
    if (this.isRegisteringClient) {
      console.warn('[LOCK] Registro de cliente ya en proceso. Ignorando solicitud duplicada.');
      return;
    }

    const btnGuardar = document.getElementById('btn-registrar-cliente-oficial');
    let payload = null;

    try {
      this.isRegisteringClient = true;
      if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.dataset.originalText = btnGuardar.innerText || 'Guardar Cliente';
        btnGuardar.innerText = 'Guardando cliente...';
      }

      // Limpiar/silenciar cualquier estado o modal de alerta previo
      if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
      }

      console.log('Paso 1: Iniciando registro de cliente...');

      if (this.formRegisterClient && typeof this.formRegisterClient.reportValidity === 'function') {
        if (!this.formRegisterClient.reportValidity()) {
          console.warn('Formulario incompleto: reportValidity() retornó false.');
          return;
        }
      }

      if (this.isRouteClosed()) {
        if (typeof Swal !== 'undefined') {
          Swal.fire('Ruta Cerrada', 'Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.', 'warning');
        } else {
          alert('Operación denegada: La ruta se encuentra cerrada. Horario: Lunes a Sábado, 6 AM - 6 PM.');
        }
        return;
      }

      const nameEl = document.getElementById('new-client-name');
      const cedulaEl = document.getElementById('new-client-cedula');
      const phoneEl = document.getElementById('new-client-phone');
      const deptEl = document.getElementById('new-client-department');
      const cityEl = document.getElementById('new-client-city');
      const zoneEl = document.getElementById('new-client-zone');
      const capitalEl = document.getElementById('new-client-capital');
      const debtEl = document.getElementById('new-client-debt');
      const installmentsEl = document.getElementById('new-client-installments');

      const name = nameEl ? nameEl.value.trim() : '';
      const rawCedula = cedulaEl ? cedulaEl.value : '';
      const cedula = String(rawCedula).replace(/[\s-]/g, '').trim();
      const phone = phoneEl ? phoneEl.value.trim() : '';
      const department = deptEl ? deptEl.value : '';
      const cityVal = cityEl ? cityEl.value : '';
      const city = department ? `${department} - ${cityVal}` : cityVal;
      const zone = zoneEl ? zoneEl.value.trim() : '';

      if (!name || !cedula || !phone) {
        if (typeof Swal !== 'undefined') {
          Swal.fire('Campos requeridos', 'Por favor ingrese Nombre, Cédula y Teléfono del cliente.', 'warning');
        } else {
          alert('Por favor ingrese Nombre, Cédula y Teléfono del cliente.');
        }
        return;
      }
      
      // Obtener agentId de forma segura desde la sesión activa
      const currentUser = window.BulaPayDB.getCurrentUser();
      if (!currentUser) {
        alert('❌ Error de seguridad: No hay sesión activa.');
        return;
      }
      const agentId = currentUser.username;

      const capitalRaw = capitalEl ? capitalEl.value.replace(/\./g, '') : '0';
      const montoPrestamo = Math.round(parseFloat(capitalRaw) || 0);
      const installments = installmentsEl ? (parseInt(installmentsEl.value) || 1) : 1;

      let debt = debtEl ? Math.round(parseFloat(debtEl.value.replace(/\./g, '')) || 0) : 0;
      if (!debt || debt === 0) {
        const interestPercent = parseFloat(document.getElementById('new-client-interest-percent')?.value || '20');
        debt = Math.round(montoPrestamo * (1 + interestPercent / 100));
      }

      console.log('Paso 2: Datos recolectados del DOM:', { name, agentId, cedula, phone, department, cityVal, city, zone, debt, installments });

      // BLOQUEO ASÍNCRONO ESTRICTO: Resolver al 100% el SELECT de validación ANTES de iniciar el INSERT
      const existing = await window.BulaPayDB.getGlobalClientByCedula(cedula);

      // Si el cliente NO existe, silenciar/limpiar cualquier estado de alerta previa de duplicado
      if (!existing) {
        if (typeof Swal !== 'undefined' && Swal.isVisible()) {
          Swal.close();
        }
      } else {
        console.warn('[DEBUG] Cédula ya existente registrada:', existing);
        let proceed = false;
        
        if (this.isRenewalMode) {
          // En modo renovación, omitir confirmación interactiva y proceder directamente
          proceed = true;
        } else {
          const warningMsg = `La Cédula N° ${cedula} ya se encuentra registrada a nombre de ${existing.name || 'un cliente'}.\n\n¿Desea registrarle un nuevo crédito / cartón a este cliente o cancelar y verificar en el historial?`;
          
          if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
              title: 'Cédula Registrada',
              text: warningMsg,
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Continuar con el registro',
              cancelButtonText: 'Ver Historial / Cancelar',
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#d33',
              reverseButtons: true
            });
            proceed = result.isConfirmed;
          } else {
            proceed = confirm(warningMsg);
          }
        }

        if (!proceed) {
          if (this.switchTab) this.switchTab('history');
          if (this.inputHistoryCedula) this.inputHistoryCedula.value = cedula;
          if (typeof this.verificarHistorialCliente === 'function') this.verificarHistorialCliente(cedula);
          return;
        }
      }

      let routeId = currentUser && currentUser.routeId ? currentUser.routeId : null;
      if (!routeId && typeof window.BulaPayDB.getActiveRouteIdForUser === 'function') {
        routeId = await window.BulaPayDB.getActiveRouteIdForUser(currentUser);
      }

      let supervisorId = currentUser && currentUser.supervisor ? currentUser.supervisor : null;
      if (!supervisorId && typeof window.BulaPayDB.getSupervisorIdForUser === 'function') {
        supervisorId = await window.BulaPayDB.getSupervisorIdForUser(currentUser);
      }

      const applyDiscount = document.getElementById('new-client-apply-discount')?.checked;
      let discountAmount = 0;
      let discountReason = null;
      let segVal = 0;
      let papVal = 0;
      let otrVal = 0;

      if (this.isRenewalMode) {
        // v171: En modo renovación, otrVal (saldo_anterior / rollover_amount) se inyecta exclusivamente en la casilla inferior.
        // discountAmount toma el monto del descuento general del campo superior (si existe).
        otrVal = Math.round(Number(this.currentRenewalOutstanding || 0));
        discountAmount = (applyDiscount && discountAmountInput) ? Math.round(parseFloat(discountAmountInput.value.replace(/\./g, '') || '0') || 0) : 0;

        let reasons = ['Saldo Cartón Anterior (Renovación)'];
        if (document.getElementById('new-client-discount-reason-seguro')?.checked) {
          reasons.push('Seguro');
        }
        if (document.getElementById('new-client-discount-reason-papeleria')?.checked) {
          reasons.push('Papelería / Software');
        }
        if (document.getElementById('new-client-discount-reason-otro-concepto')?.checked) {
          const concText = document.getElementById('new-client-discount-reason-otro-concepto-text')?.value.trim() || 'Otro Motivo';
          reasons.push(concText);
        }
        discountReason = reasons.join(', ');
      } else if (applyDiscount) {
        discountAmount = Math.round(parseFloat(document.getElementById('new-client-discount-amount')?.value.replace(/\./g, '') || '0') || 0);

        let reasons = [];
        if (document.getElementById('new-client-discount-reason-seguro')?.checked) {
          reasons.push('Seguro');
        }
        if (document.getElementById('new-client-discount-reason-papeleria')?.checked) {
          reasons.push('Papelería / Software');
        }
        if (document.getElementById('new-client-discount-reason-otro-concepto')?.checked) {
          const concText = document.getElementById('new-client-discount-reason-otro-concepto-text')?.value.trim() || 'Otro Motivo';
          reasons.push(concText);
        }
        if (document.getElementById('new-client-discount-reason-otros')?.checked) {
          const otrosText = document.getElementById('new-client-discount-reason-otros-text')?.value.trim() || 'Saldo Cartón Anterior';
          reasons.push(otrosText);
          otrVal = discountAmount || 0;
        }
        discountReason = reasons.length > 0 ? reasons.join(', ') : null;
      }

      const emailEl = document.getElementById('new-client-email');
      const emailVal = emailEl ? emailEl.value.trim() : '';

      payload = {
        cedula,
        name,
        phone,
        email: emailVal || null,
        city,
        zone,
        risk: 'Verde', // Inicia excelente
        amount: montoPrestamo, // Guardamos el capital prestado para la caja diaria
        discount_amount: discountAmount, // Guardamos el descuento inicial total
        retained_amount: Math.round(segVal + papVal), // Campo legado
        retained_fees: Math.round(segVal + papVal), // AISLADO: Únicamente cobros por Seguro y Papelería
        rollover_amount: Math.round(otrVal), // AISLADO: Saldo refinanciado / cartón anterior
        saldo_anterior: Math.round(otrVal),
        segVal: Math.round(segVal),
        papVal: Math.round(papVal),
        discount_reason: discountReason, // Motivo del descuento
        totalDebt: debt,
        outstanding: debt,
        installmentsCount: installments,
        installmentAmount: Math.round(debt / installments),
        routeId,
        agent_id: currentUser.id || currentUser.username,
        supervisor_id: supervisorId,
        isRenewal: !!this.isRenewalMode,
        is_renewal: !!this.isRenewalMode,
        estado: this.isRenewalMode ? 'activo_por_renovacion' : 'activo'
      };

      console.log('Intentando enviar a Supabase la tabla clients...', payload);

      const isRenov = !!this.isRenewalMode;
      let savedResult;
      if (existing || this.isRenewalMode) {
        savedResult = await window.BulaPayDB.registerCreditToExistingClient(payload);
      } else {
        savedResult = await window.BulaPayDB.saveClient(payload);
      }
      console.log('Guardado exitoso:', savedResult);
      this.currentClient = payload;

      // v160: Sin alteraciones automáticas en caja_movimientos durante renovación

      // Garantizar que no quede ninguna alerta de duplicado previa visible en el DOM tras la inserción exitosa
      if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
      }

      // Resetear estado de renovación tras guardado exitoso
      this.setRenewalMode(false);
      this.currentRenewalOutstanding = 0;

      // Actualización de la Interfaz (Refetch) para el contador y métricas financieras
      if (typeof this.updateRouteTracking === 'function') {
        this.updateRouteTracking();
      }
      await this.updateCashViews();
      await this.renderFinancialDashboard();

      // Envío de email de bienvenida (Resend placeholder)
      this.sendWelcomeEmail(payload);

      // Resetear formulario
      if (this.formRegisterClient) this.formRegisterClient.reset();

      // Mostrar modal obligatorio SMS
      this.showMandatorySmsPrompt(payload, 'register');
    } catch (err) {
      console.error('Error durante la inserción del cliente:', err);
      const dupMsg = window.BulaPayDB.getClientDuplicationMessage(err);
      if (dupMsg === 'DUPLICATE_CEDULA' || dupMsg === 'DUPLICATE_DATA') {
        if (this.isRenewalMode) {
          try {
            const updatedPayload = await window.BulaPayDB.registerCreditToExistingClient(payload);
            this.currentClient = updatedPayload;
            if (typeof this.updateRouteTracking === 'function') {
              this.updateRouteTracking();
            }
            await this.renderFinancialDashboard();
            this.sendWelcomeEmail(updatedPayload);
            if (this.formRegisterClient) this.formRegisterClient.reset();
            this.setRenewalMode(false);
            this.currentRenewalOutstanding = 0;
            this.showMandatorySmsPrompt(updatedPayload, 'register');
            return;
          } catch (renewErr) {
            console.error('Error en renovación fallback:', renewErr);
          }
        }
        const warningMsg = `La Cédula N° ${payload?.cedula || ''} ya se encuentra registrada en el sistema.\n\n¿Desea continuar con el registro del nuevo crédito o cancelar y verificar en el historial?`;
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'Cédula Registrada',
            text: warningMsg,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Continuar con el registro',
            cancelButtonText: 'Cancelar y ver historial',
            reverseButtons: true,
            confirmButtonColor: '#10b981'
          }).then(async (result) => {
            if (result.isConfirmed) {
              try {
                // Paso 1 y 2: Registrar Crédito y Actualizar Cliente
                const updatedPayload = await window.BulaPayDB.registerCreditToExistingClient(payload);
                this.currentClient = updatedPayload;
                
                if (typeof this.updateRouteTracking === 'function') {
                  this.updateRouteTracking();
                }
                this.sendWelcomeEmail(updatedPayload);
                if (this.formRegisterClient) this.formRegisterClient.reset();
                
                // Paso 3: Disparar SMS obligatorio
                this.showMandatorySmsPrompt(updatedPayload, 'register');
              } catch (error) {
                // Paso 4: Manejo de Errores Transparente
                const errorMsg = error.message || 'Error desconocido';
                const errorDetails = error.details || '';
                if (typeof Swal !== 'undefined') {
                  Swal.fire({
                    title: 'ERROR CRÍTICO AL GUARDAR',
                    text: `Mensaje: ${errorMsg}\nDetalles: ${errorDetails}`,
                    icon: 'error',
                    confirmButtonColor: '#d33'
                  });
                } else {
                  alert(`ERROR CRÍTICO AL GUARDAR: ${errorMsg}\nDetalles: ${errorDetails}`);
                }
              }
            } else {
              const navClients = document.getElementById('nav-clients');
              if (navClients) navClients.click();
            }
          });
        } else {
          if (confirm(warningMsg)) {
            window.BulaPayDB.registerCreditToExistingClient(payload).then((updatedPayload) => {
              this.currentClient = updatedPayload;
              if (typeof this.updateRouteTracking === 'function') {
                this.updateRouteTracking();
              }
              this.sendWelcomeEmail(updatedPayload);
              if (this.formRegisterClient) this.formRegisterClient.reset();
              this.showMandatorySmsPrompt(updatedPayload, 'register');
            }).catch(error => {
              const errorMsg = error.message || 'Error desconocido';
              const errorDetails = error.details || '';
              alert(`ERROR CRÍTICO AL GUARDAR: ${errorMsg}\nDetalles: ${errorDetails}`);
            });
          } else {
            const navClients = document.getElementById('nav-clients');
            if (navClients) navClients.click();
          }
        }
      } else if (err.message === 'ACCESO_DENEGADO_OTRO_AGENTE') {
        if (typeof Swal !== 'undefined') {
          Swal.fire('Error', 'Ya existe un cliente registrado con esta Cédula (cartera de otro cobrador).', 'error');
        } else {
          alert('❌ Error: Ya existe un cliente registrado con esta Cédula (cartera de otro cobrador).');
        }
      } else {
        console.error('Error de ejecución:', err);
        const errorMsg = err.message || 'Error desconocido';
        const errorDetails = err.details || '';
        if (typeof Swal !== 'undefined') {
          Swal.fire('Error de Código', errorMsg + (errorDetails ? ` | Detalles: ${errorDetails}` : ''), 'error');
        } else {
          alert(`Error de Código: ${errorMsg}\nDetalles: ${errorDetails}`);
        }
      }
    } finally {
      this.isRegisteringClient = false;
      if (btnGuardar) {
        btnGuardar.disabled = false;
        if (btnGuardar.dataset.originalText) {
          btnGuardar.innerText = btnGuardar.dataset.originalText;
        } else {
          btnGuardar.innerText = 'Guardar Cliente';
        }
      }
    }
  },

  showMandatorySmsPrompt(client, type) {
    const currentUser = window.BulaPayDB.getCurrentUser() || {};
    const agentName = currentUser.name || currentUser.username || 'nuestro Agente';
    const cleanCedula = String(client.cedula).replace(/[\s-]/g, '');
    const appUrl = `https://bulapay.online/?view=customer&id=${cleanCedula}`;
    
    let mensaje = '';
    if (type === 'register') {
      mensaje = `BulaPay: Crédito APROBADO. Agente: ${agentName}. Consulte su saldo y cartón digital en: ${appUrl}`;
    } else if (type === 'payment') {
      mensaje = `BulaPay: Pago EXITOSO. Verifique su saldo actualizado en: ${appUrl}`;
    }

    const telefonoCliente = String(client.phone || '').trim();
    const numeroLimpio = telefonoCliente.replace(/\D/g, '');
    const urlWa = 'https://wa.me/57' + numeroLimpio + '?text=' + encodeURIComponent(mensaje);

    const title = type === 'register' ? 'Registro Exitoso' : 'Pago Exitoso';

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: title,
        text: 'El registro se ha guardado exitosamente en el sistema. ¿Desea enviar el comprobante digital al cliente?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Notificar al Cliente',
        cancelButtonText: 'Omitir',
        confirmButtonColor: '#25D366',
        cancelButtonColor: '#6c757d',
        allowOutsideClick: false
      }).then((result) => {
        if (result.isConfirmed) {
          window.open(urlWa, '_blank');
          if (this.formRegisterClient) {
            this.formRegisterClient.reset();
          }
        } else if (result.isDismissed) {
          if (this.formRegisterClient) {
            this.formRegisterClient.reset();
          }
        }
      });
    } else {
      if (confirm(`El registro se ha guardado exitosamente en el sistema. ¿Desea enviar el comprobante digital al cliente?`)) {
        window.open(urlWa, '_blank');
      }
      if (this.formRegisterClient) {
        this.formRegisterClient.reset();
      }
    }
  },

  async captureAndSendLocation() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await window.BulaPayDB.updateUserLocation(currentUser.username, latitude, longitude);
          console.log(`[GPS] Ubicación crítica reportada: ${latitude}, ${longitude}`);
        } catch (e) {
          console.warn("Fallo al actualizar geolocalización crítica en Supabase:", e);
        }
      },
      (error) => {
        console.warn("Error al capturar ubicación crítica:", error);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  },

  startLocationMonitoring() {
    if (!navigator.geolocation) return;

    // Detener cualquier monitoreo anterior
    this.stopLocationMonitoring();

    let lastPosition = null;

    // Iniciar watchPosition con alta precisión y sin caché
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        lastPosition = position;
        // Al recibir la primera posición, la enviamos de inmediato
        if (!this.hasSentInitialLocation) {
          this.hasSentInitialLocation = true;
          this.sendWatchPosition(position);
        }
      },
      (error) => {
        console.warn("[GPS Watch] Error al rastrear ubicación:", error);
        if (error.code === error.PERMISSION_DENIED) {
          window.gpsBlocked = true;
          if (window.app && typeof window.app.handleGPSPermissionStatus === 'function') {
            window.app.handleGPSPermissionStatus('denied');
          }
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    // Enviar a Supabase cada 30 segundos
    this.locationInterval = setInterval(() => {
      if (lastPosition) {
        this.sendWatchPosition(lastPosition);
      }
    }, 30000);
  },

  async sendWatchPosition(position) {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser) return;

    const { latitude, longitude } = position.coords;
    try {
      await window.BulaPayDB.updateUserLocation(currentUser.username, latitude, longitude);
      console.log(`[GPS Watch] Ubicación reportada a Supabase cada 30s: ${latitude}, ${longitude}`);
    } catch (e) {
      console.warn("[GPS Watch] Fallo al actualizar geolocalización en Supabase:", e);
    }
  },

  stopLocationMonitoring() {
    if (this.locationWatchId !== undefined && this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
    this.hasSentInitialLocation = false;
  },

  async initGeography() {
    const deptSelect = document.getElementById('new-client-department');
    const citySelect = document.getElementById('new-client-city');
    if (!deptSelect || !citySelect) return;

    // Poblar departamentos inicialmente con el fallback estático local
    const populateDepts = (geography) => {
      const currentSelected = deptSelect.value;
      deptSelect.innerHTML = '<option value="" disabled selected>Seleccione Departamento...</option>';
      Object.keys(geography).sort().forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        if (dept === currentSelected) {
          opt.selected = true;
        }
        deptSelect.appendChild(opt);
      });
    };

    populateDepts(COLOMBIA_GEOGRAPHY);

    // Poblar municipios dependientes
    const updateCities = (geography) => {
      const selectedDept = deptSelect.value;
      citySelect.innerHTML = '<option value="" disabled selected>Seleccione Municipio / Ciudad...</option>';
      const cities = geography[selectedDept] || [];
      cities.sort().forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    };

    deptSelect.addEventListener('change', () => {
      const currentGeo = activeGeography || COLOMBIA_GEOGRAPHY;
      updateCities(currentGeo);
    });

    // Cargar la base de datos completa de geografía desde la API
    try {
      const fullGeography = await fetchColombiaGeography();
      if (fullGeography) {
        populateDepts(fullGeography);
        if (deptSelect.value) {
          updateCities(fullGeography);
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar la geografía remota. Se usará el listado estático local.", err);
    }
  },

  setRenewalMode(isRenewal, oldOutstanding = 0) {
    this.isRenewalMode = !!isRenewal;
    if (oldOutstanding > 0) {
      this.currentRenewalOutstanding = Math.round(Number(oldOutstanding));
    }
    const effectiveOutstanding = Math.round(Number(oldOutstanding || this.currentRenewalOutstanding || 0));

    const rolloverContainer = document.getElementById('new-client-discount-rollover-container');
    const discountCheckbox = document.getElementById('new-client-apply-discount');
    const discountPanel = document.getElementById('new-client-discount-panel');
    const discountAmountInput = document.getElementById('new-client-discount-amount');
    const cbOtros = document.getElementById('new-client-discount-reason-otros');
    const inputOtrosText = document.getElementById('new-client-discount-reason-otros-text');

    const formatNum = (num) => num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";

    if (rolloverContainer) {
      rolloverContainer.style.display = this.isRenewalMode ? 'flex' : 'none';
    }

    if (this.isRenewalMode) {
      this.currentRenewalOutstanding = effectiveOutstanding;

      if (discountCheckbox) {
        discountCheckbox.checked = true;
        discountCheckbox.disabled = true; // Bloqueado rígidamente en renovación (v158)
        if (discountPanel) discountPanel.style.display = 'flex';
      }
      if (cbOtros) {
        cbOtros.checked = true;
        cbOtros.disabled = true; // Bloqueado rígidamente (v158)
        if (inputOtrosText) {
          inputOtrosText.style.display = 'block';
          inputOtrosText.readOnly = true; // Solo lectura rígidamente (v158)
          inputOtrosText.value = `Saldo Cartón Anterior: $${formatNum(effectiveOutstanding)}`;
          inputOtrosText.style.fontWeight = 'bold';
          inputOtrosText.style.color = '#3b82f6';
        }
      }
      if (discountAmountInput) {
        discountAmountInput.readOnly = false;
        discountAmountInput.style.backgroundColor = 'var(--bg-primary)';
        discountAmountInput.style.color = 'var(--color-verde)';
        discountAmountInput.style.fontWeight = 'bold';
        discountAmountInput.style.cursor = 'text';
        discountAmountInput.removeAttribute('title');
        // REGLA DE UBICACIÓN (v171): El campo superior de descuentos generales no debe rellenarse automáticamente con el saldo anterior.
        if (discountAmountInput.value === formatNum(effectiveOutstanding)) {
          discountAmountInput.value = '';
        }
      }
      const capitalInput = document.getElementById('new-client-capital');
      if (capitalInput) {
        capitalInput.dispatchEvent(new Event('input'));
      }
    } else {
      this.currentRenewalOutstanding = 0;
      if (discountCheckbox) {
        discountCheckbox.disabled = false;
      }
      if (cbOtros) {
        cbOtros.checked = false;
        cbOtros.disabled = false;
      }
      if (inputOtrosText) {
        inputOtrosText.value = '';
        inputOtrosText.style.display = 'none';
        inputOtrosText.readOnly = false;
      }
      if (discountAmountInput) {
        discountAmountInput.readOnly = false;
        discountAmountInput.style.backgroundColor = 'var(--bg-primary)';
        discountAmountInput.style.cursor = 'text';
        discountAmountInput.removeAttribute('title');
      }
    }
  },

  initCalculator() {
    const capitalInput = document.getElementById('new-client-capital');
    const interestInput = document.getElementById('new-client-interest-percent');
    const debtInput = document.getElementById('new-client-debt');
    const installmentsInput = document.getElementById('new-client-installments');
    const installmentValInput = document.getElementById('new-client-installment-val');
    const netCashInput = document.getElementById('new-client-net-cash');

    if (!capitalInput || !interestInput || !debtInput || !installmentsInput || !installmentValInput) return;

    const discountCheckbox = document.getElementById('new-client-apply-discount');
    const discountPanel = document.getElementById('new-client-discount-panel');
    const discountAmountInput = document.getElementById('new-client-discount-amount');
    const cbSeguro = document.getElementById('new-client-discount-reason-seguro');
    const cbPapeleria = document.getElementById('new-client-discount-reason-papeleria');
    const cbOtroConcepto = document.getElementById('new-client-discount-reason-otro-concepto');
    const inputOtroConceptoText = document.getElementById('new-client-discount-reason-otro-concepto-text');

    const cbOtros = document.getElementById('new-client-discount-reason-otros');
    const inputOtrosText = document.getElementById('new-client-discount-reason-otros-text');

    const formatNumber = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const calculate = () => {
      const capitalRaw = capitalInput.value.replace(/\./g, '');
      const capital = parseFloat(capitalRaw) || 0;
      const interest = parseFloat(interestInput.value) || 0;
      const installments = parseInt(installmentsInput.value) || 1;

      const totalDebt = Math.round(capital + (capital * (interest / 100)));
      const installmentVal = Math.round(totalDebt / installments);

      debtInput.value = totalDebt ? formatNumber(totalDebt) : "";
      installmentValInput.value = installmentVal ? formatNumber(installmentVal) : "";

      // v171: Descuento general del campo superior (Seguro, Papelería, etc.)
      let generalDiscount = 0;
      if (discountCheckbox && discountCheckbox.checked && discountAmountInput) {
        generalDiscount = parseFloat(discountAmountInput.value.replace(/\./g, '')) || 0;
      }

      // v171: Saldo del cartón anterior (Renovación) inyectado de forma estricta y exclusiva desde el rollover
      let rolloverDiscount = 0;
      if (this.isRenewalMode) {
        rolloverDiscount = Math.round(Number(this.currentRenewalOutstanding || 0));
      }

      const totalDeductions = generalDiscount + rolloverDiscount;
      const netCash = Math.max(0, capital - totalDeductions);

      if (netCashInput) {
        netCashInput.value = (capital > 0 || totalDeductions > 0) ? `$${formatNumber(netCash)}` : "";
      }
    };

    if (discountCheckbox && discountPanel) {
      discountCheckbox.addEventListener('change', (e) => {
        if (this.isRenewalMode) {
          discountCheckbox.checked = true;
          discountPanel.style.display = 'flex';
          this.setRenewalMode(true, this.currentRenewalOutstanding);
          return;
        }
        if (e.target.checked) {
          discountPanel.style.display = 'flex';
        } else {
          discountPanel.style.display = 'none';
          if (discountAmountInput) discountAmountInput.value = '';
          if (cbSeguro) cbSeguro.checked = false;
          if (cbPapeleria) cbPapeleria.checked = false;
          if (cbOtroConcepto) cbOtroConcepto.checked = false;
          if (inputOtroConceptoText) { inputOtroConceptoText.style.display = 'none'; inputOtroConceptoText.value = ''; }
          if (cbOtros) cbOtros.checked = false;
          if (inputOtrosText) { inputOtrosText.style.display = 'none'; inputOtrosText.value = ''; }
        }
        calculate();
      });
    }

    if (discountAmountInput) {
      discountAmountInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? formatNumber(val) : '';
        calculate();
      });
    }

    if (cbOtroConcepto) {
      cbOtroConcepto.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (inputOtroConceptoText) inputOtroConceptoText.style.display = isChecked ? 'block' : 'none';
        if (!isChecked && inputOtroConceptoText) inputOtroConceptoText.value = '';
      });
    }

    if (cbOtros) {
      cbOtros.addEventListener('change', (e) => {
        if (this.isRenewalMode) {
          cbOtros.checked = true;
          if (inputOtrosText) {
            inputOtrosText.style.display = 'block';
            inputOtrosText.readOnly = true;
            inputOtrosText.value = `Saldo Cartón Anterior: $${formatNumber(Math.round(Number(this.currentRenewalOutstanding || 0)))}`;
          }
          return;
        }
        const isChecked = e.target.checked;
        if (inputOtrosText) inputOtrosText.style.display = isChecked ? 'block' : 'none';
        if (!isChecked && inputOtrosText) inputOtrosText.value = '';
      });
    }

    capitalInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      e.target.value = val ? formatNumber(val) : '';
      calculate();
    });

    interestInput.addEventListener('input', calculate);
    installmentsInput.addEventListener('input', calculate);
  },

  async sendWelcomeEmail(clientData) {
    // API de correos desactivada de forma silenciosa para prevenir errores HTTP 400 (v131)
    try {
      return true;
    } catch (err) {
      return false;
    }
  },

  async populateAgentSelector() {
    const selector = document.getElementById('agent-selector');
    if (!selector) return;

    const currentUser = window.BulaPayDB.getCurrentUser();
    if (currentUser) {
      selector.innerHTML = `<option value="${currentUser.username}" selected>${currentUser.name}</option>`;
    } else {
      selector.innerHTML = '<option value="" disabled selected>No hay sesión activa</option>';
    }
  },

  getLocalDateString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // FÓRMULA MATEMÁTICA OBLIGATORIA v101:
  // Capital en Caja = [Inyecciones] - [Préstamos ACTIVOS] + [Abonos Reales] - [Capitales Dados de Baja en Lista Negra]
  async calculateCapitalEnCaja(routeId) {
    return await window.BulaPayDB.getLiquidCash(routeId);
  },

  async renderFinancialDashboard() {
    const capitalEl = document.getElementById('private-panel-capital');
    const carteraEl = document.getElementById('private-panel-cartera');
    const gananciaEl = document.getElementById('private-panel-ganancia');
    if (!capitalEl) return;

    capitalEl.textContent = 'Calculando...';
    if (carteraEl) carteraEl.textContent = '...';
    if (gananciaEl) gananciaEl.textContent = '...';

    try {
      const currentUser = window.BulaPayDB.getCurrentUser();
      if (!currentUser) return;

      const liquidCash = await this.calculateCapitalEnCaja(currentUser.routeId);
      capitalEl.textContent = `$${Number(liquidCash).toLocaleString('es-CO')}`;
      
      const metrics = await window.BulaPayDB.getDashboardFinancialMetrics(currentUser.routeId);
      if (carteraEl) carteraEl.textContent = `$${Number(metrics.carteraEnCalle).toLocaleString('es-CO')}`;
      const intereses = Number(metrics.interesesActivos !== undefined ? metrics.interesesActivos : metrics.posibleGanancia);
      if (gananciaEl) gananciaEl.textContent = `$${intereses.toLocaleString('es-CO')}`;

      // Sincronizar siempre las vistas del modal de Patrimonio y Caja
      await this.updateCashViews();
    } catch (err) {
      console.error("Error al renderizar Dashboard financiero:", err);
      if (capitalEl) capitalEl.textContent = 'Error';
      if (carteraEl) carteraEl.textContent = 'Error';
      if (gananciaEl) gananciaEl.textContent = 'Error';
    }
  },

  async updateCashViews() {
    try {
      const currentUser = window.BulaPayDB.getCurrentUser();
      const routeId = currentUser ? currentUser.routeId : null;

      const { totalCollected, onHand } = await window.BulaPayDB.getEfectivoEnCajaDia();
      const liquidCash = await window.BulaPayDB.getLiquidCash(routeId);
      const metrics = await window.BulaPayDB.getDashboardFinancialMetrics(routeId);

      const cartera = Math.round(Number(metrics.carteraEnCalle || 0));
      const intereses = Math.round(Number(metrics.interesesActivos !== undefined ? metrics.interesesActivos : metrics.posibleGanancia || 0));
      const patrimonioTotal = Math.round(liquidCash + cartera + intereses);

      // Modal de Patrimonio - Desglose Matemático
      const elModalCaja = document.getElementById('patrimonio-modal-caja');
      if (elModalCaja) {
        elModalCaja.textContent = `$${liquidCash.toLocaleString('es-CO')}`;
        elModalCaja.style.color = liquidCash < 0 ? 'var(--color-rojo)' : 'var(--color-verde)';
      }
      const elModalCartera = document.getElementById('patrimonio-modal-cartera');
      if (elModalCartera) {
        elModalCartera.textContent = `$${cartera.toLocaleString('es-CO')}`;
      }
      const elModalIntereses = document.getElementById('patrimonio-modal-intereses');
      if (elModalIntereses) {
        elModalIntereses.textContent = `$${intereses.toLocaleString('es-CO')}`;
      }
      const elModalTotal = document.getElementById('patrimonio-modal-total');
      if (elModalTotal) {
        elModalTotal.textContent = `$${patrimonioTotal.toLocaleString('es-CO')}`;
      }

      // Vistas adicionales de caja diario
      const elAvailable = document.getElementById('cash-management-available');
      if (elAvailable) {
        elAvailable.textContent = `$${Math.abs(onHand).toLocaleString('es-CO')}`;
        elAvailable.style.color = onHand < 0 ? 'var(--color-rojo)' : 'var(--color-verde)';
      }
      const elOnHand = document.getElementById('private-cash-on-hand');
      if (elOnHand) {
        if (onHand < 0) {
          elOnHand.textContent = `-$${Math.abs(onHand).toLocaleString('es-CO')}`;
          elOnHand.style.color = 'var(--color-rojo)';
        } else {
          elOnHand.textContent = `$${onHand.toLocaleString('es-CO')}`;
          elOnHand.style.color = 'var(--text-primary)';
        }
      }
      const elCollected = document.getElementById('private-cash-collected');
      if (elCollected) {
        elCollected.textContent = `$${Math.abs(totalCollected).toLocaleString('es-CO')}`;
      }
    } catch (e) {
      console.error("Error al actualizar vistas de caja:", e);
    }
  },

  // FILTRO CONTABLE UNIFICADO v111:
  // Valida que un cliente / cartón esté activo y no liquidado o en mora.
  // Si su estado es 'activo' o status es 'ACTIVO', se considera cliente activo.
  isClientActiveAndValid(c) {
    if (!c) return false;
    const rawStatus = String(c.status || c.estado || '').trim().toUpperCase();
    const rawEstado = String(c.estado || '').trim().toLowerCase();

    // Exclusión categórica: cualquier estado de liquidación por mora o pérdida
    const isExcluded = rawStatus.includes('LIQUIDADO') || 
                       rawStatus.includes('CANCELAD') || 
                       rawStatus.includes('PERDIDA') || 
                       rawStatus.includes('MORA') || 
                       rawStatus.includes('NEGRA') || 
                       rawStatus.includes('CASTIGADO') ||
                       rawStatus === 'SIN DEUDA ACTIVA' ||
                       rawEstado === 'liquidado_perdida' ||
                       rawEstado === 'liquidado_mora';

    if (isExcluded) return false;

    // Si el registro tiene estado 'activo' o 'activo_por_renovacion', es un cartón activo
    if (rawEstado === 'activo' || rawEstado === 'activo_por_renovacion' || rawStatus === 'ACTIVO' || rawStatus === 'ACTIVO_POR_RENOVACION') {
      return true;
    }

    const outstanding = Number(c.outstanding || c.saldo_restante || 0);
    const amount = Number(c.amount || c.capital_prestado || c.monto_prestado || 0);
    const totalDebt = Number(c.totalDebt || c.total_debt || c.monto_total || 0);

    return (outstanding > 0 || amount > 0 || totalDebt > 0);
  },

  async updateRouteTracking() {
    const currentUser = window.BulaPayDB.getCurrentUser();
    if (!currentUser || (currentUser.role !== 'Agente de Ruta' && currentUser.role !== 'agent' && currentUser.role !== 'Agente Independiente')) {
      const btn = document.getElementById('btn-agent-route-tracking');
      if (btn) btn.style.display = 'none';
      return;
    }

    const btn = document.getElementById('btn-agent-route-tracking');
    if (!btn) return;
    
    btn.style.display = 'inline-flex';

    try {
      const allClients = await window.BulaPayDB.getClients();
      const todayStr = this.getLocalDateString();
      const allPayments = await window.BulaPayDB.getPayments();
      
      const clientMap = new Map(allClients.map(c => [String(c.cedula), c]));
      const todayPaymentsMap = new Set();
      allPayments.forEach(p => {
        const clientCedula = String(p.clientCedula || p.client_cedula || '');
        const client = clientMap.get(clientCedula);
        
        const isLiquidation = (p.id && String(p.id).startsWith('pay_liq_')) || 
                              p.status === 'Liquidado_Pagado' || 
                              p.status === 'Liquidado_Mora' || 
                              String(p.status || '').includes('Liquidado');
                              
        if (p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago' && p.status !== 'Pendiente' && !isLiquidation) {
          if (client) {
            const cartonDateStr = client.fecha_apertura || client.fecha_inicio || client.created_at;
            const clientTime = cartonDateStr ? new Date(cartonDateStr).getTime() : 0;
            let pTime = 0;
            if (p.created_at) {
              pTime = new Date(p.created_at).getTime();
            } else if (p.date) {
              const dStr = String(p.date).trim();
              pTime = new Date(dStr.includes('T') ? dStr : dStr + 'T00:00:00').getTime();
            }
            if (!clientTime || !pTime || (pTime >= clientTime - 2000)) {
              todayPaymentsMap.add(clientCedula);
            }
          } else {
            todayPaymentsMap.add(clientCedula);
          }
        }
      });

      const activeClients = allClients.filter(c => this.isClientActiveAndValid(c));

      const totalClientsCount = activeClients.length;
      let paidClientsCount = 0;

      activeClients.forEach(c => {
        const ced = String(c.cedula || c.cliente_id || c.client_id || '').trim();
        if (todayPaymentsMap.has(ced)) {
          paidClientsCount++;
        }
      });

      const progressEl = document.getElementById('agent-tracking-progress');
      if (progressEl) progressEl.textContent = `${paidClientsCount}/${totalClientsCount}`;

      const dotEl = document.getElementById('agent-tracking-dot');
      
      btn.style.transition = 'var(--transition-smooth)';
      
      if (totalClientsCount === 0) {
        btn.style.backgroundColor = 'var(--bg-secondary)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border-color)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--text-muted)';
      } else if (paidClientsCount === totalClientsCount) {
        btn.style.backgroundColor = 'var(--color-verde-bg)';
        btn.style.color = 'var(--color-verde)';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--color-verde)';
      } else if (paidClientsCount > 0) {
        btn.style.backgroundColor = 'var(--color-amarillo-bg)';
        btn.style.color = 'var(--color-amarillo)';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--color-amarillo)';
      } else {
        btn.style.backgroundColor = 'var(--color-rojo-bg)';
        btn.style.color = 'var(--color-rojo)';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        if (dotEl) dotEl.style.backgroundColor = 'var(--color-rojo)';
      }
    } catch (e) {
      console.error("Error al actualizar seguimiento de ruta:", e);
    }
  },

  showSuccessLiquidationModal(client) {
    const modal = document.getElementById('cobro-success-liquidation-modal');
    if (!modal) return;

    const btnConfirm = document.getElementById('btn-success-liquidate-confirm');
    const btnClose = document.getElementById('btn-success-liquidate-close');

    if (btnConfirm) {
      btnConfirm.onclick = async () => {
        modal.style.display = 'none';
        try {
          await window.BulaPayDB.liquidateCredit({
            cedula: client.cedula,
            status: 'Liquidado_Pagado',
            outstanding: 0
          });
          alert('🎉 ¡Cartón Liquidado Exitosamente!');
          await this.renderFinancialDashboard();
          await this.searchClient();
        } catch (e) {
          console.error("Error al liquidar cartón desde modal de éxito:", e);
          alert('Error al liquidar cartón: ' + (e.message || e));
        }
      };
    }

    if (btnClose) {
      btnClose.onclick = () => {
        modal.style.display = 'none';
      };
    }

    modal.style.display = 'flex';
  },

  // Modal de cartón vencido deshabilitado y reemplazado por letrero integrado nativo (v87)

  async openRouteTrackingModal() {
    const modal = document.getElementById('agent-route-tracking-modal');
    if (!modal) return;
    
    const content = document.getElementById('route-tracking-modal-content');
    if (!content) return;

    content.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">Cargando clientes...</p>';
    modal.style.display = 'flex';

    try {
      const allClients = await window.BulaPayDB.getClients();
      const todayStr = this.getLocalDateString();
      const allPayments = await window.BulaPayDB.getPayments();
      
      const clientMap = new Map(allClients.map(c => [String(c.cedula), c]));
      const todayPaymentsMap = new Set();
      allPayments.forEach(p => {
        const clientCedula = String(p.clientCedula || p.client_cedula || '');
        const client = clientMap.get(clientCedula);
        
        const isLiquidation = (p.id && String(p.id).startsWith('pay_liq_')) || 
                              p.status === 'Liquidado_Pagado' || 
                              p.status === 'Liquidado_Mora' || 
                              String(p.status || '').includes('Liquidado');
                              
        if (p.date === todayStr && Number(p.amount) > 0 && p.status !== 'No Pago' && p.status !== 'Pendiente' && !isLiquidation) {
          if (client) {
            const cartonDateStr = client.fecha_apertura || client.fecha_inicio || client.created_at;
            const clientTime = cartonDateStr ? new Date(cartonDateStr).getTime() : 0;
            let pTime = 0;
            if (p.created_at) {
              pTime = new Date(p.created_at).getTime();
            } else if (p.date) {
              const dStr = String(p.date).trim();
              pTime = new Date(dStr.includes('T') ? dStr : dStr + 'T00:00:00').getTime();
            }
            if (!clientTime || !pTime || (pTime >= clientTime - 2000)) {
              todayPaymentsMap.add(clientCedula);
            }
          } else {
            todayPaymentsMap.add(clientCedula);
          }
        }
      });

      // Excluir estrictamente clientes con cartón liquidado, cancelado o en Lista Negra / Mora (v106)
      const clients = allClients.filter(c => this.isClientActiveAndValid(c));

      if (clients.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">No tiene clientes activos pendientes de cobro.</p>';
        return;
      }

      // 3. Renderizado Condicional del Contenido (Los Datos)
      const renderClients = () => {
        let htmlContent = '';
        clients.forEach(c => {
          const hasPaidRecordToday = todayPaymentsMap.has(c.cedula);
          const isCancelled = Number(c.outstanding) <= 0;
          
          // Estado real de cobro: Solo es 'Pagó' si existe recibo registrado hoy o si el préstamo está cancelado
          const hasPaid = isCancelled || hasPaidRecordToday;

          const clientCreatedAt = c.created_at ? new Date(c.created_at) : new Date(0);
          const msIn24Hours = 24 * 60 * 60 * 1000;
          const isNewClient = (Date.now() - clientCreatedAt.getTime()) < msIn24Hours;
          const isNewUnpaid = !hasPaid && isNewClient;

          let borderStyle, bgStyle, textColor, badgeBg, dashedBorder;

          if (hasPaid) {
            borderStyle = 'rgba(16, 185, 129, 0.4)';
            bgStyle = 'var(--color-verde-bg)';
            textColor = 'var(--color-verde)';
            badgeBg = 'rgba(16, 185, 129, 0.2)';
            dashedBorder = 'rgba(16, 185, 129, 0.2)';
          } else if (isNewUnpaid) {
            borderStyle = 'var(--border-color, rgba(156, 163, 175, 0.4))';
            bgStyle = 'var(--bg-primary, #ffffff)';
            textColor = 'var(--text-primary, #333333)';
            badgeBg = 'var(--bg-secondary, rgba(156, 163, 175, 0.15))';
            dashedBorder = 'var(--border-color, rgba(156, 163, 175, 0.2))';
          } else {
            borderStyle = 'rgba(239, 68, 68, 0.4)';
            bgStyle = 'var(--color-rojo-bg)';
            textColor = 'var(--color-rojo)';
            badgeBg = 'rgba(239, 68, 68, 0.2)';
            dashedBorder = 'rgba(239, 68, 68, 0.2)';
          }

          const clientCedula = String(c.cedula || 'No registrada');
          
          let badgeText = clientCedula;
          if (isCancelled) badgeText = 'Cancelado';
          else if (hasPaid) badgeText = 'Pagó';
          
          const clientName = c.name || 'Desconocido';
          const clientPhone = c.phone || 'Sin teléfono';
          const clientAddress = (c.zone || c.city) ? `${c.zone || 'N/A'}, ${c.city || 'N/A'}` : 'Sin dirección';
          const clientInstallment = c.installmentAmount ? `$${Number(c.installmentAmount).toLocaleString('es-CO')}` : '0';
          
          htmlContent += `
            <div class="tracking-client-item" style="border: 1px solid ${borderStyle}; border-radius: 10px; background-color: ${bgStyle}; overflow: hidden; margin-bottom: 0.5rem; transition: var(--transition-smooth); min-height: 44px; width: 100%;">
              <div class="client-accordion-header" style="padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: text; width: 100%; min-height: 44px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                  <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-align: left;">${clientName}</span>
                  <span style="font-size: 0.75rem; color: var(--text-secondary); user-select: all;">C.C. ${clientCedula}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: auto;">
                  <span class="status-badge" onclick="event.stopPropagation()" style="font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.4rem; border-radius: 4px; background-color: ${badgeBg}; color: ${textColor}; border: 1px solid ${borderStyle}; display: inline-block; user-select: all; cursor: text;">${badgeText}</span>
                  <span class="accordion-arrow" style="font-size: 0.75rem; color: var(--text-secondary); transition: transform 0.2s; display: inline-block; transform: rotate(0deg); pointer-events: none;">▼</span>
                </div>
              </div>
              <div id="details-${clientCedula}" class="tracking-client-details" style="display: none; padding: 0.75rem 1rem; font-size: 0.75rem; border-top: 1px dashed ${dashedBorder}; flex-direction: column; gap: 0.35rem; color: var(--text-secondary); width: 100%; animation: fadeIn 0.2s ease-in-out;">
                <div><strong>Cédula:</strong> <span style="color: var(--text-primary); font-weight: 500;">${c.cedula || 'No registrada'}</span></div>
                <div><strong>Teléfono:</strong> <span style="color: var(--text-primary); font-weight: 500;">${c.phone || 'Sin teléfono'}</span></div>
                <div><strong>Dirección:</strong> <span style="color: var(--text-primary); font-weight: 500;">${c.direccion || clientAddress}</span></div>
                <div><strong>Cuota:</strong> <span style="font-weight: 700; color: var(--text-primary);">${clientInstallment}</span></div>
                <button class="btn-select-client" data-cedula="${c.cedula}" style="margin-top: 0.5rem; padding: 0.6rem; background-color: var(--color-primario); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🧾 Cobrar a este cliente</button>
              </div>
            </div>
          `;
        });
        content.innerHTML = htmlContent;

        // Interacción: Seleccionar cliente para cobrar
        const selectButtons = content.querySelectorAll('.btn-select-client');
        selectButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const cedula = e.target.getAttribute('data-cedula');
            
            // Cerrar el modal
            const modal = document.getElementById('agent-route-tracking-modal');
            if (modal) modal.style.display = 'none';
            
            // Llenar el input y disparar la búsqueda
            const input = document.getElementById('cobrar-search-input');
            if (input) {
              input.value = cedula;
              const searchBtn = document.getElementById('btn-agent-search');
              if (searchBtn) searchBtn.click();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        });
      };

      // Iniciar el renderizado inicial
      renderClients();
    } catch (e) {
      console.error("Error al abrir modal de seguimiento:", e);
      content.innerHTML = '<p style="text-align: center; color: var(--color-rojo); font-size: 0.8rem; padding: 1rem;">Error al cargar datos.</p>';
    }
  },

  closeRouteTrackingModal() {
    const modal = document.getElementById('agent-route-tracking-modal');
    if (modal) modal.style.display = 'none';
  },

  async generateCashReport() {
    try {
      const currentUser = window.BulaPayDB.getCurrentUser();
      if (!currentUser) return;

      const todayStr = this.getLocalDateString();
      const allPayments = await window.BulaPayDB.getPayments();
      
      const allClients = await window.BulaPayDB.getClients();
      const blacklistedCedulas = new Set(
        allClients
          .filter(c => {
            const rawStatus = String(c.status || c.estado || '').toUpperCase();
            return c.risk === 'Rojo' || String(c.risk || '').trim().toLowerCase() === 'rojo' || rawStatus.includes('NEGRA') || rawStatus.includes('MORA');
          })
          .map(c => String(c.cedula))
      );

      // Filtrar cobros por el cobrador actual y fecha de hoy estrictamente en hora local (excluyendo lista negra y mora)
      const todayPayments = allPayments.filter(p => {
        const pCedula = String(p.clientCedula || p.client_cedula || p.cedula || '');
        const pStatusUpper = String(p.status || '').toUpperCase();
        const isMoraPayment = pStatusUpper.includes('MORA') || pStatusUpper.includes('NEGRA') || (p.id && String(p.id).startsWith('pay_liq_') && blacklistedCedulas.has(pCedula));

        return p.date === todayStr && 
               Number(p.amount) > 0 && 
               p.status !== 'No Pago' &&
               p.status !== 'Pendiente' &&
               !isMoraPayment &&
               !blacklistedCedulas.has(pCedula) &&
               p.agentName && p.agentName.toLowerCase().trim() === currentUser.name.toLowerCase().trim();
      });
      const totalCollected = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Obtener clientes creados hoy por este cobrador
      const todayClients = allClients.filter(c => {
        if (!c.created_at) return false;
        // Filtrado estricto convirtiendo c.created_at a la zona horaria local
        const clientLocalDate = this.getLocalDateString(new Date(c.created_at));
        return clientLocalDate === todayStr;
      });

      // Sumar capital prestado (asumiendo interés comercial estándar de 20%)
      // capital = totalDebt / 1.2
      const totalLent = todayClients.reduce((sum, c) => sum + Math.round(Number(c.totalDebt) / 1.2), 0);
      const netCash = totalCollected - totalLent;

      // Poblar el modal tipo tirilla/factura
      document.getElementById('cash-report-date').textContent = `Fecha: ${todayStr}`;
      document.getElementById('cash-report-agent').textContent = `Cobrador: ${currentUser.name}`;
      document.getElementById('cash-report-income').textContent = `+$${totalCollected.toLocaleString('es-CO')}`;
      document.getElementById('cash-report-expenses').textContent = `-$${totalLent.toLocaleString('es-CO')}`;
      
      const netEl = document.getElementById('cash-report-net');
      netEl.textContent = `$${netCash.toLocaleString('es-CO')}`;
      
      if (netCash < 0) {
        netEl.style.color = '#dc2626';
      } else {
        netEl.style.color = '#111111';
      }

      // Mostrar el modal de reporte
      const reportModal = document.getElementById('agent-cash-report-modal');
      if (reportModal) {
        reportModal.style.display = 'flex';
      }
    } catch (e) {
      console.error("Error al generar reporte de caja:", e);
      alert("❌ Error al calcular el reporte de caja.");
    }
  },

  destroy() {
    this.stopLocationMonitoring();
  }
};

window.agentModule = agentModule;
window.AgentV6 = agentModule;
