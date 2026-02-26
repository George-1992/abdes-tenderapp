
'use server';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const aiRequest = async ({
    messages,
    model = 'gpt-5',
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
        if (!OPENAI_API_KEY) {
            resObj.message = 'OPENAI_API_KEY is not defined';
            return resObj;
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            resObj.message = 'messages array is required';
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

        let startTimestamp = Date.now();
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

        const result = await response.json();
        let json = null;

        // try to parse result.choices[0].message.content as JSON
        //  if it looks like stringified JSON
        try {
            const content = result.choices[0].message.content;
            if (content.startsWith('{') || content.startsWith('[')) {
                json = JSON.parse(content);
            }
        } catch (e) {
            // ignore JSON parse errors
        }


        resObj.success = true;
        resObj.data = {
            content: result.choices[0].message.content,
            role: result.choices[0].message.role,
            finishReason: result.choices[0].finish_reason,
            usage: result.usage,
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
