const AI_RESPONSES_URL = process.env.AI_RESPONSES_URL || 'https://api.openai.com/v1/responses'
const DEFAULT_AI_MODEL = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'giver', 'objectives', 'rewards', 'characters', 'briefing', 'acceptLine', 'declineLine'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    giver: { type: 'string' },
    objectives: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
    rewards: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
    characters: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role', 'personality', 'faction', 'location', 'backstory', 'dialogueStyle'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          personality: { type: 'string' },
          faction: { type: 'string' },
          location: { type: 'string' },
          backstory: { type: 'string' },
          dialogueStyle: { type: 'string' },
        },
      },
    },
    briefing: { type: 'string' },
    acceptLine: { type: 'string' },
    declineLine: { type: 'string' },
  },
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const input = normalizeInput(typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
    const aiPackage = await generateQuestPackage(input)
    res.status(200).json(toGeneratedQuest(aiPackage, input))
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : 'Quest generation failed',
    })
  }
}

function normalizeInput(body = {}) {
  const idea = String(body.idea || '').trim()
  if (idea.length < 10) {
    const error = new Error('Quest idea must be at least 10 characters.')
    error.statusCode = 400
    throw error
  }

  return {
    idea: idea.slice(0, 1200),
    genre: String(body.genre || 'RPG').trim().slice(0, 160),
    tone: String(body.tone || 'Grounded').trim().slice(0, 160),
    context: String(body.context || '').trim().slice(0, 1600),
    objectives: String(body.objectives || '').trim().slice(0, 1200),
    complications: String(body.complications || '').trim().slice(0, 1200),
    styleNotes: String(body.styleNotes || '').trim().slice(0, 1200),
    requiredOutcome: String(body.requiredOutcome || '').trim().slice(0, 1200),
    failureConditions: String(body.failureConditions || '').trim().slice(0, 1200),
    worldHooks: String(body.worldHooks || '').trim().slice(0, 1200),
    world: body.world && typeof body.world === 'object' ? body.world : {},
    characters: Array.isArray(body.characters) ? body.characters.slice(0, 8) : [],
  }
}

async function generateQuestPackage(input) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY
  if (!apiKey) {
    const error = new Error('AI API key is not configured. Set OPENAI_API_KEY or CODEX_API_KEY.')
    error.statusCode = 500
    throw error
  }

  const response = await fetch(AI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_AI_MODEL,
                input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Generate a concise RPG quest package for Narrative Forge.',
                'Return only data that can become a playable branching dialogue quest.',
                'Avoid copyrighted settings, real people, sexual content, hateful content, and graphic violence.',
                JSON.stringify(input),
                input.objectives ? `Focus on these objectives: ${input.objectives}` : '',
                input.complications ? `Include these complications or twists: ${input.complications}` : '',
                input.styleNotes ? `Dialogue and tone notes: ${input.styleNotes}` : '',
                input.requiredOutcome ? `Required outcome before completion: ${input.requiredOutcome}` : '',
                input.failureConditions ? `Failure or penalty guidance: ${input.failureConditions}` : '',
                input.worldHooks ? `Tie this into these world hooks: ${input.worldHooks}` : '',
              ].join('\n\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'narrative_forge_quest',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'OpenAI generation request failed.')
    error.statusCode = response.status
    throw error
  }

  return parseResponseJson(payload)
}

function parseResponseJson(payload) {
  if (typeof payload.output_text === 'string') {
    return JSON.parse(payload.output_text)
  }

  const text = payload.output
    ?.flatMap((item) => item.content || [])
    .find((content) => content.type === 'output_text')?.text

  if (!text) {
    throw new Error('AI response did not include structured output text.')
  }

  return JSON.parse(text)
}

function toGeneratedQuest(aiPackage, input) {
  const id = crypto.randomUUID()
  const prefix = `ai-${id}`
  const giver = clean(aiPackage.giver) || clean(aiPackage.characters?.[0]?.name) || 'Quest Giver'
  const title = clean(aiPackage.title) || 'Generated Quest'
  const objectives = cleanList(aiPackage.objectives)
  const rewards = cleanList(aiPackage.rewards)
  const characters = cleanCharacters(aiPackage.characters, giver, input)
  const quest = {
    id: `quest-${id}`,
    title,
    description: clean(aiPackage.description) || input.idea,
    giver,
    status: 'start',
    objectives: objectives.join('\n'),
    rewards: rewards.join('\n'),
  }

  return {
    quest,
    characters,
    project: {
      version: 2,
      id: `project-${id}`,
      title,
      lastSavedAt: new Date().toISOString(),
      notes: [
        {
          id: `note-${id}`,
          kind: 'note',
          title: 'AI generation brief',
          body: `Idea: ${input.idea}\nGenre: ${input.genre}\nTone: ${input.tone}\nRequired Outcome: ${input.requiredOutcome}\nObjectives: ${input.objectives}\nComplications: ${input.complications}\nFailure / Stakes: ${input.failureConditions}\nWorld Hooks: ${input.worldHooks}\nContext: ${input.context || input.world?.setting || ''}`,
        },
      ],
      nodes: buildNodes(prefix, title, giver, aiPackage, objectives, rewards),
      edges: buildEdges(prefix),
    },
  }
}

