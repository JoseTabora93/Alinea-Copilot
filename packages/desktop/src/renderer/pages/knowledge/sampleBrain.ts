/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Placeholder "brain" content for the Knowledge (KB) prototype UI.
 *
 * This sample tree lets us build and demo the Obsidian-style browser before the
 * live backend is wired. The real data source will be **gbrain** (markdown brain
 * synced to Postgres, queried via MCP) — see docs/prds/alinea/fase2 (§6.5/§11).
 * Swap `getSampleBrain()` for a gbrain/`/api/fs` loader when the backend is ready;
 * the UI consumes the same `BrainNode` shape.
 */

export type BrainNode = {
  id: string;
  name: string;
  type: 'folder' | 'page';
  /** Markdown body — only for pages. */
  content?: string;
  children?: BrainNode[];
};

export const SAMPLE_BRAIN: BrainNode[] = [
  {
    id: 'normas',
    name: 'Normas (KB3)',
    type: 'folder',
    children: [
      {
        id: 'normas/hvac',
        name: 'HVAC — criterios',
        type: 'page',
        content: [
          '# HVAC — criterios de diseño',
          '',
          '> Fuente: KB3 (normas internas Ingelmec). _Solo lectura._',
          '',
          '## Cargas térmicas',
          '- Calcular cargas por ASHRAE; margen de seguridad **10%**.',
          '- Renovaciones de aire según uso del recinto.',
          '',
          '## Selección de equipos',
          '1. Verificar capacidad vs. carga pico.',
          '2. Redundancia **N+1** en salas críticas (data center).',
          '3. Registrar modelo y eficiencia (SEER/EER) en el BOM.',
        ].join('\n'),
      },
      {
        id: 'normas/electrico',
        name: 'Eléctrico — tableros',
        type: 'page',
        content: [
          '# Eléctrico — tableros',
          '',
          'Criterios de protección, selectividad y rotulado de tableros.',
          '',
          '- Coordinación de protecciones.',
          '- Etiquetado por circuito.',
          '- Memoria de cálculo adjunta al proyecto.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'plantillas',
    name: 'Plantillas',
    type: 'folder',
    children: [
      {
        id: 'plantillas/propuesta',
        name: 'Propuesta comercial',
        type: 'page',
        content: [
          '# Propuesta comercial — estructura',
          '',
          '1. Resumen ejecutivo',
          '2. Alcance',
          '3. BOM',
          '4. Cronograma',
          '5. Inversión',
          '6. Condiciones',
        ].join('\n'),
      },
      {
        id: 'plantillas/memoria',
        name: 'Memoria técnica',
        type: 'page',
        content: [
          '# Memoria técnica — estructura',
          '',
          '- Objeto y alcance',
          '- Bases de diseño',
          '- Cálculos',
          '- Especificaciones',
          '- Anexos',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'guias',
    name: 'Guías',
    type: 'folder',
    children: [
      {
        id: 'guias/onboarding',
        name: 'Onboarding',
        type: 'page',
        content: [
          '# Onboarding',
          '',
          'Cómo empezar en Alinea Copiloto:',
          '',
          '1. Elige un agente (Copilot, OpenClaw, Hermes).',
          '2. Trabaja dentro de un **proyecto**.',
          '3. Consulta esta base de conocimiento desde el chat.',
        ].join('\n'),
      },
    ],
  },
];

export function getSampleBrain(): BrainNode[] {
  return SAMPLE_BRAIN;
}
