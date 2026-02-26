'use client';

import { saCreateItem, saGetItem, saGetItems, saUpdateItem, saDeleteItem, saDeleteItems } from "@/actions";
import { notify } from "@/components/sonnar/sonnar";
import { ExpandableModal, PopupModal } from "@/components/other/modals";
import Table from "@/components/table";
import { cloneDeep, includes } from "lodash";
import { useState, useEffect } from "react";
import FormBuilder from "@/components/formBuilder";
import FileUploader from "@/components/formBuilder/fileUploader";
import { defaults } from "@/data/defaults";
import { nanoid } from "nanoid";
import { DownloadIcon, FlaskConicalIcon, RotateCcwIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import Select from "@/components/select";
import parseFile from "@/actions/parseFile";
import { initAnalyzeQuestions, initCreatQuestions, initFileParsing, initGenerateProposal } from "@/actions/other";
import Collapse from "@/components/other/collapse";
import { GetLinkButton } from "@/components/questions/parts";
import { qGetLink } from "@/components/questions/actions";
import CopyEl from "@/components/other/copyEl";
import { Toggle } from "@/components/other/toggle";

export default function Projects({ pathname, user, account, session, workspace }) {

    const wId = workspace?.id || null;
    const collectionName = 'projects';
    const [_isLoading, _setIsLoading] = useState(true);
    const [_data, _setData] = useState([]);
    const [_page, _setPage] = useState({
        skip: 0,
        take: 10,
        itemsPerPage: 10,
        total: 0
    });
    const [_editItem, _setEditItem] = useState(null);
    const [_uploadedFiles, _setUploadedFiles] = useState([]);
    const [_participantsProject, _setParticipantsProject] = useState(null);
    const [_workspaceContacts, _setWorkspaceContacts] = useState([]);
    const [_participantsLoading, _setParticipantsLoading] = useState(false);
    const [_selectedParticipantId, _setSelectedParticipantId] = useState('');
    const [_baseUrl, _setBaseUrl] = useState('');

    const fetchProjectDetails = async (projectId) => {
        try {
            const response = await saGetItem({
                collection: collectionName,
                query: {
                    where: { id: projectId },
                    include: {
                        medias: true,
                        contacts: true,
                    }
                }
            });

            if (response && response.success) {
                return response.data;
            }

            notify({ type: 'error', message: response?.message || 'Failed to fetch project details' });
            return null;
        } catch (error) {
            console.error('Error fetching project details: ', error);
            notify({ type: 'error', message: 'Failed to fetch project details' });
            return null;
        }
    };

    const loadWorkspaceContacts = async () => {
        try {
            _setParticipantsLoading(true);
            const response = await saGetItems({
                collection: 'contacts',
                query: {
                    where: {
                        workspace_id: workspace ? workspace.id : null
                    },
                    orderBy: {
                        created_at: 'desc'
                    },
                    take: 500,
                }
            });

            if (response && response.success) {
                _setWorkspaceContacts(response.data || []);
            } else {
                notify({ type: 'error', message: response.message || 'Failed to fetch contacts' });
            }
        } catch (error) {
            console.error('Error fetching contacts: ', error);
            notify({ type: 'error', message: 'Failed to fetch contacts' });
        } finally {
            _setParticipantsLoading(false);
        }
    };

    const openParticipantsModal = async (project) => {
        _setParticipantsLoading(true);
        try {
            const [projectDetails] = await Promise.all([
                fetchProjectDetails(project.id),
                loadWorkspaceContacts(),
            ]);

            if (!projectDetails) return;
            const inviteLinkBase = await qGetLink({ project: projectDetails });
            // console.log('Invite link base: ', inviteLinkBase);
            _setSelectedParticipantId('');
            _setParticipantsProject({
                ...projectDetails,
                inviteLinkBase: inviteLinkBase,
                contacts: Array.isArray(projectDetails?.contacts) ? projectDetails.contacts : []
            });
        } finally {
            _setParticipantsLoading(false);
        }
    };

    const addParticipant = async (contact) => {
        if (!_participantsProject?.id || !contact?.id) return;
        try {
            _setParticipantsLoading(true);
            const response = await saUpdateItem({
                collection: 'contacts',
                query: {
                    where: { id: contact.id },
                    data: { project_id: _participantsProject.id },
                }
            });

            if (!response || !response.success) {
                notify({ type: 'error', message: response?.message || 'Failed to add participant' });
                return;
            }

            const updatedContact = response.data;
            _setWorkspaceContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
            _setParticipantsProject(prev => {
                if (!prev) return prev;
                const prevContacts = Array.isArray(prev.contacts) ? prev.contacts : [];
                const exists = prevContacts.find(c => c.id === updatedContact.id);
                return {
                    ...prev,
                    contacts: exists ? prevContacts : [...prevContacts, updatedContact]
                };
            });

            _setData(prev => prev.map(project => {
                if (project.id !== _participantsProject.id) return project;
                const nextCount = (project?._count?.contacts || 0) + 1;
                return {
                    ...project,
                    _count: {
                        ...(project?._count || {}),
                        contacts: nextCount,
                    }
                };
            }));

            notify({ type: 'success', message: 'Participant added successfully' });
            _setSelectedParticipantId('');
        } catch (error) {
            console.error('Error adding participant: ', error);
            notify({ type: 'error', message: error.message || 'Failed to add participant' });
        } finally {
            _setParticipantsLoading(false);
        }
    };


    const removeParticipant = async (contact) => {
        if (!_participantsProject?.id || !contact?.id) return;
        try {
            _setParticipantsLoading(true);
            const response = await saUpdateItem({
                collection: 'contacts',
                query: {
                    where: { id: contact.id },
                    data: { project_id: null },
                }
            });

            if (!response || !response.success) {
                notify({ type: 'error', message: response?.message || 'Failed to remove participant' });
                return;
            }

            const updatedContact = response.data;
            _setWorkspaceContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
            _setParticipantsProject(prev => {
                if (!prev) return prev;
                const prevContacts = Array.isArray(prev.contacts) ? prev.contacts : [];
                return {
                    ...prev,
                    contacts: prevContacts.filter(c => c.id !== updatedContact.id)
                };
            });

            _setData(prev => prev.map(project => {
                if (project.id !== _participantsProject.id) return project;
                const nextCount = Math.max((project?._count?.contacts || 1) - 1, 0);
                return {
                    ...project,
                    _count: {
                        ...(project?._count || {}),
                        contacts: nextCount,
                    }
                };
            }));

            notify({ type: 'success', message: 'Participant removed successfully' });
        } catch (error) {
            console.error('Error removing participant: ', error);
            notify({ type: 'error', message: error.message || 'Failed to remove participant' });
        } finally {
            _setParticipantsLoading(false);
        }
    };

    const handleAddSelectedParticipant = async () => {
        if (!_selectedParticipantId) return;
        const contact = _workspaceContacts.find(c => c.id === _selectedParticipantId);
        if (!contact) {
            notify({ type: 'error', message: 'Selected contact not found' });
            return;
        }
        await addParticipant(contact);
    };

    const buildContactInviteLink = (contactId) => {
        const inviteLinkBase = _participantsProject?.inviteLinkBase || '';
        if (!inviteLinkBase || !contactId) return '';

        const [pathPart, queryPart = ''] = inviteLinkBase.split('?');
        const searchParams = new URLSearchParams(queryPart);
        searchParams.set('contact_id', contactId);

        const relativeLink = `${pathPart}?${searchParams.toString()}`;
        if (/^https?:\/\//i.test(relativeLink)) {
            return relativeLink;
        }

        return _baseUrl ? `${_baseUrl}${relativeLink}` : relativeLink;
    };

    const updateItem = async ({ item, action }) => {
        let resObj = {
            success: false,
            message: 'Unknown error',
            data: null,
        }
        try {
            _setIsLoading(true);

            let toSaveData = cloneDeep(item);
            toSaveData.workspace_id = wId;

            ['contacts', 'workspace', '_count', '_originalMedias'].forEach(relKey => {
                if (toSaveData.hasOwnProperty(relKey)) {
                    delete toSaveData[relKey];
                }
            });

            // if (toSaveData.medias !== undefined && !Array.isArray(toSaveData.medias)) {
            //     notify({ type: 'error', message: 'Invalid medias format' });
            //     return {
            //         success: false,
            //         message: 'Invalid medias format',
            //         data: item,
            //     };
            // }

            let response;

            if (action === 'create') {
                response = await saCreateItem({
                    collection: collectionName,
                    data: toSaveData,
                    include: {
                        medias: true,
                        contacts: true,
                    }
                });

                if (response && response.success) {
                    let newData = [..._data];
                    newData.unshift(response.data);
                    _setData(newData);
                    notify({ type: 'success', message: 'Project created successfully' });
                    resObj.success = true;
                    resObj.data = response.data;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to create project' });
                    resObj.success = false;
                    resObj.message = response.message || 'Failed to create project';
                }
            } else if (action === 'update') {
                response = await saUpdateItem({
                    collection: collectionName,
                    query: {
                        where: { id: item.id },
                        data: toSaveData,
                        include: {
                            medias: true,
                            contacts: true,
                        }
                    }
                });

                if (response && response.success) {
                    _setData(prev => prev.map(i => i.id === item.id ? response.data : i));
                    notify({ type: 'success', message: 'Project updated successfully' });
                    resObj.success = true;
                    resObj.data = response.data;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to update project' });
                    resObj.success = false;
                    resObj.message = response.message || 'Failed to update project';
                }
            } else if (action === 'delete') {
                response = await saDeleteItem({
                    collection: collectionName,
                    query: {
                        where: { id: item.id }
                    }
                });

                if (response && response.success) {
                    _setData(prev => prev.filter(i => i.id !== item.id));
                    notify({ type: 'success', message: 'Project deleted successfully' });
                    resObj.success = true;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to delete project' });
                    resObj.success = false;
                    resObj.message = response.message || 'Failed to delete project';
                }
            }

            return resObj;
        } catch (error) {
            console.error(`Error ${action}ing project: `, error);
            notify({ type: 'error', message: error.message || `Failed to ${action} project` });
            resObj.success = false;
            resObj.message = error.message || `Failed to ${action} project`;
            resObj.data = item;
            return resObj;
        } finally {
            _setIsLoading(false);
        }
    };

    const fetchData = async (thisPage = _page) => {
        try {
            _setIsLoading(true);
            const response = await saGetItems({
                collection: collectionName,
                includeCount: true,
                query: {
                    where: {
                        workspace_id: workspace ? workspace.id : null
                    },
                    orderBy: {
                        created_at: 'desc'
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        ai_prompt: true,
                        qualification_rules: true,
                        created_at: true,
                        updated_at: true,
                        questions: true,
                        workspace_id: true,
                        _count: {
                            select: {
                                medias: true,
                                contacts: true,
                                submitions: true,
                            }
                        }
                    },
                    skip: thisPage.skip,
                    take: thisPage.take,
                }
            });

            if (response && response.success) {
                _setData(response.data || []);
                if (!_page.total) {
                    _setPage(prev => ({
                        ...prev,
                        total: response.count || response.data.length || 0
                    }));
                }
            } else {
                notify({ type: 'error', message: response.message || `Failed to fetch ${collectionName}` });
            }

        } catch (error) {
            console.error(`Error fetching ${collectionName}: `, error);
        } finally {
            _setIsLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        _setPage(newPage);
        fetchData(newPage);
    };

    const onBulkAction = async ({ action, items }) => {
        let resObj = {
            success: false,
            message: 'Unknown error',
            data: null,
        }
        try {

            let thisResponse = null;
            if (action === 'delete') {
                thisResponse = await saDeleteItems({
                    collection: collectionName,
                    query: {
                        where: {
                            id: {
                                in: items.map(i => i.id)
                            }
                        }
                    }
                });

                if (thisResponse && thisResponse.success) {
                    _setData(prev => prev.filter(i => !items.find(it => it.id === i.id)));
                    notify({ type: 'success', message: 'Items deleted successfully' });
                    resObj.success = true;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: thisResponse.message || 'Failed to delete items' });
                    resObj.success = false;
                    resObj.message = thisResponse.message || 'Failed to delete items';
                }
            }

            return resObj;

        } catch (error) {
            console.error('Error in onBulkAction: ', error);
            notify({ type: 'error', message: 'Bulk action failed' });
            resObj.success = false;
            resObj.message = error.message || 'Bulk action failed';
            return resObj;
        }
    };

    const handleEditSubmit = async (item) => {
        const details = await fetchProjectDetails(item.id);
        if (!details) return;
        _setEditItem({
            ...details,
            medias: Array.isArray(details?.medias) ? details.medias : [],
            _originalMedias: Array.isArray(details?.medias) ? details.medias : []
        });
    };

    const handleNewItemClick = () => {
        _setEditItem({
            name: '',
            status: 'active',
            ai_prompt: defaults.ai_prompt.trim(),
            qualification_rules: '',
            question_analysis_rules: '',
            skeleton: defaults.skeleton.trim(),
            proposal_result: '',
            medias: [],
            _originalMedias: [],
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        const currentMedias = (Array.isArray(_editItem?.medias) ? _editItem.medias : [])
            .filter((m) => m && m.s3key);
        const originalMedias = Array.isArray(_editItem?._originalMedias) ? _editItem._originalMedias : [];

        const uniqueCurrentMedias = [];
        const seenS3Keys = new Set();
        currentMedias.forEach((media) => {
            if (!seenS3Keys.has(media.s3key)) {
                seenS3Keys.add(media.s3key);
                uniqueCurrentMedias.push(media);
            }
        });

        const createdMedias = uniqueCurrentMedias
            .filter((media) => !media.id)
            .map((media) => ({ s3key: media.s3key }));

        const removedMediaIds = originalMedias
            .filter((media) => media?.id && !uniqueCurrentMedias.some((curr) => curr.id === media.id))
            .map((media) => media.id);

        const mediasOps = {};
        if (_editItem?.id) {
            if (createdMedias.length > 0) {
                mediasOps.create = createdMedias;
            }
            if (removedMediaIds.length > 0) {
                mediasOps.deleteMany = {
                    id: {
                        in: removedMediaIds,
                    }
                };
            }
        } else if (uniqueCurrentMedias.length > 0) {
            mediasOps.create = uniqueCurrentMedias.map((media) => ({ s3key: media.s3key }));
        }

        const nextItem = {
            ..._editItem,
        };

        delete nextItem.medias;
        if (Object.keys(mediasOps).length > 0) {
            nextItem.medias = mediasOps;
        }

        console.log('Submitting item: ', nextItem);
        let dbResult = null;
        // return;
        if (nextItem.id) {
            dbResult = await updateItem({ item: nextItem, action: 'update' });
        } else {
            dbResult = await updateItem({ item: nextItem, action: 'create' });
        }

        // console.log('dbResult: ', dbResult);

        if (dbResult.success) {

            _setEditItem(null);
            _setUploadedFiles([]);

            if (_uploadedFiles) {
                const _pid = dbResult.data?.id;
                initFileParsing({
                    project: { id: _pid },
                });
            }
        } else {
            notify({ type: 'error', message: dbResult.message || 'Failed to save project' });
            console.error('Error saving project: ', dbResult);
        }


    };
    const handleFileUpload = (files) => {
        // console.log('Files uploaded: ', files);
        // add to the _editItem.medias
        const existingMedias = Array.isArray(_editItem?.medias) ? _editItem.medias : [];
        const newMedias = [];
        files.forEach((key) => {
            if (!includes(existingMedias, key)) {
                newMedias.push({
                    s3key: key,
                });
            }
        });

        _setUploadedFiles(files);

        _setEditItem(prev => ({
            ...prev,
            medias: [...existingMedias, ...newMedias]
        }));
    };
    const handleFileRemove = (media) => {
        const existingMedias = Array.isArray(_editItem?.medias) ? _editItem.medias : [];
        _setEditItem(prev => ({
            ...prev,
            medias: existingMedias.filter(m => m.s3key !== media.s3key)
        }));
    };

    const regenrateQuestions = async () => {
        try {
            initCreatQuestions({
                project: { id: _editItem.id }
            });
            notify({ type: 'success', message: 'Question regeneration initiated, it may take a while to complete' });
        } catch (error) {
            console.error('Error regenerating questions: ', error);
            notify({ type: 'error', message: 'Failed to regenerate questions' });
        }
    };

    const analyzeQuestions = async () => {
        try {
            initAnalyzeQuestions({
                project: { id: _editItem.id }
            });
            notify({ type: 'success', message: 'Question analysis initiated, it may take a while to complete' });
        } catch (error) {
            console.error('Error analyzing questions: ', error);
            notify({ type: 'error', message: 'Failed to analyze questions' });
        }
    };

    const generateProposal = async () => {
        initGenerateProposal({
            project: { id: _editItem.id }
        });
        notify({ type: 'success', message: 'Proposal generation initiated, it may take a while to complete' });
    };

    const downloadQuestionsCsv = () => {
        const questions = Array.isArray(_editItem?.questions) ? _editItem.questions : [];
        if (questions.length === 0) {
            notify({ type: 'error', message: 'No questions found to export' });
            return;
        }

        const escapeCsv = (value) => {
            const text = value === null || value === undefined ? '' : String(value);
            return `"${text.replace(/"/g, '""')}"`;
        };

        const headers = ['question_number', 'question', 'analysis'];
        const rows = questions.map((qItem, idx) => [
            idx + 1,
            qItem?.question || '',
            qItem?.analysis || '',
        ]);

        const csvLines = [
            headers.map(escapeCsv).join(','),
            ...rows.map((row) => row.map(escapeCsv).join(',')),
        ];

        const csvContent = csvLines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const safeName = (_editItem?.name || 'project')
            .replace(/[^a-zA-Z0-9-_]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'project';

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${safeName}_questions.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };


    useEffect(() => {
        fetchData();
        if (typeof window !== 'undefined') {
            const baseUrl = window?.location?.origin || '';
            _setBaseUrl(baseUrl);
        }
    }, []);


    // console.log('_editItem: ', _editItem);
    return (
        <div className="container-main flex flex-col gap-4">
            <h1 className="text-2xl">Projects</h1>

            <div className="w-full">
                <Table
                    className=""
                    editable={true}
                    sortable={true}
                    paginated={true}
                    page={_page}
                    onPageChange={handlePageChange}
                    previewKey=""
                    data={_data}
                    onAddNew={handleNewItemClick}
                    onRowChange={(item) => updateItem({ item, action: 'update' })}
                    onRowDelete={(item) => updateItem({ item, action: 'delete' })}
                    onBulkAction={onBulkAction}
                    actions={[
                        {
                            name: 'edit',
                            onlyCallback: true,
                            func: handleEditSubmit
                        },
                        {
                            name: 'participants',
                            Icon: UsersIcon,
                            tooltipText: 'Participants',
                            onlyCallback: true,
                            func: openParticipantsModal,
                        },
                        {
                            name: 'delete',
                            confirm: {
                                title: 'Confirm Deletion',
                                message: 'Are you sure you want to delete this project?',
                                button1: 'Cancel',
                                button2: 'Delete',
                            },
                            func: (item) => updateItem({ item, action: 'delete' })
                        }
                    ]}
                    columns={[
                        {
                            key: 'name',
                            title: 'Name',
                            width: 'w-44',
                            required: true,
                            validateKey: 'length',
                        },
                        {
                            key: 'status',
                            title: 'Status',
                            width: 'w-24',
                            Component: (props) => {
                                const status = props?.value || 'active';
                                const isActive = status === 'active';
                                return (
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                        {status}
                                    </span>
                                );
                            }
                        },
                        {
                            key: 'ai_prompt',
                            title: 'AI Prompt',
                            width: 'w-72',
                            type: 'textarea',
                            Component: (props) => {
                                if (!props.value) return <span className="text-gray-400">No prompt</span>;
                                const truncated = props.value.length > 30 ? props.value.substring(0, 30) + '...' : props.value;
                                return <span className="text-sm text-gray-700">{truncated}</span>;
                            }
                        },
                        // {
                        //     key: 'qualification_rules',
                        //     title: 'Qualification Rules',
                        //     width: 'w-72',
                        //     type: 'textarea',
                        //     Component: (props) => {
                        //         if (!props.value) return <span className="text-gray-400">No qualification rules</span>;
                        //         const truncated = props.value.length > 30 ? props.value.substring(0, 30) + '...' : props.value;
                        //         return <span className="text-sm text-gray-700">{truncated}</span>;
                        //     }
                        // },
                        {
                            key: 'medias',
                            title: 'Medias',
                            width: 'w-24',
                            editable: false,
                            Component: (props) => {
                                const count = props?.row?._count?.medias || 0;
                                return <span className="text-sm text-gray-700">{count}</span>;
                            }
                        },
                        {
                            key: 'questions',
                            title: 'Questions',
                            width: 'w-24',
                            editable: false,
                            Component: (props) => {
                                // console.log('props: ', props);
                                const value = props?.value;
                                if (Array.isArray(value)) {
                                    return <span className="text-sm text-gray-700">{value.length}</span>;
                                }

                                if (typeof value === 'string') {
                                    try {
                                        const parsed = JSON.parse(value);
                                        const count = Array.isArray(parsed) ? parsed.length : 0;
                                        return <span className="text-sm text-gray-700">{count}</span>;
                                    } catch (_error) {
                                        return <span className="text-sm text-gray-700">0</span>;
                                    }
                                }

                                return <span className="text-sm text-gray-700">0</span>;
                            }
                        },
                        {
                            key: 'contacts',
                            title: 'Participants',
                            width: 'w-24',
                            editable: false,
                            Component: (props) => {
                                const count = props?.row?._count?.contacts || 0;
                                return <span className="text-sm text-gray-700">{count}</span>;
                            }
                        },
                        {
                            key: 'submitions',
                            title: 'Submitions',
                            width: 'w-24',
                            editable: false,
                            Component: (props) => {
                                const count = props?.row?._count?.submitions || 0;
                                return <span className="text-sm text-gray-700">{count}</span>;
                            }
                        },
                    ]}
                />
            </div>

            {
                _editItem && <ExpandableModal isOpen={true} onClose={() => _setEditItem(null)}  >
                    <form className="w-full h-full flex flex-col gap-4" onSubmit={handleFormSubmit}>
                        <div className="w-32 absolute -top-7 right-0 mr-8 mt-10 flex justify-between items-center ">
                            <button
                                className="btn w-full"
                                type="submit"
                            >
                                Save
                            </button>
                        </div>
                        <div className="w-full h-full overflow-auto p-4 space-y-4">
                            <Collapse title="Details" defaultOpen={true} className="bg-white" contentClassName="pt-3 space-y-3">
                                <div>
                                    <label htmlFor="">Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={_editItem.name}
                                        required={true}
                                        onChange={(e) => _setEditItem(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="">Status</label>
                                    <div className="mt-2 flex items-center gap-3">
                                        <Toggle
                                            checked={(_editItem?.status || 'active') === 'active'}
                                            onChange={(checked) => {
                                                _setEditItem(prev => ({
                                                    ...prev,
                                                    status: checked ? 'active' : 'inactive'
                                                }));
                                            }}
                                        />
                                        <span className="text-sm text-gray-600 capitalize">{_editItem?.status || 'active'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="">AI Prompt</label>
                                    <textarea
                                        type="text"
                                        className="form-control h-40"
                                        value={_editItem.ai_prompt}
                                        required={false}
                                        onChange={(e) => _setEditItem(prev => ({ ...prev, ai_prompt: e.target.value }))}
                                    />
                                </div>

                            </Collapse>
                            <Collapse defaultOpen={true} title={`Medias ${Array.isArray(_editItem?.medias) ? `(${_editItem.medias.length})` : '(0)'}`} className="bg-white" contentClassName="pt-3 space-y-3">
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    {Array.isArray(_editItem.medias) && _editItem.medias.length > 0 ? (
                                        <ul className="space-y-2">
                                            {_editItem.medias.map((media, index) => (
                                                <li key={index} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
                                                    <span className="truncate text-sm text-gray-700">{media.s3key}</span>
                                                    <div className="flex items-center gap-5">
                                                        <Link
                                                            href={`${process.env.NEXT_PUBLIC_MEDIA_URL}/${media.s3key}`}
                                                            target="_blank"
                                                            className=" text-blue-400 hover:text-blue-300"
                                                        >
                                                            View File
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="rounded-md border border-red-200 px-2 py-1 font-medium text-red-600 hover:bg-red-50"
                                                            onClick={() => {
                                                                handleFileRemove(media);
                                                            }}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-sm text-gray-400">No medias uploaded</span>
                                    )}
                                </div>
                                {_editItem && _editItem.medias.length === 0 &&
                                    <div>
                                        <FileUploader
                                            accept={['.pdf', '.doc', '.docx']}
                                            showFiles={false}
                                            multiple={true}
                                            uploadToS3={true}
                                            onFiles={(_tfiles) => {
                                                handleFileUpload(_tfiles);
                                            }}
                                        />
                                    </div>
                                }
                            </Collapse>
                            <Collapse title={`Questions ${Array.isArray(_editItem?.questions) ? `(${_editItem.questions.length})` : '(0)'}`} className="bg-white" contentClassName="pt-3">
                                <div className="flex gap-3 justify-end">
                                    <button
                                        className="btn btn-secondary w-44 mb-1"
                                        type="button"
                                        onClick={downloadQuestionsCsv}
                                    >
                                        <DownloadIcon className="w-4 h-4 mr-1" />
                                        Download CSV
                                    </button>
                                    <button
                                        className="btn btn-secondary w-44 mb-1"
                                        type="button"
                                        onClick={analyzeQuestions}
                                    >
                                        <FlaskConicalIcon className="w-4 h-4 mr-1" />
                                        Analyze Questions
                                    </button>
                                    <button
                                        className="btn btn-secondary w-44 mb-1"
                                        type="button"
                                        onClick={regenrateQuestions}
                                    >
                                        <RotateCcwIcon className="w-4 h-4 mr-1" />
                                        Regenerate Questions
                                    </button>
                                </div>
                                <div>
                                    <label htmlFor="">Question Analysis Rules</label>
                                    <textarea
                                        type="text"
                                        className="form-control h-40"
                                        value={_editItem.question_analysis_rules || ''}
                                        onChange={(e) => _setEditItem(prev => ({ ...prev, question_analysis_rules: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="">Question Qualification Rules</label>
                                    <textarea
                                        type="text"
                                        className="form-control h-40"
                                        value={_editItem.qualification_rules || ''}
                                        required={false}
                                        onChange={(e) => _setEditItem(prev => ({ ...prev, qualification_rules: e.target.value }))}
                                    />
                                </div>

                                {Array.isArray(_editItem?.questions) && _editItem.questions.length > 0 ? (
                                    <div className="space-y-3">
                                        {_editItem.questions.map((qItem, idx) => (
                                            <div key={idx} className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
                                                <div className="text-xs text-gray-500">Question #{idx + 1}</div>
                                                <div>
                                                    <div className="text-sm text-gray-400">{qItem?.question || '-'}</div>
                                                    <span className="text-xs">Analysis:</span>
                                                    <textarea
                                                        className="form-control mt-2 h-12 text-sm text-gray-600"
                                                        placeholder="Analysis"
                                                        value={qItem?.analysis || ''}
                                                        onChange={(e) => {
                                                            const nextAnalysis = e.target.value;
                                                            _setEditItem((prev) => {
                                                                const prevQuestions = Array.isArray(prev?.questions) ? prev.questions : [];
                                                                const nextQuestions = [...prevQuestions];
                                                                const targetQuestion = nextQuestions[idx] || {};
                                                                nextQuestions[idx] = {
                                                                    ...targetQuestion,
                                                                    analysis: nextAnalysis,
                                                                };
                                                                return {
                                                                    ...prev,
                                                                    questions: nextQuestions,
                                                                };
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400">No questions found.</div>
                                )}
                            </Collapse>
                            <Collapse title="Proposal" className="bg-white" contentClassName="pt-3 space-y-3">
                                <div className="flex gap-3 justify-end">

                                    <button
                                        className="btn btn-secondary w-44 mb-1"
                                        type="button"
                                        onClick={generateProposal}
                                    >
                                        <FlaskConicalIcon className="w-4 h-4 mr-1" />
                                        Generate Proposal
                                    </button>

                                </div>
                                <div>
                                    <label htmlFor="">Proposal Skeleton</label>
                                    <textarea
                                        type="text"
                                        className="form-control h-40"
                                        value={_editItem.skeleton || ''}
                                        required={true}
                                        onChange={(e) => _setEditItem(prev => ({ ...prev, skeleton: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="">Proposal Result</label>
                                    <textarea
                                        type="text"
                                        className="form-control h-40"
                                        value={_editItem.proposal_result || ''}
                                        onChange={(e) => _setEditItem(prev => ({ ...prev, proposal_result: e.target.value }))}
                                    />
                                </div>
                            </Collapse>
                        </div>
                        <div className="h-20 md:h-30"></div>
                    </form>
                </ExpandableModal>
            }

            {
                _participantsProject && <ExpandableModal isOpen={true} onClose={() => _setParticipantsProject(null)}>
                    <div className="w-full h-full p-4 flex flex-col gap-4">
                        <div className="flex justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold">Participants</h2>
                                <p className="text-sm text-gray-500">Project: {_participantsProject.name}</p>

                            </div>
                            <div className="flex items-center gap-2">

                                <button
                                    className="btn btn-primary"
                                    onClick={() => { }}
                                >

                                    Sends Invite Emails
                                </button>
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <h3 className="font-medium mb-3">Add Participant</h3>
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={_selectedParticipantId}
                                        onChange={(e) => _setSelectedParticipantId(e.target.value)}
                                        options={(_workspaceContacts || [])
                                            .filter((contact) => !(_participantsProject.contacts || []).find(p => p.id === contact.id))
                                            .map((contact) => ({
                                                value: contact.id,
                                                label: `${[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '-'} (${contact.email || contact.phone || 'no contact'})`
                                            }))}
                                        placeholder="Select contact to add"
                                        searchable={true}
                                        clearable={true}
                                        disabled={_participantsLoading}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAddSelectedParticipant}
                                    disabled={_participantsLoading || !_selectedParticipantId}
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 overflow-auto">
                            <h3 className="font-medium mb-2">Participants</h3>
                            {Array.isArray(_participantsProject.contacts) && _participantsProject.contacts.length > 0 ? (
                                <div className="space-y-2">
                                    {_participantsProject.contacts.map((contact) => (
                                        <div key={contact.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '-'}</p>
                                                <p className="text-xs text-gray-500 truncate">{contact.email || contact.phone || '-'}</p>
                                            </div>



                                            <div className="flex items-end gap-2">
                                                {/* <CopyEl
                                                    title="Copy invite link"
                                                    className="w-10 h-8 flex justify-center items-center"
                                                    contents={buildContactInviteLink(contact.id)}
                                                /> */}
                                                <GetLinkButton
                                                    className={'w-72 h-8'}
                                                    project={{ id: _participantsProject.id }}
                                                    contact={{ id: contact.id }}
                                                />

                                                <button
                                                    type="button"
                                                    className="h-8 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                                    onClick={() => removeParticipant(contact)}
                                                    disabled={_participantsLoading}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-400">No participants added yet.</div>
                            )}
                        </div>
                    </div>
                </ExpandableModal>
            }
        </div >
    );
}
