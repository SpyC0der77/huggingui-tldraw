import classNames from 'classnames'
import { T, useEditor, useValue } from 'tldraw'
import { ListIteratorIcon } from '../../../components/icons/ListIteratorIcon'
import {
	NODE_HEADER_HEIGHT_PX,
	NODE_IMAGE_PREVIEW_HEIGHT_PX,
	NODE_ROW_HEADER_GAP_PX,
	NODE_ROW_HEIGHT_PX,
	NODE_WIDTH_PX,
} from '../../../constants'
import { Port, ShapePort } from '../../../ports/Port'
import { getNodeInputPortValues } from '../../nodePorts'
import { NodeShape } from '../../NodeShapeUtil'
import {
	areAnyInputsOutOfDate,
	ExecutionResult,
	InfoValues,
	InputValues,
	NodeComponentProps,
	NodeDefinition,
	NodeImage,
	NodePortLabel,
	NodeRow,
	updateNode,
} from '../shared'

export type ListIteratorNode = T.TypeOf<typeof ListIteratorNode>
export const ListIteratorNode = T.object({
	type: T.literal('list_iterator'),
	items: T.string,
	completedCount: T.number,
	totalCount: T.number,
	lastResultUrl: T.string.nullable(),
})

export class ListIteratorNodeDefinition extends NodeDefinition<ListIteratorNode> {
	static type = 'list_iterator'
	static validator = ListIteratorNode
	title = 'List Iterator'
	heading = 'List Iterator'
	icon = (<ListIteratorIcon />)
	category = 'scripting'
	resultKeys = ['lastResultUrl', 'completedCount', 'totalCount'] as const
	getDefault(): ListIteratorNode {
		return {
			type: 'list_iterator',
			items: 'cat\ndog\nbird',
			completedCount: 0,
			totalCount: 0,
			lastResultUrl: null,
		}
	}
	getBodyHeightPx() {
		// template input row + items textarea (2 rows) + progress row + preview
		return NODE_ROW_HEIGHT_PX * 4 + NODE_IMAGE_PREVIEW_HEIGHT_PX
	}
	getPorts(): Record<string, ShapePort> {
		const baseY = NODE_HEADER_HEIGHT_PX + NODE_ROW_HEADER_GAP_PX
		return {
			template: {
				id: 'template',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'end',
				dataType: 'any',
			},
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: NODE_HEADER_HEIGHT_PX / 2,
				terminal: 'start',
				dataType: 'image',
			},
			current_item: {
				id: 'current_item',
				x: NODE_WIDTH_PX,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'start',
				dataType: 'text',
			},
		}
	}
	async execute(
		_shape: NodeShape,
		node: ListIteratorNode,
		_inputs: InputValues
	): Promise<ExecutionResult> {
		// List Iterator execution is handled by ExecutionGraph - it runs the downstream
		// node for each item. This is never called in practice.
		return {
			output: node.lastResultUrl,
			current_item: node.items.split('\n').map((s) => s.trim()).filter(Boolean).pop() ?? null,
		}
	}
	getOutputInfo(shape: NodeShape, node: ListIteratorNode, inputs: InfoValues): InfoValues {
		const items = node.items
			.split('\n')
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
		const currentItem =
			node.completedCount > 0
				? (items[Math.min(node.completedCount - 1, items.length - 1)] ?? null)
				: null

		return {
			output: {
				value: node.lastResultUrl,
				isOutOfDate: areAnyInputsOutOfDate(inputs) || shape.props.isOutOfDate,
				dataType: 'image',
			},
			current_item: {
				value: currentItem,
				isOutOfDate: areAnyInputsOutOfDate(inputs) || shape.props.isOutOfDate,
				dataType: 'text',
			},
		}
	}
	Component = ListIteratorNodeComponent
}

function ListIteratorNodeComponent({ shape, node }: NodeComponentProps<ListIteratorNode>) {
	const editor = useEditor()

	const templateInput = useValue(
		'template',
		() => getNodeInputPortValues(editor, shape.id).template,
		[editor, shape.id]
	)

	const items = node.items
		.split('\n')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)

	return (
		<>
			<NodeRow>
				<Port shapeId={shape.id} portId="template" />
				<NodePortLabel dataType="any">Template</NodePortLabel>
				{templateInput ? (
					<span className="NodeRow-connected-value">connected</span>
				) : (
					<span className="NodeRow-disconnected">optional</span>
				)}
			</NodeRow>
			<NodeRow className="PromptNode-row">
				<textarea
					className="PromptNode-textarea"
					value={node.items}
					placeholder="One item per line..."
					onChange={(e) =>
						updateNode<ListIteratorNode>(editor, shape, (n) => ({
							...n,
							items: e.target.value,
						}))
					}
					onPointerDown={(e) => e.stopPropagation()}
				/>
			</NodeRow>
			<NodeRow>
				<span className="NodeInputRow-label" style={{ flex: 1 }}>
					{node.totalCount > 0
						? `${node.completedCount} / ${node.totalCount}`
						: `${items.length} item${items.length !== 1 ? 's' : ''}`}
				</span>
				{node.totalCount > 0 && node.completedCount < node.totalCount && (
					<div
						style={{
							flex: 2,
							height: 4,
							background: 'var(--tl-color-muted-0)',
							borderRadius: 2,
							overflow: 'hidden',
						}}
					>
						<div
							style={{
								width: `${(node.completedCount / node.totalCount) * 100}%`,
								height: '100%',
								background: 'var(--tl-color-selected)',
								transition: 'width 0.3s ease',
							}}
						/>
					</div>
				)}
			</NodeRow>
			<div
				className={classNames('NodeImagePreview', {
					NodeImagePreview_loading: shape.props.isOutOfDate,
				})}
			>
				{node.lastResultUrl ? (
					<NodeImage src={node.lastResultUrl} alt="List Iterator result" />
				) : (
					<div className="NodeImagePreview-empty">
						<span>Run to iterate items</span>
					</div>
				)}
			</div>
		</>
	)
}
