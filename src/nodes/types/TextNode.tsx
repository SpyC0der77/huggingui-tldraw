import { T, useEditor } from 'tldraw'
import { PromptIcon } from '../../components/icons/PromptIcon'
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

export type TextNode = T.TypeOf<typeof TextNode>
export const TextNode = T.object({
	type: T.literal('text'),
	text: T.string,
})

export class TextNodeDefinition extends NodeDefinition<TextNode> {
	static type = 'text'
	static validator = TextNode
	title = 'Text'
	heading = 'Text'
	icon = (<PromptIcon />)
	category = 'input'

	getDefault(): TextNode {
		return {
			type: 'text',
			text: 'a photo of a cat sitting on a windowsill',
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
				dataType: 'text',
			},
		}
	}

	async execute(_shape: NodeShape, node: TextNode): Promise<ExecutionResult> {
		await sleep(200)
		return { output: node.text }
	}

	getOutputInfo(shape: NodeShape, node: TextNode): InfoValues {
		return {
			output: {
				value: node.text,
				isOutOfDate: shape.props.isOutOfDate,
				dataType: 'text',
			},
		}
	}

	Component = TextNodeComponent
}

function TextNodeComponent({ shape, node }: NodeComponentProps<TextNode>) {
	const editor = useEditor()
	return (
		<NodeRow className="PromptNode-row">
			<textarea
				className="PromptNode-textarea"
				value={node.text}
				placeholder="Enter text..."
				onChange={(e) =>
					updateNode<TextNode>(
						editor,
						shape,
						(n) => ({
							...n,
							text: e.target.value,
						}),
						false
					)
				}
				onPointerDown={(e) => e.stopPropagation()}
				onFocus={() => editor.setSelectedShapes([shape.id])}
			/>
		</NodeRow>
	)
}
