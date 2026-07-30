/*
  ===============================================================================
  سايفر بت - Lola Bit (Instant LDR Light Sensor + Loud Clear Buzzer Beeps)
  ===============================================================================
  - حساس الضوء (LDR): يعمل 24/7 واستجابة سريعة للظلام (1.5 ثانية ظلام فقط) للدخول في وضع النوم الفوري.
  - حساس الصوت والباظر (Buzzer): نغمات واضحة وقوية (Loud Crisp Beeps) مع التحكم المباشر بالترددات بدون كتم الصوت.
  - استجابة لمس عالية الأولوية تتيح الاستيقاظ الفوري من وضع النوم.
  - الشاشة باللغة الإنجليزية الصافية 100% (English ASCII Only).
  - التوصيلات الفيزيائية المعتمدة 100%:
    TFT_CS=15, TFT_RST=4, TFT_DC=2, TFT_MOSI=23, TFT_SCLK=18
    TOUCH=33, SHAKE=14, SOUND=34, LDR=35, BUZZER=25, VIBRATION=26
*/

#include <Wire.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "bitmaps_esp32_color.h"

// ---- Pins ----
#define TFT_CS        15
#define TFT_RST        4
#define TFT_DC         2
#define TFT_MOSI      23
#define TFT_SCLK      18

#define TOUCH_PIN     33
#define SHAKE_PIN     14
#define SOUND_PIN     34
#define LDR_PIN       35
#define BUZZER_PIN    25
#define VIBRATION_PIN 26

// Bitmaps Width and Height Definitions
#ifndef EP_NEUTRAL_WIDTH
#define EP_NEUTRAL_WIDTH 100
#define EP_NEUTRAL_HEIGHT 100
#define EP_DALAA_WIDTH 100
#define EP_DALAA_HEIGHT 100
#define EP_ZAEQ_WIDTH 100
#define EP_ZAEQ_HEIGHT 100
#define EP_ZAALAN_WIDTH 100
#define EP_ZAALAN_HEIGHT 100
#endif

const char* API_URL = "https://lola-cypher-pet.vercel.app/api/mood";

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
Adafruit_MPU6050 mpu;
WiFiManager wm;

#define STATE_IDLE     0
#define STATE_TOUCH    1
#define STATE_SHAKE    2
#define STATE_SOUND    3
#define STATE_DARK     4
#define STATE_ANNOYED  5

int currentState = STATE_IDLE;
int lastState = -99;
String lastPrintedText = "";
String lastProcessedMsgId = "";

bool wifiConnected = false;
String apiMood = "NEUTRAL";
String apiDisplayText = "Lola: Ready!";

// Inter-core communication
volatile int  pendingApiState = -1;
volatile bool pendingDisplayUpdate = false;
char          pendingMsgIdBuf[64] = "";
char          pendingDisplayText[64] = "Lola: Ready!";

// Sensor Control Logic
unsigned long lastSoundTriggerTime = 0;
unsigned long darkStartTime = 0;

// Forward declaration
void fetchMoodFromAPI();

// NTP Config
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 3 * 3600;
const int   daylightOffset_sec = 0;

int getCurrentHour24() {
  struct tm timeinfo;
  if ((wifiConnected || WiFi.status() == WL_CONNECTED) && getLocalTime(&timeinfo)) {
    return timeinfo.tm_hour; // 0 .. 23
  }
  unsigned long currentMin = (1 * 60) + 21 + (millis() / 60000);
  return (currentMin / 60) % 24;
}

// Clean non-ASCII bytes to guarantee 100% ENGLISH ONLY on TFT display
String sanitizeAsciiText(String input) {
  String clean = "";
  for (unsigned int i = 0; i < input.length(); i++) {
    char c = input.charAt(i);
    if (c >= 32 && c <= 126) {
      clean += c;
    }
  }
  clean.trim();
  if (clean.length() == 0) return "Lola: Ready!";
  return clean;
}

