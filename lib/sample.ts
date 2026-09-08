import { makeReport, validateFeedback } from './evaluation';
export const sampleAnswer = 'At our B2B software team, sales wanted a new dashboard while support reported repeated onboarding failures. I reviewed 30 support tickets and spoke with five new customers. I chose to fix onboarding first because it blocked customers from reaching the product’s core value. I agreed a two-week delay with sales and shared the evidence behind that trade-off. I worked with design and engineering on a shorter setup flow. In the next cohort, setup completion rose from 54% to 71%. I learned to bring customer evidence into prioritisation discussions earlier.';
export const sampleReport = makeReport(validateFeedback({
  summary: 'A clear trade-off backed by customer evidence. Make the limits of the result and your next action more explicit.',
  criteria: [
    { id: 'relevance', score: 4, quote: 'I chose to fix onboarding first', explanation: 'You directly address competing priorities and explain your decision. The alternative is named, but its cost is not explored.', improvement: 'Add one sentence about what delaying the dashboard meant for sales.' },
    { id: 'structure', score: 4, quote: 'I agreed a two-week delay with sales', explanation: 'The answer moves from context to decision, action and result. Your contribution is easy to follow.', improvement: 'Open with a brief statement of the decision to make the story even easier to follow.' },
    { id: 'evidence', score: 4, quote: 'setup completion rose from 54% to 71%', explanation: 'The answer gives a concrete reported outcome. It does not establish cohort size or whether other changes contributed.', improvement: 'Explain the measurement period and any other changes that might have affected completion.' },
    { id: 'reflection', score: 3, quote: 'I learned to bring customer evidence into prioritisation discussions earlier.', explanation: 'A relevant lesson is present, but the answer does not say how you would apply it next time.', improvement: 'Describe one repeatable habit you would introduce before the next planning meeting.' },
  ],
  nextStep: 'Add how you would apply the lesson: what would you do before the next prioritisation meeting?',
  followUp: 'What evidence would have made you choose the dashboard instead?',
}, sampleAnswer), 'Illustrative feedback written for this demo', 'sample');