function buildNodes(prefix, title, giver, aiPackage, objectives, rewards) {
  return [
    node(`${prefix}-start`, 'start', 0, 100, 'Start', `The player meets ${giver}.`),
    node(`${prefix}-briefing`, 'dialogue', 330, 100, 'Quest Briefing', clean(aiPackage.briefing), { character: giver }),
    node(`${prefix}-choice`, 'choice', 660, 100, 'Take the job?', 'The player decides whether to help.'),
    node(`${prefix}-quest`, 'quest_event', 990, 0, 'Quest Started', `${title} added to the quest log.`, { eventType: 'start' }),
    node(`${prefix}-objective`, 'objective', 1320, 0, objectives[0] || 'Track the lead', 'Objective added to the quest log.', {
      objective: objectives[0] || 'Track the lead',
    }),
    node(`${prefix}-reward`, 'reward', 1650, 0, 'Reward', 'The player receives the quest reward.', {
      reward: rewards.join(', '),
    }),
    node(`${prefix}-complete`, 'end', 1980, 0, 'Quest Complete', clean(aiPackage.acceptLine), { eventType: 'complete' }),
    node(`${prefix}-decline`, 'dialogue', 990, 230, 'Decline Response', clean(aiPackage.declineLine), { character: giver }),
    node(`${prefix}-refused`, 'end', 1320, 230, 'Quest Refused', 'The player leaves the quest unresolved.', { eventType: 'fail' }),
  ]
}

function buildEdges(prefix) {
  return [
    edge(`${prefix}-edge-1`, `${prefix}-start`, `${prefix}-briefing`, 'Begin'),
    edge(`${prefix}-edge-2`, `${prefix}-briefing`, `${prefix}-choice`, 'Respond'),
    edge(`${prefix}-edge-3`, `${prefix}-choice`, `${prefix}-quest`, 'Accept'),
    edge(`${prefix}-edge-4`, `${prefix}-quest`, `${prefix}-objective`, 'Track'),
    edge(`${prefix}-edge-5`, `${prefix}-objective`, `${prefix}-reward`, 'Complete'),
    edge(`${prefix}-edge-6`, `${prefix}-reward`, `${prefix}-complete`, 'Finish'),
    edge(`${prefix}-edge-7`, `${prefix}-choice`, `${prefix}-decline`, 'Decline'),
    edge(`${prefix}-edge-8`, `${prefix}-decline`, `${prefix}-refused`, 'Leave'),
  ]
}

function node(id, type, x, y, title, body, data = {}) {
  return { id, type, position: { x, y }, data: { title, body, ...data } }
}

function edge(id, source, target, label) {
  return {
    id,
    source,
    target,
    label,
    data: { label },
    markerEnd: { type: 'arrowclosed' },
  }
}

function clean(value) {
  return String(value || '').trim().slice(0, 1000)
}

function cleanList(value) {
  return (Array.isArray(value) ? value : [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 5)
}

function cleanCharacters(value, giver, input) {
  const source = Array.isArray(value) && value.length ? value : [{ name: giver, role: 'Quest giver' }]
  return source.slice(0, 3).map((character) => ({
    id: `character-${crypto.randomUUID()}`,
    name: clean(character.name) || giver,
    role: clean(character.role) || 'Quest giver',
    personality: clean(character.personality) || 'Focused and practical',
    faction: clean(character.faction) || clean(input.world?.factions)?.split('\n')[0] || 'Independent',
    location: clean(character.location) || clean(input.world?.locations)?.split('\n')[0] || 'Quest hub',
    backstory: clean(character.backstory) || `Connected to: ${input.idea}`,
    dialogueStyle: clean(character.dialogueStyle) || 'Concise and specific',
  }))
}
