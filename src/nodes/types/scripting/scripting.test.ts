import { describe, expect, it } from 'vitest'
import {
	delayExecute,
	joinExecute,
	randomExecute,
} from './scripting-pure'

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

describe('delayExecute', () => {
	it('passes value through after delay', async () => {
		const start = Date.now()
		const result = await delayExecute(
			{ delayMs: 50 },
			{ input: 'hello' }
		)
		const elapsed = Date.now() - start
		expect(result.output).toBe('hello')
		expect(elapsed).toBeGreaterThanOrEqual(45)
	})

	it('handles zero delay', async () => {
		const result = await delayExecute(
			{ delayMs: 0 },
			{ input: 42 }
		)
		expect(result.output).toBe(42)
	})
})

describe('randomExecute', () => {
	it('returns number within range', async () => {
		for (let i = 0; i < 20; i++) {
			const result = await randomExecute(
				{ min: 10, max: 20 },
				{}
			)
			const value = result.output as number
			expect(value).toBeGreaterThanOrEqual(10)
			expect(value).toBeLessThanOrEqual(20)
			expect(Number.isInteger(value)).toBe(true)
		}
	})

	it('uses port inputs when provided', async () => {
		const result = await randomExecute(
			{ min: 0, max: 99 },
			{ min: 100, max: 200 }
		)
		const value = result.output as number
		expect(value).toBeGreaterThanOrEqual(100)
		expect(value).toBeLessThanOrEqual(200)
	})

	it('handles reversed min/max', async () => {
		const result = await randomExecute(
			{ min: 20, max: 10 },
			{}
		)
		const value = result.output as number
		expect(value).toBeGreaterThanOrEqual(10)
		expect(value).toBeLessThanOrEqual(20)
	})
})
