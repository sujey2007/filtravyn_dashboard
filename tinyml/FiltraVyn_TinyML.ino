
#include <Arduino.h>
#include "filtravyn_model.h"
#include <math.h>
#include <esp_system.h>

// ==========================================
// FILTRAVYN - SENSOR + NATIVE TINYML
// ESP32-S3
// Architecture: 4 -> 16 -> 8 -> 3
// ==========================================

// Physical sensor pin
#define TURBIDITY_PIN 6

// ==========================================
// SENSOR VARIABLES
// ==========================================

// Simulated sensor values
float tdsPpm = 0.0f;
float turbidityNTU = 0.0f;
float temperatureC = 0.0f;
float flowRate = 0.0f;

// Physical turbidity diagnostic
int turbidityRaw = 0;
float turbidityVoltage = 0.0f;

// ==========================================
// RELU ACTIVATION
// ==========================================

float relu(float x) {
  return (x > 0.0f) ? x : 0.0f;
}

// ==========================================
// STABLE SOFTMAX
// ==========================================

bool softmax(float input[3], float output[3]) {

  float maxValue = input[0];

  for (int i = 1; i < 3; i++) {
    if (input[i] > maxValue) {
      maxValue = input[i];
    }
  }

  float sum = 0.0f;

  for (int i = 0; i < 3; i++) {
    output[i] = expf(input[i] - maxValue);
    sum += output[i];
  }

  if (sum <= 0.0f || !isfinite(sum)) {
    Serial.println("ERROR: Invalid softmax sum");
    return false;
  }

  for (int i = 0; i < 3; i++) {
    output[i] /= sum;
  }

  return true;
}

// ==========================================
// NATIVE TINYML INFERENCE
// Architecture: 4 -> 16 -> 8 -> 3
// ==========================================

bool predictWaterQuality(
  const float input[4],
  float probabilities[3]
) {

  // Validate inputs
  for (int i = 0; i < 4; i++) {
    if (!isfinite(input[i])) {
      Serial.println("ERROR: Invalid input");
      return false;
    }
  }

  // FEATURE NORMALIZATION

  float normalized[4];

  for (int i = 0; i < 4; i++) {

    normalized[i] =
      (input[i] - FEATURE_MEAN[i]) /
      FEATURE_SCALE[i];

    if (!isfinite(normalized[i])) {
      Serial.println("ERROR: Normalization failed");
      return false;
    }
  }

  // DENSE LAYER 1: 4 -> 16

  float layer1[16];

  for (int j = 0; j < 16; j++) {

    float sum = b1[j];

    for (int i = 0; i < 4; i++) {
      sum += normalized[i] * W1[i * 16 + j];
    }

    layer1[j] = relu(sum);
  }

  // DENSE LAYER 2: 16 -> 8

  float layer2[8];

  for (int j = 0; j < 8; j++) {

    float sum = b2[j];

    for (int i = 0; i < 16; i++) {
      sum += layer1[i] * W2[i * 8 + j];
    }

    layer2[j] = relu(sum);
  }

  // OUTPUT LAYER: 8 -> 3

  float output[3];

  for (int j = 0; j < 3; j++) {

    float sum = b3[j];

    for (int i = 0; i < 8; i++) {
      sum += layer2[i] * W3[i * 3 + j];
    }

    output[j] = sum;
  }

  // SOFTMAX

  if (!softmax(output, probabilities)) {
    return false;
  }

  // VALIDATE PROBABILITIES

  float probabilitySum = 0.0f;

  for (int i = 0; i < 3; i++) {

    if (!isfinite(probabilities[i])) {
      return false;
    }

    probabilitySum += probabilities[i];
  }

  if (fabsf(probabilitySum - 1.0f) > 0.001f) {
    return false;
  }

  return true;
}

// ==========================================
// SIMULATED SENSOR GENERATION
// ==========================================

