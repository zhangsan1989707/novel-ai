import { NextRequest } from 'next/server'
import { tryCatch, success, error } from '@/lib/api-response'
import { agentRegistry } from '@/lib/agents/registry'
import '@/lib/agents/adapters'
import { AgentTypeEnum } from '@/lib/engine/types'
import type { AgentType } from '@/lib/engine/types'

const VALID_AGENT_TYPES: AgentType[] = Object.values(AgentTypeEnum)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentType: string }> }
) {
  return tryCatch(async () => {
    const { agentType } = await params

    if (!VALID_AGENT_TYPES.includes(agentType as AgentType)) {
      return error('NOT_FOUND', `Agent "${agentType}" 不存在`)
    }

    const agent = agentRegistry.get(agentType as AgentType)
    if (!agent) {
      return error('NOT_FOUND', `Agent "${agentType}" 未注册`)
    }

    return success({
      type: agent.type,
      name: agent.name,
      description: agent.description,
      modelTier: agent.modelTier,
      supportsStreaming: agent.supportsStreaming,
      hasValidation: typeof agent.validate === 'function',
    })
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentType: string }> }
) {
  return tryCatch(async () => {
    const { agentType } = await params

    if (!VALID_AGENT_TYPES.includes(agentType as AgentType)) {
      return error('NOT_FOUND', `Agent "${agentType}" 不存在`)
    }

    const agent = agentRegistry.get(agentType as AgentType)
    if (!agent) {
      return error('NOT_FOUND', `Agent "${agentType}" 未注册`)
    }

    const body = await request.json()
    const { input, stream } = body

    if (!input) {
      return error('VALIDATION_ERROR', '缺少 input 参数')
    }

    if (stream && agent.supportsStreaming && agent.executeStream) {
      const chunks: string[] = []
      const result = await agent.executeStream(input, (chunk) => {
        chunks.push(chunk)
      })
      return success({ result, streamed: true, chunkCount: chunks.length })
    }

    const result = await agent.execute(input)
    return success({ result, streamed: false })
  })
}
