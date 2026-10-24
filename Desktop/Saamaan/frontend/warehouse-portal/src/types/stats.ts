export interface WarehouseFacilityMetadata {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: string;
  status: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  contactPersonName?: string | null;
  contactEmail?: string | null;
  contactPhoneNumber?: string | null;
}

export interface WarehouseMetrics {
  physicalStock: number;
  physicalStockFormatted: string;
  physicalStockTrend: string;
  physicalStockTrendColor: string;

  reservedStock: number;
  reservedStockFormatted: string;
  reservedStockTrend: string;
  reservedStockTrendColor: string;

  damagedStock: number;
  damagedStockFormatted: string;
  damagedStockTrend: string;
  damagedStockTrendColor: string;

  availableToPromise: number;
  availableToPromiseFormatted: string;
  availableToPromiseTrend: string;
  availableToPromiseTrendColor: string;

  totalSKUs: number;
  connectedSellersCount: number;
  safetyStockTotal: number;
  activeReservationsCount: number;
  staffCount: number;
}

export interface ActivityPoint {
  day: string;
  date: string;
  units: number;
  isPeak?: boolean;
  x: number;
  y: number;
}

export interface ActivityHighlightPoint {
  x: number;
  y: number;
  units: number;
  label: string;
}

export interface ActivitySummaryCard {
  dayLabel: string;
  units: number;
  unitsFormatted: string;
  isPeak?: boolean;
}

export interface ActivityChartData {
  currentDateBadge: string;
  maxAxisValue: number;
  axisLabels: number[];
  points: ActivityPoint[];
  svgPath: string;
  svgArea: string;
  highlightPoints: ActivityHighlightPoint[];
  summaryCards: ActivitySummaryCard[];
  summary: {
    peakDayLabel: string;
    peakDayUnits: number;
    totalWeekUnits: number;
    recentInboundCount: number;
  };
}

export interface WarehouseDashboardStats {
  warehouse: WarehouseFacilityMetadata;
  metrics: WarehouseMetrics;
  activityChart: ActivityChartData;
}
