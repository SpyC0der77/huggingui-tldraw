import { T } from 'tldraw'
import { Port, ShapePort } from '../../../ports/Port'
import { RepeaterIcon } from '../../../components/icons/RepeaterIcon'
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
} from '../shared'

export type RepeaterNode = T.TypeOf<typeof RepeaterNode>
export const RepeaterNode = T.object({
	type: T.literal('repeater'),
	outputCount: T.number,
})

export class RepeaterNodeDefinition extends NodeDefinition<RepeaterNode> {
	static type = 'repeater'
	static validator = RepeaterNode
	title = 'Repeater'
	heading = 'Repeater'
	icon = (<RepeaterIcon />)
	category = 'scripting'
	getDefault(): RepeaterNode {
		return {
			type: 'repeater',
			outputCount: 3,
		}
	}
	getBodyHeightPx(_shape: NodeShape, node: RepeaterNode) {
		// 1 input row + N output rows
		return NODE_ROW_HEIGHT_PX * (1 + node.outputCount)
	}
	getPorts(_shape: NodeShape, node: RepeaterNode): Record<string, ShapePort> {
		const baseY = NODE_HEADER_HEIGHT_PX + NODE_ROW_HEADER_GAP_PX
		const ports: Record<string, ShapePort> = {
			input: {
				id: 'input',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'end',
				dataType: 'any',
			},
		}
		for (let i = 0; i < node.outputCount; i++) {
			ports[`out_${i}`] = {
				id: `out_${i}`,
				x: NODE_WIDTH_PX,
				y: baseY + NODE_ROW_HEIGHT_PX * (1.5 + i),
				terminal: 'start',
				dataType: 'any',
			}
		}
		return ports
	}
	async execute(
		_shape: NodeShape,
		node: RepeaterNode,
		inputs: InputValues
	): Promise<ExecutionResult> {
		const value = (inputs.input as string | number | null) ?? null
		const result: ExecutionResult = {}
		for (let i = 0; i < node.outputCount; i++) {
			result[`out_${i}`] = value
		}
		return result
	}
	getOutputInfo(shape: NodeShape, node: RepeaterNode, inputs: InfoValues): InfoValues {
		const inputInfo = inputs.input
		const result: InfoValues = {}
		for (let i = 0; i < node.outputCount; i++) {
			if (inputInfo) {
				// Repeater input is always single; forward the value to each output.
				const singleValue = inputInfo.multi ? inputInfo.value[0] : inputInfo.value
				result[`out_${i}`] = {
					value: singleValue,
					isOutOfDate: inputInfo.isOutOfDate || shape.props.isOutOfDate,
					dataType: inputInfo.dataType,
				}
			} else {
				result[`out_${i}`] = {
					value: null,
					isOutOfDate: shape.props.isOutOfDate,
					dataType: 'any',
				}
			}
		}
		return result
	}
	Component = RepeaterNodeComponent
}

function RepeaterNodeComponent({ shape, node }: NodeComponentProps<RepeaterNode>) {
	return (
		<>
			<NodeRow>
				<Port shapeId={shape.id} portId="input" />
				<NodePortLabel dataType="any">Input</NodePortLabel>
				<span className="NodeRow-connected-value">{node.outputCount} outputs</span>
			</NodeRow>
			{Array.from({ length: node.outputCount }, (_, i) => (
				<NodeRow key={i}>
					<Port shapeId={shape.id} portId={`out_${i}`} />
					<NodePortLabel dataType="any">Out {i + 1}</NodePortLabel>
				</NodeRow>
			))}
		</>
	)
}
