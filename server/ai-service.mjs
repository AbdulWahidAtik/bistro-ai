import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';
const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const isAiEnabled = Boolean(ai);

function fallbackMenuDescription({ name, category }) {
  const dishName = String(name || 'this dish').trim();
  const dishCategory = String(category || 'menu item').trim().toLowerCase();
  return `A refined ${dishCategory} featuring ${dishName}, layered with balanced seasoning, fresh aromatics, and a warm finish designed for clear AI voice recommendations.`;
}

function fallbackScript({ brandName }) {
  const brand = String(brandName || 'Bistro Prime').trim();
  return {
    title: 'AI Generated Reservation Follow-up',
    description: 'Generated follow-up script for reservation callers, confirmations, and optional offer mentions.',
    category: 'DYNAMIC',
    text: `[AI]: "Thanks for calling ${brand}. I can help confirm your reservation details and answer quick menu questions."

[Wait for User Response]

[AI]: "I found your booking. Would you like me to add any dietary notes or special occasion details before we send the confirmation?"

[If Customer Is Interested]

[AI]: "We also have active specials available tonight. I can mention the chef's recommended pairing when your party arrives."

[Finalizing]

[AI]: "You're all set. A confirmation SMS is on the way, and we look forward to hosting you."`,
    avatarText: 'AI',
    lastUpdated: 'Updated just now',
    stats: {
      successRate: 'Pending',
      avgDuration: 'Pending',
      intentAccuracy: 'Pending',
    },
  };
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function generateJson(prompt) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 900,
    },
  });

  return extractJson(response.text || '');
}

export async function generateMenuDescription(input) {
  const fallback = fallbackMenuDescription(input);

  if (!ai) {
    return { description: fallback, source: 'fallback' };
  }

  try {
    const result = await generateJson(`You write concise premium restaurant menu descriptions for an AI phone agent.

Return only JSON with this shape:
{"description":"string"}

Rules:
- 1 sentence, 22 to 36 words.
- Mention sensory details and caller-friendly clarity.
- Do not invent allergy safety claims.
- No markdown.

Dish:
Name: ${input.name}
Category: ${input.category}
Price: ${input.price || 'unknown'}
Special offer: ${input.isSpecial ? 'yes' : 'no'}`);

    return {
      description: String(result.description || fallback).trim(),
      source: 'gemini',
    };
  } catch {
    return { description: fallback, source: 'fallback' };
  }
}

export async function generateScript(input) {
  const fallback = fallbackScript(input);

  if (!ai) {
    return { script: fallback, source: 'fallback' };
  }

  try {
    const activeOffers = Array.isArray(input.menuItems)
      ? input.menuItems
          .filter((item) => item.isSpecial && item.status === 'active')
          .slice(0, 4)
          .map((item) => `${item.name} (${item.category}, $${item.price})`)
          .join(', ')
      : 'none';

    const result = await generateJson(`You create restaurant AI voice-agent scripts.

Return only JSON with this exact shape:
{
  "title":"string",
  "description":"string",
  "category":"DYNAMIC",
  "text":"string"
}

Rules:
- Text should use blocks like [AI], [Wait for User Response], [If Customer Is Interested], [Finalizing].
- Keep it professional, concise, and safe.
- Do not claim confirmed availability unless the caller provides details.
- Include optional offer mention only if it fits.
- No markdown outside JSON.

Restaurant: ${input.brandName || 'Bistro Prime'}
Purpose: ${input.purpose || 'reservation follow-up'}
Active offers: ${activeOffers}`);

    return {
      script: {
        ...fallback,
        title: String(result.title || fallback.title).trim(),
        description: String(result.description || fallback.description).trim(),
        category: 'DYNAMIC',
        text: String(result.text || fallback.text).trim(),
      },
      source: 'gemini',
    };
  } catch {
    return { script: fallback, source: 'fallback' };
  }
}
