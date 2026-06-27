export const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.host;
    const protocol = window.location.protocol;

    // GitHub.dev / Codespaces forwarded ports use host-based port routing.
    const githubDevMatch = host.match(/^(.*?)-\d+\.app\.github\.dev$/);
    if (githubDevMatch) {
      return `${protocol}//${githubDevMatch[1]}-7777.app.github.dev`;
    }

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:7777';
    }

    return `${protocol}//${window.location.hostname}:7777`;
  }

  return 'http://localhost:7777';
};
