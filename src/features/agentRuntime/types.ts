import type { ReactNode } from "react";

export type AgentUiBlockBase = {
  type: string;
  id?: string;
  title?: string;
};

export type AgentUiBlockRenderer<TBlock extends AgentUiBlockBase> = (block: TBlock) => ReactNode;

export type AgentUiBlockRegistry<TBlock extends AgentUiBlockBase> = {
  [K in TBlock["type"]]: AgentUiBlockRenderer<Extract<TBlock, { type: K }>>;
};

export function createAgentUiBlockRenderer<TBlock extends AgentUiBlockBase>(
  registry: AgentUiBlockRegistry<TBlock>,
) {
  return function renderAgentUiBlock(block: TBlock) {
    const render = registry[block.type as TBlock["type"]] as AgentUiBlockRenderer<TBlock> | undefined;
    if (!render) return null;
    return render(block);
  };
}
