
'use server';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const MAIN_MODEL = process.env.MAIN_MODEL || 'gpt-5.4';

const isAnthropicModel = (model = '') => {
    const m = String(model).toLowerCase();
    return m.startsWith('claude') || m.includes('anthropic/');
};

const normalizeToAnthropicMessages = (messages = []) => {
    const systemMessages = [];
    const chatMessages = [];

    for (const message of messages) {
        const role = message?.role;
        const content = message?.content;
        const textContent = Array.isArray(content)
            ? content.map((item) => (typeof item === 'string' ? item : item?.text || '')).join('\n')
            : String(content || '');

        if (role === 'system') {
            if (textContent) {
                systemMessages.push(textContent);
            }
            continue;
        }

        chatMessages.push({
            role: role === 'assistant' ? 'assistant' : 'user',
            content: textContent,
        });
    }

    return {
        system: systemMessages.join('\n\n'),
        messages: chatMessages,
    };
};

export const aiRequest = async ({
    messages,
    model = MAIN_MODEL,
    temperature = 1,
    maxTokens = null,
    responseFormat = null
}) => {
    let resObj = {
        success: false,
        message: '',
        data: null
    };


    // console.log('OPENAI_API_KEY: ', OPENAI_API_KEY);
    // console.log('OPENAI_API_URL: ', OPENAI_API_URL);


    try {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            resObj.message = 'messages array is required';
            return resObj;
        }

        const useAnthropic = isAnthropicModel(model);
        let startTimestamp = Date.now();
        let result = null;

        if (useAnthropic) {
            if (!ANTHROPIC_API_KEY) {
                resObj.message = 'ANTHROPIC_API_KEY is not defined';
                return resObj;
            }

            console.log(`Sending request to Anthropic (${model})...`);

            const normalized = normalizeToAnthropicMessages(messages);
            const requestBody = {
                model,
                messages: normalized.messages,
                temperature,
                max_tokens: maxTokens || 4096,
            };

            if (normalized.system) {
                requestBody.system = normalized.system;
            }

            const response = await fetch(ANTHROPIC_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Anthropic API error:', errorData);
                resObj.message = errorData.error?.message || `Anthropic API error: ${response.statusText}`;
                return resObj;
            }

            console.log('Anthropic request completed successfully');
            result = await response.json();
        } else {
            if (!OPENAI_API_KEY) {
                resObj.message = 'OPENAI_API_KEY is not defined';
                return resObj;
            }

            console.log(`Sending request to OpenAI (${model})...`);

            const requestBody = {
                model,
                messages,
                temperature,
            };

            if (maxTokens) {
                requestBody.max_tokens = maxTokens;
            }

            if (responseFormat) {
                requestBody.response_format = responseFormat;
            }

            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('OpenAI API error:', errorData);
                resObj.message = errorData.error?.message || `OpenAI API error: ${response.statusText}`;
                return resObj;
            }

            console.log('OpenAI request completed successfully');
            result = await response.json();
        }

        const content = useAnthropic
            ? (result.content || [])
                .filter((item) => item?.type === 'text')
                .map((item) => item.text)
                .join('\n')
            : result.choices[0].message.content;

        let json = null;

        // Try to parse model output as JSON when it looks like JSON text.
        try {
            if (content.startsWith('{') || content.startsWith('[')) {
                json = JSON.parse(content);
            }
        } catch (e) {
            // ignore JSON parse errors
        }


        resObj.success = true;
        resObj.data = {
            content,
            role: useAnthropic ? result.role || 'assistant' : result.choices[0].message.role,
            finishReason: useAnthropic ? result.stop_reason : result.choices[0].finish_reason,
            usage: result.usage || null,
            model: result.model,
            json: json,
            responseTimeMs: Date.now() - startTimestamp,
        };
        resObj.message = 'Request completed';

        return resObj;
    } catch (error) {
        console.error('Error in chatCompletion:', error);
        resObj.success = false;
        resObj.message = error.message || 'Request failed';
        return resObj;
    }
}; 
