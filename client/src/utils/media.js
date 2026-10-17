import kkrLogo from '../team_logo/KKR-Photoroom.png';
import rrLogo from '../team_logo/RR-Photoroom.png';
import mmgLogo from '../team_logo/MMG-Photoroom.png';
import ssLogo from '../team_logo/SS-Photoroom.png';

export const TEAM_LOGOS = {
  'KKR-Photoroom.png': kkrLogo,
  'RR-Photoroom.png': rrLogo,
  'MMG-Photoroom.png': mmgLogo,
  'SS-Photoroom.png': ssLogo,
  'KKR': kkrLogo,
  'RR': rrLogo,
  'MMG': mmgLogo,
  'SS': ssLogo,
  'Kotawade Knight Riders': kkrLogo,
  'Ratnagiri Royals': rrLogo,
  'Malgund Maha Giants': mmgLogo,
  'Sherle Sunrisers': ssLogo
};

/**
 * Resolves an image URL (such as player photo or uploaded asset).
 * If the URL is relative (e.g. /uploads/...), prepends VITE_API_URL so it loads from Render in production.
 */
export const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return apiBase ? `${apiBase}${cleanPath}` : cleanPath;
};

/**
 * Resolves a team logo.
 * First checks bundled assets for instant offline/CDN delivery,
 * then falls back to full remote URL or backend-relative URL.
 */
export const resolveTeamLogo = (team) => {
  if (!team) return null;

  // If team is a string (e.g. logo filename, code, or URL)
  if (typeof team === 'string') {
    if (TEAM_LOGOS[team]) return TEAM_LOGOS[team];
    if (TEAM_LOGOS[team.toUpperCase()]) return TEAM_LOGOS[team.toUpperCase()];
    if (team.startsWith('http://') || team.startsWith('https://') || team.startsWith('data:')) return team;
    return resolveImageUrl(team.startsWith('/') ? team : `/team_logo/${team}`);
  }

  // If team is an object { logo, code, name }
  if (team.logo && TEAM_LOGOS[team.logo]) return TEAM_LOGOS[team.logo];
  if (team.code && TEAM_LOGOS[team.code.toUpperCase()]) return TEAM_LOGOS[team.code.toUpperCase()];
  if (team.name && TEAM_LOGOS[team.name]) return TEAM_LOGOS[team.name];

  if (team.logo) {
    if (team.logo.startsWith('http://') || team.logo.startsWith('https://') || team.logo.startsWith('data:')) {
      return team.logo;
    }
    return resolveImageUrl(team.logo.startsWith('/') ? team.logo : `/team_logo/${team.logo}`);
  }

  return null;
};
