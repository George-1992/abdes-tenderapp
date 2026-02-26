'use client';
import { saCreateItem } from "@/actions";
import { aiRequest } from "@/components/aiAgent/functions/simple";
import Loading from "@/components/other/loading";
import { qCreateToken, qGetLink } from "@/components/questions/actions";
import { CheckIcon, CopyIcon, Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react"

export const GetLinkButton = ({ project, contact, className }) => {

    const [_copied, _setCopied] = useState(false);
    const [_baseUrl, _setBaseUrl] = useState('');
    const [_token, _setToken] = useState(null);
    const [_srvLink, _setSrvLink] = useState(null);


    const fetchData = async () => {
        // const token = await qCreateToken({ project });
        // _setToken(token);
        // console.log('Generated token:', token);
        const l = await qGetLink({ project, contact });
        _setSrvLink(l);
    };
    const getLink = () => {
        const link = `${_baseUrl}${_srvLink}`;
        return link;
    }



    useEffect(() => {
        fetchData();

        if (typeof window !== 'undefined') {
            const baseUrl = window.location.origin;
            _setBaseUrl(baseUrl);
        }
    }, [project, contact]);

    // console.log('_token:', _token);

    return (
        <div
            className={`${className} rounded-md bg-gray-50 border border-gray-300 flex items-center text-gray-700 text-sm cursor-pointer hover:bg-gray-100 overflow-hidden ${className}`}
        >
            <button
                className="min-w-8 h-full bg p-1 bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                onClick={async () => {
                    try {
                        const link = getLink();
                        await navigator.clipboard.writeText(link);
                        _setCopied(true);
                        setTimeout(() => _setCopied(false), 1000);
                    } catch (_error) {
                        _setCopied(false);
                    }
                }}
                title={_copied ? 'Link copied!' : 'Copy link'}
            >
                {_copied ? <CheckIcon className="size-4 " /> : <CopyIcon className="size-4" />}
            </button>

            <span className={`p-1 text-sm truncate `}>
                {getLink()}
            </span>

        </div>
    )
}

export const RenderQuestion = ({ project, contact }) => {

    const _preQuestions = Array.isArray(project?.questions) ? project.questions : [];
    const _preQuestions2 = _preQuestions.map(q => ({
        ...q,
        answer: '',
    }));
    const [_question, _setQuestion] = useState(_preQuestions2.slice(0, 25)); // limit to 10 questions for now
    const [_activeQuestionIndex, _setActiveQuestionIndex] = useState(0);
    const [_isLoading, _setIsLoading] = useState(false);
    const [_error, _setError] = useState(null);
    const [_isFinished, _setIsFinished] = useState(false);

    const totalQuestions = Array.isArray(_question) ? _question.length : 0;
    const currentQuestion = totalQuestions > 0 ? _question[_activeQuestionIndex] : null;
    const currentAnswer = currentQuestion?.answer || '';
    const isCurrentAnswered = currentAnswer.trim().length > 0;
    const isLastQuestion = _activeQuestionIndex >= totalQuestions - 1;


    const handleAnswerChange = (value) => {
        _setQuestion((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (!next[_activeQuestionIndex]) return next;
            next[_activeQuestionIndex] = {
                ...next[_activeQuestionIndex],
                answer: value,
            };
            return next;
        });
    };


    const handleNext = async () => {
        try {
            if (!isCurrentAnswered) return;

            if (isLastQuestion) {
                finsh();
                return;
            }

            // _setActiveQuestionIndex((prev) => prev + 1);
            // return;
            _setIsLoading(true);

            const airesponse = await aiRequest({
                messages: [
                    {
                        role: 'system',
                        content: `
                    You are a helpful assistant making sure questions are qualified based on rules.
                    below: 
                    ${project?.qualification_rules}

                    always return parsable json {success: boolean, message: string} with success true if the answer is qualified and false if not, and message with reason if not qualified.
                    `,
                    },
                    {
                        role: 'user',
                        content: `Question:${JSON.stringify(currentQuestion?.question || '')}, Answer:${JSON.stringify(currentAnswer)}`,
                    },
                ],
            });

            // console.log('AI response:', airesponse);
            if (airesponse.success) {
                const json = airesponse?.data?.json;
                if (json && json.success) {
                    _setError(null);
                    _setActiveQuestionIndex((prev) => prev + 1);
                } else {
                    _setError(json?.message || 'Answer not qualified');
                }
            }
        } catch (error) {
            _setError('Error validating answer');
        } finally {
            _setIsLoading(false);
        }
    };

    const finsh = () => {
        try {
            _setIsFinished(true);

            // create submission in DB with 
            saCreateItem({
                collection: 'submissions',
                data: {
                    project_id: project.id,
                    contact_id: contact.id,
                    workspace_id: project.workspace_id,
                    questions: _question
                },
            });
        } catch (error) {
            console.error('Error finishing questionnaire:', error);
        }
    };

    // console.log('Project in RenderQuestion:', project);

    return (
        <div className="w-full h-full px-10 pt-3 pb-10 flex flex-col justify-start items-center bg-gradient-to-r from-green-900 to-sky-800">
            {/* <div className="w-72 h-14 rounded-xl shadow-md border bg-green-800/20 border-green-700/50 flex items-center justify-center text-lg font-medium ">
            </div> */}

            {/* brending */}
            <div className="w-72 h-32 flex flex-col gap-5 items-center justify-center text-gray-400/60" >
                <div className="flex items-start justify-center text-sm">
                    <span>Powered by</span>
                    <span className="mx-1 text-green-700">Tender Master</span>
                </div>
                <Image
                    src="/images/logos/main.png"
                    alt="Coming Soon"
                    width={50}
                    height={50}
                    className="object-contain"
                />
            </div>

            {/* questions */}
            <div className="w-full max-w-3xl ml-10 rounded-xl text-gray-200">
                {totalQuestions > 0 ? (
                    <div className="space-y-4 pt-10">
                        <div className="text-sm text-gray-200/70">
                            Question {_activeQuestionIndex + 1} of {totalQuestions}
                        </div>

                        <div className="text-lg font-medium leading-relaxed">
                            {currentQuestion?.question || '-'}
                        </div>

                        <div className="w-full">
                            <label className="text-sm text-gray-200/80">Your answer</label>
                            <div className="relative w-full min-h-40 rounded-2xl">
                                <textarea
                                    className="form-control block w-full min-h-40 p-3 bg-white/95 text-gray-900 shadow-xl rounded-2xl focus:ring-0 focus:outline-none resize-none slick-scrollbar"
                                    placeholder="Type your answer here..."
                                    value={currentAnswer}
                                    disabled={_isLoading}
                                    onChange={(e) => handleAnswerChange(e.target.value)}
                                />
                                <Loading loading={_isLoading} />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                className="btn btn-secondary w-40 bg-green-100 min-w-28"
                                disabled={!isCurrentAnswered}
                                onClick={handleNext}
                            >
                                {isLastQuestion ? 'Finish' : 'Next'}
                                {_isLoading && <Loader2Icon className="size-4 animate-spin ml-2" />}
                            </button>
                        </div>

                        {/* error */}
                        {_error && (
                            <div className="w-full shadow-lg rounded-2xl p-4 bg-red-100 text-red-700 ">
                                {_error}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-white/70">No questions found.</div>
                )}
            </div>

            {_isFinished && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <h2 className="text-2xl font-semibold text-gray-900">Thank you!</h2>
                        <p className="mt-2 text-gray-600">Your questionnaire has been completed successfully.</p>
                    </div>
                </div>
            )}




        </div>
    )
}