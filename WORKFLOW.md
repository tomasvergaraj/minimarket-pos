# Workflow Correcto --- Claude (Frontend) + Codex (Backend)

Basado en el plan de implementación del Panel Admin MiniMarket POS.

------------------------------------------------------------------------

## Principio clave

**API Contract First → Desarrollo en paralelo → Integración →
Validación**

Este workflow evita retrabajo y permite que ambas IAs trabajen
eficientemente.

Referencia del plan original: ADMIN-PANEL-PLAN.md

------------------------------------------------------------------------

# Fase 0 --- Preparación Común

Objetivo: una única fuente de verdad.

Definir:

-   Puertos
-   Rutas
-   Formato de respuestas
-   Códigos de error
-   Autenticación

Entregable:

-   Documento OpenAPI (aunque sea parcial)
-   Ejemplos JSON request/response
-   Códigos de error estándar

------------------------------------------------------------------------

# Fase 1 --- Contract First (Codex primero)

Codex define contratos antes de lógica completa.

Orden recomendado:

1.  Auth / permisos admin
2.  GET /api/dashboard/stats
3.  GET /api/sales
4.  GET /api/cash/sessions
5.  PUT /api/users/{id}
6.  PUT /api/config
7.  CORS configuración

Regla:

Frontend NO debe avanzar sin contratos.

------------------------------------------------------------------------

# Fase 2 --- Desarrollo Paralelo

## Claude (Frontend)

Trabaja con mocks tipados iguales al contrato.

Prioridades:

1.  Scaffold proyecto
2.  Layout + Auth guard
3.  Páginas completas
4.  Estados UX (loading, empty, error)
5.  Switch mocks → API real

## Codex (Backend)

Implementa:

1.  Happy path funcional
2.  Validaciones
3.  Paginación
4.  Permisos admin
5.  Optimización básica

------------------------------------------------------------------------

# Fase 3 --- Congelamiento de Contratos

Antes de cerrar frontend:

-   Campos finales
-   Tipos finales
-   Paginación final
-   Filtros finales

Cambios posteriores requieren:

-   Versionado o
-   Compatibilidad hacia atrás

------------------------------------------------------------------------

# Fase 4 --- Integración

Claude:

-   Reemplaza mocks por llamadas reales
-   Ajusta configuración axios
-   Scripts de arranque

Codex:

-   Verifica CORS
-   Ajusta start scripts
-   Testea endpoints reales

------------------------------------------------------------------------

# Fase 5 --- Verificación Operativa

Checklist:

1.  Frontend inicia correctamente
2.  Login admin funciona
3.  Roles bloqueados correctamente
4.  CRUD productos sincroniza con POS
5.  Ventas visibles en panel
6.  Reportes exportan correctamente
7.  Inventario actualizado

------------------------------------------------------------------------

# Prompts para Claude

Construye el frontend admin completo usando mocks tipados iguales al
contrato OpenAPI. Implementa Auth guard por rol admin, layout, páginas y
estados. Deja un switch para reemplazar mocks por API real sin modificar
componentes.

------------------------------------------------------------------------

# Prompts para Codex

Implementa primero contratos OpenAPI y respuestas consistentes para:

-   /api/dashboard/stats
-   /api/sales
-   /api/cash/sessions
-   PUT /api/users/{id}
-   PUT /api/config

Incluye ejemplos JSON, paginación, filtros y errores.

Luego implementa lógica mínima funcional.

------------------------------------------------------------------------

# Regla de Oro

Nunca frontend primero sin contrato. Nunca backend completo antes de
frontend.

Siempre:

Contrato → Paralelo → Integración.

------------------------------------------------------------------------

# Fin
