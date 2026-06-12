import React from 'react';

const S = { fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' };

export const IconDashboard  = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>;
export const IconBox        = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>;
export const IconUsers      = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 6M18 20a5.5 5.5 0 0 0-3-5"/></svg>;
export const IconFinance    = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="12" cy="12" r="3"/><path d="M7 9v6M17 9v6"/></svg>;
export const IconSupport    = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6A8.5 8.5 0 1 1 21 11.5z"/></svg>;
export const IconZones      = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>;
export const IconAnalytics  = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/></svg>;
export const IconSettings   = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><circle cx="12" cy="12" r="3.2"/><path d="M19.4 12a7.4 7.4 0 0 0-.1-1.4l2-1.5-2-3.4-2.3 1a7.3 7.3 0 0 0-2.4-1.4L14.5 2h-4l-.4 2.3a7.3 7.3 0 0 0-2.4 1.4l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.8l-2 1.5 2 3.4 2.3-1a7.3 7.3 0 0 0 2.4 1.4l.4 2.3h4l.4-2.3a7.3 7.3 0 0 0 2.4-1.4l2.3 1 2-3.4-2-1.5c.1-.5.1-.9.1-1.4z"/></svg>;
export const IconBell       = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
export const IconSearch     = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>;
export const IconLogout     = (p) => <svg viewBox="0 0 24 24" {...S} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
