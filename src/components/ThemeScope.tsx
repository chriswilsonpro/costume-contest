import { useEffect, useState, type ReactNode } from 'react';
import { getDataStore } from '../lib/dataStore';
import type { ThemeColor, ThemeFont, ThemeSize } from '../lib/types';

type Props = {
  children: ReactNode;
};

const DEFAULTS = {
  themeColor: 'dark' as ThemeColor,
  titleFont: 'serif' as ThemeFont,
  bodyFont: 'sans' as ThemeFont,
  titleSize: 'medium' as ThemeSize,
  bodySize: 'medium' as ThemeSize,
};

export function ThemeScope({ children }: Props) {
  const [themeColor, setThemeColor] = useState<ThemeColor>(DEFAULTS.themeColor);
  const [titleFont, setTitleFont] = useState<ThemeFont>(DEFAULTS.titleFont);
  const [bodyFont, setBodyFont] = useState<ThemeFont>(DEFAULTS.bodyFont);
  const [titleSize, setTitleSize] = useState<ThemeSize>(DEFAULTS.titleSize);
  const [bodySize, setBodySize] = useState<ThemeSize>(DEFAULTS.bodySize);

  useEffect(() => {
    return getDataStore().subscribeActiveContest((bundle) => {
      if (!bundle) {
        setThemeColor(DEFAULTS.themeColor);
        setTitleFont(DEFAULTS.titleFont);
        setBodyFont(DEFAULTS.bodyFont);
        setTitleSize(DEFAULTS.titleSize);
        setBodySize(DEFAULTS.bodySize);
        return;
      }
      setThemeColor(bundle.contest.themeColor);
      setTitleFont(bundle.contest.titleFont);
      setBodyFont(bundle.contest.bodyFont);
      setTitleSize(bundle.contest.titleSize);
      setBodySize(bundle.contest.bodySize);
    });
  }, []);

  return (
    <div
      className="theme-root"
      data-color={themeColor}
      data-title-font={titleFont}
      data-body-font={bodyFont}
      data-title-size={titleSize}
      data-body-size={bodySize}
    >
      {children}
    </div>
  );
}
