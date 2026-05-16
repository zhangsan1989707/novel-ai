import { tryCatch, success } from '@/lib/api-response'
import { agentRegistry } from '@/lib/agents/registry'
import '@/lib/agents/adapters'
import { getAvailableModels } from '@/lib/agents/model-strategy'

export async function GET() {
  return tryCatch(async () => {
    const agents = agentRegistry.getAll().map(agent => ({
      type: agent.type,
      name: agent.name,
      description: agent.description,
      modelTier: agent.modelTier,
      supportsStreaming: agent.supportsStreaming,
    }))

    const models = getAvailableModels()

    return success({ agents, models })
  })
}
