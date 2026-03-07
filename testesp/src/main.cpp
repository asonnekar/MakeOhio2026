#include <Arduino.h>
#include <math.h>

#ifndef LED_BUILTIN
  #define LED_BUILTIN 2  
#endif

const int THERM_PIN = 34;

const float SERIES_RESISTOR = 10000.0;   // 10k resistor to GND
const float NOMINAL_RESISTANCE = 10000.0; // 10k thermistor at 25°C
const float NOMINAL_TEMPERATURE = 25.0;   // 25°C
const float BETA_COEFFICIENT = 3950.0;    // Beta value
const float ADC_MAX = 4095.0;
const float VCC = 3.3;
const int LED_SAFE    = 25;  // green
const int LED_STRESS  = 26;  // yellow/blue
const int LED_OVERLOAD= 27;  // red



float readThermistorC() {
  int adc = analogRead(THERM_PIN);

  // Convert ADC reading to voltage
  float voltage = (adc / ADC_MAX) * VCC;

  // Convert voltage to thermistor resistance (thermistor on top, resistor to GND)
  float rTherm = SERIES_RESISTOR * (VCC / voltage - 1.0);

  // Beta formula to convert resistance to temperature (Kelvin)
  float t0 = NOMINAL_TEMPERATURE + 273.15;   // in Kelvin
  float invT = (1.0 / t0) + (1.0 / BETA_COEFFICIENT) * log(rTherm / NOMINAL_RESISTANCE);
  float tempK = 1.0 / invT;
  float tempC = tempK - 273.15;

  return tempC;
}
void setup() {
  Serial.begin(115200);       
  delay(1000);                

  pinMode(THERM_PIN, INPUT);

  Serial.println("Thermistor test starting...");
  Serial.println("Watch the number change when you touch the sensor.");
  pinMode(LED_SAFE, OUTPUT);
  pinMode(LED_STRESS, OUTPUT);
  pinMode(LED_OVERLOAD, OUTPUT);

}
void setStatusLED(const String &status) {
  if (status == "SAFE") {
    digitalWrite(LED_SAFE, HIGH);
    digitalWrite(LED_STRESS, LOW);
    digitalWrite(LED_OVERLOAD, LOW);
  } else if (status == "STRESSED") {
    digitalWrite(LED_SAFE, LOW);
    digitalWrite(LED_STRESS, HIGH);
    digitalWrite(LED_OVERLOAD, LOW);
  } else { // OVERLOAD
    digitalWrite(LED_SAFE, LOW);
    digitalWrite(LED_STRESS, LOW);
    digitalWrite(LED_OVERLOAD, HIGH);
  }
}

void loop() {
  int raw = analogRead(THERM_PIN);
  String status;
  if (raw < 2000) {
    status = "SAFE";
  } else if (raw < 3000) {
    status = "STRESSED";
  } else {
    status = "OVERLOAD";
  }
  setStatusLED(status);
  Serial.print("Value: ");
  Serial.print(raw);
  Serial.print("  STATUS: ");
  Serial.println(status);
  delay(500);

}

