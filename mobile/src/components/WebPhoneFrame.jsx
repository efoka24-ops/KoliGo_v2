import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, Dimensions } from 'react-native';
import { colors } from '../constants/colors';

const DEVICES = [
  { id: 'iphone16', label: 'iPhone 16',   w: 393, h: 852, r: 47, notch: 'dynamic' },
  { id: 'iphoneSE', label: 'iPhone SE 3', w: 375, h: 667, r: 20, notch: 'none'    },
  { id: 's24',      label: 'Galaxy S24',  w: 360, h: 780, r: 36, notch: 'punch'   },
  { id: 'pixel9',   label: 'Pixel 9',    w: 412, h: 892, r: 30, notch: 'punch'   },
];

function SidebarLabel({ children }) {
  return (
    <Text style={{
      color: 'rgba(255,255,255,0.3)', fontSize: 10,
      fontWeight: '700', letterSpacing: 1.2,
      textTransform: 'uppercase', marginBottom: 8,
    }}>{children}</Text>
  );
}

const SIDEBAR_W = 220;

export default function WebPhoneFrame({ children }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [selected, setSelected] = useState('iphone16');
  const d = DEVICES.find(x => x.id === selected);

  // Override Dimensions so all child screens see device dimensions, not browser width
  useEffect(() => {
    Dimensions.set({ window: { width: d.w, height: d.h, scale: 1, fontScale: 1 }, screen: { width: d.w, height: d.h, scale: 1, fontScale: 1 } });
    return () => {
      Dimensions.set({ window: { width: winW, height: winH, scale: 1, fontScale: 1 }, screen: { width: winW, height: winH, scale: 1, fontScale: 1 } });
    };
  }, [d.w, d.h, winW, winH]);

  // Scale to fit available space
  const pad = 40;
  const scale = Math.min(
    (winW - SIDEBAR_W - pad * 2) / d.w,
    (winH - pad * 2) / d.h,
    1
  );
  const sw = d.w * scale; // scaled width
  const sh = d.h * scale; // scaled height

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#141414' }}>

      {/* ── Sidebar ── */}
      <View style={{
        width: SIDEBAR_W, backgroundColor: '#1a1a1a',
        borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)',
        paddingTop: 28, paddingHorizontal: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, lineHeight: 20 }}>K</Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: -0.5 }}>
            {'Koli'}<Text style={{ color: colors.orange }}>{'Go'}</Text>
          </Text>
        </View>

        <SidebarLabel>Appareil</SidebarLabel>
        {DEVICES.map(dev => (
          <TouchableOpacity key={dev.id} onPress={() => setSelected(dev.id)} style={{
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, marginBottom: 3,
            backgroundColor: selected === dev.id ? 'rgba(13,122,62,0.18)' : 'transparent',
          }}>
            <View style={{
              width: 7, height: 7, borderRadius: 4, marginRight: 10,
              backgroundColor: selected === dev.id ? colors.green : 'rgba(255,255,255,0.18)',
            }} />
            <View>
              <Text style={{ color: selected === dev.id ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: selected === dev.id ? '700' : '400' }}>{dev.label}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.22)', fontSize: 10, marginTop: 1 }}>{dev.w} × {dev.h}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 20 }} />
        <SidebarLabel>KoliGo</SidebarLabel>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 19, marginTop: 4 }}>
          {'16 écrans navigables\nVendeur · Livreur\n'}
          <Text style={{ color: colors.orange }}>{'🇨🇲 Fait à Douala'}</Text>
        </Text>
      </View>

      {/* ── Phone area ── */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>

        {/* Phone shell */}
        <View style={{
          padding: 6,
          borderRadius: d.r * scale + 7,
          backgroundColor: '#222',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 32 },
          shadowOpacity: 0.7,
          shadowRadius: 64,
          elevation: 30,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}>
          {/* Clip container — exact scaled device dimensions */}
          <View style={{
            width: sw,
            height: sh,
            borderRadius: d.r * scale,
            backgroundColor: '#000',
            overflow: 'hidden',
          }}>
            {/*
              Content is rendered at full device dimensions (d.w × d.h),
              then scaled + offset so it aligns perfectly to the top-left.
              Formula: top/left = -(original - scaled) / 2
              This cancels the default center-origin of RN's scale transform.
            */}
            <View style={{
              position: 'absolute',
              top: -(d.h - sh) / 2,
              left: -(d.w - sw) / 2,
              width: d.w,
              height: d.h,
              transform: [{ scale }],
            }}>
              {children}
            </View>

            {/* Dynamic Island (iPhone 16) */}
            {d.notch === 'dynamic' && (
              <View pointerEvents="none" style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                alignItems: 'center', zIndex: 99,
              }}>
                <View style={{
                  width: 126 * scale, height: 37 * scale,
                  backgroundColor: '#000',
                  borderBottomLeftRadius: 22 * scale,
                  borderBottomRightRadius: 22 * scale,
                }} />
              </View>
            )}

            {/* Punch-hole (Samsung / Pixel) */}
            {d.notch === 'punch' && (
              <View pointerEvents="none" style={{
                position: 'absolute',
                top: 14 * scale,
                alignSelf: 'center',
                width: 14 * scale,
                height: 14 * scale,
                borderRadius: 7 * scale,
                backgroundColor: '#000',
                zIndex: 99,
              }} />
            )}
          </View>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, letterSpacing: 0.5 }}>
          {d.label}{'  ·  '}{Math.round(scale * 100)}{'%'}
        </Text>
      </View>
    </View>
  );
}
