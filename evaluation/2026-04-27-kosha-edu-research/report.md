# KOSHA Education Portal Research Evidence

- Site: https://edu.kosha.or.kr/
- Date: 2026-04-27
- Result: Vue SPA with browser-callable JSON endpoints.
- Confirmed endpoints:
  - POST /api/portal24/bizG/p/GETEA02001/selectEduWayCd: 200
  - POST /api/portal24/bizG/p/GETEA02001/selectEduTrgt: 200
  - POST /api/portal24/bizG/p/GETEA02001/selectEduInst: 200
  - POST /api/portal24/bizG/p/GETEA02001/selectEduCrsList: 200 with empty result for tested search conditions
- Confirmed target metadata includes 외국인근로자.
- goscrapy recommendation: use as scheduled/offline snapshot crawler rather than Vercel runtime dependency.
