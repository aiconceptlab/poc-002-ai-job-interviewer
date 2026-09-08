# AI Job Interviewer
### AI Concept Lab · POC #002
**An AI interviewer that scores your answers — and explains why.**

Choose a practice role, answer a question aloud, review the transcript, and receive feedback grounded in your own words. Refine the answer and practise again.

**Stack:** ElevenLabs Agents + OpenAI evaluator + React/TypeScript. Built with the Sites/Vinext starter and Cloudflare Workers. No database, vector store, webhook, or custom speech pipeline.

## Run the sample
Install **Node.js 22.13 or later**, then:
```sh
npm ci
npm run dev
```
Open the local URL printed in your terminal (normally http://localhost:3000). Click **Explore sample feedback**.

The sample is an authored answer and report, explicitly labelled illustrative. It makes no vendor requests, records no audio and needs no API keys. You can draft your own text, but personalised scoring requires an evaluator key.

## Enable live mode
1. Copy `.env.example` to `.dev.vars` in the project root.
2. Add `OPENAI_API_KEY` for scoring. Add `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` for voice.
3. Generate a private access code and put it in `DEMO_ACCESS_CODE`:
   ```sh
   node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
   ```
4. Configure the ElevenLabs agent using [BUILD.md](BUILD.md) and [the supplied prompt](prompts/elevenlabs-agent.md).
5. Restart the app. Enter the access code in the app, agree to processing, and start practising.

All keys remain on the server. Never prefix them with `VITE_` or `NEXT_PUBLIC_`. Do not paste them into issues or commits. The ignored `.dev.vars` file is for local development; use your host's secret settings when deploying.

**Text-only use:** only `OPENAI_API_KEY` and `DEMO_ACCESS_CODE` are needed. Voice is optional.

## What is included
- Three roles and nine behavioural practice questions.
- Live voice questions and a focused follow-up through ElevenLabs.
- An editable transcript containing only your speech in the answer field.
- Four equal scoring criteria: relevance, structure, evidence, reflection.
- Exact quote verification, score bounds and duplicate-criterion checks.
- Clear handling for unavailable providers, refusals and invalid feedback.
- A downloadable JSON report with the question, answer, rubric version and model.
- A responsive frontend, sample data, setup instructions and automated checks.

## What the score means
Each criterion is rated **1–5**. The total is the sum multiplied by five, so the range is **20–100**. There is no pass/fail threshold.

Feedback concerns the answer's content. It does not evaluate accent, appearance, personality, employability or protected characteristics. It is practice feedback, not a hiring recommendation. Quotes establish attribution; they do not prove an answer is true or a model's judgement is correct.

The default evaluator is the configurable, pinned `gpt-4.1-mini-2025-04-14` snapshot. Live AI judgements can vary. The sample's 75/100 is authored, not a benchmark result.

## Validate and preview the build
```sh
npm run check
npm start
```
`npm run check` runs TypeScript, lint, 33 tests and the production build. `npm start` serves that build locally at http://127.0.0.1:3002. It also loads the root `.dev.vars` file when present.

Read [TESTING.md](TESTING.md) for the actual validation performed and the remaining live checks. The public starter is not presented as a validated hiring system or a hardened multi-user service.

## Privacy and cost
Drafts and reports live in the tab and disappear on refresh. Voice goes to ElevenLabs only when a call starts. The reviewed answer and question go to OpenAI only when feedback is requested. The application does not persist audio, transcripts or reports. Vendors have their own retention settings; `store: false` is used for OpenAI responses, which does not disable all vendor retention.

Source code and the local sample are free. Live voice and evaluation consume vendor API usage; plan allowances, credits and model access depend on your accounts.

A long shared access code protects paid endpoints in this small POC. The in-memory rate limiter is per Worker isolate, not a global spending cap. Use provider limits and real authentication/distributed quotas before operating a larger public service. Set the agent's maximum call duration to 180 seconds as described in BUILD.md.

## Files to make your own
| File | Purpose |
| --- | --- |
| `app/page.tsx`, `app/globals.css` | Interview room and visual design |
| `lib/questions.ts` | Roles, questions and scoring anchors |
| `prompts/elevenlabs-agent.md` | Copy into the voice agent |
| `lib/evaluation.ts` | Evaluator instructions and validation |
| `lib/server.ts` | Authenticated provider calls and request limits |
| `lib/sample.ts` | Clearly labelled offline example |
| `knowledge/interview-guide.md` | Practice guidance and scoring rationale |
| `marketing/` | Instagram carousel, caption and alt text |

## Integration references
The React provider, signed WebSocket session and dynamic variables follow the [ElevenLabs React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react), [authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication) and [personalisation](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) docs. Evaluation uses the [OpenAI Responses structured output pattern](https://developers.openai.com/api/docs/guides/structured-outputs) and a [supported model snapshot](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Checked September 2026 against official docs and installed SDK types.

## Licence
MIT for this project's original code; third-party dependencies retain their own licences. See [LICENSE](LICENSE).

[AI Concept Lab on GitHub](https://github.com/aiconceptlab) · [POC #001: AI Video Receptionist](https://github.com/aiconceptlab/poc-001-ai-video-receptionist)
