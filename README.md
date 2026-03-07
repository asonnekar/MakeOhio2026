# Note-taker / Lecture Assistant

## Target Users

1. Visually impaired people
2. People hard of hearing
3. Tired students
4. Students with ADD/ADHD
5. Students who overslept for class

## Software

- OpenAI Whisper (free, runs locally) → lecture transcript
- GPT-4o API or local LLM → summarization and annotation notes
- FFmpeg → syncs audio transcript timestamps with video

Your laptop runs the AI pipeline, since the ESP32 is not powerful enough to handle transcription or summarization on-device. [file:1]

## Hardware

### Additional Modules to Buy

These are critical gaps your kit does not cover: [file:1]

1. **Microphone Module (~$5)**  
   - Use an INMP441 I2S MEMS microphone  
   - Connects directly to ESP32  
   - Captures clear voice audio across a classroom

2. **MicroSD Card Module + MicroSD Card (~$5–8)**  
   - Local storage for raw audio recordings and captured slide images  
   - ESP32’s onboard flash is not big enough for a full lecture

3. **Laptop (assumed you already have one)**  
   - Runs the AI pipeline (Whisper, GPT-4o/local LLM, FFmpeg)

### Core Components and Roles

| Component                     | Role in the Project                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| ESP32 Board                  | Central controller; handles Wi‑Fi to stream/send data to a laptop for AI processing |
| ESP32 Camera Extension + Camera | Captures slide annotations and whiteboard in real time                           |
| Audio Amplifier Module       | Amplifies microphone input for lecture audio capture                                 |
| Speaker                      | Plays back AI-generated summaries or text-to-speech output for the user             |
| I2C LCD 1602                 | Shows status: “Recording…”, “Transcribing…”, “Summary ready”                        |
| Buttons (x4)                 | Start/stop recording, trigger slide capture, request summary                        |
| WS2812 RGB LED Strip         | Visual status indicator (green = recording, red = stopped, blue = processing)       |
| IR Controller + IR Receiver  | Remote control from the student’s desk without touching the device                  |
| Active Buzzer                | Audio feedback beeps confirming recording started/stopped                           |
| 18650 Battery                | Portable power for a full lecture                                                   | [file:1]

## Functionality

- Save a lecture recording
- Take structured notes of the lecture
- Generate a lecture transcript and sync it with captured video
- Create a concise summary of the lecture
- Copy slide annotations if the professor is annotating slides
- Provide equal access to education
- Save time for students
- Allow customizable AI-powered note-taking
- Work in classrooms and lecture halls without environment modifications
- Extend usage to meetings, conferences, and other events [file:1]
