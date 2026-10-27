export function defineQuestions(subject, multipleChoice, shortAnswer, offset = {}) {
  const choices = multipleChoice.map(([prompt, correct, ...rest], index) => {
    const explanation = rest.pop()
    const values = [correct, ...rest]
    const shift = index % 4
    return { id: `${subject}-mc-${String(index + 1 + (offset.multiple || 0)).padStart(2, '0')}`, subject, type: 'multiple', prompt,
      options: values.map((_, i) => ({ id: `choice-${i}`, text: values[(i + shift) % 4] })),
      correctOptionId: `choice-${(4 - shift) % 4}`, explanation }
  })
  return [...choices, ...shortAnswer.map(([prompt, acceptedAnswers, explanation], index) => ({
    id: `${subject}-short-${String(index + 1 + (offset.short || 0)).padStart(2, '0')}`, subject, type: 'short', prompt, acceptedAnswers, explanation
  }))]
}
export const normalizeAnswer = value => String(value ?? '').trim().toLowerCase()
export function isCorrect(question, answer) {
  return question.type === 'multiple' ? question.correctOptionId === answer : question.acceptedAnswers.some(a => normalizeAnswer(a) === normalizeAnswer(answer))
}
export function answerText(question, answer) {
  return question.type === 'multiple' ? question.options.find(o => o.id === answer)?.text ?? '선택하지 않음' : String(answer)
}
export function correctText(question) {
  return question.type === 'multiple' ? answerText(question, question.correctOptionId) : question.acceptedAnswers[0]
}
