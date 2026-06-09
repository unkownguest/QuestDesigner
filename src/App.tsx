import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  Download,
  Flag,
  Gift,
  GitBranch,
  MessageSquareText,
  Milestone,
  Play,
  Plus,
  Save,
  ScrollText,
  Square,
  Trash2,
  Upload,
  Variable,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type PixiModule = typeof import('pixi.js')
type PixiApplication = import('pixi.js').Application
type PixiContainer = import('pixi.js').Container

type QuestNodeKind =
  | 'start'
  | 'dialogue'
  | 'choice'
  | 'condition'
  | 'set_variable'
  | 'quest_event'
  | 'objective'
  | 'reward'
  | 'end'
type QuestEventType = 'start' | 'update' | 'complete' | 'fail'
type CompareMode = 'equals' | 'not_equals' | 'exists'
type InspectorTab = 'inspector' | 'validation' | 'preview' | 'script' | 'notes'
type NoteKind = 'note' | 'todo' | 'reference'

type QuestNodeData = {
  title: string
  body: string
  character?: string
  eventType?: QuestEventType
  reward?: string
  variableName?: string
  variableValue?: string
  comparison?: CompareMode
  compareValue?: string
  objective?: string
}

type QuestNode = Node<QuestNodeData, QuestNodeKind>
type QuestEdgeData = { label?: string }
type QuestEdge = Edge<QuestEdgeData>

type NoteBlock = {
  id: string
  kind: NoteKind
  title: string
  body: string
}

type QuestProject = {
  version: 2
  id: string
  title: string
  lastSavedAt?: string
  notes: NoteBlock[]
  nodes: QuestNode[]
  edges: QuestEdge[]
}

type ValidationIssue = {
  id: string
  nodeId?: string
  edgeId?: string
  severity: 'warning' | 'error'
  message: string
}

type PreviewState = {
  currentNodeId: string | null
  variables: Record<string, string>
  log: string[]
  path: string[]
  history: Array<{
    currentNodeId: string | null
    variables: Record<string, string>
    log: string[]
    path: string[]
    finished: boolean
  }>
  finished: boolean
}

const STORAGE_KEY = 'quest-designer-project'

const nodeMeta: Record<
  QuestNodeKind,
  {
    label: string
    description: string
    icon: typeof MessageSquareText
    accent: string
  }
> = {
  start: {
    label: 'Start',
    description: 'Graph entry',
    icon: Play,
    accent: '#58c77a',
  },
  dialogue: {
    label: 'NPC Line',
    description: 'Spoken by character',
    icon: MessageSquareText,
    accent: '#7dcfff',
  },
  choice: {
    label: 'Player Choice',
    description: 'Selectable response',
    icon: GitBranch,
    accent: '#c792ea',
  },
  condition: {
    label: 'Condition',
    description: 'Checks a variable',
    icon: Milestone,
    accent: '#e8b84d',
  },
  set_variable: {
    label: 'Set Variable',
    description: 'Updates a flag',
    icon: Variable,
    accent: '#89ddff',
  },
  quest_event: {
    label: 'Quest Update',
    description: 'Changes quest state',
    icon: Flag,
    accent: '#a3be8c',
  },
  objective: {
    label: 'Objective',
    description: 'Player task',
    icon: ClipboardList,
    accent: '#b6d67a',
  },
  reward: {
    label: 'Reward',
    description: 'XP, item, unlock, or currency',
    icon: Gift,
    accent: '#ffcb6b',
  },
  end: {
    label: 'End',
    description: 'Complete, fail, or exit',
    icon: Square,
    accent: '#f06a6a',
  },
}

const sampleNotes: NoteBlock[] = [
  {
    id: 'note-tone',
    kind: 'note',
    title: 'Mira tone',
    body: 'Practical, tired, protective of travelers. She should sound like she has seen the fog take people before.',
  },
  {
    id: 'note-branch',
    kind: 'todo',
    title: 'Branch follow-up',
    body: 'If the player refuses, add a later encounter where Mira comments on them staying behind.',
  },
]

const sampleNodes: QuestNode[] = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 0, y: 120 },
    data: { title: 'Start', body: 'Player speaks to Mira at the campfire.' },
  },
  {
    id: 'dialogue-1',
    type: 'dialogue',
    position: { x: 330, y: 80 },
    data: {
      title: 'Ranger Greeting',
      character: 'Mira',
      body: 'The old watchtower has gone quiet. If you can relight its beacon, the road will be safe again.',
    },
  },
  {
    id: 'choice-1',
    type: 'choice',
    position: { x: 670, y: 80 },
    data: {
      title: 'Accept the job?',
      body: 'Player chooses whether to help Mira.',
    },
  },
  {
    id: 'setvar-1',
    type: 'set_variable',
    position: { x: 1010, y: 0 },
    data: {
      title: 'Flag Accepted',
      body: 'Stores the player decision.',
      variableName: 'accepted_beacon_job',
      variableValue: 'true',
    },
  },
  {
    id: 'quest-1',
    type: 'quest_event',
    position: { x: 1340, y: 0 },
    data: {
      title: 'Start Quest',
      eventType: 'start',
      body: 'Quest started: Beacon in the Fog.',
    },
  },
  {
    id: 'objective-1',
    type: 'objective',
    position: { x: 1670, y: 0 },
    data: {
      title: 'Reach the Tower',
      objective: 'Reach the abandoned watchtower',
      body: 'Objective added to the quest log.',
    },
  },
  {
    id: 'condition-1',
    type: 'condition',
    position: { x: 2000, y: 0 },
    data: {
      title: 'Accepted Job?',
      body: 'Routes the quest based on accepted_beacon_job.',
      variableName: 'accepted_beacon_job',
      comparison: 'equals',
      compareValue: 'true',
    },
  },
  {
    id: 'reward-1',
    type: 'reward',
    position: { x: 2330, y: -60 },
    data: {
      title: 'Beacon Reward',
      reward: '120 XP, Ranger Charm, safe road unlocked',
      body: 'Shown when the beacon is relit.',
    },
  },
  {
    id: 'end-success',
    type: 'end',
    position: { x: 2660, y: -60 },
    data: {
      title: 'Quest Complete',
      eventType: 'complete',
      body: 'The road opens and Mira thanks the player.',
    },
  },
  {
    id: 'dialogue-2',
    type: 'dialogue',
    position: { x: 1010, y: 230 },
    data: {
      title: 'Decline Path',
      character: 'Mira',
      body: 'Then stay near the fire. The fog has a way of collecting the careless.',
    },
  },
  {
    id: 'end-decline',
    type: 'end',
    position: { x: 1340, y: 230 },
    data: {
      title: 'Conversation Ends',
      eventType: 'fail',
      body: 'The player leaves the quest unstarted.',
    },
  },
]

const sampleEdges: QuestEdge[] = [
  makeEdge('edge-start-dialogue', 'start-1', 'dialogue-1', 'Begin'),
  makeEdge('edge-dialogue-choice', 'dialogue-1', 'choice-1', 'Respond'),
  makeEdge('edge-choice-accept', 'choice-1', 'setvar-1', 'Accept'),
  makeEdge('edge-setvar-quest', 'setvar-1', 'quest-1', 'Next'),
  makeEdge('edge-quest-objective', 'quest-1', 'objective-1', 'Add objective'),
  makeEdge('edge-objective-condition', 'objective-1', 'condition-1', 'Check flag'),
  makeEdge('edge-condition-reward', 'condition-1', 'reward-1', 'True'),
  makeEdge('edge-reward-end', 'reward-1', 'end-success', 'Complete'),
  makeEdge('edge-choice-decline', 'choice-1', 'dialogue-2', 'Decline'),
  makeEdge('edge-decline-end', 'dialogue-2', 'end-decline', 'End'),
]

