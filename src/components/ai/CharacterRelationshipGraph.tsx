'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  Node,
  Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CharacterNode } from './CharacterNode'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface CharacterNodeData {
  name: string
  role: string
  firstChapter?: number | null
  personality?: string | null
  catchphrases?: string[]
}

interface CharacterRelationshipGraphProps {
  projectId: number
  className?: string
}

const nodeTypes = { character: CharacterNode }

export function CharacterRelationshipGraph({
  projectId,
  className,
}: CharacterRelationshipGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)
  const [fitView, setFitView] = useState(false)

  useEffect(() => {
    async function fetchGraphData() {
      try {
        const res = await fetch(`/api/novel/engine/${projectId}/character-graph`)
        const result = await res.json()
        if (result.success) {
          setNodes(result.data.nodes as Node[])
          setEdges(result.data.edges as Edge[])
          setFitView(true)
        }
      } catch (error) {
        console.error('获取人物关系图失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchGraphData()
  }, [projectId, setNodes, setEdges])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('点击角色:', (node.data as unknown as CharacterNodeData)?.name)
  }, [])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-[500px]', className)}>
        <div className="text-muted-foreground">加载人物关系图中...</div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-[500px]', className)}>
        <div className="text-center text-muted-foreground">
          <p>暂无角色数据</p>
          <p className="text-sm mt-2">请先生成章节内容，系统会自动提取角色信息</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full h-[600px] rounded-lg border bg-background', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView={fitView}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background />
        <Controls />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as unknown as CharacterNodeData
              switch (data?.role) {
                case 'PROTAGONIST': return '#3b82f6'
                case 'ANTAGONIST': return '#ef4444'
                case 'SUPPORTING': return '#22c55e'
                default: return '#9ca3af'
              }
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        )}

        <Panel position="top-right">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMinimap(!showMinimap)}
            >
              {showMinimap ? '隐藏' : '显示'}小地图
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFitView(true)}
            >
              重置视图
            </Button>
          </div>
        </Panel>

        <Panel position="bottom-left">
          <div className="bg-background/90 backdrop-blur-sm p-3 rounded-lg border text-xs space-y-2">
            <div className="font-medium mb-2">图例</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>主角</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>反派</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>配角</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span>次要</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}