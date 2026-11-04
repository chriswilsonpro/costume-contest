import { useEffect, useState, type ReactNode } from 'react';
import { getDataStore } from '../lib/dataStore';
import type { ThemeColor, ThemeFont } from '../lib/types';

type Props = {
  children: ReactNode;
};

const DEFAULTS = {
  themeColor: 'dark' as ThemeColor,
  titleFont: 'serif' as ThemeFont,
  bodyFont: 'sans' as ThemeFont,
};

export function ThemeScope({ children }: Props) {
  const [themeColor, setThemeColor] = useState<ThemeColor>(DEFAULTS.themeColor);
  const [titleFont, setTitleFont] = useState<ThemeFont>(DEFAULTS.titleFont);
  const [bodyFont, setBodyFont] = useState<ThemeFont>(DEFAULTS.bodyFont);

  useEffect(() => {
    return getDataStore().subscribeActiveContest((bundle) => {
      if (!bundle) {
        setThemeColor(DEFAULTS.themeColor);
        setTitleFont(DEFAULTS.titleFont);
        setBodyFont(DEFAULTS.bodyFont);
        return;
      }
      setThemeColor(bundle.contest.themeColor);
      setTitleFont(bundle.contest.titleFont);
      setBodyFont(bundle.contest.bodyFont);
    });
  }, []);

  return (
    <div
      className="theme-root"
      data-color={themeColor}
      data-title-font={titleFont}
      data-body-font={bodyFont}
    >
      {children}
    </div>
  );
}
