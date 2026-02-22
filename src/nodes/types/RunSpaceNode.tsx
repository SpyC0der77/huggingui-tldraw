import classNames from 'classnames'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { T, useEditor, useValue } from 'tldraw'
import { parseSpaceRef } from '@/lib/spaceRef'
import {
	apiRunSpace,
	apiSpaceInfo,
	SpaceEndpointInfo,
	SpaceEndpointParameter,
	SpaceInfoResult,
} from '../../api/pipelineApi'
import { SpacesIcon } from '../../components/icons/SpacesIcon'
import {
	NODE_HEADER_HEIGHT_PX,
	NODE_IMAGE_PREVIEW_HEIGHT_PX,
	NODE_ROW_HEADER_GAP_PX,
	NODE_ROW_HEIGHT_PX,
	NODE_WIDTH_PX,
	PortDataType,
} from '../../constants'
import { Port, ShapePort } from '../../ports/Port'
import { getNodeInputPortValues } from '../nodePorts'
import { NodeShape } from '../NodeShapeUtil'
import {
	areAnyInputsOutOfDate,
	ExecutionResult,
	InfoValues,
	InfoValue,
	InputValues,
	NodeComponentProps,
	NodeDefinition,
	NodeImage,
	NodePlaceholder,
	NodePortLabel,
	NodeRow,
	STOP_EXECUTION,
	updateNode,
} from './shared'

interface EndpointSchema {
	endpoints: SpaceEndpointInfo[]
}

export type RunSpaceNode = T.TypeOf<typeof RunSpaceNode>
export const RunSpaceNode = T.object({
	type: T.literal('run_space'),
	endpoint: T.string,
	argsJson: T.string,
	schemaJson: T.string.nullable(),
	lastResultUrl: T.string.nullable(),
	lastResultText: T.string.nullable(),
})

export class RunSpaceNodeDefinition extends NodeDefinition<RunSpaceNode> {
	static type = 'run_space'
	static validator = RunSpaceNode
	title = 'Run space'
	heading = 'Run space'
	icon = (<SpacesIcon />)
	category = 'process'
	resultKeys = ['lastResultUrl', 'lastResultText'] as const

	getDefault(): RunSpaceNode {
		return {
			type: 'run_space',
			endpoint: '',
			argsJson: '{}',
			schemaJson: null,
			lastResultUrl: null,
			lastResultText: null,
		}
	}

	getBodyHeightPx(_shape: NodeShape, node: RunSpaceNode): number {
		const schema = parseSchema(node.schemaJson)
		const endpoint = schema?.endpoints.find((item) => item.apiName === node.endpoint)
		const paramCount = endpoint?.parameters?.length ?? 0
		return NODE_ROW_HEIGHT_PX * (3 + paramCount) + NODE_IMAGE_PREVIEW_HEIGHT_PX
	}

	getPorts(_shape: NodeShape, node: RunSpaceNode): Record<string, ShapePort> {
		const baseY = NODE_HEADER_HEIGHT_PX + NODE_ROW_HEADER_GAP_PX
		const schema = parseSchema(node.schemaJson)
		const endpoint = schema?.endpoints.find((item) => item.apiName === node.endpoint) ?? null
		const outputDataType = getEndpointOutputPortDataType(endpoint)
		return {
			space: {
				id: 'space',
				x: 0,
				y: baseY + NODE_ROW_HEIGHT_PX * 0.5,
				terminal: 'end',
				dataType: 'space',
			},
			output: {
				id: 'output',
				x: NODE_WIDTH_PX,
				y: NODE_HEADER_HEIGHT_PX / 2,
				terminal: 'start',
				dataType: outputDataType,
			},
			...buildEndpointParameterPorts(endpoint, baseY),
		}
	}

