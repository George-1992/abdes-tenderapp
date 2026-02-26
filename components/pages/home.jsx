"use client";

import { saGetItems } from "@/actions";
import { notify } from "@/components/sonnar/sonnar";
import { FileTextIcon, FolderKanbanIcon, UserPlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const toTimeAgo = (dateValue) => {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD}d ago`;
    const diffMo = Math.floor(diffD / 30);
    if (diffMo < 12) return `${diffMo}mo ago`;
    const diffY = Math.floor(diffMo / 12);
    return `${diffY}y ago`;
};

export default function Home({ params, pathname, searchParams, session, user, account, workspace }) {

    const [_isLoading, _setIsLoading] = useState(true);
    const [_stats, _setStats] = useState([
        { label: 'Active Projects', value: '0', change: 'Live from DB' },
        { label: 'Contacts', value: '0', change: 'Live from DB' },
        { label: 'Submissions', value: '0', change: 'Live from DB' },
        { label: 'Notes', value: '0', change: 'Live from DB' },
    ]);
    const [_activities, _setActivities] = useState([]);

    const fetchDashboardData = async () => {
        try {
            _setIsLoading(true);

            const where = {
                workspace_id: workspace ? workspace.id : null,
            };

            const [projectsRes, contactsRes, submitionsRes, notesRes] = await Promise.all([
                saGetItems({
                    collection: 'projects',
                    includeCount: true,
                    query: { where, orderBy: { created_at: 'desc' }, take: 5 }
                }),
                saGetItems({
                    collection: 'contacts',
                    includeCount: true,
                    query: { where, orderBy: { created_at: 'desc' }, take: 5 }
                }),
                saGetItems({
                    collection: 'submissions',
                    includeCount: true,
                    query: { where, orderBy: { created_at: 'desc' }, take: 5 }
                }),
                saGetItems({
                    collection: 'notes',
                    includeCount: true,
                    query: { where, orderBy: { created_at: 'desc' }, take: 5 }
                }),
            ]);

            _setStats([
                { label: 'Active Projects', value: `${projectsRes?.count || 0}`, change: 'Live from DB' },
                { label: 'Contacts', value: `${contactsRes?.count || 0}`, change: 'Live from DB' },
                { label: 'Submissions', value: `${submitionsRes?.count || 0}`, change: 'Live from DB' },
                { label: 'Notes', value: `${notesRes?.count || 0}`, change: 'Live from DB' },
            ]);

            const activityRows = [
                ...(projectsRes?.data || []).map((item) => ({
                    title: 'Project updated',
                    detail: item?.name || 'Untitled project',
                    at: item?.updated_at || item?.created_at,
                })),
                ...(contactsRes?.data || []).map((item) => ({
                    title: 'Contact updated',
                    detail: item?.name || item?.email || 'Unnamed contact',
                    at: item?.updated_at || item?.created_at,
                })),
                ...(submitionsRes?.data || []).map((item) => ({
                    title: 'Submition updated',
                    detail: item?.id || 'Unknown submition',
                    at: item?.updated_at || item?.created_at,
                })),
                ...(notesRes?.data || []).map((item) => ({
                    title: 'Note updated',
                    detail: item?.title || 'Untitled note',
                    at: item?.updated_at || item?.created_at,
                })),
            ]
                .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
                .slice(0, 8)
                .map((item) => ({
                    title: item.title,
                    detail: item.detail,
                    when: toTimeAgo(item.at),
                }));

            _setActivities(activityRows);

            if (!projectsRes?.success || !contactsRes?.success || !submitionsRes?.success || !notesRes?.success) {
                notify({ type: 'error', message: 'Some dashboard data could not be loaded' });
            }
        } catch (error) {
            console.error('Error loading dashboard: ', error);
            notify({ type: 'error', message: error.message || 'Failed to load dashboard data' });
        } finally {
            _setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [workspace?.id]);

    return (
        <div className="container-main flex flex-col gap-6">
            <div className="rounded-xl gap-6 border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-5 flex items-center  ">
                <div>
                    <Image
                        src="/images/other/building-construction.png"
                        alt="Logo"
                        width={60}
                        height={50}
                        className="mb-2"
                    />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Welcome back{user?.first_name ? `, ${user.first_name}` : ''}. Here is a quick overview.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {_stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-sm text-gray-500">{stat.label}</p>
                        <p className="mt-2 text-3xl font-semibold text-gray-900">{_isLoading ? '...' : stat.value}</p>
                        <p className="mt-1 text-xs text-gray-500">{stat.change}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 xl:col-span-2">
                    <h2 className="text-lg font-medium">Recent Activity</h2>
                    <div className="mt-4 space-y-3">
                        {_activities.length === 0 && !_isLoading && (
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                                No activity yet.
                            </div>
                        )}
                        {_activities.map((activity, index) => (
                            <div key={`${activity.title}-${index}`} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                                    <p className="text-xs text-gray-500">{activity.detail}</p>
                                </div>
                                <span className="text-xs text-gray-400">{activity.when}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="text-lg font-medium">Quick Actions</h2>
                    <div className="mt-4 flex flex-wrap gap-5">
                        <Link href="/projects" className="h-32 w-40 rounded-md border border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50 flex flex-col items-center justify-center text-center transition-transform duration-200 hover:scale-105">
                            <FolderKanbanIcon className="size-8 mb-2" />
                            New Project
                        </Link>
                        <Link href="/contacts" className="h-32 w-40 rounded-md border border-green-300 text-green-600 hover:border-green-500 hover:bg-green-50 flex flex-col items-center justify-center text-center transition-transform duration-200 hover:scale-105">
                            <UserPlusIcon className="size-8 mb-2" />
                            Add Contact
                        </Link>
                        <Link href="/submissions" className="h-32 w-40 rounded-md border border-purple-300 text-purple-600 hover:border-purple-500 hover:bg-purple-50 flex flex-col items-center justify-center text-center transition-transform duration-200 hover:scale-105">
                            <FileTextIcon className="size-8 mb-2" />
                            Create Submission
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}