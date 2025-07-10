# AI Chat Bot Backend

## Funcționalități implementate
- Propagare robustă a variabilei `language` la toate nodurile și prompturile
- Context conversațional structurat, intent recognizer pentru closing
- Prompturi umane la booking (closing, politețuri, confirmare)
- Timeout sesiune (inactivitate, default 15 min)
- Flag `conversationClosed` și logică de flow pentru conversație închisă
- Intent recognizer pentru closing (pattern-uri clare, nu doar "mulțumesc")
- Buton "Închide conversația" în dashboard (frontend)
- Loguri detaliate la fiecare pas
- Fallback robust, fără buguri de context/limbă
- Backup orchestrator înainte de refactor

## Widget status
- UI clasic funcțional, buton closing adăugat
- Widget modern/embeddable: **TODO** (prototip în lucru)

## Strategie fallback uman
- Dacă agentul fallback detectează o problemă nerezolvabilă sau intent de "escaladare", trimite alertă către operator uman (ex: Telegram, email, Slack)
- Operatorul primește contextul conversației și poate prelua sesiunea (viitor: integrare live chat)
- TODO: Implementare completă alertare multi-canal și preluare sesiune

## Strategie completă closing & fallback
- Intent recognizer pentru closing și politețuri
- Timeout automat sesiune
- Buton explicit în UI
- Fallback uman la nevoie (escaladare, alertă operator)

## TODO-uri rămase
- Widget modern/embeddable
- Testare automată closing/timeout
- Extindere closing la fallback/support
- Health-check-uri, dashboard live, CI/CD, audit, self-eval
- Slot-filling avansat, intent tracking detaliat
- Testare completă cu payloaduri reale

## Curățenie documente
- Toate funcționalitățile și statusul actual sunt reflectate aici
- Pentru detalii suplimentare, vezi codul sursă și comentariile din orchestrator