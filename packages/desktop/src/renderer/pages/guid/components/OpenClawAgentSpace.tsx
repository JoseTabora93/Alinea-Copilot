/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Components, Dashboard, Funds, Mail, ShoppingCart, Tool } from '@icon-park/react';

/**
 * OpenClaw "agent space" — presentation only.
 *
 * The six entries are NOT separate runtime agents; they're a quick-start grouping
 * of OpenClaw's skill areas. OpenClaw itself connects as a remote (gateway) agent
 * wired by the backend; until the gateway is registered it may not respond yet.
 * Picking a category seeds the chat input with an OpenClaw-focused starter prompt.
 *
 * Branding: OpenClaw / Copilot Claw. Categories in Spanish. No Hermes, no "Aion".
 */
interface OpenClawCategory {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 18;
const ICON_FILL = '#a6ad95';

const CATEGORIES: OpenClawCategory[] = [
  {
    id: 'gerencia',
    name: 'Gerencia',
    description: 'Reportes, KPIs y decisiones go/no-go.',
    prompt: 'OpenClaw, gerencia: genera un reporte ejecutivo con KPIs y una recomendación go/no-go para ',
    icon: <Dashboard theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'tecnica',
    name: 'Técnica',
    description: 'Fallas UPS/clima Liebert, historial, boletas y mantenimientos.',
    prompt: 'OpenClaw, soporte técnico: revisa fallas de UPS/clima (Liebert), historial, boletas y mantenimientos de ',
    icon: <Tool theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'ingenieria',
    name: 'Ingeniería',
    description: 'HVAC, eléctrico, fire, datos y data center: memoria, BOM y alcance.',
    prompt: 'OpenClaw, ingeniería MEP: arma memoria técnica, BOM y alcance (HVAC/eléctrico/fire/datos/DC) para ',
    icon: <Components theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'comercial',
    name: 'Comercial',
    description: 'Cotización/RFQ, propuestas, pipeline y CRM.',
    prompt: 'OpenClaw, comercial: prepara una cotización/RFQ y propuesta, y actualiza el pipeline/CRM para ',
    icon: <ShoppingCart theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Correo, Projects, actas, WorkDrive y onboarding.',
    prompt: 'OpenClaw, administración: gestiona correo, Projects, actas, WorkDrive y onboarding para ',
    icon: <Mail theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
  {
    id: 'financiera',
    name: 'Financiera',
    description: 'Books, márgenes/precios, cobranza, flujo y rentabilidad.',
    prompt: 'OpenClaw, finanzas: analiza Books, márgenes/precios, cobranza, flujo y rentabilidad de ',
    icon: <Funds theme='outline' size={ICON_SIZE} fill={ICON_FILL} />,
  },
];

interface OpenClawAgentSpaceProps {
  /** Seed the chat input with the category's OpenClaw-focused starter prompt. */
  onPick: (prompt: string) => void;
}

const OpenClawAgentSpace: React.FC<OpenClawAgentSpaceProps> = ({ onPick }) => {
  return (
    <div className='w-full mb-24px'>
      <div className='flex items-center justify-center gap-8px mb-4px'>
        <span className='text-15px font-600 text-t-primary'>OpenClaw</span>
        <span className='text-12px text-t-tertiary'>· Copilot Claw</span>
      </div>
      <div className='text-center text-12px text-t-tertiary mb-12px'>Elige un área para empezar con OpenClaw</div>
      <div className='grid grid-cols-2 md:grid-cols-3 gap-10px'>
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type='button'
            data-testid={`openclaw-category-${category.id}`}
            className='flex flex-col items-start gap-4px text-left p-12px rd-12px border border-solid border-border-2 bg-base hover:border-border-1 hover:bg-fill-1 transition-colors cursor-pointer'
            onClick={() => onPick(category.prompt)}
          >
            <div className='flex items-center gap-8px'>
              <span className='size-28px flex items-center justify-center rd-8px bg-fill-1 shrink-0'>
                {category.icon}
              </span>
              <span className='text-14px font-500 text-t-primary'>{category.name}</span>
            </div>
            <span className='text-12px text-t-secondary leading-snug'>{category.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OpenClawAgentSpace;
