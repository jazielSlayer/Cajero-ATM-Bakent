import { Router } from "express";
import {
    // Usuarios
    listarUsuarios,
    obtenerUsuario,
    cambiarEstadoUsuario,
    actualizarDatosPersona,
    // Cuentas
    listarCuentas,
    saldosCuenta,
    cuentasPorUsuario,
    cambiarEstadoCuenta,
    // Tarjetas
    listarTarjetas,
    cuentasPorTarjeta,
    cambiarEstadoTarjeta,
    vincularCuentaTarjeta,
    desvincularCuentaTarjeta,
    cambiarCuentaPrincipal,
    // Transacciones
    listarTransacciones,
    transaccionesPorUsuario,
    obtenerTransaccion,
    // Monedas y tasas
    listarMonedas,
    cambiarEstadoMoneda,
    listarTasasCambio,
    actualizarTasaCambio,
    // Dashboard
    dashboard,
} from "../controlers/admin.js";

const router = Router();

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/admin/dashboard", dashboard);

// ── Usuarios ──────────────────────────────────────────────────────────────────
router.get ("/admin/usuarios",                          listarUsuarios);
router.get ("/admin/usuario/:usuario_id",               obtenerUsuario);
router.put ("/admin/usuario/:usuario_id/estado",        cambiarEstadoUsuario);
router.put ("/admin/usuario/:usuario_id/datos",         actualizarDatosPersona);

// ── Cuentas ───────────────────────────────────────────────────────────────────
router.get ("/admin/cuentas",                                   listarCuentas);
router.get ("/admin/cuenta/:numero_cuenta/saldos",              saldosCuenta);
router.get ("/admin/usuario/:usuario_id/cuentas",               cuentasPorUsuario);
router.put ("/admin/cuenta/:numero_cuenta/estado",              cambiarEstadoCuenta);

// ── Tarjetas ──────────────────────────────────────────────────────────────────
router.get   ("/admin/tarjetas",                        listarTarjetas);
router.get   ("/admin/tarjeta/:numero_tarjeta/cuentas", cuentasPorTarjeta);
router.put   ("/admin/tarjeta/:numero_tarjeta/estado",  cambiarEstadoTarjeta);
router.post  ("/admin/tarjeta/vincular-cuenta",         vincularCuentaTarjeta);
router.delete("/admin/tarjeta/desvincular-cuenta",      desvincularCuentaTarjeta);
router.put   ("/admin/tarjeta/cuenta-principal",        cambiarCuentaPrincipal);

// ── Transacciones ─────────────────────────────────────────────────────────────
router.get ("/admin/transacciones",                         listarTransacciones);
router.get ("/admin/transacciones/usuario/:usuario_id",     transaccionesPorUsuario);
router.get ("/admin/transaccion/:transaccion_id",           obtenerTransaccion);

// ── Monedas y tasas de cambio ─────────────────────────────────────────────────
router.get ("/admin/monedas",                   listarMonedas);
router.put ("/admin/moneda/:moneda_id/estado",  cambiarEstadoMoneda);
router.get ("/admin/tasas-cambio",              listarTasasCambio);
router.put ("/admin/tasa-cambio",               actualizarTasaCambio);

export default router;