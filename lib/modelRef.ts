export const DEFAULT_HF_PROVIDER = 'auto'
export const DEFAULT_HF_MODEL_ID = 'black-forest-labs/FLUX.1-schnell'
export const DEFAULT_SPACE_API_NAME = '/predict'
export const DEFAULT_SPACE_ARGS_TEMPLATE = '["{prompt}"]'

export interface HuggingFaceModelRef {
	kind: 'hf'
	provider: string
	modelId: string
}

export interface SpaceModelRef {
	kind: 'space'
	spaceId: string
	apiName: string
	argsTemplate: string
}

export type ModelRef = HuggingFaceModelRef | SpaceModelRef

export function encodeModelRef(ref: ModelRef): string {
	if (ref.kind === 'space') {
		return [
			'space',
			encodeURIComponent(ref.spaceId),
			encodeURIComponent(ref.apiName),
			encodeURIComponent(ref.argsTemplate),
		].join(':')
	}

	return ['hf', ref.provider, ref.modelId].join(':')
}

export function parseModelRef(modelValue: string | undefined | null): ModelRef {
	const value = modelValue?.trim()
	if (!value) {
		return { kind: 'hf', provider: DEFAULT_HF_PROVIDER, modelId: DEFAULT_HF_MODEL_ID }
	}

	if (value.startsWith('space:')) {
		const parts = value.split(':')
		return {
			kind: 'space',
			spaceId: decodeURIComponent(parts[1] ?? ''),
			apiName: decodeURIComponent(parts[2] ?? DEFAULT_SPACE_API_NAME),
			argsTemplate: decodeURIComponent(parts[3] ?? DEFAULT_SPACE_ARGS_TEMPLATE),
		}
	}

	if (value.startsWith('hf:')) {
		const parts = value.split(':')
		return {
			kind: 'hf',
			provider: parts[1] || DEFAULT_HF_PROVIDER,
			modelId: parts.slice(2).join(':') || DEFAULT_HF_MODEL_ID,
		}
	}

	return parseLegacyModelRef(value)
}

export function describeModelRef(modelValue: string | undefined | null): string {
	const ref = parseModelRef(modelValue)
	if (ref.kind === 'space') {
		return `space:${ref.spaceId} ${ref.apiName}`
	}

	return `${ref.provider}:${ref.modelId}`
}

function parseLegacyModelRef(value: string): ModelRef {
	const [legacyProvider, legacyModelId] = value.split(':')

	if (legacyProvider === 'flux') {
		return {
			kind: 'hf',
			provider: DEFAULT_HF_PROVIDER,
			modelId:
				legacyModelId === 'flux-dev'
					? 'black-forest-labs/FLUX.1-dev'
					: legacyModelId === 'flux-pro'
						? 'black-forest-labs/FLUX.1.1-pro'
						: 'black-forest-labs/FLUX.1-schnell',
		}
	}

	if (legacyProvider === 'google') {
		return {
			kind: 'hf',
			provider: DEFAULT_HF_PROVIDER,
			modelId:
				legacyModelId === 'imagen-4-fast'
					? 'stabilityai/stable-diffusion-xl-base-1.0'
					: 'black-forest-labs/FLUX.1-schnell',
		}
	}

	return {
		kind: 'hf',
		provider: DEFAULT_HF_PROVIDER,
		modelId: value,
	}
}
