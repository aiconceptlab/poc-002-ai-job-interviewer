# Build POC #002
A deliberately small interview-practice product: one voice agent, one evaluator, no database.

## 1. Start with the free sample
Run `npm ci`, then `npm run dev`. No setup is needed to explore the sample, edit a draft, choose a role or inspect the rubric. The sample never pretends to evaluate your own edited answer: editing it clears the report.

The frontend uses React 19, TypeScript and the supplied shadcn primitives. The runtime is **Vinext 1.0.0-beta.5**, a Vite implementation of Next-style routing, on Cloudflare Workers. This is not a stock Next.js/Vercel project. Node 22.13+ is required. Exact dependencies are locked.

## 2. Create one ElevenLabs agent
In the ElevenLabs Agents dashboard:
1. Create a blank conversational agent. Choose a voice available to your account and English.
2. Paste [prompts/elevenlabs-agent.md](prompts/elevenlabs-agent.md) into its system prompt.
3. Set the first message to:
   > Hi, I'm your AI interview practice partner. Let's practise for a {{interview_role}} role. {{interview_question}}
4. Define default values for the dynamic variables used in the prompt:
   - `interview_role`: Product manager
   - `interview_question`: Tell me about a time you had to choose between competing priorities.
   - `interview_focus`: Explain your decision, the trade-off, and what happened.
5. Enable agent authentication. Add your local development and deployment hosts to the agent's domain allowlist as needed. The starter uses the standard `api.elevenlabs.io` region. Regional or private endpoints require adapting the server endpoint and signed-host validation.
6. Keep voice enabled and make sure the agent sends user transcription and agent response events. The SDK consumes these; the relevant event names are `user_transcript` and `agent_response`.
7. Set the agent's **maximum conversation duration to 180 seconds**. The app also stops at three minutes; the server-side vendor limit matters if someone modifies the browser client.
8. Optionally enable the agent's built-in end-call tool. The prompt tells it to finish after one follow-up. The user can always choose **Finish answer**.
9. Save/publish the configuration as required by your agent's deployment settings. Copy its agent ID.

Do not add a scoring tool to the voice agent. Its task is to ask and listen. A separate request evaluates the transcript after the user reviews it. No RAG, CRM or webhook is needed.

The dynamic variables personalise the prompt without enabling arbitrary system-prompt overrides. Treat browser session configuration as untrusted: it is not an access-control boundary. The evaluator independently looks up a question from its server-side catalogue.

Official references: [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react), [authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication), [dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables).

## 3. Configure local secrets
Copy `.env.example` to `.dev.vars`. Keep it beside `package.json`, not in `public/`.

| Variable | Needed for |
| --- | --- |
| `ELEVENLABS_API_KEY` | Server-created signed voice session |
| `ELEVENLABS_AGENT_ID` | Your configured voice agent |
| `OPENAI_API_KEY` | Personalised evaluation |
| `OPENAI_MODEL` | Optional evaluator override |
| `DEMO_ACCESS_CODE` | Required shared gate, minimum 24 characters |

Generate a random code using the command in README. Share it only with intended demo testers. It is entered in a password field and held in browser memory, not stored in localStorage.

Restart the dev server after editing secrets. `GET /api/config` returns only availability booleans. A missing/short access code disables both paid features. A scoring-only setup is supported.

For standard OpenAI accounts, choose a project with access to the configured model and set usage controls. The [model page](https://developers.openai.com/api/docs/models/gpt-4.1-mini) lists the pinned snapshot. A paid ChatGPT subscription does not configure this project's API.

## 4. Try the full flow
1. Choose a role and one of its questions.
2. Enter the live access code and read/accept the processing notice.
3. Start the voice interview. The microphone requires localhost or HTTPS.
4. Answer the question and the agent's follow-up. Click **Finish answer**.
5. Review the captured answer; correct transcription errors. The full conversation can be expanded, but interviewer speech is excluded from the scored field.
6. Click **Get my feedback**. Expand the criteria, refine the answer, and try again.
7. Download the report if you want to keep it before refreshing.

The SDK owns audio/WebSocket teardown. A preliminary microphone permission stream is immediately stopped. Starting a new recording replaces a prior draft only once the call connects. The app does not silently retry paid requests.

## 5. Understand the evaluator
The server calls the OpenAI Responses API with a strict Zod-derived JSON schema, `store: false`, a 30-second timeout and a 2,800-token output limit. It passes the coaching instructions separately from JSON-encoded answer data. The candidate answer is never treated as a system prompt.

The server then verifies:
- Exactly four distinct known criteria.
- Integer scores from 1 to 5.
- Every non-null quote is an exact substring of the submitted answer.
- Criteria scored above 1 have a supporting quote.
- The response is completed and not a refusal.

It calculates the total itself. Incomplete or invalid feedback fails visibly; no guessed score is shown. Exact quote checks do not guarantee fair or correct model judgement. [Structured Outputs reference](https://developers.openai.com/api/docs/guides/structured-outputs).

## 6. Run the release checks
```sh
npm run check
npm start
```
The preview uses the built Worker and serves on port 3002. The wrapper passes the root `.dev.vars` file to Wrangler via `--env-file`, so dev and built previews use the same local settings. Use `npm start -- --port 4000` to override the preview port.

The generated, unused shadcn catalogue and its `use-mobile` helper are retained and excluded from lint; TypeScript still checks them. App code, API routes and tests are linted.

## 7. Publish your own app
Public source code and a running live service are separate things. To deploy this Worker to your own Cloudflare account:
1. Run `npm run check`.
2. Authenticate Wrangler to your own account.
3. Add the five runtime values as Worker secrets using your host's secret settings or `wrangler secret put NAME --config dist/server/wrangler.json`. Do not add secrets to the Wrangler JSON.
4. Deploy the built Worker with `wrangler deploy --config dist/server/wrangler.json`.
5. Add the resulting HTTPS host to the ElevenLabs domain allowlist.
6. Perform the live acceptance checklist in TESTING.md using non-sensitive test data.

For a Sites deployment, register your own Site and manage secrets there. The portable release's `.openai/hosting.json` intentionally has no owner-specific project ID.

Keep the sample public without vendor credentials if you want a zero-usage showcase. For live access beyond a few trusted testers, replace the shared code with real sign-in and distributed quotas, configure provider limits and appropriate privacy/retention settings. The in-memory limiter allows 20 requests per IP per ten minutes per isolate; it also counts failed code attempts. It is a small-demo guard, not a global security or cost boundary.

## Troubleshooting
| Symptom | Check |
| --- | --- |
| Live controls stay disabled | Restart after adding secrets; access code needs 24+ characters; consent and code are required in the UI. |
| Voice cannot connect | Agent authentication, agent ID, allowlist, microphone permission, account credits and the configured voice. |
| Literal variable names are spoken | Use exactly the three variable names in this guide and include them in the agent prompt/first message. |
| Transcript is empty | Ensure user transcript events are enabled. Finish the call and type an answer if needed. |
| Feedback is unavailable | Verify the OpenAI key, model access and project limits; inspect your provider dashboard without logging raw answers or keys. |
| Feedback fails evidence checks | A generated quote or criterion was invalid. Retry; do not remove the validation to hide the error. |
| Too many requests | Wait ten minutes or restart a local dev process. Hosted isolates can have separate counters. |
| Missing sourcemap warnings | The installed ElevenLabs package references source files not shipped in its archive. Build and runtime checks are the relevant checks. |
