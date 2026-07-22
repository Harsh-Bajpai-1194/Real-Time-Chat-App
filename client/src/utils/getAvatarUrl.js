import md5 from './md5.js';

const getAvatarUrl = (username, picture, email = '') => {
    if (picture) return picture;
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (normalizedEmail && !normalizedEmail.startsWith('guestuser')) {
      return `https://www.gravatar.com/avatar/${md5(normalizedEmail)}?d=identicon&s=200`;
    }
    const seed = encodeURIComponent((username || 'GuestUser').trim());
    return `https://api.dicebear.com/8.x/identicon/svg?seed=${seed}`;
};

export { getAvatarUrl };