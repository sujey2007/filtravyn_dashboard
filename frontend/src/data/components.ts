// Schematic symbols for the placeholder twin. These are NOT product geometry:
// positions and shapes only show the order of the water path until your SolidWorks model is mapped.

export type ComponentId = 'tank' | 'pump' | 'filter' | 'flowSensor' | 'cell' | 'outlet'
export type Kind = 'tank' | 'pump' | 'filter' | 'flow' | 'cell' | 'outlet'

export interface CompDef {
  id: ComponentId
  name: string
  short: string
  kind: Kind
  x: number
  z: number
  /** half-width along the flow axis, used to route the schematic pipe */
  hw: number
  /** symbol height */
  h: number
  facts: string[]
}

// Water path order is fixed by the CAD brief:
// tank -> pump -> filter -> flow sensor -> measurement chamber -> outlet
export const COMPONENTS: CompDef[] = [
  {
    id: 'tank', name: 'Raw-water tank', short: 'Tank', kind: 'tank', x: -7.2, z: 0, hw: 0.85, h: 2,
    facts: [
      'Source reservoir at the start of the water path.',
      'No level sensor is in the current hardware list, so no level is shown.',
      'Real size and position come from your SolidWorks model.',
    ],
  },
  {
    id: 'pump', name: 'Diaphragm pump', short: 'Pump', kind: 'pump', x: -4.4, z: 1.5, hw: 0.65, h: 1.2,
    facts: [
      '24 V DC. The label reads 0.33 A and about 1.6 L/min (label values, not measured).',
      'Switched by the four-channel relay board. The pump is the intended load.',
      'Control is read-only here until the backend has a confirmed command path.',
    ],
  },
  {
    id: 'filter', name: 'Sediment filter', short: 'Filter', kind: 'filter', x: -1.6, z: -0.6, hw: 0.5, h: 2.3,
    facts: [
      'PP spun sediment cartridge.',
      'Remaining life is not estimated. No validated method is implemented, and elapsed time alone is not evidence of filter condition.',
    ],
  },
  {
    id: 'flowSensor', name: 'Flow sensor', short: 'Flow sensor', kind: 'flow', x: 1.1, z: 1.4, hw: 0.45, h: 0.8,
    facts: [
      'Three-wire pulse-type sensor. Your CAD brief names a ZJ-S401. Verify the model and pinout.',
      'K-factor is not set. Flow values are placeholders until calibrated against measured volume over time.',
    ],
  },
  {
    id: 'cell', name: 'Measurement chamber', short: 'Chamber', kind: 'cell', x: 3.8, z: -0.2, hw: 0.75, h: 1.1,
    facts: [
      'TDS Meter V1.0 probe reports ppm.',
      'Temperature probe reports °C. Your dashboard brief says DS18B20 and your CAD brief says NTC 10 kΩ. Confirm which is installed.',
      'Turbidity optical sensor connected to ESP32-S3 Pin 6 ADC (reports calibrated NTU, raw ADC, and voltage).',
      'TinyML neural network on ESP32-S3 evaluates TDS, turbidity, temp, and flow for real-time water quality classification.',
    ],
  },
  {
    id: 'outlet', name: 'Clean-water outlet', short: 'Outlet', kind: 'outlet', x: 6.7, z: 1.0, hw: 0.4, h: 1,
    facts: [
      'End of the water path.',
      'Not monitored. A TDS reading alone does not make this water safe to drink.',
    ],
  },
]

export const COMP_BY_ID = Object.fromEntries(COMPONENTS.map((c) => [c.id, c])) as Record<ComponentId, CompDef>