function makeEdge(id: string, source: string, target: string, label: string): QuestEdge {
  return {
    id,
    source,
    target,
    label,
    data: { label },
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

const buildSampleProject = (): QuestProject => ({
  version: 2,
  id: 'sample-beacon-quest',
  title: 'Beacon in the Fog',
  lastSavedAt: new Date().toISOString(),
  notes: sampleNotes,
  nodes: sampleNodes,
  edges: sampleEdges,
})

const buildBranchingDialogueTemplate = (): QuestProject => ({
  version: 2,
  id: 'template-branching-dialogue',
  title: 'Branching Dialogue Template',
  lastSavedAt: new Date().toISOString(),
  notes: [
    {
      id: 'note-branching-goal',
      kind: 'note',
      title: 'Scene intent',
      body: 'Use this template for a short NPC conversation with two player responses and separate endings.',
    },
  ],
  nodes: [
    createTemplateNode('start-template', 'start', 0, 80, 'Start', 'Conversation begins.'),
    createTemplateNode('npc-hook', 'dialogue', 330, 80, 'NPC Hook', 'I need a decision before sunset.', {
      character: 'Quest Giver',
    }),
    createTemplateNode('player-choice', 'choice', 660, 80, 'Player Response', 'Choose a supportive or skeptical response.'),
    createTemplateNode('support-end', 'end', 990, 0, 'Supportive Ending', 'NPC trusts the player.', {
      eventType: 'complete',
    }),
    createTemplateNode('skeptic-end', 'end', 990, 180, 'Skeptical Ending', 'NPC withholds details.', {
      eventType: 'fail',
    }),
  ],
  edges: [
    makeEdge('template-start-hook', 'start-template', 'npc-hook', 'Begin'),
    makeEdge('template-hook-choice', 'npc-hook', 'player-choice', 'Respond'),
    makeEdge('template-choice-support', 'player-choice', 'support-end', 'Support'),
    makeEdge('template-choice-skeptic', 'player-choice', 'skeptic-end', 'Question'),
  ],
})

const buildQuestChainTemplate = (): QuestProject => ({
  version: 2,
  id: 'template-quest-chain',
  title: 'Quest Chain Template',
  lastSavedAt: new Date().toISOString(),
  notes: [
    {
      id: 'note-quest-chain',
      kind: 'todo',
      title: 'Replace placeholders',
      body: 'Name the quest, set the objective, and define the completion reward.',
    },
  ],
  nodes: [
    createTemplateNode('chain-start', 'start', 0, 80, 'Start', 'Player receives a quest lead.'),
    createTemplateNode('chain-dialogue', 'dialogue', 330, 80, 'Quest Briefing', 'Here is what needs doing.', {
      character: 'Quest Giver',
    }),
    createTemplateNode('chain-quest', 'quest_event', 660, 80, 'Start Quest', 'Quest added to journal.', {
      eventType: 'start',
    }),
    createTemplateNode('chain-objective', 'objective', 990, 80, 'Main Objective', 'Complete the main task.', {
      objective: 'Complete the main task',
    }),
    createTemplateNode('chain-reward', 'reward', 1320, 80, 'Reward', 'Grant reward.', {
      reward: 'XP and item',
    }),
    createTemplateNode('chain-end', 'end', 1650, 80, 'Quest Complete', 'Quest closes successfully.', {
      eventType: 'complete',
    }),
  ],
  edges: [
    makeEdge('chain-start-dialogue', 'chain-start', 'chain-dialogue', 'Begin'),
    makeEdge('chain-dialogue-quest', 'chain-dialogue', 'chain-quest', 'Accept'),
    makeEdge('chain-quest-objective', 'chain-quest', 'chain-objective', 'Track'),
    makeEdge('chain-objective-reward', 'chain-objective', 'chain-reward', 'Complete'),
    makeEdge('chain-reward-end', 'chain-reward', 'chain-end', 'End'),
  ],
})

const buildRewardChoiceTemplate = (): QuestProject => ({
  version: 2,
  id: 'template-reward-choice',
  title: 'Reward Choice Template',
  lastSavedAt: new Date().toISOString(),
  notes: [
    {
      id: 'note-reward-choice',
      kind: 'reference',
      title: 'Design note',
      body: 'Use this when the final player choice changes the reward or future flag.',
    },
  ],
  nodes: [
    createTemplateNode('reward-start', 'start', 0, 100, 'Start', 'Reward scene begins.'),
    createTemplateNode('reward-choice', 'choice', 330, 100, 'Choose Reward', 'Player chooses mercy, gold, or reputation.'),
    createTemplateNode('reward-gold', 'reward', 660, 0, 'Gold Reward', 'Player receives currency.', {
      reward: '300 gold',
    }),
    createTemplateNode('reward-rep', 'set_variable', 660, 190, 'Reputation Reward', 'Player gains faction favor.', {
      variableName: 'ranger_favor',
      variableValue: 'true',
    }),
    createTemplateNode('reward-end-a', 'end', 990, 0, 'Gold Ending', 'Inventory reward granted.', {
      eventType: 'complete',
    }),
    createTemplateNode('reward-end-b', 'end', 990, 190, 'Favor Ending', 'Faction flag saved.', {
      eventType: 'complete',
    }),
  ],
  edges: [
    makeEdge('reward-start-choice', 'reward-start', 'reward-choice', 'Begin'),
    makeEdge('reward-choice-gold', 'reward-choice', 'reward-gold', 'Take gold'),
    makeEdge('reward-choice-rep', 'reward-choice', 'reward-rep', 'Ask favor'),
    makeEdge('reward-gold-end', 'reward-gold', 'reward-end-a', 'End'),
    makeEdge('reward-rep-end', 'reward-rep', 'reward-end-b', 'End'),
  ],
})

function createTemplateNode(
  id: string,
  type: QuestNodeKind,
  x: number,
  y: number,
  title: string,
  body: string,
  data: Partial<QuestNodeData> = {},
): QuestNode {
  return {
    id,
    type,
    position: { x, y },
    data: { title, body, ...data },
  }
}

const nodeTypes = {
  start: QuestFlowNode,
  dialogue: QuestFlowNode,
  choice: QuestFlowNode,
  condition: QuestFlowNode,
  set_variable: QuestFlowNode,
  quest_event: QuestFlowNode,
  objective: QuestFlowNode,
  reward: QuestFlowNode,
  end: QuestFlowNode,
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<QuestNode, QuestEdge> | null>(null)
  const [initialProject] = useState(readStoredProject)
  const [projectId, setProjectId] = useState(initialProject.id)
  const [projectTitle, setProjectTitle] = useState(initialProject.title)
  const [notes, setNotes] = useState<NoteBlock[]>(initialProject.notes)
  const [nodes, setNodes] = useState<QuestNode[]>(initialProject.nodes)
  const [edges, setEdges] = useState<QuestEdge[]>(initialProject.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialProject.nodes[0]?.id ?? null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('Loaded')
  const [rightTab, setRightTab] = useState<InspectorTab>('inspector')
  const [preview, setPreview] = useState<PreviewState>(() => createPreview(nodes))
  const [stageOpen, setStageOpen] = useState(false)

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null
  const validationIssues = useMemo(() => validateGraph(nodes, edges), [nodes, edges])
  const blockingIssueCount = validationIssues.filter((issue) => issue.severity === 'error').length
  const project = useMemo<QuestProject>(
    () => ({
      version: 2,
      id: projectId,
      title: projectTitle,
      lastSavedAt: new Date().toISOString(),
      notes,
      nodes,
      edges,
    }),
    [edges, nodes, notes, projectId, projectTitle],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
      setStatusText('Autosaved')
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [project])

  const onNodesChange: OnNodesChange<QuestNode> = useCallback((changes) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
    setStatusText('Unsaved changes')
  }, [])

  const onEdgesChange: OnEdgesChange<QuestEdge> = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges))
    setStatusText('Unsaved changes')
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) =>
      addEdge(
        makeEdge(
          `edge-${connection.source}-${connection.target}-${crypto.randomUUID()}`,
          connection.source ?? '',
          connection.target ?? '',
          'Next',
        ),
        currentEdges,
      ),
    )
    setStatusText('Connection added')
  }, [])

  const handleSelectionChange = useCallback(
    (selection: OnSelectionChangeParams) => {
      const nextNode = selection.nodes[0] as QuestNode | undefined
      const nextEdge = selection.edges[0] as QuestEdge | undefined
      setSelectedNodeId(nextNode?.id ?? null)
      setSelectedEdgeId(nextNode ? null : nextEdge?.id ?? null)
    },
    [setSelectedEdgeId, setSelectedNodeId],
  )

  const addQuestNode = (type: QuestNodeKind) => {
    const position = reactFlowInstance.current?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }) ?? { x: 240 + nodes.length * 24, y: 140 + nodes.length * 20 }
    const nextNode = createNode(type, position)
    setNodes((currentNodes) => [...currentNodes, nextNode])
    setSelectedNodeId(nextNode.id)
    setSelectedEdgeId(null)
    setRightTab('inspector')
    setStatusText(`${nodeMeta[type].label} added`)
  }

  const addLinkedNode = (type: QuestNodeKind) => {
    if (!selectedNode) {
      addQuestNode(type)
      return
    }

    const nextNode = createNode(type, {
      x: selectedNode.position.x + 330,
      y: selectedNode.position.y,
    })
    setNodes((currentNodes) => [...currentNodes, nextNode])
    setEdges((currentEdges) => [
      ...currentEdges,
      makeEdge(`edge-${selectedNode.id}-${nextNode.id}`, selectedNode.id, nextNode.id, 'Next'),
    ])
    setSelectedNodeId(nextNode.id)
    setSelectedEdgeId(null)
    setStatusText(`${nodeMeta[type].label} linked`)
  }

  const duplicateNode = () => {
    if (!selectedNode) {
      return
    }
    const copy = {
      ...selectedNode,
      id: `${selectedNode.type}-${crypto.randomUUID()}`,
      position: {
        x: selectedNode.position.x + 40,
        y: selectedNode.position.y + 40,
      },
      selected: false,
      data: { ...selectedNode.data, title: `${selectedNode.data.title} Copy` },
    }
    setNodes((currentNodes) => [...currentNodes, copy])
    setSelectedNodeId(copy.id)
    setStatusText('Node duplicated')
  }

  const setAsStart = () => {
    if (!selectedNode) {
      return
    }
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNode.id
          ? { ...node, type: 'start', data: { ...node.data, title: 'Start' } }
          : node.type === 'start'
            ? { ...node, type: 'dialogue', data: { ...node.data, title: node.data.title || 'NPC Line' } }
            : node,
      ),
    )
    setStatusText('Start node set')
  }

  const labelConditionBranches = () => {
    if (!selectedNode || selectedNode.type !== 'condition') {
      return
    }

    let index = 0
    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        if (edge.source !== selectedNode.id) {
          return edge
        }
        const label = index === 0 ? 'True' : index === 1 ? 'False' : `Fallback ${index - 1}`
        index += 1
        return { ...edge, label, data: { ...edge.data, label } }
      }),
    )
    setStatusText('Condition branches labeled')
  }

  const updateSelectedNode = (data: Partial<QuestNodeData>) => {
    if (!selectedNodeId) {
      return
    }
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    )
    setStatusText('Unsaved changes')
  }

  const updateSelectedEdge = (label: string) => {
    if (!selectedEdgeId) {
      return
    }
    setEdges((currentEdges) =>
      currentEdges.map((edge) =>
        edge.id === selectedEdgeId ? { ...edge, label, data: { ...edge.data, label } } : edge,
      ),
    )
    setStatusText('Unsaved changes')
  }

  const deleteSelection = () => {
    if (selectedNodeId) {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNodeId))
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
      )
      setSelectedNodeId(null)
      setStatusText('Node deleted')
      return
    }

    if (selectedEdgeId) {
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdgeId))
      setSelectedEdgeId(null)
      setStatusText('Connection deleted')
    }
  }

  const saveProject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    setStatusText('Saved just now')
  }

  const newProject = () => {
    if (nodes.length > 0 && !window.confirm('Start a new graph? Your current graph is autosaved.')) {
      return
    }

    const firstNode = createNode('start', { x: 120, y: 120 })
    setProjectId(crypto.randomUUID())
    setProjectTitle('Untitled Quest Graph')
    setNotes([])
    setNodes([firstNode])
    setEdges([])
    setSelectedNodeId(firstNode.id)
    setSelectedEdgeId(null)
    setPreview(createPreview([firstNode]))
    setStatusText('New graph created')
  }

  const loadSample = () => {
    if (nodes.length > 0 && !window.confirm('Load the sample quest? Your current graph is autosaved.')) {
      return
    }

    const nextProject = buildSampleProject()
    setProjectId(nextProject.id)
    setProjectTitle(nextProject.title)
    setNotes(nextProject.notes)
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setPreview(createPreview(nextProject.nodes))
    setStatusText('Sample quest loaded')
  }

  const loadTemplate = (buildTemplate: () => QuestProject) => {
    if (nodes.length > 0 && !window.confirm('Load this template? Your current graph is autosaved.')) {
      return
    }

    const nextProject = buildTemplate()
    setProjectId(nextProject.id)
    setProjectTitle(nextProject.title)
    setNotes(nextProject.notes)
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setPreview(createPreview(nextProject.nodes))
    setStatusText('Template loaded')
  }

  const exportJson = async (payload: unknown, fileName: string, successMessage: string) => {
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)

    try {
      await navigator.clipboard.writeText(json)
      setStatusText(`${successMessage} and copied`)
    } catch {
      setStatusText(successMessage)
    }
  }

  const exportProject = () => {
    const safeTitle = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'quest-graph'
    void exportJson(project, `${safeTitle}.json`, 'Graph exported')
  }

  const exportScript = () => {
    const safeTitle = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'quest-script'
    void exportJson(buildScriptExport(project), `${safeTitle}-script.json`, 'Script exported')
  }

  const importProject = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<QuestProject>
      const nextProject = migrateProject(parsed)
      setProjectId(nextProject.id)
      setProjectTitle(nextProject.title)
      setNotes(nextProject.notes)
      setNodes(nextProject.nodes)
      setEdges(nextProject.edges)
      setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
      setSelectedEdgeId(null)
      setPreview(createPreview(nextProject.nodes))
      setStatusText(`Imported ${file.name}`)
    } catch {
      setStatusText('Import failed: expected QuestProject JSON')
    }
  }

  const addNote = (kind: NoteKind = 'note') => {
    const nextNote = {
      id: `note-${crypto.randomUUID()}`,
      kind,
      title: kind === 'todo' ? 'New task' : kind === 'reference' ? 'Reference' : 'New note',
      body: '',
    }
    setNotes((currentNotes) => [...currentNotes, nextNote])
    setRightTab('notes')
    setStatusText('Note added')
  }

  const updateNote = (id: string, data: Partial<NoteBlock>) => {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === id ? { ...note, ...data } : note)),
    )
    setStatusText('Unsaved changes')
  }

  const deleteNote = (id: string) => {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
    setStatusText('Note deleted')
  }

  const resetPreview = () => {
    setPreview(createPreview(nodes))
    setRightTab('preview')
  }

  const playFromSelected = () => {
    if (!selectedNode) {
      resetPreview()
      return
    }

    setPreview(createPreview(nodes, selectedNode.id))
    setRightTab('preview')
    setStatusText(`Playing from ${selectedNode.data.title}`)
  }

  const openStage = () => {
    if (!preview.currentNodeId) {
      setPreview(createPreview(nodes, selectedNode?.id))
    }
    setRightTab('preview')
    setStageOpen(true)
  }

  const stepBackPreview = () => {
    setPreview((current) => {
      const previous = current.history.at(-1)
      if (!previous) {
        return current
      }
      return {
        ...previous,
        history: current.history.slice(0, -1),
      }
    })
  }

  const choosePreviewEdge = (edge: QuestEdge) => {
    setPreview((current) =>
      advancePreview(edge.target, nodes, edges, current.variables, current.log, current.path, current),
    )
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'
      const mod = event.ctrlKey || event.metaKey

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
        setStatusText('Saved just now')
      }

      if (mod && event.key.toLowerCase() === 'd' && !isEditing) {
        event.preventDefault()
        if (selectedNode) {
          const copy = {
            ...selectedNode,
            id: `${selectedNode.type}-${crypto.randomUUID()}`,
            position: {
              x: selectedNode.position.x + 40,
              y: selectedNode.position.y + 40,
            },
            selected: false,
            data: { ...selectedNode.data, title: `${selectedNode.data.title} Copy` },
          }
          setNodes((currentNodes) => [...currentNodes, copy])
          setSelectedNodeId(copy.id)
          setStatusText('Node duplicated')
        }
      }

      if (mod && event.key === 'Enter' && !isEditing) {
        event.preventDefault()
        setPreview(createPreview(nodes))
        setRightTab('preview')
      }

      if (!isEditing && event.key === 'Escape') {
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodes, project, selectedNode])

  const currentPreviewNode = nodes.find((node) => node.id === preview.currentNodeId) ?? null
  const previewChoices = currentPreviewNode
    ? edges.filter((edge) => edge.source === currentPreviewNode.id)
    : []
  const displayedNodes = useMemo<QuestNode[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        className: [
          node.className,
          preview.currentNodeId === node.id ? 'is-preview-current' : '',
          preview.path.includes(node.id) ? 'is-preview-path' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      })),
    [nodes, preview.currentNodeId, preview.path],
  )

  return (
    <ReactFlowProvider>
      <main className="quest-app">
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark">
              <ScrollText size={20} aria-hidden="true" />
            </span>
            <div>
              <span className="brand__label">Narrative Forge</span>
              <input
                aria-label="Project title"
                className="title-input"
                value={projectTitle}
                onChange={(event) => {
                  setProjectTitle(event.target.value)
                  setStatusText('Unsaved changes')
                }}
              />
            </div>
          </div>
          <div className="topbar__actions" aria-label="Project actions">
            <button type="button" onClick={newProject}>
              <Plus size={16} aria-hidden="true" />
              New
            </button>
            <button type="button" onClick={saveProject}>
              <Save size={16} aria-hidden="true" />
              Save
            </button>
            <button type="button" onClick={loadSample}>
              <ScrollText size={16} aria-hidden="true" />
              Sample
            </button>
            <button type="button" onClick={() => loadTemplate(buildBranchingDialogueTemplate)}>
              Branch
            </button>
            <button type="button" onClick={() => loadTemplate(buildQuestChainTemplate)}>
              Quest
            </button>
            <button type="button" onClick={() => loadTemplate(buildRewardChoiceTemplate)}>
              Reward
            </button>
            <button type="button" onClick={openStage}>
              <Play size={16} aria-hidden="true" />
              Stage
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              Import
            </button>
            <button type="button" className="button-primary" onClick={exportProject}>
              <Download size={16} aria-hidden="true" />
              Graph JSON
            </button>
            <button type="button" onClick={exportScript}>
              <Download size={16} aria-hidden="true" />
              Script JSON
            </button>
          </div>
          <span className="save-status" aria-live="polite">
            {statusText}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void importProject(file)
              }
              event.target.value = ''
            }}
          />
        </header>

        <section className="workspace">
          <aside className="palette" aria-label="Add nodes">
            <div className="panel-heading">
              <span>Node Palette</span>
            </div>
            <div className="palette__list">
              {(Object.keys(nodeMeta) as QuestNodeKind[]).map((type) => {
                const meta = nodeMeta[type]
                const Icon = meta.icon
                return (
                  <button
                    key={type}
                    type="button"
                    className="palette-button"
                    onClick={() => addQuestNode(type)}
                    style={{ '--node-accent': meta.accent } as React.CSSProperties}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>
                      <strong>{meta.label}</strong>
                      <small>{meta.description}</small>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="quick-actions">
              <div className="panel-heading">
                <span>Quick Add</span>
              </div>
              <button type="button" onClick={() => addLinkedNode('choice')} disabled={!selectedNode}>
                Add Choice
              </button>
              <button type="button" onClick={() => addLinkedNode('quest_event')} disabled={!selectedNode}>
                Add Quest Update
              </button>
              <button type="button" onClick={() => addLinkedNode('reward')} disabled={!selectedNode}>
                Add Reward
              </button>
              <button type="button" onClick={() => addLinkedNode('end')} disabled={!selectedNode}>
                Add End
              </button>
            </div>
          </aside>

          <section className="canvas-shell" aria-label="Dialogue graph canvas">
            <ReactFlow
              nodes={displayedNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                reactFlowInstance.current = instance
                instance.fitView({ padding: 0.18 })
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={handleSelectionChange}
              fitView
              minZoom={0.18}
              maxZoom={1.6}
              deleteKeyCode={['Backspace', 'Delete']}
              snapToGrid
              snapGrid={[16, 16]}
            >
              <Background color="#343a46" gap={24} size={1} variant={BackgroundVariant.Dots} />
              <Controls position="bottom-left" />
              <MiniMap
                nodeColor={(node) => nodeMeta[node.type as QuestNodeKind]?.accent ?? '#6cb6ff'}
                maskColor="rgba(17, 19, 24, 0.72)"
                pannable
                zoomable
              />
            </ReactFlow>
          </section>

          <aside className="right-panel" aria-label="Right panel">
            <div className="tabs" role="tablist" aria-label="Editor panels">
              {(['inspector', 'validation', 'preview', 'script', 'notes'] as InspectorTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={rightTab === tab ? 'is-active' : ''}
                  onClick={() => {
                    setRightTab(tab)
                    if (tab === 'preview' && !preview.currentNodeId) {
                      resetPreview()
                    }
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {rightTab === 'inspector' && (
              <InspectorPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                onDelete={deleteSelection}
                onDuplicate={duplicateNode}
                onSetAsStart={setAsStart}
                onLabelConditionBranches={labelConditionBranches}
                onPlayFromSelected={playFromSelected}
                onNodeChange={updateSelectedNode}
                onEdgeChange={updateSelectedEdge}
              />
            )}

            {rightTab === 'validation' && (
              <ValidationPanel
                issues={validationIssues}
                blockingIssueCount={blockingIssueCount}
                onSelectNode={(nodeId) => {
                  setSelectedNodeId(nodeId)
                  setSelectedEdgeId(null)
                  setRightTab('inspector')
                }}
              />
            )}

            {rightTab === 'preview' && (
              <PreviewPanel
                node={currentPreviewNode}
                choices={previewChoices}
                preview={preview}
                onReset={resetPreview}
                onBack={stepBackPreview}
                onPlayFromSelected={playFromSelected}
                onOpenStage={openStage}
                onChoose={choosePreviewEdge}
              />
            )}

            {rightTab === 'notes' && (
              <NotesPanel notes={notes} onAdd={addNote} onChange={updateNote} onDelete={deleteNote} />
            )}

            {rightTab === 'script' && <ScriptPanel nodes={nodes} edges={edges} />}
          </aside>
        </section>

        {stageOpen && (
          <StageOverlay
            node={currentPreviewNode}
            choices={previewChoices}
            preview={preview}
            nodes={nodes}
            onClose={() => setStageOpen(false)}
            onBack={stepBackPreview}
            onReset={resetPreview}
            onChoose={choosePreviewEdge}
          />
        )}
      </main>
    </ReactFlowProvider>
  )
}

function QuestFlowNode({ data, type, selected }: NodeProps<QuestNode>) {
  const kind = type as QuestNodeKind
  const meta = nodeMeta[kind]
  const Icon = meta.icon
  const statusClass = data.body?.trim() ? 'valid' : 'warning'

  return (
    <div
      className={`quest-node quest-node--${kind} ${selected ? 'is-selected' : ''}`}
      style={{ '--node-accent': meta.accent } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="quest-node__header">
        <span className="quest-node__icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        <div>
          <span className="quest-node__type">{meta.label}</span>
          <h3>{data.title}</h3>
        </div>
        <span className={`quest-node__status quest-node__status--${statusClass}`} />
      </div>
      <p>{data.body || 'Missing content'}</p>
      {data.character && <span className="quest-node__tag">Speaker: {data.character}</span>}
      {data.variableName && <span className="quest-node__tag">Variable: {data.variableName}</span>}
      {kind === 'condition' && (
        <span className="quest-node__tag">
          Branches: True / False
        </span>
      )}
      {data.eventType && <span className="quest-node__tag">State: {data.eventType}</span>}
      {data.objective && <span className="quest-node__tag">Objective: {data.objective}</span>}
      {data.reward && <span className="quest-node__tag">Reward: {data.reward}</span>}
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
}

function InspectorPanel({
  selectedNode,
  selectedEdge,
  onDelete,
  onDuplicate,
  onSetAsStart,
  onLabelConditionBranches,
  onPlayFromSelected,
  onNodeChange,
  onEdgeChange,
}: {
  selectedNode: QuestNode | null
  selectedEdge: QuestEdge | null
  onDelete: () => void
  onDuplicate: () => void
  onSetAsStart: () => void
  onLabelConditionBranches: () => void
  onPlayFromSelected: () => void
  onNodeChange: (data: Partial<QuestNodeData>) => void
  onEdgeChange: (label: string) => void
}) {
  return (
    <div className="panel-body">
      <div className="panel-heading">
        <span>Inspector</span>
        <button
          type="button"
          className="icon-button"
          onClick={onDelete}
          disabled={!selectedNode && !selectedEdge}
          aria-label="Delete selected item"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {selectedNode ? (
        <>
          <NodeInspector node={selectedNode} onChange={onNodeChange} />
          <div className="button-row">
            <button type="button" onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" onClick={onSetAsStart} disabled={selectedNode.type === 'start'}>
              Set as Start
            </button>
            <button type="button" onClick={onPlayFromSelected}>
              Play From Here
            </button>
            {selectedNode.type === 'condition' && (
              <button type="button" onClick={onLabelConditionBranches}>
                Label True/False
              </button>
            )}
          </div>
        </>
      ) : selectedEdge ? (
        <EdgeInspector edge={selectedEdge} onChange={onEdgeChange} />
      ) : (
        <div className="empty-state">
          <h2>Select a node</h2>
          <p>Edit content, labels, variables, objectives, and rewards here.</p>
        </div>
      )}
    </div>
  )
}

function NodeInspector({
  node,
  onChange,
}: {
  node: QuestNode
  onChange: (data: Partial<QuestNodeData>) => void
}) {
  const kind = node.type as QuestNodeKind
  const meta = nodeMeta[kind]
  const Icon = meta.icon

  return (
    <div className="inspector-form">
      <div className="inspector-card" style={{ '--node-accent': meta.accent } as React.CSSProperties}>
        <Icon size={18} aria-hidden="true" />
        <div>
          <strong>{meta.label}</strong>
          <span>{meta.description}</span>
        </div>
      </div>

      <label>
        Title
        <input value={node.data.title} onChange={(event) => onChange({ title: event.target.value })} />
      </label>

      <label>
        Body
        <textarea
          value={node.data.body}
          onChange={(event) => onChange({ body: event.target.value })}
          rows={5}
        />
      </label>

      {kind === 'dialogue' && (
        <label>
          Speaker
          <input
            value={node.data.character ?? ''}
            onChange={(event) => onChange({ character: event.target.value })}
          />
        </label>
      )}

      {kind === 'quest_event' || kind === 'end' ? (
        <label>
          Quest State
          <select
            value={node.data.eventType ?? 'update'}
            onChange={(event) => onChange({ eventType: event.target.value as QuestEventType })}
          >
            <option value="start">Start</option>
            <option value="update">Update</option>
            <option value="complete">Complete</option>
            <option value="fail">Fail</option>
          </select>
        </label>
      ) : null}

      {kind === 'condition' && (
        <>
          <label>
            Variable
            <input
              value={node.data.variableName ?? ''}
              onChange={(event) => onChange({ variableName: event.target.value })}
            />
          </label>
          <label>
            Comparison
            <select
              value={node.data.comparison ?? 'equals'}
              onChange={(event) => onChange({ comparison: event.target.value as CompareMode })}
            >
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="exists">exists</option>
            </select>
          </label>
          <label>
            Value
            <input
              value={node.data.compareValue ?? ''}
              onChange={(event) => onChange({ compareValue: event.target.value })}
            />
          </label>
        </>
      )}

      {kind === 'set_variable' && (
        <>
          <label>
            Variable
            <input
              value={node.data.variableName ?? ''}
              onChange={(event) => onChange({ variableName: event.target.value })}
            />
          </label>
          <label>
            Value
            <input
              value={node.data.variableValue ?? ''}
              onChange={(event) => onChange({ variableValue: event.target.value })}
            />
          </label>
        </>
      )}

      {kind === 'objective' && (
        <label>
          Objective
          <input
            value={node.data.objective ?? ''}
            onChange={(event) => onChange({ objective: event.target.value })}
          />
        </label>
      )}

      {kind === 'reward' && (
        <label>
          Reward
          <input value={node.data.reward ?? ''} onChange={(event) => onChange({ reward: event.target.value })} />
        </label>
      )}
    </div>
  )
}

function EdgeInspector({ edge, onChange }: { edge: QuestEdge; onChange: (label: string) => void }) {
  return (
    <div className="inspector-form">
      <div className="inspector-card inspector-card--edge">
        <GitBranch size={18} aria-hidden="true" />
        <div>
          <strong>Connection</strong>
          <span>
            {edge.source} to {edge.target}
          </span>
        </div>
      </div>
      <label>
        Label
        <input value={edge.data?.label ?? edge.label?.toString() ?? ''} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  )
}

function ScriptPanel({ nodes, edges }: { nodes: QuestNode[]; edges: QuestEdge[] }) {
  const start = nodes.find((node) => node.type === 'start')
  const orderedNodes = start
    ? [...getReachableNodes(start.id, edges)]
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is QuestNode => Boolean(node))
    : nodes

  return (
    <div className="panel-body">
      <div className="panel-heading">
        <span>Script</span>
      </div>
      <div className="script-list">
        {orderedNodes.map((node) => {
          const outgoing = edges.filter((edge) => edge.source === node.id)
          return (
            <article key={node.id} className="script-line">
              <span>{nodeMeta[node.type as QuestNodeKind].label}</span>
              <h2>{node.data.character || node.data.title}</h2>
              <p>{scriptBodyForNode(node)}</p>
              {outgoing.length > 0 && (
                <div className="script-branches">
                  {outgoing.map((edge) => (
                    <strong key={edge.id}>{edge.data?.label ?? edge.label ?? 'Next'}</strong>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function scriptBodyForNode(node: QuestNode): string {
  if (node.type === 'objective') {
    return node.data.objective || node.data.body
  }
  if (node.type === 'reward') {
    return node.data.reward || node.data.body
  }
  if (node.type === 'set_variable') {
    return `${node.data.variableName || 'variable'} = ${node.data.variableValue || 'value'}`
  }
  if (node.type === 'condition') {
    return `${node.data.variableName || 'variable'} ${node.data.comparison || 'equals'} ${
      node.data.compareValue || 'value'
    }`
  }
  return node.data.body
}

function buildScriptExport(project: QuestProject) {
  const start = project.nodes.find((node) => node.type === 'start')
  const orderedNodes = start
    ? [...getReachableNodes(start.id, project.edges)]
        .map((id) => project.nodes.find((node) => node.id === id))
        .filter((node): node is QuestNode => Boolean(node))
    : project.nodes

  return {
    title: project.title,
    exportedAt: new Date().toISOString(),
    notes: project.notes,
    script: orderedNodes.map((node) => ({
      id: node.id,
      type: node.type,
      title: node.data.title,
      speaker: node.data.character,
      text: scriptBodyForNode(node),
      choices: project.edges
        .filter((edge) => edge.source === node.id)
        .map((edge) => ({
          label: edge.data?.label ?? edge.label ?? 'Next',
          target: edge.target,
        })),
    })),
  }
}

function ValidationPanel({
  issues,
  blockingIssueCount,
  onSelectNode,
}: {
  issues: ValidationIssue[]
  blockingIssueCount: number
  onSelectNode: (nodeId: string) => void
}) {
  return (
    <div className="panel-body">
      <div className="panel-heading">
        <span>Validation</span>
        {blockingIssueCount ? <XCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
      </div>
      <p className={`validation-summary ${blockingIssueCount ? 'has-errors' : ''}`}>
        {issues.length === 0 ? 'Ready to play and export' : `${issues.length} issue${issues.length === 1 ? '' : 's'} found`}
      </p>
      <div className="issue-list">
        {issues.length === 0 ? (
          <span className="issue-empty">No blocking issues</span>
        ) : (
          issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              className={`issue issue--${issue.severity}`}
              onClick={() => issue.nodeId && onSelectNode(issue.nodeId)}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              {issue.message}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function PreviewPanel({
  node,
  choices,
  preview,
  onReset,
  onBack,
  onPlayFromSelected,
  onOpenStage,
  onChoose,
}: {
  node: QuestNode | null
  choices: QuestEdge[]
  preview: PreviewState
  onReset: () => void
  onBack: () => void
  onPlayFromSelected: () => void
  onOpenStage: () => void
  onChoose: (edge: QuestEdge) => void
}) {
  const meta = node ? nodeMeta[node.type as QuestNodeKind] : null
  const isChoice = node?.type === 'choice'
  const canContinue = node && !preview.finished && choices.length > 0 && !isChoice

  return (
    <div className="panel-body">
      <div className="panel-heading">
        <span>Playtest</span>
        <div className="header-actions">
          <button type="button" onClick={onBack} disabled={preview.history.length === 0}>
            Back
          </button>
          <button type="button" onClick={onPlayFromSelected}>
            From Selected
          </button>
          <button type="button" onClick={onOpenStage}>
            Open Stage
          </button>
          <button type="button" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
      <div className="play-stage">
        <div className={`play-scene play-scene--${node?.type ?? 'empty'}`}>
          <div className={`actor actor--npc ${node?.type === 'dialogue' ? 'is-speaking' : ''}`} />
          <div className={`actor actor--player ${node?.type === 'choice' ? 'is-speaking' : ''}`} />
        </div>
        {node ? (
          <div className="dialogue-box">
            <span>{meta?.label}</span>
            <h2>{node.data.character || node.data.title}</h2>
            <p>{node.data.body}</p>
            {node.data.eventType && <strong>Quest state: {node.data.eventType}</strong>}
            {node.type === 'reward' && <strong>{node.data.reward}</strong>}
            {node.type === 'objective' && <strong>{node.data.objective}</strong>}
          </div>
        ) : (
          <div className="dialogue-box">
            <span>Preview</span>
            <h2>No Start node</h2>
            <p>Add a Start node to play the tree.</p>
          </div>
        )}
      </div>

      <div className="preview-actions">
        {preview.finished && <span className="issue-empty">Playback ended</span>}
        {isChoice &&
          choices.map((edge) => (
            <button key={edge.id} type="button" onClick={() => onChoose(edge)}>
              {edge.data?.label ?? edge.label ?? 'Choose'}
            </button>
          ))}
        {canContinue && (
          <button type="button" className="button-primary" onClick={() => onChoose(choices[0])}>
            Continue
          </button>
        )}
      </div>

      <div className="state-grid">
        <div>
          <strong>Variables</strong>
          {Object.keys(preview.variables).length === 0 ? (
            <span>None</span>
          ) : (
            Object.entries(preview.variables).map(([key, value]) => (
              <span key={key}>
                {key}: {value}
              </span>
            ))
          )}
        </div>
        <div>
          <strong>Route</strong>
          {preview.path.length === 0 ? (
            <span>None</span>
          ) : (
            preview.path.slice(-6).map((nodeId, index) => <span key={`${nodeId}-${index}`}>{nodeId}</span>)
          )}
        </div>
        <div>
          <strong>Log</strong>
          {preview.log.length === 0 ? <span>Ready</span> : preview.log.slice(-6).map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
    </div>
  )
}

function StageOverlay({
  node,
  choices,
  preview,
  nodes,
  onClose,
  onBack,
  onReset,
  onChoose,
}: {
  node: QuestNode | null
  choices: QuestEdge[]
  preview: PreviewState
  nodes: QuestNode[]
  onClose: () => void
  onBack: () => void
  onReset: () => void
  onChoose: (edge: QuestEdge) => void
}) {
  const isChoice = node?.type === 'choice'
  const canContinue = node && !preview.finished && choices.length > 0 && !isChoice

  return (
    <div className="stage-overlay" role="dialog" aria-label="Playable quest stage">
      <div className="stage-shell">
        <header className="stage-header">
          <div>
            <span>Cinematic Preview</span>
            <h2>{node?.data.title ?? 'No active node'}</h2>
          </div>
          <div className="header-actions">
            <button type="button" onClick={onBack} disabled={preview.history.length === 0}>
              Back
            </button>
            <button type="button" onClick={onReset}>
              Restart
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

          <PixiQuestStage node={node} preview={preview} nodes={nodes} />

        <section className="stage-dialogue">
          <div>
            <span>{node ? nodeMeta[node.type as QuestNodeKind].label : 'Preview'}</span>
            <h3>{node?.data.character || node?.data.title || 'No Start node'}</h3>
            <p>{node?.data.body || 'Add a Start node to play this tree.'}</p>
            {node?.data.objective && <strong>Objective: {node.data.objective}</strong>}
            {node?.data.reward && <strong>Reward: {node.data.reward}</strong>}
            {node?.data.eventType && <strong>Quest state: {node.data.eventType}</strong>}
          </div>
          <div className="stage-choices">
            {preview.finished && <span className="issue-empty">Playback ended</span>}
            {isChoice &&
              choices.map((edge) => (
                <button key={edge.id} type="button" onClick={() => onChoose(edge)}>
                  {edge.data?.label ?? edge.label ?? 'Choose'}
                </button>
              ))}
            {canContinue && (
              <button type="button" className="button-primary" onClick={() => onChoose(choices[0])}>
                Continue
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function PixiQuestStage({
  node,
  preview,
  nodes,
}: {
  node: QuestNode | null
  preview: PreviewState
  nodes: QuestNode[]
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const sceneRef = useRef<PixiContainer | null>(null)
  const pixiRef = useRef<PixiModule | null>(null)
  const [rendererReady, setRendererReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const pixi = await import('pixi.js')
      const app = new pixi.Application()
      const scene = new pixi.Container()

      await app.init({
        width: 960,
        height: 540,
        background: '#101217',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })

      if (cancelled || !hostRef.current) {
        app.destroy(true)
        return
      }

      app.stage.addChild(scene)
      appRef.current = app
      sceneRef.current = scene
      pixiRef.current = pixi
      hostRef.current.appendChild(app.canvas)
      setRendererReady(true)
    }

    void init()

    return () => {
      cancelled = true
      appRef.current?.destroy(true)
      appRef.current = null
      sceneRef.current = null
      pixiRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    const pixi = pixiRef.current
    if (!rendererReady || !pixi || !scene) {
      return
    }

    drawQuestScene(pixi, scene, node, preview, nodes)
  }, [node, nodes, preview, rendererReady])

  return (
    <div ref={hostRef} className="pixi-stage" aria-label="Rendered 2.5D quest output">
      {!rendererReady && <span>Loading stage renderer...</span>}
    </div>
  )
}

function drawQuestScene(
  pixi: PixiModule,
  scene: PixiContainer,
  node: QuestNode | null,
  preview: PreviewState,
  nodes: QuestNode[],
) {
  scene.removeChildren()

  const type = node?.type ?? 'start'
  const accent = node ? Number.parseInt(nodeMeta[node.type as QuestNodeKind].accent.slice(1), 16) : 0x6cb6ff
  const background = new pixi.Graphics()
  background
    .rect(0, 0, 960, 540)
    .fill(0x101217)
    .rect(0, 0, 960, 210)
    .fill(type === 'end' ? 0x1c1518 : 0x151923)
    .rect(0, 210, 960, 330)
    .fill(0x171b20)
  scene.addChild(background)

  const floor = new pixi.Graphics()
  floor
    .moveTo(110, 510)
    .lineTo(860, 510)
    .lineTo(650, 255)
    .lineTo(300, 255)
    .closePath()
    .fill(0x252b34)
    .stroke({ color: 0x343a46, width: 2 })
  scene.addChild(floor)

  const pathLines = new pixi.Graphics()
  for (let i = 0; i < 7; i += 1) {
    pathLines
      .moveTo(190 + i * 95, 505)
      .lineTo(355 + i * 35, 270)
      .stroke({ color: 0x343a46, width: 1, alpha: 0.62 })
  }
  scene.addChild(pathLines)

  drawProp(pixi, scene, 130, 250, 0x7dcfff, 'NPC')
  drawProp(pixi, scene, 760, 250, 0xc792ea, 'PLAYER')
  drawQuestMarker(pixi, scene, 480, 178, accent, node?.data.title ?? 'No node')
  drawRoute(pixi, scene, preview, nodes)

  if (node?.type === 'reward') {
    drawReward(pixi, scene, 474, 330, node.data.reward ?? 'Reward')
  }

  if (node?.type === 'objective' || node?.type === 'quest_event') {
    drawQuestBanner(pixi, scene, node)
  }

  if (node?.type === 'condition') {
    drawConditionGate(pixi, scene, node)
  }
}

function drawProp(pixi: PixiModule, scene: PixiContainer, x: number, y: number, color: number, label: string) {
  const body = new pixi.Graphics()
  body
    .roundRect(x, y + 42, 76, 112, 8)
    .fill(0x111318)
    .stroke({ color, width: 4 })
    .circle(x + 38, y + 24, 24)
    .fill(0x20242c)
    .stroke({ color: 0x343a46, width: 2 })
  scene.addChild(body)

  const name = new pixi.Text({
    text: label,
    style: { fill: color, fontSize: 13, fontFamily: 'Arial', fontWeight: '700' },
  })
  name.x = x + 3
  name.y = y + 166
  scene.addChild(name)
}

function drawQuestMarker(pixi: PixiModule, scene: PixiContainer, x: number, y: number, color: number, title: string) {
  const marker = new pixi.Graphics()
  marker
    .roundRect(x - 150, y - 34, 300, 68, 8)
    .fill(0x20242c)
    .stroke({ color, width: 3 })
    .circle(x, y + 58, 10)
    .fill(color)
  scene.addChild(marker)

  const text = new pixi.Text({
    text: title.slice(0, 32),
    style: { fill: 0xf8f9fc, fontSize: 18, fontFamily: 'Arial', fontWeight: '700', align: 'center' },
  })
  text.x = x - text.width / 2
  text.y = y - 10
  scene.addChild(text)
}

function drawRoute(pixi: PixiModule, scene: PixiContainer, preview: PreviewState, nodes: QuestNode[]) {
  const route = new pixi.Graphics()
  const routeNodes = preview.path
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is QuestNode => Boolean(node))
    .slice(-8)

  routeNodes.forEach((routeNode, index) => {
    const x = 170 + index * 88
    const y = 468
    const color = Number.parseInt(nodeMeta[routeNode.type as QuestNodeKind].accent.slice(1), 16)
    route.circle(x, y, 8).fill(color)
    if (index > 0) {
      route.moveTo(x - 78, y).lineTo(x - 12, y).stroke({ color: 0x6cb6ff, width: 2 })
    }
  })

  scene.addChild(route)
}

function drawReward(pixi: PixiModule, scene: PixiContainer, x: number, y: number, reward: string) {
  const chest = new pixi.Graphics()
  chest
    .roundRect(x - 44, y - 16, 88, 54, 6)
    .fill(0x2f2a1d)
    .stroke({ color: 0xffcb6b, width: 3 })
    .rect(x - 8, y - 16, 16, 54)
    .fill(0xffcb6b)
  scene.addChild(chest)

  const text = new pixi.Text({
    text: reward.slice(0, 38),
    style: { fill: 0xffcb6b, fontSize: 14, fontFamily: 'Arial', fontWeight: '700' },
  })
  text.x = x - text.width / 2
  text.y = y + 52
  scene.addChild(text)
}

function drawQuestBanner(pixi: PixiModule, scene: PixiContainer, node: QuestNode) {
  const banner = new pixi.Graphics()
  banner.roundRect(320, 76, 320, 42, 5).fill(0x111318).stroke({ color: 0xa3be8c, width: 2 })
  scene.addChild(banner)

  const text = new pixi.Text({
    text: node.data.objective || node.data.body || node.data.title,
    style: { fill: 0xa3be8c, fontSize: 14, fontFamily: 'Arial', fontWeight: '700' },
  })
  text.x = 340
  text.y = 88
  scene.addChild(text)
}

function drawConditionGate(pixi: PixiModule, scene: PixiContainer, node: QuestNode) {
  const gate = new pixi.Graphics()
  gate
    .roundRect(395, 300, 170, 62, 6)
    .fill(0x211f18)
    .stroke({ color: 0xe8b84d, width: 3 })
  scene.addChild(gate)

  const text = new pixi.Text({
    text: `${node.data.variableName ?? 'variable'} ${node.data.comparison ?? 'equals'} ${
      node.data.compareValue ?? 'value'
    }`,
    style: { fill: 0xe8b84d, fontSize: 13, fontFamily: 'Arial', fontWeight: '700' },
  })
  text.x = 480 - text.width / 2
  text.y = 323
  scene.addChild(text)
}

function NotesPanel({
  notes,
  onAdd,
  onChange,
  onDelete,
}: {
  notes: NoteBlock[]
  onAdd: (kind?: NoteKind) => void
  onChange: (id: string, data: Partial<NoteBlock>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="panel-body">
      <div className="panel-heading">
        <span>Notes</span>
        <button type="button" onClick={() => onAdd()}>
          <Plus size={14} aria-hidden="true" />
          Note
        </button>
      </div>
      <div className="note-actions">
        <button type="button" onClick={() => onAdd('todo')}>
          Todo
        </button>
        <button type="button" onClick={() => onAdd('reference')}>
          Reference
        </button>
      </div>
      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="empty-state">
            <BookOpenText size={18} aria-hidden="true" />
            <h2>No notes</h2>
            <p>Track dialogue intent, branch rules, and writer tasks here.</p>
          </div>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="note-block">
              <div className="note-block__header">
                <select value={note.kind} onChange={(event) => onChange(note.id, { kind: event.target.value as NoteKind })}>
                  <option value="note">Note</option>
                  <option value="todo">Todo</option>
                  <option value="reference">Reference</option>
                </select>
                <button type="button" className="icon-button" onClick={() => onDelete(note.id)} aria-label="Delete note">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              <input value={note.title} onChange={(event) => onChange(note.id, { title: event.target.value })} />
              <textarea
                value={note.body}
                onChange={(event) => onChange(note.id, { body: event.target.value })}
                rows={4}
                placeholder="Write notes for this dialogue tree."
              />
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function createNode(type: QuestNodeKind, position: { x: number; y: number }): QuestNode {
  const meta = nodeMeta[type]
  return {
    id: `${type}-${crypto.randomUUID()}`,
    type,
    position,
    data: {
      title: meta.label,
      body:
        type === 'choice'
          ? 'Describe the decision.'
          : type === 'condition'
            ? 'Route based on a variable.'
            : type === 'set_variable'
              ? 'Set a quest flag.'
              : type === 'end'
                ? 'End this path.'
                : 'Write this beat.',
      character: type === 'dialogue' ? 'NPC' : undefined,
      eventType: type === 'quest_event' || type === 'end' ? 'update' : undefined,
      reward: type === 'reward' ? 'XP, item, unlock...' : undefined,
      variableName: type === 'condition' || type === 'set_variable' ? 'quest_flag' : undefined,
      variableValue: type === 'set_variable' ? 'true' : undefined,
      comparison: type === 'condition' ? 'equals' : undefined,
      compareValue: type === 'condition' ? 'true' : undefined,
      objective: type === 'objective' ? 'Reach the next location' : undefined,
    },
  }
}

function createPreview(nodes: QuestNode[], startNodeId?: string): PreviewState {
  const startNode = nodes.find((node) => node.id === startNodeId) ?? nodes.find((node) => node.type === 'start') ?? null
  return {
    currentNodeId: startNode?.id ?? null,
    variables: {},
    log: startNode ? ['Playback started'] : [],
    path: startNode ? [startNode.id] : [],
    history: [],
    finished: false,
  }
}

function advancePreview(
  targetId: string,
  nodes: QuestNode[],
  edges: QuestEdge[],
  variables: Record<string, string>,
  log: string[],
  path: string[],
  previousState: PreviewState,
): PreviewState {
  const nextNode = nodes.find((node) => node.id === targetId)
  if (!nextNode) {
    return {
      currentNodeId: null,
      variables,
      log: [...log, 'Missing target node'],
      path,
      history: [...previousState.history, snapshotPreview(previousState)],
      finished: true,
    }
  }

  const nextVariables = { ...variables }
  const nextLog = [...log, `${nodeMeta[nextNode.type as QuestNodeKind].label}: ${nextNode.data.title}`]
  const nextPath = [...path, nextNode.id]

  if (nextNode.type === 'set_variable' && nextNode.data.variableName) {
    nextVariables[nextNode.data.variableName] = nextNode.data.variableValue ?? 'true'
    nextLog.push(`${nextNode.data.variableName} = ${nextVariables[nextNode.data.variableName]}`)
  }

  if (nextNode.type === 'condition') {
    const pass = evaluateCondition(nextNode, nextVariables)
    const outgoing = edges.filter((edge) => edge.source === nextNode.id)
    const nextEdge =
      outgoing.find((edge) => (edge.data?.label ?? edge.label)?.toString().toLowerCase() === (pass ? 'true' : 'false')) ??
      outgoing[pass ? 0 : 1] ??
      outgoing[0]
    nextLog.push(`Condition ${pass ? 'passed' : 'failed'}`)
    return nextEdge
      ? advancePreview(nextEdge.target, nodes, edges, nextVariables, nextLog, nextPath, previousState)
      : {
          currentNodeId: nextNode.id,
          variables: nextVariables,
          log: nextLog,
          path: nextPath,
          history: [...previousState.history, snapshotPreview(previousState)],
          finished: true,
        }
  }

  return {
    currentNodeId: nextNode.id,
    variables: nextVariables,
    log: nextLog,
    path: nextPath,
    history: [...previousState.history, snapshotPreview(previousState)],
    finished: nextNode.type === 'end' || !edges.some((edge) => edge.source === nextNode.id),
  }
}

function snapshotPreview(preview: PreviewState): PreviewState['history'][number] {
  return {
    currentNodeId: preview.currentNodeId,
    variables: preview.variables,
    log: preview.log,
    path: preview.path,
    finished: preview.finished,
  }
}

function evaluateCondition(node: QuestNode, variables: Record<string, string>): boolean {
  const key = node.data.variableName ?? ''
  const actual = variables[key]
  if (node.data.comparison === 'exists') {
    return actual !== undefined
  }
  if (node.data.comparison === 'not_equals') {
    return actual !== node.data.compareValue
  }
  return actual === node.data.compareValue
}

function sanitizeEdge(edge: QuestEdge): QuestEdge {
  return {
    ...edge,
    label: edge.data?.label ?? edge.label,
    markerEnd: edge.markerEnd ?? { type: MarkerType.ArrowClosed },
  }
}

function readStoredProject(): QuestProject {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return buildSampleProject()
  }

  try {
    return migrateProject(JSON.parse(raw) as Partial<QuestProject>)
  } catch {
    return buildSampleProject()
  }
}

function migrateProject(project: Partial<QuestProject>): QuestProject {
  if (!Array.isArray(project.nodes) || !Array.isArray(project.edges)) {
    throw new Error('Invalid project')
  }

  return {
    version: 2,
    id: project.id || crypto.randomUUID(),
    title: project.title || 'Untitled Quest Graph',
    lastSavedAt: project.lastSavedAt,
    notes: Array.isArray(project.notes) ? project.notes : [],
    nodes: project.nodes.map((node) => ({
      ...node,
      type: node.type === 'quest_event' && node.data?.eventType === 'start' ? 'quest_event' : node.type,
      data: {
        title: node.data?.title ?? nodeMeta[node.type as QuestNodeKind]?.label ?? 'Node',
        body: node.data?.body ?? '',
        character: node.data?.character,
        eventType: node.data?.eventType,
        reward: node.data?.reward,
        variableName: node.data?.variableName,
        variableValue: node.data?.variableValue,
        comparison: node.data?.comparison,
        compareValue: node.data?.compareValue,
        objective: node.data?.objective,
      },
    })) as QuestNode[],
    edges: project.edges.map(sanitizeEdge),
  }
}

function validateGraph(nodes: QuestNode[], edges: QuestEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const startNodes = nodes.filter((node) => node.type === 'start')
  const nodeIds = new Set(nodes.map((node) => node.id))

  if (startNodes.length !== 1) {
    issues.push({
      id: 'start-count',
      nodeId: startNodes[0]?.id,
      severity: 'error',
      message: startNodes.length === 0 ? 'Add one Start node.' : 'Keep exactly one Start node.',
    })
  }

  nodes.forEach((node) => {
    if (!node.data.title.trim()) {
      issues.push({
        id: `${node.id}-missing-title`,
        nodeId: node.id,
        severity: 'warning',
        message: `${nodeMeta[node.type as QuestNodeKind].label} is missing a title.`,
      })
    }

    if (!node.data.body.trim() && node.type !== 'start') {
      issues.push({
        id: `${node.id}-missing-body`,
        nodeId: node.id,
        severity: node.type === 'reward' ? 'warning' : 'error',
        message: `${nodeMeta[node.type as QuestNodeKind].label} is missing content.`,
      })
    }

    if (node.type === 'choice' && !edges.some((edge) => edge.source === node.id)) {
      issues.push({
        id: `${node.id}-choice-outgoing`,
        nodeId: node.id,
        severity: 'error',
        message: 'Player Choice needs at least one outgoing connection.',
      })
    }

    if (node.type === 'condition' && (!node.data.variableName || !node.data.comparison)) {
      issues.push({
        id: `${node.id}-condition-incomplete`,
        nodeId: node.id,
        severity: 'error',
        message: 'Condition needs a variable and comparison.',
      })
    }

    if (node.type === 'condition') {
      const labels = edges
        .filter((edge) => edge.source === node.id)
        .map((edge) => (edge.data?.label ?? edge.label ?? '').toString().toLowerCase())
      if (!labels.includes('true') || !labels.includes('false')) {
        issues.push({
          id: `${node.id}-condition-branches`,
          nodeId: node.id,
          severity: 'warning',
          message: 'Condition should have True and False branch labels.',
        })
      }
    }

    if (node.type === 'set_variable' && !node.data.variableName) {
      issues.push({
        id: `${node.id}-variable-empty`,
        nodeId: node.id,
        severity: 'error',
        message: 'Set Variable needs a variable name.',
      })
    }

    if (node.type === 'objective' && !node.data.objective?.trim()) {
      issues.push({
        id: `${node.id}-objective-empty`,
        nodeId: node.id,
        severity: 'warning',
        message: 'Objective has no player task.',
      })
    }

    if (node.type === 'reward' && !node.data.reward?.trim()) {
      issues.push({
        id: `${node.id}-reward-empty`,
        nodeId: node.id,
        severity: 'warning',
        message: 'Reward node has no reward payload.',
      })
    }
  })

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        id: `${edge.id}-dangling`,
        edgeId: edge.id,
        severity: 'error',
        message: 'Connection points to a missing node.',
      })
    }
  })

  if (startNodes[0]) {
    const reachable = getReachableNodes(startNodes[0].id, edges)
    nodes.forEach((node) => {
      if (!reachable.has(node.id)) {
        issues.push({
          id: `${node.id}-unreachable`,
          nodeId: node.id,
          severity: 'warning',
          message: `${nodeMeta[node.type as QuestNodeKind].label} is unreachable from Start.`,
        })
      }
    })
  }

  return issues
}

function getReachableNodes(startId: string, edges: QuestEdge[]): Set<string> {
  const reachable = new Set<string>([startId])
  let changed = true
  while (changed) {
    changed = false
    edges.forEach((edge) => {
      if (reachable.has(edge.source) && !reachable.has(edge.target)) {
        reachable.add(edge.target)
        changed = true
      }
    })
  }
  return reachable
}

export default App
