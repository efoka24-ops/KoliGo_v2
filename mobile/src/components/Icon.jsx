import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { colors } from '../constants/colors';

export default function Icon({ name, size = 22, color, strokeWidth = 1.7, style }) {
  const c = color || colors.ink;
  const p = { fill: 'none', stroke: c, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };

  const icons = {
    home:     <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-4v-6h-8v6H4a1 1 0 0 1-1-1z" {...p} />,
    package:  <><Path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" {...p}/><Path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.25l9 4.5" {...p}/></>,
    moto:     <><Circle cx="5.5" cy="17" r="3" {...p}/><Circle cx="18" cy="17" r="3" {...p}/><Path d="M8.5 17h6l3-7h2M11 10h6l1.5 4M5.5 14V11h3" {...p}/></>,
    pin:      <><Path d="M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" {...p}/><Circle cx="12" cy="9" r="2.5" {...p}/></>,
    pinDot:   <><Circle cx="12" cy="12" r="3" {...p}/><Circle cx="12" cy="12" r="8" {...p}/></>,
    star:     <Path d="m12 3 2.6 5.6 6 .7-4.4 4.2 1.2 6.1L12 16.7 6.6 19.6l1.2-6.1L3.4 9.3l6-.7z" {...p}/>,
    user:     <><Circle cx="12" cy="8" r="4" {...p}/><Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" {...p}/></>,
    bell:     <><Path d="M6 17V10a6 6 0 0 1 12 0v7M4 17h16M10 20a2 2 0 0 0 4 0" {...p}/></>,
    chat:     <Path d="M4 5h16v11H10l-4 4v-4H4z" {...p}/>,
    arrow:    <><Path d="M5 12h14M13 6l6 6-6 6" {...p}/></>,
    back:     <><Path d="M19 12H5M11 6l-6 6 6 6" {...p}/></>,
    check:    <Path d="m5 12 5 5L20 7" {...p}/>,
    close:    <><Path d="M6 6l12 12M6 18 18 6" {...p}/></>,
    plus:     <><Path d="M12 5v14M5 12h14" {...p}/></>,
    minus:    <Path d="M5 12h14" {...p}/>,
    eye:      <><Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...p}/><Circle cx="12" cy="12" r="3" {...p}/></>,
    camera:   <><Path d="M4 8h3l2-2h6l2 2h3v11H4z" {...p}/><Circle cx="12" cy="13" r="3.5" {...p}/></>,
    id:       <><Rect x="3" y="5" width="18" height="14" rx="2" {...p}/><Circle cx="8.5" cy="11" r="2.5" {...p}/><Path d="M4 18c.7-2.4 2.5-3.5 4.5-3.5s3.8 1.1 4.5 3.5M14 9h5M14 13h4M14 16h3" {...p}/></>,
    wallet:   <><Rect x="3" y="6" width="18" height="13" rx="2" {...p}/><Path d="M16 13.5h2.5M3 10h18" {...p}/></>,
    history:  <><Path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5M12 7v5l3 2" {...p}/></>,
    filter:   <><Path d="M3 6h18M6 12h12M10 18h4" {...p}/></>,
    search:   <><Circle cx="11" cy="11" r="6" {...p}/><Path d="m20 20-4-4" {...p}/></>,
    flag:     <><Path d="M5 21V4M5 5h12l-2 4 2 4H5" {...p}/></>,
    weight:   <><Path d="M5 9h14l-1 11H6z" {...p}/><Path d="M9 9V6a3 3 0 0 1 6 0v3" {...p}/></>,
    sparkle:  <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" {...{...p, strokeWidth: 1.4}}/>,
    bolt:     <Path d="M13 3 5 14h5l-1 7 8-11h-5z" {...p}/>,
    shield:   <><Path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" {...p}/><Path d="m9 12 2 2 4-4" {...p}/></>,
    settings: <><Circle cx="12" cy="12" r="3" {...p}/><Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" {...{...p, strokeWidth: 1.4}}/></>,
    logout:   <><Path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9" {...p}/></>,
    crown:    <Path d="M3 8l3 9h12l3-9-5 4-4-6-4 6z" {...p}/>,
    send:     <Path d="M3 11 21 3l-8 18-2-7z" {...p}/>,
    dot3:     <><Circle cx="6" cy="12" r="1.2" fill={c} stroke="none"/><Circle cx="12" cy="12" r="1.2" fill={c} stroke="none"/><Circle cx="18" cy="12" r="1.2" fill={c} stroke="none"/></>,
    upload:   <><Path d="M12 16V4M6 10l6-6 6 6M4 20h16" {...p}/></>,
    clock:    <><Circle cx="12" cy="12" r="9" {...p}/><Path d="M12 7v5l3 2" {...p}/></>,
    copy:     <><Rect x="9" y="9" width="11" height="11" rx="2" {...p}/><Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...p}/></>,
    link:     <><Path d="M10 13a5 5 0 0 0 7.5.6l2-2a5 5 0 0 0-7-7l-1 1" {...p}/><Path d="M14 11a5 5 0 0 0-7.5-.6l-2 2a5 5 0 0 0 7 7l1-1" {...p}/></>,
    phone:    <Path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10 21 3 14 3 5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" {...p}/>,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {icons[name] || null}
    </Svg>
  );
}
