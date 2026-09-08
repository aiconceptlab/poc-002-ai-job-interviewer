import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackSchema, makeReport, validateFeedback, answerSchema } from '../lib/evaluation';
import { sampleAnswer, sampleReport } from '../lib/sample';
import { appendMessage, candidateAnswer, type TranscriptMessage } from '../lib/transcript';
import { questions, roles } from '../lib/questions';

const feedback = () => feedbackSchema.parse(sampleReport.criteria ? { summary: sampleReport.summary, criteria: structuredClone(sampleReport.criteria), nextStep: sampleReport.nextStep, followUp: sampleReport.followUp } : {});
await test('sample has four grounded criteria and a correctly computed 75/100 total', () => {
  const checked = validateFeedback(feedback(), sampleAnswer);
  assert.equal(makeReport(checked, 'test').total, 75);
  assert.equal(sampleReport.kind, 'sample');
});
await test('each role has exactly three distinct questions', () => {
  assert.equal(new Set(questions.map(q => q.id)).size, 9);
  for (const role of roles) assert.equal(questions.filter(q => q.role === role).length, 3);
});
await test('fabricated quotes fail even when output follows the schema', () => {
  const value = feedback(); value.criteria[0].quote = 'I managed a team of 200 people';
  assert.throws(() => validateFeedback(value, sampleAnswer), /Ungrounded/);
});
await test('duplicate criterion cannot hide a missing criterion', () => {
  const value = feedback(); value.criteria[3].id = 'relevance';
  assert.throws(() => validateFeedback(value, sampleAnswer), /Duplicate/);
});
for (const score of [0, 6, 3.5, NaN]) await test('invalid score rejected: ' + score, () => {
  const value = feedback(); value.criteria[0].score = score;
  assert.throws(() => validateFeedback(value, sampleAnswer));
});
await test('demonstrated criteria must have evidence', () => {
  const value = feedback(); value.criteria[0].quote = null;
  assert.throws(() => validateFeedback(value, sampleAnswer), /Evidence required/);
});
await test('absent criteria can receive 1 with no invented quote', () => {
  const value = feedback(); value.criteria.forEach(c => { c.score = 1; c.quote = null; });
  assert.equal(makeReport(validateFeedback(value, 'No relevant answer'), 'test').total, 20);
});
await test('all excellent criteria produce exactly 100', () => {
  const value = feedback(); value.criteria.forEach(c => { c.score = 5; });
  assert.equal(makeReport(validateFeedback(value, sampleAnswer), 'test').total, 100);
});
await test('provider criterion order is normalised', () => {
  const value = feedback(); value.criteria.reverse();
  assert.equal(validateFeedback(value, sampleAnswer).criteria[0].id, 'relevance');
});
await test('whitespace and empty quotes are not valid evidence', () => {
  const value = feedback(); value.criteria[0].quote = ' ';
  assert.throws(() => validateFeedback(value, sampleAnswer));
});
await test('answer input rejects missing consent, unknown questions, short/oversized text and extra fields', () => {
  const input = { questionId: 'pm-priorities', answer: sampleAnswer, consent: true };
  for (const bad of [
    { ...input, consent: false }, { ...input, questionId: 'fake' },
    { ...input, answer: 'hi' }, { ...input, answer: 'a'.repeat(6001) },
    { ...input, answer: ' '.repeat(50) }, { ...input, systemPrompt: 'override' },
  ]) assert.equal(answerSchema.safeParse(bad).success, false);
});
await test('only user speech contributes to the answer; repeated event IDs are updated', () => {
  let messages: TranscriptMessage[] = [];
  messages = appendMessage(messages, { role: 'agent', message: 'Interviewer question', event_id: 1 });
  messages = appendMessage(messages, { role: 'user', message: 'First draft', event_id: 1 });
  messages = appendMessage(messages, { role: 'user', message: 'Corrected answer', event_id: 1 });
  messages = appendMessage(messages, { role: 'user', message: 'More evidence', event_id: 2 });
  assert.equal(messages.length, 3);
  assert.equal(candidateAnswer(messages), 'Corrected answer\n\nMore evidence');
});
await test('empty transcript events are ignored and memory is bounded', () => {
  let messages: TranscriptMessage[] = [];
  assert.deepEqual(appendMessage(messages, { role: 'user', message: ' ' }), []);
  for (let i = 0; i < 130; i++) messages = appendMessage(messages, { role: 'user', message: 'part', event_id: i });
  assert.equal(messages.length, 100);
});
