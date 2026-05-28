import { connect } from "../database.js";

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/usuarios
 * Lista completa de usuarios con datos de persona y rol.
 */
export const listarUsuarios = async (req, res) => {
    const db = await connect();
    try {
        const [rows] = await db.query("SELECT * FROM vista_usuarios_completo ORDER BY usuario_id DESC");
        return res.json(rows);
    } catch (err) {
        console.error("listarUsuarios:", err);
        return res.status(500).json({ error: "Error interno al listar usuarios." });
    }
};

/**
 * GET /admin/usuario/:usuario_id
 * Detalle completo de un usuario: datos, cuentas y últimas transacciones.
 */
export const obtenerUsuario = async (req, res) => {
    const { usuario_id } = req.params;
    const db = await connect();
    try {
        // Llama al SP de estado de cuenta usando nombre_completo del usuario solicitado
        const [[usuario]] = await db.query(
            `SELECT nombre_completo FROM vista_usuarios_completo WHERE usuario_id = ? LIMIT 1`,
            [usuario_id]
        );
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

        // Resultado 1: datos del usuario
        const [[datosUsuario]] = await db.query(
            `SELECT * FROM vista_usuarios_completo WHERE usuario_id = ? LIMIT 1`,
            [usuario_id]
        );

        // Resultado 2: cuentas
        const [cuentas] = await db.query(
            `SELECT * FROM vista_cuentas_resumen WHERE usuario_id = ? ORDER BY orden_cuenta ASC`,
            [usuario_id]
        );

        // Resultado 3: últimas 30 transacciones
        const [transacciones] = await db.query(
            `SELECT * FROM vista_transacciones_completo WHERE usuario_id = ? ORDER BY Fecha_transaccion DESC LIMIT 30`,
            [usuario_id]
        );

        return res.json({ usuario: datosUsuario, cuentas, transacciones });
    } catch (err) {
        console.error("obtenerUsuario:", err);
        return res.status(500).json({ error: "Error interno al obtener el usuario." });
    }
};

/**
 * PUT /admin/usuario/:usuario_id/estado
 * Cambia el estado de un usuario: activo | bloqueado | inactivo
 * Body: { estado }
 */
