import { PORT_TYPE_COLORS, type PortDataType } from '../constants'

const PORT_TYPE_LABELS: Record<PortDataType, string> = {
	image: 'Image',
	text: 'Text',
	model: 'Model',
	space: 'Space',
	number: 'Number',
	boolean: 'Boolean',
	any: 'Any',
}

export function ConnectionColorLegend() {
	return (
		<div className="ConnectionColorLegend" aria-hidden>
			<div className="ConnectionColorLegend-title">Connection types</div>
			<div className="ConnectionColorLegend-items">
				{(Object.keys(PORT_TYPE_COLORS) as PortDataType[]).map((type) => (
					<div key={type} className="ConnectionColorLegend-item">
						<span
							className="ConnectionColorLegend-swatch"
							style={{ backgroundColor: PORT_TYPE_COLORS[type] }}
						/>
						<span className="ConnectionColorLegend-label">{PORT_TYPE_LABELS[type]}</span>
					</div>
				))}
			</div>
		</div>
	)
}
