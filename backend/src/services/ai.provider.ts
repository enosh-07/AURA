/**
 * AI Provider Abstraction
 *
 * Supports: Gemini, OpenAI-compatible APIs, Ollama (local)
 * Provider is selected via ENV.AI_PROVIDER.
 *
 * SECURITY: API keys NEVER leave the backend. Never send them to the frontend.
 */

import { ENV } from '../config/env.js';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionResult {
  text: string;
  provider: string;
  model: string;
}

export interface IAIProvider {
  complete(messages: AIMessage[], maxTokens?: number): Promise<AICompletionResult>;
}

// ============================================================
// GEMINI PROVIDER
// ============================================================

class GeminiProvider implements IAIProvider {
  async complete(messages: AIMessage[], maxTokens = 1024): Promise<AICompletionResult> {
    if (!ENV.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured.');

    // Build Gemini-style contents
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const contents = userMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: any = {
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${ENV.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, provider: 'gemini', model: 'gemini-1.5-flash' };
  }
}

// ============================================================
// OPENAI-COMPATIBLE PROVIDER (OpenAI, local LM Studio, etc.)
// ============================================================

class OpenAICompatibleProvider implements IAIProvider {
  async complete(messages: AIMessage[], maxTokens = 1024): Promise<AICompletionResult> {
    if (!ENV.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured.');

    const res = await fetch(`${ENV.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: ENV.OPENAI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI-compatible API error: ${res.status}`);
    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content || '';
    return { text, provider: 'openai', model: ENV.OPENAI_MODEL };
  }
}

// ============================================================
// OLLAMA LOCAL PROVIDER
// ============================================================

class OllamaProvider implements IAIProvider {
  async complete(messages: AIMessage[], _maxTokens = 1024): Promise<AICompletionResult> {
    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const prompt = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const res = await fetch(`${ENV.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ENV.OLLAMA_MODEL,
        prompt: systemMsg ? `${systemMsg}\n\n${prompt}` : prompt,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = (await res.json()) as any;
    return { text: data.response || '', provider: 'ollama', model: ENV.OLLAMA_MODEL };
  }
}

// ============================================================
// FACTORY
// ============================================================

function createAIProvider(): IAIProvider {
  switch (ENV.AI_PROVIDER) {
    case 'openai':
      return new OpenAICompatibleProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'gemini':
    default:
      return new GeminiProvider();
  }
}

export const aiProvider = createAIProvider();

// ============================================================
// HELPER: Parse JSON from LLM output (robust)
// ============================================================

export function extractJSON(text: string): any | null {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {}

  // Extract JSON block from markdown
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }
  return null;
}
