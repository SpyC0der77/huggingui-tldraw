/**
 * Pure execute logic for scripting nodes. No React/tldraw deps.
 * Used by node definitions and by tests.
 */
import type { ExecutionResult, InputValues } from '../shared-pure'
import { coerceToText, getInputMulti } from '../shared-pure'

export async function joinExecute(
	node: { separator: string },
	inputs: InputValues
): Promise<ExecutionResult> {
	const values = getInputMulti(inputs, 'inputs')
	const parts = values.map((v) => coerceToText(v).trim()).filter(Boolean)
	return { output: parts.join(node.separator) }
}
