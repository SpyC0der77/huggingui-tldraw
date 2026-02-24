import { Editor, T, useEditor, WeakCache } from 'tldraw'
import {
	NODE_FOOTER_HEIGHT_PX,
	NODE_HEADER_HEIGHT_PX,
	NODE_ROW_BOTTOM_PADDING_PX,
	NODE_ROW_HEADER_GAP_PX,
} from '../constants'
import { PortId, ShapePort } from '../ports/Port'
import { NodeShape } from './NodeShapeUtil'
import { BooleanNodeDefinition } from './types/input/BooleanNode'
import { EnumNodeDefinition } from './types/input/EnumNode'
import { ImageNodeDefinition } from './types/input/ImageNode'
import { ModelNodeDefinition } from './types/input/ModelNode'
import { NumberNodeDefinition } from './types/input/NumberNode'
import { PromptNodeDefinition } from './types/input/PromptNode'
import { SpaceNodeDefinition } from './types/input/SpaceNode'
import { TextNodeDefinition } from './types/input/TextNode'
import { PreviewNodeDefinition } from './types/preview/PreviewNode'
import { GenerateNodeDefinition } from './types/inference/GenerateNode'
import { JoinNodeDefinition } from './types/scripting/JoinNode'
import { ListIteratorNodeDefinition } from './types/scripting/ListIteratorNode'
import { RandomNodeDefinition } from './types/scripting/RandomNode'
import { RepeaterNodeDefinition } from './types/scripting/RepeaterNode'
import { DelayNodeDefinition } from './types/scripting/DelayNode'
import { RunSpaceNodeDefinition } from './types/inference/RunSpaceNode'
import {
	ExecutionResult,
	InfoValues,
	NodeDefinition,
} from './types/shared'

/** All our node types */
export const NodeDefinitions = {
	model: ModelNodeDefinition,
	text: TextNodeDefinition,
	prompt: PromptNodeDefinition,
	enum: EnumNodeDefinition,
	boolean: BooleanNodeDefinition,
	space: SpaceNodeDefinition,
	generate: GenerateNodeDefinition,
	run_space: RunSpaceNodeDefinition,
	image: ImageNodeDefinition,
	preview: PreviewNodeDefinition,
	number: NumberNodeDefinition,
	repeater: RepeaterNodeDefinition,
	list_iterator: ListIteratorNodeDefinition,
	join: JoinNodeDefinition,
	delay: DelayNodeDefinition,
	random: RandomNodeDefinition,
} as const

/**
 * A union type of all our node types.
 */
export type NodeType = T.TypeOf<typeof NodeType>
export const NodeType = T.union(
	'type',
	Object.fromEntries(Object.values(NodeDefinitions).map((type) => [type.type, type.validator])) as {
		[K in keyof typeof NodeDefinitions as (typeof NodeDefinitions)[K]['type']]: (typeof NodeDefinitions)[K]['validator']
	}
)

type NodeDefinitionsByType = {
	[K in keyof typeof NodeDefinitions as (typeof NodeDefinitions)[K]['type']]: InstanceType<
		(typeof NodeDefinitions)[K]
	>
}

const nodeDefinitions = new WeakCache<
	Editor,
	NodeDefinitionsByType
>()
export function getNodeDefinitions(editor: Editor) {
	return nodeDefinitions.get(editor, () => {
		return Object.fromEntries(
			Object.values(NodeDefinitions).map((value) => [value.type, new value(editor)])
		) as unknown as NodeDefinitionsByType
	})
}

export function getNodeDefinition(
	editor: Editor,
	node: NodeType | NodeType['type']
): NodeDefinition<NodeType> {
	return getNodeDefinitions(editor)[
		typeof node === 'string' ? node : node.type
	] as NodeDefinition<NodeType>
}

export function getNodeWidthPx(editor: Editor, shape: NodeShape): number {
	return getNodeDefinition(editor, shape.props.node).getWidthPx(shape, shape.props.node)
}

export function getNodeBodyHeightPx(editor: Editor, shape: NodeShape): number {
	return getNodeDefinition(editor, shape.props.node).getBodyHeightPx(shape, shape.props.node)
}

export function getNodeHeightPx(editor: Editor, shape: NodeShape): number {
	return (
		NODE_HEADER_HEIGHT_PX +
		NODE_ROW_HEADER_GAP_PX +
		getNodeBodyHeightPx(editor, shape) +
		NODE_ROW_BOTTOM_PADDING_PX +
		NODE_FOOTER_HEIGHT_PX
	)
}

export function getNodeTypePorts(editor: Editor, shape: NodeShape): Record<string, ShapePort> {
	return getNodeDefinition(editor, shape.props.node).getPorts(shape, shape.props.node)
}

export async function executeNode(
	editor: Editor,
	shape: NodeShape,
	inputs: Record<
		string,
		string | number | boolean | null | (string | number | boolean | null)[]
	>
): Promise<ExecutionResult> {
	return await getNodeDefinition(editor, shape.props.node).execute(shape, shape.props.node, inputs)
}

export function getNodeOutputInfo(
	editor: Editor,
	shape: NodeShape,
	inputs: InfoValues
): InfoValues {
	return getNodeDefinition(editor, shape.props.node).getOutputInfo(shape, shape.props.node, inputs)
}

export function onNodePortConnect(editor: Editor, shape: NodeShape, port: PortId) {
	getNodeDefinition(editor, shape.props.node).onPortConnect?.(shape, shape.props.node, port)
}

export function onNodePortDisconnect(editor: Editor, shape: NodeShape, port: PortId) {
	getNodeDefinition(editor, shape.props.node).onPortDisconnect?.(shape, shape.props.node, port)
}

export function NodeBody({ shape }: { shape: NodeShape }) {
	const editor = useEditor()
	const node = shape.props.node
	const { Component } = getNodeDefinition(editor, node)
	return <Component shape={shape} node={node} />
}
