/**
 * Pure types and utilities for pipeline values. No React/tldraw deps.
 * Used by shared.tsx and by tests.
 */
import type { PortDataType } from '../../constants'

export type PipelineValue = string | number | boolean | null

export type STOP_EXECUTION = typeof STOP_EXECUTION
export const STOP_EXECUTION = Symbol('STOP_EXECUTION')

export interface SingleInfoValue {
	value: PipelineValue | STOP_EXECUTION
	isOutOfDate: boolean
	dataType: PortDataType
	multi?: false
}

export interface MultiInfoValue {
	value: (PipelineValue | STOP_EXECUTION)[]
	isOutOfDate: boolean
	dataType: PortDataType
	multi: true
}

export type InfoValue = SingleInfoValue | MultiInfoValue

export function isMultiInfoValue(v: InfoValue): v is MultiInfoValue {
	return v.multi === true
}

export interface InfoValues {
	[key: string]: InfoValue
}

export interface InputValues {
	[key: string]: PipelineValue | PipelineValue[]
}

export interface ExecutionResult {
	[key: string]: PipelineValue | STOP_EXECUTION
}

/** Coerce any pipeline value to a string. */
export function coerceToText(value: PipelineValue, fallback = ''): string {
	if (value == null) return fallback
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	return String(value)
}

/** Coerce any pipeline value to a number. */
export function coerceToNumber(value: PipelineValue, fallback = 0): number {
	if (value == null) return fallback
	if (typeof value === 'number') return value
	if (typeof value === 'boolean') return value ? 1 : 0
	const n = parseFloat(String(value))
	return Number.isNaN(n) ? fallback : n
}

/** Extract a single value from an InputValues entry (takes first element if array). */
export function getInput(inputs: InputValues, key: string): PipelineValue {
	const v = inputs[key]
	if (Array.isArray(v)) return v[0] ?? null
	return v ?? null
}

/** Always return an array from an InputValues entry. */
export function getInputMulti(inputs: InputValues, key: string): PipelineValue[] {
	const v = inputs[key]
	if (v == null) return []
	if (Array.isArray(v)) return v
	return [v]
}

/** Extract a single value and coerce to string. */
export function getInputText(inputs: InputValues, key: string, fallback = ''): string {
	return coerceToText(getInput(inputs, key), fallback)
}

/** Extract a single value and coerce to number. */
export function getInputNumber(inputs: InputValues, key: string, fallback = 0): number {
	return coerceToNumber(getInput(inputs, key), fallback)
}

export function areAnyInputsOutOfDate(inputs: InfoValues): boolean {
	return Object.values(inputs).some((input) => input.isOutOfDate)
}
