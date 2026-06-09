const assert = require('node:assert/strict')

async function main() {
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_MODEL = 'test-model'

  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'test-model')
    assert.equal(body.text.format.type, 'json_schema')
    assert.equal(body.text.format.strict, true)

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          output_text: JSON.stringify({
            title: 'The Missing Turbo Core',
            description: 'A mechanic needs a rare engine part recovered before a street race collapses.',
            giver: 'Nix Calder',
            objectives: ['Talk to Nix', 'Search the alley market', 'Recover the turbo core'],
            rewards: ['200 XP', 'Turbo Core Blueprint'],
            characters: [
              {
                name: 'Nix Calder',
                role: 'Mechanic',
                personality: 'Nervous, fast-talking, loyal',
                faction: 'Neon Wrench Crew',
                location: 'Lower Grid Garage',
                backstory: 'Nix borrowed the part to keep the crew solvent and lost it during a blackout.',
                dialogueStyle: 'Urgent, clipped, full of machine metaphors.',
              },
            ],
            briefing: 'The turbo core vanished during the blackout. Find it before the crew tears itself apart.',
            acceptLine: 'You brought it back. The garage owes you more than credits.',
            declineLine: 'Fine. I will keep looking, but the city is eating my trail.',
          }),
        }
      },
    }
  }

  const { default: handler } = await import('../api/generate-quest.js')
  const result = await call(handler, {
    method: 'POST',
    body: {
      idea: 'Create a quest about a mechanic who lost a rare engine part in a cyberpunk city.',
      genre: 'Cyberpunk RPG',
      tone: 'Noir',
      world: { factions: 'Neon Wrench Crew', locations: 'Lower Grid Garage' },
      characters: [],
    },
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.quest.title, 'The Missing Turbo Core')
  assert.equal(result.body.characters.length, 1)
  assert.equal(result.body.project.nodes.length, 9)
  assert.equal(result.body.project.edges.length, 8)
  assert.equal(result.body.project.nodes[1].data.character, 'Nix Calder')

  global.fetch = originalFetch
  console.log('API smoke test passed')
}

function call(handler, req) {
  return new Promise((resolve) => {
    const result = {}
    const res = {
      status(code) {
        result.statusCode = code
        return this
      },
      json(body) {
        result.body = body
        resolve(result)
      },
      setHeader() {},
      end() {
        resolve(result)
      },
    }
    void handler(req, res)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
