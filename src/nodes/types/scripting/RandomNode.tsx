import { T, useEditor } from 'tldraw'
import { Port, ShapePort } from '../../../ports/Port'
import { RandomIcon } from '../../../components/icons/RandomIcon'
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
	NodeInputRow,
	NodePortLabel,
	NodeRow,
	updateNode,
} from '../shared'
import { randomExecute } from './scripting-pure'

export type RandomNode = T.TypeOf<typeof RandomNode>
export const RandomNode = T.object({
	type: T.literal('random'),
	min: T.number,
	max: T.number,
})

export class RandomNodeDefinition extends NodeDefinition<RandomNode> {
	static type = 'random'
	static validator = RandomNode
	title = 'Random'
	heading = 'Random'
	icon = (<RandomIcon />)
	category = 'scripting'
	getDefault(): RandomNode {
		return {
			type: 'random',
			min: 0,
			max: 99999,
		}
	}
	getBodyHeightPx() {
		return NODE_ROW_HEIGHT_PX * 3
	}
	getPorts(): Record<string, ShapePort> {
		const baseY = NODE_HEADER_HEIGHT_PX + NODE_ROW_HEADER_GAP_PX
		return {
			min: {
				id: 'min',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'end',
				dataType: 'number',
			},
			max: {
				id: 'max',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 1.5,
				terminal: 'end',
				dataType: 'number',
			},
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: baseY + NODE_ROW_HEIGHT_PX * 2.5,
				terminal: 'start',
				dataType: 'number',
			},
		}
	}
	async execute(
		_shape: NodeShape,
		node: RandomNode,
		inputs: InputValues
	): Promise<ExecutionResult> {
		return randomExecute(node, inputs) as Promise<ExecutionResult>
	}
	getOutputInfo(shape: NodeShape, node: RandomNode, inputs: InfoValues): InfoValues {
		const minInfo = inputs.min
		const maxInfo = inputs.max
		const min = minInfo
			? (minInfo.multi ? minInfo.value[0] : minInfo.value)
			: node.min
		const max = maxInfo
			? (maxInfo.multi ? maxInfo.value[0] : maxInfo.value)
			: node.max
		const lo = Math.min(
			typeof min === 'number' ? min : node.min,
			typeof max === 'number' ? max : node.max
		)
		const hi = Math.max(
			typeof min === 'number' ? min : node.min,
			typeof max === 'number' ? max : node.max
		)
		const isOutOfDate =
			shape.props.isOutOfDate ||
			(minInfo?.isOutOfDate ?? false) ||
			(maxInfo?.isOutOfDate ?? false)
		return {
			output: {
				value: null,
				isOutOfDate,
				dataType: 'number',
			},
		}
	}
	Component = RandomNodeComponent
}

function RandomNodeComponent({ shape, node }: NodeComponentProps<RandomNode>) {
	const editor = useEditor()
	return (
		<>
			<NodeRow>
				<Port shapeId={shape.id} portId="min" />
				<NodeInputRow
					shapeId={shape.id}
					portId="min"
					label="Min"
					value={node.min}
					onChange={(min) =>
						updateNode<RandomNode>(editor, shape, (n) => ({ ...n, min }))
					}
				/>
			</NodeRow>
			<NodeRow>
				<Port shapeId={shape.id} portId="max" />
				<NodeInputRow
					shapeId={shape.id}
					portId="max"
					label="Max"
					value={node.max}
					onChange={(max) =>
						updateNode<RandomNode>(editor, shape, (n) => ({ ...n, max }))
					}
				/>
			</NodeRow>
			<NodeRow>
				<Port shapeId={shape.id} portId="output" />
				<NodePortLabel dataType="number">Output</NodePortLabel>
			</NodeRow>
		</>
	)
}
