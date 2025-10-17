import { createContext, useContext, useState, ReactNode } from "react";

interface BandContextType {
  selectedBandId: string | null;
  setSelectedBandId: (bandId: string | null) => void;
}

const BandContext = createContext<BandContextType | undefined>(undefined);

export const BandProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

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
