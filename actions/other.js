'use server';

import parseFile from "@/actions/parseFile";
import { aiRequest } from "@/components/aiAgent/functions/simple";
import Prisma from "@/services/prisma";
import _ from "lodash";


export const initFileParsing = async ({ project, medias = [] }) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {
        const _pid = project?.id;
        if (!_pid) {
            console.error('No project ID provided for file parsing initialization');
            resObj.message = 'No project ID provided for file parsing initialization';
            return resObj;
        }
        // console.log('medias: ', medias.length);
        console.log('Project for parsing: ', _pid, project?.name);
        const _project = await Prisma.projects.findUnique({
            where: { id: _pid },
            include: { medias: true }
        });

        if (!_project) {
            console.error('Project not found for parsing with ID:', _pid);
            resObj.message = 'Project not found for parsing';
            return resObj;
        }

        const _medias = _project?.medias || [];
        console.log('Fetched medias for project:', _medias.length);

        // Iterate through each media item and initialize parsing
        for (const media of _medias) {
            const fullUrl = media.url || `${process.env.NEXT_PUBLIC_MEDIA_URL}/${media.s3key}`;
            console.log(`Initializing parsing for media ID ${media.id} at URL: ${fullUrl}`);
            try {
                const response = await parseFile(fullUrl);
                // console.log(response);
                if (response.success) {
                    const text = response.data || '';

                    // update media.content with parsed content
                    // and media.questions with parsed questions if available
                    const mediaRes = await Prisma.medias.update({
                        where: { id: media.id },
                        data: {
                            content: text,
                        }
                    });
                    console.log(`Parsing successful for media ID ${media.id}, text length: ${text.length}`);
                } else {
                    console.error(`Parsing failed for media ID ${media.id}:`, response.message);
                }
            } catch (error) {
                console.error(`Error initializing parsing for media ID ${media.id}:`, error?.message || error);
            }
        }

        initCreatQuestions({ project });

        resObj.success = true;
        resObj.message = 'File parsing initialization completed';
        return resObj;



    } catch (error) {
        console.error('Error parsing file:', error?.message || error);
        resObj.success = false;
        resObj.message = error?.message || 'Failed to parse files';
        return resObj;
    }
};
export const initCreatQuestions = async ({ project }) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {
        console.log('Initializing question generation for project ID:', project?.id);

        const _pid = project?.id;
        if (!_pid) {
            console.error('No project ID provided for question generation');
            resObj.message = 'No project ID provided for question generation';
            return resObj;
        }

        // fetch media again and all medias related to the project
        const _project = await Prisma.projects.findUnique({
            where: { id: _pid },
            include: { medias: true }
        });

        const medias = _project?.medias || [];
        if (medias.length === 0) {
            console.warn(`No media items found for project ID ${_pid}, skipping question generation`);
            resObj.message = 'No media items found for the project to generate questions';
            return resObj;
        }

        const allText = medias.map(m => m.content || '').join('\n');
        if (!allText.trim()) {
            resObj.success = false;
            resObj.message = 'No text content found in media items to generate questions';
            console.warn(`All media items for project ID ${_pid} have empty content, skipping question generation`);
            return resObj;
        }

        console.log(`Generating questions for project ID ${_pid} with ${medias.length} media items, total text length: ${allText.length}`);
        const qFormat = [{
            "id": "uuid-v4 (generate a unique UUID)",
            "question": "string",
            "analysis": "(just leave empty for now) string",
        }];
        const aiResponse = await aiRequest({
            messages: [
                {
                    role: 'system',
                    content: _project.ai_prompt + '\n\n' + `. always return parsable JSON in the format of ${JSON.stringify(qFormat)}, use resources provided in user message to generate questions, only generate questions based on the provided text and do not use any prior knowledge.`,
                },
                {
                    role: 'user',
                    content: `parsed PDF content: ${allText}`
                }
            ],
            // max_tokens: 1500,
        });
        // console.log('AI response for question generation:', aiResponse);

        if (!aiResponse.success) {
            console.error('AI request failed:', aiResponse.message);
            resObj = aiResponse;
        }

        // update project with generated questions
        const generatedQuestions = aiResponse?.data?.json || [];
        console.log(`Generated ${generatedQuestions.length} questions for project ID ${_pid}`);

        await Prisma.projects.update({
            where: { id: _pid },
            data: {
                questions: generatedQuestions,
            }
        });


        resObj.success = true;
        resObj.message = 'Question generation completed';
        resObj.data = generatedQuestions;
        return resObj;

    } catch (error) {
        console.error('Error generating questions:', error?.message || error);
        resObj.success = false;
        resObj.message = error?.message || 'Failed to generate questions';
        return resObj;
    }
};
export const initAnalyzeQuestions = async ({ project }) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {
        console.log('Initializing question analysis for project ID:', project?.id);

        const _pid = project?.id;
        if (!_pid) {
            console.error('No project ID provided for question analysis');
            resObj.message = 'No project ID provided for question analysis';
            return resObj;
        }

        const _project = await Prisma.projects.findUnique({
            where: { id: _pid },
            select: {
                id: true,
                question_analysis_rules: true,
                questions: true,
                medias: true,
                submitions: true,
            }
        });

        if (!_project) {
            console.error('Project not found for question analysis with ID:', _pid);
            resObj.message = 'Project not found for question analysis';
            return resObj;
        }

        const questions = Array.isArray(_project?.questions)
            ? _project.questions
            : [];

        if (questions.length === 0) {
            resObj.success = true;
            resObj.message = 'No questions found to analyze';
            resObj.data = [];
            return resObj;
        }

        const analysisRules = (_project?.question_analysis_rules || '').trim();
        const systemPrompt = analysisRules || 'Analyze the user question and return parsable JSON in format {"analysis":"string"}.';

        const aiTasks = []
        for (const q of questions) {
            aiTasks.push({
                question: q,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: q.question || '',
                    }
                ],
            });
        }

        const aiResponses = await Promise.all(
            aiTasks.map((task) => aiRequest({ messages: task.messages }))
        );

        const analyzedQuestions = aiTasks.map((task, index) => {
            const aiResponse = aiResponses[index];
            const baseQuestion = task.question || {};
            let nextAnalysis = baseQuestion.analysis || '';

            if (aiResponse?.success) {
                const parsed = aiResponse?.data?.json;
                if (typeof parsed === 'string') {
                    nextAnalysis = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    nextAnalysis = parsed.analysis || nextAnalysis;
                }
            }

            return {
                ...baseQuestion,
                analysis: nextAnalysis,
            };
        });

        await Prisma.projects.update({
            where: { id: _pid },
            data: {
                questions: analyzedQuestions,
            }
        });

        resObj.success = true;
        resObj.message = 'Question analysis completed';
        resObj.data = analyzedQuestions;
        return resObj;
    } catch (error) {
        console.error('Error analyzing questions:', error?.message || error);
        resObj.success = false;
        resObj.message = error?.message || 'Failed to analyze questions';
        return resObj;
    }
};

