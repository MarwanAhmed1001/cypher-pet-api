/*
  ===============================================================================
  سايفر بت - Cypher Bit (Rock Solid Color Bitmaps + STRICT 100% ENGLISH DISPLAY ONLY)
  ===============================================================================
  - إيقاف الباظر وإبطال أي أصوات تصفير أو طنين عبر ledcDetachPin و pinMode(BUZZER_PIN, INPUT).
  - حماية حديدية 100%: منع عرض أي حرف عربي أو ياباني أو رمز عشوائي على الشاشة نهائياً.
  - الشاشة لا تعرض إطلاقاً سوى حروف إنجليزية وأرقام نقية (Pure ASCII English Only).
  - كود النوم الذكي:
    * النوم لا يتفعل إلا بين الساعة 2:00 صباحاً و 8:00 صباحاً.
    * إذا انطفأ النور في هذه الفترة، يظل الجهاز يعمل لمدة أقصاها 30 دقيقة.
    * بعد الـ 30 دقيقة، يدخل الجهاز في نوم عميق (5 ساعات متواصلة) يتوقف فيها عن العمل وتتوقف كل الحساسات والإشارات.
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
#include "driver/dac.h"
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

// Night Window Sleep Control Logic
// Window: 2:00 AM (02:00) to 8:00 AM (08:00)
// Max stay awake in dark: 30 minutes (1,800,000 ms)
// Deep sleep duration: 5 hours (18,000,000 ms)
unsigned long darkStartTime = 0;
bool          isDeepSleeping = false;
unsigned long deepSleepStartTime = 0;
const unsigned long DARK_GRACE_PERIOD = 30 * 60 * 1000UL;   // 30 mins
const unsigned long DEEP_SLEEP_DURATION = 5 * 3600 * 1000UL; // 5 hours

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
  // Fallback when WiFi not synced:
  unsigned long currentMin = (1 * 60) + 21 + (millis() / 60000);
  return (currentMin / 60) % 24;
}

bool isNightTimeWindow() {
  int hr = getCurrentHour24();
  return (hr >= 2 && hr < 8);
}

// STRICT Whitelist Sanitizer: ONLY allows A-Z, a-z, 0-9, space, and basic English punctuation.
// Wipes out ALL Arabic, Japanese, unicode, or raw control bytes completely!
String sanitizeStrictEnglish(String input, String fallback = "Lola: Ready!") {
  String clean = "";
  for (unsigned int i = 0; i < input.length(); i++) {
    unsigned char c = (unsigned char)input.charAt(i);
    if ((c >= 'A' && c <= 'Z') || 
        (c >= 'a' && c <= 'z') || 
        (c >= '0' && c <= '9') || 
        c == ' ' || c == ':' || c == '!' || c == '?' || 
        c == '-' || c == '+' || c == '.' || c == '<' || c == '>') {
      clean += (char)c;
    }
  }
  clean.trim();
  
  // Ensure the string contains at least one valid English letter or number
  bool hasAlphaNum = false;
  for (unsigned int i = 0; i < clean.length(); i++) {
    char c = clean.charAt(i);
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
      hasAlphaNum = true;
      break;
    }
  }

  if (!hasAlphaNum || clean.length() == 0) {
    return fallback;
  }
  
  if (clean.length() > 22) {
    clean = clean.substring(0, 22);
  }
  
  return clean;
}

// Map mood to clean English display string
String getMoodDefaultText(String mood) {
  if (mood == "HAPPY")   return "Lola: Happy!";
  if (mood == "EXCITED") return "Lola: Excited!";
  if (mood == "ANNOYED") return "Lola: Annoyed!";
  if (mood == "SAD")     return "Lola: Sad..";
  if (mood == "BORED")   return "Lola: Bored..";
  return "Lola: Ready!";
}

// FreeRTOS task for background API polling (Core 0)
void apiPollTask(void* param) {
  vTaskDelay(2000 / portTICK_PERIOD_MS);
  for (;;) {
    if (!isDeepSleeping && WiFi.status() == WL_CONNECTED) {
      fetchMoodFromAPI();
    }
    vTaskDelay(3000 / portTICK_PERIOD_MS);
  }
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

void muteBuzzer() {
  noTone(BUZZER_PIN);
  dac_output_disable(DAC_CHANNEL_1);
  pinMode(BUZZER_PIN, INPUT); // High impedance mode completely cuts buzzer power!
}

void printCentered(String text, int y, uint16_t color, int textSize = 1) {
  String cleanText = sanitizeStrictEnglish(text, "Lola: Ready!");
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
  printCentered("CypherPet-Setup", 55, ST77XX_GREEN, 1);
  printCentered("on Phone/PC", 75, ST77XX_WHITE, 1);
  
  WiFi.mode(WIFI_STA);
  WiFi.persistent(true);

  wm.setConfigPortalTimeout(60);
  wm.setConnectTimeout(10);
  wm.setSaveConnect(true);
  wm.setBreakAfterConfig(true);
  
  bool connected = wm.autoConnect("CypherPet-Setup");
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
  printCentered("I'm ur new Cypher Bit", 40, ST77XX_YELLOW, 1);
  printCentered("i lvu and beside u forever", 65, ST77XX_MAGENTA, 1);
  drawHeart(80, 92, ST77XX_RED);
  delay(1500);
}

void runDizzyShakeAnimation() {
  unsigned long start = millis();
  int frame = 0;
  while (millis() - start < 1800) {
    tft.fillScreen(ST77XX_BLACK);
    drawClockTopLeft();
    printCentered("DIZZY / SHAKEN!", 16, ST77XX_RED, 1);
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
  muteBuzzer();
}

int getSoundAmplitudeFast() {
  unsigned int signalMax = 0;
  unsigned int signalMin = 4095;
  for (int i = 0; i < 20; i++) {
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
    
    String cleanText = sanitizeStrictEnglish(apiDisplayText, getMoodDefaultText(apiMood));
    printCentered(cleanText, 116, textColor, 1);
    lastPrintedText = cleanText;
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

        // Whitelist sanitize: If rawText is not pure English ASCII, default to mapped mood text
        String cleanEnglish = sanitizeStrictEnglish(rawText, getMoodDefaultText(newMood));

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
  
  muteBuzzer();
  pinMode(VIBRATION_PIN, OUTPUT);

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
  muteBuzzer();

  // 1. Handle 5-Hour Deep Sleep Mode
  if (isDeepSleeping) {
    if (millis() - deepSleepStartTime >= DEEP_SLEEP_DURATION) {
      // 5 hours finished -> Wake up!
      isDeepSleeping = false;
      darkStartTime = 0;
      currentState = STATE_IDLE;
      updateDisplayForState(currentState, true);
    } else {
      // Completely sleeping: ignore sensors, ignore API!
      if (currentState != STATE_DARK) {
        currentState = STATE_DARK;
        tft.fillScreen(ST77XX_BLACK);
        printCentered("Zzz... Sleeping (5h)", 55, ST77XX_CYAN, 1);
      }
      delay(100);
      return; // Stop processing loop
    }
  }

  // 2. Read Light Sensor & Evaluate Night Time Window (2:00 AM to 8:00 AM)
  int lightVal = analogRead(LDR_PIN);
  bool nightWindow = isNightTimeWindow();

  if (nightWindow && lightVal < 300) {
    if (darkStartTime == 0) {
      darkStartTime = millis(); // Start 30-min countdown timer
    } else if (millis() - darkStartTime >= DARK_GRACE_PERIOD) {
      // 30 mins in dark reached between 2 AM and 8 AM -> Enter 5-hour deep sleep!
      isDeepSleeping = true;
      deepSleepStartTime = millis();
      currentState = STATE_DARK;
      tft.fillScreen(ST77XX_BLACK);
      printCentered("Zzz... Sleeping (5h)", 55, ST77XX_CYAN, 1);
      delay(100);
      return;
    }
  } else {
    // Light is ON or outside night window -> Reset dark timer
    darkStartTime = 0;
  }

  // 3. Read Physical Sensors Instantly
  int touched = digitalRead(TOUCH_PIN);
  int shakeRaw = digitalRead(SHAKE_PIN);
  int shakenVal = (shakeRaw == LOW) ? 1 : 0;
  
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float mag = sqrt(a.acceleration.x * a.acceleration.x +
                    a.acceleration.y * a.acceleration.y +
                    a.acceleration.z * a.acceleration.z);
  if (mag > 22.0) shakenVal = 1;

  int soundAmp = getSoundAmplitudeFast();

  int physicalState = STATE_IDLE;
  if (shakenVal == 1) {
    physicalState = STATE_SHAKE;
  } else if (touched == 1) {
    physicalState = STATE_TOUCH;
  } else if (soundAmp > 1500) {
    physicalState = STATE_SOUND;
  }

  // 4. Physical Sensor Dominance
  if (physicalState == STATE_SHAKE) {
    runDizzyShakeAnimation();
    currentState = STATE_IDLE;
    updateDisplayForState(currentState, true);
  }
  else if (physicalState != STATE_IDLE) {
    if (currentState != physicalState) {
      currentState = physicalState;
      if (currentState == STATE_TOUCH) {
        digitalWrite(VIBRATION_PIN, HIGH);
        delay(100);
        digitalWrite(VIBRATION_PIN, LOW);
      }
      muteBuzzer();
      updateDisplayForState(currentState, true);
    }
  }
  // 5. Web Chat API Updates
  else {
    String pendingMsgIdStr = String(pendingMsgIdBuf);
    if (pendingMsgIdStr.length() > 0 && pendingMsgIdStr != lastProcessedMsgId) {
      lastProcessedMsgId = pendingMsgIdStr;

      if (pendingApiState >= 0) {
        int newState = pendingApiState;
        pendingApiState = -1;
        if (newState != currentState) {
          currentState = newState;
          muteBuzzer();
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
