

function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// ── Modelo M/M/1 — un solo servidor ──────────────────────────────────────────
export function calcularMM1(lambda, mu) {
    if (lambda <= 0 || mu <= 0) {
        return { error: "λ y μ deben ser mayores a 0." };
    }
    if (lambda >= mu) {
        return {
            error: `Sistema inestable: λ (${lambda.toFixed(2)}) debe ser menor que μ (${mu.toFixed(2)}). La cola crece infinitamente.`,
            estable: false,
            lambda,
            mu,
        };
    }

    const p   = lambda / mu;                            // utilización
    const P0  = 1 - p;                                  // prob. 0 clientes en sistema
    const Ls  = lambda / (mu - lambda);                 // clientes promedio en sistema
    const Lq  = (lambda ** 2) / (mu * (mu - lambda));  // clientes promedio en cola
    const Ws  = 1 / (mu - lambda);                      // tiempo promedio en sistema (horas)
    const Wq  = lambda / (mu * (mu - lambda));          // tiempo promedio en cola (horas)

    return {
        modelo:            "M/M/1",
        estable:           true,
        lambda:            parseFloat(lambda.toFixed(4)),
        mu:                parseFloat(mu.toFixed(4)),
        s:                 1,
        p:                 parseFloat(p.toFixed(4)),
        utilizacion_pct:   parseFloat((p * 100).toFixed(2)),
        P0:                parseFloat(P0.toFixed(4)),
        P0_pct:            parseFloat((P0 * 100).toFixed(2)),
        Ls:                parseFloat(Ls.toFixed(4)),
        Lq:                parseFloat(Lq.toFixed(4)),
        Ws_horas:          parseFloat(Ws.toFixed(4)),
        Ws_minutos:        parseFloat((Ws * 60).toFixed(2)),
        Ws_segundos:       parseFloat((Ws * 3600).toFixed(2)),
        Wq_horas:          parseFloat(Wq.toFixed(4)),
        Wq_minutos:        parseFloat((Wq * 60).toFixed(2)),
        Wq_segundos:       parseFloat((Wq * 3600).toFixed(2)),
        alerta:            p > 0.85
            ? "⚠ Utilización > 85%. Riesgo de saturación en hora pico. Considera M/M/2."
            : null,
    };
}

// ── Modelo M/M/s — múltiples servidores ──────────────────────────────────────
export function calcularMMS(lambda, mu, s) {
    if (lambda <= 0 || mu <= 0 || s < 1) {
        return { error: "λ, μ deben ser > 0 y s ≥ 1." };
    }

    const p = lambda / (s * mu);   // utilización por servidor

    if (p >= 1) {
        return {
            error: `Sistema inestable con s=${s}: ρ = λ/(s·μ) = ${p.toFixed(2)} ≥ 1. Aumenta s o μ.`,
            estable: false,
            lambda, mu, s,
        };
    }

    const r = lambda / mu;  // intensidad de tráfico (λ/μ)

    // P0: probabilidad de que no haya clientes en el sistema
    let suma = 0;
    for (let n = 0; n < s; n++) {
        suma += Math.pow(r, n) / factorial(n);
    }
    const terminoS = (Math.pow(r, s) / factorial(s)) * (1 / (1 - p));
    const P0 = 1 / (suma + terminoS);

    // Lq: clientes promedio en cola
    const Lq = (P0 * Math.pow(r, s) * p) / (factorial(s) * Math.pow(1 - p, 2));

    // Wq, Ws, Ls por las fórmulas del formulario
    const Wq = Lq / lambda;
    const Ws = Wq + (1 / mu);
    const Ls = lambda * Ws;

    return {
        modelo:            `M/M/${s}`,
        estable:           true,
        lambda:            parseFloat(lambda.toFixed(4)),
        mu:                parseFloat(mu.toFixed(4)),
        s,
        p:                 parseFloat(p.toFixed(4)),
        utilizacion_pct:   parseFloat((p * 100).toFixed(2)),
        P0:                parseFloat(P0.toFixed(4)),
        P0_pct:            parseFloat((P0 * 100).toFixed(2)),
        Ls:                parseFloat(Ls.toFixed(4)),
        Lq:                parseFloat(Lq.toFixed(4)),
        Ws_horas:          parseFloat(Ws.toFixed(4)),
        Ws_minutos:        parseFloat((Ws * 60).toFixed(2)),
        Ws_segundos:       parseFloat((Ws * 3600).toFixed(2)),
        Wq_horas:          parseFloat(Wq.toFixed(4)),
        Wq_minutos:        parseFloat((Wq * 60).toFixed(2)),
        Wq_segundos:       parseFloat((Wq * 3600).toFixed(2)),
        alerta:            null,
    };
}

// ── Probabilidad Pn: n clientes en el sistema ─────────────────────────────────
export function calcularPn(lambda, mu, s, n) {
  // Reutiliza el P0 ya calculado en calcularMMS
  const resultado = s === 1 ? calcularMM1(lambda, mu) : calcularMMS(lambda, mu, s);
  if (resultado.error) return resultado;

  const P0 = resultado.P0;
  const r  = lambda / mu;
  let Pn;

  if (n < s) {
    Pn = (Math.pow(r, n) / factorial(n)) * P0;
  } else {
    Pn = (Math.pow(r, n) / (factorial(s) * Math.pow(s, n - s))) * P0;
  }

  return {
    n,
    Pn:     parseFloat(Pn.toFixed(6)),
    Pn_pct: parseFloat((Pn * 100).toFixed(4)),
  };
}