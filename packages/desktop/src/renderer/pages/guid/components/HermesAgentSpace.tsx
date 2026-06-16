/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Components, Dashboard, Help, Tool } from '@icon-park/react';

/**
 * Hermes "agent space" — presentation only, mirroring OpenClawAgentSpace.
 *
 * The entries are NOT separate runtime agents; they're quick-start prompts for
 * talking to Hermes (the operations / improvement copilot). Hermes itself
 * connects as a remote (gateway) agent wired by the backend; until the gateway
 * is registered it may not respond yet. Picking an entry seeds the chat input
 * with a Hermes-focused starter prompt.
 *
 * Branding: Hermes · Copilot de operaciones. Entries in Spanish. No "Aion".
 */
interface HermesEntry {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 18;
const ICON_FILL = '#a6ad95';

const ENTRIES: HermesEntry[] = [
  {
    id: 'estado',
    name: 'Estado',
    description: 'Estado de agentes, skills y fallas recientes.',
    prompt: 'Hermes: dame el estado de los agentes y skills, y resalta las fallas o errores recientes.',
    icon: <Dashboard theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'mejorar',
    name: 'Mejorar',
    description: 'Revisa y propone mejoras a flujos y skills.',
    prompt: 'Hermes: revisa y propón mejoras (con su porqué) para el flujo o skill: ',
    icon: <Tool theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'orquestar',
    name: 'Orquestar',
    description: 'Coordina una tarea entre varios agentes.',
    prompt: 'Hermes: coordina una tarea entre los agentes disponibles para lograr: ',
    icon: <Components theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'explorar',
    name: 'Explorar',
    description: 'Qué puede hacer el sistema y cómo aprovecharlo.',
    prompt: 'Hermes: explícame qué puede hacer el sistema y sugiéreme cómo aprovecharlo para ',
    icon: <Help theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
];

interface HermesAgentSpaceProps {
  /** Seed the chat input with the entry's Hermes-focused starter prompt. */
  onPick: (prompt: string) => void;
}

const HermesAgentSpace: React.FC<HermesAgentSpaceProps> = ({ onPick }) => {
  return (
    <div className='w-full mb-24px'>
      <div className='flex items-center justify-center gap-8px mb-4px'>
        <span className='text-15px font-600 text-t-primary'>Hermes</span>
        <span className='text-12px text-t-tertiary'>· Copilot de operaciones</span>
      </div>
      <div className='text-center text-12px text-t-tertiary mb-12px'>
        Habla con Hermes para operar y mejorar el sistema
      </div>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-10px'>
        {ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type='button'
            data-testid={`hermes-entry-${entry.id}`}
            className='flex flex-col items-start gap-4px text-left p-12px rd-12px border border-solid border-border-2 bg-base hover:border-border-1 hover:bg-fill-1 transition-colors cursor-pointer'
            onClick={() => onPick(entry.prompt)}
          >
            <div className='flex items-center gap-8px'>
              <span className='size-28px flex items-center justify-center rd-8px bg-fill-1 shrink-0'>{entry.icon}</span>
              <span className='text-14px font-500 text-t-primary'>{entry.name}</span>
            </div>
            <span className='text-12px text-t-secondary leading-snug'>{entry.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HermesAgentSpace;
