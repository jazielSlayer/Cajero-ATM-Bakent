// ─────────────────────────────────────────────────────────────────────────────
// controllers/colas.js
// Teoría de Colas aplicada a la plataforma ATM
// λ se mide desde la tabla Transacciones (datos reales de tu BD)
// μ se mide con el middleware medirTiempoServicio en app.js
// ─────────────────────────────────────────────────────────────────────────────

import { connect }           from "../database.js";
import { calcularMM1, calcularMMS, calcularPn } from "./utils/TeoriaColas.js";

// ── Estado en memoria del middleware de tiempo de servicio ───────────────────
// Se llena automáticamente por medirTiempoServicio (ver abajo).
// Ventana deslizante de las últimas 200 peticiones.
const _tiemposPorRuta = {
  saldo:         [],   // GET /usuario/saldo/...
  login:         [],   // POST /login
  deposito:      [],   // vía Transacciones tipo Deposito
  retiro:        [],   // vía Transacciones tipo Retiro
  transferencia: [],   // vía Transacciones tipo Transferencia
  otros:         [],
};
const VENTANA = 200;

function clasificarRuta(path) {
  if (path.includes('/saldo'))          return 'saldo';
  if (path.includes('/login'))          return 'login';
  if (path.includes('/deposito'))       return 'deposito';
  if (path.includes('/retiro'))         return 'retiro';
  if (path.includes('/transferencia'))  return 'transferencia';
  return 'otros';
}

function getTiempoPromedioGlobalMs() {
            const todos = Object.values(_tiemposPorRuta).flat();
            if (todos.length === 0) return null;
            return todos.reduce((a, b) => a + b, 0) / todos.length;
}

export function registrarTiempo(ms, path = '') {
  const tipo = clasificarRuta(path);
  _tiemposPorRuta[tipo].push(ms);
  if (_tiemposPorRuta[tipo].length > VENTANA) _tiemposPorRuta[tipo].shift();
}

