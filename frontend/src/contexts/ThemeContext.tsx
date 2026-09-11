import { createContext, useContext, useEffect, useState } from "react";

export interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  floorNumber: string;
  roomNumber: string;
  contactLine: string;
  receiptSlogan: string;
  receiptVerificationBaseUrl: string;
  taxId: string;
}

export interface ThemeSettings {
  primaryColor: string;
  mode: "light" | "dark" | "system";
}

export interface Settings {
  companyDetails: CompanyDetails;
  theme: ThemeSettings;
}

export const DEFAULT_PRIMARY_COLOR = "#003399";

const defaultSettings: Settings = {
  companyDetails: {
    name: "Queenstech Inc.",
    email: "info@queenstech.com",
    phone: "+1 (555) 123-4567",
    address: "123 Business Street, Tech City, TC 12345",
    location: "Queenstech HQ",
    floorNumber: "Ground Floor",
    roomNumber: "Room 01",
    contactLine: "+1 (555) 123-4567",
    receiptSlogan: "Thank you for your business.",
    receiptVerificationBaseUrl: "",
    taxId: "12-3456789",
  },
  theme: {
    primaryColor: DEFAULT_PRIMARY_COLOR,
    mode: "light",
  },
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
}>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const applyTheme = (theme: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty("--custom-primary", theme.primaryColor);
    
    if (theme.mode === "dark") {
      root.classList.add("dark");
    } else if (theme.mode === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
