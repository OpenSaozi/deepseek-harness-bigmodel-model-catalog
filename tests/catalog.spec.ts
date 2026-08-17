import { describe, expect, it } from 'vitest'
import { discoverModels, maintainedModels, parseModelIds } from '../src/index.ts'

describe('BigModel model catalog', () => {
  it('owns the verified GLM-5.3 capacities and validates the Models response shape', () => {
    const glm53 = maintainedModels.find(model => model.id === 'glm-5.3')
    expect(glm53).toMatchObject({ contextWindow: 1_000_000, maxTokens: 131_072 })
    expect(parseModelIds({ data: [{ id: 'glm-5.3' }] })).toEqual(['glm-5.3'])
    expect(() => parseModelIds([])).toThrow(/data array/)
  })

  it('reconciles the live list while retaining the direct-call verified GLM-5.3', async () => {
    const models = discoverModels({ data: [{ id: 'glm-5.2' }] })
    expect(models.map(model => model.id)).toEqual(['glm-5.2', 'glm-5.3'])
  })
})
