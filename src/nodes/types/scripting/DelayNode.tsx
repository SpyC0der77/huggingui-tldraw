import { T, useEditor } from 'tldraw'
import { Port, ShapePort } from '../../../ports/Port'
import { DelayIcon } from '../../../components/icons/DelayIcon'
import {
	NODE_HEADER_HEIGHT_PX,
	NODE_ROW_HEADER_GAP_PX,
	NODE_ROW_HEIGHT_PX,
	NODE_WIDTH_PX,
} from '../../../constants'
import { NodeShape } from '../../NodeShapeUtil'
import {
	ExecutionResult,
	InfoValues,
	InputValues,
	NodeComponentProps,
	NodeDefinition,
	NodePortLabel,
	NodeRow,
	updateNode,
} from '../shared'
import { delayExecute } from './scripting-pure'

export type DelayNode = T.TypeOf<typeof DelayNode>
export const DelayNode = T.object({
	type: T.literal('delay'),
	delayMs: T.number,
})

export class DelayNodeDefinition extends NodeDefinition<DelayNode> {
	static type = 'delay'
	static validator = DelayNode
	title = 'Delay'
	heading = 'Delay'
	icon = (<DelayIcon />)
	category = 'scripting'
	getDefault(): DelayNode {
		return {
			type: 'delay',
			delayMs: 1000,
		}
	}
	getBodyHeightPx() {
		return NODE_ROW_HEIGHT_PX * 2
	}
	getPorts(): Record<string, ShapePort> {
		const baseY = NODE_HEADER_HEIGHT_PX + NODE_ROW_HEADER_GAP_PX
		return {
			input: {
				id: 'input',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'end',
				dataType: 'any',
			},
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'start',
				dataType: 'any',
			},
		}
	}
	async execute(
		_shape: NodeShape,
		node: DelayNode,
		inputs: InputValues
	): Promise<ExecutionResult> {
		return delayExecute(node, inputs) as Promise<ExecutionResult>
	}
	getOutputInfo(shape: NodeShape, node: DelayNode, inputs: InfoValues): InfoValues {
		const inputInfo = inputs.input
		const value = inputInfo
			? (inputInfo.multi ? inputInfo.value[0] : inputInfo.value)
			: null
		return {
			output: {
				value,
				isOutOfDate: inputInfo?.isOutOfDate ?? shape.props.isOutOfDate,
				dataType: inputInfo?.dataType ?? 'any',
			},
		}
	}
	Component = DelayNodeComponent
}

function DelayNodeComponent({ shape, node }: NodeComponentProps<DelayNode>) {
	const editor = useEditor()
	return (
		<>
			<NodeRow>
				<Port shapeId={shape.id} portId="input" />
				<NodePortLabel dataType="any">Input</NodePortLabel>
				<Port shapeId={shape.id} portId="output" />
				<NodePortLabel dataType="any">Output</NodePortLabel>
			</NodeRow>
			<NodeRow className="NodeInputRow">
				<span className="NodeInputRow-label">Delay (ms)</span>
				<input
					type="number"
					inputMode="numeric"
					min={0}
					value={node.delayMs}
					onChange={(e) => {
						const v = parseInt(e.target.value, 10)
						if (!Number.isNaN(v) && v >= 0) {
							updateNode<DelayNode>(editor, shape, (n) => ({ ...n, delayMs: v }))
						}
					}}
					onPointerDown={(e) => e.stopPropagation()}
				/>
			</NodeRow>
		</>
	)
}