// FreeRTOS task for background API polling (Core 0)
void apiPollTask(void* param) {
  vTaskDelay(2000 / portTICK_PERIOD_MS);
  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      fetchMoodFromAPI();
    }
    vTaskDelay(3000 / portTICK_PERIOD_MS);
  }
}

// Sound Functions - Loud & Crisp Tones
void silenceBuzzer() {
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

void playBeepCute() {
  tone(BUZZER_PIN, 2200, 100);
  delay(110);
  tone(BUZZER_PIN, 2800, 140);
  delay(150);
  silenceBuzzer();
}

void playBeepSharp() {
  tone(BUZZER_PIN, 3200, 180);
  delay(190);
  tone(BUZZER_PIN, 3600, 220);
  delay(230);
  silenceBuzzer();
}

void playBeepSoft() {
  tone(BUZZER_PIN, 1400, 220);
  delay(230);
  silenceBuzzer();
}

void playBeepExcited() {
  tone(BUZZER_PIN, 1800, 80); delay(90);
  tone(BUZZER_PIN, 2500, 80); delay(90);
  tone(BUZZER_PIN, 3400, 120); delay(130);
  silenceBuzzer();
}

void playBeepSleepy() {
  tone(BUZZER_PIN, 1000, 180); delay(190);
  tone(BUZZER_PIN, 700, 250); delay(260);
  silenceBuzzer();
}

String getFormattedTimeShort() {
  struct tm timeinfo;
  if ((wifiConnected || WiFi.status() == WL_CONNECTED) && getLocalTime(&timeinfo)) {
    int hrs = timeinfo.tm_hour % 12;
    if (hrs == 0) hrs = 12;
    const char* ampm = (timeinfo.tm_hour >= 12) ? "PM" : "AM";
    char buf[12];
    sprintf(buf, "%02d:%02d %s", hrs, timeinfo.tm_min, ampm);
    return String(buf);
  }
  
  unsigned long currentMin = (1 * 60) + 21 + (millis() / 60000);
  int hrs = (currentMin / 60) % 12;
  if (hrs == 0) hrs = 12;
  const char* ampm = (((currentMin / 60) % 24) >= 12) ? "PM" : "AM";
  char buf[12];
  sprintf(buf, "%02d:%02d %s", hrs, (int)(currentMin % 60), ampm);
  return String(buf);
}

void drawClockTopLeft() {
  tft.fillRect(2, 2, 65, 10, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 4);
  tft.print(getFormattedTimeShort());
}

void printCentered(String text, int y, uint16_t color, int textSize = 1) {
  String cleanText = sanitizeAsciiText(text);
  tft.setTextSize(textSize);
  tft.setTextColor(color);
  int charWidth = 6 * textSize;
  int width = cleanText.length() * charWidth;
  int x = (160 - width) / 2;
  if (x < 0) x = 0;
  tft.setCursor(x, y);
  tft.print(cleanText);
}

void drawHeart(int x, int y, uint16_t color) {
  tft.fillCircle(x - 3, y - 2, 3, color);
  tft.fillCircle(x + 3, y - 2, 3, color);
  tft.fillTriangle(x - 6, y, x + 6, y, x, y + 6, color);
}

void setupWiFiManager() {
  tft.fillScreen(ST77XX_BLACK);
  printCentered("WiFi Setup...", 15, ST77XX_CYAN, 1);
  printCentered("Connect to AP:", 35, ST77XX_YELLOW, 1);
  printCentered("LolaPet-Setup", 55, ST77XX_GREEN, 1);
  printCentered("on Phone/PC", 75, ST77XX_WHITE, 1);
  
  WiFi.mode(WIFI_STA);
  WiFi.persistent(true);

  wm.setConfigPortalTimeout(60);
  wm.setConnectTimeout(10);
  wm.setSaveConnect(true);
  wm.setBreakAfterConfig(true);
  
  bool connected = wm.autoConnect("LolaPet-Setup");
  if (connected || WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("WiFi Connected! IP: " + WiFi.localIP().toString());
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    tft.fillScreen(ST77XX_BLACK);
    printCentered("WiFi Connected!", 35, ST77XX_GREEN, 1);
    printCentered("IP: " + WiFi.localIP().toString(), 60, ST77XX_CYAN, 1);
    delay(1500);
  } else {
    wifiConnected = false;
    Serial.println("WiFi Portal Timeout - Continuing to Pet");
    tft.fillScreen(ST77XX_BLACK);
    printCentered("Offline Mode", 45, ST77XX_YELLOW, 1);
    delay(1000);
  }
}

void runWelcomeSequence() {
  tft.fillScreen(ST77XX_BLACK);
  printCentered("I'm ur Lola Bit", 40, ST77XX_YELLOW, 1);
  printCentered("beside u forever", 65, ST77XX_MAGENTA, 1);
  drawHeart(80, 92, ST77XX_RED);
  playBeepCute();
  delay(1000);
}

void runDizzyShakeAnimation() {
  unsigned long start = millis();
  int frame = 0;
  playBeepSharp();
  while (millis() - start < 1800) {
    tft.fillScreen(ST77XX_BLACK);
    drawClockTopLeft();
    printCentered("! DIZZY / SHAKEN !", 16, ST77XX_RED, 1);
    int offsetX = (frame % 2 == 0) ? 14 : -14;
    int cx = (160 / 2) + offsetX;
    int cy = (128 / 2) + 4;
    
    tft.drawLine(cx - 25, cy - 14, cx - 11, cy, ST77XX_YELLOW);
    tft.drawLine(cx - 11, cy - 14, cx - 25, cy, ST77XX_YELLOW);
    tft.drawLine(cx + 11, cy - 14, cx + 25, cy, ST77XX_YELLOW);
    tft.drawLine(cx + 25, cy - 14, cx + 11, cy, ST77XX_YELLOW);
    
    for (int x = -18; x <= 18; x++) {
      int wy = cy + 18 + (int)(4 * sin((x + frame * 4) * 0.3));
      tft.drawPixel(cx + x, wy, ST77XX_RED);
      tft.drawPixel(cx + x, wy + 1, ST77XX_RED);
    }
    printCentered("STOP SHAKING ME!", 116, ST77XX_RED, 1);
    frame++;
    delay(40);
  }
  silenceBuzzer();
}

int getSoundAmplitudeFast() {
  unsigned int signalMax = 0;
  unsigned int signalMin = 4095;
  for (int i = 0; i < 100; i++) {
    int sample = analogRead(SOUND_PIN);
    if (sample < 4095) {
      if (sample > signalMax) signalMax = sample;
      if (sample < signalMin) signalMin = sample;
    }
  }
  return (signalMax - signalMin);
}

void updateDisplayForState(int state, bool forceFullRedraw = false) {
  int bmpX = 30;
  int bmpY = 14;

  if (forceFullRedraw || state != lastState) {
    tft.fillScreen(ST77XX_BLACK);
    drawClockTopLeft();

    if (state == STATE_IDLE) {
      tft.drawRGBBitmap(bmpX, bmpY, (const uint16_t*)ep_neutral, EP_NEUTRAL_WIDTH, EP_NEUTRAL_HEIGHT);
    } else if (state == STATE_TOUCH) {
      printCentered("<3 DALAA / PETTED <3", 4, ST77XX_MAGENTA, 1);
      tft.drawRGBBitmap(bmpX, bmpY, (const uint16_t*)ep_dalaa, EP_DALAA_WIDTH, EP_DALAA_HEIGHT);
    } else if (state == STATE_SOUND || state == STATE_ANNOYED) {
      printCentered("! ANNOYED / ANGRY !", 4, ST77XX_RED, 1);
      tft.drawRGBBitmap(bmpX, bmpY, (const uint16_t*)ep_zaeq, EP_ZAEQ_WIDTH, EP_ZAEQ_HEIGHT);
    } else if (state == STATE_DARK) {
      printCentered("Zzz... IT'S DARK... Zzz", 4, ST77XX_CYAN, 1);
      tft.drawRGBBitmap(bmpX, bmpY, (const uint16_t*)ep_zaalan, EP_ZAALAN_WIDTH, EP_ZAALAN_HEIGHT);
    }
    lastState = state;
  }

  if (apiDisplayText != lastPrintedText || forceFullRedraw) {
    tft.fillRect(0, 114, 160, 14, ST77XX_BLACK);
    uint16_t textColor = ST77XX_YELLOW;
    if (state == STATE_TOUCH) textColor = ST77XX_CYAN;
    else if (state == STATE_SOUND || state == STATE_ANNOYED) textColor = ST77XX_WHITE;
    
    printCentered(apiDisplayText != "" ? apiDisplayText : "Lola: Ready!", 116, textColor, 1);
    lastPrintedText = apiDisplayText;
  }
}

void fetchMoodFromAPI() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure secureClient;
  secureClient.setInsecure();

  HTTPClient http;
  http.begin(secureClient, API_URL);
  http.setConnectTimeout(2500);
  http.setTimeout(3000);

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && doc.containsKey("msg_id")) {
      String msgId = doc["msg_id"].as<String>();

      if (msgId.length() > 0 && msgId != String(pendingMsgIdBuf)) {
        String newMood = doc.containsKey("mood") ? doc["mood"].as<String>() : "NEUTRAL";
        String rawText = "";
        
        if (doc.containsKey("last_reply_display")) {
          rawText = doc["last_reply_display"].as<String>();
        } else if (doc.containsKey("reply_display")) {
          rawText = doc["reply_display"].as<String>();
        }

        String cleanEnglish = sanitizeAsciiText(rawText);

        strncpy(pendingMsgIdBuf, msgId.c_str(), 63);

        if (cleanEnglish.length() > 0 && cleanEnglish != apiDisplayText) {
          strncpy(pendingDisplayText, cleanEnglish.c_str(), 63);
          apiDisplayText = cleanEnglish;
          pendingDisplayUpdate = true;
        }

        if (newMood.length() > 0) {
          apiMood = newMood;
          if (newMood == "ANNOYED")                      pendingApiState = STATE_ANNOYED;
          else if (newMood == "HAPPY" || newMood == "EXCITED") pendingApiState = STATE_TOUCH;
          else if (newMood == "SAD"   || newMood == "BORED")   pendingApiState = STATE_DARK;
          else                                           pendingApiState = STATE_IDLE;
        }
      }
    }
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(TOUCH_PIN, INPUT);
  pinMode(SHAKE_PIN, INPUT_PULLUP);
  pinMode(SOUND_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(VIBRATION_PIN, OUTPUT);
  
  silenceBuzzer();

  analogSetAttenuation(ADC_11db);

  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, HIGH); delay(10);
  digitalWrite(TFT_RST, LOW);  delay(50);
  digitalWrite(TFT_RST, HIGH); delay(50);

  SPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(1);
  tft.fillScreen(ST77XX_BLACK);

  setupWiFiManager();
  runWelcomeSequence();

  Wire.begin(21, 22);
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found!");
  } else {
    Serial.println("MPU6050 ready.");
  }

  updateDisplayForState(STATE_IDLE, true);

  // Start API polling task on Core 0
  xTaskCreatePinnedToCore(
    apiPollTask,
    "ApiPollTask",
    16384,
    NULL,
    1,
    NULL,
    0
  );
}

