import { T, useEditor } from 'tldraw'
import { Port, ShapePort } from '../../../ports/Port'
import { JoinIcon } from '../../../components/icons/JoinIcon'
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
	STOP_EXECUTION,
	coerceToText,
	isMultiInfoValue,
	updateNode,
} from '../shared'
import { joinExecute } from './scripting-pure'

export type JoinNode = T.TypeOf<typeof JoinNode>
export const JoinNode = T.object({
	type: T.literal('join'),
	separator: T.string,
})

export class JoinNodeDefinition extends NodeDefinition<JoinNode> {
	static type = 'join'
	static validator = JoinNode
	title = 'Join'
	heading = 'Join'
	icon = (<JoinIcon />)
	category = 'scripting'
	getDefault(): JoinNode {
		return {
			type: 'join',
			separator: ', ',
		}
	}
	getBodyHeightPx() {
		return NODE_ROW_HEIGHT_PX * 3
	}
	getPorts(): Record<string, ShapePort> {
		const baseY = NODE_HEADER_HEIGHT_PX + NODE_ROW_HEADER_GAP_PX
		return {
			inputs: {
				id: 'inputs',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'end',
				dataType: 'text',
				multi: true,
			},
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: baseY + NODE_ROW_HEIGHT_PX * 2.5,
				terminal: 'start',
				dataType: 'text',
			},
		}
	}
	async execute(
		_shape: NodeShape,
		node: JoinNode,
		inputs: InputValues
	): Promise<ExecutionResult> {
		return joinExecute(node, inputs) as Promise<ExecutionResult>
	}
	getOutputInfo(shape: NodeShape, node: JoinNode, inputs: InfoValues): InfoValues {
		const inputInfo = inputs.inputs
		const values: string[] = []
		let isOutOfDate = shape.props.isOutOfDate

		if (inputInfo) {
			if (isMultiInfoValue(inputInfo)) {
				values.push(
					...inputInfo.value
						.filter((v) => v !== STOP_EXECUTION)
						.map((v) => coerceToText(v).trim())
						.filter(Boolean)
				)
				isOutOfDate = isOutOfDate || inputInfo.isOutOfDate
			} else {
				const val = inputInfo.value
				const s =
					val === STOP_EXECUTION || val == null ? '' : coerceToText(val).trim()
				if (s) values.push(s)
				isOutOfDate = isOutOfDate || inputInfo.isOutOfDate
			}
		}

		const outputValue = values.join(node.separator)
		return {
			output: {
				value: outputValue,
				isOutOfDate,
				dataType: 'text',
			},
		}
	}
	Component = JoinNodeComponent
}

function JoinNodeComponent({ shape, node }: NodeComponentProps<JoinNode>) {
	const editor = useEditor()
	return (
		<>
			<NodeRow>
				<Port shapeId={shape.id} portId="inputs" />
				<NodePortLabel dataType="text">Inputs</NodePortLabel>
			</NodeRow>
			<NodeRow className="PromptNode-row">
				<span className="NodeInputRow-label">Separator</span>
				<input
					className="PromptNode-textarea"
					style={{ minHeight: 32, flex: 1 }}
					value={node.separator}
					placeholder=", "
					onChange={(e) =>
						updateNode<JoinNode>(editor, shape, (n) => ({
							...n,
							separator: e.target.value,
						}))
					}
					onPointerDown={(e) => e.stopPropagation()}
				/>
			</NodeRow>
			<NodeRow>
				<NodePortLabel dataType="text">Output</NodePortLabel>
			</NodeRow>
		</>
	)
}
