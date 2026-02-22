import { T, useEditor } from 'tldraw'
import { EnumIcon } from '../../components/icons/EnumIcon'
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

export type EnumNode = T.TypeOf<typeof EnumNode>
export const EnumNode = T.object({
	type: T.literal('enum'),
	options: T.string,
	value: T.string,
})

export class EnumNodeDefinition extends NodeDefinition<EnumNode> {
	static type = 'enum'
	static validator = EnumNode
	title = 'Enum (Legacy)'
	heading = 'Enum'
	hidden = true as const
	icon = (<EnumIcon />)
	category = 'input'

	getDefault(): EnumNode {
		return {
			type: 'enum',
			options: 'option-a, option-b',
			value: 'option-a',
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

	async execute(_shape: NodeShape, node: EnumNode): Promise<ExecutionResult> {
		await sleep(150)
		return { output: ensureSelectedOption(node.options, node.value) }
	}

	getOutputInfo(shape: NodeShape, node: EnumNode): InfoValues {
		return {
			output: {
				value: ensureSelectedOption(node.options, node.value),
				isOutOfDate: shape.props.isOutOfDate,
				dataType: 'text',
			},
		}
	}

	Component = EnumNodeComponent
}

function EnumNodeComponent({ shape, node }: NodeComponentProps<EnumNode>) {
	const editor = useEditor()
	const options = parseOptions(node.options)
	const selected = ensureSelectedOption(node.options, node.value)

	return (
		<>
			<NodeRow className="NodeInputRow">
				<span className="NodeInputRow-label">Options</span>
				<input
					type="text"
					value={node.options}
					onChange={(e) =>
						updateNode<EnumNode>(editor, shape, (n) => {
							const nextOptions = e.target.value
							return {
								...n,
								options: nextOptions,
								value: ensureSelectedOption(nextOptions, n.value),
							}
						})
					}
					onPointerDown={(e) => e.stopPropagation()}
					placeholder="a, b, c"
				/>
			</NodeRow>
			<NodeRow className="NodeInputRow">
				<span className="NodeInputRow-label">Value</span>
				<select
					value={selected}
					onChange={(e) =>
						updateNode<EnumNode>(editor, shape, (n) => ({
							...n,
							value: e.target.value,
						}))
					}
					onPointerDown={(e) => e.stopPropagation()}
				>
					{options.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</NodeRow>
		</>
	)
}

function parseOptions(raw: string): string[] {
	const options = raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean)
	return options.length ? options : ['option-a']
}

function ensureSelectedOption(rawOptions: string, currentValue: string): string {
	const options = parseOptions(rawOptions)
	return options.includes(currentValue) ? currentValue : options[0]
}
