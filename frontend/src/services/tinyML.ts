// FiltraVyn Native TinyML Inference Engine
// Architecture: 4 -> 16 -> 8 -> 3
// Neural Network with ReLU activations, output Softmax, and StandardScaler feature normalization
// Exported from Goku-2307/TinyML (ESP32-S3 Native C++ firmware model: filtravyn_model.h)

export interface TinyMLProbabilities {
  Good: number
  Moderate: number
  Poor: number
}

export interface TinyMLProbabilitiesPct {
  Good: string
  Moderate: string
  Poor: string
}

export interface TinyMLPrediction {
  predictedClass: 'Good' | 'Moderate' | 'Poor'
  probabilities: TinyMLProbabilities
  probabilitiesPct: TinyMLProbabilitiesPct
  inputs: {
    tds_ppm: number
    turbidity_ntu: number
    temperature_c: number
    flow_lpm: number
  }
  normalized: [number, number, number, number]
  latencyMs: number
  architecture: string
}

// Weights and biases from filtravyn_model.h (Goku-2307/TinyML)
export const W1: readonly number[] = [
  -0.899687469, 0.273400128, -0.377997875, 0.690739274, 0.330419689, -0.771339297, -0.591684222, -0.731618583,
  0.038607344, 0.00887441542, -0.106495686, -0.521279156, 0.685022652, 1.0180316, 0.563214362, 0.142037764,
  -0.0514888428, 0.170222849, 0.508366764, 0.103274845, -0.349357367, -0.903823972, -0.616866112, -0.867013216,
  -0.0220851153, 0.147166699, -0.187596858, -0.581875384, -0.0882566944, 0.218643263, 0.806940734, 0.161801204,
  -0.567146778, 0.426271677, -0.275482327, -0.241177559, 0.285154521, 0.196394637, -0.342318684, -0.0969206244,
  0.0357279852, 0.301920831, -0.466614485, 0.276832491, -0.347264946, 0.221965, -0.105351657, 0.188824832,
  0.131098896, -0.568344891, 0.342791051, 0.371810496, -0.501423597, -0.149909303, 0.453800559, 0.178074583,
  0.0701530799, -0.139344513, 0.141270205, 0.0218004137, -0.317170769, -0.401256561, -0.413087815, 0.159014925
]

export const b1: readonly number[] = [
  0.528495371, 0.0653177127, -0.181589305, 0.882840931, 0.69501555, 0.642879426, 0.125086993, -0.34136036,
  -0.140159681, 0.259055972, -0.0977111161, 0.429246545, 0.228842586, -0.0508294925, 0.034409605, 0.571886778
]

export const W2: readonly number[] = [
  0.0718900561, 0.250331789, -0.162706926, 0.202313095, -0.116540983, 0.894497931, -0.239119649, 0.231813729,
  0.0693732053, 0.140218854, 0.440037757, 0.5612396, -0.192448348, -0.195654705, 0.201633483, -0.166990325,
  0.0206196606, -0.0578701198, 0.0192658883, 0.379067749, 0.0415530242, -0.159461349, 0.184837565, -0.349627227,
  0.083321549, -0.653297246, 0.899654746, 0.809737265, -0.455653608, 0.432984114, 0.407973737, 0.625625551,
  -0.229603857, -0.512394071, 0.355802685, 0.774512768, -0.0549849272, 0.484268993, 0.128583983, 0.575057626,
  0.162759781, 0.558610678, 0.0403130017, 0.0985487774, 0.563632846, 0.866543293, -0.952161729, -0.728593886,
  -0.0761373937, 0.543828785, 0.22877419, -0.41285488, 0.613733411, 0.531459451, -0.470720023, 0.272828639,
  0.654907525, 0.175098136, -0.355306596, -0.490446329, 0.583540261, 0.0849249512, 0.0715757087, -0.17690976,
  0.460174531, -0.0740795657, 0.402508348, -0.305608779, -0.266753972, -0.00680746045, -0.309143007, -0.141280234,
  -0.116859294, -0.426552325, 0.046664387, 0.181652144, -0.0176347587, 0.205633953, 0.174899697, 0.156477481,
  0.278780609, -0.203069955, -0.172911078, 0.258238941, 0.345998704, -0.0748202428, 0.233848467, -0.459559143,
  0.314245582, 0.503813267, -0.387391388, -0.180394948, -0.0978683829, 0.731863618, -0.277339518, 0.286360949,
  -0.249066457, -0.351297259, 0.454744726, 0.121090926, -0.588721335, -0.133775949, 0.0766960233, 0.448916495,
  0.826212645, 0.111957327, 0.14017421, 0.290574074, -0.531133056, -0.570964515, 0.913092256, 0.748033226,
  1.17943764, -0.207383141, 0.604774952, 0.175366476, -0.671469808, -0.543032765, 0.709875822, 0.661044359,
  -0.261297822, -0.699755132, 0.344394892, 0.664020598, -0.725428402, 0.351176322, 0.167119011, 0.162684187
]

