interface CoverPromptInput {
  title: string
  genre?: string
  synopsis?: string
  targetAudience?: string
  style?: string
}

export function buildCoverAnalysisPrompt(input: CoverPromptInput): string {
  const { title, genre, synopsis, targetAudience, style } = input

  return `
You are a book cover designer. Analyze the requirements for a novel cover and provide a structured recommendation.

Title: ${title}
${genre ? `Genre: ${genre}` : ''}
${synopsis ? `Synopsis: ${synopsis}` : ''}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}
${style ? `Style: ${style}` : ''}

Please provide your analysis in the following JSON format:
{
  "colorScheme": ["color1", "color2"],
  "composition": "description of the composition style",
  "elements": ["element1", "element2"],
  "mood": "mood description"
}

Consider:
- Color scheme that matches the genre
- Visual elements that convey the story
- Overall mood and atmosphere
- Appropriate composition for a book cover
`.trim()
}

export function buildCoverImagePrompt(input: CoverPromptInput): string {
  const { title, genre, synopsis, targetAudience, style } = input

  let prompt = `Book cover for a novel titled "${title}"`

  if (genre) {
    prompt += `, ${genre} genre`
  }

  if (style) {
    prompt += `, ${style} style`
  }

  prompt += `, professional book cover design, high quality, illustration, vibrant colors, typography for title "${title}"`

  if (synopsis) {
    prompt += `, visual elements inspired by: ${synopsis.substring(0, 200)}`
  }

  prompt += `, book cover art, cover design, no watermarks, no text except the title`

  return prompt
}
