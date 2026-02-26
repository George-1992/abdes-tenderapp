import localFont from "next/font/local";
import "@/app/globals.scss";
import { verify } from "jsonwebtoken";
import { saGetItem } from "@/actions";
import { RenderQuestion } from "@/components/questions/parts";

const JWT_SECRET = process.env.JWT_SECRET;

export const metadata = {
    title: process.env.NEXT_PUBLIC_PROJECT_NAME || 'SuperApp',
    // description: "My SuperApp Application",
};


export default async function Page(props) {
    // console.log('Project Questions Page props: ', props);

    const resolvedParams = await props.params;
    const resolvedSearchParams = await props.searchParams;

    let projectId = null;
    let projectObj = null;
    const token = Array.isArray(resolvedSearchParams?.token)
        ? resolvedSearchParams.token[0]
        : resolvedSearchParams?.token;
    const contact_id = Array.isArray(resolvedSearchParams?.contact_id)
        ? resolvedSearchParams.contact_id[0]
        : resolvedSearchParams?.contact_id;

    const parseTokenPayload = (rawToken) => {
        try {
            if (!JWT_SECRET) return null;
            if (typeof rawToken !== 'string' || !rawToken.trim()) return null;

            const decoded = verify(rawToken, JWT_SECRET);
            if (!decoded) return null;

            if (typeof decoded === 'string') {
                try {
                    return JSON.parse(decoded);
                } catch {
                    return null;
                }
            }

            if (typeof decoded === 'object') {
                return { ...decoded };
            }

            return null;
        } catch (_error) {
            return null;
        }
    };

    let _tokenPayload = null;
    const isAllowed = async () => {
        try {

            const ALLOWED = token && contact_id;
            if (!ALLOWED) return false;
            // parse token
            _tokenPayload = parseTokenPayload(token);
            // console.log('Token payload:', _tokenPayload);
            if (!_tokenPayload) {
                // console.error('Invalid token payload');
                return false;
            };

            projectId = _tokenPayload.project_id;

            // fetch project from DB and compare name if needed
            const d = await saGetItem({
                collection: 'projects',
                query: {
                    where: {
                        id: projectId,
                        status: 'active'
                    }
                }
            });
            projectObj = d && d.success && d.data ? d.data : null;
            if (!projectObj) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating token:', error);
            return false;
        }
    }

    const allowed = await isAllowed();

    // console.log('allowed:', allowed);
    // console.log('Token payload:', _tokenPayload);
    // console.log('Project object:', projectObj);



    return (
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="icon" href="/images/logos/main.png" />

            </head>
            <body className="w-full h-screen flex items-center justify-center overflow-hidden">
                {
                    !allowed && (
                        <div className="p-4 bg-red-100 text-red-700 rounded">
                            Invalid Access. Please make sure you have a valid URL.
                        </div>
                    )
                }
                {allowed && <RenderQuestion project={projectObj} contact={{ id: contact_id }} />}
            </body>
        </html>
    );
}