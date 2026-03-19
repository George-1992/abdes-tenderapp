import AuthEl from "@/components/auth"
import VerifyAccount from "@/components/auth/verify";
import Home from "@/components/pages/home";
import Notes from "@/components/pages/notes";
import Projects from "@/components/pages/projects";
import Contacts from "@/components/pages/contacts";
import Submitions from "@/components/pages/submissions";
import Profile from "@/components/pages/profile"
import Settings from "@/components/pages/settings";
import {
    FolderKanbanIcon, HomeIcon, NotebookTextIcon,
    UserRoundIcon, SquarePenIcon, Settings2Icon
} from "lucide-react";
import TestPage from "@/components/pages/test";

const pagesMap = [
    // AUTH PAGES
    {
        pathname: '/auth/signin',
        Component: (props) => { return <AuthEl type="signin" {...props} /> },
    },
    {
        pathname: '/auth/signup',
        Component: (props) => { return <AuthEl type="signup" {...props} /> },
    },
    {
        pathname: '/auth/reset',
        Component: (props) => { return <AuthEl type="reset" {...props} /> },
    },
    {
        pathname: '/auth/verify',
        Component: (props) => { return <VerifyAccount {...props} /> },
    },
    // MAIN APP PAGES
    {
        pathname: '/',
        Component: (props) => { return <Home {...props} />; },
    },
    {
        pathname: '/profile',
        Component: (props) => { return <Profile {...props} />; },
    },
    {
        pathname: '/settings',
        Component: (props) => { return <Settings {...props} />; },
    },
    {
        pathname: '/not-found',
        Component: (props) => { return <div className="container-main">pagesMap not-found</div> },
    },
    {
        pathname: '/notes',
        Component: (props) => { return <Notes {...props} />; },
    },
    {
        pathname: '/projects',
        Component: (props) => { return <Projects {...props} />; },
    },
    {
        pathname: '/contacts',
        Component: (props) => { return <Contacts {...props} />; },
    },
    {
        pathname: '/submissions',
        Component: (props) => { return <Submitions {...props} />; },
    },
    {
        pathname: '/test',
        Component: (props) => { return <TestPage {...props} />; },
    }

]

export const pagesMapSidebar = [
    {
        name: 'Home',
        icon: (props) => <HomeIcon {...props} />,
        href: '/',
        subItems: []
    },
    {
        name: 'Projects',
        icon: (props) => <FolderKanbanIcon {...props} />,
        href: '/projects',
        subItems: []
    },
    {
        name: 'Contacts',
        icon: (props) => <UserRoundIcon {...props} />,
        href: '/contacts',
        subItems: []
    },
    {
        name: 'Submitions',
        icon: (props) => <SquarePenIcon {...props} />,
        href: '/submissions',
        subItems: []
    },
    {
        name: 'Notes',
        icon: (props) => <NotebookTextIcon {...props} />,
        href: '/notes',
        subItems: []
    },
    {
        name: 'Settings',
        icon: (props) => <Settings2Icon {...props} />,
        href: '/settings',
        subItems: []
    },
]

export default pagesMap;