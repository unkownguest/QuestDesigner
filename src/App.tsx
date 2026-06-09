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
  ChevronDown,
  Download,
  Flag,
  Gift,
  GitBranch,
  LayoutDashboard,
  Map,
  MessageSquareText,
  Milestone,
  Play,
  Plus,
  Save,
  ScrollText,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Users,
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
type AppSection = 'dashboard' | 'dialogue' | 'quests' | 'characters' | 'world' | 'ai'
type InspectorTab = 'inspector' | 'validation' | 'preview' | 'script' | 'notes'
type NoteKind = 'note' | 'todo' | 'reference'

type QuestNodeData = {
  title: string
  body: string
  character?: string
  eventType?: QuestEventType
  reward?: string
  questId?: string
  questObjectiveId?: string
  mapLocationId?: string
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

type QuestRecord = {
  id: string
  title: string
  description: string
  giver: string
  status: QuestEventType
  objectives: string
  rewards: string
  locationId?: string
  stages?: QuestObjective[]
  linkedNodeIds?: string[]
}

type QuestObjective = {
  id: string
  title: string
  description: string
  completed: boolean
}

type WorldRegion = {
  id: string
  name: string
  color?: string
}

type MapLocationType = 'town' | 'city' | 'village' | 'camp' | 'dungeon' | 'landmark' | 'region'
type MapRouteType = 'road' | 'trail' | 'river' | 'sea' | 'hidden'

type WorldMapLocation = {
  id: string
  name: string
  type: MapLocationType
  x: number
  y: number
  region?: string
  faction?: string
  description: string
  linkedQuestIds: string[]
  linkedCharacterIds: string[]
}

type WorldMapRoute = {
  id: string
  fromLocationId: string
  toLocationId: string
  type: MapRouteType
  danger: 'safe' | 'contested' | 'dangerous'
  label?: string
}

type CharacterRecord = {
  id: string
  name: string
  role: string
  personality: string
  faction: string
  location: string
  homeLocationId?: string
  backstory: string
  dialogueStyle: string
  notes: string
  avatarColor: string
}

type WorldRecord = {
  name: string
  regions: string
  locations: string
  factions: string
  mainConflict: string
  setting: string
  toneStyle: string
  mapRegions: WorldRegion[]
  mapLocations: WorldMapLocation[]
  mapRoutes: WorldMapRoute[]
}

type GeneratorForm = {
  idea: string
  genre: string
  tone: string
  context: string
}

type GeneratedQuest = {
  quest: QuestRecord
  characters: CharacterRecord[]
  project: QuestProject
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

type ProjectSnapshot = {
  id: string
  title: string
  lastSavedAt: string
  nodesCount: number
  edgesCount: number
}

type ProjectCatalog = {
  activeProjectId: string
  projects: ProjectSnapshot[]
}

const STORAGE_KEY = 'quest-designer-project'
const PROJECT_CATALOG_KEY = 'narrative-forge-project-catalog'
const PROJECT_STORAGE_PREFIX = 'narrative-forge-project:'
const QUESTS_STORAGE_KEY = 'narrative-forge-quests'
const CHARACTERS_STORAGE_KEY = 'narrative-forge-characters'
const WORLD_STORAGE_KEY = 'narrative-forge-world'
const AI_GENERATOR_ENDPOINT =
  (import.meta.env.VITE_AI_GENERATOR_ENDPOINT as string | undefined) || (import.meta.env.PROD ? '/api/generate-quest' : '')

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

const sampleQuests: QuestRecord[] = [
  {
    id: 'quest-beacon',
    title: 'Beacon in the Fog',
    description: 'Relight the abandoned watchtower beacon so travelers can cross the road safely.',
    giver: 'Mira',
    status: 'start',
    locationId: 'map-camp-1',
    objectives: 'Reach the tower\nFind dry oil\nRelight the beacon',
    rewards: '120 XP\nRanger Charm\nSafe road unlocked',
    stages: [
      {
        id: 'stage-beacon-start',
        title: 'Reach the camp',
        description: 'Talk to Mira and accept the request.',
        completed: true,
      },
      {
        id: 'stage-beacon-journey',
        title: 'Restore the signal',
        description: 'Find the watchtower and relight the lamp.',
        completed: false,
      },
      {
        id: 'stage-beacon-return',
        title: 'Return',
        description: 'Report progress to Mira and collect reward.',
        completed: false,
      },
    ],
    linkedNodeIds: ['start-1', 'quest-1', 'objective-1', 'end-success'],
  },
]

const sampleCharacters: CharacterRecord[] = [
  {
    id: 'character-mira',
    name: 'Mira',
    role: 'Ranger quest giver',
    personality: 'Direct, protective, exhausted',
    faction: 'Road Wardens',
    location: 'Campfire outside the fog road',
    homeLocationId: 'map-camp-1',
    backstory: 'Mira has watched the road fail for weeks and needs someone reckless enough to enter the fog.',
    dialogueStyle: 'Short warnings, practical details, no ornament.',
    notes: 'Use direct threats and concise dialogue when Mira is worried.',
    avatarColor: '#7dcfff',
  },
]

const splitLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const countLines = (value: string): number => splitLines(value).length

const buildRandomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const prefixedId = (prefix: string) => `${prefix}-${buildRandomId()}`

type StateSet<T> = (value: T | ((current: T) => T)) => void

const WORLD_CANVAS = {
  width: 1000,
  height: 420,
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length]
}

function buildQuickMap(world: WorldRecord, count = 7): {
  locations: WorldMapLocation[]
  routes: WorldMapRoute[]
} {
  const locationNames = splitLines(world.locations)
  const factions = splitLines(world.factions)
  const startIndex = 1
  const locationCount = Math.max(4, Math.min(12, count))
  const startX = WORLD_CANVAS.width * 0.12
  const startY = WORLD_CANVAS.height * 0.2
  const xStep = WORLD_CANVAS.width * 0.16
  const yStep = WORLD_CANVAS.height * 0.23

  const locations = Array.from({ length: locationCount }, (_, idx) => {
    const name = locationNames[idx] || `Generated Town ${startIndex + idx}`
    return {
      id: `map-generated-${Date.now()}-${idx}`,
      name,
      type: pick(mapLocationTypeOptions, idx) as MapLocationType,
      x: clamp(startX + (idx % 5) * xStep + (idx % 2) * 30, 20, WORLD_CANVAS.width - 20),
      y: clamp(startY + Math.floor(idx / 5) * yStep + (idx % 3) * 14, 30, WORLD_CANVAS.height - 24),
      region: splitLines(world.regions)[idx % Math.max(1, splitLines(world.regions).length)] || `Region ${Math.floor(idx / 5) + 1}`,
      faction: factions.length ? pick(factions, idx) : undefined,
      description: `Generated as part of a quick map sketch for ${world.name}.`,
      linkedQuestIds: [],
      linkedCharacterIds: [],
    }
  })

  const routes = locations.slice(1).map((location, index) => {
    const from = locations[index]
    const lineType = pick(mapRouteTypeOptions, index)
    const danger = pick(mapRouteDangerOptions, index)
    const isCross =
      index >= 2 && index % 3 === 0 ? pick(mapRouteTypeOptions, index + 1) : undefined

    return {
      id: `route-generated-${Date.now()}-${index}`,
      fromLocationId: from.id,
      toLocationId: location.id,
      type: isCross || lineType,
      danger,
      label: 'Route',
    }
  })

  return { locations, routes }
}

const mapLocationTypeOptions: MapLocationType[] = ['town', 'city', 'village', 'camp', 'dungeon', 'landmark', 'region']
const mapRouteTypeOptions: MapRouteType[] = ['road', 'trail', 'river', 'sea', 'hidden']
const mapRouteDangerOptions: WorldMapRoute['danger'][] = ['safe', 'contested', 'dangerous']

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeQuestStatus(value: string | undefined): QuestEventType {
  return value === 'start' || value === 'update' || value === 'complete' || value === 'fail' ? value : 'start'
}

const sampleWorld: WorldRecord = {
  name: 'The Fog Road',
  regions: 'North Watch Road\nAshpine Ridge',
  locations: 'Mira camp\nAbandoned watchtower\nOld toll gate',
  factions: 'Road Wardens\nAshpine traders',
  mainConflict: 'The beacon network is failing, and the fog is cutting towns off from one another.',
  setting: 'A grounded frontier route where small infrastructure failures become survival problems.',
  toneStyle: 'Grounded route-level caution and survival realism.',
  mapRegions: [
    { id: 'region-road', name: 'North Watch Road', color: '#6cb6ff' },
    { id: 'region-ashpine', name: 'Ashpine Ridge', color: '#89ddff' },
  ],
  mapLocations: [
    {
      id: 'map-camp-1',
      name: 'Mira Camp',
      type: 'camp',
      x: 140,
      y: 220,
      region: 'North Watch Road',
      faction: 'Road Wardens',
      description: 'Temporary stop for travelers waiting for escort.',
      linkedQuestIds: ['quest-beacon'],
      linkedCharacterIds: ['character-mira'],
    },
    {
      id: 'map-tower-1',
      name: 'Abandoned Watchtower',
      type: 'landmark',
      x: 520,
      y: 190,
      region: 'North Watch Road',
      faction: 'Road Wardens',
      description: 'Old beacon signal point now dark.',
      linkedQuestIds: ['quest-beacon'],
      linkedCharacterIds: [],
    },
    {
      id: 'map-gate-1',
      name: 'Old Toll Gate',
      type: 'city',
      x: 840,
      y: 300,
      region: 'Ashpine Ridge',
      faction: 'Ashpine traders',
      description: 'Merchant outpost controlling freight lanes.',
      linkedQuestIds: [],
      linkedCharacterIds: [],
    },
  ],
  mapRoutes: [
    {
      id: 'route-camp-tower',
      fromLocationId: 'map-camp-1',
      toLocationId: 'map-tower-1',
      type: 'road',
      danger: 'contested',
      label: 'Fog drift lane',
    },
    {
      id: 'route-tower-gate',
      fromLocationId: 'map-tower-1',
      toLocationId: 'map-gate-1',
      type: 'trail',
      danger: 'safe',
      label: 'Old roadline',
    },
  ],
}

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
      questId: 'quest-beacon',
      mapLocationId: 'map-camp-1',
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
      questId: 'quest-beacon',
      questObjectiveId: 'stage-beacon-journey',
      mapLocationId: 'map-tower-1',
    },
  },
  {
    id: 'condition-1',
    type: 'condition',
    position: { x: 2000, y: 0 },
    data: {
      title: 'Accepted Job?',
      body: 'Routes the quest based on accepted_beacon_job.',
      questId: 'quest-beacon',
      mapLocationId: 'map-camp-1',
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
      questId: 'quest-beacon',
      questObjectiveId: 'stage-beacon-return',
      mapLocationId: 'map-camp-1',
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

function projectStorageKey(projectId: string): string {
  return `${PROJECT_STORAGE_PREFIX}${projectId}`
}

function buildProjectSnapshot(project: QuestProject): ProjectSnapshot {
  return {
    id: project.id,
    title: project.title || 'Untitled Quest Graph',
    lastSavedAt: project.lastSavedAt || new Date().toISOString(),
    nodesCount: project.nodes.length,
    edgesCount: project.edges.length,
  }
}

const MAX_RECENT_PROJECTS = 12

function readLegacyProject(): QuestProject | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const legacy = migrateProject(JSON.parse(raw) as Partial<QuestProject>)
    if (!legacy.id) {
      return null
    }
    return legacy
  } catch {
    return null
  }
}

