import { describe, expect, it } from 'vitest'
import { joinExecute } from './scripting-pure'

describe('joinExecute', () => {
	it('joins multiple inputs with separator', async () => {
		const result = await joinExecute(
			{ separator: ', ' },
			{ inputs: ['a', 'b', 'c'] }
		)
		expect(result.output).toBe('a, b, c')
	})

	it('uses custom separator', async () => {
		const result = await joinExecute(
			{ separator: ' | ' },
			{ inputs: ['x', 'y'] }
		)
		expect(result.output).toBe('x | y')
	})

	it('filters empty strings', async () => {
		const result = await joinExecute(
			{ separator: '-' },
			{ inputs: ['a', '', '  ', 'b'] }
		)
		expect(result.output).toBe('a-b')
	})

	it('returns empty string for no inputs', async () => {
		const result = await joinExecute({ separator: ',' }, { inputs: [] })
		expect(result.output).toBe('')
	})
})
