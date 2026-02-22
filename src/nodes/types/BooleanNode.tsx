import { T, useEditor } from 'tldraw'
import { BooleanIcon } from '../../components/icons/BooleanIcon'
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

export type BooleanNode = T.TypeOf<typeof BooleanNode>
export const BooleanNode = T.object({
	type: T.literal('boolean'),
	value: T.boolean,
})

export class BooleanNodeDefinition extends NodeDefinition<BooleanNode> {
	static type = 'boolean'
	static validator = BooleanNode
	title = 'Boolean'
	heading = 'Boolean'
	icon = (<BooleanIcon />)
	category = 'input'

	getDefault(): BooleanNode {
		return {
			type: 'boolean',
			value: false,
		}
	}

	getBodyHeightPx() {
		return NODE_ROW_HEIGHT_PX
	}

	getPorts(): Record<string, ShapePort> {
		return {
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: NODE_HEADER_HEIGHT_PX / 2,
				terminal: 'start',
				dataType: 'boolean',
			},
		}
	}

	async execute(_shape: NodeShape, node: BooleanNode): Promise<ExecutionResult> {
		await sleep(120)
		return { output: node.value }
	}

	getOutputInfo(shape: NodeShape, node: BooleanNode): InfoValues {
		return {
			output: {
				value: node.value,
				isOutOfDate: shape.props.isOutOfDate,
				dataType: 'boolean',
			},
		}
	}

	Component = BooleanNodeComponent
}

function BooleanNodeComponent({ shape, node }: NodeComponentProps<BooleanNode>) {
	const editor = useEditor()
	return (
		<NodeRow className="NodeInputRow">
			<span className="NodeInputRow-label">Value</span>
			<select
				value={String(node.value)}
				onChange={(e) =>
					updateNode<BooleanNode>(editor, shape, (n) => ({
						...n,
						value: e.target.value === 'true',
					}))
				}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<option value="false">false</option>
				<option value="true">true</option>
			</select>
		</NodeRow>
	)
}
