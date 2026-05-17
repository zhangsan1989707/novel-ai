'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Textarea } from '@/components/ui'
import { Bot, Loader2, Play, Zap, Brain, Feather, ChevronDown, ChevronUp, Cpu } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

interface AgentInfo {
  type: string
  name: string
  description: string
  modelTier: string
  supportsStreaming: boolean
}

interface ModelConfig {
  vendor: string
  modelId: string
  description: string
  costPerMillionInput: number
  costPerMillionOutput: number
}

interface AgentManagerProps {
  projectId?: number
}

const tierConfig: Record<string, { label: string; color: string; icon: typeof Brain }> = {
  opus: { label: 'OPUS', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Brain },
  sonnet: { label: 'SONNET', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Feather },
  haiku: { label: 'HAIKU', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Zap },
}

const agentIcons: Record<string, typeof Bot> = {
  PLANNER: Brain,
  WRITER: Feather,
  POLISHER: Zap,
  VALIDATOR: Cpu,
  SUMMARIZER: Bot,
  RESEARCHER: Bot,
  REVIEWER: Brain,
  DESLOPPER: Zap,
}

export function AgentManager({ projectId }: AgentManagerProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [models, setModels] = useState<Record<string, ModelConfig[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [inputJson, setInputJson] = useState('')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [showModels, setShowModels] = useState(false)
  const initializedRef = useRef(false)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      if (data.success) {
        setAgents(data.data?.agents || [])
        setModels(data.data?.models || {})
      }
    } catch {
      toast.error('加载 Agent 列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      loadAgents()
    }
  }, [loadAgents])

  const handleExecute = useCallback(async () => {
    if (!selectedAgent) return

    let parsedInput: unknown
    try {
      parsedInput = JSON.parse(inputJson)
    } catch {
      toast.error('输入参数必须是有效的 JSON')
      return
    }

    if (projectId && typeof parsedInput === 'object' && parsedInput !== null) {
      parsedInput = { ...parsedInput, projectId }
    }

    setExecuting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/agents/${selectedAgent.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: parsedInput, stream: selectedAgent.supportsStreaming }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data)
        toast.success(`${selectedAgent.name} 执行完成`)
      } else {
        toast.error(data.error?.message || '执行失败')
      }
    } catch {
      toast.error('执行请求失败')
    } finally {
      setExecuting(false)
    }
  }, [selectedAgent, inputJson, projectId])

  const handleSelectAgent = useCallback((agent: AgentInfo) => {
    setSelectedAgent(agent)
    setResult(null)
    setInputJson('')
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载 Agent 列表...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agent 管理面板
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModels(!showModels)}
            >
              <Cpu className="h-4 w-4 mr-1" />
              模型配置
              {showModels ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showModels && (
            <div className="mb-4 space-y-3 rounded-lg border border-border p-4 bg-muted/30">
              <h4 className="text-sm font-medium text-muted-foreground">可用模型配置</h4>
              {Object.entries(models).map(([tier, configs]) => {
                const cfg = tierConfig[tier]
                if (!cfg) return null
                return (
                  <div key={tier} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ml-2">
                      {configs.map((model) => (
                        <div key={`${model.vendor}-${model.modelId}`} className="rounded-md border border-border p-2 text-xs">
                          <div className="font-medium">{model.vendor} / {model.modelId}</div>
                          <div className="text-muted-foreground">{model.description}</div>
                          <div className="text-muted-foreground mt-1">
                            输入: ${model.costPerMillionInput}/M · 输出: ${model.costPerMillionOutput}/M
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {agents.map((agent) => {
              const Icon = agentIcons[agent.type] || Bot
              const tier = tierConfig[agent.modelTier]
              const isSelected = selectedAgent?.type === agent.type
              return (
                <Card
                  key={agent.type}
                  hover
                  className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                  onClick={() => handleSelectAgent(agent)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{agent.name}</span>
                      </div>
                      {tier && <Badge className={tier.color}>{tier.label}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{agent.type}</Badge>
                      {agent.supportsStreaming && (
                        <Badge variant="success" className="text-[10px]">流式</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedAgent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = agentIcons[selectedAgent.type] || Bot
                return <Icon className="h-5 w-5" />
              })()}
              执行 {selectedAgent.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border p-3 bg-muted/30">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">类型:</span>
                <Badge variant="outline">{selectedAgent.type}</Badge>
                <span className="text-muted-foreground">层级:</span>
                {tierConfig[selectedAgent.modelTier] && (
                  <Badge className={tierConfig[selectedAgent.modelTier].color}>
                    {tierConfig[selectedAgent.modelTier].label}
                  </Badge>
                )}
                <span className="text-muted-foreground">流式:</span>
                <Badge variant={selectedAgent.supportsStreaming ? 'success' : 'default'}>
                  {selectedAgent.supportsStreaming ? '支持' : '不支持'}
                </Badge>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">输入参数 (JSON)</label>
              <Textarea
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                placeholder='{"chapterNo": 1, "content": "..."}'
                rows={6}
                className="font-mono text-sm"
              />
              {projectId && (
                <p className="text-xs text-muted-foreground mt-1">
                  projectId={projectId} 将自动注入
                </p>
              )}
            </div>

            <Button
              onClick={handleExecute}
              disabled={executing || !inputJson.trim()}
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  执行
                </>
              )}
            </Button>

            {result !== null && (
              <div>
                <label className="block text-sm font-medium mb-1">执行结果</label>
                <pre className="rounded-md border border-border p-3 bg-muted/30 text-xs font-mono overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
