# Contract: Onboarding Questionnaire UI

## Screen

- `showScreen` id: `onboardingQuestionnaire`
- Markup id: `screenOnboardingQuestionnaire`
- Full-bleed primary screen (DESIGN.md)

## Copy (English)

| Id | Prompt | Options |
|----|--------|---------|
| R-Q1 | Are you comfortable answering Socratic questions out loud using the transcriber? | voice / text / avoid |
| R-Q2 | How much time do you want to spend on this content? | deep / moderate / urgent |
| R-Q3 | Do you need this content more to memorize concrete facts, or to understand and reason about ideas? | memorize / both / understand |
| R-Q4 | Do you want to work directly with the original text (with our help), or would you prefer we explain it to you? | original / explained / indifferent |
| R-Q5 | Is there anything about your goal with this content, or your relationship to the topic, that you'd like us to take into account? | optional textarea |

## Behavior

- R-Q1–R-Q4 required before Submit enabled
- R-Q5 optional
- Submit writes `onboardingResponses` + `studentIntent` once, then continues post-scope entry
- No edit path after submit
- Do not label screen as test/assessment