	async execute(shape: NodeShape, node: RunSpaceNode, inputs: InputValues): Promise<ExecutionResult> {
		const spaceRef = parseSpaceRef(inputs.space as string | undefined)
		const executionId = `run_space_exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
		if (!spaceRef) {
			console.warn('[run-space-node] execute skipped: missing space', { executionId, shapeId: shape.id })
			updateNode<RunSpaceNode>(this.editor, shape, (n) => ({
				...n,
				lastResultUrl: null,
				lastResultText: null,
			}))
			return { output: null }
		}

		const schema = parseSchema(node.schemaJson)
		const endpoint = schema?.endpoints.find((entry) => entry.apiName === node.endpoint)
		if (!endpoint) {
			console.error('[run-space-node] execute failed: no endpoint selected', {
				executionId,
				shapeId: shape.id,
				spaceId: spaceRef,
			})
			throw new Error('No endpoint selected. Connect a Space and refresh schema.')
		}

		const argsState = parseArgs(node.argsJson)
		const args = (endpoint.parameters ?? []).map((parameter) =>
			coerceParameterValue(
				parameter,
				resolveParameterInputValue(inputs, parameter, argsState[parameter.parameter_name])
			)
		)
		console.info('[run-space-node] execute start', {
			executionId,
			shapeId: shape.id,
			spaceId: spaceRef,
			endpoint: endpoint.apiName,
			argCount: args.length,
		})

		const result = await apiRunSpace({
			spaceId: spaceRef,
			apiName: endpoint.apiName,
			args,
		})
		console.info('[run-space-node] execute success', {
			executionId,
			shapeId: shape.id,
			spaceId: spaceRef,
			endpoint: endpoint.apiName,
			hasImageUrl: Boolean(result.imageUrl),
		})

		const text = formatOutputText(result.output)

		updateNode<RunSpaceNode>(this.editor, shape, (n) => ({
			...n,
			lastResultUrl: result.imageUrl,
			lastResultText: result.imageUrl ? null : text,
		}))

		return { output: result.imageUrl ?? text ?? null }
	}

	getOutputInfo(shape: NodeShape, node: RunSpaceNode, inputs: InfoValues): InfoValues {
		const schema = parseSchema(node.schemaJson)
		const endpoint = schema?.endpoints.find((item) => item.apiName === node.endpoint) ?? null
		const inferredDataType = getEndpointOutputPortDataType(endpoint)
		const outputValue = node.lastResultUrl ?? node.lastResultText ?? null
		return {
			output: {
				value: outputValue,
				isOutOfDate: areAnyInputsOutOfDate(inputs) || shape.props.isOutOfDate,
				dataType: node.lastResultUrl ? 'image' : inferredDataType,
			},
		}
	}

	Component = RunSpaceNodeComponent
}

function RunSpaceNodeComponent({ shape, node }: NodeComponentProps<RunSpaceNode>) {
	const editor = useEditor()
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [refreshError, setRefreshError] = useState<string | null>(null)
	const inputValues = useValue('run space inputs', () => getNodeInputPortValues(editor, shape.id), [
		editor,
		shape.id,
	])
	const spaceInput = inputValues.space
	const spaceId = parseSpaceRef(spaceInput?.value as string | undefined)
	const schema = useMemo(() => parseSchema(node.schemaJson), [node.schemaJson])
	const endpoint = schema?.endpoints.find((entry) => entry.apiName === node.endpoint) ?? null
	const argsState = useMemo(() => parseArgs(node.argsJson), [node.argsJson])

	const refreshSchema = useCallback(async () => {
		if (!spaceId) return
		setIsRefreshing(true)
		setRefreshError(null)
		try {
			const info = await apiSpaceInfo(spaceId)
			const nextEndpoint = resolveEndpoint(node.endpoint, info)
			const nextArgs = hydrateDefaults(nextEndpoint, argsState)
			updateNode<RunSpaceNode>(editor, shape, (n) => ({
				...n,
				endpoint: nextEndpoint?.apiName ?? '',
				schemaJson: JSON.stringify(stripSpaceInfo(info)),
				argsJson: JSON.stringify(nextArgs),
			}))
		} catch (error) {
			setRefreshError(error instanceof Error ? error.message : 'Failed to refresh Space schema')
		} finally {
			setIsRefreshing(false)
		}
	}, [argsState, editor, node.endpoint, shape, spaceId])

	useEffect(() => {
		if (!spaceId) return
		if (!schema) {
			void refreshSchema()
		}
	}, [refreshSchema, schema, spaceId])

	const updateArg = (parameterName: string, value: unknown) => {
		const nextArgs = { ...argsState, [parameterName]: value }
		updateNode<RunSpaceNode>(editor, shape, (n) => ({
			...n,
			argsJson: JSON.stringify(nextArgs),
		}))
	}

	return (
		<>
			<NodeRow>
				<Port shapeId={shape.id} portId="space" />
				<NodePortLabel dataType="space">Space</NodePortLabel>
				{spaceInput ? (
					<span className="NodeRow-connected-value">
						{spaceInput.isOutOfDate || spaceInput.value === STOP_EXECUTION ? (
							<NodePlaceholder />
						) : (
							spaceId ?? 'invalid'
						)}
					</span>
				) : (
					<span className="NodeRow-disconnected">connect Space node</span>
				)}
			</NodeRow>

			<NodeRow className="NodeInputRow">
				<span className="NodeInputRow-label">Endpoint</span>
					<select
					value={node.endpoint}
					onChange={(e) =>
						updateNode<RunSpaceNode>(editor, shape, (n) => ({
							...n,
							endpoint: e.target.value,
							argsJson: JSON.stringify(
								hydrateDefaults(
									schema?.endpoints.find((item) => item.apiName === e.target.value) ?? null,
									argsState
								)
							),
						}))
					}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<option value="">Select endpoint...</option>
					{(schema?.endpoints ?? []).map((entry) => (
						<option key={entry.apiName} value={entry.apiName}>
							{entry.apiName}
						</option>
					))}
				</select>
			</NodeRow>

			<NodeRow>
				<button
					className="RunSpaceNode-refresh"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={() => void refreshSchema()}
					disabled={!spaceId || isRefreshing}
				>
					{isRefreshing ? 'Refreshing...' : 'Refresh schema'}
				</button>
				{refreshError && <span className="NodeRow-disconnected">{refreshError.slice(0, 40)}</span>}
			</NodeRow>

			{(endpoint?.parameters ?? []).map((parameter) => (
				<ParameterRow
					key={parameter.parameter_name}
					shapeId={shape.id}
					portId={getParameterPortId(parameter.parameter_name)}
					portDataType={getParameterPortDataType(parameter)}
					hasConnectionPort= {shouldExposeConnectionPort(parameter)}
					parameter={parameter}
					value={argsState[parameter.parameter_name]}
					connectedInput={inputValues[getParameterPortId(parameter.parameter_name)]}
					randomizeSeedEnabled={isRandomizeSeedEnabled(endpoint, argsState, inputValues)}
					onChange={(value) => updateArg(parameter.parameter_name, value)}
				/>
			))}

			<div
				className={classNames('NodeImagePreview', {
					NodeImagePreview_loading: shape.props.isOutOfDate,
				})}
			>
				{node.lastResultUrl ? (
					<NodeImage src={node.lastResultUrl} alt="Space result" />
				) : node.lastResultText ? (
					<div className="RunSpaceNode-result">{node.lastResultText}</div>
				) : (
					<div className="NodeImagePreview-empty">
						<span>Run to execute selected Space endpoint</span>
					</div>
				)}
			</div>
		</>
	)
}

function ParameterRow({
	shapeId,
	portId,
	portDataType,
	hasConnectionPort,
	parameter,
	value,
	connectedInput,
	randomizeSeedEnabled,
	onChange,
}: {
	shapeId: NodeShape['id']
	portId: string
	portDataType: PortDataType
	hasConnectionPort: boolean
	parameter: SpaceEndpointParameter
	value: unknown
	connectedInput?: InfoValue
	randomizeSeedEnabled: boolean
	onChange: (value: unknown) => void
}) {
	const enumValues = parameter.type?.enum
	const typeName = parameter.type?.type
	const effectiveValue =
		value ?? (parameter.parameter_has_default ? parameter.parameter_default : defaultForType(typeName))

	if (Array.isArray(enumValues) && enumValues.length > 0) {
		return (
			<NodeRow className="NodeInputRow">
				<span className="NodeInputRow-label">{parameter.label || parameter.parameter_name}</span>
				<select
					value={String(effectiveValue ?? enumValues[0])}
					onChange={(e) => onChange(e.target.value)}
					onPointerDown={(e) => e.stopPropagation()}
				>
					{enumValues.map((entry) => (
						<option key={entry} value={entry}>
							{entry}
						</option>
					))}
				</select>
			</NodeRow>
		)
	}

	if (typeName === 'boolean') {
		return (
			<NodeRow className="NodeInputRow">
				{hasConnectionPort && <Port shapeId={shapeId} portId={portId} />}
				{hasConnectionPort ? (
					<NodePortLabel dataType={portDataType}>
						{parameter.label || parameter.parameter_name}
					</NodePortLabel>
				) : (
					<span className="NodeInputRow-label">{parameter.label || parameter.parameter_name}</span>
				)}
				{connectedInput ? (
					<span className="NodeRow-connected-value">
						{connectedInput.isOutOfDate ? <NodePlaceholder /> : formatConnectedValue(connectedInput.value)}
					</span>
				) : (
					<select
						value={String(Boolean(effectiveValue))}
						onChange={(e) => onChange(e.target.value === 'true')}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<option value="true">true</option>
						<option value="false">false</option>
					</select>
				)}
			</NodeRow>
		)
	}

	if (typeName === 'number' || typeName === 'integer') {
		const disableSeedInput = isSeedParameter(parameter) && randomizeSeedEnabled
		return (
			<NodeRow className="NodeInputRow">
				{hasConnectionPort && <Port shapeId={shapeId} portId={portId} />}
				{hasConnectionPort ? (
					<NodePortLabel dataType={portDataType}>
						{parameter.label || parameter.parameter_name}
					</NodePortLabel>
				) : (
					<span className="NodeInputRow-label">{parameter.label || parameter.parameter_name}</span>
				)}
				{connectedInput ? (
					<span className="NodeRow-connected-value">
						{connectedInput.isOutOfDate ? <NodePlaceholder /> : formatConnectedValue(connectedInput.value)}
					</span>
				) : (
					<input
						type="text"
						inputMode="decimal"
						value={String(effectiveValue ?? '')}
						onChange={(e) => {
							const parsed = Number(e.target.value)
							if (Number.isNaN(parsed)) {
								const fallback =
									typeof effectiveValue === 'number'
										? effectiveValue
										: Number(defaultForType(typeName))
								onChange(Number.isNaN(fallback) ? 0 : fallback)
								return
							}
							onChange(parsed)
						}}
						onPointerDown={(e) => e.stopPropagation()}
						disabled={disableSeedInput}
					/>
				)}
			</NodeRow>
		)
	}

	return (
		<NodeRow className="NodeInputRow">
			{hasConnectionPort && <Port shapeId={shapeId} portId={portId} />}
			{hasConnectionPort ? (
				<NodePortLabel dataType={portDataType}>
					{parameter.label || parameter.parameter_name}
				</NodePortLabel>
			) : (
				<span className="NodeInputRow-label">{parameter.label || parameter.parameter_name}</span>
			)}
			{connectedInput ? (
				<span className="NodeRow-connected-value">
					{connectedInput.isOutOfDate ? <NodePlaceholder /> : formatConnectedValue(connectedInput.value)}
				</span>
			) : (
				<input
					type="text"
					value={String(effectiveValue ?? '')}
					onChange={(e) => onChange(e.target.value)}
					onPointerDown={(e) => e.stopPropagation()}
				/>
			)}
		</NodeRow>
	)
}

function parseSchema(raw: string | null): EndpointSchema | null {
	if (!raw) return null
	try {
		return JSON.parse(raw) as EndpointSchema
	} catch {
		return null
	}
}

function parseArgs(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>
		return parsed && typeof parsed === 'object' ? parsed : {}
	} catch {
		return {}
	}
}

function resolveEndpoint(currentEndpoint: string, info: SpaceInfoResult): SpaceEndpointInfo | null {
	if (!info.endpoints.length) return null
	return info.endpoints.find((entry) => entry.apiName === currentEndpoint) ?? info.endpoints[0] ?? null
}

function hydrateDefaults(
	endpoint: SpaceEndpointInfo | null,
	current: Record<string, unknown>
): Record<string, unknown> {
	if (!endpoint) return current
	const next = { ...current }
	for (const parameter of endpoint.parameters ?? []) {
		const key = parameter.parameter_name
		if (next[key] !== undefined) continue
		next[key] = parameter.parameter_has_default
			? parameter.parameter_default
			: defaultForType(parameter.type?.type)
	}
	return next
}

function defaultForType(typeName: string | undefined): unknown {
	if (typeName === 'boolean') return false
	if (typeName === 'number' || typeName === 'integer') return 0
	return ''
}

function coerceParameterValue(parameter: SpaceEndpointParameter, value: unknown): unknown {
	if (value === undefined || value === null || value === '') {
		return parameter.parameter_has_default ? parameter.parameter_default : defaultForType(parameter.type?.type)
	}
	if (parameter.type?.type === 'boolean') return Boolean(value)
	if (parameter.type?.type === 'number') {
		const numeric = typeof value === 'number' ? value : Number(value)
		if (Number.isNaN(numeric)) {
			return parameter.parameter_has_default
				? parameter.parameter_default
				: defaultForType(parameter.type?.type)
		}
		return numeric
	}
	if (parameter.type?.type === 'integer') {
		const numeric =
			typeof value === 'number'
				? Math.trunc(value)
				: parseInt(String(value), 10)
		if (Number.isNaN(numeric)) {
			return parameter.parameter_has_default
				? parameter.parameter_default
				: defaultForType(parameter.type?.type)
		}
		return numeric
	}
	return value
}

function isRandomizeSeedEnabled(
	endpoint: SpaceEndpointInfo | null,
	args: Record<string, unknown>,
	inputs: InfoValues
): boolean {
	if (!endpoint) return false
	const randomizeParam = endpoint.parameters?.find((parameter) => isRandomizeSeedParameter(parameter))
	if (!randomizeParam) return false

	const raw =
		inputs[getParameterPortId(randomizeParam.parameter_name)]?.value ??
		args[randomizeParam.parameter_name] ??
		(randomizeParam.parameter_has_default ? randomizeParam.parameter_default : defaultForType('boolean'))

	return Boolean(raw)
}

function isRandomizeSeedParameter(parameter: SpaceEndpointParameter): boolean {
	const key = parameter.parameter_name.trim().toLowerCase()
	const label = (parameter.label ?? '').trim().toLowerCase()
	return key === 'randomize_seed' || label === 'randomize seed'
}

function isSeedParameter(parameter: SpaceEndpointParameter): boolean {
	const key = parameter.parameter_name.trim().toLowerCase()
	const label = (parameter.label ?? '').trim().toLowerCase()
	return key === 'seed' || label === 'seed'
}

function getParameterPortId(parameterName: string): string {
	return `param:${parameterName}`
}

function getParameterPortDataType(parameter: SpaceEndpointParameter): PortDataType {
	const typeName = parameter.type?.type
	if (typeName === 'number' || typeName === 'integer') return 'number'
	if (typeName === 'boolean') return 'boolean'
	return 'text'
}

function formatConnectedValue(value: unknown): string {
	if (value == null) return ''
	if (Array.isArray(value)) {
		return value.map((entry) => formatConnectedValue(entry)).join(', ')
	}
	if (typeof value === 'object') {
		return '[object]'
	}
	return String(value)
}

function resolveParameterInputValue(
	inputs: InputValues,
	parameter: SpaceEndpointParameter,
	fallbackValue: unknown
): unknown {
	const connected = inputs[getParameterPortId(parameter.parameter_name)]
	if (connected === undefined) return fallbackValue
	return Array.isArray(connected) ? connected[0] : connected
}

function formatOutputText(output: unknown): string | null {
	if (output == null) return null
	if (typeof output === 'string') return output
	try {
		const json = JSON.stringify(output, null, 2)
		return json ? json.slice(0, 2400) : null
	} catch {
		return String(output)
	}
}

function stripSpaceInfo(info: SpaceInfoResult): EndpointSchema {
	return {
		endpoints: info.endpoints.map((endpoint) => ({
			apiName: endpoint.apiName,
			parameters: endpoint.parameters ?? [],
			returns: endpoint.returns ?? [],
			show_api: endpoint.show_api,
		})),
	}
}

function buildEndpointParameterPorts(
	endpoint: SpaceEndpointInfo | null,
	baseY: number
): Record<string, ShapePort> {
	const ports: Record<string, ShapePort> = {}
	if (!endpoint) return ports

	for (const [index, parameter] of (endpoint.parameters ?? []).entries()) {
		if (!shouldExposeConnectionPort(parameter)) continue
		const rowOffset = 3 + index
		const portId = getParameterPortId(parameter.parameter_name)
		ports[portId] = {
			id: portId,
			x: 0,
			y: baseY + NODE_ROW_HEIGHT_PX * (rowOffset + 0.5),
			terminal: 'end',
			dataType: getParameterPortDataType(parameter),
		}
	}

	return ports
}

function isEnumParameter(parameter: SpaceEndpointParameter): boolean {
	return Array.isArray(parameter.type?.enum) && parameter.type.enum.length > 0
}

function shouldExposeConnectionPort(parameter: SpaceEndpointParameter): boolean {
	if (isEnumParameter(parameter)) return false

	const typeName = parameter.type?.type
	if (typeName === 'boolean') return false

	const component = (parameter.component ?? '').trim().toLowerCase()
	// Choice-like controls should stay local in the Run space node.
	if (component === 'checkbox' || component === 'radio' || component === 'dropdown') return false

	return true
}

function getEndpointOutputPortDataType(endpoint: SpaceEndpointInfo | null): PortDataType {
	if (!endpoint) return 'any'
	const returns = endpoint.returns
	if (!Array.isArray(returns) || returns.length === 0) return 'any'

	for (const item of returns) {
		const mapped = mapReturnSchemaToPortType(item)
		if (mapped === 'image') return 'image'
	}

	return mapReturnSchemaToPortType(returns[0])
}

function mapReturnSchemaToPortType(returnItem: unknown): PortDataType {
	if (!returnItem || typeof returnItem !== 'object') return 'any'
	const obj = returnItem as Record<string, unknown>
	const component = String(obj.component ?? '').toLowerCase()

	if (component.includes('image')) return 'image'
	if (component.includes('audio')) return 'any'
	if (component.includes('video')) return 'any'

	const typeNode = obj.type
	if (typeNode && typeof typeNode === 'object') {
		const schema = typeNode as Record<string, unknown>
		const primitive = String(schema.type ?? '').toLowerCase()
		if (primitive === 'number' || primitive === 'integer') return 'number'
		if (primitive === 'boolean') return 'boolean'
		if (primitive === 'string') return 'text'

		const title = String(schema.title ?? '').toLowerCase()
		const additional = String(schema.additional_description ?? '').toLowerCase()
		if (title.includes('image') || additional.includes('image')) return 'image'

		const properties = schema.properties
		if (properties && typeof properties === 'object') {
			const keys = Object.keys(properties as Record<string, unknown>)
			if (keys.includes('url') && keys.includes('path')) {
				return 'image'
			}
		}
	}

	return 'text'
}
