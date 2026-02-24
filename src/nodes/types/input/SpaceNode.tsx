import { T, useEditor } from 'tldraw'
import { encodeSpaceRef } from '@/lib/spaceRef'
import { SpacesIcon } from '../../../components/icons/SpacesIcon'
import { NODE_HEADER_HEIGHT_PX, NODE_ROW_HEIGHT_PX, NODE_WIDTH_PX } from '../../../constants'
import { ShapePort } from '../../../ports/Port'
import { sleep } from '../../../utils/sleep'
import { NodeShape } from '../../NodeShapeUtil'
import {
	ExecutionResult,
	InfoValues,
	NodeComponentProps,
	NodeDefinition,
	NodeRow,
	updateNode,
} from '../shared'

export type SpaceNode = T.TypeOf<typeof SpaceNode>
export const SpaceNode = T.object({
	type: T.literal('space'),
	spaceId: T.string,
})

export class SpaceNodeDefinition extends NodeDefinition<SpaceNode> {
	static type = 'space'
	static validator = SpaceNode
	title = 'Space'
	heading = 'Space'
	icon = (<SpacesIcon />)
	category = 'input'

	getDefault(): SpaceNode {
		return {
			type: 'space',
			spaceId: 'Efficient-Large-Model/SanaSprint',
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
				dataType: 'space',
			},
		}
	}

	async execute(_shape: NodeShape, node: SpaceNode): Promise<ExecutionResult> {
		await sleep(120)
		return { output: encodeSpaceRef(node.spaceId.trim()) }
	}

	getOutputInfo(shape: NodeShape, node: SpaceNode): InfoValues {
		return {
			output: {
				value: encodeSpaceRef(node.spaceId.trim()),
				isOutOfDate: shape.props.isOutOfDate,
				dataType: 'space',
			},
		}
	}

	Component = SpaceNodeComponent
}

function SpaceNodeComponent({ shape, node }: NodeComponentProps<SpaceNode>) {
	const editor = useEditor()
	return (
		<NodeRow className="NodeInputRow">
			<span className="NodeInputRow-label">ID</span>
			<input
				type="text"
				value={node.spaceId}
				onChange={(e) =>
					updateNode<SpaceNode>(editor, shape, (n) => ({
						...n,
						spaceId: e.target.value,
					}))
				}
				onPointerDown={(e) => e.stopPropagation()}
				placeholder="owner/space-name"
			/>
		</NodeRow>
	)
}
