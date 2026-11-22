# Demo script (2 minutes)

**Before you start:** open the site 1–2 minutes early (free hosting sleeps). Press **Reset** in the Scenario panel if a previous run is active. Keyboard: `1`–`5` switch pages.

| Time | Screen | Say |
|---|---|---|
| 0:00 | **Overview** | "In orbit, crews face radiation and broken sleep, about 16 sunrises a day. Today those are tracked in separate tools. ASTRA SHIELD fuses them into one number per astronaut." Point at the three crew panels and the formula line. |
| 0:15 | Overview, telemetry strip | "This is real orbit data: position from a CelesTrak TLE, day/night, and the South Atlantic Anomaly, where trapped protons are strongest. Solar X-ray flux comes from NOAA GOES, and the loader also takes Aditya-L1 data from ISRO PRADAN." |
| 0:30 | Vyomnaut 02 panel | "Vyomnaut 02 is sleep-deprived: five hours of debt, HRV 25 % below baseline, fatigue 5 of 7. Still green, because radiation is low right now." Hover the contribution bars. |
| 0:40 | **Scenario panel**: Arm → Execute | "Now an X-class flare erupts just as the station enters the SAA." Let the five steps play. |
| 0:55 | Crew panels + red strip | "Vyomnaut 02 jumps to **76, critical**. The others go to caution. Neither signal alone would have triggered this; the combination does." |
| 1:05 | Active directives | "The decision engine acts: postpone the EVA, reassign it to the safest crew member, shelter everyone, and switch Vyomnaut 02's module to warm sleep lighting." |
| 1:20 | **Schedule** (`5`) | "Our differentiator: we plan around *predicted* radiation passes. The dashed outline is where the EVA was. It moved to Vyomnaut 03, in a window clear of every SAA pass, and Vyomnaut 02's sleep was extended to seven hours." Click the EVA block to show its reason. |
| 1:40 | **Decisions** (`4`) | "Every action is logged and streamed live over WebSocket." Acknowledge one alert. |
| 1:50 | Footer | "Honest limits: a prototype, not a medical device; crew data is simulated; weights are design choices. Built for Gaganyaan-class missions, and the sleep engine could help night-shift clinicians on Earth." |

**Backup if the network fails:** the app runs fully offline (`DATA_MODE=offline`) from bundled TLE and GOES snapshots; the scenario result is identical.