export const cambiarEstadoUsuario = async (req, res) => {
    const { usuario_id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ["activo", "bloqueado", "inactivo"];
    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido. Use: ${estadosValidos.join(", ")}.` });
    }

    const db = await connect();
    try {
        const [result] = await db.query(
            "UPDATE Users SET Estado = ? WHERE ID = ?",
            [estado, usuario_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado." });
        return res.json({ mensaje: `Estado del usuario actualizado a '${estado}'.` });
    } catch (err) {
        console.error("cambiarEstadoUsuario:", err);
        return res.status(500).json({ error: "Error interno al cambiar estado del usuario." });
    }
};

/**
 * PUT /admin/usuario/:usuario_id/datos
 * Actualiza datos personales: nombre, apellido, direccion, telefono, edad
 * Body: { nombre?, apellido?, direccion?, telefono?, edad? }
 */
export const actualizarDatosPersona = async (req, res) => {
    const { usuario_id } = req.params;
    const { nombre, apellido, direccion, telefono, edad } = req.body;

    const db = await connect();
    try {
        const [[persona]] = await db.query(
            `SELECT p.ID FROM Persona p INNER JOIN Users u ON u.ID_Persona = p.ID WHERE u.ID = ? LIMIT 1`,
            [usuario_id]
        );
        if (!persona) return res.status(404).json({ error: "Usuario no encontrado." });

        await db.query(
            `UPDATE Persona SET
                Nombre    = COALESCE(?, Nombre),
                Apellido  = COALESCE(?, Apellido),
                Direccion = COALESCE(?, Direccion),
                Telefono  = COALESCE(?, Telefono),
                Edad      = COALESCE(?, Edad)
             WHERE ID = ?`,
            [nombre ?? null, apellido ?? null, direccion ?? null, telefono ?? null, edad ?? null, persona.ID]
        );

        return res.json({ mensaje: "Datos personales actualizados correctamente." });
    } catch (err) {
        console.error("actualizarDatosPersona:", err);
        return res.status(500).json({ error: "Error interno al actualizar datos." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUENTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/cuentas
 * Lista todas las cuentas con resumen de saldo y tarjeta vinculada.
 */
export const listarCuentas = async (req, res) => {
    const db = await connect();
    try {
        const [rows] = await db.query(
            `SELECT * FROM vista_cuentas_resumen ORDER BY cuenta_id DESC`
        );
        return res.json(rows);
    } catch (err) {
        console.error("listarCuentas:", err);
        return res.status(500).json({ error: "Error interno al listar cuentas." });
    }
};

/**
 * GET /admin/cuenta/:numero_cuenta/saldos
 * Saldos de una cuenta en todas las monedas usando el SP sp_saldos_cuenta.
 */
export const saldosCuenta = async (req, res) => {
    const { numero_cuenta } = req.params;
    const db = await connect();
    try {
        const [rows] = await db.query("CALL sp_saldos_cuenta(?)", [numero_cuenta]);
        if (!rows[0] || rows[0].length === 0) {
            return res.status(404).json({ error: "Cuenta no encontrada o sin saldos registrados." });
        }
        return res.json(rows[0]);
    } catch (err) {
        console.error("saldosCuenta:", err);
        return res.status(500).json({ error: "Error interno al consultar saldos." });
    }
};

/**
 * GET /admin/usuario/:usuario_id/cuentas
 * Cuentas de un usuario usando el SP sp_cuentas_usuario.
 */
export const cuentasPorUsuario = async (req, res) => {
    const { usuario_id } = req.params;
    const db = await connect();
    try {
        const [[usuario]] = await db.query(
            `SELECT nombre_completo FROM vista_usuarios_completo WHERE usuario_id = ? LIMIT 1`,
            [usuario_id]
        );
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

        const [rows] = await db.query("CALL sp_cuentas_usuario(?)", [usuario.nombre_completo]);
        return res.json(rows[0]);
    } catch (err) {
        console.error("cuentasPorUsuario:", err);
        return res.status(500).json({ error: "Error interno al obtener cuentas del usuario." });
    }
};

/**
 * PUT /admin/cuenta/:numero_cuenta/estado
 * Cambia el estado de una cuenta: activa | bloqueada | cerrada
 * Body: { estado }
 */
export const cambiarEstadoCuenta = async (req, res) => {
    const { numero_cuenta } = req.params;
    const { estado } = req.body;

    const estadosValidos = ["activa", "bloqueada", "cerrada"];
    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido. Use: ${estadosValidos.join(", ")}.` });
    }

    const db = await connect();
    try {
        const [result] = await db.query(
            "UPDATE Cuenta SET Estado = ? WHERE Numero_cuenta = ?",
            [estado, numero_cuenta]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: "Cuenta no encontrada." });
        return res.json({ mensaje: `Estado de la cuenta actualizado a '${estado}'.` });
    } catch (err) {
        console.error("cambiarEstadoCuenta:", err);
        return res.status(500).json({ error: "Error interno al cambiar estado de la cuenta." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TARJETAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/tarjetas
 * Lista todas las tarjetas registradas.
 */
export const listarTarjetas = async (req, res) => {
    const db = await connect();
    try {
        const [rows] = await db.query(
            `SELECT
                tar.ID,
                tar.Numero_tarjeta,
                tar.Tipo_tarjeta,
                tar.Estado,
                tar.Fecha_vencimiento,
                tar.Fecha_creacion,
                CONCAT(p.Nombre, ' ', p.Apellido) AS nombre_titular,
                u.Correo
             FROM Tarjeta tar
             INNER JOIN Users   u ON u.ID       = tar.ID_Users
             INNER JOIN Persona p ON p.ID       = u.ID_Persona
             ORDER BY tar.ID DESC`
        );
        return res.json(rows);
    } catch (err) {
        console.error("listarTarjetas:", err);
        return res.status(500).json({ error: "Error interno al listar tarjetas." });
    }
};

/**
 * GET /admin/tarjeta/:numero_tarjeta/cuentas
 * Cuentas vinculadas a una tarjeta usando sp_cuentas_por_tarjeta.
 */
export const cuentasPorTarjeta = async (req, res) => {
    const { numero_tarjeta } = req.params;
    const db = await connect();
    try {
        const [rows] = await db.query("CALL sp_cuentas_por_tarjeta(?)", [numero_tarjeta]);
        return res.json(rows[0]);
    } catch (err) {
        console.error("cuentasPorTarjeta:", err);
        return res.status(500).json({ error: "Error interno al obtener cuentas de la tarjeta." });
    }
};

/**
 * PUT /admin/tarjeta/:numero_tarjeta/estado
 * Cambia el estado de una tarjeta: activa | bloqueada | cancelada
 * Body: { pin, nombre_completo, nuevo_estado }
 * Usa el SP sp_cambiar_estado_tarjeta.
 */
export const cambiarEstadoTarjeta = async (req, res) => {
    const { numero_tarjeta } = req.params;
    const { pin, nombre_completo, nuevo_estado } = req.body;

    const estadosValidos = ["activa", "bloqueada", "cancelada"];
    if (!nuevo_estado || !estadosValidos.includes(nuevo_estado)) {
        return res.status(400).json({ error: `Estado inválido. Use: ${estadosValidos.join(", ")}.` });
    }
    if (!pin || !nombre_completo) {
        return res.status(400).json({ error: "pin y nombre_completo son requeridos." });
    }

    const db = await connect();
    try {
        await db.query("SET @msg = ''");
        await db.query("CALL sp_cambiar_estado_tarjeta(?, ?, ?, @msg)", [pin, nombre_completo, nuevo_estado]);
        const [[out]] = await db.query("SELECT @msg AS mensaje");

        if (out.mensaje.startsWith("Error")) {
            return res.status(400).json({ error: out.mensaje });
        }
        return res.json({ mensaje: out.mensaje });
    } catch (err) {
        console.error("cambiarEstadoTarjeta:", err);
        return res.status(500).json({ error: "Error interno al cambiar estado de la tarjeta." });
    }
};

/**
 * POST /admin/tarjeta/vincular-cuenta
 * Vincula una cuenta a una tarjeta usando sp_vincular_cuenta_tarjeta.
 * Body: { numero_tarjeta, numero_cuenta, es_principal }
 */
export const vincularCuentaTarjeta = async (req, res) => {
    const { numero_tarjeta, numero_cuenta, es_principal = 0 } = req.body;

    if (!numero_tarjeta || !numero_cuenta) {
        return res.status(400).json({ error: "numero_tarjeta y numero_cuenta son requeridos." });
    }

    const db = await connect();
    try {
        await db.query("SET @msg = ''");
        await db.query("CALL sp_vincular_cuenta_tarjeta(?, ?, ?, @msg)", [numero_tarjeta, numero_cuenta, es_principal ? 1 : 0]);
        const [[out]] = await db.query("SELECT @msg AS mensaje");

        if (out.mensaje.startsWith("Error")) {
            return res.status(400).json({ error: out.mensaje });
        }
        return res.json({ mensaje: out.mensaje });
    } catch (err) {
        console.error("vincularCuentaTarjeta:", err);
        return res.status(500).json({ error: "Error interno al vincular cuenta." });
    }
};

/**
 * DELETE /admin/tarjeta/desvincular-cuenta
 * Desvincula una cuenta de una tarjeta usando sp_desvincular_cuenta_tarjeta.
 * Body: { numero_tarjeta, numero_cuenta }
 */
export const desvincularCuentaTarjeta = async (req, res) => {
    const { numero_tarjeta, numero_cuenta } = req.body;

    if (!numero_tarjeta || !numero_cuenta) {
        return res.status(400).json({ error: "numero_tarjeta y numero_cuenta son requeridos." });
    }

    const db = await connect();
    try {
        await db.query("SET @msg = ''");
        await db.query("CALL sp_desvincular_cuenta_tarjeta(?, ?, @msg)", [numero_tarjeta, numero_cuenta]);
        const [[out]] = await db.query("SELECT @msg AS mensaje");

        if (out.mensaje.startsWith("Error")) {
            return res.status(400).json({ error: out.mensaje });
        }
        return res.json({ mensaje: out.mensaje });
    } catch (err) {
        console.error("desvincularCuentaTarjeta:", err);
        return res.status(500).json({ error: "Error interno al desvincular cuenta." });
    }
};

/**
 * PUT /admin/tarjeta/cuenta-principal
 * Cambia la cuenta principal de una tarjeta usando sp_cambiar_cuenta_principal.
 * Body: { numero_tarjeta, numero_cuenta }
 */
export const cambiarCuentaPrincipal = async (req, res) => {
    const { numero_tarjeta, numero_cuenta } = req.body;

    if (!numero_tarjeta || !numero_cuenta) {
        return res.status(400).json({ error: "numero_tarjeta y numero_cuenta son requeridos." });
    }

    const db = await connect();
    try {
        await db.query("SET @msg = ''");
        await db.query("CALL sp_cambiar_cuenta_principal(?, ?, @msg)", [numero_tarjeta, numero_cuenta]);
        const [[out]] = await db.query("SELECT @msg AS mensaje");

        if (out.mensaje.startsWith("Error")) {
            return res.status(400).json({ error: out.mensaje });
        }
        return res.json({ mensaje: out.mensaje });
    } catch (err) {
        console.error("cambiarCuentaPrincipal:", err);
        return res.status(500).json({ error: "Error interno al cambiar cuenta principal." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACCIONES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/transacciones
 * Lista todas las transacciones del sistema con paginación opcional.
 * Query: ?limit=50&offset=0
 */
export const listarTransacciones = async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  ?? 50), 200);
    const offset = parseInt(req.query.offset ?? 0);

    const db = await connect();
    try {
        const [rows] = await db.query(
            `SELECT * FROM vista_transacciones_completo ORDER BY Fecha_transaccion DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const [[{ total }]] = await db.query(
            "SELECT COUNT(*) AS total FROM transacciones"
        );
        return res.json({ total, limit, offset, transacciones: rows });
    } catch (err) {
        console.error("listarTransacciones:", err);
        return res.status(500).json({ error: "Error interno al listar transacciones." });
    }
};

/**
 * GET /admin/transacciones/usuario/:usuario_id
 * Transacciones de un usuario, con filtro opcional por tipo.
 * Query: ?tipo=Deposito | Retiro | Transferencia
 * Usa el SP sp_transacciones_usuario.
 */
export const transaccionesPorUsuario = async (req, res) => {
    const { usuario_id } = req.params;
    const tipo = req.query.tipo ?? null;

    const db = await connect();
    try {
        const [[usuario]] = await db.query(
            `SELECT nombre_completo FROM vista_usuarios_completo WHERE usuario_id = ? LIMIT 1`,
            [usuario_id]
        );
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

        const [rows] = await db.query("CALL sp_transacciones_usuario(?, ?)", [usuario.nombre_completo, tipo]);
        return res.json(rows[0]);
    } catch (err) {
        console.error("transaccionesPorUsuario:", err);
        return res.status(500).json({ error: "Error interno al obtener transacciones." });
    }
};

/**
 * GET /admin/transaccion/:transaccion_id
 * Detalle de una transacción específica.
 */
export const obtenerTransaccion = async (req, res) => {
    const { transaccion_id } = req.params;
    const db = await connect();
    try {
        const [[row]] = await db.query(
            `SELECT * FROM vista_transacciones_completo WHERE transaccion_id = ? LIMIT 1`,
            [transaccion_id]
        );
        if (!row) return res.status(404).json({ error: "Transacción no encontrada." });
        return res.json(row);
    } catch (err) {
        console.error("obtenerTransaccion:", err);
        return res.status(500).json({ error: "Error interno al obtener la transacción." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MONEDAS Y TASAS DE CAMBIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/monedas
 * Lista todas las monedas registradas.
 */
export const listarMonedas = async (req, res) => {
    const db = await connect();
    try {
        const [rows] = await db.query("SELECT * FROM moneda ORDER BY ID ASC");
        return res.json(rows);
    } catch (err) {
        console.error("listarMonedas:", err);
        return res.status(500).json({ error: "Error interno al listar monedas." });
    }
};

/**
 * PUT /admin/moneda/:moneda_id/estado
 * Activa o desactiva una moneda.
 * Body: { activa: true | false }
 */
export const cambiarEstadoMoneda = async (req, res) => {
    const { moneda_id } = req.params;
    const { activa } = req.body;

    if (activa === undefined) {
        return res.status(400).json({ error: "El campo 'activa' (true/false) es requerido." });
    }

    const db = await connect();
    try {
        const [result] = await db.query(
            "UPDATE moneda SET Activa = ? WHERE ID = ?",
            [activa ? 1 : 0, moneda_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: "Moneda no encontrada." });
        return res.json({ mensaje: `Moneda ${activa ? "activada" : "desactivada"} correctamente.` });
    } catch (err) {
        console.error("cambiarEstadoMoneda:", err);
        return res.status(500).json({ error: "Error interno al cambiar estado de la moneda." });
    }
};

/**
 * GET /admin/tasas-cambio
 * Lista todas las tasas de cambio en caché.
 */
export const listarTasasCambio = async (req, res) => {
    const db = await connect();
    try {
        const [rows] = await db.query(
            "SELECT * FROM tasa_cambio_cache ORDER BY Moneda_origen, Tipo_tasa"
        );
        return res.json(rows);
    } catch (err) {
        console.error("listarTasasCambio:", err);
        return res.status(500).json({ error: "Error interno al listar tasas de cambio." });
    }
};

/**
 * PUT /admin/tasa-cambio
 * Actualiza o inserta una tasa de cambio en caché.
 * Body: { moneda_origen, moneda_destino, tasa, tipo_tasa }
 */
export const actualizarTasaCambio = async (req, res) => {
    const { moneda_origen, moneda_destino, tasa, tipo_tasa } = req.body;

    if (!moneda_origen || !moneda_destino || !tasa || !tipo_tasa) {
        return res.status(400).json({ error: "moneda_origen, moneda_destino, tasa y tipo_tasa son requeridos." });
    }

    const tiposValidos = ["oficial", "binance", "manual"];
    if (!tiposValidos.includes(tipo_tasa)) {
        return res.status(400).json({ error: `tipo_tasa inválido. Use: ${tiposValidos.join(", ")}.` });
    }

    const db = await connect();
    try {
        await db.query(
            `INSERT INTO tasa_cambio_cache (Moneda_origen, Moneda_destino, Tasa, Tipo_tasa)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE Tasa = VALUES(Tasa), Fecha_actualizacion = NOW()`,
            [moneda_origen.toUpperCase(), moneda_destino.toUpperCase(), tasa, tipo_tasa]
        );
        return res.json({ mensaje: "Tasa de cambio actualizada correctamente." });
    } catch (err) {
        console.error("actualizarTasaCambio:", err);
        return res.status(500).json({ error: "Error interno al actualizar la tasa de cambio." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD — RESUMEN GENERAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/dashboard
 * Métricas generales del sistema: totales de usuarios, cuentas,
 * transacciones del día y saldo global en BOB.
 */
export const dashboard = async (req, res) => {
    const db = await connect();
    try {
        const [[{ total_usuarios }]] = await db.query(
            "SELECT COUNT(*) AS total_usuarios FROM Users WHERE Estado = 'activo'"
        );
        const [[{ total_cuentas }]] = await db.query(
            "SELECT COUNT(*) AS total_cuentas FROM Cuenta WHERE Estado = 'activa'"
        );
        const [[{ total_tarjetas }]] = await db.query(
            "SELECT COUNT(*) AS total_tarjetas FROM Tarjeta WHERE Estado = 'activa'"
        );
        const [[{ transacciones_hoy }]] = await db.query(
            "SELECT COUNT(*) AS transacciones_hoy FROM Transacciones WHERE DATE(Fecha_transaccion) = CURDATE()"
        );
        const [[{ monto_movido_hoy }]] = await db.query(
            `SELECT IFNULL(SUM(Monto), 0) AS monto_movido_hoy
             FROM Transacciones
             WHERE DATE(Fecha_transaccion) = CURDATE() AND Estado = 'exitosa'`
        );
        const [[{ saldo_total_bob }]] = await db.query(
            `SELECT IFNULL(SUM(sm.Saldo), 0) AS saldo_total_bob
             FROM saldo_moneda sm
             INNER JOIN moneda m ON sm.ID_Moneda = m.ID
             WHERE m.Codigo = 'BOB'`
        );
        const [transacciones_por_tipo] = await db.query(
            `SELECT tt.Nombre AS tipo, COUNT(*) AS cantidad, IFNULL(SUM(t.Monto), 0) AS monto_total
             FROM Transacciones t
             INNER JOIN Tipo_Transaccion tt ON t.ID_Tipo_Transaccion = tt.ID
             WHERE t.Estado = 'exitosa'
             GROUP BY tt.Nombre`
        );

        return res.json({
            total_usuarios,
            total_cuentas,
            total_tarjetas,
            transacciones_hoy,
            monto_movido_hoy,
            saldo_total_bob,
            transacciones_por_tipo,
        });
    } catch (err) {
        console.error("dashboard:", err);
        return res.status(500).json({ error: "Error interno al obtener el dashboard." });
    }
};