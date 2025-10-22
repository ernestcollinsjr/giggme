import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BandContextType {
  selectedBandId: string | null;
  setSelectedBandId: (bandId: string | null) => void;
}

const BandContext = createContext<BandContextType | undefined>(undefined);

const STORAGE_KEY = "selectedBandId";

export const BandProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBandId, setSelectedBandId] = useState<string | null>(() => {
    // Initialize from localStorage if available
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  // Persist to localStorage whenever it changes
  useEffect(() => {
    if (selectedBandId) {
      localStorage.setItem(STORAGE_KEY, selectedBandId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedBandId]);

  return (
    <BandContext.Provider value={{ selectedBandId, setSelectedBandId }}>
      {children}
    </BandContext.Provider>
  );
};

export const useBand = () => {
  const context = useContext(BandContext);
  if (context === undefined) {
    throw new Error("useBand must be used within a BandProvider");
  }
  return context;
};
