import type { AgentDefinition, ModelTier } from './base'
import type { AgentType } from '@/lib/engine/types'

class AgentRegistryClass {
  private agents: Map<AgentType, AgentDefinition> = new Map()

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.type)) {
      console.warn(`Agent "${agent.type}" already registered, overwriting`)
    }
    this.agents.set(agent.type, agent)
  }

  unregister(type: AgentType): void {
    this.agents.delete(type)
  }

  get(type: AgentType): AgentDefinition | undefined {
    return this.agents.get(type)
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values())
  }

  getByModelTier(tier: ModelTier): AgentDefinition[] {
    return this.getAll().filter(agent => agent.modelTier === tier)
  }

  has(type: AgentType): boolean {
    return this.agents.has(type)
  }
}

export const agentRegistry = new AgentRegistryClass()
