'use client';

import { saCreateItem, saGetItems, saUpdateItem, saDeleteItem, saDeleteItems } from "@/actions";
import { notify } from "@/components/sonnar/sonnar";
import { ExpandableModal, PopupModal } from "@/components/other/modals";
import Table from "@/components/table";
import { cloneDeep, includes } from "lodash";
import { useState, useEffect } from "react";
import FormBuilder from "@/components/formBuilder";
import FileUploader from "@/components/formBuilder/fileUploader";

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

            if (toSaveData.medias_json !== undefined) {
                try {
                    toSaveData.medias = toSaveData.medias_json ? JSON.parse(toSaveData.medias_json) : [];
                } catch (_error) {
                    notify({ type: 'error', message: 'Invalid medias JSON format' });
                    return {
                        success: false,
                        message: 'Invalid medias JSON format',
                        data: item,
                    };
                }
                delete toSaveData.medias_json;
            }

            if (action === 'update') {
                ['contacts', 'workspace'].forEach(relKey => {
                    if (toSaveData.hasOwnProperty(relKey)) {
                        delete toSaveData[relKey];
                    }
                });
            }

            let response;

            if (action === 'create') {
                response = await saCreateItem({
                    collection: collectionName,
                    data: toSaveData
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
    }

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
                    include: {
                        medias: true,
                        contacts: true,
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
    }

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
        _setEditItem({
            ...item,
            medias_json: JSON.stringify(item?.medias || [], null, 2)
        });
    };

    const handleNewItemClick = () => {
        _setEditItem({
            name: '',
            ai_prompt: '',
            skeleton: '',
            medias_json: '[]',
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        const uploadedKeys = (Array.isArray(_uploadedFiles) ? _uploadedFiles : [])
            .filter((item) => typeof item === 'string' && item.length > 0);

        let existingMedias = [];
        try {
            existingMedias = _editItem?.medias_json ? JSON.parse(_editItem.medias_json) : [];
            if (!Array.isArray(existingMedias)) {
                existingMedias = [];
            }
        } catch (_error) {
            existingMedias = [];
        }

        const mergedMedias = [...existingMedias, ...uploadedKeys];
        const nextItem = {
            ..._editItem,
            medias_json: JSON.stringify(mergedMedias, null, 2),
        };

        if (nextItem.id) {
            await updateItem({ item: nextItem, action: 'update' });
        } else {
            await updateItem({ item: nextItem, action: 'create' });
        }
        _setEditItem(null);
        _setUploadedFiles([]);
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                            width: 'w-64',
                            required: true,
                            validateKey: 'length',
                        },
                        {
                            key: 'ai_prompt',
                            title: 'AI Prompt',
                            width: 'w-96',
                            type: 'textarea',
                            Component: (props) => {
                                if (!props.value) return <span className="text-gray-400">No prompt</span>;
                                const truncated = props.value.length > 120 ? props.value.substring(0, 120) + '...' : props.value;
                                return <span className="text-sm text-gray-700">{truncated}</span>;
                            }
                        },
                        {
                            key: 'skeleton',
                            title: 'Skeleton',
                            width: 'w-96',
                            type: 'textarea',
                            Component: (props) => {
                                if (!props.value) return <span className="text-gray-400">No skeleton</span>;
                                const truncated = props.value.length > 120 ? props.value.substring(0, 120) + '...' : props.value;
                                return <span className="text-sm text-gray-700">{truncated}</span>;
                            }
                        },
                        {
                            key: 'medias',
                            title: 'Medias',
                            width: 'w-64',
                            editable: false,
                            Component: (props) => {
                                const value = props.value;
                                if (!value) return <span className="text-gray-400">[]</span>;
                                const asText = typeof value === 'string' ? value : JSON.stringify(value);
                                const truncated = asText.length > 80 ? asText.substring(0, 80) + '...' : asText;
                                return <span className="text-sm text-gray-700">{truncated}</span>;
                            }
                        },
                    ]}
                />
            </div>

            {
                _editItem && <ExpandableModal isOpen={true} onClose={() => _setEditItem(null)}  >
                    <form className="w-full h-full flex flex-col gap-4" onSubmit={handleFormSubmit}>
                        <div className="w-full flex justify-between items-center">
                            <div></div>
                            <button
                                className="btn"
                                type="submit"
                            >
                                Save
                            </button>
                        </div>
                        <div className="w-full h-full overflow-auto p-4">
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
                                <label htmlFor="">AI Prompt</label>
                                <textarea
                                    type="text"
                                    className="form-control h-40"
                                    value={_editItem.ai_prompt}
                                    required={true}
                                    onChange={(e) => _setEditItem(prev => ({ ...prev, ai_prompt: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label htmlFor="">Skeleton</label>
                                <textarea
                                    type="text"
                                    className="form-control h-40"
                                    value={_editItem.skeleton}
                                    required={true}
                                    onChange={(e) => _setEditItem(prev => ({ ...prev, skeleton: e.target.value }))}
                                />
                            </div>
                            <FileUploader
                                accept={['.pdf', '.doc', '.docx']}
                                multiple={true}
                                uploadToS3={true}
                                onFiles={(_tfiles) => {
                                    console.log('Files uploaded: ', _tfiles);
                                    // _setUploadedFiles(_tfiles)
                                }}
                            />
                        </div>
                        {/* <FormBuilder
                            formData={_editItem}
                            onSubmit={handleFormSubmit}
                            fields={[
                                {
                                    name: 'name',
                                    label: 'Name',
                                    type: 'text',
                                    required: true,
                                },
                                {
                                    name: 'ai_prompt',
                                    label: 'AI Prompt',
                                    type: 'textarea',
                                    className: 'h-40',
                                },
                                {
                                    name: 'skeleton',
                                    label: 'Skeleton',
                                    type: 'textarea',
                                    className: 'h-40',
                                },
                                {
                                    name: 'resume',
                                    label: 'Resume',
                                    placeholder: 'Upload your resume',
                                    type: 'file',
                                    accept: ['.pdf', '.doc', '.docx'],
                                    required: true,
                                    hidden: false,
                                }
                            ]}
                        /> */}
                    </form>

                </ExpandableModal>
            }

        </div>
    );
}
