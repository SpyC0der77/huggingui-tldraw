import { T, useEditor } from 'tldraw'
import {
	DEFAULT_HF_MODEL_ID,
	DEFAULT_HF_PROVIDER,
	encodeModelRef,
} from '@/lib/modelRef'
import { ModelIcon } from '../../components/icons/ModelIcon'
import { NODE_HEADER_HEIGHT_PX, NODE_ROW_HEIGHT_PX, NODE_WIDTH_PX } from '../../constants'
import { ShapePort } from '../../ports/Port'
import { sleep } from '../../utils/sleep'
import { NodeShape } from '../NodeShapeUtil'
import {
	ExecutionResult,
	InfoValues,
	NodeComponentProps,
	NodeDefinition,
	NodeRow,
	updateNode,
} from './shared'

interface ProviderInfo {
	id: string
	label: string
}

const PROVIDERS: ProviderInfo[] = [
	{ id: 'auto', label: 'Auto (HF Router)' },
	{ id: 'hf-inference', label: 'HF Inference' },
	{ id: 'fal-ai', label: 'fal' },
	{ id: 'together', label: 'Together' },
	{ id: 'replicate', label: 'Replicate (via HF)' },
	{ id: 'nebius', label: 'Nebius' },
	{ id: 'novita', label: 'Novita' },
	{ id: 'nscale', label: 'Nscale' },
	{ id: 'wavespeed', label: 'WaveSpeed' },
]

const HUGGING_FACE_MODELS = [
	'black-forest-labs/FLUX.1-schnell',
	'black-forest-labs/FLUX.1-dev',
	'black-forest-labs/FLUX.1.1-pro',
	'stabilityai/stable-diffusion-xl-base-1.0',
	'stabilityai/stable-diffusion-3.5-large',
	'playgroundai/playground-v2.5-1024px-aesthetic',
]

export type ModelNode = T.TypeOf<typeof ModelNode>
export const ModelNode = T.object({
	type: T.literal('model'),
	provider: T.string,
	modelId: T.string,
	// Legacy fields preserved for persisted documents created before Spaces were split.
	spaceId: T.string,
	spaceApiName: T.string,
	spaceArgsTemplate: T.string,
})

export class ModelNodeDefinition extends NodeDefinition<ModelNode> {
	static type = 'model'
	static validator = ModelNode
	title = 'Model'
	heading = 'Model'
	icon = (<ModelIcon />)
	category = 'input'
	getDefault(): ModelNode {
		return {
			type: 'model',
			provider: DEFAULT_HF_PROVIDER,
			modelId: DEFAULT_HF_MODEL_ID,
			spaceId: '',
			spaceApiName: '',
			spaceArgsTemplate: '',
		}
	}
	getBodyHeightPx() {
		return NODE_ROW_HEIGHT_PX * 2
	}
	getPorts(): Record<string, ShapePort> {
		return {
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: NODE_HEADER_HEIGHT_PX / 2,
				terminal: 'start',
				dataType: 'model',
			},
		}
	}
	async execute(_shape: NodeShape, node: ModelNode): Promise<ExecutionResult> {
		await sleep(250)
		const provider = normalizeProvider(node.provider)
		return {
			output: encodeModelRef({
				kind: 'hf',
				provider,
				modelId: node.modelId.trim() || DEFAULT_HF_MODEL_ID,
			}),
		}
	}
	getOutputInfo(shape: NodeShape, node: ModelNode): InfoValues {
		const provider = normalizeProvider(node.provider)
		const output = encodeModelRef({
			kind: 'hf',
			provider,
			modelId: node.modelId.trim() || DEFAULT_HF_MODEL_ID,
		})

		return {
			output: {
				value: output,
				isOutOfDate: shape.props.isOutOfDate,
				dataType: 'model',
			},
		}
	}
	Component = ModelNodeComponent
}

function ModelNodeComponent({ shape, node }: NodeComponentProps<ModelNode>) {
	const editor = useEditor()
	const provider = normalizeProvider(node.provider)

	return (
		<>
			<NodeRow>
				<span className="NodeInputRow-label">Provider</span>
				<select
					value={provider}
					onChange={(e) => {
						updateNode<ModelNode>(editor, shape, (n) => ({
							...n,
							provider: e.target.value,
							modelId: n.modelId || DEFAULT_HF_MODEL_ID,
						}))
					}}
				>
					{PROVIDERS.map((provider) => (
						<option key={provider.id} value={provider.id}>
							{provider.label}
						</option>
					))}
				</select>
			</NodeRow>

			<NodeRow className="NodeInputRow">
				<span className="NodeInputRow-label">Model</span>
				<input
					type="text"
					list={`${shape.id}_hf_models`}
					value={node.modelId}
					onChange={(e) =>
						updateNode<ModelNode>(editor, shape, (n) => ({
							...n,
							modelId: e.target.value,
						}))
					}
					placeholder="org/model-id"
				/>
				<datalist id={`${shape.id}_hf_models`}>
					{HUGGING_FACE_MODELS.map((model) => (
						<option key={model} value={model} />
					))}
				</datalist>
			</NodeRow>
		</>
	)
}

function normalizeProvider(provider: string): string {
	if (PROVIDERS.some((entry) => entry.id === provider)) {
		return provider
	}
	return DEFAULT_HF_PROVIDER
}
