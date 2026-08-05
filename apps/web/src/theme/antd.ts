import type { ThemeConfig } from 'antd';

export const MB = {
  olive: '#91922A',
  oliveDark: '#6b6c1f',
  oliveLight: '#b4b52e',
  oliveFaint: '#f4f4e8',
  mustard: '#DACD6B',
  mustardLight: '#eee8b0',
  brown: '#4A2C2A',
  brownMid: '#7a4a47',
  ivory: '#F7EED2',
  ivoryDark: '#ede1b8',
  salmon: '#F28A86',
  salmonLight: '#fad5d3',
  red: '#E13348',
  bg: '#FDFAF2',
  text: '#2e2018',
  muted: '#7a6a55',
  border: 'rgba(0,0,0,0.25)',
} as const;

const GlobalProperties = {
  ControlHeight: 40,
};

export const machBarTheme: ThemeConfig = {
  cssVar: { key: '_,:root,mb-theme' },
  token: {
    // Brand colors
    colorPrimary: MB.olive,
    colorError: MB.red,
    colorWarning: MB.salmon,
    colorSuccess: '#4caf50',

    // Backgrounds & surface
    colorBgBase: MB.bg,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',

    // Text
    colorTextBase: MB.text,
    colorTextSecondary: MB.muted,

    // Border
    colorBorder: 'rgba(145,146,42,0.25)',
    colorBorderSecondary: 'rgba(145,146,42,0.12)',

    // Typography
    fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 13,
    fontSizeSM: 11,
    fontSizeLG: 16,
    fontSizeHeading1: 28,
    fontSizeHeading2: 22,
    fontSizeHeading3: 16,
    fontSizeHeading4: 14,
    fontSizeHeading5: 13,

    // Shape
    borderRadius: 6,
    borderRadiusLG: 16,
    borderRadiusSM: 4,

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
      primaryColor: '#ffffff',
      defaultBorderColor: MB.border,
      defaultColor: MB.muted,
      fontWeight: 500,
      controlHeight: GlobalProperties.ControlHeight,
    },
    Input: {
      activeBorderColor: MB.olive,
      hoverBorderColor: MB.oliveDark,
      paddingBlock: 7,
      paddingInline: 11,
      controlHeight: GlobalProperties.ControlHeight,
    },
    Select: {
      optionSelectedBg: MB.oliveFaint,
      optionSelectedColor: MB.olive,
    },
    Form: {
      verticalLabelPadding: 0,
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
      headerBg: MB.ivory,
      headerColor: MB.muted,
      rowHoverBg: MB.oliveFaint,
    },
    Badge: {
      colorSuccess: '#2e7d32',
      colorSuccessBg: '#e8f5e9',
    },
    Tag: {
      defaultBg: MB.oliveFaint,
      defaultColor: MB.brown,
    },
    Card: {
      headerBg: MB.ivory,
    },
    Menu: {
      // Sidebar claro (estilo imagen): ítem activo como "pill" olivo relleno.
      itemBg: 'transparent',
      itemColor: MB.muted,
      itemHoverBg: MB.oliveFaint,
      itemHoverColor: MB.brown,
      itemSelectedBg: MB.olive,
      itemSelectedColor: '#ffffff',
      itemActiveBg: MB.oliveFaint,
      itemHeight: 44,
      itemBorderRadius: 10,
      itemMarginInline: 0,
      itemMarginBlock: 4,
      iconSize: 18,
      groupTitleColor: MB.muted,
      // Sidebar oscuro (legacy, sin uso en el admin claro).
      darkItemColor: 'rgba(232,223,200,0.6)',
      darkItemHoverColor: MB.mustard,
      darkItemSelectedColor: MB.mustard,
      darkItemBg: MB.brown,
      darkSubMenuItemBg: MB.brown,
    },
    Layout: {
      siderBg: '#ffffff',
      headerBg: 'transparent',
      headerPadding: '0 24px',
      bodyBg: '#f2f2f2',
    },
    Tabs: {
      inkBarColor: MB.brown,
      itemColor: MB.muted,
      itemActiveColor: MB.brown,
      itemSelectedColor: MB.brown,
      itemHoverColor: MB.brown,
    },
    Segmented: {
      itemSelectedBg: MB.olive,
      itemSelectedColor: '#ffffff',
    },
  },
};
