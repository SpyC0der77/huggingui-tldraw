/**
 * Pure execute logic for scripting nodes. No React/tldraw deps.
 * Used by node definitions and by tests.
 */
import type { ExecutionResult, InputValues } from '../shared-pure'
import { coerceToText, getInput, getInputMulti, getInputNumber } from '../shared-pure'

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function joinExecute(
	node: { separator: string },
	inputs: InputValues
): Promise<ExecutionResult> {
	const values = getInputMulti(inputs, 'inputs')
	const parts = values.map((v) => coerceToText(v).trim()).filter(Boolean)
	return { output: parts.join(node.separator) }
}

export async function delayExecute(
	node: { delayMs: number },
	inputs: InputValues
): Promise<ExecutionResult> {
	const ms = Math.max(0, node.delayMs)
	await delay(ms)
	return { output: getInput(inputs, 'input') }
}

export async function randomExecute(
	node: { min: number; max: number },
	inputs: InputValues
): Promise<ExecutionResult> {
	const min = getInputNumber(inputs, 'min', node.min)
	const max = getInputNumber(inputs, 'max', node.max)
	const lo = Math.min(min, max)
	const hi = Math.max(min, max)
	return { output: randomInt(lo, hi) }
}
