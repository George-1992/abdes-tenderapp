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

 