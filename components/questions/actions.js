'use server';

const JWT_SECRET = process.env.JWT_SECRET;

import { sign, verify } from 'jsonwebtoken';

export const qCreateToken = async ({ project, expiresIn = '100d' }) => {
    let token = null;
    try {
        token = sign(
            {
                project_id: project.id,
                project_name: project.name,
            },
            JWT_SECRET,
            { expiresIn }
        );
    }
    catch (error) {
        console.error('Error creating token:', error);
    }
    return token;
}

export const qValidateToken = (token) => {
    let payload = null;
    try {
        if (!JWT_SECRET) return null;

        let normalizedToken = token;
        if (Array.isArray(normalizedToken)) {
            normalizedToken = normalizedToken[0];
        } else if (normalizedToken && typeof normalizedToken === 'object') {
            normalizedToken = normalizedToken.token || '';
        }

        if (typeof normalizedToken !== 'string' || !normalizedToken.trim()) {
            return null;
        }

        const decoded = verify(normalizedToken, JWT_SECRET);
        if (!decoded) return null;

        if (typeof decoded === 'string') {
            try {
                payload = JSON.parse(decoded);
            } catch {
                payload = null;
            }
        } else if (typeof decoded === 'object') {
            payload = { ...decoded };
        }
    }
    catch (error) {
        // console.error('Error validating token:', error);
    }
    // console.log('Validated token payload:', payload);
    return payload;
}

export const qGetLink = async ({ project, contact }) => {
    try {
        const token = await qCreateToken({ project });
        const other = contact ? `&contact_id=${contact.id}` : '';

        // const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const link = `/questions?token=${token}${other}`;
        return link;

    } catch (error) {
        console.error('Error generating link:', error);
        return null;
    }
}