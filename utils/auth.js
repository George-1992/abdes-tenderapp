
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === 'true' ? true : false;

export const isFilePath = (path) => {
    let rs = false;
    try {
        if (!path) {
            return rs;
        }

        if (typeof path !== 'string' || !path.trim()) {
            return rs;
        };

        // Trim trailing slashes
        const cleanPath = path.trim().replace(/[/\\]+$/, '');

        // Check if the path ends with a file extension
        rs = /\.[a-zA-Z0-9]{1,5}$/.test(cleanPath);

        return rs;
    } catch (error) {
        return rs;
    }
};

export const isAuthPath = (path) => {
    try {
        if (!path) {
            console.log('isAuthPath no path');
            return false;
        }

        if (typeof path !== 'string' || !path.trim()) {
            console.log('isAuthPath invalid path');
            return false;
        }

        const cleanPath = path.trim().replace(/[/\\]+$/, '');

        // Define auth paths
        const authPaths = [
            '/auth/signin', '/auth/signup', '/auth/verify', '/auth/reset'
        ].filter(path => {
            return true;

            if (path === '/auth/signup') {
                return ALLOW_SIGNUP;
            }
            return true;
        });
        return authPaths.includes(cleanPath);

    } catch (error) {
        console.log('isAuthPath error ==> ', error);
        return false;
    }
}
