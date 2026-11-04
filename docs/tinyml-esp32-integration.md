# FiltraVyn TinyML & ESP32-S3 Integration

This document details the on-device Edge AI architecture and sensor parameters integrated into the FiltraVyn Water Purifier System from [Goku-2307/TinyML](https://github.com/Goku-2307/TinyML).

---

## 1. Input Sensor Parameters

The system samples four core physical water quality parameters:

| Parameter | Unit | Plausible Range | Sensor / Pin | Description |
| :--- | :--- | :--- | :--- | :--- |
| **TDS** (`tds_ppm`) | ppm | 100 – 1000 | TDS Meter Probe V1.0 | Dissolved ionic solids in purified water |
| **Turbidity** (`turbidity_ntu`) | NTU | 0.0 – 15.0 | Optical Turbidity Sensor (ESP32-S3 Pin 6 ADC) | Water clarity / particulate suspension |
| **Temperature** (`temperature_c`) | °C | 20.0 – 35.0 | Waterproof Thermal Probe (DS18B20) | Water temperature |
| **Flow Rate** (`flow_lpm`) | L/min | 0.50 – 3.00 | Hall-Effect Turbine (ZJ-S401) | Flow velocity across filter stage |

### Turbidity Physical ADC Diagnostics
- **ADC Pin**: GPIO 6 on ESP32-S3 (12-bit resolution, 0 – 4095 counts).
- **Voltage**: 0 – 3.3 V (Nominal clean water: ~2.8 V – 3.1 V; High turbidity: ~1.8 V).

---

## 2. Neural Network Architecture

The TinyML water quality classifier runs directly on the ESP32-S3 Xtensa LX7 dual-core processor using native C++ float matrix multiplications.

```
[4 Inputs]
   ↓ (StandardScaler normalization: MEAN & SCALE)
[Dense Layer 1: 16 Neurons + ReLU]
   ↓
[Dense Layer 2: 8 Neurons + ReLU]
   ↓
[Dense Layer 3: 3 Neurons + Softmax]
   ↓
[Probabilities: Good, Moderate, Poor]
```

- **Feature Order**: `[tds_ppm, turbidity_ntu, temperature_c, flow_lpm]`
- **Inference Latency**: ~1.2 ms on ESP32-S3 @ 240 MHz
- **Memory Footprint**: < 4 KB flash, minimal heap
- **Model Classes**:
  1. **Good**: High clarity (< 2.0 NTU), nominal mineral balance (150 – 300 ppm), optimal drinking water.
  2. **Moderate**: Acceptable filtration quality with minor baseline variance.
  3. **Poor**: Elevated TDS or particulate turbidity exceeding safe consumption thresholds.

---

## 3. Normalization & Weights Reference

- **Feature Mean**: `[522.013123, 5.26732492, 27.3666248, 1.67484999]`
- **Feature Scale**: `[322.791992, 4.19251204, 3.21086597, 0.57701081]`
- **Weights Header**: Exported as `filtravyn_model.h` from trained Keras model `filtravyn_model.keras`.

---

## 4. Dashboard Implementation

The web dashboard (`frontend/src/services/tinyML.ts`) mirrors the native ESP32-S3 C++ inference engine using identical weights and normalization arithmetic. Every telemetry packet updates the live classification, class confidence distribution bars, and threshold monitors without server-side lag.