void generateSensorReadings() {

  // TDS: 100 to 1000 ppm
  tdsPpm = random(100, 1001);

  // Turbidity: 0.0 to 15.0 simulated NTU
  turbidityNTU = random(0, 151) / 10.0f;

  // Temperature: 20.0 to 35.0 Celsius
  temperatureC = random(200, 351) / 10.0f;

  // Flow: 0.50 to 3.00 L/min
  flowRate = random(50, 301) / 100.0f;

  // Read physical turbidity sensor for diagnostics
  turbidityRaw = analogRead(TURBIDITY_PIN);

  turbidityVoltage =
    analogReadMilliVolts(TURBIDITY_PIN) / 1000.0f;
}

// ==========================================
// DISPLAY SENSOR READINGS
// ==========================================

void displaySensorReadings() {

  Serial.println();
  Serial.println("========== SENSOR READINGS ==========");

  Serial.print("TDS (SIMULATED): ");
  Serial.print(tdsPpm, 1);
  Serial.println(" ppm");

  Serial.print("Turbidity (SIMULATED): ");
  Serial.print(turbidityNTU, 1);
  Serial.println(" NTU");

  Serial.print("Turbidity Physical ADC: ");
  Serial.println(turbidityRaw);

  Serial.print("Turbidity Physical Voltage: ");
  Serial.print(turbidityVoltage, 3);
  Serial.println(" V");

  Serial.print("Temperature (SIMULATED): ");
  Serial.print(temperatureC, 1);
  Serial.println(" C");

  Serial.print("Flow (SIMULATED): ");
  Serial.print(flowRate, 2);
  Serial.println(" L/min");

  Serial.println("=====================================");
}

// ==========================================
// DISPLAY TINYML PREDICTION
// ==========================================

void displayPrediction(float probabilities[3]) {

  Serial.println();
  Serial.println("========== TINYML PREDICTION ==========");

  int predictedClass = 0;

  Serial.println("CLASS PROBABILITIES:");

  for (int i = 0; i < 3; i++) {

    Serial.print(CLASS_NAMES[i]);
    Serial.print(": ");

    Serial.print(probabilities[i] * 100.0f, 2);
    Serial.println(" %");

    if (probabilities[i] > probabilities[predictedClass]) {
      predictedClass = i;
    }
  }

  Serial.println();

  Serial.print("PREDICTED WATER QUALITY: ");
  Serial.println(CLASS_NAMES[predictedClass]);

  Serial.println("=======================================");
}

// ==========================================
// SETUP
// ==========================================

void setup() {

  Serial.begin(115200);
  delay(2000);

  randomSeed(esp_random());

  analogReadResolution(12);
  pinMode(TURBIDITY_PIN, INPUT);

  Serial.println();
  Serial.println("======================================");
  Serial.println("          FILTRAVYN SYSTEM");
  Serial.println("       ESP32-S3 NATIVE TINYML");
  Serial.println("======================================");

  Serial.println("Neural Network: 4 -> 16 -> 8 -> 3");
  Serial.println("Inference: Native C++");
  Serial.println("TDS: Simulated");
  Serial.println("Turbidity model input: Simulated");
  Serial.println("Temperature: Simulated");
  Serial.println("Flow: Simulated");

  Serial.println();
  Serial.println("FILTRAVYN SYSTEM INITIALIZED");
}

// ==========================================
// MAIN LOOP
// ==========================================

void loop() {

  // STEP 1: Generate sensor readings

  generateSensorReadings();

  // STEP 2: Display readings

  displaySensorReadings();

  // STEP 3: Prepare model inputs
  // Feature order must match Python training

  const float modelInput[4] = {
    tdsPpm,
    turbidityNTU,
    temperatureC,
    flowRate
  };

  // STEP 4: Run TinyML inference

  float probabilities[3] = {
    0.0f, 0.0f, 0.0f
  };

  Serial.println();
  Serial.println("RUNNING TINYML INFERENCE...");

  bool success = predictWaterQuality(
    modelInput,
    probabilities
  );

  // STEP 5: Display prediction

  if (success) {

    displayPrediction(probabilities);

  } else {

    Serial.println("TINYML INFERENCE FAILED");

  }

  Serial.println();
  Serial.println("NEXT SAMPLE IN 1 SECOND");
  Serial.println("---------------------------------------");

  delay(1000);
}
