#include <Arduino.h>
#include <math.h>
#include <DHT.h>

#ifndef LED_BUILTIN
  #define LED_BUILTIN 2
#endif

#define DHTPIN 14
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

const int THERM_PIN = 34;

const float SERIES_RESISTOR = 10000.0f;      // 10k resistor to GND
const float NOMINAL_RESISTANCE = 10000.0f;   // 10k thermistor at 25 C
const float NOMINAL_TEMPERATURE = 25.0f;     // 25 C
const float BETA_COEFFICIENT = 3950.0f;      // Beta value
const float ADC_MAX = 4095.0f;
const float VCC = 3.3f;

const int LED_SAFE = 25;
const int LED_STRESS = 26;
const int LED_OVERLOAD = 27;

enum Status {
  STATUS_SAFE,
  STATUS_STRESSED,
  STATUS_OVERLOAD
};

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
  if (value < 0.0f) {
    return 0.0f;
  }

  if (value > 1.0f) {
    return 1.0f;
  }

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
  if (adc <= 0 || adc >= ADC_MAX) {
    return NAN;
  }

  const float voltage = (adc / ADC_MAX) * VCC;
  if (voltage <= 0.0f || voltage >= VCC) {
    return NAN;
  }

  const float rTherm = SERIES_RESISTOR * (VCC / voltage - 1.0f);
  if (rTherm <= 0.0f) {
    return NAN;
  }

  const float t0 = NOMINAL_TEMPERATURE + 273.15f;
  const float invT = (1.0f / t0) + (1.0f / BETA_COEFFICIENT) * log(rTherm / NOMINAL_RESISTANCE);
  const float tempK = 1.0f / invT;
  return tempK - 273.15f;
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
  if (isnan(humidityPercent)) {
    return 1.0f;
  }

  // Project notes indicate humidity matters less than ambient temperature
  // and only changes cooling slightly.
  const float normalizedHumidity = (humidityPercent - 50.0f) / 50.0f;
  return 1.0f + normalizedHumidity * 0.06f;
}

StatusDecision evaluateStatus(const SensorReadings &readings) {
  StatusDecision decision = {STATUS_OVERLOAD, 100.0f, NAN};

  if (isnan(readings.conductorTempC) || isnan(readings.ambientTempC) || isnan(readings.humidityPercent)) {
    return decision;
  }

  const float humidityCoolingFactor = computeHumidityCoolingFactor(readings.humidityPercent);
  const float conductorRiseC = max(0.0f, readings.conductorTempC - readings.ambientTempC);

  // Hot ambient air reduces cooling more than humidity can improve it.
  const float effectiveConductorTempC = readings.ambientTempC + conductorRiseC / humidityCoolingFactor;
  const float conductorScore = clamp01((effectiveConductorTempC - 45.0f) / 20.0f);
  const float ambientScore = clamp01((readings.ambientTempC - 25.0f) / 15.0f);
  const float thermalRiseScore = clamp01((conductorRiseC - 18.0f) / 22.0f);

  float riskScore = 100.0f * (
    conductorScore * 0.65f +
    ambientScore * 0.25f +
    thermalRiseScore * 0.10f
  );

  if (readings.humidityPercent < 35.0f) {
    riskScore += 3.0f;
  } else if (readings.humidityPercent > 75.0f) {
    riskScore -= 2.0f;
  }

  if (riskScore < 0.0f) {
    riskScore = 0.0f;
  }

  if (
    readings.conductorTempC >= 70.0f ||
    effectiveConductorTempC >= 65.0f ||
    riskScore >= 80.0f
  ) {
    decision.status = STATUS_OVERLOAD;
  } else if (
    readings.conductorTempC >= 55.0f ||
    effectiveConductorTempC >= 52.0f ||
    riskScore >= 45.0f
  ) {
    decision.status = STATUS_STRESSED;
  } else {
    decision.status = STATUS_SAFE;
  }

  decision.riskScore = riskScore;
  decision.effectiveConductorTempC = effectiveConductorTempC;
  return decision;
}

const char* statusToText(Status status) {
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
  Serial.println("Status now uses conductor temp, ambient temp, and humidity.");
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
