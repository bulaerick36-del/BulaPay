// Módulo del Cliente Final (Cartón Digital y Directorio de Agentes)

const customerModule = {
  activeFilter: 'Todos',

  async init(clientCedula) {
    this.ledgerGrid = document.getElementById('customer-ledger-grid');
    this.agentsDirGrid = document.getElementById('managers-dir-grid');
    this.filterZone = document.getElementById('filter-zone');
    
    // Buscador
    this.searchForm = document.getElementById('form-customer-search');
    this.inputDocType = document.getElementById('cust-doc-type');
    this.inputDocNumber = document.getElementById('cust-doc-number');
    
    // Contenedores del estado de cuenta
    this.statementHeader = document.getElementById('customer-statement-header');
    this.statementLedger = document.getElementById('customer-statement-ledger');
    this.adTop = document.getElementById('customer-ad-top');
    this.adBottom = document.getElementById('customer-ad-bottom');

    // Elementos de resumen cliente
    this.custName = document.getElementById('cust-client-name');
    this.custMeta = document.getElementById('cust-client-meta');
    this.custCapitalPrestado = document.getElementById('cust-capital-prestado');
    this.custTotalPagar = document.getElementById('cust-total-pagar');
    this.custTotalAbonado = document.getElementById('cust-total-abonado');
    this.custSaldoPendiente = document.getElementById('cust-saldo-pendiente');

    this.bindEvents();
    
    // Si viene un parámetro directo en la URL (por ejemplo enlace de cobro de WhatsApp), auto-buscar
    if (clientCedula) {
      if (this.inputDocNumber) this.inputDocNumber.value = clientCedula;
      await this.loadClientStatement(clientCedula);
    } else {
      // Limpiar y ocultar estado de cuenta
      if (this.inputDocNumber) this.inputDocNumber.value = '';
      if (this.statementHeader) this.statementHeader.style.display = 'none';
      if (this.statementLedger) this.statementLedger.style.display = 'none';
      if (this.adTop) this.adTop.style.display = 'none';
      if (this.adBottom) this.adBottom.style.display = 'none';
    }
    
    await this.renderAgentsDirectory();
  },

  bindEvents() {
    if (this.filterZone) {
      this.filterZone.addEventListener('change', async (e) => {
        this.activeFilter = e.target.value;
        await this.renderAgentsDirectory();
      });
    }

    if (this.searchForm) {
      this.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const docNumber = this.inputDocNumber.value.trim();
        if (docNumber) {
          await this.loadClientStatement(docNumber);
        }
      });
    }
  },

  async loadClientStatement(cedula) {
    try {
      const client = await window.BulaPayDB.getClientByCedula(cedula);
      if (!client) {
        alert('❌ Cliente no registrado en el sistema BulaPay.');
        if (this.statementHeader) this.statementHeader.style.display = 'none';
        if (this.statementLedger) this.statementLedger.style.display = 'none';
        if (this.adTop) this.adTop.style.display = 'none';
        if (this.adBottom) this.adBottom.style.display = 'none';
        return;
      }

      const payments = await window.BulaPayDB.getPaymentsByClient(cedula);
      const totalPaid = payments.reduce((acc, curr) => acc + Number(curr.amount), 0);

      // Actualizar Resumen en el DOM con capitalización en JavaScript
      if (this.custName) {
        this.custName.textContent = client.name
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
      
      let assignedEntityLabel = 'No Asignado';
      const isCommerceClient = !!client.product_name || client.city === 'Comercio';

      if (isCommerceClient) {
        // Obtener el nombre del comercio (desde el supervisor_id)
        if (client.supervisor_id) {
          try {
            const commerceUser = await window.BulaPayDB.getUserByUsername(client.supervisor_id);
            if (commerceUser) {
              assignedEntityLabel = commerceUser.company || commerceUser.name;
            }
          } catch (dbErr) {
            console.warn("Fallo al obtener nombre del comercio:", dbErr);
          }
        }
      } else {
        // Obtener el nombre del agente de cobro
        if (client.routeId) {
          try {
            const routes = await window.BulaPayDB.getRoutes();
            const clientRoute = routes.find(r => r.id === client.routeId);
            if (clientRoute && clientRoute.agentName) {
              assignedEntityLabel = clientRoute.agentName;
            }
          } catch (dbErr) {
            console.warn("Fallo al obtener ruta del agente:", dbErr);
          }
        }
        
        // Si no se encuentra por ruta pero tiene agent_id
        if (assignedEntityLabel === 'No Asignado' && client.agent_id) {
          try {
            const agentUser = await window.BulaPayDB.getUserByUsername(client.agent_id);
            if (agentUser) {
              assignedEntityLabel = agentUser.name;
            }
          } catch (dbErr) {
            console.warn("Fallo al obtener usuario del agente:", dbErr);
          }
        }
      }
      
      if (this.custMeta) {
        const productLabel = client.product_name ? `Producto: ${client.product_name}` : 'Tipo: Préstamo Estándar';
        const entityPrefix = isCommerceClient ? 'Comercio' : 'Agente Asignado';
        this.custMeta.textContent = `Cédula: ${client.cedula} | ${productLabel} | ${entityPrefix}: ${assignedEntityLabel}`;
      }

      // Mapear los conceptos financieros con separación de capital e intereses
      const interestRate = isCommerceClient ? 0 : 20; // 20% para rutas estándar, 0% para comercios
      const capitalPrestado = Math.round(Number(client.totalDebt) / (1 + (interestRate / 100)));
      const totalAPagar = Number(client.totalDebt);
      const totalAbonado = totalPaid;
      const saldoPendiente = Number(client.outstanding);

      if (this.custCapitalPrestado) this.custCapitalPrestado.textContent = `$${capitalPrestado.toLocaleString('es-CO')}`;
      if (this.custTotalPagar) this.custTotalPagar.textContent = `$${totalAPagar.toLocaleString('es-CO')}`;
      if (this.custTotalAbonado) this.custTotalAbonado.textContent = `$${totalAbonado.toLocaleString('es-CO')}`;
      if (this.custSaldoPendiente) this.custSaldoPendiente.textContent = `$${saldoPendiente.toLocaleString('es-CO')}`;

      // Actualizar barra de progreso
      const progressPercent = Number(client.totalDebt) > 0 ? Math.round((totalPaid / Number(client.totalDebt)) * 100) : 0;
      const progressPercentEl = document.getElementById('cust-progress-percent');
      const progressFillEl = document.getElementById('cust-progress-fill');
      if (progressPercentEl) progressPercentEl.textContent = `${progressPercent}%`;
      if (progressFillEl) {
        setTimeout(() => {
          progressFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        }, 50);
      }

      // Renderizar Cartón de Pagos
      this.renderLedgerGrid(client, payments);

      // Mostrar el cartón, resumen y publicidad
      if (this.statementHeader) this.statementHeader.style.display = 'block';
      if (this.statementLedger) this.statementLedger.style.display = 'block';
      if (this.adTop) this.adTop.style.display = 'block';
      if (this.adBottom) this.adBottom.style.display = 'block';
    } catch (err) {
      console.error(err);
      alert('❌ Error al cargar el estado de cuenta del cliente.');
      if (this.statementHeader) this.statementHeader.style.display = 'none';
      if (this.statementLedger) this.statementLedger.style.display = 'none';
      if (this.adTop) this.adTop.style.display = 'none';
      if (this.adBottom) this.adBottom.style.display = 'none';
    }
  },

  renderLedgerGrid(client, payments) {
    if (!this.ledgerGrid) return;
    this.ledgerGrid.innerHTML = '';

    const totalSlots = client.installmentsCount || 5;
    const installmentAmount = client.installmentAmount || 100000;
    
    // Mapear los números de cuotas que ya han sido pagadas
    const paidInstallments = payments
      .filter(p => p.status === 'Pagado' || p.status === 'Abonado' || Number(p.amount) > 0);

    // Ajustar fecha de creación del crédito para estimar los atrasos
    let creditDate = new Date(client.created_at || Date.now());
    if (payments.length > 0) {
      const earliestPayDate = new Date(Math.min(...payments.map(p => new Date(p.date))));
      if (earliestPayDate < creditDate) {
        creditDate = new Date(earliestPayDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      }
    }

    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 1; i <= totalSlots; i++) {
      const payment = payments.find(p => p.installmentNumber === i);
      const slotCard = document.createElement('div');
      slotCard.className = 'ledger-slot-card';
      
      // Regla estricta: Bloquear interacción (Solo Lectura)
      slotCard.style.pointerEvents = 'none';

      // Calcular fecha de vencimiento (una cuota por semana)
      const dueDate = new Date(creditDate);
      dueDate.setDate(creditDate.getDate() + (i * 7));
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      const isPaid = paidInstallments.some(p => p.installmentNumber === i);
      
      if (isPaid) {
        slotCard.classList.add('paid');
        slotCard.style.backgroundColor = 'var(--color-verde-bg)';
        slotCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        slotCard.innerHTML = `
          <span class="slot-num" style="color: var(--color-verde);">CUOTA ${i}</span>
          <span class="slot-amount" style="color: var(--color-verde); font-weight: bold;">$${Number(payment ? payment.amount : installmentAmount).toLocaleString('es-CO')}</span>
          <span class="slot-date" style="color: var(--text-secondary);">${payment ? payment.date : ''}</span>
          <span class="slot-signature" style="font-size: 0.5rem; font-family: monospace; color: var(--text-muted);">${payment ? payment.signature : 'Firmado'}</span>
          <div class="slot-stamp">✔</div>
        `;
      } else {
        const isOverdue = dueDateOnly < todayDateOnly;
        if (isOverdue) {
          slotCard.classList.add('nopago');
          slotCard.style.backgroundColor = 'var(--color-rojo-bg)';
          slotCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          slotCard.innerHTML = `
            <span class="slot-num" style="color: var(--color-rojo);">CUOTA ${i}</span>
            <span class="slot-amount" style="color: var(--color-rojo); font-weight: bold;">$${Number(installmentAmount).toLocaleString('es-CO')}</span>
            <span class="slot-empty-text" style="color: var(--color-rojo);">⚠️ Atrasado</span>
            <span class="slot-signature" style="color: var(--text-muted); font-size: 0.5rem;">Venció: ${dueDate.toISOString().split('T')[0]}</span>
          `;
        } else {
          slotCard.style.backgroundColor = 'var(--bg-secondary)';
          slotCard.style.borderColor = 'var(--border-color)';
          slotCard.innerHTML = `
            <span class="slot-num" style="color: var(--text-secondary);">CUOTA ${i}</span>
            <span class="slot-amount" style="color: var(--text-primary); font-weight: bold;">$${Number(installmentAmount).toLocaleString('es-CO')}</span>
            <span class="slot-empty-text" style="color: var(--text-muted);">Pendiente</span>
            <span class="slot-signature" style="color: var(--text-muted); font-size: 0.5rem;">Por vencer</span>
          `;
        }
      }
      
      this.ledgerGrid.appendChild(slotCard);
    }
  },

  async renderAgentsDirectory() {
    if (!this.agentsDirGrid) return;
    this.agentsDirGrid.innerHTML = '';

    try {
      // Filtrar gestores de cartera y supervisores
      const allUsers = await window.BulaPayDB.getUsers();
      let managers = allUsers.filter(u => u.role === 'Usuario Supervisor' || u.role === 'Comercio Independiente' || u.role === 'supervisor' || u.role === 'Administrador de Rutas' || u.role === 'Otros (Comercios, Compraventas, Mercados)' || u.role === 'Agente Independiente');

      // Aplicar Filtro de Zona/Ciudad
      if (this.activeFilter !== 'Todos') {
        managers = managers.filter(m => m.city === this.activeFilter);
      }

      if (managers.length === 0) {
        this.agentsDirGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No hay gestores o empresas registrados en esta zona.</div>`;
        return;
      }

      managers.forEach(mgr => {
        const card = document.createElement('div');
        card.className = 'agent-dir-card';

        const displayName = mgr.company || mgr.name;
        const contactPhone = mgr.phone || '+573151234567';

        card.innerHTML = `
          <div>
            <div class="agent-dir-header">
              <div class="agent-dir-avatar" style="background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 50%; width: 40px; height: 40px;">
                ${displayName.charAt(0)}
              </div>
              <div class="agent-dir-info" style="margin-left: 0.75rem;">
                <h4 style="font-size: 0.95rem; margin-bottom: 0.2rem; color: white;">${displayName}</h4>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">📍 ${mgr.city} (${mgr.zone || 'General'})</p>
              </div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.75rem; line-height: 1.4;">
              Asesor: <strong>${mgr.name}</strong><br>
              Contacto oficial autorizado para gestiones de cobro, créditos y soporte.
            </p>
          </div>
          <div class="agent-contact-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            <a href="tel:${contactPhone}" class="btn-contact-small btn-contact-call" style="flex: 1; text-align: center; font-size: 0.75rem; padding: 0.4rem; background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: white; border-radius: 6px; text-decoration: none;">📞 Llamar</a>
            <a href="https://wa.me/${contactPhone.replace(/[\s+]/g, '')}?text=Hola%20${encodeURIComponent(mgr.name)},%20soy%20cliente%20de%20BulaPay%20y%20deseo%20comunicarme%20con%20ustedes." 
               target="_blank" class="btn-contact-small btn-contact-whatsapp" style="flex: 1; text-align: center; font-size: 0.75rem; padding: 0.4rem; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--color-verde); border-radius: 6px; text-decoration: none;">💬 WhatsApp</a>
          </div>
        `;

        this.agentsDirGrid.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      this.agentsDirGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--color-rojo); padding: 2rem;">Error al cargar directorio de gestores.</div>`;
    }
  }
};

window.customerModule = customerModule;
