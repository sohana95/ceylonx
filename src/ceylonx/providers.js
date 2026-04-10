import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

export const PROVIDER_REGISTRY = {
    'Anthropic': { type: 'anthropic', baseURL: null },
    'Google Gemini': { type: 'gemini', baseURL: null },
    'OpenAI': { type: 'openai', baseURL: 'https://api.openai.com/v1' },
    'OpenRouter': { type: 'openai', baseURL: 'https://openrouter.ai/api/v1' },
    'Groq': { type: 'openai', baseURL: 'https://api.groq.com/openai/v1' },
    'Together AI': { type: 'openai', baseURL: 'https://api.together.xyz/v1' },
    'Fireworks AI': { type: 'openai', baseURL: 'https://api.fireworks.ai/inference/v1' },
    'DeepSeek': { type: 'openai', baseURL: 'https://api.deepseek.com' },
    'SiliconFlow': { type: 'openai', baseURL: 'https://api.siliconflow.cn/v1' },
    'Cerebras': { type: 'openai', baseURL: 'https://api.cerebras.ai/v1' },
    'Mistral AI': { type: 'openai', baseURL: 'https://api.mistral.ai/v1' },
    'GitHub Models': { type: 'openai', baseURL: 'https://models.inference.ai.azure.com' },
    'NVIDIA NIM': { type: 'openai', baseURL: 'https://integrate.api.nvidia.com/v1' },
    'HuggingFace': { type: 'openai', baseURL: 'https://api-inference.huggingface.co/models' },
    'Cloudflare AI': { type: 'openai', baseURL: 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1' },
    'Pollinations AI': { type: 'openai', baseURL: 'https://text.pollinations.ai/openai' },
    'Ollama': { type: 'openai', baseURL: 'http://127.0.0.1:11434/v1' }
};

export class BaseProvider {
    constructor(config) {
        this.config = config;
        this.registryEntry = PROVIDER_REGISTRY[config.provider] || { type: 'openai', baseURL: config.baseUrl };
    }

    async testConnection() { throw new Error('Not implemented'); }
    async chat(messages, tools) { throw new Error('Not implemented'); }

    parseToolCallsFromText(text) {
        if (!text) return undefined;
        const allTools = [];
        const xmlRegex = /<function\(([^)]+)\)>([\s\S]*?)<\/function>/g;
        let xmlMatch;
        while ((xmlMatch = xmlRegex.exec(text)) !== null) {
            try {
                allTools.push({ id: `xml_${Math.random().toString(36).slice(2, 11)}`, name: xmlMatch[1], arguments: JSON.parse(xmlMatch[2]) });
            } catch (e) {}
        }
        const markerRegex = /TOOLCALL>([\s\S]*?)>/g;
        let markerMatch;
        while ((markerMatch = markerRegex.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(markerMatch[1]);
                if (Array.isArray(parsed)) allTools.push(...parsed.map(t => ({ id: `marker_${Math.random().toString(36).slice(2, 11)}`, ...t })));
                else allTools.push({ id: `marker_${Math.random().toString(36).slice(2, 11)}`, ...parsed });
            } catch (e) {}
        }
        return allTools.length > 0 ? allTools : undefined;
    }
}

export class OpenAICompatibleProvider extends BaseProvider {
    constructor(config) {
        super(config);
        const baseURL = this.registryEntry.baseURL || config.baseUrl;
        this.client = new OpenAI({ apiKey: config.apiKey, baseURL: baseURL || undefined });
    }

    async testConnection() {
        try {
            await this.client.chat.completions.create({ model: this.config.modelId, messages: [{role:'user', content:'ping'}], max_tokens: 1 });
            return true;
        } catch (e) {
            if (e.status === 401) throw new Error('Invalid API Key');
            throw new Error(e.message);
        }
    }

    async chat(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: this.config.modelId,
            messages,
            tools: tools.map(t => ({ type: 'function', function: t })),
            tool_choice: 'auto'
        });
        const msg = response.choices[0].message;
        let tool_calls = msg.tool_calls?.map(tc => ({ id: tc.id, name: tc.function.name, arguments: JSON.parse(tc.function.arguments) }));
        if (!tool_calls && msg.content) tool_calls = this.parseToolCallsFromText(msg.content);
        return { content: msg.content, tool_calls };
    }
}

export class AnthropicProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.client = new Anthropic({ apiKey: config.apiKey });
    }

    async testConnection() {
        try {
            await this.client.messages.create({ model: this.config.modelId, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] });
            return true;
        } catch (e) { throw new Error(`Anthropic Error: ${e.message}`); }
    }

    async chat(messages, tools) {
        const systemMsg = messages.find(m => m.role === 'system')?.content;
        const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
            if (m.role === 'tool') return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }] };
            if (m.tool_calls) return { role: 'assistant', content: [ ... (m.content ? [{ type: 'text', text: m.content }] : []), ...m.tool_calls.map(tc => ({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments })) ] };
            return m;
        });
        const response = await this.client.messages.create({ model: this.config.modelId, max_tokens: 4096, system: systemMsg, messages: chatMessages, tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })) });
        const textContent = response.content.find(c => c.type === 'text')?.text;
        let tool_calls = response.content.filter(c => c.type === 'tool_use').map(tu => ({ id: tu.id, name: tu.name, arguments: tu.input }));
        if (tool_calls.length === 0 && textContent) tool_calls = this.parseToolCallsFromText(textContent);
        return { content: textContent, tool_calls };
    }
}

export class GeminiProvider extends BaseProvider {
    constructor(config) {
        super(config);
        const genAI = new GoogleGenerativeAI(config.apiKey);
        this.client = genAI.getGenerativeModel({ model: config.modelId });
    }

    async testConnection() {
        try { await this.client.generateContent('ping'); return true; } catch (e) { throw new Error(`Gemini Error: ${e.message}`); }
    }

    async chat(messages, tools) {
        const systemInstruction = messages.find(m => m.role === 'system')?.content;
        const history = messages.filter(m => m.role !== 'system').map(m => {
            if (m.role === 'tool') return { role: 'function', parts: [{ functionResponse: { name: m.name, response: { content: m.content } } }] };
            if (m.tool_calls) return { role: 'model', parts: m.tool_calls.map(tc => ({ functionCall: { name: tc.name, args: tc.arguments } })) };
            return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || ' ' }] };
        });
        const result = await this.client.generateContent({ contents: history, systemInstruction, tools: [{ functionDeclarations: tools }] });
        const response = result.response;
        let tool_calls = response.functionCalls()?.map((c, i) => ({ id: `gemini_${Date.now()}_${i}`, name: c.name, arguments: c.args }));
        let text = response.text ? response.text() : undefined;
        if (!tool_calls && text) tool_calls = this.parseToolCallsFromText(text);
        return { content: text, tool_calls };
    }
}

export class AIProvider {
    constructor(config) {
        const type = PROVIDER_REGISTRY[config.provider]?.type || 'openai';
        if (type === 'anthropic') this.instance = new AnthropicProvider(config);
        else if (type === 'gemini') this.instance = new GeminiProvider(config);
        else this.instance = new OpenAICompatibleProvider(config);
    }
    async chat(messages, tools) { return this.instance.chat(messages, tools); }
    async testConnection() { return this.instance.testConnection(); }
}