function readProjectSnapshot(projectId: string): QuestProject | null {
  const raw = localStorage.getItem(projectStorageKey(projectId))
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<QuestProject>
    const normalized = migrateProject(parsed)
    return {
      ...normalized,
      id: projectId,
    }
  } catch {
    return null
  }
}

function readCatalogOrBootstrap(): { catalog: ProjectCatalog; initialProject: QuestProject } {
  const rawCatalog = localStorage.getItem(PROJECT_CATALOG_KEY)
  const legacyProject = readLegacyProject()

  if (!rawCatalog) {
    const project = legacyProject || buildSampleProject()
    const normalized = { ...project, id: project.id || `project-${buildRandomId()}` }
    const catalog: ProjectCatalog = {
      activeProjectId: normalized.id,
      projects: [buildProjectSnapshot(normalized)],
    }
    localStorage.setItem(projectStorageKey(normalized.id), JSON.stringify(normalized))
    localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(catalog))
    return { catalog, initialProject: normalized }
  }

  try {
    const catalog = JSON.parse(rawCatalog) as ProjectCatalog
    const validCatalog =
      catalog &&
      typeof catalog === 'object' &&
      Array.isArray(catalog.projects) &&
      typeof catalog.activeProjectId === 'string'
        ? catalog
        : null
    if (!validCatalog) {
      const project = legacyProject || buildSampleProject()
      const normalized = { ...project, id: project.id || `project-${buildRandomId()}` }
      const fallbackCatalog: ProjectCatalog = {
        activeProjectId: normalized.id,
        projects: [buildProjectSnapshot(normalized)],
      }
      localStorage.setItem(projectStorageKey(normalized.id), JSON.stringify(normalized))
      localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(fallbackCatalog))
      return { catalog: fallbackCatalog, initialProject: normalized }
    }

    const orderedProjects = validCatalog.projects.filter((entry) => !!entry.id)
    const activeFromCatalog = validCatalog.activeProjectId
    const loadedActive =
      readProjectSnapshot(activeFromCatalog) ??
      orderedProjects.map((entry) => readProjectSnapshot(entry.id)).find((item): item is QuestProject => Boolean(item)) ??
      null

    if (!loadedActive) {
      const project = legacyProject || buildSampleProject()
      const normalized = { ...project, id: project.id || `project-${buildRandomId()}` }
      const nextCatalog: ProjectCatalog = {
        activeProjectId: normalized.id,
        projects: [
          buildProjectSnapshot(normalized),
          ...orderedProjects.filter((entry) => entry.id !== normalized.id),
        ].slice(0, MAX_RECENT_PROJECTS),
      }
      localStorage.setItem(projectStorageKey(normalized.id), JSON.stringify(normalized))
      localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(nextCatalog))
      return { catalog: nextCatalog, initialProject: normalized }
    }

    const currentProjects = [
      ...orderedProjects,
      buildProjectSnapshot(loadedActive),
    ].filter((entry, index, array) => array.findIndex((other) => other.id === entry.id) === index)
    const normalizedCatalog: ProjectCatalog = {
      activeProjectId: loadedActive.id,
      projects: currentProjects.slice(0, MAX_RECENT_PROJECTS),
    }
    return { catalog: normalizedCatalog, initialProject: loadedActive }
  } catch {
    const project = legacyProject || buildSampleProject()
      const normalized = { ...project, id: project.id || `project-${buildRandomId()}` }
    const fallbackCatalog: ProjectCatalog = {
      activeProjectId: normalized.id,
      projects: [buildProjectSnapshot(normalized)],
    }
    localStorage.setItem(projectStorageKey(normalized.id), JSON.stringify(normalized))
    localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(fallbackCatalog))
    return { catalog: fallbackCatalog, initialProject: normalized }
  }
}

function saveProjectCatalog(catalog: ProjectCatalog) {
  localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(catalog))
}

function upsertProjectSnapshot(catalog: ProjectCatalog, project: QuestProject): ProjectCatalog {
  const snapshot = buildProjectSnapshot(project)
  const filteredProjects = catalog.projects.filter((entry) => entry.id !== snapshot.id)
  return {
    activeProjectId: snapshot.id,
    projects: [snapshot, ...filteredProjects].slice(0, MAX_RECENT_PROJECTS),
  }
}

