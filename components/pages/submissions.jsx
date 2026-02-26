'use client';

import { saCreateItem, saGetItems, saUpdateItem, saDeleteItem, saDeleteItems } from "@/actions";
import { notify } from "@/components/sonnar/sonnar";
import { PopupModal } from "@/components/other/modals";
import Table from "@/components/table";
import { cloneDeep } from "lodash";
import { useState, useEffect } from "react";
import FormBuilder from "@/components/formBuilder";

export default function Submitions({ pathname, user, account, session, workspace }) {

    const wId = workspace?.id || null;
    const collectionName = 'submissions';
    const [_isLoading, _setIsLoading] = useState(true);
    const [_data, _setData] = useState([]);
    const [_page, _setPage] = useState({
        skip: 0,
        take: 10,
        itemsPerPage: 10,
        total: 0
    });
    const [_editItem, _setEditItem] = useState(null);

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

            if (action === 'update') {
                ['project', 'workspace', 'contact'].forEach(relKey => {
                    if (toSaveData.hasOwnProperty(relKey)) {
                        delete toSaveData[relKey];
                    }
                });
            }

            let response;

            if (action === 'create') {
                response = await saCreateItem({
                    collection: collectionName,
                    data: toSaveData,
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                            }
                        },
                        contact: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                            }
                        }
                    }
                });

                if (response && response.success) {
                    let newData = [..._data];
                    newData.unshift(response.data);
                    _setData(newData);
                    notify({ type: 'success', message: 'Submition created successfully' });
                    resObj.success = true;
                    resObj.data = response.data;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to create submition' });
                    resObj.success = false;
                    resObj.message = response.message || 'Failed to create submition';
                }
            } else if (action === 'update') {
                response = await saUpdateItem({
                    collection: collectionName,
                    query: {
                        where: { id: item.id },
                        data: toSaveData,
                        include: {
                            project: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            },
                            contact: {
                                select: {
                                    id: true,
                                    first_name: true,
                                    last_name: true,
                                }
                            }
                        }
                    }
                });

                if (response && response.success) {
                    _setData(prev => prev.map(i => i.id === item.id ? response.data : i));
                    notify({ type: 'success', message: 'Submition updated successfully' });
                    resObj.success = true;
                    resObj.data = response.data;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to update submition' });
                    resObj.success = false;
                    resObj.message = response.message || 'Failed to update submition';
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
                    notify({ type: 'success', message: 'Submition deleted successfully' });
                    resObj.success = true;
                    resObj.message = 'Done';
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to delete submition' });
                    resObj.success = false;
                    resObj.message = response.message || 'Failed to delete submition';
                }
            }

            return resObj;
        } catch (error) {
            console.error(`Error ${action}ing submition: `, error);
            notify({ type: 'error', message: error.message || `Failed to ${action} submition` });
            resObj.success = false;
            resObj.message = error.message || `Failed to ${action} submition`;
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
                        project: {
                            select: {
                                id: true,
                                name: true,
                            }
                        },
                        contact: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
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
            questions_json: JSON.stringify(item?.questions || [], null, 2),
        });
    };

    const handleNewItemClick = () => {
        _setEditItem({
            questions_json: '[]',
            project_id: '',
            contact_id: '',
        });
    };

    const handleFormSubmit = async (formData) => {
        let questions = [];
        try {
            questions = formData.questions_json ? JSON.parse(formData.questions_json) : [];
        } catch (_error) {
            notify({ type: 'error', message: 'Invalid questions JSON format' });
            return;
        }

        const nextItem = {
            ..._editItem,
            ...formData,
            questions,
        };
        delete nextItem.questions_json;

        if (_editItem.id) {
            await updateItem({ item: nextItem, action: 'update' });
        } else {
            await updateItem({ item: nextItem, action: 'create' });
        }
        _setEditItem(null);
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="container-main flex flex-col gap-4">
            <h1 className="text-2xl">Submitions</h1>

            <div className="w-full">
                <Table
                    className=""
                    editable={false}
                    sortable={true}
                    paginated={true}
                    page={_page}
                    onPageChange={handlePageChange}
                    previewKey=""
                    data={_data}
                    // onAddNew={handleNewItemClick}
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
                                message: 'Are you sure you want to delete this submition?',
                                button1: 'Cancel',
                                button2: 'Delete',
                            },
                            func: (item) => updateItem({ item, action: 'delete' })
                        }
                    ]}
                    columns={[
                        {
                            key: 'questions',
                            title: 'Questions',
                            width: 'w-64',
                            editable: false,
                            Component: (props) => {
                                const value = props.value;
                                const count = Array.isArray(value) ? value.length : 0;
                                return <span className="text-sm text-gray-700">{count}</span>;
                            }
                        },
                        {
                            key: 'project_id',
                            title: 'Project',
                            width: 'w-64',
                            Component: (props) => {
                                const projectName = props?.row?.project?.name;
                                if (!projectName) return <span className="text-gray-400">-</span>;
                                return <span className="text-sm text-gray-700">{projectName}</span>;
                            }
                        },
                        {
                            key: 'contact_id',
                            title: 'Contact',
                            width: 'w-64',
                            Component: (props) => {
                                const firstName = props?.row?.contact?.first_name || '';
                                const lastName = props?.row?.contact?.last_name || '';
                                const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
                                if (!fullName) return <span className="text-gray-400">-</span>;
                                return <span className="text-sm text-gray-700">{fullName}</span>;
                            }
                        },
                    ]}
                />
            </div>

            {
                _editItem && <PopupModal isOpen={true} onClose={() => _setEditItem(null)}>
                    <div className="flex flex-col gap-4">
                        <FormBuilder
                            formData={_editItem}
                            onSubmit={handleFormSubmit}
                            fields={[
                                {
                                    name: 'questions_json',
                                    label: 'Questions (JSON Array)',
                                    type: 'textarea',
                                    required: true,
                                    className: 'h-60',
                                },
                                {
                                    name: 'project_id',
                                    label: 'Project ID',
                                    type: 'text',
                                    required: false,
                                },
                                {
                                    name: 'contact_id',
                                    label: 'Contact ID',
                                    type: 'text',
                                    required: false,
                                }
                            ]}
                        />
                    </div>
                </PopupModal>
            }

        </div>
    );
}
