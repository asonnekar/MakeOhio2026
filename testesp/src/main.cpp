#include <Arduino.h>
#include <DHT.h>
#include <math.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

#define DHTPIN 14
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

const int THERM_PIN = 34;

const float SERIES_RESISTOR = 10000.0f;
const float NOMINAL_RESISTANCE = 10000.0f;
const float NOMINAL_TEMPERATURE = 25.0f;
const float BETA_COEFFICIENT = 3950.0f;
const float ADC_MAX = 4095.0f;
const float VCC = 3.3f;

const int LED_SAFE = 25;
const int LED_STRESS = 26;
const int LED_OVERLOAD = 27;

enum Status { STATUS_SAFE, STATUS_STRESSED, STATUS_OVERLOAD };

struct SensorReadings {
  int conductorRaw;
  float conductorTempC;
  float ambientTempC;
  float humidityPercent;
};

struct StatusDecision {
  Status status;
  float riskScore;
  float effectiveConductorTempC;
};

float clamp01(float value) {
  if (value < 0.0f)
    return 0.0f;
  if (value > 1.0f)
    return 1.0f;
  return value;
}

int readAverageAdc(uint8_t samples = 8) {
  long total = 0;
  for (uint8_t i = 0; i < samples; i++) {
    total += analogRead(THERM_PIN);
    delay(5);
  }
  return total / samples;
}

float readThermistorC(int adc) {
  if (adc <= 0 || adc >= ADC_MAX)
    return NAN;
  const float voltage = (adc / ADC_MAX) * VCC;
  if (voltage <= 0.0f || voltage >= VCC)
    return NAN;
  const float rTherm = SERIES_RESISTOR * (VCC / voltage - 1.0f);
  if (rTherm <= 0.0f)
    return NAN;
  const float t0 = NOMINAL_TEMPERATURE + 273.15f;
  const float invT = (1.0f / t0) + (1.0f / BETA_COEFFICIENT) *
                                       log(rTherm / NOMINAL_RESISTANCE);
  return (1.0f / invT) - 273.15f;
}

SensorReadings readSensors() {
  SensorReadings readings;
  readings.conductorRaw = readAverageAdc();
  readings.conductorTempC = readThermistorC(readings.conductorRaw);
  readings.ambientTempC = dht.readTemperature();
  readings.humidityPercent = dht.readHumidity();
  return readings;
}

float computeHumidityCoolingFactor(float humidityPercent) {
  if (isnan(humidityPercent))
    return 1.0f;
  const float normalizedHumidity = (humidityPercent - 50.0f) / 50.0f;
  return 1.0f + normalizedHumidity * 0.06f;
}

