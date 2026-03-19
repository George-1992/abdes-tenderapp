'use client';

import { aiRequest } from "@/components/ai/functions/simple";


export default function TestPage({ params, pathname, searchParams, session, user, account }) {

    const handleTest = async () => {
        return;
        const result = await aiRequest({
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'What is the capital of France?' }
            ], 
        });

        console.log('AI Response:', result);
    }
    return (
        <div className="container-main flex flex-col gap-4">
            <h1 className="text-2xl">Test</h1>

            <div className="w-60">
                <button onClick={handleTest} className="w-full btn btn-secondary">
                    Test
                </button>
            </div>
        </div>
    );
}