void loop() {
  unsigned long now = millis();

  // 1. Read Light Sensor (LDR) - Active 24/7 for instant darkness response
  int lightVal = analogRead(LDR_PIN);
  
  // ESP32 ADC: < 1200 indicates covered sensor / darkness
  if (lightVal < 1200) {
    if (darkStartTime == 0) {
      darkStartTime = now;
    } else if (now - darkStartTime >= 1500) { // 1.5 seconds darkness triggers sleep
      if (currentState != STATE_DARK) {
        currentState = STATE_DARK;
        playBeepSleepy();
        updateDisplayForState(currentState, true);
      }
    }
  } else {
    if (darkStartTime != 0) {
      darkStartTime = 0;
      if (currentState == STATE_DARK) {
        currentState = STATE_IDLE;
        playBeepCute();
        updateDisplayForState(currentState, true);
      }
    }
  }

  // 2. Read Physical Sensors (Touch, Shake, Sound)
  int touched = digitalRead(TOUCH_PIN);
  int shakeRaw = digitalRead(SHAKE_PIN);
  int shakenVal = (shakeRaw == LOW) ? 1 : 0;
  
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float mag = sqrt(a.acceleration.x * a.acceleration.x +
                    a.acceleration.y * a.acceleration.y +
                    a.acceleration.z * a.acceleration.z);
  if (mag > 22.0) shakenVal = 1;

  // Sound Sensor Noise Filtering with high sensitivity & 1.5s cooldown
  int soundAmp = getSoundAmplitudeFast();
  bool soundTriggered = false;
  if (soundAmp > 550 && (now - lastSoundTriggerTime > 1500)) {
    soundTriggered = true;
    lastSoundTriggerTime = now;
  }

  int physicalState = STATE_IDLE;
  if (shakenVal == 1) {
    physicalState = STATE_SHAKE;
  } else if (touched == 1) {
    physicalState = STATE_TOUCH;
  } else if (soundTriggered) {
    physicalState = STATE_SOUND;
  }

  // 3. Touch sensor priority: wakes Lola up immediately if touched in dark mode!
  if (touched == 1 && currentState == STATE_DARK) {
    currentState = STATE_TOUCH;
    digitalWrite(VIBRATION_PIN, HIGH);
    playBeepCute();
    delay(100);
    digitalWrite(VIBRATION_PIN, LOW);
    updateDisplayForState(currentState, true);
  }
  // 4. Physical Sensor Dominance
  else if (physicalState == STATE_SHAKE) {
    runDizzyShakeAnimation();
    currentState = STATE_IDLE;
    updateDisplayForState(currentState, true);
  }
  else if (physicalState != STATE_IDLE && currentState != STATE_DARK) {
    if (currentState != physicalState) {
      currentState = physicalState;
      if (currentState == STATE_TOUCH) {
        digitalWrite(VIBRATION_PIN, HIGH);
        playBeepCute();
        delay(100);
        digitalWrite(VIBRATION_PIN, LOW);
      } else if (currentState == STATE_SOUND) {
        playBeepSharp();
      }
      updateDisplayForState(currentState, true);
    }
  }
  // 5. Web Chat API Updates
  else if (currentState != STATE_DARK) {
    String pendingMsgIdStr = String(pendingMsgIdBuf);
    if (pendingMsgIdStr.length() > 0 && pendingMsgIdStr != lastProcessedMsgId) {
      lastProcessedMsgId = pendingMsgIdStr;

      if (pendingApiState >= 0) {
        int newState = pendingApiState;
        pendingApiState = -1;
        if (newState != currentState) {
          currentState = newState;
          if (currentState == STATE_ANNOYED) playBeepSharp();
          else if (currentState == STATE_TOUCH) playBeepCute();
          updateDisplayForState(currentState, true);
        }
      }

      if (pendingDisplayUpdate) {
        pendingDisplayUpdate = false;
        apiDisplayText = String(pendingDisplayText);
        updateDisplayForState(currentState, false);
      }
    }
  }

  delay(15);
}