StatusDecision evaluateStatus(const SensorReadings &readings) {
  StatusDecision decision = {STATUS_OVERLOAD, 100.0f, NAN};

  if (isnan(readings.conductorTempC) || isnan(readings.ambientTempC) ||
      isnan(readings.humidityPercent))
    return decision;

  const float humidityCoolingFactor =
      computeHumidityCoolingFactor(readings.humidityPercent);
  const float conductorRiseC =
      max(0.0f, readings.conductorTempC - readings.ambientTempC);
  const float effectiveConductorTempC =
      readings.ambientTempC + conductorRiseC / humidityCoolingFactor;
  // ── Risk scoring recalibrated for demo hardware ─────────────────────────
  // Observed range: Tc 15–37 °C, Ta ~27 °C, rise up to ~10 °C.
  // conductorScore: starts at 28 °C effective, maxes at 40 °C
  // ambientScore:   starts at 24 °C, maxes at 32 °C
  // thermalRise:    starts at 3 °C rise above ambient, maxes at 13 °C
  const float conductorScore =
      clamp01((effectiveConductorTempC - 28.0f) / 12.0f);
  const float ambientScore = clamp01((readings.ambientTempC - 24.0f) / 8.0f);
  const float thermalRiseScore = clamp01((conductorRiseC - 3.0f) / 10.0f);

  float riskScore = 100.0f * (conductorScore * 0.60f + ambientScore * 0.15f +
                              thermalRiseScore * 0.25f);

  if (readings.humidityPercent < 35.0f)
    riskScore += 3.0f;
  else if (readings.humidityPercent > 75.0f)
    riskScore -= 2.0f;
  if (riskScore < 0.0f)
    riskScore = 0.0f;

  // ── Hysteresis thresholds ─────────────────────────────────────────────────
  // Each state has separate ENTER (higher) and EXIT (lower) thresholds so the
  // status does not flip-flop at the boundary.
  //
  // Entering STRESSED:  Tc ≥ 32 °C  OR  rise ≥  6 °C  OR  risk ≥ 32
  // Exiting  STRESSED:  Tc <  29 °C AND  rise <  3.5°C AND  risk <  24
  //
  // Entering OVERLOAD:  Tc ≥ 37 °C  OR  rise ≥ 10.5°C OR  risk ≥ 66
  // Exiting  OVERLOAD:  Tc <  33 °C AND  rise <  7.5°C AND  risk <  55

  static Status prevStatus = STATUS_SAFE; // remembered across loop() calls

  const bool enterStressed =
      (readings.conductorTempC >= 32.0f || effectiveConductorTempC >= 30.5f ||
       conductorRiseC >= 6.0f || riskScore >= 32.0f);

  const bool exitStressed =
      (readings.conductorTempC < 29.0f && effectiveConductorTempC < 28.5f &&
       conductorRiseC < 3.5f && riskScore < 24.0f);

  const bool enterOverload =
      (readings.conductorTempC >= 37.0f || effectiveConductorTempC >= 35.0f ||
       conductorRiseC >= 10.5f || riskScore >= 66.0f);

  const bool exitOverload =
      (readings.conductorTempC < 33.0f && effectiveConductorTempC < 32.0f &&
       conductorRiseC < 7.5f && riskScore < 55.0f);

  switch (prevStatus) {
  case STATUS_SAFE:
    if (enterOverload)
      prevStatus = STATUS_OVERLOAD;
    else if (enterStressed)
      prevStatus = STATUS_STRESSED;
    break;
  case STATUS_STRESSED:
    if (enterOverload)
      prevStatus = STATUS_OVERLOAD;
    else if (exitStressed)
      prevStatus = STATUS_SAFE;
    break;
  case STATUS_OVERLOAD:
    if (exitOverload)
      prevStatus = STATUS_STRESSED;
    // (require another exitStressed before going all the way back to SAFE)
    break;
  }

  decision.status = prevStatus;

  decision.riskScore = riskScore;
  decision.effectiveConductorTempC = effectiveConductorTempC;
  return decision;
}

const char *statusToText(Status status) {
  switch (status) {
  case STATUS_SAFE:
    return "SAFE";
  case STATUS_STRESSED:
    return "STRESSED";
  default:
    return "OVERLOAD";
  }
}

void setStatusLED(Status status) {
  digitalWrite(LED_SAFE, status == STATUS_SAFE ? HIGH : LOW);
  digitalWrite(LED_STRESS, status == STATUS_STRESSED ? HIGH : LOW);
  digitalWrite(LED_OVERLOAD, status == STATUS_OVERLOAD ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(THERM_PIN, INPUT);
  analogSetAttenuation(ADC_11db);

  pinMode(LED_SAFE, OUTPUT);
  pinMode(LED_STRESS, OUTPUT);
  pinMode(LED_OVERLOAD, OUTPUT);
  setStatusLED(STATUS_SAFE);

  dht.begin();

  Serial.println("Conductor monitor starting...");
  Serial.println("Status uses conductor temp, ambient temp, and humidity.");
}

void loop() {
  const SensorReadings readings = readSensors();
  const StatusDecision decision = evaluateStatus(readings);

  if (isnan(readings.ambientTempC) || isnan(readings.humidityPercent)) {
    Serial.println("DHT read failed");
    delay(2000);
    return;
  }

  if (isnan(readings.conductorTempC)) {
    Serial.println("Thermistor read failed");
    setStatusLED(STATUS_OVERLOAD);
    delay(2000);
    return;
  }

  setStatusLED(decision.status);

  Serial.print("RawADC: ");
  Serial.print(readings.conductorRaw);
  Serial.print("  Tc: ");
  Serial.print(readings.conductorTempC, 2);
  Serial.print("  Ta: ");
  Serial.print(readings.ambientTempC, 2);
  Serial.print("  H: ");
  Serial.print(readings.humidityPercent, 1);
  Serial.print("%  EffectiveC: ");
  Serial.print(decision.effectiveConductorTempC, 2);
  Serial.print("  Risk: ");
  Serial.print(decision.riskScore, 1);
  Serial.print("  STATUS: ");
  Serial.println(statusToText(decision.status));

  delay(2000);
}
