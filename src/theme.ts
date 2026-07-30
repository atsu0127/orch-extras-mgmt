import { createTheme, type MantineColorsTuple } from '@mantine/core'

/**
 * 温かいアイボリー・墨色・深いボルドー（設計書7.2 / ADR-0015）。
 * Mantine の既定色（青・紫系）は primary に使わない。
 */
const bordeaux: MantineColorsTuple = [
  '#F8EBED',
  '#EFD5DA',
  '#E0AAB4',
  '#CD7E8C',
  '#B85568',
  '#9E3A4F',
  '#822F41',
  '#6B2435',
  '#541B29',
  '#3A121C',
]

const ink: MantineColorsTuple = [
  '#F4F1EC',
  '#E4DFD6',
  '#C9C1B4',
  '#A89F90',
  '#877E70',
  '#6B6358',
  '#524C43',
  '#3C3731',
  '#2A2622',
  '#1A1714',
]

export const theme = createTheme({
  primaryColor: 'bordeaux',
  primaryShade: { light: 7, dark: 4 },
  colors: {
    bordeaux,
    ink,
  },
  fontFamily:
    '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif',
  headings: {
    fontFamily:
      '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.375rem', lineHeight: '1.4' },
      h2: { fontSize: '1.125rem', lineHeight: '1.4' },
      h3: { fontSize: '1rem', lineHeight: '1.4' },
    },
  },
  // 設計書7.2: 角丸は原則6〜8px。ピル型は選択肢の表現に限る
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '8px',
    xl: '8px',
  },
  defaultRadius: 'sm',
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },
  lineHeights: {
    xs: '1.45',
    sm: '1.5',
    md: '1.6',
    lg: '1.65',
    xl: '1.7',
  },
  spacing: {
    xs: '0.375rem',
    sm: '0.625rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  other: {
    appMaxWidth: '42rem',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        root: {
          minHeight: '2.75rem',
          fontWeight: 600,
        },
      },
    },
    TextInput: {
      defaultProps: {
        size: 'md',
        radius: 'sm',
      },
    },
    Textarea: {
      defaultProps: {
        size: 'md',
        radius: 'sm',
      },
    },
    Select: {
      defaultProps: {
        size: 'md',
        radius: 'sm',
      },
    },
    NativeSelect: {
      defaultProps: {
        size: 'md',
        radius: 'sm',
      },
    },
    Anchor: {
      defaultProps: {
        underline: 'hover',
      },
    },
  },
})