export function getTiempoPromedioMs(tipo = 'otros') {
  const arr = _tiemposPorRuta[tipo] ?? _tiemposPorRuta.otros;
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Y actualizar el middleware:
export const medirTiempoServicio = (req, res, next) => {
  const inicio = Date.now();
  res.on("finish", () => {
    registrarTiempo(Date.now() - inicio, req.path);
  });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analisis/colas
// Calcula λ real desde Transacciones y μ desde el middleware,
// luego devuelve los resultados M/M/1 y M/M/s completos.
// ─────────────────────────────────────────────────────────────────────────────
export const getAnalisisColas = async (req, res) => {
    const db = await connect();

    try {
        // ── 1. λ (tasa de llegada) desde la BD ───────────────────────────────
        // Transacciones exitosas de las últimas 24 horas ÷ 24 = tx/hora
        const [[{ total_24h }]] = await db.query(`
            SELECT COUNT(*) AS total_24h
            FROM   Transacciones
            WHERE  Fecha_transaccion >= NOW() - INTERVAL 24 HOUR
              AND  Estado = 'exitosa'
        `);

        // λ por hora (ventana de 24h)
        const lambda_24h = total_24h / 24;

        // λ pico: hora con más transacciones en los últimos 7 días
        const [[pico]] = await db.query(`
            SELECT HOUR(Fecha_transaccion) AS hora,
                   COUNT(*)               AS cantidad
            FROM   Transacciones
            WHERE  Fecha_transaccion >= NOW() - INTERVAL 7 DAY
              AND  Estado = 'exitosa'
            GROUP  BY HOUR(Fecha_transaccion)
            ORDER  BY cantidad DESC
            LIMIT  1
        `);

        // λ por tipo de transacción (para análisis por endpoint)
        const [porTipo] = await db.query(`
            SELECT tt.Nombre          AS tipo,
                   COUNT(*)           AS total,
                   COUNT(*) / 24.0    AS lambda_tipo
            FROM   Transacciones t
            JOIN   Tipo_Transaccion tt ON t.ID_Tipo_Transaccion = tt.ID
            WHERE  t.Fecha_transaccion >= NOW() - INTERVAL 24 HOUR
              AND  t.Estado = 'exitosa'
            GROUP  BY tt.Nombre
            ORDER  BY total DESC
        `);

        // Distribución por hora (para el gráfico en el proyecto)
        const [porHora] = await db.query(`
            SELECT HOUR(Fecha_transaccion) AS hora,
                   COUNT(*)               AS cantidad
            FROM   Transacciones
            WHERE  Fecha_transaccion >= NOW() - INTERVAL 7 DAY
              AND  Estado = 'exitosa'
            GROUP  BY HOUR(Fecha_transaccion)
            ORDER  BY hora ASC
        `);

        // ── 2. μ (tasa de servicio) desde el middleware ───────────────────────
        
        const avgMs = getTiempoPromedioGlobalMs();
        // Si todavía no hay mediciones reales, usamos un valor conservador:
        // 40ms promedio por request (Express + MariaDB stored procedure)
        const tiempoServicioMs = avgMs ?? 40;

        // μ en tx/hora = 3 600 000 ms/hora ÷ tiempo_promedio_ms
        const mu = 3_600_000 / tiempoServicioMs;

        // ── 3. λ a usar (promedio 24h, mínimo 1 para evitar división por 0) ──
        const lambda = Math.max(lambda_24h, 1);

        // ── 4. Calcular modelos ───────────────────────────────────────────────
        const mm1  = calcularMM1(lambda, mu);           // 1 worker Node.js
        const mm2  = calcularMMS(lambda, mu, 2);        // 2 workers PM2
        const mm3  = calcularMMS(lambda, mu, 3);        // 3 workers PM2
        const lambda_pico = pico ? parseFloat(pico.cantidad) : lambda;
        const mm1_pico = calcularMM1(lambda_pico, mu);// comportamiento en hora pico
        const totalMuestras = Object.values(_tiemposPorRuta).reduce((acc, arr) => acc + arr.length, 0);
        
        return res.json({
            // ── Parámetros medidos ────────────────────────────────────────────
            parametros: {
                lambda_promedio_hora: parseFloat(lambda.toFixed(4)),
                lambda_pico_hora:     pico ? parseFloat((pico.cantidad).toFixed(4)) : null,
                hora_pico:            pico ? pico.hora : null,
                mu_tx_por_hora:       parseFloat(mu.toFixed(4)),
                tiempo_servicio_ms:   parseFloat(tiempoServicioMs.toFixed(2)),
                total_tx_24h:         total_24h,
                fuente_mu:            avgMs
                    ? `Middleware (${totalMuestras} muestras)`
                    : "Valor por defecto (40ms) — agrega el middleware para datos reales",
            },

            // ── Modelos calculados ────────────────────────────────────────────
            modelos: {
                MM1:       mm1,
                MM2:       mm2,
                MM3:       mm3,
                MM1_pico:  mm1_pico,
            },

            // ── Distribución horaria (para gráficos del proyecto) ────────────
            distribucion_por_hora: porHora.map(r => ({
                hora:     r.hora,
                cantidad: r.cantidad,
            })),

            // ── Lambda por tipo de transacción ────────────────────────────────
            lambda_por_tipo: porTipo.map(r => ({
                tipo:        r.tipo,
                total_24h:   r.total,
                lambda_hora: parseFloat(parseFloat(r.lambda_tipo).toFixed(4)),
            })),
        });

    } catch (err) {
        console.error("Error en getAnalisisColas:", err);
        return res.status(500).json({ error: "Error interno al calcular la teoría de colas." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /analisis/colas/calcular
// Permite pasar λ, μ y s manualmente (para la demo del proyecto).
// Body: { lambda, mu, s, calcular_pn, n }
// ─────────────────────────────────────────────────────────────────────────────
export const calcularColasManual = (req, res) => {
    const {
        lambda,
        mu,
        s = 1,
        calcular_pn = false,
        n = 0,
    } = req.body;

    if (!lambda || !mu) {
        return res.status(400).json({ error: "Se requieren lambda (λ) y mu (μ)." });
    }

    const l = parseFloat(lambda);
    const m = parseFloat(mu);
    const servidores = parseInt(s);

    const resultado = servidores === 1
        ? calcularMM1(l, m)
        : calcularMMS(l, m, servidores);

    const respuesta = { ...resultado };

    // Si piden también Pn (probabilidad de exactamente n clientes)
    if (calcular_pn && !resultado.error && n >= 0) {
        respuesta.Pn_calculado = calcularPn(l, m, servidores, parseInt(n));
    }

    return res.json(respuesta);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analisis/colas/pn/:n
// Calcula P(n clientes en sistema) con los parámetros reales de la BD.
// Query params opcionales: ?lambda=60&mu=90&s=1
// ─────────────────────────────────────────────────────────────────────────────
export const getProbabilidadN = async (req, res) => {
    const n = parseInt(req.params.n);

    if (isNaN(n) || n < 0) {
        return res.status(400).json({ error: "n debe ser un entero ≥ 0." });
    }

    // Si vienen como query params los usamos, si no calculamos desde la BD
    let lambda = req.query.lambda ? parseFloat(req.query.lambda) : null;
    let mu     = req.query.mu     ? parseFloat(req.query.mu)     : null;
    const s    = req.query.s      ? parseInt(req.query.s)        : 1;

    if (!lambda || !mu) {
        // Calcular desde la BD igual que en getAnalisisColas
        const db = await connect();
        const [[{ total_24h }]] = await db.query(`
            SELECT COUNT(*) AS total_24h
            FROM   Transacciones
            WHERE  Fecha_transaccion >= NOW() - INTERVAL 24 HOUR
              AND  Estado = 'exitosa'
        `);
        lambda = Math.max(total_24h / 24, 1);
        const avgMs = getTiempoPromedioGlobalMs() ?? 40;
        mu     = 3_600_000 / avgMs;
    }

    if (lambda >= s * mu) {
        return res.status(400).json({
            error: `Sistema inestable: λ=${lambda.toFixed(2)} ≥ s·μ=${(s * mu).toFixed(2)}`,
        });
    }

    const resultado = calcularPn(lambda, mu, s, n);

    return res.json({
        lambda: parseFloat(lambda.toFixed(4)),
        mu:     parseFloat(mu.toFixed(4)),
        s,
        ...resultado,
        interpretacion: `Hay un ${resultado.Pn_pct}% de probabilidad de que haya exactamente ${n} cliente(s) en el sistema ATM.`,
    });
};