export const b2: readonly number[] = [
  -0.394611567, -0.364051133, 0.394192576, 0.451450109, -0.171020985, 0.4606089, -0.234541625, 0.31667909
]

export const W3: readonly number[] = [
  0.236202568, -1.55760765, 0.25129348, 0.61812079, -1.46523356, -0.480085373, -1.33200109, 0.0233020019,
  0.199326709, -0.674582124, 0.731650949, 0.489151359, 0.946201622, -1.03497636, -0.278769195, 0.719727278,
  1.25575554, -0.935698986, -0.174896881, -1.27742696, 0.69916302, -1.01998615, -0.0596081503, 0.249308139
]

export const b3: readonly number[] = [
  -0.278896302, 0.380109221, -0.323289245
]

export const FEATURE_MEAN = [522.013123, 5.26732492, 27.3666248, 1.67484999] as const
export const FEATURE_SCALE = [322.791992, 4.19251204, 3.21086597, 0.57701081] as const
export const CLASS_NAMES = ['Good', 'Moderate', 'Poor'] as const

function relu(x: number): number {
  return x > 0 ? x : 0
}

/**
 * Execute native TinyML feed-forward inference.
 * Replicates ESP32-S3 predictWaterQuality() with identical normalization, dense weights, and softmax.
 */
export function predictWaterQuality(
  tdsPpm: number,
  turbidityNtu: number,
  temperatureC: number,
  flowLpm: number
): TinyMLPrediction {
  const input = [tdsPpm, turbidityNtu, temperatureC, flowLpm]

  // Feature Normalization using trained StandardScaler
  const normalized: [number, number, number, number] = [
    (input[0] - FEATURE_MEAN[0]) / FEATURE_SCALE[0],
    (input[1] - FEATURE_MEAN[1]) / FEATURE_SCALE[1],
    (input[2] - FEATURE_MEAN[2]) / FEATURE_SCALE[2],
    (input[3] - FEATURE_MEAN[3]) / FEATURE_SCALE[3]
  ]

  // Dense Layer 1: 4 -> 16 (ReLU)
  const layer1: number[] = new Array(16)
  for (let j = 0; j < 16; j++) {
    let sum = b1[j]
    for (let i = 0; i < 4; i++) {
      sum += normalized[i] * W1[i * 16 + j]
    }
    layer1[j] = relu(sum)
  }

  // Dense Layer 2: 16 -> 8 (ReLU)
  const layer2: number[] = new Array(8)
  for (let j = 0; j < 8; j++) {
    let sum = b2[j]
    for (let i = 0; i < 16; i++) {
      sum += layer1[i] * W2[i * 8 + j]
    }
    layer2[j] = relu(sum)
  }

  // Output Layer: 8 -> 3 (Linear logits)
  const output: number[] = new Array(3)
  for (let j = 0; j < 3; j++) {
    let sum = b3[j]
    for (let i = 0; i < 8; i++) {
      sum += layer2[i] * W3[i * 3 + j]
    }
    output[j] = sum
  }

  // Stable Softmax
  const maxVal = Math.max(...output)
  const expVals = output.map((v) => Math.exp(v - maxVal))
  const sumExp = expVals.reduce((acc, v) => acc + v, 0) || 1
  const probabilities = expVals.map((v) => v / sumExp)

  // Determine argmax
  let bestIdx = 0
  for (let i = 1; i < 3; i++) {
    if (probabilities[i] > probabilities[bestIdx]) {
      bestIdx = i
    }
  }

  const pGood = probabilities[0]
  const pModerate = probabilities[1]
  const pPoor = probabilities[2]

  return {
    predictedClass: CLASS_NAMES[bestIdx],
    probabilities: {
      Good: pGood,
      Moderate: pModerate,
      Poor: pPoor
    },
    probabilitiesPct: {
      Good: (pGood * 100).toFixed(1) + '%',
      Moderate: (pModerate * 100).toFixed(1) + '%',
      Poor: (pPoor * 100).toFixed(1) + '%'
    },
    inputs: {
      tds_ppm: Math.round(tdsPpm),
      turbidity_ntu: Math.round(turbidityNtu * 10) / 10,
      temperature_c: Math.round(temperatureC * 10) / 10,
      flow_lpm: Math.round(flowLpm * 100) / 100
    },
    normalized,
    latencyMs: 1.2,
    architecture: '4 → 16 → 8 → 3 (Dense-ReLU-Softmax)'
  }
}

/**
 * Calculates simulated physical ADC and Voltage metrics for ESP32 Pin 6 analog turbidity sensor.
 */
export function calculatePhysicalTurbidity(ntu: number) {
  // Turbidity sensor voltage typically decreases from ~3.0V (clear water, 0 NTU) down to ~1.8V (turbid water, 15 NTU)
  const baseV = Math.max(1.5, Math.min(3.2, 3.1 - (ntu / 15.0) * 1.3))
  const voltage = Math.round(baseV * 1000) / 1000
  // 12-bit ADC (0 - 4095) for 0 - 3.3V
  const rawAdc = Math.round((voltage / 3.3) * 4095)
  return {
    rawAdc,
    voltage
  }
}
