import { huggingface } from './huggingface'
import type { ImageProvider } from './types'

export type {
	GenerateParams,
	GenerateResult,
	ImageProvider,
	UpscaleParams,
	UpscaleResult,
} from './types'

export function getProvider(name: string): ImageProvider {
	void name
	return huggingface
}

export function getUpscaleProvider(method: string): ImageProvider {
	void method
	return huggingface
}