export const initGenerateProposal = async ({ project }) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {
        console.log('Initializing proposal generation for project ID:', project?.id);
        const _pid = project?.id;
        if (!_pid) {
            console.error('No project ID provided for proposal generation');
            resObj.message = 'No project ID provided for proposal generation';
            return resObj;
        }

        const _project = await Prisma.projects.findUnique({
            where: { id: _pid },
            include: {
                medias: true,
                submitions: true
            }
        });
        if (!_project) {
            console.error('Project not found for proposal generation with ID:', _pid);
            resObj.message = 'Project not found for proposal generation';
            return resObj;
        }

        const proposalPrompt = _project.skeleton || 'Based on the project information, generate a proposal draft. Always return parsable JSON in the format {"proposal":"string"}. Use only the provided information and do not use any prior knowledge.';

        const airesponse = await aiRequest({
            messages: [
                {
                    role: 'system',
                    content: proposalPrompt,
                },
                {
                    role: 'user',
                    // content: `Questions: ${JSON.stringify(_project.questions || [])}\n\nMedias: ${JSON.stringify(_project.medias || [])}\n\nSubmitions: ${JSON.stringify(_project.submitions || [])}`,
                    content: `Questions: ${JSON.stringify(_project.questions || [])}}`,
                }
            ],
        });
        if (!airesponse.success) {
            console.error('AI request failed for proposal generation:', airesponse.message);
            resObj = airesponse;
            return resObj;
        }

        // save proposal to project
        const proposal = airesponse?.data?.content || '';
        await Prisma.projects.update({
            where: { id: _pid },
            data: {
                proposal_result: proposal,
            }
        });

        resObj.success = true;
        resObj.message = 'Proposal generation completed';
        return resObj;
    }
    catch (error) {
        console.error('Error generating proposal:', error?.message || error);
        resObj.success = false;
        resObj.message = error?.message || 'Failed to generate proposal';
        return resObj;
    }
};