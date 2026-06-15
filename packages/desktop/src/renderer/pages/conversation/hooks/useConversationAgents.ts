/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { DETECTED_AGENTS_SWR_KEY, fetchDetectedAgents } from '@/renderer/utils/model/agentTypes';
import type { AgentMetadata } from '@/renderer/utils/model/agentTypes';
import { isSupportedNewConversationAgent } from '@/renderer/utils/model/agentTypeSupportPolicy';
import { isAssistantHiddenByDefault } from '@/common/config/assistantCuration';
import { useShowHiddenAssistants } from '@/renderer/hooks/assistant/useShowHiddenAssistants';

export type UseConversationAgentsResult = {
  /** Detected execution engines (acp, extension, remote, aionrs, gemini, etc.) */
  cliAgents: AgentMetadata[];
  /** Preset assistants from `/api/assistants` — kept as-is, not re-shaped into agent form */
  presetAssistants: Assistant[];
  /** Loading state */
  isLoading: boolean;
  /** Refresh data */
  refresh: () => Promise<void>;
};

/**
 * Hook to fetch available CLI agents and preset assistants for the conversation tab dropdown.
 *
 * Two independent data sources:
 *   - Execution engines — from AgentRegistry via IPC (agents.detected)
 *   - Preset assistants — from backend `/api/assistants` (merged builtin + user)
 */
export const useConversationAgents = (): UseConversationAgentsResult => {
  const [showHiddenAssistants] = useShowHiddenAssistants();
  // Execution engines from AgentRegistry (shared cache with useDetectedAgents / useGuidAgentSelection)
  const {
    data: cliAgents,
    isLoading: isLoadingAgents,
    mutate,
  } = useSWR<AgentMetadata[]>(DETECTED_AGENTS_SWR_KEY, fetchDetectedAgents);

  // Preset assistants from the backend-maintained catalog
  const { data: presetAssistants, isLoading: isLoadingPresets } = useSWR('assistants.presets', async () => {
    try {
      const list = await ipcBridge.assistants.list.invoke();
      return list.filter((assistant) => assistant.enabled !== false);
    } catch (error) {
      console.error('Failed to load assistants for conversation selector:', error);
      return [] as Assistant[];
    }
  });

  const refresh = async () => {
    await mutate();
  };

  // Apply the same curation as the home selector: hide entertainment assistants
  // unless the admin opted to show them.
  const curatedPresets = (presetAssistants || []).filter(
    (assistant) => showHiddenAssistants || !isAssistantHiddenByDefault(assistant.id)
  );

  return {
    cliAgents: (cliAgents || []).filter(isSupportedNewConversationAgent),
    presetAssistants: curatedPresets,
    isLoading: isLoadingAgents || isLoadingPresets,
    refresh,
  };
};
