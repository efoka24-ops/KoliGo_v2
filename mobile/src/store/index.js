import React, { createContext, useContext, useState } from 'react';

// Lightweight global state: current role + a couple of demo toggles.
// Swap for Redux/Zustand/React Query when wiring the real API.
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [role, setRole] = useState('vendor'); // 'vendor' | 'deliverer'
  const [online, setOnline] = useState(true);

  return (
    <AppContext.Provider value={{ role, setRole, online, setOnline }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