function App() {
  const bootstrap = useMemo(() => readCatalogOrBootstrap(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<QuestNode, QuestEdge> | null>(null)
  const hasCenteredDialogueRef = useRef(false)
  const [projectCatalog, setProjectCatalog] = useState<ProjectCatalog>(bootstrap.catalog)
  const [initialProject] = useState(bootstrap.initialProject)
  const [activeSection, setActiveSection] = useState<AppSection>('dialogue')
  const [projectId, setProjectId] = useState(initialProject.id)
  const [projectTitle, setProjectTitle] = useState(initialProject.title)
  const [notes, setNotes] = useState<NoteBlock[]>(initialProject.notes)
  const [quests, setQuests] = useState<QuestRecord[]>(readStoredQuests)
  const [characters, setCharacters] = useState<CharacterRecord[]>(readStoredCharacters)
  const [world, setWorld] = useState<WorldRecord>(readStoredWorld)
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
      const nextProject = { ...project, lastSavedAt: new Date().toISOString() }
      localStorage.setItem(projectStorageKey(projectId), JSON.stringify(nextProject))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject))
      setProjectCatalog((current) => {
        const nextCatalog = upsertProjectSnapshot(current, nextProject)
        saveProjectCatalog(nextCatalog)
        if (
          current.projects.length === nextCatalog.projects.length &&
          current.projects.every((entry, index) => {
            const next = nextCatalog.projects[index]
            return (
              entry.id === next.id &&
              entry.title === next.title &&
              entry.lastSavedAt === next.lastSavedAt &&
              entry.nodesCount === next.nodesCount &&
              entry.edgesCount === next.edgesCount
            )
          })
        ) {
          return current
        }
        return nextCatalog
      })
      setStatusText('Autosaved')
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [project, projectId])

  useEffect(() => {
    localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(quests))
  }, [quests])

  useEffect(() => {
    localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(characters))
  }, [characters])

  useEffect(() => {
    localStorage.setItem(WORLD_STORAGE_KEY, JSON.stringify(world))
  }, [world])

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
          `edge-${connection.source}-${connection.target}-${buildRandomId()}`,
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
      id: prefixedId(selectedNode.type),
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

  const centerDialogueView = useCallback((targetNodes: QuestNode[]) => {
    const flow = reactFlowInstance.current
    if (!flow || targetNodes.length === 0) {
      return
    }
    const startNode = targetNodes.find((node) => node.type === 'start') ?? targetNodes[0]
    flow.setCenter(startNode.position.x + 130, startNode.position.y + 60, {
      zoom: 0.8,
      duration: 0,
    })
    hasCenteredDialogueRef.current = true
  }, [])

  const saveProject = () => {
    localStorage.setItem(projectStorageKey(projectId), JSON.stringify(project))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    const nextCatalog = upsertProjectSnapshot(projectCatalog, { ...project, lastSavedAt: project.lastSavedAt ?? new Date().toISOString() })
    setProjectCatalog(nextCatalog)
    saveProjectCatalog(nextCatalog)
    setStatusText('Saved just now')
  }

  const newProject = () => {
    if (nodes.length > 0 && !window.confirm('Start a new graph? Your current graph is autosaved.')) {
      return
    }

    const firstNode = createNode('start', { x: 120, y: 120 })
    const nextProjectId = buildRandomId()
    const nextTitle = 'Untitled Quest Graph'
    const nextProject: QuestProject = {
      version: 2,
      id: nextProjectId,
      title: nextTitle,
      lastSavedAt: new Date().toISOString(),
      notes: [],
      nodes: [firstNode],
      edges: [],
    }
    setProjectId(nextProjectId)
    setProjectTitle(nextTitle)
    setNotes([])
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setSelectedNodeId(firstNode.id)
    setSelectedEdgeId(null)
    setPreview(createPreview([firstNode]))
    hasCenteredDialogueRef.current = false
    centerDialogueView([firstNode])
    setProjectCatalog((current) => {
      const nextCatalog = upsertProjectSnapshot(current, nextProject)
      localStorage.setItem(projectStorageKey(nextProjectId), JSON.stringify(nextProject))
      saveProjectCatalog(nextCatalog)
      return nextCatalog
    })
    setStatusText('New graph created')
    return
  }

  const loadProjectById = (nextProjectId: string) => {
    if (nodes.length > 0 && statusText === 'Unsaved changes' && !window.confirm('Open another project and lose unsaved changes?')) {
      return
    }

    const nextProject = readProjectSnapshot(nextProjectId) || {
      ...project,
      id: nextProjectId,
      title: 'Untitled Quest Graph',
      nodes: [{ id: 'start-1', type: 'start', position: { x: 120, y: 120 }, data: { title: 'Start', body: '' } }],
      edges: [],
      notes: [],
      lastSavedAt: new Date().toISOString(),
    }
    setProjectId(nextProject.id)
    setProjectTitle(nextProject.title)
    setNotes(nextProject.notes)
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setActiveSection('dialogue')
    setRightTab('inspector')
    setPreview(createPreview(nextProject.nodes))
    hasCenteredDialogueRef.current = false
    centerDialogueView(nextProject.nodes)
    setProjectCatalog((current) => {
      const nextCatalog = {
        ...current,
        activeProjectId: nextProjectId,
      }
      saveProjectCatalog(nextCatalog)
      return nextCatalog
    })
    setStatusText('Project loaded')
  }

  const loadSample = () => {
    if (nodes.length > 0 && !window.confirm('Load the sample quest? Your current graph is autosaved.')) {
      return
    }

    const nextProject = buildSampleProject()
    nextProject.id = `project-${buildRandomId()}`
    setProjectId(nextProject.id)
    setProjectTitle(nextProject.title)
    setNotes(nextProject.notes)
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setPreview(createPreview(nextProject.nodes))
    hasCenteredDialogueRef.current = false
    centerDialogueView(nextProject.nodes)
    setProjectCatalog((current) => {
      const nextCatalog = upsertProjectSnapshot(current, nextProject)
      localStorage.setItem(projectStorageKey(nextProject.id), JSON.stringify(nextProject))
      saveProjectCatalog(nextCatalog)
      return nextCatalog
    })
    setStatusText('Sample quest loaded')
  }

  const loadTemplate = (buildTemplate: () => QuestProject) => {
    if (nodes.length > 0 && !window.confirm('Load this template? Your current graph is autosaved.')) {
      return
    }

    const nextProject = buildTemplate()
    localStorage.setItem(projectStorageKey(nextProject.id), JSON.stringify(nextProject))
    setProjectId(nextProject.id)
    setProjectTitle(nextProject.title)
    setNotes(nextProject.notes)
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setPreview(createPreview(nextProject.nodes))
    hasCenteredDialogueRef.current = false
    centerDialogueView(nextProject.nodes)
    setProjectCatalog((current) => {
      const nextCatalog = upsertProjectSnapshot(current, nextProject)
      saveProjectCatalog(nextCatalog)
      return nextCatalog
    })
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
      const stableId = nextProject.id || `project-${buildRandomId()}`
      const importedProject = { ...nextProject, id: stableId }
      setProjectId(stableId)
      setProjectTitle(importedProject.title)
      setNotes(importedProject.notes)
      setNodes(importedProject.nodes)
      setEdges(importedProject.edges)
      setSelectedNodeId(importedProject.nodes[0]?.id ?? null)
      setSelectedEdgeId(null)
      setPreview(createPreview(importedProject.nodes))
      hasCenteredDialogueRef.current = false
      centerDialogueView(importedProject.nodes)
      localStorage.setItem(projectStorageKey(stableId), JSON.stringify(importedProject))
      setProjectCatalog((current) => {
        const nextCatalog = upsertProjectSnapshot(current, importedProject)
        saveProjectCatalog(nextCatalog)
        return nextCatalog
      })
      setStatusText(`Imported ${file.name}`)
    } catch {
      setStatusText('Import failed: expected QuestProject JSON')
    }
  }

  const importGeneratedQuest = (generated: GeneratedQuest) => {
    const nextProject = migrateProject(generated.project)
    const generatedQuest = generated.quest
    const mapLocationIds = new Set(world.mapLocations.map((location) => location.id))
    const nextWorld = mapLocationIds.size
      ? {
          ...world,
          mapLocations: world.mapLocations.map((location) => {
            const hasQuestLink = generatedQuest.locationId === location.id
            const hasCharacter = generated.characters.some((character) => character.homeLocationId === location.id)
            if (!hasQuestLink && !hasCharacter) {
              return location
            }
            const linkedQuestIds = hasQuestLink
              ? [...new Set([generatedQuest.id, ...location.linkedQuestIds])]
              : location.linkedQuestIds
            const linkedCharacterIds = hasCharacter
              ? [...new Set([...location.linkedCharacterIds, ...generated.characters.map((character) => character.id)])]
              : location.linkedCharacterIds
            return {
              ...location,
              linkedQuestIds,
              linkedCharacterIds,
            }
          }),
        }
      : world

    setProjectId(nextProject.id)
    setProjectTitle(nextProject.title)
    setNotes(nextProject.notes)
    setNodes(nextProject.nodes)
    setEdges(nextProject.edges)
    setQuests((currentQuests) => [generated.quest, ...currentQuests.filter((quest) => quest.id !== generated.quest.id)])
    setCharacters((currentCharacters) => {
      const generatedNames = new Set(generated.characters.map((character) => character.name.toLowerCase()))
      return [
        ...generated.characters,
        ...currentCharacters.filter((character) => !generatedNames.has(character.name.toLowerCase())),
      ]
    })
    setWorld(nextWorld)
    setSelectedNodeId(nextProject.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setPreview(createPreview(nextProject.nodes))
    hasCenteredDialogueRef.current = false
    centerDialogueView(nextProject.nodes)
    localStorage.setItem(projectStorageKey(nextProject.id), JSON.stringify(nextProject))
    setProjectCatalog((current) => {
      const nextCatalog = upsertProjectSnapshot(current, nextProject)
      saveProjectCatalog(nextCatalog)
      return nextCatalog
    })
    setActiveSection('dialogue')
    setRightTab('preview')
    setStageOpen(true)
    setStatusText('Generated quest imported')
  }

  const addNote = (kind: NoteKind = 'note') => {
    const nextNote = {
      id: prefixedId('note'),
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
            id: prefixedId(selectedNode.type),
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

  useEffect(() => {
    if (activeSection === 'dialogue' && !hasCenteredDialogueRef.current) {
      centerDialogueView(nodes)
    }
  }, [activeSection, centerDialogueView, nodes])

  const currentPreviewNode = nodes.find((node) => node.id === preview.currentNodeId) ?? null
  const previewChoices = currentPreviewNode
    ? edges.filter((edge) => edge.source === currentPreviewNode.id)
    : []
  const characterNames = useMemo(() => characters.map((character) => character.name).filter(Boolean), [characters])
  const questLinkedNodes = useMemo(
    () => nodes.filter((node) => node.type === 'quest_event' || node.type === 'objective' || node.type === 'reward'),
    [nodes],
  )
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
          <nav className="section-nav" aria-label="Narrative Forge sections">
            {([
              ['dashboard', LayoutDashboard, 'Dashboard'],
              ['dialogue', GitBranch, 'Dialogue'],
              ['quests', ClipboardList, 'Quests'],
              ['characters', Users, 'Characters'],
              ['world', Map, 'World'],
              ['ai', Sparkles, 'AI Generator'],
            ] as const).map(([section, Icon, label]) => (
              <button
                key={section}
                type="button"
                className={activeSection === section ? 'is-active' : ''}
                onClick={() => setActiveSection(section)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
          <div className="topbar__actions" aria-label="Project actions">
            <button type="button" onClick={newProject}>
              <Plus size={16} aria-hidden="true" />
              New
            </button>
            <button type="button" onClick={saveProject}>
              <Save size={16} aria-hidden="true" />
              Save
            </button>
            <button type="button" onClick={openStage}>
              <Play size={16} aria-hidden="true" />
              Stage
            </button>
            <details className="topbar__menu">
              <summary className="topbar__menu-trigger">
                Templates
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="topbar__menu-panel">
                <button type="button" onClick={() => loadTemplate(buildBranchingDialogueTemplate)}>
                  Branch Template
                </button>
                <button type="button" onClick={() => loadTemplate(buildQuestChainTemplate)}>
                  Quest Template
                </button>
                <button type="button" onClick={() => loadTemplate(buildRewardChoiceTemplate)}>
                  Reward Template
                </button>
                <button type="button" onClick={loadSample}>
                  Load Sample Project
                </button>
              </div>
            </details>
            <details className="topbar__menu">
              <summary className="topbar__menu-trigger">
                Project
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="topbar__menu-panel">
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} aria-hidden="true" />
                  Import JSON
                </button>
                <button type="button" className="button-primary" onClick={exportProject}>
                  <Download size={16} aria-hidden="true" />
                  Export Graph
                </button>
                <button type="button" onClick={exportScript}>
                  <Download size={16} aria-hidden="true" />
                  Export Script
                </button>
              </div>
            </details>
            <span className="save-status" aria-live="polite">
              {statusText}
            </span>
          </div>
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

        {activeSection === 'dashboard' && (
          <DashboardPage
            activeProjectId={projectId}
            projectCatalog={projectCatalog}
            onLoadProject={loadProjectById}
            projectTitle={projectTitle}
            nodes={nodes}
            edges={edges}
            quests={quests}
            characters={characters}
            world={world}
            validationIssues={validationIssues}
            onOpenDialogue={() => setActiveSection('dialogue')}
            onOpenStage={openStage}
          />
        )}

        {activeSection === 'quests' && (
          <QuestDesignerPage
            quests={quests}
            graphNodes={questLinkedNodes}
            worldLocations={world.mapLocations}
            onChange={setQuests}
            onOpenDialogue={() => setActiveSection('dialogue')}
          />
        )}

        {activeSection === 'characters' && (
          <CharacterCreatorPage
            characters={characters}
            dialogueNodes={nodes.filter((node) => node.type === 'dialogue')}
            worldLocations={world.mapLocations}
            onChange={setCharacters}
          />
        )}

        {activeSection === 'world' && (
          <WorldBuilderPage
            world={world}
            quests={quests}
            characters={characters}
            onChange={setWorld}
          />
        )}

        {activeSection === 'ai' && (
          <AiQuestGeneratorPage
            world={world}
            characters={characters}
            onImport={importGeneratedQuest}
          />
        )}

        {activeSection === 'dialogue' && (
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
                requestAnimationFrame(() => {
                  if (activeSection === 'dialogue') {
                    centerDialogueView(nodes)
                  }
                })
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={handleSelectionChange}
              fitView={false}
              minZoom={0.45}
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
                characterNames={characterNames}
                worldLocations={world.mapLocations}
                quests={quests}
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
        )}

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
      {data.questId && <span className="quest-node__tag">Quest ID: {data.questId}</span>}
      {data.questObjectiveId && <span className="quest-node__tag">Objective: {data.questObjectiveId}</span>}
      {data.mapLocationId && <span className="quest-node__tag">Map: {data.mapLocationId}</span>}
      {data.objective && <span className="quest-node__tag">Objective: {data.objective}</span>}
      {data.reward && <span className="quest-node__tag">Reward: {data.reward}</span>}
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
}

function DashboardPage({
  activeProjectId,
  projectCatalog,
  projectTitle,
  nodes,
  edges,
  quests,
  characters,
  world,
  validationIssues,
  onLoadProject,
  onOpenDialogue,
  onOpenStage,
}: {
  activeProjectId: string
  projectCatalog: ProjectCatalog
  projectTitle: string
  nodes: QuestNode[]
  edges: QuestEdge[]
  quests: QuestRecord[]
  characters: CharacterRecord[]
  world: WorldRecord
  validationIssues: ValidationIssue[]
  onLoadProject: (projectId: string) => void
  onOpenDialogue: () => void
  onOpenStage: () => void
}) {
  const dialogueCount = nodes.filter((node) => node.type === 'dialogue').length
  const choiceCount = nodes.filter((node) => node.type === 'choice').length
  const treeCount = projectCatalog.projects.length
  const locationCount = world.mapLocations.length
  const factionCount = countLines(world.factions)
  const issueCount = validationIssues.length
  const recentProjects = projectCatalog.projects.slice(0, 6)
  const hasRecentProjects = recentProjects.length > 0

  return (
    <section className="toolkit-page dashboard-page" aria-label="Dashboard">
      <div className="page-header">
        <div>
          <h1>{projectTitle}</h1>
          <p>{world.name}: {world.mainConflict}</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={onOpenDialogue}>
            Open Graph
          </button>
          <button type="button" className="button-primary" onClick={onOpenStage}>
            <Play size={16} aria-hidden="true" />
            Stage Preview
          </button>
        </div>
      </div>

      <div className="stat-strip">
        <span><strong>{nodes.length}</strong> Nodes</span>
        <span><strong>{edges.length}</strong> Links</span>
        <span><strong>{dialogueCount}</strong> Dialogue Lines</span>
        <span><strong>{choiceCount}</strong> Choices</span>
        <span><strong>{quests.length}</strong> Quests</span>
        <span><strong>{treeCount}</strong> Dialogue Trees</span>
        <span><strong>{characters.length}</strong> Characters</span>
        <span><strong>{locationCount}</strong> Locations</span>
        <span><strong>{factionCount}</strong> Factions</span>
        <span><strong>{issueCount}</strong> Validation Flags</span>
      </div>

      <div className="toolkit-grid">
        <section className="tool-panel">
          <div className="panel-heading"><span>Recent Projects</span></div>
          {!hasRecentProjects ? (
            <p className="muted">No saved projects yet. Create a project to begin.</p>
          ) : (
            recentProjects.map((snapshot) => (
              <article key={snapshot.id} className="row-card">
                <strong>{snapshot.title}</strong>
                <span>
                  {snapshot.nodesCount} nodes - {snapshot.edgesCount} links
                </span>
                <small>
                  Updated {new Date(snapshot.lastSavedAt).toLocaleString()}
                </small>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => onLoadProject(snapshot.id)}
                    disabled={snapshot.id === activeProjectId}
                  >
                    {snapshot.id === activeProjectId ? 'Open' : 'Load'}
                  </button>
                  <button type="button" onClick={() => onOpenDialogue()}>
                    Open Graph
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
        <section className="tool-panel">
          <div className="panel-heading"><span>Recent Quests</span></div>
          {quests.length === 0 ? (
            <p className="muted">No quests yet. Generate or create one from Character + Quest tools.</p>
          ) : (
            quests.map((quest) => (
              <article key={quest.id} className="row-card">
                <strong>{quest.title}</strong>
                <span>{quest.giver} - {quest.status}</span>
                <p>{quest.description}</p>
              </article>
            ))
          )}
        </section>
        <section className="tool-panel">
          <div className="panel-heading"><span>Characters</span></div>
          {characters.length === 0 ? (
            <p className="muted">No characters yet. Open Character Creator to add speakers.</p>
          ) : (
            characters.map((character) => (
              <article key={character.id} className="row-card">
                <span
                  className="character-avatar"
                  style={{ '--avatar-color': character.avatarColor, '--avatar-initials': `'${character.name[0]?.toUpperCase() ?? '?'}'` } as React.CSSProperties}
                  aria-hidden="true"
                />
                <strong>{character.name}</strong>
                <span>{character.role} - {character.faction}</span>
                <p>{character.dialogueStyle}</p>
              </article>
            ))
          )}
        </section>
      </div>
    </section>
  )
}
function QuestDesignerPage({
  quests,
  worldLocations,
  graphNodes,
  onChange,
  onOpenDialogue,
}: {
  quests: QuestRecord[]
  worldLocations: WorldMapLocation[]
  graphNodes: QuestNode[]
  onChange: StateSet<QuestRecord[]>
  onOpenDialogue: () => void
}) {
  const updateQuest = (id: string, data: Partial<QuestRecord>) => {
    onChange((current) => current.map((quest) => (quest.id === id ? { ...quest, ...data } : quest)))
  }

  const addQuest = () => {
    const locationId = worldLocations[0]?.id
    onChange((current) => [
      ...current,
      {
        id: prefixedId('quest'),
        title: 'New Quest',
        description: '',
        giver: '',
        status: 'start',
        objectives: '',
        rewards: '',
        locationId,
        stages: [],
        linkedNodeIds: [],
      },
    ])
  }

  const updateQuestStages = (questId: string, stages: QuestObjective[]) => {
    onChange((current) => current.map((quest) => (quest.id === questId ? { ...quest, stages } : quest)))
  }

  const addQuestStage = (questId: string) => {
    onChange((current) =>
      current.map((quest) =>
        quest.id !== questId
          ? quest
          : {
              ...quest,
              stages: [
                ...(quest.stages ?? []),
                {
                  id: prefixedId('stage'),
                  title: 'New Stage',
                  description: '',
                  completed: false,
                },
              ],
            },
      ),
    )
  }

  const updateQuestStage = (questId: string, stageId: string, updates: Partial<QuestObjective>) => {
    onChange((current) =>
      current.map((quest) =>
        quest.id !== questId || !quest.stages
          ? quest
          : {
              ...quest,
              stages: quest.stages.map((stage) => (stage.id === stageId ? { ...stage, ...updates } : stage)),
            },
      ),
    )
  }

  const removeQuestStage = (questId: string, stageId: string) => {
    onChange((current) =>
      current.map((quest) =>
        quest.id !== questId
          ? quest
          : {
              ...quest,
              stages: quest.stages.filter((stage) => stage.id !== stageId),
            },
      ),
    )
  }

  const deleteQuest = (id: string) => {
    onChange((current) => current.filter((quest) => quest.id !== id))
  }

  return (
    <section className="toolkit-page" aria-label="Quest Designer">
      <div className="page-header">
        <div>
          <h1>Quest Designer</h1>
          <p>Track quest structure beside the dialogue nodes that start, update, and complete it.</p>
        </div>
        <button type="button" className="button-primary" onClick={addQuest}>
          <Plus size={16} aria-hidden="true" />
          Quest
        </button>
      </div>

      <div className="toolkit-grid toolkit-grid--wide">
        <section className="tool-panel">
          <div className="panel-heading"><span>Quest Records</span></div>
          {quests.map((quest) => (
            <article key={quest.id} className="record-editor">
              <label>Title<input value={quest.title} onChange={(event) => updateQuest(quest.id, { title: event.target.value })} /></label>
                <label>Description<textarea rows={3} value={quest.description} onChange={(event) => updateQuest(quest.id, { description: event.target.value })} /></label>
              <div className="form-grid">
                <label>Quest Giver<input value={quest.giver} onChange={(event) => updateQuest(quest.id, { giver: event.target.value })} /></label>
                <label>Status
                  <select value={quest.status} onChange={(event) => updateQuest(quest.id, { status: event.target.value as QuestEventType })}>
                    <option value="start">start</option>
                    <option value="update">update</option>
                    <option value="complete">complete</option>
                    <option value="fail">fail</option>
                  </select>
                </label>
                <label>Location
                  <select value={quest.locationId || ''} onChange={(event) => updateQuest(quest.id, { locationId: event.target.value || undefined })}>
                    <option value="">Unlinked</option>
                    {worldLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>Objectives<textarea rows={4} value={quest.objectives} onChange={(event) => updateQuest(quest.id, { objectives: event.target.value })} /></label>
              <div className="record-editor">
                <div className="panel-heading">
                  <span>Quest Stages</span>
                  <button type="button" onClick={() => addQuestStage(quest.id)}>Add Stage</button>
                </div>
                {(quest.stages ?? []).map((stage) => (
                  <article key={stage.id} className="row-card">
                    <label>Title
                      <input value={stage.title} onChange={(event) => updateQuestStage(quest.id, stage.id, { title: event.target.value })} />
                    </label>
                    <label>Description
                      <textarea
                        rows={2}
                        value={stage.description}
                        onChange={(event) => updateQuestStage(quest.id, stage.id, { description: event.target.value })}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={stage.completed}
                        onChange={(event) => updateQuestStage(quest.id, stage.id, { completed: event.target.checked })}
                      />
                      Completed
                    </label>
                    <button type="button" onClick={() => removeQuestStage(quest.id, stage.id)}>Remove Stage</button>
                  </article>
                ))}
                {(quest.stages ?? []).length === 0 ? <span className="issue-empty">No stages added yet.</span> : null}
              </div>
              <label>Rewards<textarea rows={3} value={quest.rewards} onChange={(event) => updateQuest(quest.id, { rewards: event.target.value })} /></label>
              <button type="button" onClick={() => deleteQuest(quest.id)}>Delete Quest</button>
            </article>
          ))}
        </section>

        <section className="tool-panel">
          <div className="panel-heading"><span>Graph Quest Nodes</span></div>
          {graphNodes.map((node) => (
            <article key={node.id} className="row-card">
              <strong>{node.data.title}</strong>
              <span>{nodeMeta[node.type as QuestNodeKind].label}</span>
              <p>{node.data.objective || node.data.reward || node.data.body}</p>
            </article>
          ))}
          <button type="button" onClick={onOpenDialogue}>Edit Quest Nodes in Graph</button>
        </section>
      </div>
    </section>
  )
}

function CharacterCreatorPage({
  characters,
  dialogueNodes,
  worldLocations,
  onChange,
}: {
  characters: CharacterRecord[]
  dialogueNodes: QuestNode[]
  worldLocations: WorldMapLocation[]
  onChange: StateSet<CharacterRecord[]>
}) {
  const updateCharacter = (id: string, data: Partial<CharacterRecord>) => {
    onChange((current) => current.map((character) => (character.id === id ? { ...character, ...data } : character)))
  }

  const addCharacter = () => {
    const location = worldLocations[0]
    onChange((current) => [
      ...current,
      {
        id: prefixedId('character'),
        name: 'New Character',
        role: '',
        personality: '',
        faction: '',
        location: location?.name || '',
        homeLocationId: location?.id,
        notes: '',
        avatarColor: '#7dcfff',
        backstory: '',
        dialogueStyle: '',
      },
    ])
  }

  return (
    <section className="toolkit-page" aria-label="Character Creator">
      <div className="page-header">
        <div>
          <h1>Character Creator</h1>
          <p>Characters here become speaker suggestions in dialogue nodes.</p>
        </div>
        <button type="button" className="button-primary" onClick={addCharacter}>
          <Plus size={16} aria-hidden="true" />
          Character
        </button>
      </div>

      <div className="toolkit-grid toolkit-grid--wide">
        <section className="tool-panel">
          <div className="panel-heading"><span>Character Database</span></div>
          {characters.map((character) => (
            <article key={character.id} className="record-editor">
              <div className="character-header">
                <span
                  className="character-avatar"
                  style={{
                    '--avatar-color': character.avatarColor,
                    '--avatar-initials': `'${character.name[0]?.toUpperCase() ?? '?'}'`,
                  } as React.CSSProperties}
                  aria-hidden="true"
                />
                <span className="character-title">
                  <strong>{character.name || 'Unnamed character'}</strong>
                  <small>{character.location || 'Unlinked location'}</small>
                </span>
              </div>
              <div className="form-grid">
                <label>Name<input value={character.name} onChange={(event) => updateCharacter(character.id, { name: event.target.value })} /></label>
                <label>Role<input value={character.role} onChange={(event) => updateCharacter(character.id, { role: event.target.value })} /></label>
                <label>Faction<input value={character.faction} onChange={(event) => updateCharacter(character.id, { faction: event.target.value })} /></label>
                <label>Location<input value={character.location} onChange={(event) => updateCharacter(character.id, { location: event.target.value })} /></label>
                <label>Home location
                  <select
                    value={character.homeLocationId ?? ''}
                    onChange={(event) => {
                      const nextLocation = worldLocations.find((location) => location.id === event.target.value)
                      updateCharacter(character.id, {
                        homeLocationId: event.target.value || undefined,
                        location: nextLocation?.name || character.location,
                      })
                    }}
                  >
                    <option value="">Unlinked</option>
                    {worldLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>Avatar color
                <input
                  type="text"
                  value={character.avatarColor}
                  onChange={(event) => updateCharacter(character.id, { avatarColor: event.target.value })}
                  placeholder="#7dcfff"
                />
              </label>
              <label>Personality<textarea rows={2} value={character.personality} onChange={(event) => updateCharacter(character.id, { personality: event.target.value })} /></label>
              <label>Backstory<textarea rows={3} value={character.backstory} onChange={(event) => updateCharacter(character.id, { backstory: event.target.value })} /></label>
              <label>Notes<textarea rows={2} value={character.notes} onChange={(event) => updateCharacter(character.id, { notes: event.target.value })} /></label>
              <label>Dialogue Style<textarea rows={2} value={character.dialogueStyle} onChange={(event) => updateCharacter(character.id, { dialogueStyle: event.target.value })} /></label>
            </article>
          ))}
        </section>

        <section className="tool-panel">
          <div className="panel-heading"><span>Dialogue Usage</span></div>
          {dialogueNodes.map((node) => (
            <article key={node.id} className="row-card">
              <strong>{node.data.character || 'Unassigned'}</strong>
              <span>{node.data.title}</span>
              <p>{node.data.body}</p>
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}

function WorldBuilderPage({
  world,
  quests,
  characters,
  onChange,
}: {
  world: WorldRecord
  quests: QuestRecord[]
  characters: CharacterRecord[]
  onChange: StateSet<WorldRecord>
}) {
  const [selectedLocationId, setSelectedLocationId] = useState(world.mapLocations[0]?.id ?? '')
  const [quickTownCount, setQuickTownCount] = useState(7)
  const [dragState, setDragState] = useState<{
    locationId: string
    pointerX: number
    pointerY: number
    startX: number
    startY: number
  } | null>(null)
  const [newRoute, setNewRoute] = useState({
    fromLocationId: '',
    toLocationId: '',
    type: 'road' as MapRouteType,
    danger: 'safe' as WorldMapRoute['danger'],
    label: '',
  })

  const selectedLocation = world.mapLocations.find((location) => location.id === selectedLocationId)
  const linkedQuests = quests.filter((quest) => quest.locationId === selectedLocationId)
  const linkedCharacters = characters.filter((character) => character.homeLocationId === selectedLocationId)
  const locationById = Object.fromEntries(world.mapLocations.map((location) => [location.id, location.name]))

  const updateWorld = (data: Partial<WorldRecord>) => onChange((current) => ({ ...current, ...data }))
  const mapPointFromClient = (element: SVGSVGElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect()
    return {
      x: clamp(((clientX - rect.left) / rect.width) * WORLD_CANVAS.width, 20, WORLD_CANVAS.width - 20),
      y: clamp(((clientY - rect.top) / rect.height) * WORLD_CANVAS.height, 20, WORLD_CANVAS.height - 20),
    }
  }

  const updateLocation = (locationId: string, data: Partial<WorldMapLocation>) => {
    onChange((current) => ({
      ...current,
      mapLocations: current.mapLocations.map((location) =>
        location.id === locationId ? { ...location, ...data } : location,
      ),
    }))
  }

  const addLocation = () => {
    onChange((current) => {
      const nextIndex = current.mapLocations.length + 1
      const nextLocation: WorldMapLocation = {
        id: prefixedId('map-location'),
        name: `Location ${nextIndex}`,
        type: 'town',
        x: 100 + (nextIndex * 97) % (WORLD_CANVAS.width - 180),
        y: 90 + (nextIndex * 47) % (WORLD_CANVAS.height - 160),
        description: '',
        linkedQuestIds: [],
        linkedCharacterIds: [],
      }
      setSelectedLocationId(nextLocation.id)
      return { ...current, mapLocations: [...current.mapLocations, nextLocation] }
    })
  }

  const removeLocation = (locationId: string) => {
    onChange((current) => {
      const nextMapLocations = current.mapLocations.filter((location) => location.id !== locationId)
      const nextMapRoutes = current.mapRoutes.filter(
        (route) => route.fromLocationId !== locationId && route.toLocationId !== locationId,
      )
      if (selectedLocationId === locationId) {
        setSelectedLocationId(nextMapLocations[0]?.id ?? '')
      }
      return { ...current, mapLocations: nextMapLocations, mapRoutes: nextMapRoutes }
    })
  }

  const generateQuickMapLocations = () => {
    const count = Math.max(4, Math.min(12, Number(quickTownCount) || 7))
    const generated = buildQuickMap(world, count)
    const generatedNames = generated.locations.map((location) => location.name)
    onChange((current) => ({
      ...current,
      mapLocations: [...current.mapLocations, ...generated.locations],
      mapRoutes: [...current.mapRoutes, ...generated.routes],
      locations: [...new Set([...splitLines(current.locations), ...generatedNames])].join('\n'),
    }))
    if (!selectedLocationId && generated.locations[0]) {
      setSelectedLocationId(generated.locations[0].id)
    }
  }

  const addRoute = () => {
    if (!newRoute.fromLocationId || !newRoute.toLocationId || newRoute.fromLocationId === newRoute.toLocationId) {
      return
    }
    onChange((current) => ({
      ...current,
      mapRoutes: [
        ...current.mapRoutes,
        {
          id: prefixedId('route'),
          fromLocationId: newRoute.fromLocationId,
          toLocationId: newRoute.toLocationId,
          type: newRoute.type,
          danger: newRoute.danger,
          label: newRoute.label.trim(),
        },
      ],
    }))
    setNewRoute((current) => ({
      ...current,
      toLocationId: '',
      label: '',
    }))
  }

  const deleteRoute = (routeId: string) => {
    onChange((current) => ({
      ...current,
      mapRoutes: current.mapRoutes.filter((route) => route.id !== routeId),
    }))
  }

  const handlePointerDown = (event: React.PointerEvent<SVGElement>, locationId: string) => {
    const svg = (event.currentTarget as SVGGraphicsElement).ownerSVGElement
    if (!svg) {
      return
    }
    const location = world.mapLocations.find((entry) => entry.id === locationId)
    if (!location) {
      return
    }

    const point = mapPointFromClient(svg, event.clientX, event.clientY)
    setSelectedLocationId(locationId)
    setDragState({
      locationId,
      pointerX: point.x,
      pointerY: point.y,
      startX: location.x,
      startY: location.y,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) {
      return
    }
    const point = mapPointFromClient(event.currentTarget, event.clientX, event.clientY)
    updateLocation(dragState.locationId, {
      x: Math.round(clamp(dragState.startX + (point.x - dragState.pointerX), 20, WORLD_CANVAS.width - 20)),
      y: Math.round(clamp(dragState.startY + (point.y - dragState.pointerY), 20, WORLD_CANVAS.height - 20)),
    })
  }

  const handlePointerUp = () => {
    setDragState(null)
  }

  return (
    <section className="toolkit-page" aria-label="World Builder">
      <div className="page-header">
        <div>
          <h1>World Builder</h1>
          <p>Keep setting, factions, locations, quests, and characters in one design surface.</p>
        </div>
      </div>

      <div className="toolkit-grid toolkit-grid--wide">
        <section className="tool-panel record-editor">
          <label>World Name<input value={world.name} onChange={(event) => updateWorld({ name: event.target.value })} /></label>
          <label>Setting Description<textarea rows={4} value={world.setting} onChange={(event) => updateWorld({ setting: event.target.value })} /></label>
          <label>Main Conflict<textarea rows={3} value={world.mainConflict} onChange={(event) => updateWorld({ mainConflict: event.target.value })} /></label>
          <div className="form-grid">
            <label>Regions<textarea rows={5} value={world.regions} onChange={(event) => updateWorld({ regions: event.target.value })} /></label>
            <label>Locations<textarea rows={5} value={world.locations} onChange={(event) => updateWorld({ locations: event.target.value })} /></label>
            <label>Factions<textarea rows={5} value={world.factions} onChange={(event) => updateWorld({ factions: event.target.value })} /></label>
          </div>
          <div className="record-editor">
            <div className="panel-heading">
              <span>Map Location Links</span>
              <button type="button" onClick={addLocation}>Add location</button>
            </div>
            <div className="button-row">
              <label>
                Quick towns
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={quickTownCount}
                  onChange={(event) => setQuickTownCount(Number(event.target.value || 7))}
                />
              </label>
              <button type="button" onClick={generateQuickMapLocations}>
                Generate map
              </button>
            </div>
            <label>Select Map Location
              <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
                {world.mapLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Location Name
              <input
                value={selectedLocation?.name ?? ''}
                onChange={(event) => selectedLocation && updateLocation(selectedLocation.id, { name: event.target.value })}
                disabled={!selectedLocation}
              />
            </label>
            <div className="form-grid">
              <label>Type
                <select
                  value={selectedLocation?.type ?? 'town'}
                  onChange={(event) =>
                    selectedLocation && updateLocation(selectedLocation.id, { type: event.target.value as MapLocationType })
                  }
                  disabled={!selectedLocation}
                >
                  {mapLocationTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>Faction<input
                value={selectedLocation?.faction ?? ''}
                onChange={(event) =>
                  selectedLocation && updateLocation(selectedLocation.id, { faction: event.target.value })
                }
                disabled={!selectedLocation}
              /></label>
            </div>
            <label>Description<textarea
              rows={2}
              value={selectedLocation?.description ?? ''}
              onChange={(event) =>
                selectedLocation && updateLocation(selectedLocation.id, { description: event.target.value })
              }
              disabled={!selectedLocation}
            /></label>
            <button
              type="button"
              onClick={() => selectedLocation && removeLocation(selectedLocation.id)}
              disabled={!selectedLocation}
            >
              Remove Selected
            </button>
          </div>
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <span>World Map</span>
          </div>
          <svg
            className="world-map-canvas"
            viewBox={`0 0 ${WORLD_CANVAS.width} ${WORLD_CANVAS.height}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <rect width={WORLD_CANVAS.width} height={WORLD_CANVAS.height} fill="#101217" stroke="#343a46" />
            {world.mapRoutes.map((route) => {
              const from = world.mapLocations.find((location) => location.id === route.fromLocationId)
              const to = world.mapLocations.find((location) => location.id === route.toLocationId)
              if (!from || !to) {
                return null
              }
              const lineColor =
                route.danger === 'safe' ? '#7dcfff' : route.danger === 'contested' ? '#f7c56c' : '#f06a6a'
              return (
                <g key={route.id}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={lineColor} strokeWidth={3} strokeLinecap="round" />
                  <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} fill="#9aa3b2" fontSize={11} textAnchor="middle">
                    {route.label || route.type}
                  </text>
                </g>
              )
            })}
            {world.mapLocations.map((location) => (
              <g
                key={location.id}
                onClick={() => setSelectedLocationId(location.id)}
                onPointerDown={(event) => handlePointerDown(event, location.id)}
              >
                <circle
                  cx={location.x}
                  cy={location.y}
                  r={10}
                  fill={selectedLocationId === location.id ? '#ffcb6b' : '#6cb6ff'}
                  stroke="#181b22"
                  strokeWidth={2}
                />
                <text x={location.x + 10} y={location.y - 10} fill="#e7eaf0" fontSize={11}>
                  {location.name}
                </text>
              </g>
            ))}
          </svg>
          <div className="form-grid">
            <label>Linked Quests
              <span>{linkedQuests.length}</span>
            </label>
            <label>Linked Characters
              <span>{linkedCharacters.length}</span>
            </label>
          </div>
          <div className="button-row">
            <label>From
              <select
                value={newRoute.fromLocationId}
                onChange={(event) => setNewRoute((current) => ({ ...current, fromLocationId: event.target.value }))}
              >
                <option value="">Select</option>
                {world.mapLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label>To
              <select
                value={newRoute.toLocationId}
                onChange={(event) => setNewRoute((current) => ({ ...current, toLocationId: event.target.value }))}
              >
                <option value="">Select</option>
                {world.mapLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Path type
              <select value={newRoute.type} onChange={(event) => setNewRoute((current) => ({ ...current, type: event.target.value as MapRouteType }))}>
                {mapRouteTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>Danger
              <select
                value={newRoute.danger}
                onChange={(event) =>
                  setNewRoute((current) => ({ ...current, danger: event.target.value as WorldMapRoute['danger'] }))
                }
              >
                {mapRouteDangerOptions.map((danger) => (
                  <option key={danger} value={danger}>
                    {danger}
                  </option>
                ))}
              </select>
            </label>
            <label>Label
              <input value={newRoute.label} onChange={(event) => setNewRoute((current) => ({ ...current, label: event.target.value }))} />
            </label>
          </div>
          <div className="button-row">
            <button type="button" onClick={addRoute}>Add route</button>
          </div>
          <div className="panel-heading"><span>Routes</span></div>
          <div className="link-list">
            {world.mapRoutes.length ? (
              world.mapRoutes.map((route) => (
                <div key={route.id} className="row-card">
                  <strong>
                    {locationById[route.fromLocationId] || route.fromLocationId}
                    {' -> '}
                    {locationById[route.toLocationId] || route.toLocationId}
                  </strong>
                  <span>{route.type} - {route.danger}</span>
                  {route.label && <span>{route.label}</span>}
                  <button type="button" onClick={() => deleteRoute(route.id)}>Delete route</button>
                </div>
              ))
            ) : (
              <span className="issue-empty">No routes yet</span>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

function AiQuestGeneratorPage({
  world,
  characters,
  onImport,
}: {
  world: WorldRecord
  characters: CharacterRecord[]
  onImport: (generated: GeneratedQuest) => void
}) {
  const [form, setForm] = useState<GeneratorForm>({
    idea: 'Create a quest about a mechanic who lost a rare engine part in a cyberpunk city.',
    genre: 'Cyberpunk RPG',
    tone: 'Tense, grounded, noir',
    context: '',
  })
  const [generated, setGenerated] = useState<GeneratedQuest | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const updateForm = (data: Partial<GeneratorForm>) => {
    setForm((current) => ({ ...current, ...data }))
    setError('')
  }

  const generateWithApi = async () => {
    setLoading(true)
    setError('')
    try {
      const nextGenerated = await requestGeneratedQuest(form, world, characters)
      setGenerated(nextGenerated)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const generateLocalDraft = () => {
    try {
      setGenerated(validateGeneratedQuest(buildLocalGeneratedQuest(form, world)))
      setError('')
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Could not create a draft.')
    }
  }

  return (
    <section className="toolkit-page" aria-label="AI Quest Generator">
      <div className="page-header">
        <div>
          <h1>Generate Playable Quest</h1>
          <p>Create a reviewed quest package that imports into characters, quests, dialogue nodes, and Preview Mode.</p>
        </div>
      </div>

      <div className="toolkit-grid toolkit-grid--wide">
        <section className="tool-panel record-editor">
          <label>
            Quest Idea
            <textarea
              rows={4}
              value={form.idea}
              onChange={(event) => updateForm({ idea: event.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Genre
              <input value={form.genre} onChange={(event) => updateForm({ genre: event.target.value })} />
            </label>
            <label>
              Tone
              <input value={form.tone} onChange={(event) => updateForm({ tone: event.target.value })} />
            </label>
          </div>
          <label>
            Optional Context
            <textarea
              rows={5}
              value={form.context}
              onChange={(event) => updateForm({ context: event.target.value })}
              placeholder={`${world.name}: ${world.mainConflict}`}
            />
          </label>
          <div className="button-row">
            <button type="button" className="button-primary" onClick={generateWithApi} disabled={loading || !form.idea.trim()}>
              <Sparkles size={16} aria-hidden="true" />
              {loading ? 'Generating' : 'Generate with API'}
            </button>
            <button type="button" onClick={generateLocalDraft} disabled={!form.idea.trim()}>
              Create Local Draft
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="tool-panel">
          <div className="panel-heading"><span>Review Package</span></div>
          {generated ? (
            <div className="generated-review">
              <article className="row-card">
                <strong>{generated.quest.title}</strong>
                <span>{generated.quest.giver} - {generated.quest.status}</span>
                <p>{generated.quest.description}</p>
              </article>
              <div className="review-list">
                <span>{generated.characters.length} character record(s)</span>
                <span>{generated.project.nodes.length} dialogue graph node(s)</span>
                <span>{generated.project.edges.length} connection(s)</span>
              </div>
              <pre>{JSON.stringify(generated, null, 2)}</pre>
              <button type="button" className="button-primary" onClick={() => onImport(generated)}>
                Import into Project
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <h2>No generated quest</h2>
              <p>Generate a package, review the JSON, then import it into the project.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

function InspectorPanel({
  selectedNode,
  selectedEdge,
  characterNames,
  worldLocations,
  quests,
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
  characterNames: string[]
  worldLocations: WorldMapLocation[]
  quests: QuestRecord[]
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
          <NodeInspector
            node={selectedNode}
            characterNames={characterNames}
            worldLocations={worldLocations}
            quests={quests}
            onChange={onNodeChange}
          />
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
  characterNames,
  worldLocations,
  quests,
  onChange,
}: {
  node: QuestNode
  characterNames: string[]
  worldLocations: WorldMapLocation[]
  quests: QuestRecord[]
  onChange: (data: Partial<QuestNodeData>) => void
}) {
  const kind = node.type as QuestNodeKind
  const meta = nodeMeta[kind]
  const Icon = meta.icon
  const linkedQuest = node.data.questId ? quests.find((quest) => quest.id === node.data.questId) : null
  const linkedObjectives = linkedQuest?.stages ?? []

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

      <div className="form-grid">
        <label>
          Quest
          <select
            value={node.data.questId || ''}
            onChange={(event) => onChange({ questId: event.target.value || undefined })}
          >
            <option value="">Unlinked</option>
            {quests.map((quest) => (
              <option key={quest.id} value={quest.id}>
                {quest.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Map Location
          <select
            value={node.data.mapLocationId || ''}
            onChange={(event) => onChange({ mapLocationId: event.target.value || undefined })}
          >
            <option value="">None</option>
            {worldLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {kind === 'dialogue' && (
        <label>
          Speaker
          <input
            list="character-speakers"
            value={node.data.character ?? ''}
            onChange={(event) => onChange({ character: event.target.value })}
          />
          <datalist id="character-speakers">
            {characterNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      )}

      {(kind === 'objective' || kind === 'reward' || kind === 'quest_event') && (
        <label>
          Quest Objective
          <select
            value={node.data.questObjectiveId || ''}
            onChange={(event) => onChange({ questObjectiveId: event.target.value || undefined })}
            disabled={linkedObjectives.length === 0}
          >
            <option value="">None</option>
            {linkedObjectives.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.title}
              </option>
            ))}
          </select>
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
    id: prefixedId(type),
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

function readStoredQuests(): QuestRecord[] {
  const raw = localStorage.getItem(QUESTS_STORAGE_KEY)
  if (!raw) {
    return sampleQuests
  }

  try {
    const parsed = JSON.parse(raw) as QuestRecord[]
    return Array.isArray(parsed)
      ? parsed.map((quest) => ({
          id: quest.id || prefixedId('quest'),
          title: quest.title || 'Untitled Quest',
          description: quest.description || '',
          giver: quest.giver || '',
          status: normalizeQuestStatus(quest.status),
          objectives: quest.objectives || '',
          rewards: quest.rewards || '',
          locationId: quest.locationId,
          stages: Array.isArray(quest.stages)
            ? quest.stages.map((stage) => ({
                id: stage.id || prefixedId('stage'),
                title: stage.title || '',
                description: stage.description || '',
                completed: Boolean(stage.completed),
              }))
            : [],
          linkedNodeIds: Array.isArray(quest.linkedNodeIds) ? quest.linkedNodeIds : [],
        }))
      : sampleQuests
  } catch {
    return sampleQuests
  }
}

function readStoredCharacters(): CharacterRecord[] {
  const raw = localStorage.getItem(CHARACTERS_STORAGE_KEY)
  if (!raw) {
    return sampleCharacters
  }

  try {
    const parsed = JSON.parse(raw) as CharacterRecord[]
    return Array.isArray(parsed)
      ? parsed.map((character) => ({
          id: character.id || prefixedId('character'),
          name: character.name || 'Unnamed character',
          role: character.role || '',
          personality: character.personality || '',
          faction: character.faction || '',
          location: character.location || '',
          homeLocationId: character.homeLocationId,
          backstory: character.backstory || '',
          dialogueStyle: character.dialogueStyle || '',
          notes: character.notes || '',
          avatarColor: character.avatarColor || '#6cb6ff',
        }))
      : sampleCharacters
  } catch {
    return sampleCharacters
  }
}

function readStoredWorld(): WorldRecord {
  const raw = localStorage.getItem(WORLD_STORAGE_KEY)
  if (!raw) {
    return sampleWorld
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorldRecord>
    return {
      ...sampleWorld,
      ...parsed,
      mapRegions: Array.isArray(parsed.mapRegions)
        ? parsed.mapRegions.map((region, index) => ({
            id: region.id || prefixedId('region'),
            name: region.name || `Region ${index + 1}`,
            color: region.color,
          }))
        : sampleWorld.mapRegions,
      mapLocations: Array.isArray(parsed.mapLocations)
        ? parsed.mapLocations.map((location, index) => ({
            id: location.id || prefixedId('map-location'),
            name: location.name || `Location ${index + 1}`,
            type: mapLocationTypeOptions.includes(location.type) ? location.type : 'town',
            x: Number.isFinite(location.x) ? location.x : 160 + (index * 120) % (WORLD_CANVAS.width - 140),
            y: Number.isFinite(location.y) ? location.y : 100 + (index * 90) % (WORLD_CANVAS.height - 120),
            region: location.region,
            faction: location.faction,
            description: location.description || '',
            linkedQuestIds: Array.isArray(location.linkedQuestIds) ? location.linkedQuestIds : [],
            linkedCharacterIds: Array.isArray(location.linkedCharacterIds) ? location.linkedCharacterIds : [],
          }))
        : sampleWorld.mapLocations,
      mapRoutes: Array.isArray(parsed.mapRoutes)
        ? parsed.mapRoutes.map((route) => ({
            id: route.id || prefixedId('route'),
            fromLocationId: route.fromLocationId,
            toLocationId: route.toLocationId,
            type: mapRouteTypeOptions.includes(route.type) ? route.type : 'road',
            danger: route.danger === 'safe' || route.danger === 'contested' || route.danger === 'dangerous' ? route.danger : 'safe',
            label: route.label || '',
          }))
        : sampleWorld.mapRoutes,
    }
  } catch {
    return sampleWorld
  }
}

async function requestGeneratedQuest(
  form: GeneratorForm,
  world: WorldRecord,
  characters: CharacterRecord[],
): Promise<GeneratedQuest> {
  if (!AI_GENERATOR_ENDPOINT) {
    throw new Error('AI endpoint is not configured. Set VITE_AI_GENERATOR_ENDPOINT or create a local draft.')
  }

  const response = await fetch(AI_GENERATOR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idea: form.idea.trim(),
      genre: form.genre.trim(),
      tone: form.tone.trim(),
      context: form.context.trim(),
      world,
      characters: characters.slice(0, 12),
      output: 'GeneratedQuest JSON with quest, characters, and project fields.',
    }),
  })

  if (!response.ok) {
    throw new Error('AI proxy is not available. Check the configured generator endpoint or create a local draft.')
  }

  return validateGeneratedQuest(await response.json())
}

function validateGeneratedQuest(value: unknown): GeneratedQuest {
  const generated = value as Partial<GeneratedQuest>
  if (!generated.quest || !generated.project || !Array.isArray(generated.characters)) {
    throw new Error('Generated JSON is incomplete.')
  }

  const quest = generated.quest as QuestRecord
  if (!quest.title?.trim() || !quest.description?.trim() || !quest.giver?.trim()) {
    throw new Error('Generated quest is missing title, description, or quest giver.')
  }

  const characters = generated.characters as CharacterRecord[]
  if (characters.some((character) => !character.name?.trim() || !character.role?.trim())) {
    throw new Error('Generated character records are incomplete.')
  }

  const project = migrateProject(generated.project)
  const graphIssues = validateGraph(project.nodes, project.edges).filter((issue) => issue.severity === 'error')
  if (graphIssues.length > 0) {
    throw new Error(`Generated graph is not playable: ${graphIssues[0].message}`)
  }

  return {
    quest: {
      ...quest,
      id: quest.id || prefixedId('quest'),
      status: normalizeQuestStatus(quest.status),
      linkedNodeIds: Array.isArray(quest.linkedNodeIds) ? quest.linkedNodeIds : [],
      stages: Array.isArray(quest.stages)
        ? quest.stages.map((stage) => ({
            id: stage.id || prefixedId('stage'),
            title: stage.title || 'Stage',
            description: stage.description || '',
            completed: Boolean(stage.completed),
          }))
        : [],
      locationId: quest.locationId,
      objectives: quest.objectives || '',
      rewards: quest.rewards || '',
    },
    characters: characters.map((character) => ({
      ...character,
      id: character.id || prefixedId('character'),
      role: character.role || 'Unknown',
      personality: character.personality || '',
      faction: character.faction || '',
      location: character.location || '',
      homeLocationId: character.homeLocationId,
      backstory: character.backstory || '',
      dialogueStyle: character.dialogueStyle || '',
      notes: character.notes || '',
      avatarColor: character.avatarColor || '#6cb6ff',
    })),
    project,
  }
}

function buildLocalGeneratedQuest(form: GeneratorForm, world: WorldRecord): GeneratedQuest {
  const id = buildRandomId()
  const title = titleFromIdea(form.idea)
  const giverName = form.idea.toLowerCase().includes('mechanic') ? 'Rook Vale' : 'Ari Vale'
  const locationId = world.mapLocations[0]?.id
  const objectiveId = `objective-${id}`
  const quest: QuestRecord = {
    id: `quest-${id}`,
    title,
    description: `${form.idea.trim()} Built for ${form.genre || 'RPG'} with a ${form.tone || 'grounded'} tone.`,
    giver: giverName,
    status: 'start',
    objectives: 'Meet the quest giver\nInvestigate the missing item\nChoose how to resolve the lead\nReturn for closure',
    rewards: 'XP\nFaction reputation\nRare crafting component',
    locationId,
    stages: [
      {
        id: objectiveId,
        title: 'Find the missing item',
        description: 'Track the missing component and return proof.',
        completed: false,
      },
    ],
  }
  const character: CharacterRecord = {
    id: `character-${id}`,
    name: giverName,
    role: 'Quest giver',
    personality: 'Sharp, worried, practical under pressure',
    faction: world.factions.split('\n')[0] || 'Independent',
    location: world.locations.split('\n')[0] || 'Quest hub',
    backstory: `${giverName} is tied to the problem in the quest idea and needs the player to solve it before the situation escalates.`,
    dialogueStyle: 'Concise, specific, and slightly guarded.',
    notes: `Created for: ${title}`,
    avatarColor: '#7dcfff',
  }
  const nodePrefix = `generated-${id}`
  const project: QuestProject = {
    version: 2,
    id: `project-${id}`,
    title,
    lastSavedAt: new Date().toISOString(),
    notes: [
      {
        id: `note-${id}`,
        kind: 'note',
        title: 'Generated brief',
        body: `Idea: ${form.idea.trim()}\nGenre: ${form.genre}\nTone: ${form.tone}\nContext: ${form.context || world.setting}`,
      },
    ],
    nodes: [
      createTemplateNode(`${nodePrefix}-start`, 'start', 0, 100, 'Start', `The player meets ${giverName}.`),
      createTemplateNode(
        `${nodePrefix}-dialogue`,
        'dialogue',
        330,
        100,
        'Quest Briefing',
        `I need help with this: ${form.idea.trim()}`,
        { character: giverName },
      ),
      createTemplateNode(`${nodePrefix}-choice`, 'choice', 660, 100, 'Take the job?', 'The player chooses how to respond.'),
      createTemplateNode(`${nodePrefix}-quest`, 'quest_event', 990, 0, 'Quest Started', `${title} added to the quest log.`, {
        questId: `quest-${id}`,
        eventType: 'start',
      }),
      createTemplateNode(`${nodePrefix}-objective`, 'objective', 1320, 0, 'Track the Lead', 'The main objective is added.', {
        questId: `quest-${id}`,
        questObjectiveId: objectiveId,
        objective: 'Find the missing item and discover who moved it.',
      }),
      createTemplateNode(`${nodePrefix}-reward`, 'reward', 1650, 0, 'Resolution Reward', 'The player receives the reward.', {
        questId: `quest-${id}`,
        reward: quest.rewards.replace(/\n/g, ', '),
      }),
      createTemplateNode(`${nodePrefix}-end-success`, 'end', 1980, 0, 'Quest Complete', 'The quest ends successfully.', {
        eventType: 'complete',
      }),
      createTemplateNode(`${nodePrefix}-decline`, 'dialogue', 990, 230, 'Decline Response', 'Then I need to find someone else before this gets worse.', {
        character: giverName,
      }),
      createTemplateNode(`${nodePrefix}-end-decline`, 'end', 1320, 230, 'Quest Refused', 'The player leaves the quest unresolved.', {
        eventType: 'fail',
      }),
    ],
    edges: [
      makeEdge(`${nodePrefix}-edge-1`, `${nodePrefix}-start`, `${nodePrefix}-dialogue`, 'Begin'),
      makeEdge(`${nodePrefix}-edge-2`, `${nodePrefix}-dialogue`, `${nodePrefix}-choice`, 'Respond'),
      makeEdge(`${nodePrefix}-edge-3`, `${nodePrefix}-choice`, `${nodePrefix}-quest`, 'Accept'),
      makeEdge(`${nodePrefix}-edge-4`, `${nodePrefix}-quest`, `${nodePrefix}-objective`, 'Track'),
      makeEdge(`${nodePrefix}-edge-5`, `${nodePrefix}-objective`, `${nodePrefix}-reward`, 'Complete'),
      makeEdge(`${nodePrefix}-edge-6`, `${nodePrefix}-reward`, `${nodePrefix}-end-success`, 'End'),
      makeEdge(`${nodePrefix}-edge-7`, `${nodePrefix}-choice`, `${nodePrefix}-decline`, 'Decline'),
      makeEdge(`${nodePrefix}-edge-8`, `${nodePrefix}-decline`, `${nodePrefix}-end-decline`, 'Leave'),
    ],
  }

  return { quest, characters: [character], project }
}

function titleFromIdea(idea: string): string {
  const cleanIdea = idea
    .replace(/^create a quest about\s+/i, '')
    .replace(/^a quest about\s+/i, '')
    .replace(/[.?!]+$/g, '')
    .trim()
  const words = cleanIdea.split(/\s+/).filter((word) => !['a', 'an', 'the', 'who', 'lost'].includes(word.toLowerCase()))
  const titleWords = words.slice(0, 5).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  return titleWords.length ? titleWords.join(' ') : 'Generated Quest'
}

function migrateProject(project: Partial<QuestProject>): QuestProject {
  if (!Array.isArray(project.nodes) || !Array.isArray(project.edges)) {
    throw new Error('Invalid project')
  }

  return {
    version: 2,
    id: project.id || prefixedId('project'),
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
        questId: node.data?.questId,
        questObjectiveId: node.data?.questObjectiveId,
        mapLocationId: node.data?.mapLocationId,
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




