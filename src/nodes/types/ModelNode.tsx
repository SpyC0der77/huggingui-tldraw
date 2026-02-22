import { T, useEditor } from 'tldraw'
import {
	DEFAULT_HF_MODEL_ID,
	DEFAULT_HF_PROVIDER,
	DEFAULT_SPACE_API_NAME,
	DEFAULT_SPACE_ARGS_TEMPLATE,
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
	{ id: 'space', label: 'Hugging Face Space' },
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
	spaceId: T.string,
	spaceApiName: T.string,
	spaceArgsTemplate: T.string,
})

export class ModelNodeDefinition extends NodeDefinition<ModelNode> {
	static type = 'model'
	static validator = ModelNode
	title = 'Load model'
	heading = 'Model'
	icon = (<ModelIcon />)
	category = 'input'
	getDefault(): ModelNode {
		return {
			type: 'model',
			provider: DEFAULT_HF_PROVIDER,
			modelId: DEFAULT_HF_MODEL_ID,
			spaceId: '',
			spaceApiName: DEFAULT_SPACE_API_NAME,
			spaceArgsTemplate: DEFAULT_SPACE_ARGS_TEMPLATE,
		}
	}
	getBodyHeightPx(_shape: NodeShape, node: ModelNode) {
		if (node.provider === 'space') {
			return NODE_ROW_HEIGHT_PX * 3 + 88
		}
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
		return {
			output:
				node.provider === 'space'
					? encodeModelRef({
							kind: 'space',
							spaceId: node.spaceId.trim(),
							apiName: normalizeApiName(node.spaceApiName),
							argsTemplate: node.spaceArgsTemplate.trim() || DEFAULT_SPACE_ARGS_TEMPLATE,
						})
					: encodeModelRef({
							kind: 'hf',
							provider: node.provider,
							modelId: node.modelId.trim() || DEFAULT_HF_MODEL_ID,
						}),
		}
	}
	getOutputInfo(shape: NodeShape, node: ModelNode): InfoValues {
		const output =
			node.provider === 'space'
				? encodeModelRef({
						kind: 'space',
						spaceId: node.spaceId.trim(),
						apiName: normalizeApiName(node.spaceApiName),
						argsTemplate: node.spaceArgsTemplate.trim() || DEFAULT_SPACE_ARGS_TEMPLATE,
					})
				: encodeModelRef({
						kind: 'hf',
						provider: node.provider,
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

	return (
		<>
			<NodeRow>
				<span className="NodeInputRow-label">Provider</span>
				<select
					value={node.provider}
					onChange={(e) => {
						const provider = e.target.value
						updateNode<ModelNode>(editor, shape, (n) => ({
							...n,
							provider,
							modelId: provider === 'space' ? n.modelId : n.modelId || DEFAULT_HF_MODEL_ID,
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

			{node.provider === 'space' ? (
				<>
					<NodeRow className="NodeInputRow">
						<span className="NodeInputRow-label">Space</span>
						<input
							type="text"
							value={node.spaceId}
							onChange={(e) =>
								updateNode<ModelNode>(editor, shape, (n) => ({
									...n,
									spaceId: e.target.value,
								}))
							}
							placeholder="owner/space-name"
						/>
					</NodeRow>
					<NodeRow className="NodeInputRow">
						<span className="NodeInputRow-label">API</span>
						<input
							type="text"
							value={node.spaceApiName}
							onChange={(e) =>
								updateNode<ModelNode>(editor, shape, (n) => ({
									...n,
									spaceApiName: e.target.value,
								}))
							}
							placeholder="/predict"
						/>
					</NodeRow>
					<NodeRow className="PromptNode-row">
						<span className="NodeInputRow-label">Args</span>
						<textarea
							className="PromptNode-textarea"
							value={node.spaceArgsTemplate}
							onChange={(e) =>
								updateNode<ModelNode>(editor, shape, (n) => ({
									...n,
									spaceArgsTemplate: e.target.value,
								}))
							}
							placeholder='["{prompt}"]'
						/>
					</NodeRow>
				</>
			) : (
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
			)}
		</>
	)
}

function normalizeApiName(value: string): string {
	const trimmed = value.trim() || DEFAULT_SPACE_API_NAME
	return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
