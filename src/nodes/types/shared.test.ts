import { describe, expect, it } from 'vitest'
import {
	areAnyInputsOutOfDate,
	coerceToNumber,
	coerceToText,
	getInput,
	getInputMulti,
	getInputNumber,
	getInputText,
	isMultiInfoValue,
} from './shared-pure'

describe('coerceToText', () => {
	it('returns fallback for null/undefined', () => {
		expect(coerceToText(null)).toBe('')
		expect(coerceToText(null, 'fallback')).toBe('fallback')
	})

	it('converts number to string', () => {
		expect(coerceToText(42)).toBe('42')
		expect(coerceToText(0)).toBe('0')
	})

	it('converts boolean to string', () => {
		expect(coerceToText(true)).toBe('true')
		expect(coerceToText(false)).toBe('false')
	})

	it('returns string as-is', () => {
		expect(coerceToText('hello')).toBe('hello')
	})
})

describe('coerceToNumber', () => {
	it('returns fallback for null/undefined', () => {
		expect(coerceToNumber(null)).toBe(0)
		expect(coerceToNumber(null, 99)).toBe(99)
	})

	it('returns number as-is', () => {
		expect(coerceToNumber(42)).toBe(42)
	})

	it('converts boolean to 0 or 1', () => {
		expect(coerceToNumber(true)).toBe(1)
		expect(coerceToNumber(false)).toBe(0)
	})

	it('parses numeric strings', () => {
		expect(coerceToNumber('42')).toBe(42)
		expect(coerceToNumber('3.14')).toBe(3.14)
	})

	it('returns fallback for invalid strings', () => {
		expect(coerceToNumber('abc')).toBe(0)
		expect(coerceToNumber('abc', 99)).toBe(99)
	})
})

describe('getInput', () => {
	it('returns value for single input', () => {
		expect(getInput({ foo: 'bar' }, 'foo')).toBe('bar')
	})

	it('returns first element for array input', () => {
		expect(getInput({ foo: ['a', 'b'] }, 'foo')).toBe('a')
	})

	it('returns null for missing key', () => {
		expect(getInput({}, 'foo')).toBe(null)
	})

	it('returns null for empty array', () => {
		expect(getInput({ foo: [] }, 'foo')).toBe(null)
	})
})

describe('getInputMulti', () => {
	it('returns array for single value', () => {
		expect(getInputMulti({ foo: 'bar' }, 'foo')).toEqual(['bar'])
	})

	it('returns array as-is', () => {
		expect(getInputMulti({ foo: ['a', 'b'] }, 'foo')).toEqual(['a', 'b'])
	})

	it('returns empty array for missing key', () => {
		expect(getInputMulti({}, 'foo')).toEqual([])
	})

	it('returns empty array for null', () => {
		expect(getInputMulti({ foo: null }, 'foo')).toEqual([])
	})
})

describe('getInputText', () => {
	it('coerces and returns string', () => {
		expect(getInputText({ foo: 42 }, 'foo')).toBe('42')
		expect(getInputText({ foo: 'hello' }, 'foo')).toBe('hello')
	})

	it('returns fallback for missing', () => {
		expect(getInputText({}, 'foo')).toBe('')
		expect(getInputText({}, 'foo', 'default')).toBe('default')
	})
})

describe('getInputNumber', () => {
	it('coerces and returns number', () => {
		expect(getInputNumber({ foo: '42' }, 'foo')).toBe(42)
		expect(getInputNumber({ foo: 10 }, 'foo')).toBe(10)
	})

	it('returns fallback for missing', () => {
		expect(getInputNumber({}, 'foo')).toBe(0)
		expect(getInputNumber({}, 'foo', 99)).toBe(99)
	})
})

describe('areAnyInputsOutOfDate', () => {
	it('returns true if any input is out of date', () => {
		expect(
			areAnyInputsOutOfDate({
				a: { value: 1, isOutOfDate: false, dataType: 'number' },
				b: { value: 2, isOutOfDate: true, dataType: 'number' },
			})
		).toBe(true)
	})

	it('returns false if all inputs are up to date', () => {
		expect(
			areAnyInputsOutOfDate({
				a: { value: 1, isOutOfDate: false, dataType: 'number' },
				b: { value: 2, isOutOfDate: false, dataType: 'number' },
			})
		).toBe(false)
	})

	it('returns false for empty inputs', () => {
		expect(areAnyInputsOutOfDate({})).toBe(false)
	})
})

describe('isMultiInfoValue', () => {
	it('returns true for multi info value', () => {
		expect(
			isMultiInfoValue({
				value: [1, 2],
				isOutOfDate: false,
				dataType: 'number',
				multi: true,
			})
		).toBe(true)
	})

	it('returns false for single info value', () => {
		expect(
			isMultiInfoValue({
				value: 1,
				isOutOfDate: false,
				dataType: 'number',
			})
		).toBe(false)
	})
})
