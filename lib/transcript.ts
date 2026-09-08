export type TranscriptMessage = { role: 'user' | 'agent'; message: string; event_id?: number };
export function appendMessage(messages: TranscriptMessage[], incoming: TranscriptMessage) {
  if (!incoming.message.trim()) return messages;
  const index = incoming.event_id === undefined ? -1 : messages.findIndex(m => m.role === incoming.role && m.event_id === incoming.event_id);
  if (index < 0) return [...messages, incoming].slice(-100);
  return messages.map((m, i) => i === index ? incoming : m);
}
export function candidateAnswer(messages: TranscriptMessage[]) {
  return messages.filter(m => m.role === 'user').map(m => m.message.trim()).join('\n\n');
}
