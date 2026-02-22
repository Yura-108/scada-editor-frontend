import React from "react";

export interface PaletteItemType {
  type: string;
  label: string;
  icon?: string;
  category: string;
  iconComponent?: React.FC<{ size: number }>
  defaultProps: Record<string, any>;
  defaultStyle?: Record<string, any>;
}

