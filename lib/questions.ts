export const roles = ['Product manager', 'Software engineer', 'Customer success'] as const;
export type Role = typeof roles[number];
export const questions = [
  { id: 'pm-priorities', role: roles[0], topic: 'Prioritisation', question: 'Tell me about a time you had to choose between competing priorities.', focus: 'Explain your decision, the trade-off, and what happened.' },
  { id: 'pm-discovery', role: roles[0], topic: 'Customer insight', question: 'Describe a time customer feedback changed your product decision.', focus: 'Explain the evidence, your response, and what you learned.' },
  { id: 'pm-influence', role: roles[0], topic: 'Collaboration', question: 'Tell me about a disagreement with a stakeholder and how you handled it.', focus: 'Explain both perspectives, your actions, and the outcome.' },
  { id: 'se-debugging', role: roles[1], topic: 'Problem solving', question: 'Walk me through a difficult bug you investigated and fixed.', focus: 'Explain your hypotheses, how you tested them, and the result.' },
  { id: 'se-tradeoffs', role: roles[1], topic: 'Technical decisions', question: 'Describe a technical trade-off you made under a tight deadline.', focus: 'Explain alternatives, risks, and how you checked your decision.' },
  { id: 'se-teamwork', role: roles[1], topic: 'Collaboration', question: 'Tell me about a time you helped a teammate overcome a technical challenge.', focus: 'Explain your contribution, their contribution, and what changed.' },
  { id: 'cs-escalation', role: roles[2], topic: 'Customer care', question: 'Tell me about a time you handled a frustrated customer.', focus: 'Explain how you understood the problem, acted, and followed up.' },
  { id: 'cs-adoption', role: roles[2], topic: 'Customer value', question: 'Describe how you helped a customer get more value from a product.', focus: 'Explain the goal, your actions, and evidence of progress.' },
  { id: 'cs-expectations', role: roles[2], topic: 'Communication', question: 'Tell me about a time you had to reset a customer’s expectations.', focus: 'Explain the constraint, your communication, and what happened next.' },
] as const;
export type Question = typeof questions[number];
export function getQuestion(id: string) { return questions.find(q => q.id === id); }
export const criteria = [
  { id: 'relevance', label: 'Relevance', description: 'Does the answer address the question and your role?' },
  { id: 'structure', label: 'Structure', description: 'Can the listener follow the context, action and outcome?' },
  { id: 'evidence', label: 'Evidence', description: 'Are your actions and results supported by specific details?' },
  { id: 'reflection', label: 'Reflection', description: 'Do you explain a lesson, limitation or next step?' },
] as const;
export const anchors = [
  '1 — Missing: the criterion is not demonstrated.',
  '2 — Emerging: mentioned, but vague or difficult to follow.',
  '3 — Clear: demonstrated with a relevant detail; a material gap remains.',
  '4 — Strong: specific and well explained, with a minor gap.',
  '5 — Excellent: specific, complete and persuasive for this question.',
];
