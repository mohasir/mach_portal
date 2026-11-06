import type { ThemeConfig } from 'antd';

export const BRAND = {
  mist: '#E7EAF1',
  navy: '#14243E',
  navyMid: '#3A4C6B',
  navyDark: '#0B1627',
  blue: '#394F9A',
  blueLight: '#8D9CCB',
  sand: '#EDEEE8',
  sandDark: '#DCDDD3',
  red: '#E13348',
  bg: '#EDEEE8',
  text: '#14243E',
  muted: '#5B6678',
  border: 'rgba(20,36,62,0.25)',
} as const;

const GlobalProperties = {
  ControlHeight: 40,
};

export const oraviCloudTheme: ThemeConfig = {
  cssVar: { key: '_,:root,oravi-theme' },
  token: {
    // Brand colors
    colorPrimary: BRAND.navy,
    colorInfo: BRAND.blue,
    colorLink: BRAND.blue,
    colorError: BRAND.red,
    colorWarning: '#faad14',
    colorSuccess: '#4caf50',

    // Backgrounds & surface
    colorBgBase: BRAND.bg,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',

    // Text
    colorTextBase: BRAND.text,
    colorTextSecondary: BRAND.muted,

    // Border
    colorBorder: 'rgba(20,36,62,0.25)',
    colorBorderSecondary: 'rgba(20,36,62,0.12)',

    // Typography
    fontFamily: "var(--font-fustat), -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 14,
    fontSizeSM: 11,
    fontSizeLG: 16,
    fontSizeHeading1: 28,
    fontSizeHeading2: 22,
    fontSizeHeading3: 16,
    fontSizeHeading4: 14,
    fontSizeHeading5: 13,

    // Shape
    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 6,

    // Spacing
    padding: 16,
    paddingSM: 11,
    paddingXS: 8,
    paddingLG: 22,

    // Lines
    lineWidth: 0.5,

    // Motion
    motionDurationMid: '0.15s',
  },
  components: {
    Button: {
      colorPrimaryHover: BRAND.navyMid,
      colorPrimaryActive: BRAND.navyDark,
      primaryColor: '#ffffff',
      defaultBorderColor: BRAND.border,
      defaultColor: BRAND.muted,
      fontWeight: 500,
      controlHeight: GlobalProperties.ControlHeight,
    },
    Input: {
      activeBorderColor: BRAND.navy,
      hoverBorderColor: BRAND.navy,
      paddingBlock: 7,
      paddingInline: 11,
      controlHeight: GlobalProperties.ControlHeight,
    },
    Select: {
      optionSelectedBg: BRAND.mist,
      optionSelectedColor: BRAND.navy,
    },
    Form: {
      verticalLabelPadding: '0 0 8px',
      labelFontSize: 14,
    },
    InputNumber: {
      controlHeight: GlobalProperties.ControlHeight,
    },
    DatePicker: {
      paddingBlock: 7,
      paddingInline: 11,
      controlHeight: GlobalProperties.ControlHeight,
    },
    Table: {
      headerBg: BRAND.sand,
      headerColor: BRAND.muted,
      rowHoverBg: BRAND.mist,
    },
    Badge: {
      colorSuccess: '#2e7d32',
      colorSuccessBg: '#e8f5e9',
    },
    Tag: {
      defaultBg: BRAND.mist,
      defaultColor: BRAND.navy,
    },
    Card: {
      headerBg: BRAND.sand,
      bodyPadding: 18,
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: BRAND.muted,
      itemHoverBg: BRAND.mist,
      itemHoverColor: BRAND.navy,
      itemSelectedBg: BRAND.mist,
      itemSelectedColor: BRAND.navy,
      itemActiveBg: BRAND.mist,
      itemHeight: 44,
      itemBorderRadius: 10,
      itemMarginInline: 0,
      itemMarginBlock: 4,
      iconSize: 18,
      groupTitleColor: BRAND.muted,
      darkItemColor: 'rgba(237,238,232,0.6)',
      darkItemHoverColor: BRAND.blueLight,
      darkItemSelectedColor: BRAND.blueLight,
      darkItemBg: BRAND.navy,
      darkSubMenuItemBg: BRAND.navy,
    },
    Layout: {
      siderBg: '#ffffff',
      headerBg: 'transparent',
      headerPadding: '0 24px',
      bodyBg: BRAND.sand,
    },
    Tabs: {
      inkBarColor: BRAND.navy,
      itemColor: BRAND.muted,
      itemActiveColor: BRAND.navy,
      itemSelectedColor: BRAND.navy,
      itemHoverColor: BRAND.navy,
    },
    Segmented: {
      itemSelectedBg: BRAND.navy,
      itemSelectedColor: '#ffffff',
      trackBg: BRAND.mist,
    },
    Divider: {
      colorSplit: 'rgba(20,36,62,0.20)',
      lineWidth: 0.5,
    },
    Checkbox: {
      colorBorder: BRAND.border,
      lineWidth: 1,
      controlInteractiveSize: 20,
    },
  },
};
