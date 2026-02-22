/**
 * Frontend API client for application endpoints.
 */

export interface GenerateParams {
	model: string
	prompt: string
	negativePrompt?: string
	steps?: number
	cfgScale?: number
	seed?: number
	controlNetMode?: string
	controlNetStrength?: number
	referenceImageUrl?: string
}

export interface GenerateResult {
	imageUrl: string
	seed: number
}

export async function apiGenerate(params: GenerateParams): Promise<GenerateResult> {
	try {
		const response = await fetch('/api/generate', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		})

		if (!response.ok) {
			const err = await response.json().catch(() => ({ error: response.statusText }))
			throw new Error((err as { error?: string }).error ?? 'Generation failed')
		}

		return (await response.json()) as GenerateResult
	} catch (e) {
		throw new Error(`Backend unavailable: ${e instanceof Error ? e.message : e}`)
	}
}

export interface SpaceEndpointParameter {
	label: string
	parameter_name: string
	parameter_has_default?: boolean
	parameter_default?: unknown
	type?: {
		type?: string
		enum?: string[]
	}
	component?: string
}

export interface SpaceEndpointInfo {
	apiName: string
	parameters?: SpaceEndpointParameter[]
	returns?: unknown[]
	show_api?: boolean
}

export interface SpaceInfoResult {
	spaceId: string
	baseUrl: string
	endpoints: SpaceEndpointInfo[]
}

export async function apiSpaceInfo(spaceId: string): Promise<SpaceInfoResult> {
	try {
		const response = await fetch('/api/space-info', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ spaceId }),
		})

		if (!response.ok) {
			const err = await response.json().catch(() => ({ error: response.statusText }))
			throw new Error((err as { error?: string }).error ?? 'Failed to fetch Space schema')
		}

		return (await response.json()) as SpaceInfoResult
	} catch (e) {
		throw new Error(`Backend unavailable: ${e instanceof Error ? e.message : e}`)
	}
}

export interface RunSpaceParams {
	spaceId: string
	apiName: string
	args: unknown[]
}

export interface RunSpaceResult {
	spaceId: string
	apiName: string
	baseUrl: string
	output: unknown
	imageUrl: string | null
}

export async function apiRunSpace(params: RunSpaceParams): Promise<RunSpaceResult> {
	try {
		const response = await fetch('/api/run-space', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		})

		if (!response.ok) {
			const err = await response.json().catch(() => ({ error: response.statusText }))
			throw new Error((err as { error?: string }).error ?? 'Failed to run Space endpoint')
		}

		return (await response.json()) as RunSpaceResult
	} catch (e) {
		throw new Error(`Backend unavailable: ${e instanceof Error ? e.message : e}`)
	}
}
