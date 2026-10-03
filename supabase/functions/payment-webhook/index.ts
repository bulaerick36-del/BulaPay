// Supabase Edge Function: Webhook de Pasarela de Pagos (Wompi / ePayco / Mercado Pago)
// Procesa pagos aprobados y reactiva automáticamente la suscripción por 30 días.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wompi-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Manejar Preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método no permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("📩 [Webhook Payment Event Recibido]:", JSON.stringify(body, null, 2));

    // 1. Extraer datos del evento (Soporte Wompi / ePayco / Genérico)
    let transactionStatus = "";
    let reference = "";
    let amountInCents = 0;
    let customerEmail = "";
    let transactionId = "";
    let paymentMethod = "";

    if (body.event === "transaction.updated" && body.data?.transaction) {
      // Estructura Estándar de Wompi
      const tx = body.data.transaction;
      transactionStatus = String(tx.status || "").toUpperCase();
      reference = String(tx.reference || "");
      amountInCents = tx.amount_in_cents || 0;
      customerEmail = String(tx.customer_email || "");
      transactionId = String(tx.id || "");
      paymentMethod = String(tx.payment_method_type || "Wompi");
    } else if (body.x_cod_response || body.x_response) {
      // Estructura ePayco
      const isApproved = String(body.x_cod_response) === "1" || String(body.x_response).toLowerCase() === "aceptada";
      transactionStatus = isApproved ? "APPROVED" : "REJECTED";
      reference = String(body.x_extra1 || body.x_id_invoice || "");
      amountInCents = Math.round((Number(body.x_amount) || 0) * 100);
      customerEmail = String(body.x_customer_email || "");
      transactionId = String(body.x_ref_payco || body.x_transaction_id || "");
      paymentMethod = String(body.x_franchise || "ePayco");
    } else {
      // Formato genérico/Mercado Pago
      transactionStatus = String(body.status || body.transaction_status || "").toUpperCase();
      reference = String(body.reference || body.external_reference || "");
      amountInCents = Math.round((Number(body.amount) || 0) * 100);
      customerEmail = String(body.email || body.payer?.email || "");
      transactionId = String(body.id || body.payment_id || "");
      paymentMethod = String(body.payment_method || "Pasarela");
    }

    console.log(`ℹ️ [Webhook Parsed]: Status='${transactionStatus}', Ref='${reference}', Email='${customerEmail}'`);

    // Validar si la transacción fue Aprobada
    if (transactionStatus !== "APPROVED" && transactionStatus !== "APROBADA" && transactionStatus !== "PAID") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Transacción recibida con estado '${transactionStatus}'. No se requiere reactivación.`,
          reference 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 2. Extraer el nombre de usuario de la referencia (Ej: bulapay_usuario123_1710000000)
    let usernameToUpdate = "";
    if (reference.startsWith("bulapay_")) {
      const parts = reference.split("_");
      if (parts.length >= 2) {
        usernameToUpdate = parts[1].toLowerCase().trim();
      }
    }

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados.");
      return new Response(
        JSON.stringify({ error: "Variables de entorno de Supabase faltantes en Edge Function" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Buscar el usuario en la BD
    let userQuery = supabase.from("users").select("*");
    if (usernameToUpdate) {
      userQuery = userQuery.eq("username", usernameToUpdate);
    } else if (customerEmail) {
      userQuery = userQuery.eq("email", customerEmail);
    } else {
      return new Response(
        JSON.stringify({ error: "No se pudo determinar el usuario desde la referencia o email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: users, error: findErr } = await userQuery;
    if (findErr || !users || users.length === 0) {
      console.error("❌ Usuario no encontrado en BD para referencia:", reference, findErr);
      return new Response(
        JSON.stringify({ error: "Usuario no registrado en BulaPay BD", reference }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const targetUser = users[0];
    const username = targetUser.username;

    // 4. Calcular la nueva fecha de vencimiento (+30 días)
    const ahora = new Date();
    let baseDate = ahora;

    if (targetUser.fecha_vencimiento || targetUser.fecha_corte) {
      const currentVenc = new Date(targetUser.fecha_vencimiento || targetUser.fecha_corte);
      // Si la fecha previa aún es futura, le sumamos 30 días a esa fecha. Si expiró, sumamos desde hoy.
      if (!isNaN(currentVenc.getTime()) && currentVenc.getTime() > ahora.getTime()) {
        baseDate = currentVenc;
      }
    }

    const nuevaFechaVencimiento = new Date(baseDate.getTime() + (30 * 24 * 60 * 60 * 1000));
    const yyyy = nuevaFechaVencimiento.getFullYear();
    const mm = String(nuevaFechaVencimiento.getMonth() + 1).padStart(2, "0");
    const dd = String(nuevaFechaVencimiento.getDate()).padStart(2, "0");
    const fechaCorteFormatted = `${yyyy}-${mm}-${dd}`;

    // 5. Actualizar el estado del usuario en Supabase (Reactivación Automática 24/7)
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        fecha_vencimiento: nuevaFechaVencimiento.toISOString(),
        fecha_corte: fechaCorteFormatted,
        bloqueado_por_mora: false,
        estado_suscripcion: "activa",
        updated_at: ahora.toISOString(),
      })
      .eq("username", username);

    if (updateErr) {
      console.error("❌ Error actualizando usuario en DB:", updateErr);
      return new Response(
        JSON.stringify({ error: "Error al actualizar la suscripción del usuario", details: updateErr }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 6. Registrar entrada en el historial de pagos
    try {
      await supabase.from("historial_pagos_suscripcion").insert([
        {
          username: username,
          transaction_id: transactionId,
          reference: reference,
          monto: amountInCents / 100,
          metodo_pago: paymentMethod,
          estado: "APROBADO",
          fecha_pago: ahora.toISOString(),
          nueva_fecha_vencimiento: nuevaFechaVencimiento.toISOString(),
        },
      ]);
    } catch (hErr) {
      console.warn("⚠️ No se pudo registrar en historial_pagos_suscripcion (opcional):", hErr);
    }

    console.log(`✅ [Reactivación Exitosa 🚀]: Usuario '${username}' extendido hasta ${fechaCorteFormatted}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Suscripción reactivada exitosamente para el usuario '${username}'. Nueva vigencia de 30 días.`,
        username: username,
        nuevaFechaVencimiento: nuevaFechaVencimiento.toISOString(),
        fechaCorte: fechaCorteFormatted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("❌ Error interno en Webhook Edge Function:", err);
    return new Response(
      JSON.stringify({ error: "Fallo interno procesando el Webhook", details: err?.message || String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
