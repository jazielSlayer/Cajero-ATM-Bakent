// ─────────────────────────────────────────────────────────────────────────────
// routes/colas.js
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from "express";
import {
    getAnalisisColas,
    calcularColasManual,
    getProbabilidadN,
} from "../controlers/colas.js";

const router = Router();

// Análisis completo con datos reales de la BD (λ desde Transacciones, μ desde middleware)
router.get("/analisis/colas", getAnalisisColas);

// Cálculo manual con λ, μ, s propios (para demos del proyecto)
router.post("/analisis/colas/calcular", calcularColasManual);

// Probabilidad de exactamente n clientes en el sistema
// Ejemplo: GET /analisis/colas/pn/3
// Ejemplo: GET /analisis/colas/pn/5?lambda=60&mu=90&s=2
router.get("/analisis/colas/pn/:n", getProbabilidadN);

export default router;