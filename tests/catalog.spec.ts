import { describe, expect, it } from 'vitest'
import { discoverModels, maintainedModels, parseModelIds } from '../src/index.ts'

describe('BigModel model catalog', () => {
  it('owns GLM-5.3 and validates the Models response shape', () => {
    expect(maintainedModels.map(model => model.id)).toContain('glm-5.3')
    expect(parseModelIds({ data: [{ id: 'glm-5.3' }] })).toEqual(['glm-5.3'])
    expect(() => parseModelIds([])).toThrow(/data array/)
  })

  it('reconciles the live list while retaining the direct-call verified GLM-5.3', async () => {
    const models = discoverModels({ data: [{ id: 'glm-5.2' }] })
    expect(models.map(model => model.id)).toEqual(['glm-5.2', 'glm-5.3'])
  })
})
