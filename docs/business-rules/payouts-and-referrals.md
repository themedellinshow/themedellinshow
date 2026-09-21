# Reglas de Negocio — Payouts a Hosts y Wallet de Referidos

> **Normativo.** Estas reglas fueron definidas por el dueño del negocio. **No deben ser modificadas
> automáticamente por el agente (OpenCode)** ni ajustarse sin aprobación explícita del usuario.
> Son la fuente de verdad para el diseño de las Fases de payout a hosts y wallet de referidos.

## 1. Payout a hosts

### 1.1 Comisión

- **Porcentaje variable según categoría**, con base inicial:
  - Experiences / Tours: **20%** The Medellín Show / **80%** host.
  - Companions: **20% / 80%**.
  - Language & Interpreting: **20% / 80%**.
  - Photography / Content: **20% / 80%**.
  - Wellness / Personal Services: **20% / 80%**.
  - Servicios especiales o personalizados: **comisión definida individualmente** (override por servicio).
- La comisión se calcula sobre el **valor del servicio después de descuentos aplicables** y
  **antes de impuestos/retenciones** que correspondan.

### 1.2 Liberación del pago

- **No inmediata.** El dinero queda pendiente hasta que la experiencia sea **completada** y
  transcurran **72 horas sin una disputa abierta**.
- Flujo:
  `Cliente paga → pago pendiente (host) → experiencia completada → ventana de 72h sin disputa → payout disponible → payout semanal`.
- Si existe una **disputa**, el payout queda **retenido** hasta su resolución.

### 1.3 Frecuencia y monto mínimo

- **Pagos semanales**: los pagos disponibles durante la semana se agrupan y se pagan en un
  día fijo (ciclo semanal).
- **Monto mínimo**: **COP $100.000** de saldo disponible. Si un host no alcanza el mínimo, el
  saldo se acumula para el siguiente ciclo.

### 1.4 Retenciones y facturación (Colombia)

- **No inventar reglas tributarias.** El sistema debe **almacenar la información fiscal del
  proveedor** (tipo de documento, número, país, moneda de pago) y permitir **configurar
  posteriormente** retenciones/impuestos según su situación.
- Las reglas tributarias definitivas se **validarán con un contador/asesor fiscal colombiano**
  antes de activar payouts reales.

## 2. Wallet de referidos

### 2.1 Recompensa

- **10% de la primera compra realizada por el referido**, con un **tope de COP $100.000**.
  - Ej.: compra de $500.000 → $50.000; compra de $2.000.000 → $100.000 (tope).

### 2.2 Tipo de recompensa

- **Crédito interno** de The Medellín Show. **No retirable en efectivo** en la primera versión.
- Utilizable para servicios elegibles dentro de la plataforma.

### 2.3 Vencimiento

- El crédito **vence 12 meses** después de ser otorgado. El sistema debe mostrar la fecha de
  vencimiento.

### 2.4 Anti-fraude (mínimo desde el inicio)

- Prohibido auto-referirse o generar crédito con una cuenta vinculada a los propios métodos de
  pago o señales técnicas evidentes de la misma identidad.
- Señales posibles: cuenta, email, teléfono, método de pago, dispositivo, IP, patrones anómalos.
- **Ninguna señal individual se considera prueba definitiva** (ej. dos personas legítimas
  pueden compartir Wi-Fi).
- Casos sospechosos → estado **`pending review`** para revisión manual.

## 3. Regla transversal: confirmación de crédito

El **crédito de referido solo se confirma cuando la primera compra del referido ha sido
completada y ya no está sujeta a reembolso o disputa** (espejo del ciclo de payout a hosts:
completada + 72h de ventana). Si la compra se cancela o reembolsa, el crédito **no queda
disponible** (se anula).