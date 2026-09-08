'use client';

import { useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { ArrowDown, ArrowRight, Check, ChevronRight, Download, CodeXml, Headphones, Mic, MicOff, RotateCcw, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { anchors, criteria, getQuestion, questions, roles } from '@/lib/questions';
import { sampleAnswer, sampleReport } from '@/lib/sample';
import { appendMessage, candidateAnswer, type TranscriptMessage } from '@/lib/transcript';
import type { Report } from '@/lib/evaluation';

type Capabilities = { voice: boolean; evaluation: boolean };
const repoUrl = 'https://github.com/aiconceptlab/poc-002-ai-job-interviewer';

export default function Page() {
  return <ConversationProvider><InterviewRoom /></ConversationProvider>;
}
function InterviewRoom() {
  const [questionId, setQuestionId] = useState('pm-priorities');
  const question = getQuestion(questionId)!;
  const roleQuestions = questions.filter(q => q.role === question.role);
  const questionIndex = roleQuestions.findIndex(q => q.id === questionId);
  const [answer, setAnswer] = useState('');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const transcript = useRef<TranscriptMessage[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startController = useRef<AbortController | null>(null);
  const reportAnchor = useRef<HTMLElement | null>(null);
  const requestPending = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      transcript.current = [];
      setMessages([]); setAnswer(''); setReport(null);
      setStarting(false); setSeconds(0); setNotice('');
    },
    onMessage: incoming => {
      transcript.current = appendMessage(transcript.current, incoming);
      setMessages(transcript.current);
      const text = candidateAnswer(transcript.current);
      setAnswer(text.slice(0, 6000));
      if (text.length > 6000) setNotice('The answer reached the 6,000 character limit. Finish the call and review the captured text.');
    },
    onDisconnect: details => {
      setStarting(false);
      setNotice(details.reason === 'error' ? 'The call disconnected. Review the text we captured, or type your answer.' : 'Microphone stopped. Review your transcript before scoring.');
    },
    onError: () => {
      setStarting(false);
      setError('Voice could not connect. Check microphone permission and the agent setup, then retry. You can also type.');
    },
  });
  const { status, isSpeaking, isMuted, setMuted, endSession } = conversation;
  const inCall = status === 'connected' || status === 'connecting';
  const locked = inCall || starting || evaluating;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Configuration unavailable');
      setCaps(await response.json() as Capabilities);
    }).catch(error => { if (error.name !== 'AbortError') setError('Could not load live availability. The sample still works.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (status !== 'connected') return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    const stop = window.setTimeout(() => { endSession(); setNotice('Three-minute practice complete. Review your answer below.'); }, 180_000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, [status, endSession]);
  useEffect(() => {
    const stop = () => endSession();
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); startController.current?.abort(); };
  }, [endSession]);

  function changeQuestion(id: string) {
    if (locked) return;
    setQuestionId(id); setAnswer(''); setReport(null); setMessages([]);
    transcript.current = []; setNotice(''); setError('');
  }
  function showSample() {
    if (locked) return;
    setQuestionId('pm-priorities'); setAnswer(sampleAnswer); setReport(sampleReport);
    setMessages([]); transcript.current = []; setError('');
    setNotice('Sample answer and authored feedback. No AI request was made.');
    window.setTimeout(() => reportAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  async function post<T>(path: string, body: unknown, signal?: AbortSignal) {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Access-Code': code },
      body: JSON.stringify(body), signal: signal || AbortSignal.timeout(40_000),
    });
    const value = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Request failed. Please retry.');
    return value as T;
  }
  async function startVoice() {
    if (locked || requestPending.current) return;
    if (!consent) { setError('Please agree to processing before using live mode.'); return; }
    requestPending.current = true; setStarting(true); setError(''); setNotice('');
    const controller = new AbortController();
    startController.current = controller;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Voice needs HTTPS or localhost and a browser with microphone access.');
      // The SDK opens its own input. Release this permission preflight immediately.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      if (controller.signal.aborted) return;
      const data = await post<{ signedUrl: string; dynamicVariables: Record<string, string> }>('/api/session', { questionId, consent }, AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]));
      if (controller.signal.aborted) return;
      conversation.startSession({ signedUrl: data.signedUrl, connectionType: 'websocket', dynamicVariables: data.dynamicVariables });
    } catch (error) {
      setStarting(false);
      if (!controller.signal.aborted) setError(error instanceof Error && error.name !== 'NotAllowedError' ? error.message : 'Microphone permission was denied. You can type your answer instead.');
    } finally { requestPending.current = false; }
  }
  function stopVoice() {
    startController.current?.abort(); setStarting(false);
    endSession(); setNotice('Finishing the call. Review your transcript before scoring.');
  }
  async function evaluate() {
    if (locked || requestPending.current) return;
    requestPending.current = true; setEvaluating(true); setError(''); setNotice('');
    try {
      const result = await post<Report>('/api/evaluate', { questionId, answer, consent });
      setReport(result);
      window.setTimeout(() => reportAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } catch (error) { setError(error instanceof Error ? error.message : 'Feedback failed. Your answer is still here.'); }
    finally { setEvaluating(false); requestPending.current = false; }
  }
  function downloadReport() {
    if (!report) return;
    const data = { question: question.question, role: question.role, answer, report, note: 'Interview practice feedback. Self-reported answer; not a hiring assessment.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'interview-practice-' + question.id + '.json';
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell">
    <header className="masthead">
      <a className="brand" href="https://github.com/aiconceptlab"><span className="brand-mark" aria-hidden="true">a<span>i</span></span> AI CONCEPT LAB</a>
      <span className="edition">EXPERIMENT 002</span>
      <a className="source-link" href={repoUrl} target="_blank" rel="noreferrer"><CodeXml size={16} /> <span>Get the code</span><ArrowRight size={16} /></a>
    </header>
    <main>
      <section className="intro" aria-labelledby="page-title">
        <div><p className="eyebrow"><span className="tiny-dot" /> AI JOB INTERVIEWER</p>
          <h1 id="page-title">A little practice.<br /><span>A clearer answer.</span></h1></div>
        <div className="intro-side"><p>Meet your next interview<br />with a better story to tell.</p>
          <Button variant="outline" className="sample-button" disabled={locked} onClick={showSample}><Sparkles size={16} /> Explore sample feedback <ArrowDown size={16} /></Button>
          <span className="small muted">No account or credits needed for the sample.</span>
        </div>
      </section>
      <div className="workspace-title"><h2>Interview room</h2><span><span className="tiny-dot" /> {caps?.voice ? 'Live voice available' : 'Practice at your own pace'}</span></div>
      <section className="workspace" aria-label="Interview practice">
        <div className="interview-panel">
          <div className="panel-top"><span className="step">01 / THE QUESTION</span><label className="sr-only" htmlFor="role">Practice role</label>
            <select id="role" value={question.role} disabled={locked} onChange={event => changeQuestion(questions.find(q => q.role === event.target.value)!.id)}>{roles.map(role => <option key={role}>{role}</option>)}</select>
          </div>
          <div className="question-meta"><span>{question.topic}</span><span>{questionIndex + 1} / 3</span></div>
          <h3 className="question">{question.question}</h3>
          <p className="question-focus">{question.focus}</p>
          <div className={'voice-stage ' + (inCall ? 'active' : '') + (isSpeaking ? ' speaking' : '')}>
            <div className="voice-orbit" aria-hidden="true"><div className="orbit-inner"><div className="waveform">{[18, 35, 56, 28, 68, 43, 24, 51, 33].map((height, i) => <span key={i} style={{ height, animationDelay: i * -0.11 + 's' }} />)}</div></div></div>
            <output className="voice-status">{status === 'connected' ? (isMuted ? 'Microphone muted' : isSpeaking ? 'Interviewer speaking' : 'Listening to your answer') : (starting || status === 'connecting') ? 'Connecting your interviewer…' : 'Your space to practise'}</output>
            <p className="small muted">{inCall ? String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0') + ' / 03:00' : 'One question. A follow-up. Room to improve.'}</p>
            <div className="voice-actions">{inCall || starting ? <>
              <Button className="action-button" onClick={stopVoice}><Square size={15} /> Finish answer</Button>
              {status === 'connected' && <Button variant="outline" size="icon" aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'} onClick={() => setMuted(!isMuted)}>{isMuted ? <MicOff /> : <Mic />}</Button>}
            </> : <Button className="action-button" disabled={!caps?.voice || evaluating || !consent || !code} onClick={startVoice}><Mic size={17} /> {answer ? 'Record a new answer' : 'Start voice interview'}</Button>}</div>
            {!caps?.voice && <p className="small availability">Voice needs an ElevenLabs agent.<br />Try the sample, or draft your answer.</p>}
          </div>
          <div className="question-nav">{roleQuestions.map((item, i) => <Button key={item.id} variant="ghost" disabled={locked} className={item.id === questionId ? 'selected' : ''} aria-label={'Question ' + (i + 1) + ': ' + item.topic} aria-pressed={item.id === questionId} onClick={() => changeQuestion(item.id)}><span>0{i + 1}</span>{item.topic}</Button>)}</div>
        </div>
        <div className="answer-panel">
          <div className="panel-top"><label className="step" htmlFor="answer">02 / YOUR ANSWER</label><span className="small muted">Speak or type</span></div>
          <p className="answer-help">Make it yours. Review the transcript and correct anything the interviewer misheard.</p>
          <Textarea id="answer" className="answer-input" placeholder="Set the scene. Explain what you did. Share what changed — and what you learned." value={answer} maxLength={6000} disabled={locked} onChange={event => { setAnswer(event.target.value); setReport(null); setNotice(''); }} aria-describedby="answer-count" />
          <div className="answer-meta"><span id="answer-count">{answer.length.toLocaleString()} / 6,000 characters</span><span>Only your answer is scored</span></div>
          {messages.length > 0 && <details className="transcript"><summary>View conversation <ChevronRight size={14} /></summary><div>{messages.map((message, i) => <p key={i}><strong>{message.role === 'user' ? 'You' : 'Interviewer'}</strong>{message.message}</p>)}</div></details>}
          {(caps?.voice || caps?.evaluation) && <div className="live-setup">
            <label htmlFor="access-code">Live access code</label>
            <Input id="access-code" type="password" autoComplete="off" maxLength={256} value={code} disabled={locked} onChange={event => setCode(event.target.value)} placeholder="Provided by the demo owner" />
            <label className="consent" htmlFor="consent"><input id="consent" type="checkbox" checked={consent} disabled={locked} onChange={event => setConsent(event.target.checked)} /><span>I agree to send voice to ElevenLabs when calling, and my reviewed answer to OpenAI when scoring. I will use non-sensitive examples.</span></label>
          </div>}
          <div className="feedback-actions"><Button className="action-button" disabled={locked || !caps?.evaluation || !consent || !code || answer.trim().length < 40} onClick={evaluate}><Sparkles size={16} /> {evaluating ? 'Reviewing your answer…' : 'Get my feedback'}<ArrowRight size={16} /></Button>
            <Button variant="ghost" disabled={locked || !answer} onClick={() => { setAnswer(''); setReport(null); setMessages([]); transcript.current = []; setNotice(''); setError(''); }}><RotateCcw size={15} /> Clear</Button></div>
          {!caps?.evaluation && <p className="small muted">Personalised scoring needs an evaluator key. <button className="text-button" disabled={locked} onClick={showSample}>See how feedback looks.</button></p>}
          <div className="privacy-note"><Check size={15} /><p>Drafts stay in this tab until you request feedback. This app has no database. <a href="#how-it-works">Processing & scoring</a></p></div>
        </div>
      </section>
      {error && <div className="message error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      {notice && <output className="message notice">{notice}</output>}

      <section className="report-section" ref={reportAnchor} aria-labelledby="report-title">
        <div className="workspace-title"><h2 id="report-title">Your feedback</h2><span>03 / THE NEXT STEP</span></div>
        {report ? <div className="report-grid">
          <div className="score-panel"><span className="tag">{report.kind === 'sample' ? 'ILLUSTRATIVE SAMPLE' : 'AI PRACTICE FEEDBACK'}</span><div className="score">{report.total}<span>/100</span></div><p>{report.summary}</p><span className="small muted">Four equal criteria · 1–5 each<br />Total = sum of scores × 5</span><Button variant="outline" className="download-button" onClick={downloadReport}><Download size={16} /> Download feedback</Button></div>
          <div className="criteria-panel">{report.criteria.map((item, index) => <details key={item.id} className="criterion" open={index === 0}>
            <summary><span>{criteria.find(c => c.id === item.id)!.label}</span><span className="criterion-score"><span className="dots" aria-hidden="true">{[1,2,3,4,5].map(n => <i key={n} className={n <= item.score ? 'filled' : ''} />)}</span>{item.score}/5<ChevronRight size={16} /></span></summary>
            <div className="criterion-body">{item.quote ? <blockquote>“{item.quote}”</blockquote> : <p className="small muted">No supporting evidence in this answer.</p>}<p>{item.explanation}</p><p className="improvement"><strong>Try this</strong>{item.improvement}</p></div>
          </details>)}</div>
          <div className="next-step"><Sparkles size={21} /><div><span className="step">ONE THING TO IMPROVE</span><p>{report.nextStep}</p><span className="small">Practise next: {report.followUp}</span></div><Button variant="outline" disabled={locked} onClick={() => { setReport(null); document.getElementById('answer')?.focus(); }}>Refine my answer<ArrowRight size={15} /></Button></div>
        </div> : <div className="report-empty"><div className="empty-icon"><Headphones /></div><div><h3>Good feedback gives you a next step.</h3><p>Your scores, evidence and one thing to improve will appear here.</p></div><Button variant="outline" disabled={locked} onClick={showSample}>Explore a sample<ArrowRight size={15} /></Button></div>}
      </section>
      <section className="method" id="how-it-works">
        <details><summary>How the scoring works <ChevronRight size={16} /></summary><div className="method-content"><p>Each answer is reviewed for relevance, structure, evidence and reflection. Each criterion receives 1–5; the four scores are added and multiplied by 5. The range is 20–100. A score is practice feedback, not a hiring recommendation or a prediction of interview success.</p><ul>{anchors.map(anchor => <li key={anchor}>{anchor}</li>)}</ul><p>AI feedback can be wrong or inconsistent. Quotes are checked against your submitted text; this checks attribution, not the truth of your story or the quality of the judgement. The sample is authored and never presented as your personal evaluation.</p></div></details>
        <details><summary>What happens to my words? <ChevronRight size={16} /></summary><div className="method-content"><p>Typing stays in this browser tab until you choose Get my feedback. Starting a voice session sends microphone audio to ElevenLabs, which generates a transcript. Scoring sends the selected question and your reviewed answer to OpenAI. API keys stay on the server.</p><p>This app does not save audio, answers or reports to a database. Closing or refreshing the page clears its state; downloads remain on your device. Vendors process data under their account settings and retention policies. OpenAI response storage is disabled; this does not disable every provider retention mechanism. Use fictional or non-sensitive examples.</p></div></details>
      </section>
    </main>
    <footer><span>AI CONCEPT LAB <b>/</b> POC 002</span><span>Built to learn. Shared to build.</span><a href={repoUrl}>ElevenLabs + LLM evaluator <ArrowRight size={14} /></a></footer>
  </div>;
}
